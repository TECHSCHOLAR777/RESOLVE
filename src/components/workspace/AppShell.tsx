import { Suspense, useCallback, useState } from 'react';
import { HelpCircle, Menu } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../../theme';
import Drawer from './Drawer';
import NavSidebar, { type NavKey } from './NavSidebar';
import { useLayout } from './useBreakpoint';

const PATHS: Record<NavKey, string> = { enhance: '/', results: '/results', help: '/help', settings: '/settings' };

function activeKey(pathname: string): NavKey {
  if (pathname.startsWith('/results')) return 'results';
  if (pathname.startsWith('/help')) return 'help';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'enhance';
}

/** Navigation rail (or drawer on phones), top bar and the routed page. */
export default function AppShell() {
  const layout = useLayout();
  const mobile = layout === 'mobile';
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const active = activeKey(pathname);
  const go = (key: NavKey) => navigate(PATHS[key]);

  return (
    <div className="flex h-dvh w-full select-none overflow-hidden bg-page font-sans text-body antialiased">
      {!mobile && <NavSidebar active={active} onSelect={go} />}

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {mobile ? (
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-line bg-card/95 px-4 backdrop-blur">
            <div className="flex items-center gap-2.5">
              <img src="/assets/logo_earth.png" alt="" className="h-8 w-8 rounded-full border border-cyan-400/30 object-cover ring-2 ring-blue-500/20" />
              <span className="text-[15px] font-black tracking-tight text-ink">RESOLVE</span>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                aria-label="Open navigation"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-line text-body transition-colors hover:bg-sunken hover:text-ink"
              >
                <Menu className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </header>
        ) : (
          <header className="flex h-14 shrink-0 items-center justify-end gap-3 px-6 xl:px-8">
            <button
              type="button"
              onClick={() => go('help')}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-transparent text-body transition-all hover:border-line hover:bg-card hover:text-ink"
              title="Help"
              aria-label="Help"
            >
              <HelpCircle className="h-5 w-5 text-muted" aria-hidden />
            </button>
            <ThemeToggle />
          </header>
        )}

        <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </div>

      <Drawer open={navOpen && mobile} onClose={closeNav} side="left" title="Navigation" bare widthClass="w-72">
        <NavSidebar
          active={active}
          onSelect={(k) => {
            go(k);
            closeNav();
          }}
          className="h-full min-h-[480px] w-full"
        />
      </Drawer>
    </div>
  );
}
