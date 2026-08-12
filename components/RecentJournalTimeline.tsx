import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ro, enUS } from 'date-fns/locale';
import { Camera, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface RecentEntry {
  id: string;
  date?: any;
  clientName?: string;
  propertyName?: string;
  details?: string;
  photoUrl?: string;
}

interface Props {
  entries: RecentEntry[];
  loading: boolean;
  onViewAll: () => void;
}

export const RecentJournalTimeline: React.FC<Props> = ({ entries, loading, onViewAll }) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ro' ? ro : enUS;

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-border-color p-4 bg-bg-card/50"
      >
        <div className="h-20 bg-bg-main/50 rounded-lg animate-pulse" />
      </motion.div>
    );
  }

  if (entries.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-border-color p-6 bg-bg-card/50 text-center"
      >
        <Camera className="w-8 h-8 text-text-secondary/50 mx-auto mb-2" />
        <p className="text-sm text-text-secondary">{t('Nici o intrare în jurnal inca')}</p>
        <button
          onClick={onViewAll}
          className="text-xs font-bold text-accent-color hover:underline mt-2"
        >
          {t('Deschide jurnalul')} →
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary flex items-center gap-2">
          <Camera className="w-3.5 h-3.5 text-accent-color" />
          {t('Ultimele intrari')}
        </h2>
        <button
          onClick={onViewAll}
          className="text-[10px] font-bold text-accent-color hover:underline flex items-center gap-1"
        >
          {t('Vezi tot')} <ArrowRight className="w-2.5 h-2.5" />
        </button>
      </div>

      <div className="space-y-2">
        {entries.map((entry, idx) => {
          const entryDate = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date || Date.now());
          const formattedDate = format(entryDate, 'd MMM, HH:mm', { locale });

          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group relative rounded-lg bg-bg-main border border-border-color p-3 hover:border-accent-color/50 transition cursor-pointer"
              onClick={onViewAll}
            >
              <div className="flex gap-3">
                {/* Timeline dot */}
                <div className="flex flex-col items-center gap-1 pt-1">
                  <div className="w-2 h-2 rounded-full bg-accent-color group-hover:scale-125 transition" />
                  {idx < entries.length - 1 && (
                    <div className="w-0.5 h-6 bg-border-color" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-text-main truncate">
                        {entry.propertyName || entry.clientName || t('Intrare')}
                      </p>
                      <p className="text-[10px] text-text-secondary mt-0.5">{formattedDate}</p>
                    </div>
                  </div>
                  {entry.details && (
                    <p className="text-xs text-text-secondary mt-1.5 line-clamp-2">{entry.details}</p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};
