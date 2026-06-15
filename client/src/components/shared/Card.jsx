export default function Card({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
      {title && <h3 className="text-lg font-semibold text-feather mb-4">{title}</h3>}
      {children}
    </div>
  );
}
