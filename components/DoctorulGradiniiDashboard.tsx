import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SmartTroubleshooter } from './SmartTroubleshooter';
import { AlertTriangle, BookOpen, Zap } from 'lucide-react';
import { Page } from '../src/types';

interface Props {
  onNavigate?: (page: Page) => void;
}

export const DoctorulGradiniiDashboard: React.FC<Props> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'guide' | 'sos'>('diagnosis');

  const tabs = [
    {
      id: 'diagnosis' as const,
      label: 'Sistem Expert',
      icon: AlertTriangle,
      description: 'Diagnosticează probleme',
    },
    {
      id: 'guide' as const,
      label: 'Ghidare Pas cu Pas',
      icon: BookOpen,
      description: 'Asistent Noua Peluză',
    },
    {
      id: 'sos' as const,
      label: 'Diagnostic SOS',
      icon: Zap,
      description: 'Intervenție imediată',
    },
  ];

  return (
    <div className="stihl-card bg-bg-card border border-border-color rounded-2xl shadow-lg relative overflow-hidden flex flex-col min-h-[450px]">
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent-color/5 rounded-bl-full -z-10 blur-3xl transition-colors pointer-events-none"></div>

      {/* Header with Tabs */}
      <div className="flex-shrink-0 p-6 border-b border-border-color/50 z-10 bg-bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-color/10 flex items-center justify-center text-accent-color">
              <AlertTriangle size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-main">Doctorul Grădinii</h3>
              <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest mt-0.5">Suport Complet</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 pb-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-accent-color text-white shadow-lg shadow-accent-color/30'
                    : 'bg-bg-main border border-border-color text-text-secondary hover:border-accent-color/30'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 flex flex-col justify-center relative z-10">
        {activeTab === 'diagnosis' && (
          <SmartTroubleshooter onNavigate={onNavigate} />
        )}

        {activeTab === 'guide' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🌱</div>
              <h2 className="text-2xl font-black text-main mb-2">Asistent Noua Peluză</h2>
              <p className="text-sm text-text-secondary">Ghidare pas cu pas pentru grădina ta</p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-bg-main rounded-xl border border-border-color/50">
                <h4 className="text-sm font-black text-main mb-2">📋 Pasul 1: Analiza Solului</h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Testează pH-ul și textura solului. Pentru gazone noi, iau o mostră de sol de la 15-20cm adâncime din 5-6 puncte diferite ale grădinii. Mix și trimite la laborator, sau folosește kit-ul de test rapid din magazin.
                </p>
              </div>

              <div className="p-4 bg-bg-main rounded-xl border border-border-color/50">
                <h4 className="text-sm font-black text-main mb-2">🌱 Pasul 2: Pregătirea Terenului</h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Nivelează terenul, elimină buruienile și pietrele. Dacă solul e prea acid (pH &lt; 6), adaugă var. Dacă e alcalin (pH &gt; 7.5), adaugă sulfat de fier sau compost de turbă.
                </p>
              </div>

              <div className="p-4 bg-bg-main rounded-xl border border-border-color/50">
                <h4 className="text-sm font-black text-main mb-2">💧 Pasul 3: Înflorire și Îngrijire</h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  După semănare, udă frecvent (dar ușor) timp de 4-6 săptămâni, până când iarba atinge 10cm. Apoi schimbă la o programare mai rar și mai abundentă.
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate?.(Page.Academy)}
              className="w-full mt-4 py-3 bg-accent-color/10 border border-accent-color/30 text-accent-color rounded-xl text-xs font-black uppercase tracking-widest hover:bg-accent-color hover:text-white transition-all"
            >
              Citeşte Ghidul Complet
            </button>
          </div>
        )}

        {activeTab === 'sos' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🆘</div>
              <h2 className="text-2xl font-black text-main mb-2">Diagnostic SOS</h2>
              <p className="text-sm text-text-secondary">Pentru probleme urgente</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                <p className="font-bold text-red-600 dark:text-red-400 mb-2">🔴 Gazon galben peste noapte?</p>
                <p className="text-xs text-text-secondary">Probabil Brown Patch (Rhizoctonia). Taie floarea, aerisește, și reduce umiditatea nocturnă. Aplică fungicid dacă se răspândește.</p>
              </div>

              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                <p className="font-bold text-red-600 dark:text-red-400 mb-2">🌊 Bălți cu apă și muşchi?</p>
                <p className="text-xs text-text-secondary">Sol compactat. Fă aerare de urgență cu preducele și top-dressing cu nisip. Apoi revizuiește irigarea.</p>
              </div>

              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                <p className="font-bold text-red-600 dark:text-red-400 mb-2">🚗 Daunatori subterani?</p>
                <p className="text-xs text-text-secondary">Cârtițe sau viermii albi. Trateaza cu insecticide de sol, iar pentru cârtițe, foloseşte capcane mecanice pe galeriile active.</p>
              </div>
            </div>

            <button
              onClick={() => onNavigate?.(Page.Academy)}
              className="w-full mt-4 py-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
            >
              Diagnosticează Acum
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
