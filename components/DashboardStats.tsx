import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Skeleton } from './ui/Skeleton';
import { useTranslation } from 'react-i18next';

interface Props {
  clientCounts: { active: number; maintenance: number };
  loading: boolean;
  accountType?: 'PF' | 'PJ';
}

export const DashboardStats: React.FC<Props> = ({ clientCounts, loading, accountType = 'PJ' }) => {
  const { t } = useTranslation();
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const workdayProgress = useMemo(() => {
    const now = new Date();
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const end = new Date();
    end.setHours(18, 0, 0, 0);

    if (now < start) return 0;
    if (now > end) return 100;

    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    return Math.round((elapsed / total) * 100);
  }, [time]);

  if (loading) {
    return (
      <div className="stihl-card rounded-lg p-6 space-y-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-32 rounded-full mx-auto" />
        <div className="flex justify-between pt-4 border-t border-border-color">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="stihl-card rounded-lg p-6">
      <p className="text-4xl font-light tracking-tight text-main">{time}</p>
      <p className="text-xs font-bold text-accent-color uppercase tracking-wider mt-1">
        {format(new Date(), 'dd/MM/yyyy')}
      </p>
      <div className="text-text-secondary uppercase tracking-widest text-sm font-bold mt-4">
        {accountType === 'PF' ? t('Care Schedule') : t('Operational Program')} (09-18)
      </div>
      <div className="relative w-32 h-32 flex items-center justify-center mx-auto my-4">
        <svg className="w-full h-full -rotate-90">
          <circle cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-gray-200 dark:bg-gray-700" />
          <circle cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="8" 
            strokeDasharray={352} strokeDashoffset={352 - (352 * workdayProgress) / 100}
            strokeLinecap="round" className="text-accent-color transition-all duration-1000" />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-black text-main">{workdayProgress}%</span>
          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-tighter">{t('Progress')}</span>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-border-color flex justify-between items-center">
        <div className="text-center flex-1">
          <p className="text-xl font-black text-main leading-none">{clientCounts.active}</p>
          <p className="text-[11px] font-bold text-text-secondary uppercase tracking-tighter">
            {accountType === 'PF' ? t('Active Gardens') : t('Active Clients')}
          </p>
        </div>
        <div className="w-px h-8 bg-border-color"></div>
        <div className="text-center flex-1">
          <p className="text-xl font-black text-accent-color leading-none">{clientCounts.maintenance}</p>
          <p className="text-[11px] font-bold text-text-secondary uppercase tracking-tighter">
            {accountType === 'PF' ? t('Care Visits') : t('Maintenance')}
          </p>
        </div>
      </div>
    </div>
  );
};
