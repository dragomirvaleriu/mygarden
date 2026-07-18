import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, Timestamp, addDoc } from '../services/firebase';
import { auth } from '../services/firebase';
import { TimeLog } from '../src/types';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Square, Clock, Coffee, CheckCircle2, Loader2, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Props {
  organizationId: string;
}

const TimeTrackingWidget: React.FC<Props> = ({ organizationId }) => {
  const { t } = useTranslation();
  const [timeLog, setTimeLog] = useState<TimeLog | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLocating, setIsLocating] = useState(false);

  const currentUid = auth.currentUser?.uid;
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!organizationId || !currentUid) return;

    const q = query(
      collection(db, 'time_logs'),
      where('userId', '==', currentUid)
    );

    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeLog));
      // Filter in memory to avoid needing a composite index
      const todayLogs = data.filter(d => d.organizationId === organizationId && d.date === today);
      
      if (todayLogs.length > 0) {
        setTimeLog(todayLogs[0]);
      } else {
        setTimeLog(null);
      }
      setLoading(false);
    }, err => {
      console.error("TimeTrackingWidget err:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [organizationId, currentUid, today]);

  // Timer logic
  useEffect(() => {
    if (!timeLog || timeLog.status === 'finished') {
      return;
    }

    const calculateElapsed = () => {
      const start = timeLog.startTime?.toDate();
      if (!start) return 0;

      let total = Date.now() - start.getTime();

      // Subtract break times
      if (timeLog.breaks && timeLog.breaks.length > 0) {
        timeLog.breaks.forEach(b => {
          if (b.end) {
            const actualEnd = Math.min(b.end.toDate().getTime(), Date.now());
            const breakStartMs = b.start.toDate().getTime();
            if (actualEnd > breakStartMs) {
                total -= (actualEnd - breakStartMs);
            }
          } else {
            // Currently on break
            total -= (Date.now() - b.start.toDate().getTime());
          }
        });
      }
      return Math.floor(Math.max(0, total) / 1000);
    };

    setElapsedSeconds(calculateElapsed());
    const interval = setInterval(() => {
      setElapsedSeconds(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLog]);

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStartWork = async () => {
    try {
      if (timeLog) {
        toast.error(t('You already have a time log for today.'));
        return;
      }
      
      if (!navigator.geolocation) {
        toast.error(t('Geolocation is not supported by your browser.'));
        return;
      }

      setIsLocating(true);
      toast.loading(t('Preluăm locația...'), { id: 'location-toast' });

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await addDoc(collection(db, 'time_logs'), {
              organizationId,
              userId: currentUid,
              userName: auth.currentUser?.displayName || auth.currentUser?.email || t('Employee'),
              date: today,
              startTime: Timestamp.now(),
              breaks: [],
              status: 'working',
              location: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              }
            });
            toast.dismiss('location-toast');
            toast.success(t('Work day started!'));
          } catch (err: any) {
            toast.dismiss('location-toast');
            toast.error(t('Error starting work:') + ' ' + err.message);
          } finally {
            setIsLocating(false);
          }
        },
        (error) => {
          toast.dismiss('location-toast');
          setIsLocating(false);
          let errorMessage = t('Location access is required to clock in.');
          if (error.code === error.PERMISSION_DENIED) {
            errorMessage = t('Permisiune locație refuzată. Te rugăm să permiți accesul la locație pentru a te ponta.');
          }
          toast.error(errorMessage);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );

    } catch (err: any) {
      setIsLocating(false);
      toast.dismiss('location-toast');
      toast.error(t('Error starting work:') + ' ' + err.message);
    }
  };

  const handleAddBreak = async (minutes: number) => {
    if (!timeLog) return;
    try {
      const nowMs = Date.now();
      const endMs = nowMs + (minutes * 60000);
      const newBreak = { 
        start: Timestamp.fromMillis(nowMs),
        end: Timestamp.fromMillis(endMs),
        durationMinutes: minutes
      };
      const newBreaks = [...(timeLog.breaks || []), newBreak];
      await updateDoc(doc(db, 'time_logs', timeLog.id), {
        breaks: newBreaks
      });
      toast.success(t(`Break of ${minutes}m added. Have a good rest!`));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleEndWork = async () => {
    if (!timeLog) return;
    try {
      let breaks = timeLog.breaks ? [...timeLog.breaks] : [];
      // Since breaks are pre-defined lengths, we don't need to close an open break

      const endTimestamp = Timestamp.now();
      const endMs = endTimestamp.toDate().getTime();
      const startMs = timeLog.startTime.toDate().getTime();
      let totalBreakMs = 0;
      breaks.forEach(b => {
        if (b.start && b.end) {
          const actualEnd = Math.min(b.end.toDate().getTime(), endMs);
          const breakStartMs = b.start.toDate().getTime();
          if (actualEnd > breakStartMs) {
             totalBreakMs += (actualEnd - breakStartMs);
          }
        }
      });

      const totalWorkMs = (endTimestamp.toDate().getTime() - startMs) - totalBreakMs;
      const totalWorkMinutes = Math.max(0, Math.round(totalWorkMs / 60000));
      
      const standardMinutes = 8 * 60; // 8 hours standard
      const overtimeMinutes = Math.max(0, totalWorkMinutes - standardMinutes);

      await updateDoc(doc(db, 'time_logs', timeLog.id), {
        endTime: endTimestamp,
        breaks,
        status: 'finished',
        totalWorkMinutes,
        overtimeMinutes
      });
      toast.success(t('Work day finished. Good job!'));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return <div className="h-32 bg-bg-card animate-pulse rounded-xl border border-border-color" />;
  }

  return (
    <div className="bg-bg-card border border-border-color rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-black text-text-secondary uppercase tracking-widest flex items-center gap-2">
          <Clock size={14} className="text-accent-color" />
          {t('Time Tracking')}
        </h2>
        
        {timeLog && (
          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
            timeLog.status === 'working' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
            timeLog.status === 'on_break' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
            'bg-blue-500/10 text-blue-500 border border-blue-500/20'
          }`}>
            {timeLog.status === 'working' ? t('Working') : 
             timeLog.status === 'on_break' ? t('On Break') : t('Finished')}
          </span>
        )}
      </div>

      {!timeLog ? (
        <div className="text-center py-6">
          <p className="text-sm font-bold text-main mb-4">{t('You havent started your work day yet.')}</p>
          <button 
            onClick={handleStartWork}
            disabled={isLocating}
            className="bg-accent-color hover:bg-accent-color/90 text-white font-bold py-3 px-6 rounded-xl w-full flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-accent-color/20 disabled:opacity-70"
          >
            {isLocating ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            {isLocating ? t('Verificare locație...') : t('Clock In / Start Day')}
          </button>
        </div>
      ) : (
        <div>
          <div className="text-center mb-6">
            <div className={`text-4xl font-black tabular-nums tracking-tighter ${
              timeLog.status === 'working' ? 'text-main' : 
              timeLog.status === 'on_break' ? 'text-amber-500' : 'text-text-secondary'
            }`}>
              {timeLog.status === 'finished' ? formatElapsed((timeLog.totalWorkMinutes || 0) * 60) : formatElapsed(elapsedSeconds)}
            </div>
            <div className="text-[11px] font-bold text-text-secondary uppercase tracking-widest mt-1">
              {t('Total Hours Worked Today')}
            </div>
          </div>

          {timeLog.status !== 'finished' && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[15, 30, 45, 60].map(mins => (
                <button 
                  key={mins}
                  onClick={() => handleAddBreak(mins)}
                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors active:scale-95"
                >
                  <Coffee size={14} />
                  <span className="text-xs">{mins}m</span>
                </button>
              ))}
              
              <button 
                onClick={handleEndWork}
                className="flex-1 min-w-[140px] bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-sm shadow-red-500/20"
              >
                <Square size={16} />
                {t('Clock Out')}
              </button>
            </div>
          )}

          {timeLog.status === 'finished' && (
            <div className="flex items-center justify-center gap-2 text-green-500 font-bold bg-green-500/10 p-3 rounded-xl border border-green-500/20">
              <CheckCircle2 size={18} />
              {t('Work day successfully logged!')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimeTrackingWidget;
