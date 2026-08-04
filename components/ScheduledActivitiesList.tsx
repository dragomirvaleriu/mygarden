import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScheduledActivity } from '../src/types';
import { Check, Trash2, Calendar, Clock, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { updateDoc, doc, deleteDoc } from '../services/firebase';
import toast from 'react-hot-toast';

interface Props {
  activities: ScheduledActivity[];
  userId: string;
  onActivityCompleted?: () => void;
}

const ScheduledActivitiesList: React.FC<Props> = ({
  activities,
  userId,
  onActivityCompleted,
}) => {
  const { t } = useTranslation();

  const sortedActivities = useMemo(() => {
    return [...activities]
      .filter(a => !a.completed)
      .sort((a, b) => {
        const dateA = a.nextDate?.toDate ? a.nextDate.toDate() : new Date(a.nextDate);
        const dateB = b.nextDate?.toDate ? b.nextDate.toDate() : new Date(b.nextDate);
        return dateA.getTime() - dateB.getTime();
      });
  }, [activities]);

  const handleMarkComplete = async (activity: ScheduledActivity) => {
    try {
      const docRef = doc(
        window.database || require('../services/firebase').db,
        'scheduled_activities',
        activity.id
      );

      let updateData: any = {
        completed: true,
        completedAt: new Date(),
        lastCompletedAt: new Date(),
      };

      if (activity.frequency !== 'once') {
        const frequencyDays: Record<string, number> = {
          weekly: 7,
          biweekly: 14,
          monthly: 30,
          quarterly: 90,
        };

        const nextDate = new Date(
          activity.nextDate?.toDate ? activity.nextDate.toDate() : new Date(activity.nextDate)
        );
        nextDate.setDate(nextDate.getDate() + (frequencyDays[activity.frequency] || 7));

        updateData = {
          ...updateData,
          completed: false,
          completedAt: null,
          nextDate: nextDate,
        };
      }

      await updateDoc(docRef, updateData);
      toast.success(`✓ ${activity.name} marcată ca executată!`);
      onActivityCompleted?.();
    } catch (err: any) {
      toast.error('Eroare: ' + err.message);
    }
  };

  const handleDelete = async (activity: ScheduledActivity) => {
    if (!window.confirm(`Șterge "${activity.name}"?`)) return;

    try {
      await deleteDoc(
        doc(
          window.database || require('../services/firebase').db,
          'scheduled_activities',
          activity.id
        )
      );
      toast.success('Activitate ștearsă');
      onActivityCompleted?.();
    } catch (err: any) {
      toast.error('Eroare: ' + err.message);
    }
  };

  if (sortedActivities.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 space-y-3">
      <div className="flex items-center gap-2 px-4">
        <Calendar size={18} className="text-accent-color" />
        <h3 className="text-sm font-black text-main uppercase tracking-wider">
          Activități Programate
        </h3>
        <span className="ml-auto text-xs font-bold text-accent-color bg-accent-color/10 px-2 py-1 rounded-full">
          {sortedActivities.length}
        </span>
      </div>

      <div className="space-y-2 px-4">
        {sortedActivities.map((activity) => {
          const nextDate = activity.nextDate?.toDate
            ? activity.nextDate.toDate()
            : new Date(activity.nextDate);
          const isToday = new Date().toDateString() === nextDate.toDateString();
          const isSoon = nextDate.getTime() - new Date().getTime() < 24 * 60 * 60 * 1000;

          return (
            <div
              key={activity.id}
              className={`p-3 rounded-lg border transition flex items-center gap-3 ${
                isToday
                  ? 'bg-accent-subtle dark:bg-accent-subtle border-accent-border dark:border-accent-border'
                  : isSoon
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                  : 'bg-bg-main border-border-color'
              }`}
            >
              {/* Icon & Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{activity.icon}</span>
                  <span className="font-bold text-sm text-main">{activity.name}</span>
                </div>

                {/* Date & Time Info */}
                <div className="flex items-center gap-3 text-xs text-text-secondary font-medium">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    {format(nextDate, 'd MMM', { locale: ro })}
                  </div>
                  <div className="flex items-center gap-1">
                    <Bell size={12} />
                    {activity.notifyBefore === 0
                      ? 'Imediat'
                      : `${activity.notifyBefore}h înainte`}
                  </div>
                </div>

                {/* Notes */}
                {activity.notes && (
                  <p className="text-[10px] text-text-secondary italic mt-1 line-clamp-1">
                    {activity.notes}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleMarkComplete(activity)}
                  className="p-2 rounded-lg hover:bg-accent-color/20 text-accent-ink dark:text-accent-ink transition"
                  title="Marcheaza ca executata"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => handleDelete(activity)}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-red-600 dark:text-red-400 transition"
                  title="Sterge"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduledActivitiesList;
