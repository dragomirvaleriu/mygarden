import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot } from '../services/firebase';
import { TimeLog } from '../src/types';
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { BarChart3, TrendingUp, CalendarDays, History } from 'lucide-react';
import { auth } from '../services/firebase';
import { Page } from '../src/types';

interface Props {
  organizationId: string;
  onNavigate: (page: Page) => void;
}

const MyStatsWidget: React.FC<Props> = ({ organizationId, onNavigate }) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!organizationId || !currentUid) return;

    const start = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const end = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const q = query(
      collection(db, 'time_logs'),
      where('userId', '==', currentUid)
    );

    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeLog));
      
      // Filter in memory for this week
      const weekLogs = data.filter(d => 
        d.organizationId === organizationId && 
        d.date >= start && 
        d.date <= end
      );
      setLogs(weekLogs);
      setLoading(false);
    }, err => {
      console.error("MyStatsWidget err:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [organizationId, currentUid]);

  if (loading) return null;

  const totalMinutes = logs.reduce((acc, curr) => acc + (curr.totalWorkMinutes || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const daysWorked = new Set(logs.map(l => l.date)).size;

  return (
    <div className="bg-bg-card border border-border-color rounded-2xl p-5 shadow-sm">
      <h2 className="text-xs font-black text-text-secondary uppercase tracking-widest flex items-center gap-2 mb-4">
        <BarChart3 size={14} className="text-blue-500" />
        {t('This Week Stats')}
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-main rounded-xl p-4 border border-border-color">
          <div className="flex items-center gap-2 text-text-secondary mb-1">
            <TrendingUp size={14} />
            <span className="text-[11px] font-bold uppercase tracking-wider">{t('Hours')}</span>
          </div>
          <p className="text-2xl font-black text-main">{totalHours}h</p>
        </div>
        <div className="bg-bg-main rounded-xl p-4 border border-border-color">
          <div className="flex items-center gap-2 text-text-secondary mb-1">
            <CalendarDays size={14} />
            <span className="text-[11px] font-bold uppercase tracking-wider">{t('Days')}</span>
          </div>
          <p className="text-2xl font-black text-main">{daysWorked} {t('days')}</p>
        </div>
      </div>

      <button
        onClick={() => onNavigate(Page.Administration)}
        className="w-full mt-4 py-3 bg-bg-main hover:bg-bg-card border border-border-color rounded-xl text-sm font-bold text-text-secondary flex items-center justify-center gap-2 transition-all active:scale-95"
      >
        <History size={16} />
        {t('View Full History')}
      </button>
    </div>
  );
};

export default MyStatsWidget;
