import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Star, Database, FileText, Bug, RefreshCw } from 'lucide-react';
import { useChangelog } from '../hooks/useChangelog';
import type { ChangelogEntry } from '../data/changelog';

const typeConfig: Record<ChangelogEntry['type'], { label: string; icon: typeof Star; color: string; bg: string }> = {
  feature: { label: 'פיצ׳ר', icon: Star, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  data:    { label: 'נתונים', icon: Database, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  docs:    { label: 'מסמך', icon: FileText, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  fix:     { label: 'תיקון', icon: Bug, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40' },
  update:  { label: 'עדכון', icon: RefreshCw, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/40' },
};

const hebrewMonths: Record<number, string> = {
  0: 'ינואר', 1: 'פברואר', 2: 'מרץ', 3: 'אפריל', 4: 'מאי', 5: 'יוני',
  6: 'יולי', 7: 'אוגוסט', 8: 'ספטמבר', 9: 'אוקטובר', 10: 'נובמבר', 11: 'דצמבר',
};

function formatHebrewDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${hebrewMonths[d.getMonth()]} ${d.getFullYear()}`;
}

function groupByDate(entries: ChangelogEntry[]) {
  const groups: { date: string; label: string; entries: ChangelogEntry[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.date === entry.date) {
      last.entries.push(entry);
    } else {
      groups.push({ date: entry.date, label: formatHebrewDate(entry.date), entries: [entry] });
    }
  }
  return groups;
}

export default function WhatsNewDropdown() {
  const { changelog, unseenCount, hasUnseen, isNew, markAllSeen } = useChangelog();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupByDate(changelog), [changelog]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(ev: MouseEvent) {
      const el = wrapRef.current;
      if (!el || el.contains(ev.target as Node)) return;
      setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    const pad = 8;
    requestAnimationFrame(() => {
      const r = panel.getBoundingClientRect();

      let dy = 0;
      if (r.bottom > window.innerHeight - pad) dy = window.innerHeight - pad - r.bottom;
      if (r.top + dy < pad) dy = pad - r.top;

      let dx = 0;
      if (r.right > window.innerWidth - pad) dx = window.innerWidth - pad - r.right;
      if (r.left + dx < pad) dx = pad - r.left;

      panel.style.transform = (dx !== 0 || dy !== 0) ? `translate(${dx}px,${dy}px)` : '';

      const r2 = panel.getBoundingClientRect();
      const maxH = Math.max(120, Math.min(480, window.innerHeight - pad * 2, window.innerHeight - r2.top - pad));
      panel.style.maxHeight = `${maxH}px`;
    });
  }, [open]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) markAllSeen();
      return next;
    });
  }, [markAllSeen]);

  return (
    <div ref={wrapRef} className="relative overflow-visible">
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400"
        title="מה חדש"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Sparkles size={18} />
        {hasUnseen && (
          <span className="absolute top-0.5 end-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold animate-pulse">
            {unseenCount > 99 ? '99+' : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="מה חדש"
          className="absolute top-full mt-1 left-0 z-50 flex min-h-0 w-[min(380px,calc(100vw-1rem))] flex-col rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-xl"
          style={{ maxHeight: 'min(480px, calc(100dvh - 4rem))' }}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-surface-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-surface-700 dark:bg-surface-900/95">
            <Sparkles size={14} className="text-primary-500 shrink-0" />
            <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">מה חדש</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {changelog.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-surface-400 dark:text-surface-500 text-sm">
                אין עדכונים
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-inline-start-[19px] top-2 bottom-2 w-px bg-surface-200 dark:bg-surface-700" />

                <div className="space-y-6">
                  {groups.map((group) => (
                    <div key={group.date}>
                      <div className="relative flex items-center gap-3 mb-2">
                        <div className="w-[39px] flex justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-surface-300 dark:bg-surface-600 ring-4 ring-white dark:ring-surface-900" />
                        </div>
                        <span className="text-xs font-semibold text-surface-500 dark:text-surface-400">
                          {group.label}
                        </span>
                      </div>

                      <div className="space-y-2 ps-[39px]">
                        {group.entries.map((entry) => {
                          const unseen = isNew(entry.id);
                          const cfg = typeConfig[entry.type];
                          const Icon = cfg.icon;

                          return (
                            <div
                              key={entry.id}
                              className={`
                                relative rounded-xl border p-3 transition-all
                                ${unseen
                                  ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/20 shadow-sm'
                                  : 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900'
                                }
                              `}
                            >
                              <div className="flex items-start gap-2">
                                <div className={`mt-0.5 flex-shrink-0 rounded-lg p-1 ${cfg.bg}`}>
                                  <Icon size={14} className={cfg.color} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200 leading-snug">
                                    {entry.message}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                                    {cfg.label}
                                  </span>
                                  {unseen && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                                      חדש
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
