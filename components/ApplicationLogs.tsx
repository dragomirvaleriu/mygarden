import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Calendar, MapPin, Package, AlertCircle, Loader2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { logService, TreatmentLog } from '../services/pf/logService';
import { auth } from '../services/firebase';
import { format, addDays, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';

// ─── Color coding per tip produs ────────────────────────────────────────────
type TreatmentType = 'fertilizer' | 'fungicide' | 'insecticide' | 'herbicide' | 'other';

const detectType = (product: string): TreatmentType => {
  const p = product.toLowerCase();
  if (/îngrășăm|fertiliz|npk|uree|azot|fosfor|potasiu|amino|biostim/i.test(p)) return 'fertilizer';
  if (/fungicid|champ|kupferol|alcupral|headway|heritage|daconil|systhane/i.test(p)) return 'fungicide';
  if (/insecticid|talstar|chlorpyrifos|karate|confidor|dimilin|bifenthrin/i.test(p)) return 'insecticide';
  if (/erbicid|roundup|glyphosate|tribute|destiny|dismiss/i.test(p)) return 'herbicide';
  return 'other';
};

const TYPE_STYLES: Record<TreatmentType, {
  bg: string; border: string; text: string; badge: string; badgeText: string;
  icon: string; dot: string; label: string; nextInterval: number;
}> = {
  fertilizer: {
    bg: 'bg-emerald-50/60', border: 'border-emerald-200', text: 'text-emerald-700',
    badge: 'bg-emerald-100', badgeText: 'text-emerald-700',
    icon: '🌱', dot: 'bg-emerald-500', label: 'Îngrășământ', nextInterval: 30
  },
  fungicide: {
    bg: 'bg-violet-50/60', border: 'border-violet-200', text: 'text-violet-700',
    badge: 'bg-violet-100', badgeText: 'text-violet-700',
    icon: '🍄', dot: 'bg-violet-500', label: 'Fungicid', nextInterval: 21
  },
  insecticide: {
    bg: 'bg-orange-50/60', border: 'border-orange-200', text: 'text-orange-700',
    badge: 'bg-orange-100', badgeText: 'text-orange-700',
    icon: '🪲', dot: 'bg-orange-500', label: 'Insecticid', nextInterval: 28
  },
  herbicide: {
    bg: 'bg-red-50/60', border: 'border-red-200', text: 'text-red-700',
    badge: 'bg-red-100', badgeText: 'text-red-700',
    icon: '🌿', dot: 'bg-red-500', label: 'Erbicid', nextInterval: 60
  },
  other: {
    bg: 'bg-gray-50/60', border: 'border-gray-200', text: 'text-gray-700',
    badge: 'bg-gray-100', badgeText: 'text-gray-600',
    icon: '📋', dot: 'bg-gray-400', label: 'Altele', nextInterval: 14
  },
};

const formatQuantity = (qty: number, unit: string): string => {
  if (unit === 'g' && qty >= 1000) return `${(qty / 1000).toFixed(2)} kg`;
  if (unit === 'ml' && qty >= 1000) return `${(qty / 1000).toFixed(2)} L`;
  return `${qty % 1 === 0 ? qty : qty.toFixed(2)} ${unit}`;
};

const formatDate = (dateStr: string): string => {
  try {
    const d = parseISO(dateStr);
    return format(d, 'dd MMM yyyy', { locale: ro });
  } catch {
    return dateStr;
  }
};

const getNextDate = (dateStr: string, intervalDays: number): string => {
  try {
    const next = addDays(parseISO(dateStr), intervalDays);
    return format(next, 'dd MMM', { locale: ro });
  } catch {
    return '—';
  }
};

const ApplicationLogs: React.FC = () => {
  const [logs, setLogs] = useState<TreatmentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<TreatmentType | 'all'>('all');
  const uid = auth.currentUser?.uid || 'pf_anonymous_user';

  useEffect(() => {
    const unsubscribe = logService.subscribeToLogs(uid, (data) => {
      setLogs(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [uid]);

  const filteredLogs = filterType === 'all'
    ? logs
    : logs.filter(l => detectType(l.product) === filterType);

  const handleDelete = async (id: string) => {
    if (!id) return;
    await logService.deleteLog(id);
  };

  const typeCounts: Record<TreatmentType, number> = {
    fertilizer: 0, fungicide: 0, insecticide: 0, herbicide: 0, other: 0,
  };
  logs.forEach(l => { typeCounts[detectType(l.product)]++; });

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-4xl mx-auto relative overflow-hidden">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-200">
            <ClipboardList className="w-6 h-6 text-[#2D8C3C]" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-xl leading-tight">Jurnal Tratamente</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">
              {logs.length} înregistrări · Istoric & Aplicări
            </p>
          </div>
        </div>

        {/* Tip Sumary */}
        <div className="flex gap-2 flex-wrap">
          {(Object.entries(TYPE_STYLES) as [TreatmentType, typeof TYPE_STYLES[TreatmentType]][]).map(([type, s]) => (
            typeCounts[type] > 0 && (
              <button
                key={type}
                onClick={() => setFilterType(filterType === type ? 'all' : type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black transition ${filterType === type ? `${s.bg} ${s.border} ${s.text}` : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
              >
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                {s.label} ({typeCounts[type]})
              </button>
            )
          ))}
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
            <p className="font-medium">Se încarcă jurnalul...</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log, i) => {
                const type = detectType(log.product);
                const s = TYPE_STYLES[type];
                const isExpanded = expandedId === log.id;
                const nextDate = getNextDate(log.date, s.nextInterval);

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: i * 0.04 }}
                    className={`${s.bg} border ${s.border} rounded-2xl overflow-hidden transition hover:shadow-md`}
                  >
                    {/* Main Row */}
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : (log.id || null))}
                    >
                      {/* Type icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${s.badge}`}>
                        {s.icon}
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-gray-900 text-sm">{log.product}</h3>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${s.badge} ${s.badgeText}`}>
                            {s.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-medium flex-wrap">
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-400" />{formatDate(log.date)}</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" />{log.zone}</span>
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="text-right shrink-0">
                        <p className="font-black text-gray-900 text-base">{formatQuantity(log.quantity, log.unit)}</p>
                        <p className="text-[10px] text-gray-400 font-bold">aplicat</p>
                      </div>

                      {/* Expand toggle */}
                      <button className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center text-gray-400 shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-0 space-y-3">
                            <div className="h-px bg-white/50 mb-3" />

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {/* Cost */}
                              <div className="bg-white/70 rounded-xl p-3 border border-white/80">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Cost</p>
                                <p className="font-black text-gray-800 text-base">{log.cost.toFixed(2)} <span className="text-sm font-bold text-gray-500">RON</span></p>
                              </div>

                              {/* Următor */}
                              <div className="bg-white/70 rounded-xl p-3 border border-white/80">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Următor estimat</p>
                                <p className={`font-black text-base ${s.text}`}>{nextDate}</p>
                                <p className="text-[9px] text-gray-400 font-bold">la ~{s.nextInterval} zile</p>
                              </div>

                              {/* Note */}
                              {log.notes && (
                                <div className="bg-white/70 rounded-xl p-3 border border-white/80 col-span-2 sm:col-span-1">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Note</p>
                                  <p className="text-xs text-gray-600 font-medium">{log.notes}</p>
                                </div>
                              )}
                            </div>

                            {/* Delete */}
                            <button
                              onClick={() => log.id && handleDelete(log.id)}
                              className="flex items-center gap-1.5 text-red-400 hover:text-red-600 text-xs font-bold transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Șterge înregistrarea
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-16 text-center text-gray-500 bg-gray-50 rounded-2xl border border-gray-100 border-dashed"
              >
                <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="font-bold text-lg text-gray-600 mb-1">
                  {filterType !== 'all' ? `Niciun ${TYPE_STYLES[filterType].label} înregistrat.` : 'Niciun tratament înregistrat.'}
                </p>
                <p className="text-sm">Folosește calculatoarele din Trusa de Scule pentru a aplica produse.</p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default ApplicationLogs;
