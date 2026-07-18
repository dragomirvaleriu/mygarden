import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, Leaf, Droplets, CheckCircle2, ArrowRight } from 'lucide-react';
import { inventoryService, InventoryItem } from '../services/pf/inventoryService';
import { gardenService, GardenZone } from '../services/pf/gardenService';
import { logService } from '../services/pf/logService';
import { auth } from '../services/firebase';
import toast from 'react-hot-toast';

interface CalculatorResult {
  totalRequired: number;
  activeN: number;
  activeP: number;
  activeK: number;
  cost?: number;
  productId?: string;
  productName?: string;
  unit?: string;
  zoneName?: string;
  area: number;
}

// ─── CULORI NPK GLOBALE ───────────────────────────────────────────────────────
const NPK_COLORS = {
  N: { dot: 'bg-violet-500', text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', ring: 'focus:ring-violet-500', label: 'bg-violet-500' },
  P: { dot: 'bg-amber-500',  text: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  ring: 'focus:ring-amber-500',  label: 'bg-amber-500'  },
  K: { dot: 'bg-blue-500',   text: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   ring: 'focus:ring-blue-500',   label: 'bg-blue-500'   },
};

const NPKCalculator: React.FC = () => {
  const [fertilizerType, setFertilizerType] = useState<'granular' | 'liquid'>('granular');
  const [npk, setNpk] = useState({ n: '', p: '', k: '' });
  const [lawnArea, setLawnArea] = useState<string>('');
  const [targetN, setTargetN] = useState<string>('');
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [savedZones, setSavedZones] = useState<GardenZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [isManualArea, setIsManualArea] = useState<boolean>(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isInventorySource, setIsInventorySource] = useState<boolean>(true);
  const uid = auth.currentUser?.uid || 'pf_anonymous_user';

  useEffect(() => {
    const unsubZones = gardenService.subscribeToZones(uid, setSavedZones);
    const unsubInv = inventoryService.subscribeToInventory(uid, setInventory);
    return () => { unsubZones(); unsubInv(); };
  }, [uid]);

  const handleProductSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedProductId(id);
    if (id) {
      const prod = inventory.find(p => p.id.toString() === id);
      if (prod) {
        if (prod.npk) {
          setNpk({ n: prod.npk.n.toString(), p: prod.npk.p.toString(), k: prod.npk.k.toString() });
        } else {
          const match = prod.name.match(/(\d{1,2})[-\s\/](\d{1,2})[-\s\/](\d{1,2})/);
          if (match) setNpk({ n: match[1], p: match[2], k: match[3] });
          else setNpk({ n: '', p: '', k: '' });
        }
      }
    } else {
      setNpk({ n: '', p: '', k: '' });
    }
  };

  const handleZoneSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedZoneId(id);
    if (id) {
      const zone = savedZones.find(z => z.id.toString() === id);
      if (zone) setLawnArea(zone.area.toString());
    } else {
      setLawnArea('');
    }
  };

  const calculateDose = () => {
    const area = parseFloat(lawnArea);
    const nPct = parseFloat(npk.n);
    const pPct = parseFloat(npk.p) || 0;
    const kPct = parseFloat(npk.k) || 0;
    const targetGramsPerSqm = parseFloat(targetN);

    if (isNaN(area) || isNaN(nPct) || isNaN(targetGramsPerSqm) || nPct <= 0) {
      toast.error('Completează Suprafața, procentul de N și doza țintă!');
      return;
    }

    const totalActiveN = area * targetGramsPerSqm;
    const totalProductRequired = (totalActiveN / nPct) * 100;
    const totalActiveP = (totalProductRequired * pPct) / 100;
    const totalActiveK = (totalProductRequired * kPct) / 100;

    let totalCost: number | undefined;
    let productName = '';
    let unit = 'g';
    if (isInventorySource && selectedProductId) {
      const prod = inventory.find(p => p.id.toString() === selectedProductId);
      if (prod && prod.price && prod.quantity) {
        let prodQtyGrams = prod.quantity;
        if (prod.unit === 'kg' || prod.unit === 'L') prodQtyGrams = prod.quantity * 1000;
        totalCost = (totalProductRequired / prodQtyGrams) * prod.price;
        productName = prod.name;
        unit = prod.unit;
      }
    }

    const zoneName = selectedZoneId
      ? savedZones.find(z => z.id.toString() === selectedZoneId)?.name || 'Manual'
      : 'Gazon';

    setResult({ activeN: totalActiveN, activeP: totalActiveP, activeK: totalActiveK, totalRequired: totalProductRequired, cost: totalCost, productId: isInventorySource ? selectedProductId : undefined, productName, unit, zoneName, area });
  };

  const handleApplyTreatment = async () => {
    if (!result || !result.productId) return;
    const item = inventory.find(i => i.id === result.productId);
    if (item && item.id) {
      let deductQty = result.totalRequired;
      if (item.unit === 'kg' || item.unit === 'L') deductQty = deductQty / 1000;
      
      if (deductQty > item.quantity) {
        toast.error(`❌ Stoc insuficient! Mai ai doar ${item.quantity.toFixed(2)} ${item.unit} de ${item.name}. Ai nevoie de ${deductQty.toFixed(2)} ${item.unit}.`);
        return;
      }

      const newQty = item.quantity - deductQty;
      await inventoryService.updateProduct(item.id, { quantity: newQty });
    }
    const newLog = {
      date: new Date().toISOString(),
      zone: result.zoneName || 'Gazon',
      product: result.productName || 'Îngrășământ',
      quantity: result.unit === 'kg' || result.unit === 'L' ? result.totalRequired / 1000 : result.totalRequired,
      unit: result.unit || 'g',
      cost: result.cost || 0
    };
    await logService.addLog(uid, newLog);
    toast.success('✅ Tratament înregistrat! Stocul a fost actualizat.');
    setResult(null);
    setLawnArea('');
    setTargetN('');
    setSelectedZoneId('');
    setSelectedProductId('');
  };

  const resultKg = result ? result.totalRequired / 1000 : 0;

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-md mx-auto relative overflow-hidden">

      {/* Toggle Tip Îngrășământ */}
      <div className="flex bg-gray-50 border border-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setFertilizerType('granular')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${fertilizerType === 'granular' ? 'bg-[#2D8C3C] text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          <Leaf className="w-4 h-4" /> Granular
        </button>
        <button
          onClick={() => setFertilizerType('liquid')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${fertilizerType === 'liquid' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          <Droplets className="w-4 h-4" /> Lichid
        </button>
      </div>

      <div className="space-y-6">

        {/* Sursă produs */}
        <div>
          <div className="flex justify-between items-end mb-2">
            <h2 className="font-bold text-gray-800 text-sm">Sursa Îngrășământ</h2>
            <button onClick={() => setIsInventorySource(!isInventorySource)} className="text-xs text-[#2D8C3C] font-bold hover:underline">
              {isInventorySource ? 'Introdu manual' : 'Alege din Inventar'}
            </button>
          </div>
          {isInventorySource && (
            <select value={selectedProductId} onChange={handleProductSelect}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 px-4 text-gray-800 font-semibold focus:bg-white focus:ring-2 focus:ring-[#2D8C3C] outline-none transition shadow-inner appearance-none mb-4">
              <option value="">Alege un produs...</option>
              {inventory.filter(i => i.type === 'Îngrășământ').map(prod => (
                <option key={prod.id} value={prod.id}>{prod.name} (Stoc: {prod.quantity} {prod.unit})</option>
              ))}
            </select>
          )}

          {/* NPK inputs cu culori corecte */}
          <h2 className="font-bold text-gray-800 text-sm mb-3">Analiza Îngrășământ (NPK %)</h2>
          {isInventorySource && selectedProductId && !npk.n && (
            <p className="text-xs text-amber-600 mb-3 font-bold bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              ⚠️ Produsul nu are NPK salvat. Introdu manual:
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {(['N', 'P', 'K'] as const).map(nutrient => (
              <div key={nutrient} className="relative">
                <label className={`text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-1.5`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${NPK_COLORS[nutrient].dot} shadow-sm`} />
                  {nutrient}
                </label>
                <input
                  type="number"
                  value={nutrient === 'N' ? npk.n : nutrient === 'P' ? npk.p : npk.k}
                  onChange={(e) => setNpk({ ...npk, [nutrient.toLowerCase()]: e.target.value })}
                  placeholder={nutrient === 'N' ? 'ex: 20' : '0'}
                  className={`w-full text-center bg-gray-50 border border-gray-100 rounded-xl py-3 font-semibold text-gray-800 pr-6 focus:bg-white focus:ring-2 ${NPK_COLORS[nutrient].ring} outline-none transition shadow-inner`}
                />
                <span className="absolute right-3 top-9 text-gray-400 text-sm font-medium">%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Zona */}
        <div>
          <div className="flex justify-between items-end mb-2">
            <h2 className="font-bold text-gray-800 text-sm">
              {isManualArea || savedZones.length === 0 ? 'Suprafața Gazonului (mp)' : 'Alege Zona'}
            </h2>
            {savedZones.length > 0 && (
              <button onClick={() => setIsManualArea(!isManualArea)} className="text-xs text-[#2D8C3C] font-bold hover:underline">
                {isManualArea ? 'Zone salvate' : 'Manual'}
              </button>
            )}
          </div>
          {!isManualArea && savedZones.length > 0 ? (
            <div>
              <select value={selectedZoneId} onChange={handleZoneSelect}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 px-4 text-gray-800 font-semibold focus:bg-white focus:ring-2 focus:ring-[#2D8C3C] outline-none transition shadow-inner appearance-none">
                <option value="">Alege o zonă salvată...</option>
                {savedZones.map(zone => (
                  <option key={zone.id} value={zone.id}>{zone.name} ({zone.area} mp)</option>
                ))}
              </select>
              {selectedZoneId && lawnArea && (
                <p className="text-[11px] text-[#2D8C3C] font-bold mt-1.5 flex items-center gap-1">
                  ✓ Suprafață: {lawnArea} mp
                </p>
              )}
            </div>
          ) : (
            <input type="number" value={lawnArea} onChange={(e) => setLawnArea(e.target.value)} placeholder="ex: 100"
              className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 px-4 text-gray-800 font-semibold placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#2D8C3C] outline-none transition shadow-inner" />
          )}
        </div>

        {/* Target N */}
        <div>
          <h2 className="font-bold text-gray-800 text-sm mb-2">Doza Țintă de Azot (N)</h2>
          <div className="relative">
            <input type="number" value={targetN} onChange={(e) => setTargetN(e.target.value)} placeholder="ex: 15"
              className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3.5 px-4 pr-20 text-gray-800 font-semibold placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none transition shadow-inner" />
            <span className="absolute right-4 top-3.5 text-gray-400 text-sm font-bold bg-gray-50 pl-2">g / mp</span>
          </div>
        </div>

        <button onClick={calculateDose}
          className="w-full bg-[#2D8C3C] hover:bg-green-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-green-900/20 active:scale-[0.98]">
          <Calculator className="w-5 h-5" /> Calculează Doza
        </button>

        {/* ─── RESULT CARD PREMIUM ──────────────────────────────────────── */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="overflow-hidden"
            >
              {/* Hero Number */}
              <div className="bg-gradient-to-br from-[#2D8C3C] to-emerald-700 rounded-2xl p-6 text-white text-center relative overflow-hidden shadow-xl shadow-green-900/20 mb-3">
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-black/10 rounded-full blur-2xl" />
                <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-2">Ai nevoie pentru {result.zoneName}</p>
                <h3 className="text-5xl font-black tracking-tight">
                  {resultKg >= 1 ? resultKg.toFixed(2) : result.totalRequired.toFixed(0)}
                  <span className="text-2xl font-bold text-emerald-200 ml-2">{resultKg >= 1 ? 'kg' : 'g'}</span>
                </h3>
                <p className="text-emerald-100 text-sm mt-2">produs comercial pentru <strong className="text-white">{result.area} mp</strong></p>
                <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-center gap-1.5">
                  <ArrowRight className="w-3 h-3 text-emerald-200" />
                  <span className="text-xs text-emerald-100 font-bold">{targetN} g N / mp · doza solicitată</span>
                </div>
              </div>

              {/* NPK Pills */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: 'N Azot', value: result.activeN, color: NPK_COLORS.N },
                  { label: 'P Fosfor', value: result.activeP, color: NPK_COLORS.P },
                  { label: 'K Potasiu', value: result.activeK, color: NPK_COLORS.K },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`${color.bg} ${color.border} border rounded-xl p-3 text-center`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${color.text} block mb-1`}>{label}</span>
                    <span className={`text-lg font-black ${color.text}`}>
                      {value >= 1000 ? (value / 1000).toFixed(2) + ' kg' : value.toFixed(0) + ' g'}
                    </span>
                    <span className="text-[9px] text-gray-400 block font-bold">subst. activă</span>
                  </div>
                ))}
              </div>

              {/* Cost & Apply */}
              {result.cost !== undefined && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cost estimat tratament</span>
                  <span className="font-black text-gray-900 text-lg">{result.cost.toFixed(2)} <span className="text-sm font-bold text-gray-500">RON</span></span>
                </div>
              )}

              {result.productId && (
                <button onClick={handleApplyTreatment}
                  className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Aplică și Înregistrează Tratamentul
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default NPKCalculator;
