/** Chrome ignores autocomplete="off" on address-shaped forms; one-time-code is a reliable workaround. */
export const CHROME_AUTOCOMPLETE = 'one-time-code';

export function blurActiveElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

/** Hidden decoy field — Chrome may attach save-address heuristics here instead of real inputs. */
export function ChromeAddressDecoy() {
  return (
    <input
      type="text"
      name="address"
      autoComplete="street-address"
      tabIndex={-1}
      aria-hidden="true"
      className="absolute opacity-0 pointer-events-none h-0 w-0 overflow-hidden"
      readOnly
    />
  );
}
