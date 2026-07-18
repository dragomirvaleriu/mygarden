import React, { useState } from 'react';
import { Beaker, Droplets, Info, Calculator, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Common products and their standard dosages (per 10L of water)
const PRODUCTS = [
  { id: 'champ77wg', name: 'Champ 77 WG', dosagePer10L: 20, unit: 'g', type: 'Fungicid' },
  { id: 'kupferol', name: 'Kupferol', dosagePer10L: 40, unit: 'ml', type: 'Fungicid' },
  { id: 'alcupral', name: 'Alcupral 50 PU', dosagePer10L: 30, unit: 'g', type: 'Fungicid' },
  { id: 'bordeaux', name: 'Zeamă Bordeleză', dosagePer10L: 50, unit: 'g', type: 'Fungicid' },
  { id: 'mospilan', name: 'Mospilan 20 SG', dosagePer10L: 3, unit: 'g', type: 'Insecticid' },
  { id: 'karate', name: 'Karate Zeon', dosagePer10L: 2, unit: 'ml', type: 'Insecticid' },
  { id: 'cropmax', name: 'Cropmax (Foliar)', dosagePer10L: 20, unit: 'ml', type: 'Îngrășământ' },
];

export const TreatmentCalculator: React.FC = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [pumpLiters, setPumpLiters] = useState<number>(10);
  const [selectedProductId, setSelectedProductId] = useState<string>(PRODUCTS[0].id);

  const selectedProduct = PRODUCTS.find(p => p.id === selectedProductId) || PRODUCTS[0];

  // Calculate required amount based on the pump size (liters)
  const requiredAmount = (selectedProduct.dosagePer10L / 10) * pumpLiters;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 md:bottom-6 z-50 flex items-center justify-center w-14 h-14 bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-500/30 hover:scale-110 transition-transform duration-300 group"
      >
        <Beaker size={24} />
        <span className="absolute right-full mr-4 bg-bg-card border border-border-color text-main text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-sm">
          Calculator Dozaj
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 w-[calc(100%-2rem)] sm:w-full sm:max-w-sm animate-in slide-in-from-bottom-8 duration-300">
      <div className="bg-bg-card border border-border-color shadow-2xl rounded-3xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -z-10 blur-3xl"></div>
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-color/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Calculator size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-main uppercase tracking-tighter">Calculator Dozaj</h3>
              <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest">Tratamente Horticole</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 flex items-center justify-center bg-bg-main rounded-xl hover:bg-red-500 hover:text-white transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Pump Liters */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1 flex items-center gap-1.5">
              <Droplets size={12} /> Volum Pompă (Litri)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="0.5"
                value={pumpLiters}
                onChange={(e) => setPumpLiters(parseFloat(e.target.value) || 0)}
                className="w-full bg-bg-main border border-border-color rounded-2xl px-4 py-3 text-sm font-bold text-main outline-none focus:border-emerald-500 transition-all shadow-inner"
              />
              <div className="px-4 py-3 bg-bg-main border border-border-color rounded-2xl text-sm font-black text-text-secondary">
                L
              </div>
            </div>
          </div>

          {/* Product Select */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1 flex items-center gap-1.5">
              <Beaker size={12} /> Produs
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-bg-main border border-border-color rounded-2xl px-4 py-3 text-sm font-bold text-main outline-none focus:border-emerald-500 transition-all shadow-inner appearance-none"
            >
              {PRODUCTS.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type})
                </option>
              ))}
            </select>
          </div>

          {/* Result */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 text-center relative overflow-hidden mt-2">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Cantitate Necesară</p>
            <div className="flex items-end justify-center gap-1">
              <span className="text-3xl font-black text-emerald-500 tracking-tighter">
                {requiredAmount.toFixed(1).replace(/\.0$/, '')}
              </span>
              <span className="text-sm font-black text-emerald-600 mb-1">{selectedProduct.unit}</span>
            </div>
            <p className="text-xs font-bold text-main mt-2">
              {selectedProduct.name}
            </p>
          </div>

          <div className="flex items-start gap-2 bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
            <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-blue-600 font-bold leading-relaxed">
              Aceasta este o recomandare standard (pt. dozaj de {selectedProduct.dosagePer10L}{selectedProduct.unit} / 10L). Citiți întotdeauna eticheta produsului înainte de aplicare!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
