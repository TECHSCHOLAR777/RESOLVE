import { Home, FolderKanban, HelpCircle, Settings, Satellite } from 'lucide-react';

export type NavKey = 'enhance' | 'results' | 'help' | 'settings';

const ITEMS: { key: NavKey; label: string; icon: typeof Home }[] = [
  { key: 'enhance', label: 'Enhance', icon: Home },
  { key: 'results', label: 'My Results', icon: FolderKanban },
  { key: 'help', label: 'Help & Support', icon: HelpCircle },
  { key: 'settings', label: 'Settings', icon: Settings },
];

interface NavSidebarProps {
  active: NavKey;
  onSelect: (key: NavKey) => void;
  className?: string;
}

/** Dark Earth navigation rail. Used as the fixed sidebar on desktop and inside the drawer on small screens. */
export default function NavSidebar({ active: activeNav, onSelect, className = 'w-56 2xl:w-64' }: NavSidebarProps) {
  const setActiveNav = onSelect;
  return (
      <aside className={`relative shrink-0 z-20 flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#060D1E] via-[#09152F] to-[#030712] text-white border-r border-slate-800/80 shadow-[4px_0_24px_rgba(0,0,0,0.15)] dark:shadow-none dark:border-slate-800 ${className}`}>
        {/* Seamless Earth Background Atmosphere & Curved Horizon */}
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
          {/* Earth image blended seamlessly into the sidebar */}
          <img
            src="/assets/earth_bottom_left.jpg"
            alt=""
            className="absolute -bottom-10 -left-12 w-[340px] h-[340px] object-cover opacity-60 mix-blend-screen pointer-events-none"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/earth_sidebar.jpg';
            }}
          />
          {/* Ambient radial atmospheric glows */}
          <div className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-16 -right-16 w-52 h-52 rounded-full bg-cyan-400/15 blur-2xl pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#060D1E]/80 via-transparent to-[#030712]/90 pointer-events-none" />
        </div>

        {/* Top: Logo & Main Navigation */}
        <div className="p-5 flex flex-col relative z-10">
          {/* RESOLVE Brand Logo with Orbital Ring */}
          <div className="flex items-center gap-3 mb-8 cursor-pointer select-none">
            <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 shadow-lg border border-cyan-400/30 flex items-center justify-center bg-[#0B1528] ring-2 ring-blue-500/20">
              <img
                src="/assets/logo_earth.png"
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Satellite className="w-4 h-4 text-white drop-shadow" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[17px] font-black tracking-tight text-white leading-tight flex items-center gap-1 drop-shadow-sm">
                RESOLVE
              </span>
              <span className="text-[10px] text-blue-200/70 font-medium leading-tight">
                Satellite Super-Resolution
              </span>
            </div>
          </div>

          {/* Navigation Links with Glassmorphism */}
          <nav aria-label="Primary" className="space-y-1.5">
            {ITEMS.map((item, i) => {
              const on = activeNav === item.key;
              return (
                <div key={item.key}>
                  {i === 2 && <div className="mb-4 mt-4 h-px bg-white/10" />}
                  <button
                    type="button"
                    onClick={() => setActiveNav(item.key)}
                    aria-current={on ? 'page' : undefined}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                      on ? 'border border-blue-400/40 bg-blue-600/30 text-white shadow-sm backdrop-blur-md' : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <item.icon className={`h-4 w-4 ${on ? 'text-cyan-400' : 'text-slate-400'}`} aria-hidden />
                    <span>{item.label}</span>
                  </button>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Seamless Lower Earth Caption Integration (without isolated card box) */}
        <div className="p-5 relative z-10 select-none">
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-cyan-300 tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Earth observation</span>
          </div>
          <p className="text-[11px] text-slate-300/80 leading-relaxed font-normal">
            Sentinel-2 super-resolution from 10 m to 2.5 m, with a per-pixel trust layer.
          </p>
        </div>
      </aside>
  );
}
