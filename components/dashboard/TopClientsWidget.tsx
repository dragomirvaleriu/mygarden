import React from 'react';
import { useTranslation } from 'react-i18next';
import { Visit, Client, Property } from '../../src/types';

import { Page } from '../../src/types';
export const TopClientsWidget: React.FC<{ augmentedClients: any[]; onNavigate: (page: Page, id?: string) => void }> = ({ augmentedClients, onNavigate }) => {
  const { t } = useTranslation();
  
  const topMaintenance = React.useMemo(() =>
    [...augmentedClients]
      .filter(c => c.status === 'Activ' && (c.maintenanceValue || 0) > 0)
      .sort((a, b) => (b.maintenanceValue || 0) - (a.maintenanceValue || 0))
      .slice(0, 5),
    [augmentedClients]
  );

  const topOneTime = React.useMemo(() =>
    [...augmentedClients]
      .filter(c => c.status === 'Activ' && (c.oneTimeValue || 0) > 0 && c.contractType !== 'maintenance')
      .sort((a, b) => (b.oneTimeValue || 0) - (a.oneTimeValue || 0))
      .slice(0, 3),
    [augmentedClients]
  );

  const maxMaintenanceRate = Math.max(1, topMaintenance[0]?.maintenanceValue || 1);
  const maxOneTimeRate = Math.max(1, topOneTime[0]?.oneTimeValue || 1);

  if (topMaintenance.length === 0 && topOneTime.length === 0) {
    return <div className="flex items-center justify-center py-10 opacity-30 text-[11px] font-black uppercase">{t('No data')}</div>;
  }

  return (
    <div className="space-y-4 overflow-y-auto custom-scrollbar max-h-[350px] pr-1">
      {/* Maintenance Section */}
      {topMaintenance.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-color"></span>
            {t('Top 5 Maintenance')}
          </p>
          {topMaintenance.map((c, i) => {
            const val = c.maintenanceValue || 0;
            const sold = c.sold || 0;
            const paid = Math.max(0, val - Math.max(0, sold));
            return (
              <div key={c.id} className="group cursor-pointer" onClick={() => onNavigate(Page.Details, c.id)}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-text-secondary w-4">#{i + 1}</span>
                    <span className="text-[11px] font-black text-main truncate max-w-[140px]">{c.tip_persoana === 'PJ' ? (c.numeFirma || c.nume) : c.nume}</span>
                  </div>
                  <span className="text-[11px] font-black text-accent-color">
                    {sold.toLocaleString()} <span className="text-[8px] opacity-40">/ {val.toLocaleString()} RON</span>
                  </span>
                </div>
                <div className="w-full h-1 bg-border-color/10 rounded-full overflow-hidden" title={t('Revenue proportion compared to top client')}>
                  <div className="h-full bg-accent-color rounded-full transition-all duration-500 group-hover:opacity-80"
                    style={{ width: `${(val / maxMaintenanceRate) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* One-time Section */}
      {topOneTime.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border-color/30">
          <p className="text-[11px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[color-mix(in_srgb,var(--accent-color),black_30%)]"></span>
            {t('Top 3 One-time Projects')}
          </p>
          {topOneTime.map((c, i) => {
            const val = c.oneTimeValue || 0;
            const sold = c.sold || 0;
            return (
              <div key={c.id} className="group cursor-pointer" onClick={() => onNavigate(Page.Details, c.id)}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-text-secondary w-4">#{i + 1}</span>
                    <span className="text-[11px] font-black text-main truncate max-w-[140px]">{c.tip_persoana === 'PJ' ? (c.numeFirma || c.nume) : c.nume}</span>
                  </div>
                  <span className="text-[11px] font-black text-[color-mix(in_srgb,var(--accent-color),black_30%)]">
                    {sold.toLocaleString()} <span className="text-[8px] opacity-40">/ {val.toLocaleString()} RON</span>
                  </span>
                </div>
                <div className="w-full h-1 bg-border-color/10 rounded-full overflow-hidden" title={t('Revenue proportion compared to top client')}>
                  <div className="h-full bg-[color-mix(in_srgb,var(--accent-color),black_30%)] rounded-full transition-all duration-500 group-hover:opacity-80"
                    style={{ width: `${(val / maxOneTimeRate) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
