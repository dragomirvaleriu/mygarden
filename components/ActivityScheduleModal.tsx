import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Bell, Calendar, Repeat2, Trash2 } from 'lucide-react';
import { db, addDoc, collection, serverTimestamp, updateDoc, doc, deleteDoc } from '../services/firebase';
import toast from 'react-hot-toast';

interface Props {
  organizationId: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onActivityAdded?: () => void;
}

interface ScheduledActivity {
  id?: string;
  name: string;
  icon: string;
  frequency: 'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  nextDate: Date;
  notifyBefore: number; // hours
  notes?: string;
}

const ACTIVITY_TYPES = [
  { name: 'Tunsul', icon: '🔪', emoji: 'mowing', defaultFreq: 'weekly' },
  { name: 'Îngrăşământul Solid', icon: '🌱', emoji: 'fertilizing-solid', defaultFreq: 'monthly' },
  { name: 'Foliare', icon: '💨', emoji: 'foliar-spray', defaultFreq: 'weekly' },
  { name: 'Irigare', icon: '💧', emoji: 'watering', defaultFreq: 'weekly' },
  { name: 'Aerare', icon: '🌍', emoji: 'aeration', defaultFreq: 'quarterly' },
  { name: 'Scarificare', icon: '🧹', emoji: 'scarification', defaultFreq: 'quarterly' },
  { name: 'Top-dressing', icon: '⬆️', emoji: 'top-dressing', defaultFreq: 'quarterly' },
  { name: 'Tratament Fungicid', icon: '🍄', emoji: 'fungicide', defaultFreq: 'once' },
  { name: 'Tratament Insecticid', icon: '🐛', emoji: 'insecticide', defaultFreq: 'once' },
  { name: 'Testare pH Sol', icon: '📊', emoji: 'soil-test', defaultFreq: 'quarterly' },
  { name: 'Replantare Semințe', icon: '🌱', emoji: 'reseeding', defaultFreq: 'once' },
  { name: 'Pregătire Iernare', icon: '❄️', emoji: 'winterization', defaultFreq: 'once' },
];

const FREQUENCY_LABELS: Record<string, { label: string; days: number }> = {
  once: { label: 'O dată', days: 0 },
  weekly: { label: 'Săptămânal', days: 7 },
  biweekly: { label: 'O dată la 2 săptămâni', days: 14 },
  monthly: { label: 'Lunar', days: 30 },
  quarterly: { label: 'Trimestrial', days: 90 },
};

const ActivityScheduleModal: React.FC<Props> = ({
  organizationId,
  userId,
  isOpen,
  onClose,
  onActivityAdded,
}) => {
  const { t } = useTranslation();
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [frequency, setFrequency] = useState<'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'>('weekly');
  const [nextDate, setNextDate] = useState(new Date().toISOString().split('T')[0]);
  const [notifyBefore, setNotifyBefore] = useState(24);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity || !nextDate) {
      toast.error('Alege o activitate și o dată');
      return;
    }

    setIsSubmitting(true);
    try {
      const activity = ACTIVITY_TYPES.find(a => a.name === selectedActivity);
      if (!activity) throw new Error('Invalid activity');

      await addDoc(collection(db, 'scheduled_activities'), {
        organizationId,
        userId,
        name: activity.name,
        icon: activity.icon,
        emoji: activity.emoji,
        frequency,
        nextDate: new Date(nextDate),
        notifyBefore,
        notes: notes || null,
        createdAt: serverTimestamp(),
        completed: false,
        completedAt: null,
      });

      toast.success(`${activity.name} programată cu succes!`);
      setSelectedActivity('');
      setFrequency('weekly');
      setNextDate(new Date().toISOString().split('T')[0]);
      setNotifyBefore(24);
      setNotes('');
      onActivityAdded?.();
      onClose();
    } catch (err: any) {
      toast.error('Eroare: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="w-full md:w-96 bg-bg-card border border-border-color rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 md:slide-in-from-center">
        {/* Header */}
        <div className="sticky top-0 bg-bg-card border-b border-border-color p-4 flex items-center justify-between rounded-t-3xl md:rounded-t-2xl">
          <h2 className="text-lg font-black text-main flex items-center gap-2">
            <Calendar size={20} className="text-accent-color" />
            Programează Activitate
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-main rounded-lg transition-colors text-text-secondary"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* Activity Type Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-text-secondary uppercase tracking-wider">
              Tip Activitate
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ACTIVITY_TYPES.map((activity) => (
                <button
                  key={activity.name}
                  type="button"
                  onClick={() => {
                    setSelectedActivity(activity.name);
                    setFrequency(activity.defaultFreq as any);
                  }}
                  className={`py-3 px-2 rounded-lg font-bold text-xs transition flex flex-col items-center gap-1 ${
                    selectedActivity === activity.name
                      ? 'bg-accent-color/20 text-accent-color border border-accent-color/40'
                      : 'bg-bg-main text-text-secondary hover:text-main border border-border-color'
                  }`}
                >
                  <span className="text-xl">{activity.icon}</span>
                  <span className="text-[10px] text-center">{activity.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <Repeat2 size={14} />
              Frecvență
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
              className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2.5 text-sm font-medium outline-none focus:border-accent-color transition"
            >
              {Object.entries(FREQUENCY_LABELS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          {/* Next Date */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <Calendar size={14} />
              Următoarea dată
            </label>
            <input
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2.5 text-sm font-medium outline-none focus:border-accent-color transition"
            />
          </div>

          {/* Notification Time */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <Bell size={14} />
              Notificare cu (ore)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[0, 6, 12, 24].map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => setNotifyBefore(hours)}
                  className={`py-2 px-3 rounded-lg font-bold text-xs transition ${
                    notifyBefore === hours
                      ? 'bg-accent-color/20 text-accent-color border border-accent-color/40'
                      : 'bg-bg-main text-text-secondary hover:text-main border border-border-color'
                  }`}
                >
                  {hours === 0 ? 'Imediat' : `${hours}h`}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-text-secondary uppercase tracking-wider">
              Note (Opțional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Aplică la 1-2L/mp, vezi formula..."
              className="w-full bg-bg-main border border-border-color rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-accent-color transition resize-none h-20"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !selectedActivity}
            className="w-full py-3 px-4 bg-gradient-to-r from-accent-color to-accent-hover text-white font-bold rounded-lg hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Programează Activitate
          </button>
        </form>
      </div>
    </div>
  );
};

export default ActivityScheduleModal;
