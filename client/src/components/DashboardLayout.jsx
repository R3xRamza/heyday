import Sidebar from './Sidebar';
import TopNav from './TopNav';
import MobileBottomNav from './MobileBottomNav';
import { useSidebar } from '../context/SidebarContext';
import { MOBILE_BOTTOM_NAV_HEIGHT_PX } from '../constants/nav';

export default function DashboardLayout({
  title,
  subtitle,
  titleAddon,
  children,
  className = '',
  headerRight,
  fillViewport,
}) {
  const { sidebarWidth, isMobileNav } = useSidebar();

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      <Sidebar />
      <div
        className={`flex flex-col transition-[margin] duration-200 ease-in-out min-w-0 ${
          fillViewport ? 'h-screen overflow-hidden' : 'min-h-screen'
        }`}
        style={{
          marginLeft: sidebarWidth,
          paddingBottom: isMobileNav
            ? `calc(${MOBILE_BOTTOM_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom, 0px))`
            : undefined,
        }}
      >
        <TopNav title={title} subtitle={subtitle} headerRight={headerRight} titleAddon={titleAddon} />
        <main
          className={`flex-1 min-h-0 min-w-0 custom-scrollbar flex flex-col ${
            fillViewport ? 'overflow-hidden' : 'overflow-y-auto'
          } ${className}`}
        >
          {children}
        </main>
      </div>
      {isMobileNav && <MobileBottomNav />}
    </div>
  );
}
