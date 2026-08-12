import React from 'react';

interface HeroHeaderProps {
  className?: string;
  children: React.ReactNode;
}

// Shared "dark gradient hero" background — originally built for Academy.tsx,
// now the standard header treatment across every main page. Light mode: a
// pale mint-to-white wash matching the app's accent color; dark mode: the
// slate-950 → accent-dark → slate-950 gradient (the look the user pointed
// at). Both carry the same soft radial glow + faint grid overlay. Callers
// own their own inner layout entirely — this only supplies the backdrop.
const HeroHeader: React.FC<HeroHeaderProps> = ({ className = '', children }) => (
  <div className={`relative overflow-hidden rounded-3xl border border-accent-color/20 dark:border-none shadow-xl shadow-accent-color/5 dark:shadow-none ${className}`}>
    <div className="absolute inset-0 bg-gradient-to-br from-accent-subtle via-white to-accent-subtle dark:hidden" />
    <div className="absolute inset-0 hidden dark:block bg-gradient-to-br from-slate-950 via-accent-dark to-slate-950" />
    <div
      className="absolute inset-0 opacity-40 dark:opacity-30"
      style={{ backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(16,185,129,0.3) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(6,182,212,0.2) 0%, transparent 50%)' }}
    />
    <div
      className="absolute inset-0 opacity-[0.03] dark:opacity-5"
      style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }}
    />
    <div className="relative">{children}</div>
  </div>
);

export default HeroHeader;
