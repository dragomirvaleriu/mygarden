import React from 'react';

/**
 * Shared UI primitives for My Garden.
 *
 * These capture the exact surface / header / tag patterns that were being
 * hand-repeated across every screen (Card = `bg-bg-card border
 * border-border-color rounded-2xl p-5 shadow-sm`, the tiny uppercase section
 * label, the small rounded status tags). Adopting them keeps every screen on
 * one visual system and makes a later design pass a single edit instead of a
 * find-and-replace. They add no dependencies and only use tokens already
 * defined in index.css, so they render identically in light and dark themes.
 */

const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

type Icon = React.ComponentType<{ size?: number; className?: string }>;

// ─── Card ────────────────────────────────────────────────────────────────
// The standard elevated surface. `solid` matches the card used everywhere
// today; `glass` is the frosted variant already used on the dashboard.
type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'solid' | 'glass' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
};

export const Card: React.FC<CardProps> = ({
  variant = 'solid',
  padding = 'md',
  interactive = false,
  className,
  children,
  ...rest
}) => {
  const pad = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6 md:p-8' }[padding];
  const surface = {
    // `accent-subtle` is a 5-8% wash of the user's theme color over the card
    // background (see index.html) — this is what makes cards read as "on
    // brand" everywhere without a loud accent-colored border on every box.
    solid: 'bg-accent-subtle border border-accent-border/50 shadow-sm',
    glass: 'bg-bg-card/50 backdrop-blur-md border border-accent-border/50',
    ghost: 'bg-transparent',
  }[variant];
  return (
    <div
      className={cn(
        'rounded-2xl',
        surface,
        pad,
        interactive && 'transition-all hover:border-accent-border hover:shadow-md cursor-pointer',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
};

// ─── SectionHeader ─────────────────────────────────────────────────────────
// The tiny uppercase label with an optional leading icon and an optional
// right-aligned action (usually a "View all →" link).
export const SectionHeader: React.FC<{
  icon?: Icon;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ icon: IconEl, action, className, children }) => (
  <div className={cn('flex items-center justify-between mb-4', className)}>
    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2">
      {IconEl && <IconEl size={12} className="text-accent-color" />}
      {children}
    </h3>
    {action}
  </div>
);

// ─── Stat ──────────────────────────────────────────────────────────────────
// A label + value pair, e.g. "Total Surface — 240 m²".
export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  unit?: string;
  icon?: Icon;
  className?: string;
}> = ({ label, value, unit, icon: IconEl, className }) => (
  <div className={cn('flex items-center justify-between', className)}>
    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
      {IconEl && <IconEl size={12} className="text-accent-color" />}
      {label}
    </span>
    <span className="text-sm font-black text-main">
      {value}
      {unit && <span className="text-[10px] font-bold text-text-secondary/50 ml-1">{unit}</span>}
    </span>
  </div>
);

// ─── Pill ────────────────────────────────────────────────────────────────
// Small rounded uppercase tag. Tones map to the semantic colors already used
// across the app (accent for brand, plus water-blue / success / warn / danger
// per the color brief).
type PillTone = 'neutral' | 'accent' | 'water' | 'success' | 'warn' | 'danger';

export const Pill: React.FC<{
  tone?: PillTone;
  icon?: Icon;
  className?: string;
  children: React.ReactNode;
}> = ({ tone = 'neutral', icon: IconEl, className, children }) => {
  const tones: Record<PillTone, string> = {
    neutral: 'bg-bg-main text-text-secondary border-border-color',
    accent: 'bg-accent-color/10 text-accent-color border-accent-color/20',
    water: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    success: 'bg-accent-subtle text-accent-ink dark:text-accent-ink border-accent-border',
    warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-500 border-red-500/20',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider',
        tones[tone],
        className
      )}
    >
      {IconEl && <IconEl size={10} />}
      {children}
    </span>
  );
};
