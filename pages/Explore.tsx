import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Check, Sprout, Sun, Droplets, Gauge } from 'lucide-react';
import { plantCatalog, plantDifficulties, PlantCatalogEntry } from '../src/data/plantCatalog';
import { db, collection, addDoc, serverTimestamp } from '../services/firebase';
import { auth } from '../services/firebase';
import toast from 'react-hot-toast';

interface Props {
  organizationId: string;
}

type TypeFilter = 'toate' | 'interior' | 'exterior';
type DifficultyFilter = 'toate' | PlantCatalogEntry['difficulty'];

const Explore: React.FC<Props> = ({ organizationId }) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('toate');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('toate');
  const [selectedPlant, setSelectedPlant] = useState<PlantCatalogEntry | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);

  const filteredPlants = useMemo(() => {
    const term = search.trim().toLowerCase();
    return plantCatalog.filter((plant) => {
      if (typeFilter !== 'toate' && plant.type !== typeFilter) return false;
      if (difficultyFilter !== 'toate' && plant.difficulty !== difficultyFilter) return false;
      if (term && !plant.name.toLowerCase().includes(term) && !plant.scientificName.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [search, typeFilter, difficultyFilter]);

  const handleAddToGarden = async (plant: PlantCatalogEntry) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setAddingId(plant.id);
    try {
      await addDoc(collection(db, 'user_plants'), {
        userId: uid,
        organizationId,
        catalogId: plant.id,
        name: plant.name,
        emoji: plant.emoji,
        type: plant.type,
        addedAt: serverTimestamp(),
      });
      setAddedIds((prev) => new Set(prev).add(plant.id));
      toast.success(`${plant.name} a fost adăugat în grădina ta!`);
    } catch (err) {
      console.error('Error adding plant to garden:', err);
      toast.error('Nu am putut adăuga planta. Încearcă din nou.');
    } finally {
      setAddingId(null);
    }
  };

  const difficultyColor = (difficulty: PlantCatalogEntry['difficulty']) => {
    if (difficulty === 'ușor') return 'text-accent-color bg-accent-color/10 border-accent-color/20';
    if (difficulty === 'mediu') return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-red-500 dark:text-red-400 bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-accent-color flex items-center justify-center text-white shadow-lg shadow-accent-color/30 shrink-0">
          <Sprout className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-text-main tracking-tight leading-tight">Explorează</h1>
          <p className="text-text-secondary text-sm font-medium mt-1">
            Caută plante, vezi cum le îngrijești și adaugă-le în grădina ta.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Caută o plantă după nume..."
          className="w-full bg-bg-card border border-border-color rounded-2xl py-3.5 pl-12 pr-4 text-text-main font-semibold placeholder:text-text-secondary focus:ring-2 focus:ring-accent-color focus:border-transparent outline-none transition shadow-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['toate', 'interior', 'exterior'] as TypeFilter[]).map((option) => (
          <button
            key={option}
            onClick={() => setTypeFilter(option)}
            className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition ${
              typeFilter === option
                ? 'bg-accent-color text-white border-accent-color shadow-lg shadow-accent-color/30'
                : 'bg-bg-card border-border-color text-text-secondary hover:border-accent-color/30 hover:text-text-main'
            }`}
          >
            {option === 'toate' ? 'Toate' : option === 'interior' ? 'Interior' : 'Exterior'}
          </button>
        ))}
        <span className="w-px bg-border-color mx-1" />
        {(['toate', ...plantDifficulties] as DifficultyFilter[]).map((option) => (
          <button
            key={option}
            onClick={() => setDifficultyFilter(option)}
            className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition ${
              difficultyFilter === option
                ? 'bg-accent-color text-white border-accent-color shadow-lg shadow-accent-color/30'
                : 'bg-bg-card border-border-color text-text-secondary hover:border-accent-color/30 hover:text-text-main'
            }`}
          >
            {option === 'toate' ? 'Orice dificultate' : option}
          </button>
        ))}
      </div>

      {filteredPlants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
          <Search className="w-10 h-10 mb-3 opacity-40" />
          <p className="font-bold">Nicio plantă găsită</p>
          <p className="text-sm mt-1">Încearcă alți termeni de căutare sau alte filtre.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPlants.map((plant) => (
            <button
              key={plant.id}
              onClick={() => setSelectedPlant(plant)}
              className="text-left bg-bg-card border border-border-color rounded-3xl p-4 shadow-sm hover:shadow-md hover:border-accent-color/30 hover:-translate-y-1 transition-all active:translate-y-0"
            >
              <div className="w-12 h-12 rounded-2xl bg-bg-main flex items-center justify-center text-2xl shadow-inner mb-3">
                {plant.emoji}
              </div>
              <h3 className="font-black text-text-main text-sm leading-tight mb-1 truncate">{plant.name}</h3>
              <p className="text-[11px] text-text-secondary italic truncate mb-2">{plant.scientificName}</p>
              <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${difficultyColor(plant.difficulty)}`}>
                {plant.difficulty}
              </span>
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedPlant && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedPlant(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl p-6"
            >
              <button
                onClick={() => setSelectedPlant(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-bg-main text-text-secondary hover:text-text-main transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-16 h-16 rounded-2xl bg-bg-main flex items-center justify-center text-3xl shadow-inner mb-4">
                {selectedPlant.emoji}
              </div>
              <h2 className="text-xl font-black text-text-main leading-tight">{selectedPlant.name}</h2>
              <p className="text-sm text-text-secondary italic mb-4">{selectedPlant.scientificName}</p>

              <p className="text-sm text-text-main leading-relaxed mb-5">{selectedPlant.description}</p>

              <div className="grid grid-cols-1 gap-3 mb-6">
                <div className="flex items-start gap-3 bg-bg-main rounded-2xl p-3 border border-border-color">
                  <Droplets className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">Udare</p>
                    <p className="text-sm text-text-main font-medium">{selectedPlant.watering}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-bg-main rounded-2xl p-3 border border-border-color">
                  <Sun className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">Lumină</p>
                    <p className="text-sm text-text-main font-medium">{selectedPlant.light}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-bg-main rounded-2xl p-3 border border-border-color">
                  <Gauge className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">Dificultate</p>
                    <p className="text-sm text-text-main font-medium capitalize">{selectedPlant.difficulty}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleAddToGarden(selectedPlant)}
                disabled={addingId === selectedPlant.id || addedIds.has(selectedPlant.id)}
                className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg active:scale-[0.98] ${
                  addedIds.has(selectedPlant.id)
                    ? 'bg-accent-color/20 text-accent-color cursor-default'
                    : 'bg-accent-color text-white hover:brightness-95 shadow-accent-color/30'
                }`}
              >
                {addedIds.has(selectedPlant.id) ? (
                  <>
                    <Check className="w-5 h-5" /> Adăugată în grădina ta
                  </>
                ) : addingId === selectedPlant.id ? (
                  'Se adaugă...'
                ) : (
                  '+ Adaugă în grădina mea'
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Explore;
