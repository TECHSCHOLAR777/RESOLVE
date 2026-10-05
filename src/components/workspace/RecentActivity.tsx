import { ArrowRight, Download } from 'lucide-react';
import type { RecentItem } from '../run/RunContext';

interface Props {
  items: RecentItem[];
  onSelect: (item: RecentItem) => void;
  onViewAll: () => void;
}

export default function RecentActivity({ items, onSelect, onViewAll }: Props) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Recent Activity</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-accent-text transition-colors hover:text-accent-text-hover"
        >
          <span>View All</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            className="group flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-line bg-card shadow-2xs transition-all hover:shadow-md dark:shadow-none dark:hover:border-line-strong dark:hover:shadow-none"
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-sunken">
              <img src={item.imgUrl} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <div className="absolute right-2 top-2 rounded border border-amber-200/60 bg-amber-50/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 shadow-2xs backdrop-blur-xs dark:border-amber-300/20 dark:bg-amber-400/15 dark:text-amber-200 dark:shadow-none">
                {item.badge}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-ink transition-colors group-hover:text-accent-text">{item.title}</div>
                <div className="mt-0.5 text-[11px] text-faint">{item.timeAgo}</div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const a = document.createElement('a');
                  a.href = item.imgUrl;
                  a.download = `${item.id}_enhanced.png`;
                  a.click();
                }}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-faint transition-colors hover:bg-accent-soft hover:text-accent-text"
                title="Download image"
                aria-label="Download image"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
