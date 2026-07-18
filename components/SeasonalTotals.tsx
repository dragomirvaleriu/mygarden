import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, MapPin, Target, CalendarDays } from 'lucide-react';

// ─── CULORI NPK GLOBALE (identice cu NPKCalculator) ────────────────────────
const NPK = {
  N: { dot: 'bg-violet-500', text: 'text-violet-600', bar: 'bg-violet-500', track: 'bg-violet-100', border: 'border-violet-200', inputBorder: 'border-violet-100', ring: 'focus:ring-violet-500' },
  P: { dot: 'bg-amber-500',  text: 'text-amber-600',  bar: 'bg-amber-500',  track: 'bg-amber-100',  border: 'border-amber-200',  inputBorder: 'border-amber-100',  ring: 'focus:ring-amber-500'  },
  K: { dot: 'bg-blue-500',   text: 'text-blue-600',   bar: 'bg-blue-500',   track: 'bg-blue-100',   border: 'border-blue-200',   inputBorder: 'border-blue-100',   ring: 'focus:ring-blue-500'   },
};

const MONTHS_SHORT = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec'];

interface ZoneTotal { n: number; p: number; k: number; }

const SeasonalTotals: React.FC = () => {
  const [savedZones, setSavedZones] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [viewMode, setViewMode] = useState<'season' | 'monthly'>('season');
  const [target, setTarget] = useState({ n: 20, p: 5, k: 15 });

  // Date simulate (în viitor, conectat la logService)
  const [simulatedTotals] = useState<Record<string, ZoneTotal>>({
    '1': { n: 8, p: 2, k: 5 },
    '2': { n: 12, p: 3, k: 8 },
    'Gazon Față': { n: 8, p: 2, k: 5 },
    'Curte Spate': { n: 15, p: 4, k: 10 },
  });

  // Date lunare simulate (g/mp per lună)
  const [monthlyData] = useState<Record<string, Array<ZoneTotal>>>({
    'Gazon Față': [
      { n:0, p:0, k:0 }, { n:0, p:0, k:0 }, { n:3, p:1, k:0 }, { n:0, p:0, k:2 },
      { n:3, p:1, k:0 }, { n:0, p:0, k:2 }, { n:2, p:0, k:1 }, { n:0, p:0, k:0 },
      { n:0, p:0, k:0 }, { n:0, p:0, k:0 }, { n:0, p:0, k:0 }, { n:0, p:0, k:0 }
    ],
    'Curte Spate': [
      { n:0, p:0, k:0 }, { n:0, p:0, k:0 }, { n:5, p:2, k:0 }, { n:0, p:0, k:3 },
      { n:5, p:1, k:0 }, { n:0, p:0, k:3 }, { n:5, p:0, k:4 }, { n:0, p:0, k:0 },
      { n:0, p:0, k:0 }, { n:0, p:0, k:0 }, { n:0, p:0, k:0 }, { n:0, p:0, k:0 }
    ],
  });

  useEffect(() => {
    const zones = localStorage.getItem('landscape_pf_zones');
    if (zones) {
      const parsed = JSON.parse(zones);
      setSavedZones(parsed);
      if (parsed.length > 0) setSelectedZone(parsed[0].id.toString());
    } else {
      const fallback = [{ id: 'Gazon Față', name: 'Gazon Față' }, { id: 'Curte Spate', name: 'Curte Spate' }];
      setSavedZones(fallback);
      setSelectedZone('Gazon Față');
    }
  }, []);

  const currentTotal = simulatedTotals[selectedZone] || { n: 0, p: 0, k: 0 };
  const monthlyForZone = monthlyData[selectedZone] || Array(12).fill({ n: 0, p: 0, k: 0 });
  const currentMonthIdx = new Date().getMonth();

  const getPercent = (current: number, targetValue: number) =>
    targetValue <= 0 ? 0 : Math.min(100, Math.round((current / targetValue) * 100));

  const nutrients: Array<{ key: 'N' | 'P' | 'K'; label: string; current: number; targetVal: number }> = [
    { key: 'N', label: 'Nitrogen (N)', current: currentTotal.n, targetVal: target.n },
    { key: 'P', label: 'Fosfor (P)',   current: currentTotal.p, targetVal: target.p },
    { key: 'K', label: 'Potasiu (K)', current: currentTotal.k, targetVal: target.k },
  ];

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-2xl mx-auto relative overflow-hidden">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-gray-100 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gray-50 text-gray-700 flex items-center justify-center border border-gray-200">
            <BarChart3 className="w-6 h-6 text-[#2D8C3C]" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-xl leading-tight">Total Nutrienți Sezonieri</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Target Anual vs. Aplicat</p>
          </div>
        </div>
        {/* View Toggle */}
        <div className="flex bg-gray-50 border border-gray-100 rounded-xl p-1 shrink-0">
          <button onClick={() => setViewMode('season')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'season' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            Sezon Total
          </button>
          <button onClick={() => setViewMode('monthly')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${viewMode === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            <CalendarDays className="w-3 h-3" /> Lunar
          </button>
        </div>
      </div>

      <div className="space-y-8">

        {/* Selector Zonă */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-2">
            <MapPin className="w-3.5 h-3.5" /> Alege Zona
          </label>
          <select value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 px-4 text-gray-800 font-semibold focus:bg-white focus:ring-2 focus:ring-[#2D8C3C] outline-none transition shadow-inner appearance-none">
            {savedZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>

        {/* Target Anual */}
        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 shadow-inner">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5 mb-3">
            <Target className="w-3.5 h-3.5" /> Target Anual Dorit (g / mp)
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['N', 'P', 'K'] as const).map(key => (
              <div key={key} className="relative">
                <span className={`absolute left-3 top-2.5 text-[10px] font-black ${NPK[key].text}`}>{key}</span>
                <input type="number"
                  value={target[key.toLowerCase() as 'n' | 'p' | 'k']}
                  onChange={(e) => setTarget({ ...target, [key.toLowerCase()]: parseFloat(e.target.value) || 0 })}
                  className={`w-full bg-white border ${NPK[key].inputBorder} rounded-xl py-2 pl-7 pr-3 font-bold text-gray-800 focus:ring-2 ${NPK[key].ring} outline-none`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ─── SEASON VIEW ─────────────────────────────────────────────── */}
        {viewMode === 'season' && (
          <div className="space-y-5">
            {nutrients.map(({ key, label, current, targetVal }, idx) => {
              const pct = getPercent(current, targetVal);
              return (
                <div key={key}>
                  <div className="flex justify-between items-end mb-2">
                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${NPK[key].dot}`} /> {label}
                    </h3>
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                      <span className={NPK[key].text}>{current}</span> / {targetVal} g/mp
                      <span className="ml-2 text-gray-400">({pct}%)</span>
                    </p>
                  </div>
                  <div className={`h-4 w-full ${NPK[key].track} rounded-full overflow-hidden border ${NPK[key].border} shadow-inner`}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: idx * 0.15 }}
                      className={`h-full ${NPK[key].bar} relative`}
                    >
                      <div className="absolute inset-0 bg-white/20 w-full" />
                    </motion.div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── MONTHLY VIEW ─────────────────────────────────────────────── */}
        {viewMode === 'monthly' && (
          <div className="space-y-6">
            {nutrients.map(({ key, label }) => (
              <div key={key}>
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5 mb-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${NPK[key].dot}`} /> {label}
                </h3>
                <div className="flex gap-1">
                  {MONTHS_SHORT.map((month, i) => {
                    const val = (monthlyForZone[i] as any)?.[key.toLowerCase()] || 0;
                    const maxVal = Math.max(...monthlyForZone.map((m: any) => m[key.toLowerCase()] || 0), 1);
                    const barHeight = val > 0 ? Math.max(8, Math.round((val / maxVal) * 48)) : 4;
                    const isCurrentMonth = i === currentMonthIdx;
                    return (
                      <div key={month} className="flex-1 flex flex-col items-center gap-1">
                        <div className="h-12 flex items-end w-full">
                          <div
                            className={`w-full rounded-sm transition-all ${val > 0 ? NPK[key].bar : 'bg-gray-100'} ${isCurrentMonth ? 'ring-2 ring-offset-1 ' + NPK[key].border : ''}`}
                            style={{ height: barHeight }}
                            title={`${month}: ${val}g/mp`}
                          />
                        </div>
                        <span className={`text-[9px] font-bold ${isCurrentMonth ? NPK[key].text : 'text-gray-400'}`}>{month}</span>
                        {val > 0 && <span className={`text-[9px] font-black ${NPK[key].text}`}>{val}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default SeasonalTotals;
