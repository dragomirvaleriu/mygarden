import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  db, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit 
} from '../services/firebase';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { format } from 'date-fns';
import { Search, Filter, Clock, User, Activity, FileText } from 'lucide-react';

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  changes?: { field: string; oldValue: any; newValue: any }[];
  timestamp: any;
  organizationId: string;
}

interface Props {
  organizationId: string;
}

const AuditTrail: React.FC<Props> = ({ organizationId }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const auditQuery = useMemo(() => {
    return query(
      collection(db, 'audit_logs'),
      where('organizationId', '==', organizationId),
      limit(100)
    );
  }, [organizationId]);

  const { data: rawLogs, loading } = useFirestoreQuery<AuditLog>(auditQuery, { pageSize: 0 });

  const logs = useMemo(() => {
    if (!rawLogs) return [];
    return [...rawLogs].sort((a, b) => {
      const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
      const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
      return timeB - timeA;
    });
  }, [rawLogs]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter(log => {
      const matchesSearch = 
        log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesAction = actionFilter === 'all' || log.action === actionFilter;
      
      return matchesSearch && matchesAction;
    });
  }, [logs, searchTerm, actionFilter]);

  const uniqueActions = useMemo(() => {
    if (!logs) return [];
    const actions = new Set(logs.map(l => l.action));
    return Array.from(actions);
  }, [logs]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-main uppercase tracking-tight">{t('Audit Trail')}</h2>
          <p className="text-[11px] text-text-secondary font-black uppercase tracking-[0.2em] mt-1 opacity-60">{t('Audit Trail Subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary opacity-50" size={14} />
            <input 
              type="text"
              placeholder={t('Search')}
              className="bg-bg-card border border-border-color rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-main w-64 outline-none focus:border-accent-color transition-all shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary opacity-50" size={14} />
            <select 
              className="bg-bg-card border border-border-color rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-main appearance-none outline-none focus:border-accent-color transition-all shadow-inner"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all">{t('All')}</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="stihl-card bg-bg-card border border-border-color rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-main/50 border-b border-border-color">
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-text-secondary opacity-70">{t('Date / Time')}</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-text-secondary opacity-70">{t('User')}</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-text-secondary opacity-70">{t('Action')}</th>
                <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-text-secondary opacity-70">{t('Details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-accent-color/[0.02] transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-accent-color opacity-50" />
                        <span className="text-[11px] font-black text-main">
                          {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss') : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-accent-color/10 flex items-center justify-center text-accent-color text-[11px] font-black">
                          {log.userName?.charAt(0) || '?'}
                        </div>
                        <span className="text-[11px] font-black text-main">{log.userName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-md bg-accent-color/10 text-accent-color text-[11px] font-black uppercase tracking-widest border border-accent-color/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2 max-w-md relative group/tooltip">
                        <FileText size={12} className="text-text-secondary mt-0.5 flex-shrink-0 opacity-50" />
                        <span className="text-[11px] text-text-secondary font-bold leading-relaxed cursor-help">
                          {log.details || '-'}
                        </span>
                        
                        {log.changes && log.changes.length > 0 && (
                          <div className="absolute left-0 top-full mt-2 w-max max-w-sm bg-bg-card border border-border-color p-3 rounded-xl shadow-xl z-50 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">{t('Detailed Changes')}</h4>
                            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                              {log.changes.map((change, idx) => (
                                <div key={idx} className="bg-bg-main p-2 rounded-lg border border-border-color/50 text-[10px]">
                                  <div className="font-bold text-main mb-1">{change.field}</div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-red-500 bg-red-500/10 px-1.5 rounded line-through opacity-70 break-all">{JSON.stringify(change.oldValue) || 'null'}</span>
                                    <span className="text-text-secondary">→</span>
                                    <span className="text-emerald-500 bg-emerald-500/10 px-1.5 rounded break-all">{JSON.stringify(change.newValue) || 'null'}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <Activity size={48} className="text-text-secondary" />
                      <p className="text-xs font-black uppercase tracking-widest text-text-secondary">{t('No records')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditTrail;
