#!/usr/bin/env python3
"""
Austin infill lot screener — GIS pre-screen only.
Usage:
  python austin_lot_screen.py "1200 E 6th St, Austin, TX"
  python austin_lot_screen.py lots.txt
"""

from __future__ import annotations

import csv
import json
import sys
import time
from pathlib import Path

import requests

SESSION = requests.Session()
SESSION.headers["User-Agent"] = "austin-lot-screen/1.0"

ZONING = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_1/MapServer/0/query"
FLOOD = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Floodplain/MapServer/0/query"
OVERLAYS = {
    "barton_springs": (
        "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_2/MapServer/2/query",
        "Barton Springs Overlay",
    ),
    "capitol_view": (
        "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_2/MapServer/4/query",
        "Capitol View Corridor",
    ),
    "nccd": (
        "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_2/MapServer/19/query",
        "Neighborhood Conservation",
    ),
    "wui": (
        "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_2/MapServer/31/query",
        "Wildland Urban Interface",
    ),
    "local_historic": (
        "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_3/MapServer/1/query",
        "Local Historic District",
    ),
    "nr_historic": (
        "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_3/MapServer/2/query",
        "National Register Historic",
    ),
}

PARCELS = (
    "https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/"
    "EXTERNAL_tcad_parcel/FeatureServer/0/query"
)
GEOCODE = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates"

# Watershed / environmental layers (common COA endpoints)
WATERSHED = (
    "https://maps.austintexas.gov/arcgis/rest/services/Shared/Watersheds/MapServer/0/query"
)
JURISDICTION = (
    "https://maps.austintexas.gov/arcgis/rest/services/Shared/Jurisdictions/MapServer/0/query"
)


def get_json(url: str, params: dict) -> dict:
    r = SESSION.get(url, params=params, timeout=45)
    r.raise_for_status()
    return r.json()


def geocode(address: str) -> tuple[float, float] | None:
    data = get_json(
        GEOCODE,
        {
            "SingleLine": address,
            "f": "json",
            "maxLocations": 1,
            "outSR": 4326,
        },
    )
    cands = data.get("candidates") or []
    if not cands:
        return None
    loc = cands[0]["location"]
    return loc["x"], loc["y"]


def point_query(url: str, lon: float, lat: float, out_fields: str = "*") -> list[dict]:
    geom = json.dumps({"x": lon, "y": lat, "spatialReference": {"wkid": 4326}})
    data = get_json(
        url,
        {
            "geometry": geom,
            "geometryType": "esriGeometryPoint",
            "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": out_fields,
            "returnGeometry": "false",
            "f": "json",
        },
    )
    if data.get("error"):
        return []
    return data.get("features") or []


def parcel_by_point(lon: float, lat: float) -> dict | None:
    feats = point_query(PARCELS, lon, lat, "*")
    return feats[0] if feats else None


def parcel_by_address(address: str) -> dict | None:
    street = address.split(",")[0].strip().upper().replace("'", "")
    data = get_json(
        PARCELS,
        {
            "where": f"UPPER(SITUS) LIKE '%{street}%'",
            "outFields": "*",
            "returnGeometry": "true",
            "outSR": 4326,
            "f": "json",
            "resultRecordCount": 5,
        },
    )
    if data.get("error"):
        return None
    feats = data.get("features") or []
    return feats[0] if feats else None


def score(row: dict) -> tuple[str, list[str]]:
    reasons: list[str] = []
    kill = caution = False

    floods = row.get("flood_zones") or []
    for z in floods:
        zl = (z or "").lower()
        if "25" in zl:
            kill = True
            reasons.append(f"KILL: 25-year floodplain ({z})")
        elif "100" in zl or "500" in zl or zl in {"a", "ae", "ah", "ao"}:
            caution = True
            reasons.append(f"CAUTION: floodplain ({z})")

    for name, hit in (row.get("overlays") or {}).items():
        if not hit:
            continue
        if name in {"local_historic", "capitol_view", "barton_springs", "nccd", "nr_historic"}:
            caution = True
            reasons.append(f"CAUTION: overlay {name}")
        if name == "wui":
            caution = True
            reasons.append("CAUTION: Wildland-Urban Interface")

    zoning = (row.get("zoning") or "").upper()
    if zoning and not any(x in zoning for x in ("SF", "MF", "MH", "LA", "RR", "UNZ")):
        if any(zoning.startswith(p) for p in ("LI", "IP", "MI", "CS", "CH", "CBD", "DMU")):
            caution = True
            reasons.append(f"CAUTION: non-typical residential zoning ({zoning})")

    if not reasons:
        reasons.append(
            "PASS: no hard GIS flags (still need title/utilities/trees/civil)"
        )

    if kill:
        return "KILL", reasons
    if caution:
        return "CAUTION", reasons
    return "PASS", reasons


