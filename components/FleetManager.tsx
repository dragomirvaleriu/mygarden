import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, AlertTriangle, Plus, Trash2, Wrench, Settings, RefreshCw, CheckCircle2 } from 'lucide-react';
import { fleetService, EquipmentItem } from '../services/pf/fleetService';
import { auth } from '../services/firebase';
import toast from 'react-hot-toast';

export const FleetManager: React.FC = () => {
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const uid = auth.currentUser?.uid || 'pf_anonymous_user';

  const [form, setForm] = useState({
    name: '',
    hoursOfUse: 0,
    serviceIntervalHours: 50
  });

  useEffect(() => {
    const unsub = fleetService.subscribeToEquipment(uid, setEquipment);
    return () => unsub();
  }, [uid]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.serviceIntervalHours <= 0) {
      toast.error("Completează numele și un interval de revizie valid.");
      return;
    }
    
    try {
      await fleetService.addEquipment(uid, {
        name: form.name,
        hoursOfUse: form.hoursOfUse,
        serviceIntervalHours: form.serviceIntervalHours,
        lastServiceDate: new Date().toISOString()
      });
      toast.success("Echipament adăugat!");
      setShowAddModal(false);
      setForm({ name: '', hoursOfUse: 0, serviceIntervalHours: 50 });
    } catch (err) {
      toast.error("Eroare la adăugare.");
    }
  };

  const handleAddHours = async (id: string, currentHours: number, amount: number) => {
    try {
      await fleetService.updateEquipment(id, { hoursOfUse: currentHours + amount });
      toast.success(`Adăugat ${amount} ore de funcționare.`);
    } catch (err) {
      toast.error("Eroare la actualizare.");
    }
  };

  const handleResetService = async (id: string) => {
    try {
      await fleetService.updateEquipment(id, { 
        hoursOfUse: 0, 
        lastServiceDate: new Date().toISOString() 
      });
      toast.success("Revizie marcată ca efectuată. Ore resetate!");
    } catch (err) {
      toast.error("Eroare la resetare.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Sigur vrei să ștergi acest echipament?")) {
      try {
        await fleetService.deleteEquipment(id);
        toast.success("Echipament șters.");
      } catch (err) {
        toast.error("Eroare la ștergere.");
      }
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-5xl mx-auto relative overflow-hidden">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-gray-100 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-100 text-orange-600">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-xl leading-tight">Fleet Manager</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Revizii & Echipamente</p>
          </div>
        </div>
        
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Adaugă Utilaj
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {equipment.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
            <Wrench className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="font-bold text-lg text-gray-600 mb-1">Nu ai adăugat niciun echipament.</p>
            <p className="text-sm text-gray-500">Ex: Mașină de tuns iarba, Scarificator, Motocoasă.</p>
          </div>
        ) : (
          equipment.map(item => {
            const needsService = item.hoursOfUse >= item.serviceIntervalHours;
            const progress = Math.min(100, Math.round((item.hoursOfUse / item.serviceIntervalHours) * 100));
            const lastService = new Date(item.lastServiceDate).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' });

            return (
              <div key={item.id} className={`bg-white border rounded-2xl p-5 shadow-sm transition relative overflow-hidden ${needsService ? 'border-red-300 shadow-red-100' : 'border-gray-100 hover:shadow-md'}`}>
                
                {needsService && (
                  <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Necesită Revizie
                  </div>
                )}

                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-gray-900 text-lg truncate pr-10" title={item.name}>{item.name}</h3>
                  <button onClick={() => handleDelete(item.id!)} className="text-gray-400 hover:text-red-500 transition shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-xs font-bold text-gray-500">Uzura (Ore)</span>
                    <span className={`text-sm font-black ${needsService ? 'text-red-600' : 'text-gray-800'}`}>
                      {item.hoursOfUse} / {item.serviceIntervalHours}h
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${needsService ? 'bg-red-500' : progress > 80 ? 'bg-orange-500' : 'bg-green-500'}`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-2 text-right">Ultima revizie: {lastService}</p>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => handleAddHours(item.id!, item.hoursOfUse, 1)}
                    className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-gray-200"
                  >
                    +1 oră
                  </button>
                  <button 
                    onClick={() => handleAddHours(item.id!, item.hoursOfUse, 5)}
                    className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-gray-200"
                  >
                    +5 ore
                  </button>
                </div>

                <button 
                  onClick={() => handleResetService(item.id!)}
                  className={`w-full mt-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${needsService ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200' : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'}`}
                >
                  <Settings className="w-4 h-4" /> Resetează Revizia (Schimb Ulei)
                </button>

              </div>
            );
          })
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-gray-100"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-500" /> Adaugă Utilaj
              </h3>

              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1.5">Nume Echipament</label>
                  <input 
                    type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="ex: Mașină de tuns Honda"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">Ore Curente</label>
                    <input 
                      type="number" min="0" value={form.hoursOfUse} onChange={e => setForm({...form, hoursOfUse: Number(e.target.value)})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">Interval Revizie (h)</label>
                    <input 
                      type="number" min="1" value={form.serviceIntervalHours} onChange={e => setForm({...form, serviceIntervalHours: Number(e.target.value)})}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition"
                  >
                    Anulează
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-500/20 transition active:scale-[0.98]"
                  >
                    Salvează
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
