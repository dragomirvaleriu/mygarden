import React, { useState, useEffect, useMemo } from 'react';
import { checkFutureVisitExists } from '../services/visitUtils';
import { db, collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, Timestamp, addDoc } from '../services/firebase';
import { auth } from '../services/firebase';
import { Visit, Page } from '../src/types';
import { format, isToday, parseISO } from 'date-fns';
import { ro, enUS, pl, cs } from 'date-fns/locale';
import { MapPin, Play, Square, CheckCircle2, Clock, Navigation, Calendar, User } from 'lucide-react';
import { getMapsUrl } from '../utils/maps';
import { getDoc, writeBatch } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import TimeTrackingWidget from '../components/TimeTrackingWidget';
import MyStatsWidget from '../components/MyStatsWidget';

interface Props {
  organizationId: string;
  onNavigate: (page: Page, id?: string) => void;
}

const EmployeeDashboard: React.FC<Props> = ({ organizationId, onNavigate }) => {
  const { t, i18n } = useTranslation();
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  const locales: any = { ro, en: enUS, pl, cs };
  const currentLocale = locales[i18n.language] || locales.ro;

  const today = format(new Date(), 'yyyy-MM-dd');
  const currentUid = auth.currentUser?.uid;

  useEffect(() => {
    setUserName(auth.currentUser?.displayName || auth.currentUser?.email || t('Employee'));
  }, [t]);

  // Listen to today's visits assigned to me
  useEffect(() => {
    if (!organizationId || !currentUid) return;

    const q = query(
      collection(db, 'visits'),
      where('organizationId', '==', organizationId),
      where('assignedTo', '==', currentUid)
    );

    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Visit));
      const todays = all.filter(v => v.data === today || v.status === 'Activ');
      todays.sort((a, b) => {
        const timeA = a.oraProgramare || '00:00';
        const timeB = b.oraProgramare || '00:00';
        return timeA.localeCompare(timeB);
      });
      setTodayVisits(todays);

      const active = all.find(v => v.status === 'Activ');
      setActiveVisit(active || null);
      setLoading(false);
    });

    return () => unsub();
  }, [organizationId, currentUid, today]);

  // Timer for active visit
  useEffect(() => {
    if (!activeVisit) { setElapsedSeconds(0); return; }
    const startTime = activeVisit.currentSessionStart?.toDate() || new Date();

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeVisit?.id]);

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStart = async (visit: Visit) => {
    if (activeVisit) {
      alert(t('You already have an active visit! Finish it first.'));
      return;
    }
    try {
      await updateDoc(doc(db, 'visits', visit.id), {
        status: 'Activ',
        currentSessionStart: serverTimestamp(),
      });
    } catch (err: any) {
      alert(t('Error starting') + ': ' + err.message);
    }
  };

  const handleStop = async () => {
    if (!activeVisit) return;
    try {
      const startTime = activeVisit.currentSessionStart?.toDate() || new Date();
      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

      await updateDoc(doc(db, 'visits', activeVisit.id), {
        status: 'Finalizat',
        completedAt: serverTimestamp(),
        currentSessionStart: null,
        data: format(startTime, 'yyyy-MM-dd'),
        workSessions: [
          ...(activeVisit.workSessions || []),
          { start: Timestamp.fromDate(startTime), end: Timestamp.fromDate(endTime), duration }
        ]
      });

      await addDoc(collection(db, 'client_history'), {
        clientId: activeVisit.clientId,
        organizationId,
        visitId: activeVisit.id,
        type: 'visit_completion',
        date: serverTimestamp(),
        startTime: Timestamp.fromDate(startTime),
        duration,
        performedBy: currentUid,
        performedByName: auth.currentUser?.displayName || auth.currentUser?.email,
        photos: activeVisit.photos || [],
        details: t('Finished after {{duration}} minutes', { duration })
      });

      // Route Recalculation Invalidation Logic
      const todaysActiveVisits = todayVisits.filter(v => 
          (v.status === 'Programat' || v.status === 'Activ') &&
          v.id !== activeVisit.id
      ).sort((a, b) => {
          const aIdx = a.orderIndex !== undefined ? a.orderIndex : 999;
          const bIdx = b.orderIndex !== undefined ? b.orderIndex : 999;
          return aIdx - bIdx;
      });

      if (todaysActiveVisits.length > 0) {
          const thisVisitOrder = activeVisit.orderIndex !== undefined ? activeVisit.orderIndex : 999;
          const firstRemainingOrder = todaysActiveVisits[0].orderIndex !== undefined ? todaysActiveVisits[0].orderIndex : 999;

          if (thisVisitOrder > firstRemainingOrder && thisVisitOrder !== 999) {
              const batch = writeBatch(db);
              todaysActiveVisits.forEach(v => {
                  if (v.orderIndex !== undefined) {
                      batch.update(doc(db, 'visits', v.id), { orderIndex: null });
                  }
              });
              await batch.commit();
          }
      }

      // Automatic Scheduling Logic
      if (!activeVisit.nextVisitScheduled) {
        const clientRef = doc(db, 'clients', activeVisit.clientId);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
            const clientData = clientSnap.data() as any;

            // Property-level config takes priority (multi-address support)
            let contractType = clientData.contractType;
            let freq = clientData.maintenanceFrequency || 'weekly';

            if (activeVisit.propertyId) {
                // Check if this specific property has its own config
                const propRef = doc(db, 'properties', activeVisit.propertyId);
                const propSnap = await getDoc(propRef);
                if (propSnap.exists()) {
                    const pData = propSnap.data();
                    if (pData.contractType) {
                        contractType = pData.contractType;
                        freq = pData.maintenanceFrequency || 'weekly';
                    }
                }
            }

            if (contractType === 'maintenance' && freq !== 'occasional') {
                let nextDate = new Date();
                nextDate.setHours(0, 0, 0, 0);
                let shouldSchedule = false;

                switch (freq) {
                    case 'weekly': nextDate.setDate(nextDate.getDate() + 7); shouldSchedule = true; break;
                    case 'biweekly': nextDate.setDate(nextDate.getDate() + 14); shouldSchedule = true; break;
                    case 'monthly': nextDate.setDate(nextDate.getDate() + 28); shouldSchedule = true; break;
                }

                if (shouldSchedule) {
                    const startHours = startTime.getHours();
                    const startMinutes = startTime.getMinutes();
                    const formattedTime = `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`;
                    nextDate.setHours(startHours, startMinutes, 0, 0);

                    // Ensure working day (basic check — no workDays config available here, default L-S)
                    while (nextDate.getDay() === 0) {
                        nextDate.setDate(nextDate.getDate() + 1);
                    }

                    const hasFuture = await checkFutureVisitExists(activeVisit.clientId, activeVisit.propertyId || null);

                    if (!hasFuture) {
                        await addDoc(collection(db, 'visits'), {
                            clientId: activeVisit.clientId,
                            clientName: clientData.nume || 'Client',
                            clientAddress: activeVisit.propertyAddress || clientData.adresa || '',
                            organizationId: organizationId,
                            status: 'Programat',
                            data: format(nextDate, 'yyyy-MM-dd'),
                            oraProgramare: formattedTime,
                            tipLucrare: 'Mentenanță',
                            createdAt: serverTimestamp(),
                            propertyId: activeVisit.propertyId || null,
                            propertyAddress: activeVisit.propertyAddress || '',
                            propertyMapsLink: activeVisit.propertyMapsLink || '',
                            detalii: 'Programare automată conform contractului de mentenanță',
                            assignedTo: activeVisit.assignedTo || auth.currentUser?.uid || '',
                            assignedToName: activeVisit.assignedToName || auth.currentUser?.displayName || auth.currentUser?.email || ''
                        });
                    }

                    await updateDoc(doc(db, 'visits', activeVisit.id), {
                      nextVisitScheduled: true
                    });
                }
            }
        }
      }

    } catch (err: any) {
      alert(t('Error finishing') + ': ' + err.message);
    }
  };

  const completedToday = todayVisits.filter(v => v.status === 'Finalizat').length;
  const totalToday = todayVisits.length;
  const progressPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  return (
    <div className="space-y-5 pb-24 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-main">{t('Good day!')} 👋</h1>
          <p className="text-sm text-text-secondary font-medium">{userName} · {format(new Date(), 'EEEE, d MMMM yyyy', { locale: currentLocale })}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-accent-color">{completedToday}/{totalToday}</div>
          <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{t('visits today')}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-bg-main rounded-full overflow-hidden border border-border-color">
        <div
          className="h-full bg-gradient-to-r from-accent-color to-green-500 rounded-full transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Time Tracking Widget */}
      <TimeTrackingWidget organizationId={organizationId} />

      {/* Stats Widget */}
      <MyStatsWidget organizationId={organizationId} onNavigate={onNavigate} />

      {/* Active visit timer */}
      {activeVisit && (
        <div className="bg-accent-color/10 border-2 border-accent-color rounded-2xl p-5 animate-in zoom-in duration-300">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2.5 h-2.5 bg-accent-color rounded-full animate-pulse" />
            <span className="text-xs font-black text-accent-color uppercase tracking-widest">{t('Active Visit')}</span>
          </div>
          <p className="text-lg font-black text-main leading-tight mb-1">{activeVisit.clientName}</p>
          {activeVisit.propertyAddress && (
            <p className="text-xs text-text-secondary mb-4 flex items-center gap-1">
              <MapPin size={11} /> {activeVisit.propertyAddress}
            </p>
          )}

          {/* Timer display */}
          <div className="text-center my-4">
            <div className="text-5xl font-black tabular-nums text-main tracking-tighter">
              {formatElapsed(elapsedSeconds)}
            </div>
            <div className="text-[11px] font-bold text-text-secondary uppercase tracking-widest mt-1">{t('time elapsed')}</div>
          </div>

          <div className="flex gap-3">
            {activeVisit.propertyMapsLink && (
              <a
                href={getMapsUrl(activeVisit.propertyAddress, activeVisit.propertyMapsLink, activeVisit.latitude, activeVisit.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 transition-all active:scale-95"
              >
                <Navigation size={16} /> {t('Map')}
              </a>
            )}
            <button
              onClick={handleStop}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-all active:scale-95"
            >
              <Square size={16} /> {t('Finish')}
            </button>
          </div>
        </div>
      )}

      {/* Today's visits list */}
      <div>
        <h2 className="text-xs font-black text-text-secondary uppercase tracking-widest mb-3 flex items-center gap-2">
          <Calendar size={12} /> {t('Todays Schedule')}
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-bg-card rounded-xl border border-border-color animate-pulse" />
            ))}
          </div>
        ) : todayVisits.length === 0 ? (
          <div className="text-center py-12 bg-bg-card rounded-2xl border border-border-color">
            <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
            <p className="text-sm font-bold text-main">{t('You have no visits scheduled today!')}</p>
            <p className="text-xs text-text-secondary mt-1">{t('Day off or check with manager.')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayVisits.map(visit => {
              const isDone = visit.status === 'Finalizat';
              const isActive = visit.status === 'Activ';
              return (
                <div
                  key={visit.id}
                  className={`bg-bg-card rounded-xl border p-4 transition-all ${
                    isActive ? 'border-accent-color shadow-[0_0_16px_rgba(240,125,0,0.15)]' :
                    isDone ? 'border-green-500/30 opacity-60' : 'border-border-color'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {visit.oraProgramare && (
                          <span className="text-[11px] font-black text-accent-color flex items-center gap-1">
                            <Clock size={10} /> {visit.oraProgramare}
                          </span>
                        )}
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                          isDone ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          isActive ? 'bg-accent-color/20 text-accent-color' :
                          'bg-bg-main text-text-secondary'
                        }`}>
                          {isDone ? `✓ ${t('Finished')}` : isActive ? `● ${t('Active')}` : t('Scheduled')}
                        </span>
                      </div>
                      <p className="text-sm font-black text-main truncate">{visit.clientName}</p>
                      {visit.propertyAddress && (
                        <p className="text-xs text-text-secondary truncate flex items-center gap-1 mt-0.5">
                          <MapPin size={10} className="flex-shrink-0" /> {visit.propertyAddress}
                        </p>
                      )}
                      {visit.tipLucrare && (
                        <p className="text-[11px] text-text-secondary mt-1">{t(visit.tipLucrare)}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {visit.propertyMapsLink && !isDone && (
                        <a
                          href={getMapsUrl(visit.propertyAddress, visit.propertyMapsLink, visit.latitude, visit.longitude)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500 hover:text-white transition-all"
                          title={t('Open in Maps')}
                        >
                          <Navigation size={14} />
                        </a>
                      )}
                      {!isDone && !isActive && !activeVisit && (
                        <button
                          onClick={() => handleStart(visit)}
                          className="p-2 bg-accent-color/10 text-accent-color rounded-lg hover:bg-accent-color hover:text-white transition-all"
                          title={t('Start Visit')}
                        >
                          <Play size={14} />
                        </button>
                      )}
                      {isDone && (
                        <div className="p-2 text-green-500">
                          <CheckCircle2 size={16} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Go to full schedule */}
      <button
        onClick={() => onNavigate(Page.Schedule)}
        className="w-full py-3 border border-border-color rounded-xl text-sm font-bold text-text-secondary hover:border-accent-color hover:text-accent-color transition-all flex items-center justify-center gap-2"
      >
        <Calendar size={14} /> {t('See Full Schedule')}
      </button>
    </div>
  );
};

export default EmployeeDashboard;
