import Sidebar from './Sidebar';
import TopNav from './TopNav';

export default function DashboardLayout({
  title,
  subtitle,
  children,
  className = '',
  headerRight,
  fillViewport,
}) {
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <div
        className={`ml-[260px] flex flex-col ${
          fillViewport ? 'h-screen overflow-hidden' : 'min-h-screen'
        }`}
      >
        <TopNav title={title} subtitle={subtitle} headerRight={headerRight} />
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
