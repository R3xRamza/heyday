import Icon from '../shared/Icon';
import { MOBILE_BOTTOM_NAV_HEIGHT_PX } from '../../constants/nav';
import { useIsMdUp } from '../../hooks/useMediaQuery';

export default function CreateContentFab({ onClick }) {
  const isMdUp = useIsMdUp();
  const bottom = isMdUp
    ? undefined
    : `calc(${MOBILE_BOTTOM_NAV_HEIGHT_PX}px + 1rem + env(safe-area-inset-bottom, 0px))`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Create Content"
      className={`fixed right-4 md:right-8 w-12 h-12 md:w-14 md:h-14 bg-feather text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 hover:opacity-95 transition-all z-40 group ${
        isMdUp ? 'bottom-8' : ''
      }`}
      style={bottom ? { bottom } : undefined}
    >
      <Icon name="add" className="!text-[24px] md:!text-[28px]" />
      <span className="absolute right-14 md:right-16 bg-feather text-white px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md hidden md:block">
        Create Content
      </span>
    </button>
  );
}
