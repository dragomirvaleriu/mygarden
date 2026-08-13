import React, { useEffect, useState } from 'react';

/**
 * Sticky mobile app bar — the replacement for the decorative page heroes.
 *
 * Measured problem it solves: every page opened with a 190–285px hero that
 * only repeated the page name the user had just tapped in the dock, pushing
 * real content to ~700px on a 812px screen (Academy 91% of the first screen
 * wasted, Calendar 87%, Encyclopedia 86%, Dashboard 83%).
 *
 * Design per spec:
 *  - 52px tall, shrinking to 44px once scrolled (title steps down with it)
 *  - drawn like the existing header: a discreet accent-tinted background
 *  - rounded on the BOTTOM edge only, so it reads as a panel the content
 *    slides under rather than a floating pill
 *  - minimum dead space: no vertical padding beyond what the 52px needs
 *
 * Mobile-only by default (`md:hidden`); desktop keeps the sidebar + its own
 * page headers untouched.
 */

const cn = (...p: Array<string | false | null | undefined>) => p.filter(Boolean).join(' ');

type Icon = React.ComponentType<{ size?: number; className?: string }>;

export interface AppBarAction {
  icon: Icon;
  label: string;
  onClick: () => void;
  /** Small count shown on the icon, e.g. active filter count. */
  badge?: number;
  /** Renders in the accent color to mark it as the primary action. */
  primary?: boolean;
}

export const AppBar: React.FC<{
  title: string;
  /** Optional second line — kept to one short line, hidden once scrolled. */
  subtitle?: string;
  actions?: AppBarAction[];
  /** Leading control, e.g. a back chevron on a detail view. */
  onBack?: () => void;
  /** Extra row under the title (filter chips, month switcher…). */
  children?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, actions = [], onBack, children, className }) => {
  const [scrolled, setScrolled] = useState(false);

  // The bar condenses after a small scroll: subtitle drops out and the title
  // steps down a size. Threshold is deliberately low (12px) so the transition
  // happens on the very first flick rather than feeling delayed.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={cn(
        'md:hidden sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6',
        'bg-accent-subtle/95 backdrop-blur-xl border-b border-accent-border/30',
        'rounded-b-[var(--radius-lg)]',
        className
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        transition: 'box-shadow 0.3s var(--ease-out-quint)',
        boxShadow: scrolled ? 'var(--shadow-soft)' : 'none',
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{
          height: scrolled ? 44 : 52,
          transition: 'height 0.28s var(--ease-out-quint)',
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Înapoi"
            className="press -ml-1.5 w-9 h-9 grid place-items-center rounded-full text-text-main hover:bg-text-main/[0.06] shrink-0"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}

        <div className="min-w-0 flex-1">
          <h1
            className="font-display-tight text-text-main truncate leading-none"
            style={{
              fontSize: scrolled ? 17 : 20,
              transition: 'font-size 0.28s var(--ease-out-quint)',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-[11.5px] font-medium text-text-secondary truncate leading-none"
              style={{
                maxHeight: scrolled ? 0 : 16,
                opacity: scrolled ? 0 : 1,
                marginTop: scrolled ? 0 : 3,
                overflow: 'hidden',
                transition: 'all 0.28s var(--ease-out-quint)',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {actions.length > 0 && (
          <div className="flex items-center gap-0.5 shrink-0">
            {actions.map((a, i) => {
              const Ico = a.icon;
              return (
                <button
                  key={i}
                  onClick={a.onClick}
                  aria-label={a.label}
                  title={a.label}
                  className={cn(
                    'press relative w-9 h-9 grid place-items-center rounded-full',
                    a.primary
                      ? 'bg-accent-color text-white'
                      : 'text-text-main hover:bg-text-main/[0.06]'
                  )}
                >
                  <Ico size={18} />
                  {a.badge != null && a.badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-accent-color text-white text-[10px] font-bold nums border-2 border-accent-subtle">
                      {a.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {children && <div className="pb-2 -mt-0.5">{children}</div>}
    </div>
  );
};

export default AppBar;
