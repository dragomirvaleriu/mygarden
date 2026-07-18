import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gauge, Plus, Trash2, Droplets, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const IrrigationCalibration: React.FC = () => {
  const [readings, setReadings] = useState<number[]>([]);
  const [inputValue, setInputValue] = useState<string>('');

  const handleAddReading = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = parseFloat(inputValue);
    if (!isNaN(val) && val >= 0) {
      setReadings([...readings, val]);
      setInputValue('');
    }
  };

  const removeReading = (indexToRemove: number) => {
    setReadings(readings.filter((_, idx) => idx !== indexToRemove));
  };

  const calculateDU = () => {
    if (readings.length < 2) return null;
    
    // Sort array descending to get lowest quarter at the end, or ascending to get them at the beginning
    const sorted = [...readings].sort((a, b) => a - b);
    
    // Lowest 25% of readings
    const quarterCount = Math.max(1, Math.round(sorted.length * 0.25));
    const lowestQuarter = sorted.slice(0, quarterCount);
    
    const avgTotal = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const avgLowest = lowestQuarter.reduce((a, b) => a + b, 0) / lowestQuarter.length;
    
    if (avgTotal === 0) return 0;
    
    const du = (avgLowest / avgTotal) * 100;
    return du;
  };

  const duScore = calculateDU();

  const getScoreUI = (score: number) => {
    if (score >= 80) {
      return {
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'Excelent (Sistem eficient)',
        icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />
      };
    } else if (score >= 60) {
      return {
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'Acceptabil (Necesită ajustări)',
        icon: <AlertTriangle className="w-6 h-6 text-amber-500" />
      };
    } else {
      return {
        color: 'text-red-600',
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'Inacceptabil (Eficiență critică scăzută)',
        icon: <AlertTriangle className="w-6 h-6 text-red-500" />
      };
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-2xl mx-auto relative overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-6">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-inner">
          <Gauge className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-xl leading-tight">Calibrare Aspersoare (Testul paharelor)</h2>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">
            Măsoară uniformitatea irigării pentru a elimina zonele uscate.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        
        {/* Secțiunea 1: Input */}
        <section className="bg-gray-50 border border-gray-100 rounded-2xl p-5 shadow-inner">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-3">
            <Droplets className="w-4 h-4 text-blue-400" /> Adaugă citiri (ml) din pahare
          </label>
          
          <form onSubmit={handleAddReading} className="flex gap-3">
            <input 
              type="number" 
              step="0.1"
              min="0"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ex: 15"
              className="flex-1 bg-white border border-gray-200 rounded-xl py-3 px-4 text-gray-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button 
              type="submit"
              disabled={!inputValue}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 shadow-sm shrink-0"
            >
              <Plus className="w-5 h-5" /> Adaugă citire
            </button>
          </form>

          {/* Lista Citiri */}
          <div className="mt-6">
            <div className="flex flex-wrap gap-2">
              <AnimatePresence>
                {readings.map((val, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="bg-white border border-blue-100 rounded-lg py-1.5 px-3 flex items-center gap-2 shadow-sm"
                  >
                    <span className="text-blue-700 font-black">{val} <span className="text-xs text-blue-400 font-bold">ml</span></span>
                    <button 
                      onClick={() => removeReading(idx)}
                      className="text-gray-300 hover:text-red-500 transition ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {readings.length === 0 && (
                <p className="text-sm text-gray-400 font-medium italic py-2">Nu ai adăugat nicio citire încă. Introdu minim 2 citiri pentru a calcula DU.</p>
              )}
            </div>
          </div>
        </section>

        {/* Secțiunea 2: Rezultate DU */}
        {duScore !== null && (
          <motion.section 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Rezultat Uniformitate (DU)
            </h3>

            {(() => {
              const ui = getScoreUI(duScore);
              return (
                <div className={`border rounded-2xl p-6 ${ui.bg} ${ui.border}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Distribution Uniformity</span>
                    {ui.icon}
                  </div>
                  
                  <div className="flex items-end gap-3 mb-1">
                    <span className={`text-4xl font-black tracking-tighter ${ui.color}`}>
                      {duScore.toFixed(0)}%
                    </span>
                  </div>
                  
                  <p className={`text-sm font-bold mt-1 ${ui.color}`}>
                    {ui.text}
                  </p>

                  <div className="w-full bg-white/50 h-2 rounded-full mt-4 overflow-hidden border border-white/20">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, duScore))}%` }}
                      transition={{ duration: 1, type: 'spring' }}
                      className={`h-full rounded-full ${ui.color.replace('text-', 'bg-')}`}
                    ></motion.div>
                  </div>
                </div>
              );
            })()}

            <p className="text-xs text-gray-600 font-medium mt-4 flex items-start gap-2 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>
                <strong className="text-blue-900 block mb-0.5">Recomandare Practică:</strong>
                Dacă DU este sub 70%, verifică duzele înfundate, presiunea scăzută pe ultimele aspersoare din circuit, sau dacă acoperirea este corectă (head-to-head coverage).
              </span>
            </p>
          </motion.section>
        )}

      </div>
    </div>
  );
};

export default IrrigationCalibration;
