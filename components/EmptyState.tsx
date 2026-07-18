
import React from 'react';
import { Sprout, Calendar, Search, Ghost, Trees, ClipboardCheck } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  type: 'no-data' | 'no-results' | 'all-done' | 'schedule';
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, type, action }) => {
  const renderIllustration = () => {
    switch (type) {
      case 'all-done':
        return (
          <div className="relative w-32 h-32 mb-6">
            <div className="absolute inset-0 bg-accent-color/10 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center text-accent-color">
              <ClipboardCheck size={64} strokeWidth={1} />
            </div>
            <div className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-2 shadow-lg animate-bounce">
              <Sprout size={20} />
            </div>
          </div>
        );
      case 'schedule':
        return (
          <div className="relative w-32 h-32 mb-6">
            <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center text-blue-500">
              <Calendar size={64} strokeWidth={1} />
            </div>
            <div className="absolute bottom-2 right-2 text-accent-color opacity-40">
              <Trees size={32} />
            </div>
          </div>
        );
      case 'no-results':
        return (
          <div className="relative w-32 h-32 mb-6">
            <div className="absolute inset-0 bg-amber-500/10 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center text-amber-500">
              <Search size={64} strokeWidth={1} />
            </div>
          </div>
        );
      default:
        return (
          <div className="relative w-32 h-32 mb-6">
            <div className="absolute inset-0 bg-gray-200 dark:bg-white/5 rounded-full"></div>
            <div className="absolute inset-0 flex items-center justify-center text-text-secondary opacity-20">
              <Ghost size={64} strokeWidth={1} />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-bg-card/30 border-2 border-dashed border-border-color/20 rounded-3xl">
      {renderIllustration()}
      <h3 className="text-xl font-black text-main uppercase tracking-tighter mb-2">{title}</h3>
      <p className="text-sm text-text-secondary font-medium max-w-[280px] leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
};
