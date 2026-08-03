#!/usr/bin/env python3
"""
Austin Urban Infill Lot Evaluation Scorecard (HEYDAY)

Screens an address against the 7 scorecard categories:
  1. Protected Trees
  2. Access and Utilities
  3. Floodplain, Watershed & Drainage
  4. Impervious Cover
  5. FAR limits & Setbacks
  6. Legal and Title
  7. Profit Margin

Usage:
  python austin_lot_scorecard.py "5104 Evergreen Ct, Austin, TX 78731"
  python austin_lot_scorecard.py lots.txt
  python austin_lot_scorecard.py "ADDRESS" --ask 850000 --build-cost 450000 --arv 1600000
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from pathlib import Path

import requests

SESSION = requests.Session()
SESSION.headers["User-Agent"] = "heyday-austin-lot-scorecard/1.0"

GEOCODE = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates"
PARCELS = (
    "https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/"
    "EXTERNAL_tcad_parcel/FeatureServer/0/query"
)

# City of Austin Shared MapServers
ZONING = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_1/MapServer/0/query"
FLOOD_COA = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Floodplain/MapServer/0/query"
FLOOD_FEMA = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Floodplain/MapServer/1/query"
WATERSHED_REG = (
    "https://maps.austintexas.gov/arcgis/rest/services/Shared/Environmental_3/MapServer/0/query"
)
WATERSHED_BOUND = (
    "https://maps.austintexas.gov/arcgis/rest/services/Shared/Environmental_3/MapServer/2/query"
)
CWQZ = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Environmental_3/MapServer/3/query"
EDWARDS_RECHARGE = (
    "https://maps.austintexas.gov/arcgis/rest/services/Shared/Environmental_3/MapServer/4/query"
)
EDWARDS_VERIFY = (
    "https://maps.austintexas.gov/arcgis/rest/services/Shared/Environmental_3/MapServer/5/query"
)
EDWARDS_CONTRIB = (
    "https://maps.austintexas.gov/arcgis/rest/services/Shared/Environmental_3/MapServer/6/query"
)
WUI = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_2/MapServer/31/query"
RDS = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_2/MapServer/22/query"  # Subchapter F
NCCD = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_2/MapServer/19/query"
BARTON = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_2/MapServer/2/query"
CAPITOL_VIEW = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_2/MapServer/4/query"
LOCAL_HIST = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_3/MapServer/1/query"
NR_HIST = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_3/MapServer/2/query"
JURISDICTION = (
    "https://maps.austintexas.gov/arcgis/rest/services/Shared/JurisdictionsFill/MapServer/0/query"
)
EASEMENTS = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Property/MapServer/4/query"
IMPERVIOUS = (
    "https://maps.austintexas.gov/arcgis/rest/services/Shared/ImperviousCover/MapServer/0/query"
)
TREE_PERMITS = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Permits/MapServer/8/query"
CEF_SETBACK = (
    "https://maps.austintexas.gov/arcgis/rest/services/Shared/Environmental_1/MapServer/7/query"
)

# Typical SF zoning defaults (LDC). Watershed overlays can be stricter.
ZONING_DEFAULTS = {
    "SF-1": {"ic_pct": 40, "building_pct": 35, "far": 0.4, "front": 25, "side": 5, "rear": 10},
    "SF-2": {"ic_pct": 45, "building_pct": 40, "far": 0.4, "front": 25, "side": 5, "rear": 10},
    "SF-3": {"ic_pct": 45, "building_pct": 40, "far": 0.4, "front": 25, "side": 5, "rear": 10},
    "SF-4A": {"ic_pct": 55, "building_pct": 45, "far": 0.4, "front": 15, "side": 5, "rear": 10},
    "SF-5": {"ic_pct": 55, "building_pct": 40, "far": 0.4, "front": 25, "side": 5, "rear": 10},
    "SF-6": {"ic_pct": 55, "building_pct": 40, "far": 0.4, "front": 25, "side": 5, "rear": 10},
}

# Watershed regulation area → typical max residential IC guidance (confirm on Property Profile)
# SF residential guidance (% of net site area for water-supply classes).
# Code requires the lower of zoning vs watershed IC.
WATERSHED_IC_GUIDANCE = {
    "URBAN": 45,
    "SUBURBAN": 45,
    "WATER SUPPLY SUBURBAN": 30,  # LDC 25-8-423 (up to 40% w/ intensity transfer)
    "WATER SUPPLY RURAL": 20,
    "BARTON SPRINGS ZONE": 15,
}


def get_json(url: str, params: dict) -> dict:
    r = SESSION.get(url, params=params, timeout=45)
    r.raise_for_status()
    return r.json()


def geocode(address: str) -> tuple[float, float] | None:
    data = get_json(
        GEOCODE,
        {"SingleLine": address, "f": "json", "maxLocations": 1, "outSR": 4326},
    )
    cands = data.get("candidates") or []
    if not cands:
        return None
    loc = cands[0]["location"]
    return loc["x"], loc["y"]


def point_features(url: str, lon: float, lat: float, out_fields: str = "*") -> list[dict]:
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


def poly_features(url: str, polygon: dict, out_fields: str = "*") -> list[dict]:
    data = get_json(
        url,
        {
            "geometry": json.dumps(polygon),
            "geometryType": "esriGeometryPolygon",
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


def nearby_count(url: str, lon: float, lat: float, feet: float = 250) -> int:
    geom = json.dumps({"x": lon, "y": lat, "spatialReference": {"wkid": 4326}})
    data = get_json(
        url,
        {
            "geometry": geom,
            "geometryType": "esriGeometryPoint",
            "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects",
            "distance": feet,
            "units": "esriSRUnit_Foot",
            "outFields": "OBJECTID",
            "returnGeometry": "false",
            "f": "json",
        },
    )
    if data.get("error"):
        return 0
    return len(data.get("features") or [])


def get_parcel(lon: float, lat: float) -> dict | None:
    geom = json.dumps({"x": lon, "y": lat, "spatialReference": {"wkid": 4326}})
    data = get_json(
        PARCELS,
        {
            "geometry": geom,
            "geometryType": "esriGeometryPoint",
            "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "*",
            "returnGeometry": "true",
            "outSR": 4326,
            "f": "json",
        },
    )
    feats = data.get("features") or []
    return feats[0] if feats else None


def first_attr(feats: list[dict], *keys: str):
    if not feats:
        return None
    attrs = feats[0].get("attributes") or {}
    for k in keys:
        if attrs.get(k) not in (None, ""):
            return attrs.get(k)
    return None


def zoning_rules(zoning: str | None) -> dict:
    if not zoning:
        return ZONING_DEFAULTS["SF-3"].copy()
    z = zoning.upper().split("-CO")[0].split(" ")[0]
    for key, rules in ZONING_DEFAULTS.items():
        if z.startswith(key) or key in z:
            return rules.copy()
    # fallback SF-3-ish
    return ZONING_DEFAULTS["SF-3"].copy()


def watershed_ic_cap(reg_type: str | None, zoning_ic: float) -> float:
    if not reg_type:
        return zoning_ic
    key = reg_type.upper().strip()
    # Longest / most specific name first so "WATER SUPPLY SUBURBAN" beats "SUBURBAN"
    for name, cap in sorted(WATERSHED_IC_GUIDANCE.items(), key=lambda x: -len(x[0])):
        if name in key:
            return min(zoning_ic, cap)
    return zoning_ic


def section_status(flags: list[str]) -> str:
    if any(f.startswith("KILL") for f in flags):
        return "KILL"
    if any(f.startswith("CAUTION") for f in flags) or any(f.startswith("MANUAL") for f in flags):
        return "CAUTION"
    if flags:
        return "PASS"
    return "PASS"


def screen_address(
    address: str,
    ask: float | None = None,
    build_cost: float | None = None,
    arv: float | None = None,
) -> dict:
    lonlat = geocode(address)
    if not lonlat:
        return {"address": address, "overall": "ERROR", "error": "geocode failed"}
    lon, lat = lonlat
    parcel = get_parcel(lon, lat)
    parcel_attrs = (parcel or {}).get("attributes") or {}
    parcel_geom = (parcel or {}).get("geometry")
    lot_sqft = parcel_attrs.get("Shape__Area")
    acres = (lot_sqft / 43560.0) if lot_sqft else None

    # --- Zoning / overlays ---
    zoning_feats = point_features(ZONING, lon, lat, "ZONING_ZTYPE,ZONING_BASE")
    zoning = first_attr(zoning_feats, "ZONING_ZTYPE", "ZONING_BASE")
    rules = zoning_rules(zoning)

    rds = point_features(RDS, lon, lat)
    subchapter_f = bool(rds)
    wui_feats = point_features(WUI, lon, lat)
    wui_zone = first_attr(wui_feats, "PROXIMITY_ZONE")
    overlays = {
        "barton_springs": bool(point_features(BARTON, lon, lat, "OBJECTID")),
        "capitol_view": bool(point_features(CAPITOL_VIEW, lon, lat, "OBJECTID")),
        "nccd": bool(point_features(NCCD, lon, lat, "OBJECTID")),
        "local_historic": bool(point_features(LOCAL_HIST, lon, lat, "OBJECTID")),
        "nr_historic": bool(point_features(NR_HIST, lon, lat, "OBJECTID")),
        "subchapter_f": subchapter_f,
        "wui": wui_zone or bool(wui_feats),
    }
    time.sleep(0.05)

    juris = first_attr(
        point_features(JURISDICTION, lon, lat),
        "JURISDICTION_LABEL",
        "CITY_NAME",
    )

    # --- Flood / watershed / drainage ---
    flood_coa = [
        f.get("attributes", {}).get("FLOOD_ZONE")
        for f in point_features(FLOOD_COA, lon, lat, "FLOOD_ZONE")
    ]
    flood_fema = [
        f.get("attributes", {}).get("FLOOD_ZONE")
        or f.get("attributes", {}).get("FLD_ZONE")
        for f in point_features(FLOOD_FEMA, lon, lat)
    ]
    ws_reg = first_attr(
        point_features(WATERSHED_REG, lon, lat),
        "WATERSHED_DEVELOPMENT_TYPE",
        "DESIRED_DEVELOPMENT_ZONE",
    )
    ws_desired = first_attr(
        point_features(WATERSHED_REG, lon, lat),
        "DESIRED_DEVELOPMENT_ZONE",
    )
    ws_name = first_attr(
        point_features(WATERSHED_BOUND, lon, lat),
        "WATERSHED_FULL_NAME",
        "WATERSHED_NAME",
    )
    cwqz = bool(point_features(CWQZ, lon, lat, "OBJECTID"))
    edwards = {
        "recharge": first_attr(point_features(EDWARDS_RECHARGE, lon, lat), "RECHARGE_ZONE")
        or bool(point_features(EDWARDS_RECHARGE, lon, lat, "OBJECTID")),
        "verification_buffer": bool(point_features(EDWARDS_VERIFY, lon, lat, "OBJECTID")),
        "contributing": bool(point_features(EDWARDS_CONTRIB, lon, lat, "OBJECTID")),
    }
    cef = bool(point_features(CEF_SETBACK, lon, lat, "OBJECTID"))

    # --- Easements / impervious on parcel ---
    easements = []
    ic_features = []
    if parcel_geom:
        for f in poly_features(EASEMENTS, parcel_geom):
            a = f.get("attributes") or {}
            easements.append(
                {
                    "type": a.get("EASEMENT_TYPE"),
                    "use": a.get("EASEMENT_USE"),
                    "status": a.get("EASEMENT_STATUS"),
                    "doc_id": a.get("DOCUMENT_ID"),
                    "case": a.get("CASE_NUMBER"),
                }
            )
        for f in poly_features(IMPERVIOUS, parcel_geom):
            a = f.get("attributes") or {}
            ic_features.append(
                {
                    "feature": a.get("FEATURE"),
                    "area_sqft": a.get("SHAPE.AREA") or a.get("Shape__Area"),
                }
            )

    existing_ic_sqft = sum(x["area_sqft"] or 0 for x in ic_features)
    existing_ic_pct = (existing_ic_sqft / lot_sqft * 100.0) if lot_sqft else None

    # Nearby drainage / tree permits (proxy signals)
    curb_inlets_250ft = nearby_count(
        "https://maps.austintexas.gov/arcgis/rest/services/Shared/DrainageInfrastructure/MapServer/0/query",
        lon,
        lat,
        250,
    )
    tree_permits_300ft = nearby_count(TREE_PERMITS, lon, lat, 300)

    zoning_ic = rules["ic_pct"]
    effective_ic = watershed_ic_cap(ws_reg, zoning_ic)
    max_ic_sqft = (effective_ic / 100.0) * lot_sqft if lot_sqft else None
    max_far_sqft = rules["far"] * lot_sqft if lot_sqft and rules.get("far") else None

    # ========== SCORECARD SECTIONS ==========
    sections: dict[str, dict] = {}

    # 1. Protected Trees
    tree_flags = [
        "MANUAL: City has no public private-lot tree inventory — need arborist survey "
        "(protected ≥19\" DBH; heritage ≥24\" certain species)",
    ]
    if tree_permits_300ft:
        tree_flags.append(
            f"INFO: {tree_permits_300ft} tree permit point(s) within ~300 ft (neighborhood activity)"
        )
    sections["1_protected_trees"] = {
        "status": section_status(tree_flags),
        "findings": {
            "nearby_tree_permits_300ft": tree_permits_300ft,
            "rules": "Protected ≥19in DBH; Heritage ≥24in (oaks, pecan, cedar elm, etc.)",
        },
        "flags": tree_flags,
    }

    # 2. Access and Utilities
    util_flags = []
    if not juris:
        util_flags.append("CAUTION: jurisdiction not found")
    elif "FULL PURPOSE" not in str(juris).upper() and "AUSTIN" not in str(juris).upper():
        util_flags.append(f"CAUTION: jurisdiction is {juris} (confirm COA utilities)")
    else:
        util_flags.append(f"PASS: jurisdiction {juris}")
    if easements:
        util_flags.append(
            f"CAUTION: {len(easements)} mapped easement(s) on parcel — verify buildable envelope"
        )
    else:
        util_flags.append("INFO: no mapped easement polygons on parcel (still confirm plat)")
    util_flags.append(
        "MANUAL: confirm water/wastewater taps + Austin Energy capacity with utility providers"
    )
    if curb_inlets_250ft == 0:
        util_flags.append("INFO: no curb inlets within ~250 ft (not a utility kill)")
    sections["2_access_and_utilities"] = {
        "status": section_status(util_flags),
        "findings": {
            "jurisdiction": juris,
            "easements": easements,
            "curb_inlets_within_250ft": curb_inlets_250ft,
            "prop_id": parcel_attrs.get("PROP_ID"),
            "pid_10": parcel_attrs.get("PID_10"),
            "lot": parcel_attrs.get("LOTS"),
        },
        "flags": util_flags,
    }

    # 3. Floodplain, Watershed & Drainage
    flood_flags = []
    for z in flood_coa:
        zl = (z or "").lower()
        if "25" in zl:
            flood_flags.append(f"KILL: COA 25-year floodplain ({z})")
        elif z:
            flood_flags.append(f"CAUTION: COA floodplain ({z})")
    for z in flood_fema:
        if z:
            flood_flags.append(f"CAUTION: FEMA flood zone ({z})")
    if not flood_coa and not any(flood_fema):
        flood_flags.append("PASS: no floodplain at parcel centroid (confirm FloodPro polygon)")
    if ws_reg:
        flood_flags.append(f"INFO: watershed regulation = {ws_reg}")
    if ws_name:
        flood_flags.append(f"INFO: watershed = {ws_name}")
    if cwqz:
        flood_flags.append("CAUTION: Critical Water Quality Zone / waterway setback")
    if edwards.get("recharge"):
        flood_flags.append(
            f"CAUTION: Edwards Aquifer Recharge Zone ({edwards['recharge']}) — water quality review"
        )
    if edwards.get("contributing"):
        flood_flags.append("CAUTION: Edwards Aquifer Contributing Zone")
    if cef:
        flood_flags.append("CAUTION: Critical Environmental Feature setback")
    if overlays.get("wui"):
        flood_flags.append(f"CAUTION: Wildland-Urban Interface ({overlays['wui']})")
    sections["3_floodplain_watershed_drainage"] = {
        "status": section_status(flood_flags),
        "findings": {
            "flood_coa": flood_coa,
            "flood_fema": flood_fema,
            "watershed_regulation": ws_reg,
            "desired_development_zone": ws_desired,
            "watershed_name": ws_name,
            "cwqz": cwqz,
            "edwards": edwards,
            "cef_setback": cef,
            "wui": overlays.get("wui"),
        },
        "flags": flood_flags,
    }

    # 4. Impervious Cover
    ic_flags = []
    ic_flags.append(
        f"INFO: zoning base IC cap ~{zoning_ic}% ({zoning or 'unknown'}); "
        f"effective guidance after watershed ~{effective_ic}%"
    )
    if lot_sqft and max_ic_sqft is not None:
        ic_flags.append(
            f"INFO: lot ~{lot_sqft:,.0f} sqft → max IC ~{max_ic_sqft:,.0f} sqft at {effective_ic}%"
        )
    if existing_ic_pct is not None:
        ic_flags.append(
            f"INFO: existing mapped IC ~{existing_ic_sqft:,.0f} sqft ({existing_ic_pct:.1f}%)"
        )
        if existing_ic_pct > effective_ic:
            ic_flags.append(
                "CAUTION: existing IC appears above effective cap — rebuild may need IC reduction"
            )
    if overlays.get("barton_springs"):
        ic_flags.append("KILL/CAUTION: Barton Springs overlay — expect much lower IC")
    ic_flags.append("MANUAL: engineer must calculate net site area / proposed IC for permit")
    sections["4_impervious_cover"] = {
        "status": section_status(ic_flags),
        "findings": {
            "zoning_ic_pct": zoning_ic,
            "effective_ic_pct": effective_ic,
            "lot_sqft": lot_sqft,
            "max_ic_sqft": max_ic_sqft,
            "existing_ic_sqft": existing_ic_sqft,
            "existing_ic_pct": existing_ic_pct,
            "existing_features": ic_features,
        },
        "flags": ic_flags,
    }

    # 5. FAR limits & Setbacks
    far_flags = []
    far_flags.append(
        f"INFO: typical {zoning or 'SF'} setbacks F{rules['front']} / S{rules['side']} / R{rules['rear']}"
    )
    far_flags.append(
        f"INFO: building coverage ~{rules['building_pct']}%; FAR guidance ~{rules['far']}:1"
    )
    if max_far_sqft:
        far_flags.append(f"INFO: FAR envelope ~{max_far_sqft:,.0f} sqft GFA at {rules['far']}:1")
    if subchapter_f:
        far_flags.append(
            "CAUTION: Subchapter F (Residential Design Standards / McMansion) applies — "
            "confirm FAR, height, setback plane"
        )
    for name in ("nccd", "local_historic", "nr_historic", "capitol_view"):
        if overlays.get(name):
            far_flags.append(f"CAUTION: overlay {name} may further limit bulk/design")
    far_flags.append("MANUAL: confirm exact standards on Property Profile + LDC for this parcel")
    sections["5_far_limits_and_setbacks"] = {
        "status": section_status(far_flags),
        "findings": {
            "zoning": zoning,
            "setbacks_ft": {
                "front": rules["front"],
                "side": rules["side"],
                "rear": rules["rear"],
            },
            "building_coverage_pct": rules["building_pct"],
            "far": rules["far"],
            "max_far_sqft": max_far_sqft,
            "subchapter_f": subchapter_f,
            "overlays": overlays,
        },
        "flags": far_flags,
    }

    # 6. Legal and Title
    legal_flags = [
        "MANUAL: order title commitment (liens, deed restrictions, HOA covenants)",
        "MANUAL: pull recorded plat + survey (easements beyond city GIS layer)",
    ]
    if easements:
        for e in easements:
            legal_flags.append(
                f"CAUTION: GIS easement — {e.get('use') or e.get('type')} "
                f"(status {e.get('status')}, doc {e.get('doc_id')})"
            )
    if overlays.get("local_historic") or overlays.get("nr_historic") or overlays.get("nccd"):
        legal_flags.append("CAUTION: historic/conservation overlay — design review risk")
    sections["6_legal_and_title"] = {
        "status": section_status(legal_flags),
        "findings": {
            "prop_id": parcel_attrs.get("PROP_ID"),
            "pid_10": parcel_attrs.get("PID_10"),
            "easements_gis": easements,
            "tcad_url": (
                f"https://traviscad.org/property-search/?prop_id={parcel_attrs.get('PROP_ID')}"
                if parcel_attrs.get("PROP_ID")
                else None
            ),
        },
        "flags": legal_flags,
    }

    # 7. Profit Margin
    profit_flags = []
    profit = None
    margin_pct = None
    if ask is not None and build_cost is not None and arv is not None:
        profit = arv - ask - build_cost
        basis = ask + build_cost
        margin_pct = (profit / basis * 100.0) if basis else None
        profit_flags.append(
            f"INFO: ARV {arv:,.0f} − ask {ask:,.0f} − build {build_cost:,.0f} = "
            f"profit {profit:,.0f} ({margin_pct:.1f}% on cost)"
            if margin_pct is not None
            else f"INFO: profit {profit:,.0f}"
        )
        if margin_pct is not None and margin_pct < 15:
            profit_flags.append("CAUTION: modeled margin under 15% — stress-test costs/timeline")
        elif margin_pct is not None:
            profit_flags.append("PASS: modeled margin ≥15% (before soft costs/fees — refine)")
    else:
        profit_flags.append(
            "MANUAL: provide --ask --build-cost --arv to compute margin "
            "(formula: profit = ARV − land − build; margin = profit / (land+build))"
        )
    sections["7_profit_margin"] = {
        "status": section_status(profit_flags),
        "findings": {
            "ask": ask,
            "build_cost": build_cost,
            "arv": arv,
            "profit": profit,
            "margin_pct_on_cost": margin_pct,
            "formula": "profit = ARV - ask - build_cost; margin% = profit / (ask + build_cost)",
            "not_included": [
                "impact/parkland fees",
                "soft costs",
                "carry/interest",
                "tree mitigation",
                "WUI upgrades",
            ],
        },
        "flags": profit_flags,
    }

    statuses = [s["status"] for s in sections.values()]
    if "KILL" in statuses:
        overall = "KILL"
    elif "CAUTION" in statuses or "ERROR" in statuses:
        overall = "CAUTION"
    else:
        overall = "PASS"

    return {
        "address": address,
        "lon": lon,
        "lat": lat,
        "zoning": zoning,
        "lot_sqft": lot_sqft,
        "acres": acres,
        "prop_id": parcel_attrs.get("PROP_ID"),
        "pid_10": parcel_attrs.get("PID_10"),
        "overall": overall,
        "sections": sections,
        "property_profile": "https://www.austintexas.gov/development-services/property-profile-overview",
    }


def print_report(row: dict) -> None:
    if row.get("error"):
        print(f"ERROR {row.get('address')}: {row['error']}")
        return
    print("=" * 72)
    print(f"HEYDAY · Austin Urban Infill Lot Evaluation Scorecard")
    print(f"Address: {row['address']}")
    lot = f"{row['lot_sqft']:,.0f} sqft" if row.get("lot_sqft") else "n/a"
    ac = f"{row['acres']:.3f} ac" if row.get("acres") else "n/a"
    print(
        f"Overall: {row['overall']}  |  Zoning: {row.get('zoning')}  |  "
        f"Lot: {lot} ({ac})"
    )
    print(f"PROP_ID: {row.get('prop_id')}  PID: {row.get('pid_10')}")
    print("-" * 72)
    titles = {
        "1_protected_trees": "1. Protected Trees",
        "2_access_and_utilities": "2. Access and Utilities",
        "3_floodplain_watershed_drainage": "3. Floodplain, Watershed & Drainage",
        "4_impervious_cover": "4. Impervious Cover",
        "5_far_limits_and_setbacks": "5. FAR limits & Setbacks",
        "6_legal_and_title": "6. Legal and Title",
        "7_profit_margin": "7. Profit Margin",
    }
    for key, title in titles.items():
        sec = row["sections"][key]
        print(f"\n{title}  [{sec['status']}]")
        for flag in sec["flags"]:
            print(f"  • {flag}")
    print("\n" + "=" * 72)


def main():
    parser = argparse.ArgumentParser(description="HEYDAY Austin infill lot scorecard")
    parser.add_argument("target", help="Address or path to file with addresses")
    parser.add_argument("--ask", type=float, default=None, help="Land ask / purchase price")
    parser.add_argument("--build-cost", type=float, default=None, help="Estimated build cost")
    parser.add_argument("--arv", type=float, default=None, help="After-repair / sellout value")
    args = parser.parse_args()

    if Path(args.target).exists():
        addresses = [
            ln.strip() for ln in Path(args.target).read_text().splitlines() if ln.strip()
        ]
    else:
        addresses = [args.target]

    rows = []
    for addr in addresses:
        print(f"Screening: {addr} ...", flush=True)
        try:
            row = screen_address(addr, ask=args.ask, build_cost=args.build_cost, arv=args.arv)
        except Exception as e:
            row = {"address": addr, "overall": "ERROR", "error": str(e)}
        rows.append(row)
        print_report(row)
        time.sleep(0.2)

    out_json = Path(__file__).resolve().parent / "austin_lot_scorecard.json"
    out_csv = Path(__file__).resolve().parent / "austin_lot_scorecard.csv"
    out_json.write_text(json.dumps(rows, indent=2, default=str))

    with out_csv.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "address",
                "overall",
                "zoning",
                "lot_sqft",
                "section",
                "status",
                "flags",
            ]
        )
        for row in rows:
            if "sections" not in row:
                w.writerow([row.get("address"), row.get("overall"), "", "", "", "", row.get("error")])
                continue
            for key, sec in row["sections"].items():
                w.writerow(
                    [
                        row["address"],
                        row["overall"],
                        row.get("zoning"),
                        row.get("lot_sqft"),
                        key,
                        sec["status"],
                        " | ".join(sec["flags"]),
                    ]
                )

    print(f"Wrote {out_json}")
    print(f"Wrote {out_csv}")


if __name__ == "__main__":
    main()
