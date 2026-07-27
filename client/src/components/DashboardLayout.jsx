import { useEffect } from 'react';
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

  // Prevent document/body scroll fighting the inner pane (esp. transaction workspace on phone).
  useEffect(() => {
    if (!fillViewport) return undefined;
    const html = document.documentElement;
    const { body } = document;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [fillViewport]);

  const bottomPad = isMobileNav
    ? `calc(${MOBILE_BOTTOM_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom, 0px))`
    : undefined;

  return (
    <div
      className={`bg-surface overflow-x-hidden ${
        fillViewport ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-screen'
      }`}
    >
      <Sidebar />
      <div
        className={`flex flex-col transition-[margin] duration-200 ease-in-out min-w-0 ${
          fillViewport ? 'h-full max-h-full overflow-hidden' : 'min-h-screen'
        }`}
        style={{
          marginLeft: sidebarWidth,
          paddingBottom: bottomPad,
        }}
      >
        <TopNav
          title={title}
          subtitle={subtitle}
          headerRight={headerRight}
          titleAddon={titleAddon}
          pinned={Boolean(fillViewport)}
        />
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
