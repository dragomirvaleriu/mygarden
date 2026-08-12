import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import HeroHeader from '../components/ui/HeroHeader';
import toast from 'react-hot-toast';
import { auth, db } from '../services/firebase';

interface GardenPlant {
  id: string;
  catalogId: string;
  name: string;
  emoji: string;
  type: string;
  addedAt: any;
}

const GardenCollectionPage: React.FC = () => {
  const { t } = useTranslation();
  const [plants, setPlants] = useState<GardenPlant[]>([]);
  const [loading, setLoading] = useState(true);

  // Load user's plants from Firestore
  useEffect(() => {
    const loadGardenPlants = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setLoading(false);
        return;
      }
      try {
        const q = query(collection(db, 'user_plants'), where('userId', '==', uid));
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as GardenPlant));
        setPlants(docs.sort((a, b) => (b.addedAt?.toDate?.() || 0) - (a.addedAt?.toDate?.() || 0)));
      } catch (err) {
        console.error('Error loading garden plants:', err);
        toast.error(t('Nu am putut încărca grădina. Încearcă din nou.'));
      } finally {
        setLoading(false);
      }
    };
    loadGardenPlants();
  }, [auth.currentUser?.uid, t]);

  const handleRemove = async (docId: string, plantName: string) => {
    if (!confirm(`${t('Elimini')} "${plantName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'user_plants', docId));
      setPlants(prev => prev.filter(p => p.id !== docId));
      toast.success(`${plantName} ${t('a fost eliminată din grădina')}`);
    } catch (err) {
      console.error('Error removing plant:', err);
      toast.error(t('Nu am putut elimina planta.'));
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-20">
      <HeroHeader className="mb-6">
        <div className="px-4 sm:px-6 py-6">
          <h1 className="text-2xl font-black text-text-main">{t('Grădina mea')}</h1>
          <p className="text-sm text-text-secondary mt-1">{plants.length} {t('plante')}</p>
        </div>
      </HeroHeader>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent-color border-t-transparent" />
        </div>
      ) : plants.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-secondary mb-4">{t('Nici o plantă încă')}</p>
          <a href="#explore" className="text-accent-color font-bold hover:underline">
            {t('Explorează catalogul')} →
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {plants.map(plant => (
            <div
              key={plant.id}
              className="bg-bg-main rounded-2xl p-3 border border-border-color flex flex-col items-center gap-2 relative group"
            >
              <div className="text-3xl">{plant.emoji}</div>
              <div className="text-center flex-1">
                <h3 className="text-sm font-bold text-text-main line-clamp-2">{plant.name}</h3>
                <p className="text-[10px] text-text-secondary uppercase">{plant.type}</p>
              </div>
              <button
                onClick={() => handleRemove(plant.id, plant.name)}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-500/20"
                title={t('Elimină')}
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GardenCollectionPage;
