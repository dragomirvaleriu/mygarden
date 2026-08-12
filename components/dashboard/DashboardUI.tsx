import React from 'react';

/**
 * Dashboard-only visual components.
 *
 * Scoped deliberately to pages/PFDashboard.tsx — the user asked to improve
 * only the main page, not the shared component library (Card/SectionHeader
 * in components/ui/primitives.tsx are used by AccountSettings and
 * SuperAdmin too, so those stay untouched). Anything defined here is safe
 * to make as opinionated as the dashboard wants without rippling anywhere
 * else. Relies only on tokens added to index.css (--radius-*, --shadow-*,
 * .grain, .animate-rise, .press, .nums, .font-display*), which are pure
 * additions and don't change any existing selector.
 */

const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

type Icon = React.ComponentType<{ size?: number; className?: string }>;

// ─── Surface ──────────────────────────────────────────────────────────────
type SurfaceTone = 'solid' | 'tint' | 'glass';
type Elevation = 'flat' | 'soft' | 'lift' | 'float';

export const Surface: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    tone?: SurfaceTone;
    elevation?: Elevation;
    padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    grain?: boolean;
  }
> = ({ tone = 'solid', elevation = 'soft', padding = 'md', grain = false, className, children, ...rest }) => {
  const pad = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6 md:p-7', xl: 'p-7 md:p-10' }[padding];
  const tones: Record<SurfaceTone, string> = {
    solid: 'bg-bg-card border border-border-color',
    tint: 'bg-accent-subtle border border-accent-border/40',
    glass: 'bg-bg-card/60 backdrop-blur-xl border border-white/10 dark:border-white/[0.06]',
  };
  const elev = { flat: '', soft: 'elev-soft', lift: 'elev-lift', float: 'elev-float' }[elevation];
  return (
    <div
      className={cn('relative rounded-[var(--radius-lg)]', tones[tone], elev, pad, grain && 'grain overflow-hidden', className)}
      {...rest}
    >
      {children}
    </div>
  );
};

// ─── DashHero ─────────────────────────────────────────────────────────────
// Dashboard-only hero backdrop — same idea as the shared HeroHeader (accent
// glow, grain, drift) but kept local so pages/Academy.tsx, Explore.tsx and
// GardenCollectionPage.tsx — which all use the shared one — are untouched.
export const DashHero: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={cn('grain relative overflow-hidden rounded-[var(--radius-xl)] border border-accent-border/40 dark:border-white/[0.07] elev-soft', className)}>
    <div className="absolute inset-0 bg-accent-subtle dark:hidden" />
    <div
      className="absolute inset-0 hidden dark:block"
      style={{ background: 'linear-gradient(135deg, #0d1211 0%, var(--accent-dark) 55%, #0d1211 100%)' }}
    />
    <div
      className="absolute -top-1/2 -right-[15%] w-[70%] aspect-square rounded-full animate-drift"
      style={{ background: 'radial-gradient(circle, var(--accent-color) 0%, transparent 70%)', opacity: 0.28, filter: 'blur(40px)' }}
    />
    <div
      className="absolute -bottom-1/2 -left-[10%] w-[55%] aspect-square rounded-full"
      style={{ background: 'radial-gradient(circle, var(--accent-color) 0%, transparent 70%)', opacity: 0.14, filter: 'blur(50px)' }}
    />
    <div className="relative z-10">{children}</div>
  </div>
);

// ─── Bento grid ───────────────────────────────────────────────────────────
const BentoRoot: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...rest }) => (
  <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4', className)} {...rest}>
    {children}
  </div>
);

const BentoTile: React.FC<React.ComponentProps<typeof Surface> & { index?: number }> = ({
  index = 0,
  className,
  style,
  ...rest
}) => (
  <Surface
    className={cn('animate-rise', className)}
    style={{ animationDelay: `${Math.min(index, 10) * 55}ms`, ...style }}
    {...rest}
  />
);

export const Bento = Object.assign(BentoRoot, { Tile: BentoTile });

// ─── Display heading ────────────────────────────────────────────────────
export const Display: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  children: React.ReactNode;
}> = ({ size = 'md', as: Tag = 'h2', className, children }) => {
  const sizes = { sm: 'text-xl md:text-2xl', md: 'text-2xl md:text-3xl', lg: 'text-3xl md:text-5xl' }[size];
  return <Tag className={cn('font-display-tight text-text-main', sizes, className)}>{children}</Tag>;
};

