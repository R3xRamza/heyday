import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useIsMdUp } from '../hooks/useMediaQuery';

export const SIDEBAR_WIDTH_EXPANDED = 260;
export const SIDEBAR_WIDTH_COLLAPSED = 72;
const STORAGE_KEY = 'sidebar-collapsed-v1';

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const isMdUp = useIsMdUp();
  const isMobileNav = !isMdUp;

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => !value);
  }, []);

  const sidebarWidth = useMemo(() => {
    if (isMobileNav) return 0;
    return collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
  }, [isMobileNav, collapsed]);

  const value = useMemo(
    () => ({
      collapsed,
      toggleCollapsed,
      sidebarWidth,
      isMobileNav,
      isMdUp,
    }),
    [collapsed, toggleCollapsed, sidebarWidth, isMobileNav, isMdUp],
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}
