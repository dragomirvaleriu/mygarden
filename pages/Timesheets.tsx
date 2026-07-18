import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot } from '../services/firebase';
import { TimeLog, UserProfile } from '../src/types';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Clock, History, Plus, MapPin } from 'lucide-react';
import { auth } from '../services/firebase';
import { addDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';

interface Props {
  organizationId: string;
  userRole: string;
  members: UserProfile[];
  isEmbedded?: boolean;
}

const Timesheets: React.FC<Props> = ({ organizationId, userRole, members, isEmbedded }) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedUser, setSelectedUser] = useState<string>('all');
  
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualData, setManualData] = useState({
    userId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    hours: '8',
    overtimeHours: '0'
  });

  const currentUid = auth.currentUser?.uid;
  const isAdmin = userRole === 'admin' || userRole === 'owner';

  useEffect(() => {
    if (!organizationId) return;

    const start = format(startOfMonth(parseISO(`${selectedMonth}-01`)), 'yyyy-MM-dd');
    const end = format(endOfMonth(parseISO(`${selectedMonth}-01`)), 'yyyy-MM-dd');

    const q = query(
      collection(db, 'time_logs'),
      where('organizationId', '==', organizationId)
    );

    const unsub = onSnapshot(q, snap => {
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeLog));
      
      // Filter by date in memory
      data = data.filter(d => d.date >= start && d.date <= end);
      
      // If employee, ONLY show their logs
      if (!isAdmin) {
        data = data.filter(d => d.userId === currentUid);
      }

      data.sort((a, b) => b.date.localeCompare(a.date));
      setLogs(data);
      setLoading(false);
    }, err => {
      console.error("Timesheets err:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [organizationId, selectedMonth, isAdmin, currentUid]);

  const filteredLogs = logs.filter(l => selectedUser === 'all' || l.userId === selectedUser);

  // Group by user for summaries
  const userSummaries = members
    .filter(m => isAdmin ? true : m.uid === currentUid)
    .map(m => {
      const userLogs = logs.filter(l => l.userId === m.uid);
      const totalMinutes = userLogs.reduce((acc, curr) => acc + (curr.totalWorkMinutes || 0), 0);
      const totalOvertime = userLogs.reduce((acc, curr) => acc + (curr.overtimeMinutes || 0), 0);
      const totalHours = (totalMinutes / 60).toFixed(1);
      const overtimeHours = (totalOvertime / 60).toFixed(1);
      const daysWorked = new Set(userLogs.map(l => l.date)).size;
      return { ...m, totalHours, overtimeHours, daysWorked };
    });

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '-';
    return format(timestamp.toDate(), 'HH:mm');
  };

  const formatDuration = (minutes: number | undefined) => {
    if (!minutes) return '-';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const handleSaveManual = async () => {
    try {
      const targetUserId = isAdmin ? manualData.userId : currentUid;
      if (!targetUserId) throw new Error("Te rugăm să selectezi un angajat.");
      if (!manualData.hours || parseFloat(manualData.hours) < 0) throw new Error("Introdu un număr valid de ore normale.");
      
      const targetUser = members.find(m => m.uid === targetUserId);
      const userName = targetUser?.displayName || targetUser?.email || 'Employee';
      
      const regularHours = parseFloat(manualData.hours) || 0;
      const otHours = parseFloat(manualData.overtimeHours) || 0;
      
      const totalWorkMinutes = Math.round((regularHours + otHours) * 60);
      const overtimeMinutes = Math.round(otHours * 60);

      await addDoc(collection(db, 'time_logs'), {
        organizationId,
        userId: targetUserId,
        userName,
        date: manualData.date,
        startTime: Timestamp.now(),
        endTime: Timestamp.now(), // Manual entries are instantaneous
        breaks: [],
        totalWorkMinutes,
        overtimeMinutes,
        status: 'finished',
        isManual: true,
        addedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        addedAt: Timestamp.now()
      });
      
      toast.success(t('Manual time log added!'));
      setShowManualModal(false);
    } catch(err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className={`space-y-6 ${isEmbedded ? '' : 'pb-24 animate-in fade-in duration-500'}`}>
      {/* ────── COMPACT PREMIUM HEADER ────── */}
      {!isEmbedded && (
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-gradient-to-r from-accent-color/5 via-transparent to-transparent p-4 md:p-6 md:min-h-[104px] rounded-3xl border border-accent-color/20 mb-6 shadow-sm gap-4">
        <div className="flex items-center gap-4 md:gap-5">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-accent-color flex items-center justify-center text-white shadow-lg shadow-accent-color/30 transform -rotate-3 hover:rotate-0 transition-transform duration-300 shrink-0">
            {isAdmin ? <Clock className="w-6 h-6 md:w-7 md:h-7" strokeWidth={2.5} /> : <History className="w-6 h-6 md:w-7 md:h-7" strokeWidth={2.5} />}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/logo.png" alt="Scapeflow" className="w-3 h-3 md:w-4 md:h-4 object-contain drop-shadow-sm" />
              <h2 className="text-[9px] md:text-[11px] font-black text-accent-color uppercase tracking-[0.4em] leading-none">Scapeflow</h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-color text-white text-[8px] font-black uppercase tracking-tighter shadow-sm">{t('Intelligence Terminal')}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-main tracking-tight leading-tight mb-1">{isAdmin ? t('Timesheets') : t('My Timesheets')}</h1>
            <p className="text-text-secondary text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
              {isAdmin ? t('Manage employee work hours') : t('View your work history')}
            </p>
          </div>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => {
              setManualData({ ...manualData, userId: currentUid || '' });
              setShowManualModal(true);
            }}
            className="bg-accent-color hover:bg-accent-color/90 text-white font-bold py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md shadow-accent-color/20 shrink-0"
          >
            <Plus size={18} />
            {t('Log Manual Hours')}
          </button>
        )}
      </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-bg-main p-4 rounded-xl border border-border-color">
        <div className="flex-1 space-y-1">
          <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{t('Select Month')}</label>
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full bg-bg-card border border-border-color rounded-md px-3 py-2 text-sm font-bold text-main outline-none focus:border-accent-color"
          />
        </div>
        {isAdmin && (
          <div className="flex-1 space-y-1">
            <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">{t('Employee')}</label>
            <select 
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full bg-bg-card border border-border-color rounded-md px-3 py-2 text-sm font-bold text-main outline-none focus:border-accent-color appearance-none"
            >
              <option value="all">{t('All Employees')}</option>
              {members.map(m => (
                <option key={m.uid} value={m.uid}>{m.displayName || m.email}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {userSummaries.filter(u => selectedUser === 'all' || u.uid === selectedUser).map(u => (
          <div key={u.uid} className="bg-bg-card rounded-xl p-4 border border-border-color flex items-center justify-between shadow-sm">
            <div>
              <p className="text-sm font-bold text-main truncate">{isAdmin ? (u.displayName || u.email) : t('Total Month')}</p>
              <p className="text-xs text-text-secondary mt-1">{u.daysWorked} {t('days worked')}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-accent-color">{u.totalHours}h</p>
              {Number(u.overtimeHours) > 0 && (
                <p className="text-[10px] font-bold text-red-500 mb-1">+{u.overtimeHours}h {t('overtime')}</p>
              )}
              <p className="text-[11px] font-bold text-text-secondary uppercase tracking-widest">{t('Total')}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Details Table */}
      <div className="bg-bg-card rounded-xl border border-border-color overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-bg-main border-b border-border-color">
              <tr>
                <th className="px-4 py-3 font-bold text-text-secondary uppercase tracking-wider text-[11px]">{t('Date')}</th>
                {isAdmin && <th className="px-4 py-3 font-bold text-text-secondary uppercase tracking-wider text-[11px]">{t('Employee')}</th>}
                <th className="px-4 py-3 font-bold text-text-secondary uppercase tracking-wider text-[11px]">{t('Start')}</th>
                <th className="px-4 py-3 font-bold text-text-secondary uppercase tracking-wider text-[11px]">{t('End')}</th>
                <th className="px-4 py-3 font-bold text-text-secondary uppercase tracking-wider text-[11px]">{t('Breaks')}</th>
                <th className="px-4 py-3 font-bold text-text-secondary uppercase tracking-wider text-[11px] text-right">{t('Overtime')}</th>
                <th className="px-4 py-3 font-bold text-text-secondary uppercase tracking-wider text-[11px] text-right">{t('Total Time')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-text-secondary">
                    <div className="animate-pulse flex items-center justify-center gap-2">
                      <Clock size={16} className="animate-spin" /> {t('Loading...')}
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-text-secondary font-medium">
                    {t('No time logs found for this period.')}
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const breaksText = (log.breaks || []).map(b => 
                    `${formatTime(b.start)} - ${formatTime(b.end)} (${b.durationMinutes || 0}m)`
                  ).join(', ') || '-';

                  return (
                    <tr key={log.id} className="hover:bg-bg-main transition-colors">
                      <td className="px-4 py-3 font-medium text-main">
                        <div className="flex items-center gap-2">
                          {log.date}
                          {log.autoClosed && (
                            <span title="Închis automat de sistem" className="text-[10px] flex items-center justify-center bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20 shadow-sm shadow-amber-500/10">
                              ⚠️ Auto
                            </span>
                          )}
                          {log.isManual && (
                            <span 
                              title={log.addedBy ? `Adăugat manual de ${log.addedBy} la ${log.addedAt ? formatTime(log.addedAt) : 'dată necunoscută'}` : "Adăugat manual de admin"} 
                              className="text-accent-color text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 bg-accent-color/10 border border-accent-color/20 rounded-md shadow-sm shadow-accent-color/10 cursor-help"
                            >
                              Manual
                            </span>
                          )}
                        </div>
                      </td>
                      {isAdmin && <td className="px-4 py-3 font-bold text-main">{log.userName}</td>}
                      <td className="px-4 py-3 text-text-secondary">
                        <div className="flex items-center gap-2">
                          {formatTime(log.startTime)}
                          {log.location && isAdmin && (
                            <a 
                              href={`https://www.google.com/maps?q=${log.location.lat},${log.location.lng}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-accent-color hover:text-accent-color/80 p-1 hover:bg-accent-color/10 rounded-full transition-colors"
                              title="Vezi locația pe hartă"
                            >
                              <MapPin size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{formatTime(log.endTime)}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary truncate max-w-[200px]" title={breaksText}>
                        {breaksText}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-500 text-xs">
                        {log.overtimeMinutes ? `+${formatDuration(log.overtimeMinutes)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-main">
                        {formatDuration(log.totalWorkMinutes)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-card border border-border-color rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-black text-main uppercase tracking-tight mb-4">{t('Log Manual Hours')}</h3>
              
              <div className="space-y-4">
                {isAdmin && (
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">{t('Employee')}</label>
                    <select 
                      value={manualData.userId}
                      onChange={e => setManualData({...manualData, userId: e.target.value})}
                      className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-bold text-main outline-none focus:border-accent-color appearance-none"
                    >
                      <option value="">{t('Select employee')}</option>
                      {members.map(m => (
                        <option key={m.uid} value={m.uid}>{m.displayName || m.email}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">{t('Date')}</label>
                  <input 
                    type="date"
                    value={manualData.date}
                    onChange={e => setManualData({...manualData, date: e.target.value})}
                    className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-bold text-main outline-none focus:border-accent-color"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">{t('Regular Hours (Max 8)')}</label>
                    <input 
                      type="number"
                      min="0"
                      max="8"
                      step="0.5"
                      value={manualData.hours}
                      onChange={e => setManualData({...manualData, hours: e.target.value})}
                      className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-bold text-main outline-none focus:border-accent-color"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">{t('Overtime Hours')}</label>
                    <input 
                      type="number"
                      min="0"
                      step="0.5"
                      value={manualData.overtimeHours}
                      onChange={e => setManualData({...manualData, overtimeHours: e.target.value})}
                      className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-bold text-main outline-none focus:border-accent-color"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-border-color">
                <button 
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 bg-bg-main hover:bg-border-color text-text-secondary font-bold py-3 rounded-xl transition-colors cursor-pointer"
                >
                  {t('Cancel')}
                </button>
                <button 
                  onClick={handleSaveManual}
                  disabled={!manualData.date || !manualData.hours || (isAdmin && !manualData.userId)}
                  className="flex-1 bg-accent-color hover:bg-accent-color/90 text-white font-bold py-3 rounded-xl transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
                >
                  {t('Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timesheets;
