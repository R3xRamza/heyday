import { formatPriceInput, parsePriceInput } from '../../utils/format';

export default function PriceInput({ value, onChange, className = '', placeholder, required }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      required={required}
      value={formatPriceInput(value)}
      placeholder={placeholder}
      onChange={(e) => onChange(parsePriceInput(e.target.value))}
      className={className}
    />
  );
}
