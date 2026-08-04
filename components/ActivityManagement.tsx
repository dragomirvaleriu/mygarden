import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Edit2, Trash2, Plus, Save, X, ChevronDown } from 'lucide-react';
import { db, collection, query, where, onSnapshot, deleteDoc, doc, updateDoc, addDoc, serverTimestamp } from '../services/firebase';
import toast from 'react-hot-toast';

interface Activity {
  id: string;
  name: string;
  icon: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'seasonal';
  order: number;
}

interface Props {
  userId: string;
  organizationId: string;
}

const ACTIVITY_TEMPLATES = [
  { name: 'Tunsul', icon: '✂️', defaultFreq: 'weekly' as const },
  { name: 'Udare', icon: '💧', defaultFreq: 'weekly' as const },
  { name: 'Îngrășământ Solid', icon: '🌱', defaultFreq: 'monthly' as const },
  { name: 'Foliare', icon: '💨', defaultFreq: 'weekly' as const },
  { name: 'Aerare', icon: '🌍', defaultFreq: 'quarterly' as const },
  { name: 'Scarificare', icon: '🧹', defaultFreq: 'quarterly' as const },
  { name: 'Top-dressing', icon: '⬆️', defaultFreq: 'quarterly' as const },
  { name: 'Tratament Fungicid', icon: '🍄', defaultFreq: 'monthly' as const },
  { name: 'Tratament Insecticid', icon: '🐛', defaultFreq: 'monthly' as const },
  { name: 'Testare pH Sol', icon: '📊', defaultFreq: 'quarterly' as const },
];

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Zilnic',
  weekly: 'Săptămânal',
  biweekly: 'O dată la 2 săptămâni',
  monthly: 'Lunar',
  quarterly: 'Trimestrial',
  seasonal: 'Sezonier',
};

