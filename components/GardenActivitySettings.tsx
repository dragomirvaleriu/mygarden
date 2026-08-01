import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScheduledActivity } from '../src/types';
import {
  Calendar, Edit2, Trash2, Plus, Clock, Bell, Repeat2,
  AlertCircle, CheckCircle2, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  collection, query, where, onSnapshot, deleteDoc, doc, updateDoc
} from '../services/firebase';
import { db } from '../services/firebase';
import toast from 'react-hot-toast';

interface Props {
  userId: string;
  organizationId: string;
  onAddActivity?: () => void;
}

const FREQUENCY_LABELS: Record<string, string> = {
  once: 'O dată',
  weekly: 'Săptămânal',
  biweekly: 'O dată la 2 săptămâni',
  monthly: 'Lunar',
  quarterly: 'Trimestrial',
};

const GardenActivitySettings: React.FC<Props> = ({
  userId,
  organizationId,
  onAddActivity,
}) => {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<ScheduledActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ScheduledActivity>>({});

  useEffect(() => {
    const q = query(
      collection(db, 'scheduled_activities'),
      where('userId', '==', userId),
      where('organizationId', '==', organizationId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ScheduledActivity[];
      setActivities(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, organizationId]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Ștergi această activitate?')) return;
    try {
      await deleteDoc(doc(db, 'scheduled_activities', id));
      toast.success('Activitate ștearsă');
    } catch (err: any) {
      toast.error('Eroare: ' + err.message);
    }
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateDoc(doc(db, 'scheduled_activities', id), editData);
      setEditingId(null);
      setEditData({});
      toast.success('Activitate actualizată');
    } catch (err: any) {
      toast.error('Eroare: ' + err.message);
    }
  };

  const upcomingActivities = activities
    .filter(a => !a.completed)
    .sort((a, b) => {
      const dateA = a.nextDate?.toDate ? a.nextDate.toDate() : new Date(a.nextDate);
      const dateB = b.nextDate?.toDate ? b.nextDate.toDate() : new Date(b.nextDate);
      return dateA.getTime() - dateB.getTime();
    });

  const completedActivities = activities.filter(a => a.completed);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Calendar size={20} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-black text-main">Activități Grădină</h2>
          <p className="text-xs text-text-secondary font-medium mt-1">
            Programează și gestionează activitățile de întreținere
          </p>
        </div>
        <button
          onClick={onAddActivity}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-lg hover:shadow-lg transition flex items-center gap-2"
        >
          <Plus size={18} />
          Adaugă
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-text-secondary">Încărcare...</div>
      ) : upcomingActivities.length === 0 ? (
        <div className="text-center py-12">
          <Calendar size={48} className="mx-auto text-text-secondary/30 mb-3" />
          <p className="text-text-secondary font-medium">Nicio activitate programată</p>
          <p className="text-xs text-text-secondary/70">Programează prima ta activitate de grădină</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Upcoming Activities */}
          <div>
            <h3 className="text-xs font-black text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
              <CheckCircle2 size={14} />
              Activități Programate ({upcomingActivities.length})
            </h3>

            <div className="space-y-2">
              {upcomingActivities.map((activity) => {
                const nextDate = activity.nextDate?.toDate
                  ? activity.nextDate.toDate()
                  : new Date(activity.nextDate);
                const isToday = new Date().toDateString() === nextDate.toDateString();
                const isSoon = nextDate.getTime() - new Date().getTime() < 24 * 60 * 60 * 1000;

                return (
                  <div
                    key={activity.id}
                    className={`p-4 rounded-lg border transition ${
                      isToday
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
                        : isSoon
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                        : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {editingId === activity.id ? (
                      // Edit Mode
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{activity.icon}</span>
                          <span className="font-bold text-sm text-main">{activity.name}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-text-secondary">Frecvență</label>
                            <select
                              value={editData.frequency || activity.frequency}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  frequency: e.target.value as any,
                                })
                              }
                              className="w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs font-medium"
                            >
                              {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-text-secondary">Data Următoare</label>
                            <input
                              type="date"
                              value={(editData.nextDate instanceof Date
                                ? editData.nextDate.toISOString().split('T')[0]
                                : nextDate.toISOString().split('T')[0])}
                              onChange={(e) =>
                                setEditData({ ...editData, nextDate: new Date(e.target.value) })
                              }
                              className="w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs font-medium"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="text-xs font-bold text-text-secondary">Notificare (ore)</label>
                            <input
                              type="number"
                              min="0"
                              max="72"
                              value={editData.notifyBefore ?? activity.notifyBefore}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  notifyBefore: parseInt(e.target.value),
                                })
                              }
                              className="w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs font-medium"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleSaveEdit(activity.id)}
                            className="flex-1 px-3 py-2 bg-emerald-500 text-white font-bold text-xs rounded hover:bg-emerald-600 transition"
                          >
                            Salvează
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditData({});
                            }}
                            className="flex-1 px-3 py-2 bg-slate-300 text-slate-900 font-bold text-xs rounded hover:bg-slate-400 transition"
                          >
                            Anulează
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{activity.icon}</span>
                            <span className="font-bold text-sm text-main">{activity.name}</span>
                            {isToday && (
                              <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                                AZI
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-3 text-xs font-medium text-text-secondary">
                            <div className="flex items-center gap-1">
                              <Calendar size={12} />
                              {format(nextDate, 'd MMM', { locale: ro })}
                            </div>
                            <div className="flex items-center gap-1">
                              <Repeat2 size={12} />
                              {FREQUENCY_LABELS[activity.frequency]}
                            </div>
                            <div className="flex items-center gap-1">
                              <Bell size={12} />
                              {activity.notifyBefore === 0
                                ? 'Imediat'
                                : `${activity.notifyBefore}h`}
                            </div>
                          </div>

                          {activity.notes && (
                            <p className="text-[10px] text-text-secondary italic mt-2 line-clamp-1">
                              📝 {activity.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-1 shrink-0 ml-3">
                          <button
                            onClick={() => {
                              setEditingId(activity.id);
                              setEditData({});
                            }}
                            className="p-2 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg transition"
                            title="Editează"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(activity.id)}
                            className="p-2 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition"
                            title="Șterge"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Completed Activities */}
          {completedActivities.length > 0 && (
            <div className="pt-6 border-t border-border-color">
              <h3 className="text-xs font-black text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertCircle size={14} />
                Completate ({completedActivities.length})
              </h3>
              <div className="space-y-2">
                {completedActivities.slice(0, 3).map((activity) => (
                  <div
                    key={activity.id}
                    className="p-3 rounded-lg bg-slate-100 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-600 opacity-60 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{activity.icon}</span>
                      <div>
                        <p className="text-sm font-bold text-main line-through">
                          {activity.name}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {activity.completedAt &&
                            format(
                              activity.completedAt?.toDate
                                ? activity.completedAt.toDate()
                                : new Date(activity.completedAt),
                              'd MMM, HH:mm',
                              { locale: ro }
                            )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(activity.id)}
                      className="p-2 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GardenActivitySettings;
