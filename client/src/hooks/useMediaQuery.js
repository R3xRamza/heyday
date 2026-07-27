import { useState, useEffect } from 'react';

/**
 * Subscribe to a CSS media query. `query` e.g. '(min-width: 768px)'.
 */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Tailwind `md` breakpoint (768px). */
export function useIsMdUp() {
  return useMediaQuery('(min-width: 768px)');
}
