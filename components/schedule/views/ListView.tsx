import React from 'react';
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';
import { format, endOfWeek } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

interface Props {
  listFilter: string;
  grouped: Record<string, any[]>;
  renderCard: (visit: any, index: number, array: any[]) => React.ReactNode;
  handleMoveAllToTomorrow: () => void;
  archivePage: number;
  setArchivePage: React.Dispatch<React.SetStateAction<number>>;
  ARCHIVE_PER_PAGE: number;
}

export const ListView: React.FC<Props> = ({
  listFilter, grouped, renderCard, handleMoveAllToTomorrow, archivePage, setArchivePage, ARCHIVE_PER_PAGE
}) => {
  const { t } = useTranslation();

  return (
    <div id="schedule-content-anchor" className="flex flex-col gap-12">
      {/* Row 1: Azi */}
      {(listFilter === 'all' || listFilter === 'azi') && (
        <section className="flex flex-col gap-4 w-full">
            <div className="flex items-center justify-between ml-1 border-b border-border-color pb-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-accent-color flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent-color animate-pulse"></span>
                  {t('Today')} ({grouped['Today']?.length || 0})
                  {(grouped['Today']?.length || 0) > 0 && (
                    <div className="flex gap-1">
                        <button onClick={handleMoveAllToTomorrow} className="w-6 h-6 flex items-center justify-center rounded-full text-text-secondary hover:text-blue-500 transition-all shrink-0" title={t('Amânare Zi Ploaie / Delay All')}>
                            <div className="flex -space-x-2">
                                <Play size={12} strokeWidth={1.5} />
                                <Play size={12} strokeWidth={1.5} />
                            </div>
                        </button>
                    </div>
                  )}
              </h3>
            </div>
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {(grouped['Today'] || []).map((v, i, a) => (
                    <motion.div key={v.id} variants={staggerItem}>
                        {renderCard(v, i, a)}
                    </motion.div>
                ))}
            </motion.div>
        </section>
      )}

      {/* Row 2: Viitor */}
      {(listFilter === 'all' || listFilter === 'viitor') && (
        <section className="flex flex-col gap-4 w-full">
            <div className="flex items-center justify-between ml-1 border-b border-border-color pb-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-text-secondary">{t('Future')} ({grouped['Planned']?.length || 0})</h3>
            </div>
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {(() => {
                    const currentWeekEndStr = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
                    return (grouped['Planned'] || []).map((v, index, array) => {
                        const vDateStr = v.data || '';
                        const isNextWeek = vDateStr && vDateStr > currentWeekEndStr;
                        const prevV = index > 0 ? array[index - 1] : null;
                        const prevDateStr = prevV ? (prevV.data || '') : '';
                        const prevIsNextWeek = prevDateStr && prevDateStr > currentWeekEndStr;
                        const showSeparator = isNextWeek && !prevIsNextWeek;

                        return (
                            <React.Fragment key={v.id}>
                                {showSeparator && (
                                    <motion.div variants={staggerItem} className="col-span-full my-4 relative flex items-center justify-center">
                                        <div className="absolute w-full h-[1px] bg-border-color"></div>
                                        <span className="relative bg-bg-main px-4 text-xs font-bold text-text-secondary uppercase tracking-wider">
                                            {t('Next Week')}
                                        </span>
                                    </motion.div>
                                )}
                                <motion.div variants={staggerItem}>
                                    {renderCard(v, index, array)}
                                </motion.div>
                            </React.Fragment>
                        );
                    });
                })()}
            </motion.div>
        </section>
      )}

      {/* Row 3: Arhiva */}
      {(listFilter === 'all' || listFilter === 'arhiva') && (
        <section className="flex flex-col gap-4 w-full">
          <div className="flex items-center justify-between px-1 border-b border-border-color pb-2">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-secondary">{t('Completed Archive')} ({grouped['Archive']?.length || 0})</h3>
            <div className="flex items-center gap-4">
              {(grouped['Archive']?.length || 0) > ARCHIVE_PER_PAGE && (
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setArchivePage(p => Math.max(1, p - 1))}
                    disabled={archivePage === 1}
                    className="px-2 py-1 text-[11px] font-bold text-text-secondary hover:text-main disabled:opacity-30"
                  >
                    «
                  </button>
                  
                  {Array.from({ length: Math.ceil((grouped['Archive']?.length || 0) / ARCHIVE_PER_PAGE) }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === Math.ceil((grouped['Archive']?.length || 0) / ARCHIVE_PER_PAGE) || (p >= archivePage - 1 && p <= archivePage + 1))
                    .map((p, i, arr) => (
                      <React.Fragment key={p}>
                        {i > 0 && arr[i-1] !== p - 1 && <span className="text-[11px] text-text-secondary px-1">...</span>}
                        <button
                          onClick={() => setArchivePage(p)}
                          className={`px-2 py-1 rounded text-[11px] font-bold ${archivePage === p ? 'bg-accent-color text-white' : 'text-text-secondary hover:text-main'}`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))
                  }

                  <button 
                    onClick={() => setArchivePage(p => Math.min(Math.ceil((grouped['Archive']?.length || 0) / ARCHIVE_PER_PAGE), p + 1))}
                    disabled={archivePage >= Math.ceil((grouped['Archive']?.length || 0) / ARCHIVE_PER_PAGE)}
                    className="px-2 py-1 text-[11px] font-bold text-text-secondary hover:text-main disabled:opacity-30"
                  >
                    »
                  </button>
                </div>
              )}
            </div>
          </div>
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {(grouped['Archive'] || []).slice((archivePage - 1) * ARCHIVE_PER_PAGE, archivePage * ARCHIVE_PER_PAGE).map((v, i, a) => (
                  <motion.div key={v.id} variants={staggerItem}>
                      {renderCard(v, i, a)}
                  </motion.div>
              ))}
          </motion.div>
        </section>
      )}
    </div>
  );
};