export const ActivityManagement: React.FC<Props> = ({ userId, organizationId }) => {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Activity>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmoji, setCustomEmoji] = useState('🌱');
  const [customFreq, setCustomFreq] = useState<'daily' | 'weekly'>('weekly');

  // Load activities
  useEffect(() => {
    const q = query(
      collection(db, 'user_activities'),
      where('userId', '==', userId),
      where('organizationId', '==', organizationId)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Activity))
          .sort((a, b) => a.order - b.order);
        setActivities(data);
        setLoading(false);
      },
      (error) => {
        console.error('ActivityManagement error:', error);
        setLoading(false);
        // Demo mode: load mock data if permission denied
        if (error.code === 'permission-denied') {
          const mockData: Activity[] = [
            { id: '1', name: 'Udare', icon: '💧', frequency: 'weekly', order: 0 },
            { id: '2', name: 'Tunsul', icon: '✂️', frequency: 'weekly', order: 1 },
            { id: '3', name: 'Îngrășământ', icon: '🌱', frequency: 'monthly', order: 2 },
          ];
          setActivities(mockData);
          toast.success('Mod demo: Deploy firestore:rules pentru date reale!');
        }
      }
    );

    return () => unsub();
  }, [userId, organizationId]);

  // Delete activity
  const handleDelete = async (id: string) => {
    if (!window.confirm('Ștergi această activitate?')) return;
    try {
      await deleteDoc(doc(db, 'user_activities', id));
      toast.success('Activitate ștearsă');
    } catch (err: any) {
      toast.error('Eroare: ' + err.message);
    }
  };

  // Save edit
  const handleSave = async (id: string) => {
    try {
      await updateDoc(doc(db, 'user_activities', id), editData);
      setEditingId(null);
      setEditData({});
      toast.success('Activitate actualizată');
    } catch (err: any) {
      toast.error('Eroare: ' + err.message);
    }
  };

  // Add new activity from template
  const handleAddActivity = async (template: typeof ACTIVITY_TEMPLATES[0]) => {
    try {
      await addDoc(collection(db, 'user_activities'), {
        userId,
        organizationId,
        name: template.name,
        icon: template.icon,
        frequency: template.defaultFreq,
        order: activities.length,
        createdAt: serverTimestamp(),
      });
      setShowAddModal(false);
      toast.success('Activitate adăugată');
    } catch (err: any) {
      toast.error('Eroare: ' + err.message);
    }
  };

  // Add custom activity
  const handleAddCustomActivity = async () => {
    if (!customName.trim()) {
      toast.error('Introdu un nume pentru activitate');
      return;
    }
    try {
      await addDoc(collection(db, 'user_activities'), {
        userId,
        organizationId,
        name: customName,
        icon: customEmoji,
        frequency: customFreq,
        order: activities.length,
        createdAt: serverTimestamp(),
      });
      setShowCustomModal(false);
      setCustomName('');
      setCustomEmoji('🌱');
      setCustomFreq('weekly');
      toast.success('Activitate custom adăugată');
    } catch (err: any) {
      toast.error('Eroare: ' + err.message);
    }
  };

  // Reorder via drag
  const handleDragEnd = async (draggedItem: Activity, targetItem: Activity) => {
    if (draggedItem.id === targetItem.id) return;

    const draggedOrder = draggedItem.order;
    const targetOrder = targetItem.order;

    try {
      await updateDoc(doc(db, 'user_activities', draggedItem.id), { order: targetOrder });
      await updateDoc(doc(db, 'user_activities', targetItem.id), { order: draggedOrder });
      toast.success('Ordine actualizată');
    } catch (err: any) {
      toast.error('Eroare: ' + err.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-text-secondary">Încărcare...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-main">Gestiune Activități</h3>
          <p className="text-sm text-text-secondary mt-1">Reordona, editează frecvență, șterge activități</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-accent-color/10 text-accent-color border border-accent-color/30 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-accent-color hover:text-white transition-all flex items-center gap-2"
        >
          <Plus size={14} /> Adaugă
        </button>
      </div>

      {/* Activities List */}
      <div className="space-y-2">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            Nu ai activități. Adaugă una pentru a începe!
          </div>
        ) : (
          activities.map((activity, idx) => (
            <div
              key={activity.id}
              draggable
              onDragStart={() => setDraggedId(activity.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedId && draggedId !== activity.id) {
                  const draggedItem = activities.find(a => a.id === draggedId);
                  if (draggedItem) handleDragEnd(draggedItem, activity);
                }
                setDraggedId(null);
              }}
              className={`p-4 rounded-xl border transition-all ${
                editingId === activity.id
                  ? 'bg-bg-card border-accent-color/30'
                  : 'bg-bg-main border-border-color hover:border-accent-color/30'
              } ${draggedId === activity.id ? 'opacity-50' : ''}`}
            >
              {editingId === activity.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{activity.icon}</span>
                    <input
                      type="text"
                      value={editData.name || activity.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="flex-1 bg-bg-main border border-border-color rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-accent-color"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-text-secondary uppercase block mb-2">Frecvență</label>
                    <select
                      value={editData.frequency || activity.frequency}
                      onChange={(e) => setEditData({ ...editData, frequency: e.target.value as any })}
                      className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-accent-color"
                    >
                      {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleSave(activity.id)}
                      className="flex-1 px-3 py-2 bg-accent-subtle text-accent-ink dark:text-accent-ink border border-accent-border rounded-lg text-xs font-black uppercase tracking-wider hover:bg-accent-color hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <Save size={14} /> Salvează
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditData({});
                      }}
                      className="flex-1 px-3 py-2 bg-bg-main border border-border-color rounded-lg text-xs font-black uppercase tracking-wider hover:border-red-500/30 hover:text-red-500 transition-all flex items-center justify-center gap-2"
                    >
                      <X size={14} /> Anulează
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <GripVertical size={16} className="text-text-secondary/40 shrink-0 cursor-grab active:cursor-grabbing" />
                    <span className="text-2xl shrink-0">{activity.icon}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-main">{activity.name}</p>
                      <p className="text-xs text-text-secondary">{FREQUENCY_LABELS[activity.frequency]}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-3">
                    <button
                      onClick={() => {
                        setEditingId(activity.id);
                        setEditData({ frequency: activity.frequency, name: activity.name });
                      }}
                      className="p-2 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg transition"
                      title="Editează"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(activity.id)}
                      className="p-2 hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg transition"
                      title="Șterge"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-bg-card border border-border-color rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border-color flex items-center justify-between sticky top-0 bg-bg-card">
              <h3 className="text-lg font-black text-main">Adaugă Activitate</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 hover:bg-bg-main rounded-lg transition text-text-secondary"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-3">
              {ACTIVITY_TEMPLATES.map((template) => (
                <button
                  key={template.name}
                  onClick={() => handleAddActivity(template)}
                  className="w-full flex items-center gap-3 p-4 bg-bg-main border border-border-color rounded-xl hover:border-accent-color/30 hover:bg-accent-color/5 transition text-left"
                >
                  <span className="text-2xl">{template.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-main">{template.name}</p>
                    <p className="text-xs text-text-secondary">{FREQUENCY_LABELS[template.defaultFreq]}</p>
                  </div>
                  <Plus size={16} className="text-accent-color shrink-0" />
                </button>
              ))}

              <div className="my-4 border-t border-border-color"></div>

              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowCustomModal(true);
                }}
                className="w-full flex items-center gap-3 p-4 bg-accent-color/10 border border-accent-color/30 rounded-xl hover:border-accent-color/60 hover:bg-accent-color/20 transition text-left"
              >
                <span className="text-2xl">✨</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-accent-color">Activitate Personalizată</p>
                  <p className="text-xs text-text-secondary">Crează propria activitate</p>
                </div>
                <Plus size={16} className="text-accent-color shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Activity Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-bg-card border border-border-color rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-border-color flex items-center justify-between">
              <h3 className="text-lg font-black text-main">Activitate Personalizată</h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="p-1.5 hover:bg-bg-main rounded-lg transition text-text-secondary"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-text-secondary uppercase block mb-2">Emoji (Simbol)</label>
                <input
                  type="text"
                  maxLength={2}
                  value={customEmoji}
                  onChange={(e) => setCustomEmoji(e.target.value || '🌱')}
                  className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-2xl text-center font-bold outline-none focus:border-accent-color"
                  placeholder="🌱"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary uppercase block mb-2">Nume Activitate</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-accent-color"
                  placeholder="Ex: Stropi manual"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text-secondary uppercase block mb-2">Frecvență Implicită</label>
                <select
                  value={customFreq}
                  onChange={(e) => setCustomFreq(e.target.value as any)}
                  className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-accent-color"
                >
                  {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="flex-1 px-3 py-2 bg-bg-main border border-border-color rounded-lg text-xs font-black uppercase tracking-wider hover:border-red-500/30 hover:text-red-500 transition-all"
                >
                  <X size={14} className="inline mr-1" /> Anulează
                </button>
                <button
                  onClick={handleAddCustomActivity}
                  className="flex-1 px-3 py-2 bg-accent-color text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-accent-color/90 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> Adaugă
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
