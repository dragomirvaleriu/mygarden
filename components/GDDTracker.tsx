import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThermometerSun, RefreshCw, Plus, Trash2, ChevronRight, CalendarDays, Clock } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';

interface GDDProduct {
  id: string;
  name: string;
  targetGdd: number;
  currentGdd: number;
  lastApplied: Date;
  baseTemp: number;
  color: string;
}

const DEFAULT_PRODUCTS: GDDProduct[] = [
  { id: '1', name: 'PrimoMaxx (Inhibitor creștere)', targetGdd: 300, currentGdd: 180, lastApplied: new Date(Date.now() - 7 * 86400000), baseTemp: 10, color: 'emerald' },
  { id: '2', name: 'Talstar (Insecticid)',           targetGdd: 450, currentGdd: 320, lastApplied: new Date(Date.now() - 12 * 86400000), baseTemp: 10, color: 'rose' },
  { id: '3', name: 'Headway G (Fungicid)',            targetGdd: 250, currentGdd: 200, lastApplied: new Date(Date.now() - 5 * 86400000), baseTemp: 5,  color: 'violet' },
];

const COLOR_MAP: Record<string, { bar: string; badge: string; text: string; bg: string; border: string; ring: string }> = {
  emerald: { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: 'shadow-emerald-500/20' },
  rose:    { bar: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700',       text: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200',    ring: 'shadow-rose-500/20'    },
  violet:  { bar: 'bg-violet-500',  badge: 'bg-violet-100 text-violet-700',   text: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200',  ring: 'shadow-violet-500/20'  },
  amber:   { bar: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700',     text: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   ring: 'shadow-amber-500/20'   },
  blue:    { bar: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700',       text: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    ring: 'shadow-blue-500/20'    },
};

// Estimare simplificată: GDD/zi ≈ (maxT + minT)/2 - baseTemp
// Media simulată: +8 GDD/zi pe sezon cald (iulie)
const AVG_GDD_PER_DAY = 8;

const GDDTracker: React.FC = () => {
  const [totalGdd] = useState<number>(450);
  const [products, setProducts] = useState<GDDProduct[]>(DEFAULT_PRODUCTS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', targetGdd: '300', baseTemp: '10', color: 'blue' });

  const resetCycle = (id: string) => {
    setProducts(prev => prev.map(p =>
      p.id === id ? { ...p, currentGdd: 0, lastApplied: new Date() } : p
    ));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const addProduct = () => {
    if (!newProduct.name.trim()) return;
    const p: GDDProduct = {
      id: Date.now().toString(),
      name: newProduct.name,
      targetGdd: parseInt(newProduct.targetGdd) || 300,
      currentGdd: 0,
      lastApplied: new Date(),
      baseTemp: parseInt(newProduct.baseTemp) || 10,
      color: newProduct.color,
    };
    setProducts(prev => [...prev, p]);
    setNewProduct({ name: '', targetGdd: '300', baseTemp: '10', color: 'blue' });
    setShowAddForm(false);
  };

  const getEstimatedDate = (product: GDDProduct): Date => {
    const gddLeft = Math.max(0, product.targetGdd - product.currentGdd);
    const daysLeft = Math.ceil(gddLeft / AVG_GDD_PER_DAY);
    return addDays(new Date(), daysLeft);
  };

  const getDaysLeft = (product: GDDProduct): number => {
    const gddLeft = Math.max(0, product.targetGdd - product.currentGdd);
    return Math.ceil(gddLeft / AVG_GDD_PER_DAY);
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-lg mx-auto relative overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <ThermometerSun className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800 text-lg leading-tight">GDD Tracker</h2>
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Acumulare Termică • Reaplicare Produse</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 hover:bg-[#2D8C3C] hover:text-white hover:border-[#2D8C3C] text-gray-500 flex items-center justify-center transition"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Total GDD Sezon */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/25 relative overflow-hidden mb-6">
        <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <p className="text-emerald-100 font-medium text-xs uppercase tracking-wider mb-1">GDD Total Sezon Curent</p>
            <h3 className="text-5xl font-black tracking-tight">{totalGdd}</h3>
            <p className="text-emerald-200 text-xs mt-1">acumulați din 1 Ianuarie</p>
          </div>
          <div className="text-right">
            <span className="px-3 py-1.5 bg-black/20 backdrop-blur-md rounded-xl text-[10px] font-black uppercase tracking-wider text-emerald-50 block mb-2">
              Bază: 10°C
            </span>
            <span className="text-emerald-100 text-xs font-bold">~{AVG_GDD_PER_DAY} GDD/zi azi</span>
          </div>
        </div>
      </div>

      {/* Add Product Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-5"
          >
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-black text-gray-600 uppercase tracking-wider">Adaugă Produs cu Target GDD</p>
              <input
                value={newProduct.name}
                onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                placeholder="Ex: PrimoMaxx, Scout, Headway G..."
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-[#2D8C3C] outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Target GDD</label>
                  <input type="number" value={newProduct.targetGdd} onChange={e => setNewProduct({ ...newProduct, targetGdd: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 font-bold text-gray-800 text-sm focus:ring-2 focus:ring-[#2D8C3C] outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Temp. Bază (°C)</label>
                  <input type="number" value={newProduct.baseTemp} onChange={e => setNewProduct({ ...newProduct, baseTemp: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 font-bold text-gray-800 text-sm focus:ring-2 focus:ring-[#2D8C3C] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Culoare Card</label>
                <div className="flex gap-2">
                  {Object.keys(COLOR_MAP).map(c => (
                    <button key={c} onClick={() => setNewProduct({ ...newProduct, color: c })}
                      className={`w-7 h-7 rounded-full ${COLOR_MAP[c].bar} transition ${newProduct.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'opacity-60 hover:opacity-100'}`} />
                  ))}
                </div>
              </div>
              <button onClick={addProduct} className="w-full bg-[#2D8C3C] text-white font-bold py-3 rounded-xl text-sm transition hover:bg-green-800 flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Adaugă Produs
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Products List */}
      <div className="space-y-4">
        {products.map((product, i) => {
          const pct = Math.min(100, Math.round((product.currentGdd / product.targetGdd) * 100));
          const isUrgent = pct >= 85;
          const isReady = pct >= 100;
          const daysLeft = getDaysLeft(product);
          const estimatedDate = getEstimatedDate(product);
          const c = COLOR_MAP[product.color] || COLOR_MAP.blue;

          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`${c.bg} border ${c.border} rounded-2xl p-5 shadow-sm hover:shadow-md transition`}
            >
              {/* Product Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 text-sm leading-tight">{product.name}</h4>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                    Bază: {product.baseTemp}°C • Aplicat: {format(product.lastApplied, 'dd MMM', { locale: ro })}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {isReady && (
                    <span className="px-2.5 py-1 bg-red-500 text-white text-[9px] font-black uppercase tracking-wider rounded-lg animate-pulse">
                      REAPLICĂ!
                    </span>
                  )}
                  {isUrgent && !isReady && (
                    <span className={`px-2.5 py-1 ${c.badge} text-[9px] font-black uppercase tracking-wider rounded-lg`}>
                      Curând
                    </span>
                  )}
                  <button onClick={() => deleteProduct(product.id)}
                    className="w-7 h-7 rounded-lg bg-white/60 hover:bg-red-50 hover:text-red-500 text-gray-400 flex items-center justify-center transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* GDD Progress */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Ciclu Curent</span>
                <span className={`text-sm font-black ${c.text}`}>
                  {product.currentGdd} <span className="text-xs font-medium text-gray-400">/ {product.targetGdd} GDD</span>
                  <span className="ml-2 text-[11px]">({pct}%)</span>
                </span>
              </div>
              <div className="h-3 w-full bg-white/60 rounded-full overflow-hidden border border-white/80 mb-4">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: i * 0.1 }}
                  className={`h-full rounded-full ${isReady ? 'bg-red-500' : isUrgent ? 'bg-amber-500' : c.bar} relative`}
                >
                  <div className="absolute inset-0 bg-white/20" />
                </motion.div>
              </div>

              {/* Estimated Date */}
              {!isReady && (
                <div className="flex items-center gap-2 mb-4 bg-white/50 rounded-xl px-3 py-2 border border-white/80">
                  <CalendarDays className={`w-4 h-4 ${c.text} shrink-0`} />
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Estimat: Reaplică pe</span>
                    <span className={`text-sm font-black ${c.text}`}>
                      {format(estimatedDate, 'EEEE, dd MMMM', { locale: ro })}
                    </span>
                  </div>
                  <span className="ml-auto flex items-center gap-1 text-xs font-black text-gray-500">
                    <Clock className="w-3 h-3" /> ~{daysLeft}z
                  </span>
                </div>
              )}
              {isReady && (
                <div className="flex items-center gap-2 mb-4 bg-red-50 rounded-xl px-3 py-2 border border-red-100">
                  <span className="text-sm">⚠️</span>
                  <span className="text-xs font-black text-red-600">Target GDD atins! Reaplicare necesară azi.</span>
                </div>
              )}

              {/* Reset Button */}
              <button
                onClick={() => resetCycle(product.id)}
                className="w-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-sm active:scale-[0.98] text-sm"
              >
                <RefreshCw className="w-4 h-4 text-gray-400" />
                Resetează Ciclu (Tratament Reaplicat)
              </button>
            </motion.div>
          );
        })}

        {products.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <ThermometerSun className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="font-bold text-gray-500">Niciun produs urmărit</p>
            <p className="text-sm mt-1">Apasă + pentru a adăuga primul produs</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GDDTracker;
