import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sprout, Map, TestTube, Leaf, Apple, Flower2, Plus, Trash2, Edit2, X, Loader2, MapPin } from 'lucide-react';
import { gardenService, GardenZone } from '../services/pf/gardenService';
import { auth } from '../services/firebase';
import { YardMapper } from '../components/YardMapper';

export const GardenSetup: React.FC = () => {
  const [zones, setZones] = useState<GardenZone[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid || 'pf_anonymous_user';

  useEffect(() => {
    const unsubscribe = gardenService.subscribeToZones(uid, (data) => {
      setZones(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [uid]);
  
  // Form State
  const [newName, setNewName] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newType, setNewType] = useState('Gazon');
  const [newPh, setNewPh] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showMapper, setShowMapper] = useState(false);
  const [newBoundaryCoords, setNewBoundaryCoords] = useState<{lat: number, lng: number}[]>([]);

  const getZoneIcon = (type: string) => {
    switch(type) {
      case 'Gazon': return <Leaf className="w-6 h-6 text-emerald-500" />;
      case 'Pomi Fructiferi': return <Apple className="w-6 h-6 text-red-500" />;
      case 'Plante Ornamentale': return <Flower2 className="w-6 h-6 text-fuchsia-500" />;
      case 'Legume': return <Sprout className="w-6 h-6 text-amber-500" />;
      default: return <Map className="w-6 h-6 text-blue-500" />;
    }
  };

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newArea) return;

    try {
      if (editingId) {
        await gardenService.updateZone(editingId, {
          name: newName,
          area: parseFloat(newArea),
          type: newType,
          ph: newPh ? parseFloat(newPh) : undefined,
          boundaryCoordinates: newBoundaryCoords.length > 0 ? newBoundaryCoords : undefined
        });
        setEditingId(null);
      } else {
        await gardenService.addZone(uid, {
          name: newName,
          area: parseFloat(newArea),
          type: newType,
          ph: newPh ? parseFloat(newPh) : undefined,
          boundaryCoordinates: newBoundaryCoords.length > 0 ? newBoundaryCoords : undefined
        });
      }

      setNewName('');
      setNewArea('');
      setNewType('Gazon');
      setNewPh('');
      setNewBoundaryCoords([]);
    } catch (err) {
      console.error("Error saving zone:", err);
    }
  };

  const handleDeleteZone = async (id?: string) => {
    if (!id) return;
    try {
      await gardenService.deleteZone(id);
      if (editingId === id) resetForm();
    } catch (err) {
      console.error("Error deleting zone:", err);
    }
  };

  const handleEditZone = (zone: GardenZone) => {
    if (zone.id) setEditingId(zone.id);
    setNewName(zone.name);
    setNewArea(zone.area.toString());
    setNewType(zone.type);
    setNewPh(zone.ph ? zone.ph.toString() : '');
    setNewBoundaryCoords(zone.boundaryCoordinates || []);
    
    // Scroll to form on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null);
    setNewName('');
    setNewArea('');
    setNewType('Gazon');
    setNewPh('');
    setNewBoundaryCoords([]);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-2 border-b border-gray-100 pb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2D8C3C] to-emerald-700 flex items-center justify-center text-white shadow-lg shadow-green-500/30">
          <Map className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">
            Configurare Curte & Zone
          </h1>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Împarte-ți grădina în zone pentru calcule automate și planuri de tratament precise.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Partea stângă: Zonele Existente */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            Zone Existente <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{zones.length}</span>
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-1 sm:col-span-2 flex flex-col items-center justify-center py-12 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-4" />
                <p className="font-medium">Se încarcă zonele din grădina ta...</p>
              </div>
            ) : (
              <AnimatePresence>
                {zones.map(zone => (
                <motion.div
                  key={zone.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition relative overflow-hidden group"
                >
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center shadow-inner">
                      {getZoneIcon(zone.type)}
                    </div>
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-widest rounded-lg">
                      {zone.type}
                    </span>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button onClick={() => handleEditZone(zone)} className="p-1.5 bg-white text-gray-500 hover:text-blue-500 rounded-md shadow-sm border border-gray-100 transition">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteZone(zone.id)} className="p-1.5 bg-white text-gray-500 hover:text-red-500 rounded-md shadow-sm border border-gray-100 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <div className="relative z-10">
                    <h3 className="text-lg font-bold text-gray-900 truncate mb-1">{zone.name}</h3>
                    <div className="flex items-center gap-4 mt-3">
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Suprafață</p>
                        <p className="font-black text-xl text-gray-800">{zone.area} <span className="text-sm text-gray-400 font-semibold">mp</span></p>
                      </div>
                      {zone.ph && (
                        <div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1"><TestTube className="w-3 h-3" /> pH</p>
                          <p className="font-bold text-lg text-emerald-600">{zone.ph}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="absolute right-0 bottom-0 w-24 h-24 bg-gray-50 rounded-tl-full blur-2xl group-hover:bg-emerald-50 transition -z-0"></div>
                </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Partea dreaptă: Formular Adăugare */}
        <div>
          <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 sticky top-24">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                {editingId ? <Edit2 className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-[#2D8C3C]" />}
                {editingId ? 'Actualizează Zona' : 'Adaugă Zonă Nouă'}
              </h2>
              {editingId && (
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <form onSubmit={handleAddZone} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">Nume Zonă</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="ex: Grădina de Legume"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 text-gray-800 font-semibold placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#2D8C3C] focus:border-transparent outline-none transition shadow-inner"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5 flex items-center justify-between">
                  Suprafață (mp)
                  <button type="button" onClick={() => setShowMapper(true)} className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1 hover:bg-blue-100 transition">
                    <MapPin className="w-3 h-3" /> Desenează pe hartă
                  </button>
                </label>
                <input 
                  type="number" 
                  value={newArea} 
                  onChange={(e) => setNewArea(e.target.value)} 
                  placeholder="ex: 50"
                  className={`w-full bg-gray-50 border ${newBoundaryCoords.length > 0 ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-gray-100'} rounded-xl py-3 px-4 text-gray-800 font-semibold placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#2D8C3C] focus:border-transparent outline-none transition shadow-inner`}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">Tipul Suprafeței</label>
                <select 
                  value={newType} 
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 text-gray-800 font-semibold focus:bg-white focus:ring-2 focus:ring-[#2D8C3C] focus:border-transparent outline-none transition shadow-inner appearance-none"
                >
                  <option value="Gazon">Gazon</option>
                  <option value="Pomi Fructiferi">Pomi Fructiferi</option>
                  <option value="Legume">Legume</option>
                  <option value="Plante Ornamentale">Plante Ornamentale</option>
                  <option value="Mixt">Mixt</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 flex justify-between items-end mb-1.5">
                  <span>Nivel pH (Opțional)</span>
                  <span className="text-emerald-600 font-bold">{newPh || '-'}</span>
                </label>
                <input 
                  type="range" 
                  min="4.0" 
                  max="9.0" 
                  step="0.1" 
                  value={newPh || '6.5'} 
                  onChange={(e) => setNewPh(e.target.value)}
                  className="w-full accent-[#2D8C3C] h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-bold mt-1">
                  <span>Acid (4.0)</span>
                  <span>Neutru (7.0)</span>
                  <span>Alcalin (9.0)</span>
                </div>
              </div>

              <button 
                type="submit"
                className={`w-full text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg active:scale-[0.98] mt-6 ${editingId ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/20' : 'bg-[#2D8C3C] hover:bg-green-800 shadow-green-900/20'}`}
              >
                {editingId ? 'Salvează Modificările' : '+ Adaugă Zona'}
              </button>
            </form>
          </div>
        </div>

      </div>

      <AnimatePresence>
        {showMapper && (
          <YardMapper 
            onClose={() => setShowMapper(false)} 
            onSave={(area, coords) => {
              setNewArea(area.toString());
              setNewBoundaryCoords(coords);
              setShowMapper(false);
            }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GardenSetup;
