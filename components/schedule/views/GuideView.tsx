import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sprout, CheckCircle2 } from 'lucide-react';
import { format, setMonth } from 'date-fns';
import { monthlyGuide } from '../../../src/data/monthlyGuide';

interface Props {
  selectedGuideMonth: number;
  setSelectedGuideMonth: (month: number) => void;
}

export const GuideView: React.FC<Props> = ({ selectedGuideMonth, setSelectedGuideMonth }) => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 min-h-0 bg-bg-card border border-border-color rounded-3xl shadow-2xl overflow-hidden relative">
      <div className="h-full flex flex-col p-8 bg-bg-main/30 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
              <div>
                  <h2 className="text-3xl font-black text-main uppercase tracking-tighter mb-2">{t('Monthly Garden Roadmap')}</h2>
                  <p className="text-xs text-text-secondary font-bold uppercase tracking-widest opacity-60">{t('Seasonal tasks and expert recommendations for your garden')}</p>
              </div>
              
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                      <button
                          key={i}
                          onClick={() => setSelectedGuideMonth(i)}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all border ${selectedGuideMonth === i ? 'bg-accent-color text-white border-accent-color shadow-md shadow-accent-color/20 scale-105' : 'bg-bg-card text-text-secondary border-border-color hover:border-accent-color/30'}`}
                      >
                          {format(setMonth(new Date(), i), 'MMM')}
                      </button>
                  ))}
              </div>
          </div>

          {monthlyGuide.find(m => m.month === selectedGuideMonth) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="lg:col-span-2 space-y-6">
                      <div className="stihl-card p-4 rounded-2xl bg-bg-card border border-border-color shadow-md">
                          <div className="flex items-center gap-2 mb-4">
                              <div className="w-1 h-4 bg-accent-color rounded-full"></div>
                              <h3 className="text-xs font-black text-main uppercase tracking-[0.2em]">{t('Critical Tasks')}</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {monthlyGuide.find(m => m.month === selectedGuideMonth)?.tasks.map((task: any, idx: number) => (
                                  <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-bg-main/50 border border-border-color/50 hover:border-accent-color/30 transition-all group">
                                      <div className="w-6 h-6 rounded-lg bg-accent-color/10 flex items-center justify-center text-accent-color shrink-0 group-hover:bg-accent-color group-hover:text-white transition-colors">
                                          <CheckCircle2 size={12} />
                                      </div>
                                      <span className="text-[11px] font-bold text-main leading-relaxed pt-0.5">{task.title}</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <div className="stihl-card p-4 rounded-2xl bg-accent-color text-white shadow-md relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full -z-0 blur-xl"></div>
                          <div className="relative z-10">
                              <div className="flex items-center gap-2 mb-3">
                                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                                      <Sprout size={16} />
                                  </div>
                                  <h3 className="text-xs font-black uppercase tracking-[0.2em]">{t('Pro Tip')}</h3>
                              </div>
                              <p className="text-xs font-medium leading-relaxed italic opacity-90">
                                  "{monthlyGuide.find(m => m.month === selectedGuideMonth)?.summary}"
                              </p>
                          </div>
                      </div>

                      <div className="stihl-card p-4 rounded-2xl bg-bg-card border border-border-color shadow-md">
                          <h3 className="text-[11px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2">{t('Garden Status')}</h3>
                          <div className="space-y-3">
                              <div className="flex justify-between items-center text-[11px] font-bold">
                                  <span className="text-text-secondary">{t('Vegetation Phase')}</span>
                                  <span className="text-main uppercase tracking-tighter">
                                      {selectedGuideMonth >= 2 && selectedGuideMonth <= 4 ? 'Explozie' : 
                                       selectedGuideMonth >= 5 && selectedGuideMonth <= 7 ? 'Maturitate' : 
                                       selectedGuideMonth >= 8 && selectedGuideMonth <= 10 ? 'Declin' : 'Repaus'}
                                  </span>
                              </div>
                              <div className="w-full h-1 bg-bg-main rounded-full overflow-hidden">
                                  <div 
                                      className="h-full bg-accent-color transition-all duration-1000" 
                                      style={{ width: `${((selectedGuideMonth + 1) / 12) * 100}%` }}
                                  ></div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};
