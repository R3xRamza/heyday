import Sidebar from './Sidebar';
import TopNav from './TopNav';
import { useSidebar } from '../context/SidebarContext';

export default function DashboardLayout({
  title,
  subtitle,
  titleAddon,
  children,
  className = '',
  headerRight,
  fillViewport,
}) {
  const { sidebarWidth } = useSidebar();

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <div
        className={`flex flex-col transition-[margin] duration-200 ease-in-out ${
          fillViewport ? 'h-screen overflow-hidden' : 'min-h-screen'
        }`}
        style={{ marginLeft: sidebarWidth }}
      >
        <TopNav title={title} subtitle={subtitle} headerRight={headerRight} titleAddon={titleAddon} />
        <main
          className={`flex-1 min-h-0 custom-scrollbar flex flex-col ${
            fillViewport ? 'overflow-hidden' : 'overflow-y-auto'
          } ${className}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
