import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CHROME_AUTOCOMPLETE } from './chromeFormGuards';

function newSessionToken() {
  return crypto.randomUUID();
}

export default function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  className = '',
  placeholder = 'Start typing an address…',
  required,
  id: idProp,
}) {
  const autoId = useId();
  const inputId = idProp || autoId;
  const listId = `${inputId}-suggestions`;

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const sessionRef = useRef(newSessionToken());

  const [lookupEnabled, setLookupEnabled] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/address/status', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled) setLookupEnabled(Boolean(json?.configured));
      })
      .catch(() => {
        if (!cancelled) setLookupEnabled(false);
      });
    return () => { cancelled = true; };
  }, []);

  const closeList = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
    setSuggestions([]);
  }, []);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        closeList();
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [closeList]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const fetchSuggestions = useCallback(async (query) => {
    if (!lookupEnabled || query.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        session: sessionRef.current,
      });
      const res = await fetch(`/api/address/autocomplete?${params}`, { credentials: 'include' });
      if (res.status === 503) {
        setLookupEnabled(false);
        setSuggestions([]);
        setOpen(false);
        return;
      }
      if (!res.ok) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      const json = await res.json();
      const next = json.suggestions || [];
      setSuggestions(next);
      setOpen(next.length > 0);
      setActiveIndex(next.length > 0 ? 0 : -1);
    } catch {
      setSuggestions([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [lookupEnabled]);

  const handleInputChange = (e) => {
    const next = e.target.value;
    onChange(next);
    if (!lookupEnabled) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(next);
    }, 300);
  };

  const handleFocus = () => {
    sessionRef.current = newSessionToken();
    if (lookupEnabled && suggestions.length > 0) {
      setOpen(true);
    }
  };

  const selectSuggestion = async (suggestion) => {
    if (!suggestion || selecting) return;
    setSelecting(true);
    closeList();

    try {
      const params = new URLSearchParams({ session: sessionRef.current });
      const res = await fetch(
        `/api/address/place/${encodeURIComponent(suggestion.placeId)}?${params}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const fields = await res.json();
        const parsed = {
          address: fields.address || '',
          city: fields.city || '',
          state: fields.state || '',
          zip: fields.zip || '',
        };
        onChange(parsed.address);
        onAddressSelect(parsed);
      }
    } catch {
      // User can still edit fields manually.
    } finally {
      sessionRef.current = newSessionToken();
      setSelecting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      closeList();
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        required={required}
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        className={className}
        placeholder={placeholder}
        autoComplete={CHROME_AUTOCOMPLETE}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
      />
      {lookupEnabled && open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-outline-variant/30 rounded-lg shadow-executive py-1"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`px-3 py-2 text-sm cursor-pointer ${
                i === activeIndex ? 'bg-secondary/10 text-primary' : 'text-on-surface hover:bg-surface-container-low'
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSuggestion(s)}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {lookupEnabled && loading && (
        <p className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-on-surface-variant pointer-events-none">
          …
        </p>
      )}
    </div>
  );
}
