import React from 'react';
import { useTranslation } from 'react-i18next';

export const MaintenanceTooltip = ({ active, payload }: any) => {
  const { t } = useTranslation();
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const clientList = data.clientList || [];
    const filteredClients = clientList.filter((c: any) => c.contractType === 'maintenance');
    const total = filteredClients.reduce((sum: number, c: any) => sum + (c.paymentAmount || 0), 0);

    return (
      <div className="stihl-card bg-bg-card/90 backdrop-blur-md border border-border-color rounded-xl p-3 shadow-xl text-xs font-bold space-y-2 max-w-[280px]">
        <div className="text-[11px] text-text-secondary">{data.fullDate}</div>
        <div className="space-y-1">
          {filteredClients.length > 0 ? (
            filteredClients.map((c: any) => {
              const name = c.tip_persoana === 'PJ' 
                ? `${c.numeFirma || 'Firma Necunoscută'}${c.nume ? ` (${c.nume})` : ''}` 
                : c.nume;
              return (
                <div key={c.id} className="flex justify-between gap-4 font-semibold text-main">
                  <span className="truncate max-w-[180px]">{name}</span>
                  <span className="text-text-secondary shrink-0">{c.paymentAmount} RON</span>
                </div>
              );
            })
          ) : (
            <div className="text-[11px] text-text-secondary italic">{t('No payments') || 'Fără încasări'}</div>
          )}
        </div>
        <div className="border-t border-border-color/60 pt-1.5 flex justify-between text-main font-black">
          <span>{t('Total')}</span>
          <span className="text-blue-500">{total.toLocaleString()} RON</span>
        </div>
      </div>
    );
  }
  return null;
};

export const ProjectsTooltip = ({ active, payload }: any) => {
  const { t } = useTranslation();
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const clientList = data.clientList || [];
    const filteredClients = clientList.filter((c: any) => c.contractType === 'one-time');
    const total = filteredClients.reduce((sum: number, c: any) => sum + (c.paymentAmount || 0), 0);

    return (
      <div className="stihl-card bg-bg-card/90 backdrop-blur-md border border-border-color rounded-xl p-3 shadow-xl text-xs font-bold space-y-2 max-w-[280px]">
        <div className="text-[11px] text-text-secondary">{data.fullDate}</div>
        <div className="space-y-1">
          {filteredClients.length > 0 ? (
            filteredClients.map((c: any) => {
              const name = c.tip_persoana === 'PJ' 
                ? `${c.numeFirma || 'Firma Necunoscută'}${c.nume ? ` (${c.nume})` : ''}` 
                : c.nume;
              return (
                <div key={c.id} className="flex justify-between gap-4 font-semibold text-main">
                  <span className="truncate max-w-[180px]">{name}</span>
                  <span className="text-text-secondary shrink-0">{c.paymentAmount} RON</span>
                </div>
              );
            })
          ) : (
            <div className="text-[11px] text-text-secondary italic">{t('No payments') || 'Fără încasări'}</div>
          )}
        </div>
        <div className="border-t border-border-color/60 pt-1.5 flex justify-between text-main font-black">
          <span>{t('Total')}</span>
          <span className="text-emerald-500">{total.toLocaleString()} RON</span>
        </div>
      </div>
    );
  }
  return null;
};
