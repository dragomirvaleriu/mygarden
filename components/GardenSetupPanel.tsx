import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sprout, Map, TestTube, Leaf, Apple, Flower2, Plus, Trash2, Edit2, X, Loader2 } from 'lucide-react';
import { gardenService, GardenZone } from '../services/pf/gardenService';
import { auth } from '../services/firebase';
import { YardMapper } from './YardMapper';

export const GardenSetupPanel: React.FC = () => {
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
      case 'Gazon': return <Leaf className="w-6 h-6 text-accent-color" />;
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
      resetForm();
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Zones List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
            Zone Grădină <span className="text-xs px-2 py-0.5 bg-bg-main text-text-secondary rounded-full">{zones.length}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-1 sm:col-span-2 flex flex-col items-center justify-center py-12 text-text-secondary">
                <Loader2 className="w-8 h-8 animate-spin text-accent-color mb-4" />
                <p className="font-medium">Se încarcă zonele...</p>
              </div>
            ) : zones.length === 0 ? (
              <div className="col-span-1 sm:col-span-2 text-center py-8 text-text-secondary">
                <p>Nici o zonă adăugată. Crează una mai jos!</p>
              </div>
            ) : (
              <AnimatePresence>
                {zones.map(zone => (
                  <motion.div
                    key={zone.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-bg-main border border-border-color rounded-2xl p-4 hover:border-accent-color/50 transition group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-10 h-10 rounded-lg bg-bg-card flex items-center justify-center">
                        {getZoneIcon(zone.type)}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => handleEditZone(zone)} className="p-1 hover:bg-bg-card rounded-lg">
                          <Edit2 className="w-4 h-4 text-blue-500" />
                        </button>
                        <button onClick={() => handleDeleteZone(zone.id)} className="p-1 hover:bg-bg-card rounded-lg">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                    <h4 className="font-bold text-text-main text-sm mb-2">{zone.name}</h4>
                    <div className="flex gap-4 text-[12px]">
                      <div>
                        <p className="text-text-secondary font-bold uppercase">Suprafață</p>
                        <p className="text-text-main font-bold">{zone.area} mp</p>
                      </div>
                      {zone.ph && (
                        <div>
                          <p className="text-text-secondary font-bold uppercase">pH</p>
                          <p className="text-text-main font-bold">{zone.ph}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Add/Edit Form */}
        <div className="lg:col-span-1">
          <form onSubmit={handleAddZone} className="bg-bg-card rounded-2xl p-4 border border-border-color space-y-3">
            <h3 className="font-bold text-text-main flex items-center gap-2">
              {editingId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingId ? 'Actualizează' : 'Adaugă Zonă'}
            </h3>

            {editingId && (
              <button type="button" onClick={resetForm} className="text-accent-color text-sm font-bold hover:underline">
                ✕ Anulează
              </button>
            )}

            <input
              type="text"
              placeholder="Nume zona (ex. Gazon Față)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg-main border border-border-color text-sm outline-none focus:border-accent-color"
            />

            <input
              type="number"
              placeholder="Suprafață (mp)"
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg-main border border-border-color text-sm outline-none focus:border-accent-color"
            />

            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg-main border border-border-color text-sm outline-none focus:border-accent-color"
            >
              <option>Gazon</option>
              <option>Pomi Fructiferi</option>
              <option>Plante Ornamentale</option>
              <option>Legume</option>
            </select>

            <input
              type="number"
              step="0.1"
              placeholder="pH (opțional)"
              value={newPh}
              onChange={(e) => setNewPh(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg-main border border-border-color text-sm outline-none focus:border-accent-color"
            />

            <button
              type="submit"
              className="w-full px-3 py-2 rounded-lg bg-accent-color text-white font-bold text-sm hover:opacity-90 transition"
            >
              {editingId ? 'Actualizează' : 'Adaugă'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