def screen_address(address: str) -> dict:
    lonlat = geocode(address)
    if not lonlat:
        return {"address": address, "verdict": "ERROR", "notes": ["geocode failed"]}
    lon, lat = lonlat

    zoning_feats = point_query(ZONING, lon, lat, "ZONING_ZTYPE,ZONING_BASE")
    zoning = None
    zoning_base = None
    if zoning_feats:
        a = zoning_feats[0].get("attributes", {})
        zoning = a.get("ZONING_ZTYPE") or a.get("ZONING_BASE")
        zoning_base = a.get("ZONING_BASE")

    flood_feats = point_query(FLOOD, lon, lat, "FLOOD_ZONE")
    flood_zones = [
        f.get("attributes", {}).get("FLOOD_ZONE") for f in flood_feats if f.get("attributes")
    ]

    overlays = {}
    for key, (url, _) in OVERLAYS.items():
        overlays[key] = bool(point_query(url, lon, lat, "OBJECTID"))
        time.sleep(0.12)

    watershed = None
    try:
        ws = point_query(WATERSHED, lon, lat, "*")
        if ws:
            attrs = ws[0].get("attributes") or {}
            watershed = (
                attrs.get("WATERSHED_NAME")
                or attrs.get("NAME")
                or attrs.get("watershed")
                or next(
                    (v for k, v in attrs.items() if v and "name" in k.lower()),
                    None,
                )
            )
    except Exception:
        watershed = None

    jurisdiction = None
    try:
        jfeats = point_query(JURISDICTION, lon, lat, "*")
        if jfeats:
            attrs = jfeats[0].get("attributes") or {}
            jurisdiction = (
                attrs.get("JURISDICTION_NAME")
                or attrs.get("NAME")
                or attrs.get("CITY_NAME")
                or next(
                    (v for k, v in attrs.items() if v and "name" in k.lower()),
                    None,
                )
            )
    except Exception:
        jurisdiction = None

    parcel = parcel_by_point(lon, lat) or parcel_by_address(address)
    acres = None
    prop_id = None
    situs = None
    legal = None
    if parcel:
        attrs = parcel.get("attributes") or {}
        acres = (
            attrs.get("tcad_acres")
            or attrs.get("GIS_acres")
            or attrs.get("ACRES")
            or attrs.get("acres")
        )
        prop_id = attrs.get("PROP_ID") or attrs.get("PID_10") or attrs.get("prop_id")
        situs = attrs.get("SITUS") or attrs.get("situs")
        legal = attrs.get("legal_desc") or attrs.get("LEGAL_DESC")

    row = {
        "address": address,
        "lon": lon,
        "lat": lat,
        "zoning": zoning,
        "zoning_base": zoning_base,
        "flood_zones": flood_zones,
        "overlays": overlays,
        "watershed": watershed,
        "jurisdiction": jurisdiction,
        "acres": acres,
        "prop_id": prop_id,
        "situs": situs,
        "legal": legal,
        "manual_still_required": [
            "title / deed restrictions / HOA",
            "utility capacity",
            "tree survey",
            "civil drainage / pad feasibility",
            "HOME / Infill Plat eligibility with DSD",
        ],
    }
    verdict, notes = score(row)
    row["verdict"] = verdict
    row["notes"] = notes
    return row


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    arg = sys.argv[1]
    if Path(arg).exists():
        addresses = [ln.strip() for ln in Path(arg).read_text().splitlines() if ln.strip()]
    else:
        addresses = [" ".join(sys.argv[1:])]

    rows = []
    for addr in addresses:
        print(f"Screening: {addr} ...", flush=True)
        try:
            rows.append(screen_address(addr))
        except Exception as e:
            rows.append({"address": addr, "verdict": "ERROR", "notes": [str(e)]})
        time.sleep(0.2)

    out = Path(__file__).resolve().parent / "austin_lot_screen.csv"
    fieldnames = [
        "address",
        "verdict",
        "zoning",
        "zoning_base",
        "acres",
        "prop_id",
        "situs",
        "watershed",
        "jurisdiction",
        "lon",
        "lat",
        "flood_zones",
        "overlays",
        "notes",
    ]
    with out.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(
                {
                    **r,
                    "flood_zones": "; ".join(str(x) for x in (r.get("flood_zones") or [])),
                    "overlays": json.dumps(r.get("overlays") or {}),
                    "notes": " | ".join(r.get("notes") or []),
                }
            )

    print(json.dumps(rows, indent=2, default=str))
    print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
