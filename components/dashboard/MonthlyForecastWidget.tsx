import React from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { Visit, Client, Property } from '../../src/types';

import { CloudRain } from 'lucide-react';
export const MonthlyForecastWidget: React.FC<{ visits: Visit[]; augmentedClients: any[]; properties: Property[]; weatherAlerts: { formattedDate: string; pop: number; count: number }[] }> = ({ visits, augmentedClients, properties, weatherAlerts }) => {
  const { t } = useTranslation();
  
  // Calculate Dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const currentMonthPrefix = format(today, 'yyyy-MM');

  // MRR
  const mrr = augmentedClients.filter(c => c.status === 'Activ' && (c.contractType === 'maintenance' || !c.contractType)).reduce((acc, c) => acc + (c.tarifLunar || 0), 0);
  
  // Month Completion
  const thisMonthVisits = visits.filter(v => v.data?.startsWith(currentMonthPrefix) && v.status !== 'Anulat');
  const thisMonthDone = thisMonthVisits.filter(v => v.status === 'Finalizat').length;
  const thisMonthTotal = thisMonthVisits.length;
  const completionRate = thisMonthTotal > 0 ? Math.round((thisMonthDone / thisMonthTotal) * 100) : 0;

  // Overdue Visits
  const overdueVisitsList = visits.filter(v => {
    if (v.status !== 'Programat') return false;
    const vDate = v.data ? new Date(v.data) : null;
    return vDate && vDate < today;
  });
  const overdueVisits = overdueVisitsList.length;

  // Week Completion
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const thisWeekVisits = visits.filter(v => {
    if (v.status === 'Anulat') return false;
    const vDate = v.data ? new Date(v.data) : null;
    return vDate && vDate >= weekStart && vDate <= weekEnd;
  });
  const thisWeekDone = thisWeekVisits.filter(v => v.status === 'Finalizat').length;
  const thisWeekTotal = thisWeekVisits.length;
  const weekCompletionRate = thisWeekTotal > 0 ? Math.round((thisWeekDone / thisWeekTotal) * 100) : 0;

  // Alerts
  const debtorsList = augmentedClients.filter(c => (c.sold || 0) > 0 && c.ziScadenta && c.ziScadenta < today.getDate());
  const debtorsCount = debtorsList.length;
  
  const alerts: { message: string, type: 'warning' | 'success', details?: string[] }[] = [];
  if (overdueVisits > 0) {
    alerts.push({
      message: `⚠️ ${overdueVisits} ${t('overdue visits require rescheduling')}`,
      type: 'warning',
      details: overdueVisitsList.map(v => `${v.clientName || 'Client'} - ${v.data ? format(new Date(v.data), 'dd.MM.yyyy') : ''}`)
    });
  }
  if (debtorsCount > 0) {
    alerts.push({
      message: `⚠️ ${debtorsCount} ${t('clients have overdue invoices')}`,
      type: 'warning',
      details: debtorsList.map(c => `${c.nume || c.companyName || 'Client'} (Sold: ${c.sold} RON)`)
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      message: `✅ ${t('All operations are running smoothly')}`,
      type: 'success'
    });
  }

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        <div className="bg-bg-main/50 rounded-xl p-3 border border-border-color/50 flex flex-col justify-center">
          <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-0.5">{t('Week Progress')}</p>
          <div className="flex items-center gap-2">
            <p className={`text-xl font-black ${weekCompletionRate >= 80 ? 'text-accent-color' : weekCompletionRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{weekCompletionRate}%</p>
            <div className="flex-1 h-1 bg-border-color/30 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${weekCompletionRate >= 80 ? 'bg-accent-color' : weekCompletionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${weekCompletionRate}%` }} />
            </div>
          </div>
          <p className="text-[9px] font-bold text-text-secondary/60 uppercase mt-1 text-right">{thisWeekTotal - thisWeekDone} {t('remaining')}</p>
        </div>
        
        <div className="bg-bg-main/50 rounded-xl p-3 border border-border-color/50 flex flex-col justify-center">
          <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-0.5">{t('Month Progress')}</p>
          <div className="flex items-center gap-2">
            <p className={`text-xl font-black ${completionRate >= 80 ? 'text-accent-color' : completionRate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{completionRate}%</p>
            <div className="flex-1 h-1 bg-border-color/30 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${completionRate >= 80 ? 'bg-accent-color' : completionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${completionRate}%` }} />
            </div>
          </div>
          <p className="text-[9px] font-bold text-text-secondary/60 uppercase mt-1 text-right">{thisMonthTotal - thisMonthDone} {t('remaining')}</p>
        </div>

        <div className="bg-bg-main/50 rounded-xl p-3 border border-border-color/50 flex flex-col justify-center">
          <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-0.5">{t('MRR')}</p>
          <p className="text-xl font-black text-accent-color">{mrr.toLocaleString()} <span className="text-[10px] font-bold opacity-60">RON</span></p>
        </div>

        <div className={`rounded-xl p-3 border flex flex-col justify-center ${overdueVisits > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-bg-main/50 border-border-color/50'}`}>
          <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${overdueVisits > 0 ? 'text-red-600' : 'text-text-secondary'}`}>{t('Overdue Visits')}</p>
          <p className={`text-xl font-black ${overdueVisits > 0 ? 'text-red-600' : 'text-main'}`}>{overdueVisits}</p>
        </div>
      </div>

      {/* Alerte meteo inteligente integrate în Prognoza Lunii */}
      {weatherAlerts.length > 0 && (
        <div className="space-y-1.5">
          {weatherAlerts.map((alert, idx) => (
            <div key={idx} className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                <CloudRain size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none mb-0.5">
                  Alertă Meteo
                </p>
                <p className="text-[11px] font-bold text-main leading-snug">
                  {alert.formattedDate}: {alert.pop}% șanse de ploaie — {alert.count} {alert.count === 1 ? 'vizită' : 'vizite'} afectate
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1.5">{t('Smart Alerts')}</p>
        <div className="space-y-1 flex flex-col">
            {alerts.map((alert, i) => (
                <p 
                  key={i} 
                  className={`text-[11px] font-bold ${alert.type === 'success' ? 'text-green-600' : 'text-main'} ${alert.details ? 'cursor-help border-b border-dashed border-main/30 pb-0.5 w-fit' : ''}`}
                  title={alert.details ? alert.details.join('\n') : undefined}
                >
                  {alert.message}
                </p>
            ))}
        </div>
      </div>
    </div>
  );
};
