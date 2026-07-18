import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TwoStrokeCalculator: React.FC = () => {
  const [ratio, setRatio] = useState<number>(50);
  const [gasLiters, setGasLiters] = useState<string>('');

  const ratios = [
    { label: '50:1', value: 50 },
    { label: '40:1', value: 40 },
    { label: '32:1', value: 32 },
    { label: '25:1', value: 25 },
    { label: '100:1', value: 100 },
  ];

  const calculateOil = () => {
    const liters = parseFloat(gasLiters);
    if (isNaN(liters) || liters <= 0) return null;
    
    // Logic: (Liters * 1000) / Ratio = Oil in mL
    const oilMl = (liters * 1000) / ratio;
    return oilMl;
  };

  const result = calculateOil();

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-md mx-auto relative overflow-hidden">
      <div className="space-y-6">
        
        {/* Titlu */}
        <div className="text-center mb-2">
          <h2 className="font-bold text-gray-800 text-lg">Calculator Amestec 2T</h2>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Proporția de ulei pentru motoare în 2 timpi
          </p>
        </div>

        {/* Ratio Selector */}
        <div>
          <h3 className="font-bold text-gray-800 text-sm mb-3">Raport de Amestec (Benzină : Ulei)</h3>
          <div className="flex flex-wrap gap-2">
            {ratios.map((r) => (
              <button
                key={r.value}
                onClick={() => setRatio(r.value)}
                className={`flex-1 min-w-[3.5rem] py-2 rounded-xl text-sm font-bold transition flex items-center justify-center ${
                  ratio === r.value 
                    ? 'bg-[#2D8C3C] text-white shadow-md' 
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gas Input */}
        <div>
          <h3 className="font-bold text-gray-800 text-sm mb-2">Cantitate Benzină (Litri)</h3>
          <div className="relative">
            <input 
              type="number" 
              value={gasLiters} 
              onChange={(e) => setGasLiters(e.target.value)} 
              placeholder="ex: 5"
              className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 px-4 pr-16 text-gray-800 font-semibold placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#2D8C3C] focus:border-transparent outline-none transition shadow-inner"
            />
            <span className="absolute right-4 top-3.5 text-gray-400 text-sm font-bold bg-gray-50 pl-2">Litri</span>
          </div>
        </div>

        {/* Rezultat Animatie */}
        <AnimatePresence>
          {result !== null && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: 10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-amber-50/80 border border-amber-200/50 rounded-2xl p-5 mt-4 text-center shadow-inner backdrop-blur-sm">
                <p className="text-gray-800 font-medium text-[15px] leading-relaxed">
                  Pentru <strong className="text-gray-900">{gasLiters} Litri</strong> de benzină la un raport de <strong className="text-gray-900">{ratio}:1</strong>, adaugă:
                </p>
                <strong className="text-3xl text-amber-600 block my-2">{result.toFixed(0)} mL</strong>
                <p className="text-[11px] text-amber-700/80 font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Ulei 2T
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default TwoStrokeCalculator;
