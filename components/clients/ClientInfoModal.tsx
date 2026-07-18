import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Calendar, CheckCircle2, DollarSign, MapPin, Hash, Sprout, Loader2 } from 'lucide-react';
import { Client, Property, Visit, Invoice } from '../../src/types';
import { collection, query, where, getDocs, db } from '../../services/firebase';
import { format, differenceInDays } from 'date-fns';
import { parseSafeDate } from '../../utils/date';

interface ClientInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  type: 'visits' | 'fertilizer' | 'properties' | 'financial';
  visits: Visit[];
  properties: Property[];
  organizationId: string;
  fetchVisits?: boolean;
  defaultPropertyId?: string;
}

export const ClientInfoModal: React.FC<ClientInfoModalProps> = ({
  isOpen,
  onClose,
  client,
  type,
  visits: initialVisits,
  properties,
  organizationId,
  fetchVisits = false,
  defaultPropertyId
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [fetchedVisits, setFetchedVisits] = useState<Visit[]>([]);

  const clientProperties = useMemo(() => {
    return properties.filter(p => p.clientId === client.id);
  }, [properties, client.id]);

  const [selectedFertProperty, setSelectedFertProperty] = useState<string>(
    defaultPropertyId || (clientProperties.length > 0 ? clientProperties[0].id : '')
  );

  useEffect(() => {
    if (isOpen) {
      if (defaultPropertyId) {
        setSelectedFertProperty(defaultPropertyId);
      } else if (clientProperties.length > 0 && !clientProperties.find(p => p.id === selectedFertProperty)) {
        setSelectedFertProperty(clientProperties[0].id);
      }
    }
  }, [clientProperties, defaultPropertyId, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && type === 'financial') {
      const fetchFinancials = async () => {
        setLoading(true);
        try {
          const invQuery = query(collection(db, 'invoices'), where('clientId', '==', client.id));
          const payQuery = query(collection(db, 'client_history'), where('clientId', '==', client.id), where('type', '==', 'payment'));
          
          const [invSnap, paySnap] = await Promise.all([getDocs(invQuery), getDocs(payQuery)]);
          const getTime = (d: any) => d?.toMillis?.() || d?.seconds ? d.seconds * 1000 : (d?.getTime?.() || 0);
          setInvoices(invSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)).sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt)));
          setPayments(paySnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a: any, b: any) => getTime(b.date) - getTime(a.date)));
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      fetchFinancials();
    }
    
    if (isOpen && fetchVisits && (type === 'visits' || type === 'fertilizer')) {
      const fetchClientVisits = async () => {
        setLoading(true);
        try {
          const vQuery = query(collection(db, 'visits'), where('clientId', '==', client.id));
          const vSnap = await getDocs(vQuery);
          setFetchedVisits(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as Visit)));
        } catch(e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      fetchClientVisits();
    }
  }, [isOpen, type, client.id, organizationId, fetchVisits]);

  const visits = fetchVisits ? fetchedVisits : initialVisits;
  const completedVisits = useMemo(() => visits.filter(v => v.status === 'Finalizat').sort((a, b) => parseSafeDate(b.data).getTime() - parseSafeDate(a.data).getTime()), [visits]);
  
  const fertilizerVisits = useMemo(() => {
    return visits.filter(v => v.status === 'Finalizat' && v.servicii_efectuate?.some(s => s.name.toLowerCase().includes('ingrasamant') || s.name.toLowerCase().includes('fertilizare')))
      .sort((a, b) => parseSafeDate(b.data).getTime() - parseSafeDate(a.data).getTime());
  }, [visits]);

  const filteredFertVisits = useMemo(() => {
    return fertilizerVisits.filter(v => v.propertyId === selectedFertProperty);
  }, [fertilizerVisits, selectedFertProperty]);

  const renderDate = (d: any) => {
    if (!d) return '';
    try {
      if (d.toDate && typeof d.toDate === 'function') return format(d.toDate(), 'dd MMM yyyy');
      if (d.seconds) return format(new Date(d.seconds * 1000), 'dd MMM yyyy');
      if (d instanceof Date) return format(d, 'dd MMM yyyy');
      const parsed = parseSafeDate(d as any);
      if (parsed) return format(parsed, 'dd MMM yyyy');
    } catch (e) {
      return '';
    }
    return '';
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="bg-bg-card w-full max-w-sm rounded-2xl shadow-2xl relative animate-in zoom-in duration-300 flex flex-col max-h-[80vh] overflow-hidden border border-black/5 dark:border-white/10">
        <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/5">
          <div className="flex flex-col">
            <h3 className="text-sm font-black text-main uppercase tracking-wider">
              {type === 'visits' && t('Istoric Vizite')}
              {type === 'fertilizer' && t('Istoric Îngrășământ')}
              {type === 'properties' && t('Zone / Proprietăți')}
              {type === 'financial' && t('Istoric Financiar')}
            </h3>
            <p className="text-[10px] text-text-secondary uppercase font-bold">
              {client.tip_persoana === 'PJ' && client.numeFirma ? `${client.numeFirma} (${client.nume})` : client.nume}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-text-secondary hover:text-main hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
          {type === 'visits' && (
            completedVisits.length > 0 ? completedVisits.map((v, i) => {
              const prevVisit = completedVisits[i + 1];
              const diffDays = prevVisit ? differenceInDays(parseSafeDate(v.data), parseSafeDate(prevVisit.data)) : null;
              const diffToNow = i === 0 ? differenceInDays(new Date(), parseSafeDate(v.data)) : null;

              return (
              <div key={v.id}>
                {i === 0 && diffToNow !== null && (
                  <div className="flex flex-col items-center justify-center mb-1.5">
                     <span className="text-[9px] font-black uppercase text-text-secondary/50 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">{diffToNow} zile până în prezent</span>
                     <div className="h-2 border-l-2 border-dashed border-black/10 dark:border-white/10 mt-1.5" />
                  </div>
                )}
                <div className="flex flex-col p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                  <div className="flex justify-between items-center mb-1 gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-black text-main shrink-0">{format(parseSafeDate(v.data), 'dd MMM yyyy')}</span>
                      {diffDays !== null && (
                        <span className="text-[8px] font-black uppercase text-text-secondary/60 bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded-md shrink-0">{diffDays} zile distanță</span>
                      )}
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">{t('Finalizat')}</span>
                  </div>
                <p className="text-[10px] text-text-secondary font-medium leading-tight">{v.detalii || v.tipLucrare || t('Niciun detaliu')}</p>
                </div>
              </div>
            )}) : <p className="text-center text-xs text-text-secondary py-4 font-bold uppercase">{t('Nicio vizită finalizată')}</p>
          )}

          {type === 'fertilizer' && (
            <div className="flex flex-col gap-3">
              {clientProperties.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar shrink-0">
                  {clientProperties.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => setSelectedFertProperty(p.id)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-colors flex items-center gap-1 ${selectedFertProperty === p.id ? 'bg-emerald-500 text-white' : 'bg-black/5 dark:bg-white/5 text-text-secondary hover:bg-black/10 dark:hover:bg-white/10'}`}
                    >
                      <MapPin size={10} />
                      {p.name || p.address}
                    </button>
                  ))}
                </div>
              )}
              {filteredFertVisits.length > 0 ? filteredFertVisits.map((v, i) => {
                const fertService = v.servicii_efectuate?.find(s => s.name.toLowerCase().includes('ingrasamant') || s.name.toLowerCase().includes('fertilizare'));
                const prevVisit = filteredFertVisits[i + 1];
                const diffDays = prevVisit ? differenceInDays(parseSafeDate(v.data), parseSafeDate(prevVisit.data)) : null;
                const diffToNow = i === 0 ? differenceInDays(new Date(), parseSafeDate(v.data)) : null;

                return (
                <div key={v.id}>
                  {i === 0 && diffToNow !== null && (
                    <div className="flex flex-col items-center justify-center mb-1.5">
                       <span className="text-[9px] font-black uppercase text-emerald-600/50 bg-emerald-500/5 px-2 py-0.5 rounded-full">{diffToNow} zile până în prezent</span>
                       <div className="h-2 border-l-2 border-dashed border-emerald-500/20 mt-1.5" />
                    </div>
                  )}
                  <div className="flex justify-between items-center p-3 rounded-xl border border-emerald-500/10 bg-emerald-500/5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Sprout size={14} className="text-emerald-500 shrink-0" />
                        <span className="text-[11px] font-black text-main shrink-0">{format(parseSafeDate(v.data), 'dd MMM yyyy')}</span>
                        {diffDays !== null && (
                          <span className="text-[8px] font-black uppercase text-emerald-600/70 bg-emerald-500/10 px-1.5 py-0.5 rounded-md shrink-0">{diffDays} zile distanță</span>
                        )}
                      </div>

                    </div>
                    <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                      {fertService?.quantity || '?'} {fertService?.unit || 'kg'}
                    </span>
                  </div>
                </div>
              )}) : <p className="text-center text-xs text-text-secondary py-4 font-bold uppercase">{t('Nicio aplicare de îngrășământ')}</p>}
            </div>
          )}

          {type === 'properties' && (
            clientProperties.length > 0 ? clientProperties.map(p => (
              <div key={p.id} className="flex flex-col p-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[11px] font-black text-main flex-1 pr-2">{p.name || p.address}</span>
                  <span className="text-[11px] font-black text-accent-color whitespace-nowrap">{p.surfaceArea || 0} m²</span>
                </div>
                {p.name && p.address && <p className="text-[9px] text-text-secondary uppercase">{p.address}</p>}
              </div>
            )) : <p className="text-center text-xs text-text-secondary py-4 font-bold uppercase">{t('Nicio proprietate')}</p>
          )}

          {type === 'financial' && (
            loading ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin text-accent-color" size={20} /></div>
            ) : (
              <div className="space-y-4">
                {invoices.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">{t('Facturi Emise')}</h4>
                    <div className="space-y-2">
                      {invoices.map(inv => (
                        <div key={inv.id} className="flex justify-between items-center p-2.5 rounded-lg border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-main">{(inv as any).number || t('Factură')}</span>
                            <span className="text-[9px] text-text-secondary">{renderDate(inv.createdAt)}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[11px] font-black text-main">{(inv as any).total} RON</span>
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${inv.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                              {inv.status === 'paid' ? t('Încasat') : t('Neîncasat')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {payments.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">{t('Încasări')}</h4>
                    <div className="space-y-2">
                      {payments.map(pay => (
                        <div key={pay.id} className="flex justify-between items-center p-2.5 rounded-lg border border-emerald-500/10 bg-emerald-500/5">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-main">{pay.details || t('Încasare')}</span>
                            <span className="text-[9px] text-text-secondary">{renderDate(pay.date)}</span>
                          </div>
                          <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">+{pay.amount} RON</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {invoices.length === 0 && payments.length === 0 && (
                  <p className="text-center text-xs text-text-secondary py-4 font-bold uppercase">{t('Niciun istoric financiar')}</p>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
