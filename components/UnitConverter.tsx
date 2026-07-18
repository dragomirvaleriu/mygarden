import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, Map, Beaker, ArrowRightLeft, Repeat } from 'lucide-react';

type Category = 'weight' | 'area' | 'volume';

interface Conversion {
  id: string;
  labelFormat: [string, string]; // [fromLabel, toLabel]
  rate: number; // rate from -> to
}

const CONVERSIONS: Record<Category, Conversion[]> = {
  weight: [
    { id: 'lbs_kg', labelFormat: ['Pounds (lbs)', 'Kilograme (kg)'], rate: 0.453592 },
    { id: 'oz_g', labelFormat: ['Ounces (oz)', 'Grame (g)'], rate: 28.3495 }
  ],
  area: [
    { id: 'sqft_sqm', labelFormat: ['Square Feet (sq ft)', 'Metri Pătrați (mp)'], rate: 0.092903 },
    { id: 'ac_ha', labelFormat: ['Acres (ac)', 'Hectare (ha)'], rate: 0.404686 },
    { id: 'ac_sqm', labelFormat: ['Acres (ac)', 'Metri Pătrați (mp)'], rate: 4046.86 }
  ],
  volume: [
    { id: 'gal_l', labelFormat: ['US Gallons (gal)', 'Litri (L)'], rate: 3.78541 },
    { id: 'floz_ml', labelFormat: ['Fluid Ounces (fl oz)', 'Mililitri (ml)'], rate: 29.5735 }
  ]
};

const UnitConverter: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<Category>('weight');
  const [selectedConvId, setSelectedConvId] = useState<string>(CONVERSIONS['weight'][0].id);
  const [inputValue, setInputValue] = useState<string>('1');
  const [isReversed, setIsReversed] = useState<boolean>(false);

  // Când schimbăm categoria, setăm conversia default
  const handleCategoryChange = (cat: Category) => {
    setActiveCategory(cat);
    setSelectedConvId(CONVERSIONS[cat][0].id);
    setIsReversed(false);
  };

  const currentConvList = CONVERSIONS[activeCategory];
  const activeConversion = currentConvList.find(c => c.id === selectedConvId) || currentConvList[0];

  const handleSwap = () => {
    setIsReversed(!isReversed);
  };

  const calculateResult = () => {
    const val = parseFloat(inputValue);
    if (isNaN(val)) return '0.00';
    
    if (isReversed) {
      // to -> from
      return (val / activeConversion.rate).toFixed(4);
    } else {
      // from -> to
      return (val * activeConversion.rate).toFixed(4);
    }
  };

  const fromLabel = isReversed ? activeConversion.labelFormat[1] : activeConversion.labelFormat[0];
  const toLabel = isReversed ? activeConversion.labelFormat[0] : activeConversion.labelFormat[1];

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-2xl mx-auto relative overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-inner">
          <ArrowRightLeft className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-xl leading-tight">Convertor Unități</h2>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">
            Agronomie & Peisagistică
          </p>
        </div>
      </div>

      <div className="space-y-8">
        
        {/* Tabs Categorii */}
        <div className="flex bg-gray-50 border border-gray-100 rounded-2xl p-1.5 shadow-inner overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => handleCategoryChange('weight')}
            className={`flex-1 min-w-[100px] py-2.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${activeCategory === 'weight' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
          >
            <Scale className="w-4 h-4" /> Greutate
          </button>
          <button 
            onClick={() => handleCategoryChange('area')}
            className={`flex-1 min-w-[100px] py-2.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${activeCategory === 'area' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
          >
            <Map className="w-4 h-4" /> Suprafață
          </button>
          <button 
            onClick={() => handleCategoryChange('volume')}
            className={`flex-1 min-w-[100px] py-2.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${activeCategory === 'volume' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
          >
            <Beaker className="w-4 h-4" /> Volum
          </button>
        </div>

        {/* Formular de conversie */}
        <div className="bg-gray-50 border border-gray-100 rounded-3xl p-6 relative">
          
          <div className="mb-6">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-2">
              Tip Conversie
            </label>
            <select 
              value={selectedConvId}
              onChange={(e) => setSelectedConvId(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-gray-800 font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none shadow-sm"
            >
              {currentConvList.map(c => (
                <option key={c.id} value={c.id}>
                  {isReversed ? `${c.labelFormat[1]} în ${c.labelFormat[0]}` : `${c.labelFormat[0]} în ${c.labelFormat[1]}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4">
            {/* Input Din */}
            <div className="flex-1 w-full relative">
              <label className="absolute -top-2.5 left-4 bg-white px-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 rounded">
                Din
              </label>
              <input 
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-2xl py-4 px-4 text-gray-900 font-black text-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              />
              <span className="absolute right-4 top-4 text-sm font-bold text-gray-400">{fromLabel.split(' (')[1]?.replace(')', '')}</span>
            </div>

            {/* Swap Button */}
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleSwap}
              className="w-12 h-12 bg-white border border-gray-200 rounded-full flex items-center justify-center text-indigo-600 shadow-sm shrink-0 z-10"
              title="Schimbă direcția"
            >
              <Repeat className="w-5 h-5" />
            </motion.button>

            {/* Result În */}
            <div className="flex-1 w-full relative">
              <label className="absolute -top-2.5 left-4 bg-indigo-50 px-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400 rounded">
                În
              </label>
              <div className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl py-4 px-4 shadow-inner flex items-center justify-between">
                <span className="text-2xl font-black text-indigo-600 truncate">{calculateResult()}</span>
                <span className="text-sm font-bold text-indigo-400 ml-2">{toLabel.split(' (')[1]?.replace(')', '')}</span>
              </div>
            </div>
          </div>
          
        </div>

        {/* Mesaj informativ subtil */}
        <p className="text-xs text-center text-gray-400 font-medium">
          Valorile sunt aproximate la 4 zecimale pentru precizie optimă în aplicările agrochimice.
        </p>

      </div>
    </div>
  );
};

export default UnitConverter;
