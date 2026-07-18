import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  ChevronUp, ChevronDown, Building2, User, Phone, MessageCircle,
  Mail, MapPin, Droplets, History, Ruler, Coins, Sprout, CalendarClock,
  CalendarPlus, Wallet, HandCoins, ExternalLink, Pencil, Trash2, CreditCard, DollarSign,
  Hash, AlertTriangle, Clock, Zap, CheckCircle2, Briefcase
} from 'lucide-react';
import { WhatsAppIcon } from '../WhatsAppIcon';
import { Client, Property, Visit, Organization, Page } from '../../src/types';
import { ClientInfoModal } from './ClientInfoModal';
import { getMapsUrl } from '../../utils/maps';
import { isDebtor } from '../../utils/clientUtils';
import { parseSafeDate, formatLongDate, formatShortDate, calculateDaysSinceLastVisit } from '../../utils/date';
import { isIrrigatingToday } from '../../utils/irrigation';

interface Props {
  client: Client & { propertyCount?: number };
  list: Client[];
  compact?: boolean;
  index?: number;
  propertiesByClientId: Record<string, Property[]>;
  visitsByClientId: Record<string, Visit[]>;
  orgSettings: Organization | null;
  t: any;
  onNavigate: (page: Page, id?: string) => void;
  handleOpenSchedule: (client: Client) => void;
  handleMove: (client: Client, direction: 'up' | 'down', list: Client[]) => void;
  setPaymentModal: (val: any) => void;
  setDeleteClientModal: (val: any) => void;
  profileRole?: string;
  accountType?: 'PF' | 'PJ';
  userRole: string;
  setShowHistoryModal: (val: any) => void;
  isManualSort?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FrequencyBadge = ({ freq }: { freq?: string }) => {
  if (!freq) return null;
  
  let normalizedFreq = freq.toLowerCase();
  if (normalizedFreq.includes('săptămânal') || normalizedFreq.includes('saptamanal') || normalizedFreq === 'weekly') normalizedFreq = 'weekly';
  else if (normalizedFreq.includes('2 săptămâni') || normalizedFreq.includes('2 saptamani') || normalizedFreq === 'biweekly') normalizedFreq = 'biweekly';
  else if (normalizedFreq.includes('lunar') || normalizedFreq === 'monthly') normalizedFreq = 'monthly';
  else if (normalizedFreq.includes('ocazional') || normalizedFreq === 'occasional') normalizedFreq = 'occasional';

  const map: Record<string, { label: string; color: string }> = {
    weekly:     { label: '7Z',  color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    biweekly:   { label: '14Z', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    monthly:    { label: '30Z', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
    occasional: { label: 'OCC', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
  };
  const cfg = map[normalizedFreq];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded-md border ${cfg.color}`}>
      <Zap size={7} />
      {cfg.label}
    </span>
  );
};

const DaysSinceBadge = ({ days, onClick }: { days: number | null, onClick?: (e: React.MouseEvent) => void }) => {
  if (days === null) return null;
  const isOk = days <= 10;
  const isWarn = days > 10 && days <= 20;
  const isDanger = days > 20;
  return (
    <span
      onClick={onClick}
      title={`Ultima vizită: acum ${days} zile (Click pentru istoric)`}
      className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md border ${onClick ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''}
        ${isOk ? 'bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 border-emerald-500/15' :
          isWarn ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
          'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'}`}
    >
      <Clock size={7} />
      {days}z
    </span>
  );
};

// ─── Compact View ─────────────────────────────────────────────────────────────

const CompactCard = ({
  client, list, propertiesByClientId, visitsByClientId, orgSettings, t, index,
  onNavigate, handleOpenSchedule, handleMove, setPaymentModal,
  setDeleteClientModal, profileRole, accountType, userRole, setShowHistoryModal
}: Props) => {
  const [infoModal, setInfoModal] = useState<'visits' | 'fertilizer' | 'properties' | 'financial' | null>(null);
  const clientProperties = useMemo(() =>
    (propertiesByClientId[client.id] || []).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [propertiesByClientId, client.id]);
  const mainProperty = clientProperties[0];
  const displayAddress = mainProperty?.address || client.adresa || t('No Address');
  const hasDebt = (client.sold || 0) > 0;
  const cleanPhone = (client.telefon || '').replace(/[^0-9+]/g, '');
  const scheduledVisits = useMemo(() =>
    (visitsByClientId[client.id] || []).filter(v => v.status === 'Programat' || v.status === 'Activ')
      .sort((a, b) => parseSafeDate(a.data).getTime() - parseSafeDate(b.data).getTime()),
    [visitsByClientId, client.id]);
  const isScheduled = scheduledVisits.length > 0;
  const nextVisit = scheduledVisits[0];
  const diffDays = calculateDaysSinceLastVisit(visitsByClientId[client.id] || [], client.id, mainProperty?.id);
  const isInactive = client.status === 'Inactiv';

  const dominantFrequency = useMemo(() => {
    const freqs = clientProperties
      .filter(p => p.contractType === 'maintenance')
      .map(p => p.maintenanceFrequency)
      .filter(Boolean);
    const priority = ['weekly', 'biweekly', 'monthly', 'occasional'];
    for (const prio of priority) {
      if (freqs.includes(prio as any)) return prio;
    }
    return client.maintenanceFrequency;
  }, [clientProperties, client.maintenanceFrequency]);

  return (
    <div 
      onClick={() => onNavigate(Page.Details, client.id)}
      className={`cursor-pointer rounded-lg p-2 sm:p-2 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4
      ${isInactive ? 'opacity-55 grayscale-[30%]' : ''}
      ${hasDebt ? 'border border-red-500/30 bg-red-500/[0.02] shadow-sm shadow-red-500/5 hover:border-red-500/50' :
        isScheduled ? 'border-2 border-accent-color/80 bg-accent-color/[0.02] shadow-sm shadow-accent-color/10 hover:border-accent-color' :
        'bg-bg-card border border-black/5 dark:border-white/10 hover:border-accent-color/30 hover:bg-accent-color/[0.03]'}`}
    >
      {/* Col 1: Identity & Address */}
      <div className="flex items-start sm:items-center gap-2.5 sm:w-1/3 min-w-0">
        {typeof index === 'number' && (
          <div className="w-5 shrink-0 flex justify-end pr-1 text-text-secondary/50 text-[10px] font-black">
            {index + 1}.
          </div>
        )}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${hasDebt ? 'bg-red-500/10 text-red-500' : 'bg-accent-color/10 text-accent-color'}`}>
           {client.tip_persoana === 'PJ' ? <Building2 size={16} /> : <User size={16} />}
        </div>
        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-main text-sm truncate">
              {client.tip_persoana === 'PJ' ? (client.numeFirma || client.nume) : client.nume}
            </h3>
            {client.tip_persoana === 'PJ' && <span className="px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-black/5 dark:bg-white/10 text-text-secondary">PJ</span>}
          </div>
          <div className="flex items-center gap-1 text-[9px] text-text-secondary truncate mt-0.5">
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">{displayAddress}</span>
          </div>
        </div>
      </div>

      {/* Col 2: Days Since & Financials */}
      <div className="flex items-center gap-4 sm:w-1/3 justify-start sm:justify-center">
        <div className="flex flex-col items-start sm:items-center gap-1">
           <DaysSinceBadge days={diffDays} onClick={(e) => { e.stopPropagation(); setShowHistoryModal({ isOpen: true, clientId: client.id }); }} />
           {client.contractType === 'maintenance' ? (
             <FrequencyBadge freq={dominantFrequency || 'weekly'} />
           ) : (
             <span className="inline-flex items-center gap-0.5 text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded-md border bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20">
               <Briefcase size={7} />
               UNI
             </span>
           )}
           {isInactive && (
             <span className="inline-flex items-center gap-0.5 text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded-md border bg-gray-500/10 text-gray-500 border-gray-500/20 mt-0.5">
               INACTIV
             </span>
           )}
        </div>
        
        {accountType !== 'PF' && userRole === 'admin' && (
          <div className="flex flex-col items-end sm:items-center min-w-[70px]">
            {hasDebt ? (
              <button 
                onClick={(e) => { e.stopPropagation(); setPaymentModal({ isOpen: true, client, amount: client.sold?.toString() }); }}
                className="flex flex-col items-center justify-center px-2 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-red-500/70">{t('Restanță')}</span>
                <span className="text-xs font-black text-red-600">{client.sold} RON</span>
              </button>
            ) : (
              <div 
                onClick={(e) => { e.stopPropagation(); setInfoModal('financial'); }}
                className="flex flex-col items-center justify-center px-2 py-1 rounded-md bg-emerald-500/5 border border-emerald-500/10 cursor-pointer hover:bg-emerald-500/10 transition-colors"
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600/70">Sold</span>
                <span className="text-xs font-black text-emerald-600">0 RON</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Col 3: Actions */}
      <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:w-1/3">
        <button
          onClick={(e) => { e.stopPropagation(); if (!isInactive) handleOpenSchedule(client); }}
          disabled={isInactive}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md font-bold text-[11px] transition-all whitespace-nowrap shrink-0
            ${isInactive ? 'bg-gray-500/10 text-gray-500/50 cursor-not-allowed border border-gray-500/20' : isScheduled ? 'bg-accent-color text-white shadow-sm shadow-accent-color/20' : 'bg-bg-main text-text-secondary border border-border-color hover:text-accent-color hover:border-accent-color/30'}`}
          title={isInactive ? t('Nu se poate programa un client inactiv') : undefined}
        >
          {isScheduled ? (
            <>
              <CalendarClock size={12} />
              <span className="hidden sm:inline">{nextVisit?.data ? formatShortDate(parseSafeDate(nextVisit.data)) : t('Programat')}</span>
            </>
          ) : (
            <>
              <CalendarPlus size={12} />
              <span className="hidden sm:inline">{t('Programează')}</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1 border-l border-border-color pl-1.5 ml-0.5 shrink-0">
          <a href={`tel:${cleanPhone}`} className="w-7 h-7 flex items-center justify-center rounded-md text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all" onClick={(e) => e.stopPropagation()}>
            <Phone size={12} strokeWidth={2} />
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate(Page.ClientForm, client.id); }}
            className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:text-main bg-bg-main border border-border-color hover:border-accent-color/30 transition-all"
          >
            <Pencil size={12} strokeWidth={2} />
          </button>
        </div>
      </div>
      <ClientInfoModal
        isOpen={infoModal !== null}
        onClose={() => setInfoModal(null)}
        client={client}
        type={infoModal || 'visits'}
        visits={visitsByClientId[client.id] || []}
        properties={clientProperties}
        organizationId={client.organizationId}
      />
    </div>
  );
};

// ─── Full Card ─────────────────────────────────────────────────────────────────

export const ClientCard = React.memo(({
  client, list, compact = false, index, propertiesByClientId, visitsByClientId,
  orgSettings, t, onNavigate, handleOpenSchedule, handleMove,
  setPaymentModal, setDeleteClientModal, profileRole, accountType,
  userRole, setShowHistoryModal, isManualSort = false
}: Props) => {
  const [infoModal, setInfoModal] = useState<'visits' | 'fertilizer' | 'properties' | 'financial' | null>(null);
  const [infoModalProperty, setInfoModalProperty] = useState<string | null>(null);

  // ── Derived data ──
  const clientProperties = useMemo(() =>
    (propertiesByClientId[client.id] || []).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [propertiesByClientId, client.id]);

  const mainProperty = useMemo(() =>
    clientProperties.find(p => p.name === t('Main Location')) || clientProperties[0],
    [clientProperties, t]);

  const displayAddress = mainProperty?.address || client.adresa || t('No Address');
  const mapsLink = getMapsUrl(displayAddress, mainProperty?.mapsLink || client.Maps_link);
  const hasDebt = (client.sold || 0) > 0;
  const isInactive = client.status === 'Inactiv';

  const cleanPhone = (client.telefon || '').replace(/[^0-9+]/g, '');
  const waLink = `https://wa.me/${cleanPhone.startsWith('0') ? '4' + cleanPhone : cleanPhone}`;

  const scheduledVisits = useMemo(() =>
    (visitsByClientId[client.id] || [])
      .filter(v => v.status === 'Programat' || v.status === 'Activ')
      .sort((a, b) => parseSafeDate(a.data).getTime() - parseSafeDate(b.data).getTime()),
    [visitsByClientId, client.id]);

  const scheduledVisit = scheduledVisits[0];
  const isScheduled = !!scheduledVisit;

  const isScheduledToday = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return scheduledVisits.some(v => v.data && format(parseSafeDate(v.data), 'yyyy-MM-dd') === todayStr);
  }, [scheduledVisits]);

  const diffDays = useMemo(() =>
    calculateDaysSinceLastVisit(visitsByClientId[client.id] || [], client.id, mainProperty?.id),
    [visitsByClientId, client.id, mainProperty?.id]);

  const fertilizerDosage = orgSettings?.defaultFertilizerDosage || 25;
  const fertilizerNeeded = ((client.suprafataMp || 0) * fertilizerDosage) / 1000;
  
  // Calculate if fertilizer is active (needs fertilizer >= 60 days)
  const effectiveFertDate = useMemo(() => {
    let date = mainProperty?.lastSolidFertilizerDate || client.lastSolidFertilizerDate;
    const clientVisits = visitsByClientId[client.id] || [];
    const fertVisits = clientVisits.filter(v => 
      v.status === 'Finalizat' && 
      v.servicii_efectuate?.some(s => {
        const n = (s.name || '').toLowerCase();
        return n.includes('îngrășământ') || n.includes('ingrasamant') || n.includes('fertiliz');
      })
    ).sort((a, b) => parseSafeDate(b.data).getTime() - parseSafeDate(a.data).getTime());
    
    if (fertVisits.length > 0 && fertVisits[0].data) {
      if (!date || parseSafeDate(fertVisits[0].data).getTime() > parseSafeDate(date).getTime()) {
        date = fertVisits[0].data;
      }
    }
    return date;
  }, [mainProperty?.lastSolidFertilizerDate, client.lastSolidFertilizerDate, visitsByClientId, client.id]);

  const daysSinceFertilizer = effectiveFertDate ? Math.floor((Date.now() - new Date(effectiveFertDate).getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isFertilizerActive = !!effectiveFertDate && daysSinceFertilizer !== null && daysSinceFertilizer >= 60;


  const clientVisits = useMemo(() =>
    (visitsByClientId[client.id] || []).filter(v => v.status === 'Finalizat'),
    [visitsByClientId, client.id]);
  const visitsThisYear = useMemo(() => {
    const yr = new Date().getFullYear();
    return clientVisits.filter(v => {
      const d = v.completedAt?.toDate?.() || null;
      return d && d.getFullYear() === yr;
    }).length;
  }, [clientVisits]);

  const irrigating = mainProperty ? isIrrigatingToday(mainProperty) : false;

  // Frequency from properties (per property, not per client)
  const dominantFrequency = useMemo(() => {
    const freqs = clientProperties
      .filter(p => p.contractType === 'maintenance')
      .map(p => p.maintenanceFrequency)
      .filter(Boolean);
    // Priority: weekly > biweekly > monthly > occasional
    const priority = ['weekly', 'biweekly', 'monthly', 'occasional'];
    for (const prio of priority) {
      if (freqs.includes(prio as any)) return prio;
    }
    return client.maintenanceFrequency; // fallback to legacy field
  }, [clientProperties, client.maintenanceFrequency]);

  const contractType = useMemo(() => {
    const hasMaintenance = clientProperties.some(p => p.contractType === 'maintenance');
    return hasMaintenance ? 'maintenance' : (clientProperties[0]?.contractType || client.contractType);
  }, [clientProperties, client.contractType]);

  // Avatar colors
  const colors = orgSettings?.contractTypeColors || { maintenance: '#3b82f6', oneTime: '#f97316', inactive: '#ef4444' };
  const hasMaintenance = clientProperties.some(p => p.contractType === 'maintenance');
  const hasOneTime = clientProperties.some(p => p.contractType === 'one-time' || p.contractType === 'project');
  let avatarStyle: React.CSSProperties = { backgroundColor: '#e5e7eb20', color: '#6b7280' };
  if (isInactive) {
    avatarStyle = { backgroundColor: colors.inactive + '20', color: colors.inactive };
  } else if (hasMaintenance && hasOneTime) {
    avatarStyle = { background: `linear-gradient(135deg, ${colors.maintenance}25 50%, ${colors.oneTime}25 50%)`, color: colors.maintenance };
  } else if (hasOneTime) {
    avatarStyle = { backgroundColor: colors.oneTime + '20', color: colors.oneTime };
  } else if (hasMaintenance) {
    avatarStyle = { backgroundColor: colors.maintenance + '20', color: colors.maintenance };
  }

  const getDisplayDate = (v: Visit) => formatLongDate(parseSafeDate(v.data));

  // ── Compact rendering ──
  if (compact) {
    return (
      <CompactCard
        client={client} list={list} propertiesByClientId={propertiesByClientId}
        visitsByClientId={visitsByClientId} orgSettings={orgSettings} t={t} index={index}
        onNavigate={onNavigate} handleOpenSchedule={handleOpenSchedule}
        handleMove={handleMove} setPaymentModal={setPaymentModal}
        setDeleteClientModal={setDeleteClientModal} profileRole={profileRole}
        accountType={accountType} userRole={userRole}
        setShowHistoryModal={setShowHistoryModal}
      />
    );
  }

  // ── Full card ──
  return (
    <div
      className={`rounded-2xl transition-all duration-200 group relative flex flex-col overflow-hidden
        ${isInactive ? 'opacity-55 grayscale-[30%]' : ''}
        ${hasDebt
          ? 'border border-red-500/25 bg-bg-card shadow-sm shadow-red-500/5 hover:shadow-red-500/10 hover:border-red-500/40'
          : isScheduledToday
            ? 'border-2 border-accent-color bg-accent-color/[0.02] dark:bg-accent-color/[0.03] shadow-md shadow-accent-color/10 hover:shadow-accent-color/20'
            : 'bg-bg-card border border-black/5 dark:border-white/10 shadow-sm hover:shadow-md hover:border-accent-color/25 hover:bg-accent-color/[0.02]'
        }`}
    >
      {/* ─── Debt Banner ────────────────────────────────────────────────── */}
      {hasDebt && accountType !== 'PF' && userRole === 'admin' && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-red-500/10 border-b border-red-500/20">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={11} className="text-red-500 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">Sold Restant</span>
          </div>
          <span className="text-[13px] font-black text-red-500 tabular-nums">{(client.sold || 0).toLocaleString()} RON</span>
        </div>
      )}

      {/* ─── Scheduled Badge ─────────────────────────────────────────────── */}
      {scheduledVisits.length > 0 && (
        <div
          className={`absolute ${hasDebt ? 'top-[33px]' : 'top-0'} right-0 text-white px-2.5 py-1.5 rounded-bl-2xl rounded-tr-2xl text-[10px] font-black uppercase tracking-tighter z-20 flex items-center gap-1.5
            ${isScheduledToday ? 'bg-accent-color ring-2 ring-accent-color/20 shadow-md shadow-accent-color/20' : 'bg-accent-color/80 dark:bg-accent-color/70'}`}
          title={scheduledVisits.map(v => `${formatShortDate(parseSafeDate(v.data))} — ${v.propertyAddress || ''}`).join('\n')}
        >
          {isScheduledToday && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
          {scheduledVisits.slice(0, 2).map((v, i) => (
            <React.Fragment key={v.id}>
              {i > 0 && <span className="opacity-50">•</span>}
              <span>{formatShortDate(parseSafeDate(v.data))}</span>
            </React.Fragment>
          ))}
          {scheduledVisits.length > 2 && <span className="opacity-60 text-[8px]">+{scheduledVisits.length - 2}</span>}
        </div>
      )}

      {/* ─── Reorder Controls ────────────────────────────────────────────── */}
      {isManualSort && (
        <div className="absolute top-10 right-2 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          {list.findIndex(c => c.id === client.id) > 0 && (
            <button onClick={(e) => { e.stopPropagation(); handleMove(client, 'up', list); }}
              className="p-2 bg-bg-card rounded-full text-text-secondary hover:text-accent-color shadow-md border border-black/5 transition-colors">
              <ChevronUp size={16} />
            </button>
          )}
          {list.findIndex(c => c.id === client.id) < list.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); handleMove(client, 'down', list); }}
              className="p-2 bg-bg-card rounded-full text-text-secondary hover:text-accent-color shadow-md border border-black/5 transition-colors">
              <ChevronDown size={16} />
            </button>
          )}
        </div>
      )}

      {/* ─── Card Body ───────────────────────────────────────────────────── */}
      <div className="flex-1 p-4 flex flex-col gap-3">

        {/* Row 1: Avatar + Identity */}
        <div className="flex items-start gap-3 pr-10">
          {/* Avatar */}
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center border border-black/5 dark:border-white/8 shadow-sm relative"
              style={avatarStyle}
            >
              {client.tip_persoana === 'PJ'
                ? <Building2 size={22} strokeWidth={1.3} />
                : <User size={22} strokeWidth={1.3} />
              }
              {(client.propertyCount || 0) > 1 && (
                <div className="absolute -bottom-1 -left-1 bg-accent-color text-white text-[8px] font-black px-1.5 rounded-md shadow-sm border border-white/20">
                  {client.propertyCount}×
                </div>
              )}
            </div>
            {/* Quick contacts */}
            <div className="flex items-center gap-1">
              <a href={`tel:${cleanPhone}`}
                className="w-5 h-5 rounded-full flex items-center justify-center bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-sm"
                onClick={(e) => e.stopPropagation()} title={t('Call')}>
                <Phone size={9} strokeWidth={2.5} />
              </a>
              {cleanPhone && (
                <a href={waLink} target="_blank" rel="noopener noreferrer"
                  className="w-5 h-5 rounded-full flex items-center justify-center bg-[#25D366]/10 dark:bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/20 transition-all shadow-sm"
                  onClick={(e) => e.stopPropagation()} title="WhatsApp">
                  <WhatsAppIcon size={9} />
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`}
                  className="w-5 h-5 rounded-full flex items-center justify-center bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all shadow-sm"
                  onClick={(e) => e.stopPropagation()} title={t('Send Email')}>
                  <Mail size={9} strokeWidth={2.5} />
                </a>
              )}
            </div>
          </div>

          {/* Name + Location */}
          <div className="min-w-0 flex-1">
            <h3
              onClick={() => onNavigate(Page.Details, client.id)}
              className="text-[15px] font-black text-main leading-tight cursor-pointer hover:text-accent-color transition-colors truncate"
            >
              {client.tip_persoana === 'PJ' ? (client.numeFirma || client.nume) : client.nume}
            </h3>
            {client.tip_persoana === 'PJ' && client.nume && (
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wide truncate mt-0.5">{client.nume}</p>
            )}

            {/* Status badges (inactive only — rest are per-property) */}
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {isInactive && (
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border bg-gray-500/10 text-gray-500 border-gray-500/20">
                  {t('Inactive')}
                </span>
              )}
            </div>

            {/* Locations — with per-property freq + days badges */}
            <div className="flex flex-col gap-1 mt-1.5">
              {clientProperties.slice(0, 3).map((p, pIdx) => {
                const pMapsLink = getMapsUrl(p.address, p.mapsLink);
                const pDiffDays = calculateDaysSinceLastVisit(visitsByClientId[client.id] || [], client.id, p.id);
                const pIrrigating = isIrrigatingToday(p);
                const pLastFertDate = p.lastSolidFertilizerDate;
                const pDaysSinceFert = pLastFertDate ? Math.floor((Date.now() - new Date(pLastFertDate).getTime()) / (1000 * 60 * 60 * 24)) : null;
                const pFertActive = pDaysSinceFert !== null && pDaysSinceFert > 60;
                return (
                  <div key={p.id || pIdx} className="flex items-center gap-1.5 text-[10px] text-text-secondary w-full min-w-0">
                    <MapPin size={9} className="shrink-0 text-accent-color opacity-70" />
                    <a href={pMapsLink} target="_blank" rel="noopener noreferrer"
                      className="truncate font-medium hover:text-accent-color transition-colors shrink min-w-0"
                      onClick={(e) => e.stopPropagation()}>
                      {p.name || p.address}
                    </a>
                    {/* Per-property badges inline, strictly no wrap */}
                    <div className="flex items-center gap-1 shrink-0 ml-[24px]">
                      <FrequencyBadge freq={p.maintenanceFrequency || client.maintenanceFrequency || ((p.contractType || client.contractType) === 'maintenance' ? 'weekly' : undefined)} />
                      <DaysSinceBadge days={pDiffDays} onClick={(e) => {
                        e.stopPropagation();
                        setShowHistoryModal({
                          clientId: client.id,
                          clientName: client.tip_persoana === 'PJ' ? (client.numeFirma || client.nume) : client.nume,
                          propertyId: p.id,
                          propertyName: p.name || p.address
                        });
                      }} />
                      {pIrrigating && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-md border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                          <Droplets size={7} />
                        </span>
                      )}
                      {pDaysSinceFert !== null && (
                        <span 
                          onClick={(e) => { e.stopPropagation(); setInfoModalProperty(p.id); setInfoModal('fertilizer'); }} 
                          title="Istoric Fertilizare"
                          className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md border cursor-pointer hover:opacity-75 transition-opacity ${pFertActive ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' : 'bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 border-emerald-500/15'}`}
                        >
                          <Sprout size={7} />
                          {pDaysSinceFert}z
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {clientProperties.length > 3 && (
                <span className="text-[9px] font-bold text-text-secondary/60 ml-3.5">
                  +{clientProperties.length - 3} {t('locations')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Stats Chips */}
        <div className="grid grid-cols-3 gap-1.5">
          {/* Surface */}
          <div 
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/8 text-center gap-0.5 cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
            onClick={(e) => { e.stopPropagation(); setInfoModal('properties'); }}
          >
            <Ruler size={11} className="text-text-secondary/60" />
            <span className="text-[13px] font-black text-main leading-none tabular-nums">
              {(client.suprafataMp || 0).toLocaleString()}
            </span>
            <span className="text-[8px] font-bold text-text-secondary/50 uppercase">m²</span>
          </div>

          {/* Tarif / Sold */}
          {accountType !== 'PF' && userRole === 'admin' ? (
            <>
              <div className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/8 text-center gap-0.5"
                title={contractType === 'one-time' ? t('Project Cost') : t('Monthly Rate')}>
                {client.preferredPayment === 'cash'
                  ? <DollarSign size={11} className="text-emerald-600 dark:text-emerald-400" />
                  : <CreditCard size={11} className="text-blue-500" />
                }
                <span className="text-[13px] font-black text-main leading-none tabular-nums">
                  {(client.tarifLunar || 0).toLocaleString()}
                </span>
                <span className="text-[8px] font-bold text-text-secondary/50 uppercase">RON</span>
              </div>

              <div
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-center gap-0.5 cursor-pointer transition-all
                  ${hasDebt
                    ? 'bg-red-500/10 border-red-500/25 hover:bg-red-500/15'
                    : 'bg-emerald-500/8 border-emerald-500/15 hover:bg-emerald-500/12'
                  }`}
                title={hasDebt ? t('Outstanding Balance — Click to collect') : t('Balance OK')}
                onClick={(e) => { e.stopPropagation(); setInfoModal('financial'); }}
              >
                {hasDebt
                  ? <Coins size={11} className="text-red-500" />
                  : <CheckCircle2 size={11} className="text-emerald-500" />
                }
                <span className={`text-[13px] font-black leading-none tabular-nums ${hasDebt ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {hasDebt ? (client.sold || 0).toLocaleString() : '0'}
                </span>
                <span className={`text-[8px] font-bold uppercase ${hasDebt ? 'text-red-400' : 'text-emerald-500/60'}`}>RON</span>
              </div>
            </>
          ) : (
            /* PF: show fertilizer in 2nd slot */
            <>
              <div 
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-center gap-0.5 cursor-pointer transition-colors ${
                  isFertilizerActive 
                    ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20' 
                    : 'bg-black/[0.03] dark:bg-white/[0.04] border-black/5 dark:border-white/8 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
                }`}
                onClick={(e) => { e.stopPropagation(); setInfoModal('fertilizer'); }}
              >
                <Sprout size={11} className={isFertilizerActive ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"} />
                <div className="flex items-center gap-0.5">
                  <span className={`text-[13px] font-black leading-none tabular-nums ${isFertilizerActive ? "text-red-600" : "text-main"}`}>
                    {fertilizerNeeded.toFixed(1)}
                  </span>
                  <span className="text-[8px] font-bold text-text-secondary/50 uppercase mt-[2px]">kg</span>
                  {daysSinceFertilizer !== null && (
                    <span className={`text-[10px] font-bold ml-1 tabular-nums ${isFertilizerActive ? "text-red-500" : "text-text-secondary"}`}>({daysSinceFertilizer} zile)</span>
                  )}
                </div>
              </div>
              <div 
                className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/8 text-center gap-0.5 cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
                onClick={(e) => { e.stopPropagation(); setInfoModal('visits'); }}
              >
                <Hash size={11} className="text-text-secondary/60" />
                <span className="text-[13px] font-black text-main leading-none tabular-nums">{visitsThisYear}</span>
                <span className="text-[8px] font-bold text-text-secondary/50 uppercase">{t('visits')}</span>
              </div>
            </>
          )}
        </div>

        {/* Row 3: Fertilizer (PJ admin only — 4th stat) */}
        {accountType !== 'PF' && userRole === 'admin' && (
          <div className="grid grid-cols-2 gap-1.5">
            <div 
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border text-center gap-0.5 cursor-pointer transition-colors ${
                isFertilizerActive 
                  ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20' 
                  : 'bg-black/[0.02] dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
              }`}
              onClick={(e) => { e.stopPropagation(); setInfoModal('fertilizer'); }}
            >
              <div className="flex items-center gap-1">
                <Sprout size={10} className={isFertilizerActive ? "text-red-500" : "text-emerald-600/70 dark:text-emerald-400/70"} />
                <div className="flex items-center gap-0.5">
                  <span className={`text-[11px] font-black tabular-nums ${isFertilizerActive ? "text-red-600" : "text-main"}`}>{fertilizerNeeded.toFixed(1)}</span>
                  <span className="text-[8px] font-bold uppercase mt-[1px]" style={{ opacity: 0.5 }}>kg</span>
                  {daysSinceFertilizer !== null && (
                    <span className={`text-[9px] font-bold ml-0.5 tabular-nums ${isFertilizerActive ? "text-red-500" : "text-text-secondary"}`}>({daysSinceFertilizer} zile)</span>
                  )}
                </div>
              </div>
            </div>
            <div 
              className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 text-center gap-0.5 cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
              onClick={(e) => { e.stopPropagation(); setInfoModal('visits'); }}
            >
              <div className="flex items-center gap-1">
                <Hash size={10} className="text-text-secondary/50" />
                <span className="text-[11px] font-black text-main tabular-nums">{visitsThisYear} <span className="text-[8px] font-bold text-text-secondary/50">{t('visits')}</span></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Action Bar ─────────────────────────────────────────────────── */}
      <div className="px-4 pb-3 pt-0 border-t border-black/5 dark:border-white/5 mt-auto">
        <div className="flex items-center justify-between pt-2">
          {/* Schedule icon button (date already shown in top-right badge) */}
          <button
            onClick={(e) => { e.stopPropagation(); if (!isInactive) handleOpenSchedule(client); }}
            disabled={isInactive}
            className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all
              ${isInactive
                ? 'bg-gray-500/10 text-gray-500/50 cursor-not-allowed border border-gray-500/20'
                : isScheduled
                  ? 'bg-accent-color/10 text-accent-color hover:bg-accent-color/20 border border-accent-color/20'
                  : 'bg-red-500/8 text-red-500 hover:bg-red-500/15 border border-red-500/15'
              }`}
            title={isInactive ? t('Nu se poate programa un client inactiv') : isScheduled && scheduledVisit ? `Programat pe ${getDisplayDate(scheduledVisit)}` : t('Schedule Visit')}
          >
            {isScheduled
              ? <CalendarClock size={14} strokeWidth={1.5} />
              : <CalendarPlus size={14} strokeWidth={1.5} />
            }
          </button>

          {/* Secondary actions */}
          <div className="flex items-center gap-1">
            {accountType !== 'PF' && userRole === 'admin' && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); if (hasDebt) setPaymentModal({ isOpen: true, client, amount: (client.sold || 0).toString() }); }}
                  disabled={!hasDebt}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all
                    ${hasDebt ? 'text-red-500 hover:bg-red-500/10 border border-red-500/15 bg-red-500/5' : 'text-text-secondary/30 cursor-not-allowed'}`}
                  title={hasDebt ? t('Collect Payment') : t('No balance to collect')}
                >
                  <HandCoins size={14} strokeWidth={1.5} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const portalLink = `${window.location.origin}${window.location.pathname}#client-portal/${client.id}`;
                    navigator.clipboard.writeText(portalLink).then(() => toast.success(t('Portal link copied to clipboard!')));
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-accent-color bg-accent-color/8 hover:bg-accent-color/15 border border-accent-color/15 transition-all"
                  title={t('Copy Client Portal Link')}
                >
                  <ExternalLink size={14} strokeWidth={1.5} />
                </button>
              </>
            )}
            {profileRole === 'admin' && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onNavigate(Page.ClientForm, client.id); }}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-text-secondary hover:text-accent-color hover:bg-accent-color/8 transition-all"
                  title={t('Edit Client')}
                >
                  <Pencil size={14} strokeWidth={1.5} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteClientModal({ isOpen: true, clientId: client.id }); }}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-text-secondary hover:text-red-500 hover:bg-red-500/8 transition-all"
                  title={t('Delete')}
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <ClientInfoModal
        isOpen={infoModal !== null}
        onClose={() => { setInfoModal(null); setInfoModalProperty(null); }}
        client={client}
        type={infoModal || 'visits'}
        visits={visitsByClientId[client.id] || []}
        properties={clientProperties}
        organizationId={client.organizationId}
        defaultPropertyId={infoModalProperty || undefined}
      />
    </div>
  );
});