// ─── DashSectionHeader ────────────────────────────────────────────────────
// A dashboard-scoped version of SectionHeader (sentence case, small icon
// chip, thin accent rule) — kept separate from the shared primitive so the
// rest of the app keeps its existing uppercase-label header style.
export const DashSectionHeader: React.FC<{
  icon?: Icon;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ icon: IconEl, action, className, children }) => (
  <div className={cn('flex items-center justify-between gap-4 mb-4', className)}>
    <h3 className="flex items-center gap-2.5 text-[15px] font-bold text-text-main tracking-tight">
      {IconEl ? (
        <span className="grid place-items-center w-7 h-7 rounded-[var(--radius-xs)] bg-accent-color/12 text-accent-color shrink-0">
          <IconEl size={14} />
        </span>
      ) : (
        <span className="w-1 h-4 rounded-full bg-accent-color shrink-0" />
      )}
      <span className="truncate">{children}</span>
    </h3>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

// ─── Metric ───────────────────────────────────────────────────────────────
export const Metric: React.FC<{
  label: string;
  value: React.ReactNode;
  unit?: string;
  icon?: Icon;
  className?: string;
}> = ({ label, value, unit, icon: IconEl, className }) => (
  <div className={cn('flex flex-col gap-1', className)}>
    {IconEl && (
      <span className="grid place-items-center w-9 h-9 rounded-[var(--radius-xs)] bg-accent-color/12 text-accent-color mb-1.5">
        <IconEl size={17} />
      </span>
    )}
    <div className="flex items-baseline gap-1.5">
      <span className="font-display-tight nums text-text-main text-3xl md:text-4xl">{value}</span>
      {unit && <span className="text-sm font-semibold text-text-secondary">{unit}</span>}
    </div>
    <span className="text-[13px] font-medium text-text-secondary">{label}</span>
  </div>
);

// ─── DashPill ─────────────────────────────────────────────────────────────
type PillTone = 'neutral' | 'accent' | 'warn' | 'danger';

export const DashPill: React.FC<{ tone?: PillTone; className?: string; children: React.ReactNode }> = ({
  tone = 'neutral',
  className,
  children,
}) => {
  const tones: Record<PillTone, string> = {
    neutral: 'bg-text-main/[0.06] text-text-secondary',
    accent: 'bg-accent-color/12 text-accent-color',
    warn: 'bg-amber-500/14 text-amber-700 dark:text-amber-400',
    danger: 'bg-red-500/12 text-red-600 dark:text-red-400',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  );
};

// ─── DashButton ───────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'soft' | 'quiet' | 'danger';

export const DashButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: 'sm' | 'md';
    icon?: Icon;
    iconRight?: Icon;
  }
> = ({ variant = 'primary', size = 'md', icon: IconEl, iconRight: IconRight, className, children, ...rest }) => {
  const sizes = { sm: 'h-9 px-3.5 text-[13px] gap-1.5', md: 'h-11 px-5 text-[14px] gap-2' }[size];
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-accent-color text-white elev-soft hover:elev-lift hover:bg-accent-hover',
    soft: 'bg-accent-color/12 text-accent-color hover:bg-accent-color/20',
    quiet: 'text-text-secondary hover:text-text-main hover:bg-text-main/[0.05]',
    danger: 'bg-red-500/12 text-red-600 dark:text-red-400 hover:bg-red-500/20',
  };
  return (
    <button
      className={cn(
        'press inline-flex items-center justify-center rounded-full font-bold tracking-tight',
        sizes,
        variants[variant],
        className
      )}
      {...rest}
    >
      {IconEl && <IconEl size={size === 'sm' ? 15 : 17} />}
      {children}
      {IconRight && <IconRight size={size === 'sm' ? 15 : 17} />}
    </button>
  );
};

// ─── DashIconBadge ────────────────────────────────────────────────────────
export const DashIconBadge: React.FC<{ icon: Icon; tone?: 'accent' | 'neutral' | 'danger'; className?: string }> = ({
  icon: IconEl,
  tone = 'accent',
  className,
}) => {
  const tones = {
    accent: 'bg-accent-color/12 text-accent-color',
    neutral: 'bg-text-main/[0.06] text-text-secondary',
    danger: 'bg-red-500/12 text-red-500',
  }[tone];
  return (
    <span className={cn('grid place-items-center w-11 h-11 rounded-[var(--radius-sm)] shrink-0', tones, className)}>
      <IconEl size={20} />
    </span>
  );
};

// ─── Segmented control ─────────────────────────────────────────────────────
export function DashSegmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={cn('relative inline-flex items-center p-1 rounded-full bg-text-main/[0.05] dark:bg-white/[0.05]', className)}>
      <span
        className="absolute top-1 bottom-1 rounded-full bg-bg-card elev-soft"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          left: `calc(0.25rem + (100% - 0.5rem) / ${options.length} * ${activeIndex})`,
          transition: 'left 0.42s var(--ease-spring)',
        }}
      />
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative z-10 flex-1 inline-flex items-center justify-center px-4 h-9 rounded-full',
              'text-[13px] font-bold tracking-tight transition-colors duration-300 whitespace-nowrap',
              active ? 'text-accent-color' : 'text-text-secondary hover:text-text-main'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
