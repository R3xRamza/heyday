import Icon from '../shared/Icon';

export default function CreateContentFab({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Create Content"
      className="fixed bottom-8 right-8 w-14 h-14 bg-feather text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 hover:opacity-95 transition-all z-50 group"
    >
      <Icon name="add" className="!text-[28px]" />
      <span className="absolute right-16 bg-feather text-white px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md">
        Create Content
      </span>
    </button>
  );
}
