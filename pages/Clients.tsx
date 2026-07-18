import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { List, Phone, MessageCircle, MapPin, Building2, User, Users, Pencil, Trash2, Calendar, Wallet, X, Check, Search, Mail, ChevronUp, ChevronDown, DollarSign, CreditCard, Ruler, Sprout, Coins, Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, History, CalendarClock, Hash, Plus, CalendarPlus, Eye, FileText, LayoutGrid, GripVertical, UserPlus, ExternalLink, Droplets, Loader2 } from 'lucide-react';
import { format, getDay } from 'date-fns';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useData } from '../src/context/DataContext';
import { EmptyState } from '../components/EmptyState';
import { ClientTable } from '../components/clients/ClientTable';
import { ClientCard } from '../components/clients/ClientCard';
import { ScheduleModal } from '../components/clients/ScheduleModal';
import NewLeadModal from '../components/NewLeadModal';
import EditLeadModal from '../components/EditLeadModal';
import { ClientHistoryModal } from '../components/ClientHistoryModal';
import { SmartDateInput } from '../components/SmartDateInput';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { ClientsPageSkeleton } from '../components/PageSkeletons';
import { usePlan } from '../src/hooks/usePlan';
import { getWhatsAppLink } from '../utils/phone';
import { PaymentModal } from '../components/PaymentModal';
import { isDebtor } from '../utils/clientUtils';
import { toast } from 'react-hot-toast';
import { UpsellModal } from '../components/UpsellModal';
import { WhatsAppIcon } from '../components/WhatsAppIcon';

import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  where,
  limit,
  deleteDoc,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
  getDoc,
  writeBatch,
  storage,
  ref,
  listAll,
  deleteObject,
  auth,
  handleFirestoreError,
  OperationType
} from '../services/firebase';
import { logAudit, AuditAction } from '../services/audit';
import { Client, Page, Visit, Property, Organization, UserProfile, PotentialClient, ServiceType } from '../src/types';
import { useDebounce } from '../hooks/useDebounce';
import { logger } from '../services/logger';
import { AdBanner } from '../src/components/AdBanner';
import { getMapsUrl } from '../utils/maps';
import { isIrrigatingToday } from '../utils/irrigation';
import { formatLongDate, formatShortDate, parseSafeDate, calculateDaysSinceLastVisit } from '../utils/date';

interface Props {
  onNavigate: (page: Page, id?: string) => void;
  organizationId: string;
  userProfile: UserProfile;
  userRole?: string;
}

const LostReasonModal = ({ isOpen, leadId, onClose, onConfirm, t }: { isOpen: boolean, leadId: string | null, onClose: () => void, onConfirm: (reason: PotentialClient['lostReason']) => void, t: any }) => {
  if (!isOpen) return null;
  return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-card p-6 rounded-xl w-full max-w-sm">
              <h3 className="text-lg font-bold mb-4">{t('Lost Reason')}</h3>
              <div className="space-y-2">
                  <button onClick={() => onConfirm('pret_mare')} className="w-full text-left p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">{t('Price too high')}</button>
                  <button onClick={() => onConfirm('timp_mare')} className="w-full text-left p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">{t('Execution time too high')}</button>
                  <button onClick={() => onConfirm('nu_raspuns')} className="w-full text-left p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">{t('No response')}</button>
              </div>
              <button onClick={onClose} className="mt-4 w-full p-2 text-zinc-500">{t('Cancel')}</button>
          </div>
      </div>
  );
};



const Clients: React.FC<Props> = ({ onNavigate, organizationId, userProfile: profile, userRole = 'employee' }) => {
  const { t } = useTranslation();

  const { subscriptionTier, limits } = usePlan();
  const accountType = profile.accountType || 'PJ';
  const [clientsSearchTerm, setClientsSearchTerm] = useState('');
  const debouncedClientsSearch = useDebounce(clientsSearchTerm, 300);
  const [leadsSearchTerm, setLeadsSearchTerm] = useState('');
  const debouncedLeadsSearch = useDebounce(leadsSearchTerm, 300);
  const [searchedClients, setSearchedClients] = useState<Client[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  // const [orgSettings, setOrgSettings] = useState<Organization | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { clients, leads, properties, visits, organization: orgSettings, employees, loading } = useData();
  // Removed local leads query

  // Modals State
  const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean, client: Client | null, amount: string }>({ isOpen: false, client: null, amount: '' });
  const [scheduleModal, setScheduleModal] = useState<{ 
    isOpen: boolean, 
    client: Client | null, 
    date: string, 
    propertyId?: string,
    assignedTo?: string,
    tipLucrare?: string
  }>({ isOpen: false, client: null, date: '' });
  const [editLeadModal, setEditLeadModal] = useState<{ isOpen: boolean, lead: PotentialClient | null }>({ isOpen: false, lead: null });
  const [deleteLeadModal, setDeleteLeadModal] = useState<{ isOpen: boolean, leadId: string | null }>({ isOpen: false, leadId: null });
  const [deleteClientModal, setDeleteClientModal] = useState<{ isOpen: boolean, clientId: string | null }>({ isOpen: false, clientId: null });
  const [lostReasonModal, setLostReasonModal] = useState<{ isOpen: boolean, leadId: string | null }>({ isOpen: false, leadId: null });
  const [upsellModal, setUpsellModal] = useState<{ isOpen: boolean, featureName: string }>({ isOpen: false, featureName: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState<{clientId: string, clientName: string, propertyId?: string, propertyName?: string} | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const element = document.getElementById('anchor-clienti');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 10;

  // Helper to calculate next available slot
  const getNextAvailableTime = async (dateStr: string) => {
    const defaultStart = orgSettings?.startTime || '09:00';
    try {
      const q = query(
        collection(db, 'visits'), 
        where('organizationId', '==', organizationId),
        where('data', '==', dateStr),
        where('status', 'in', ['Programat', 'Activ', 'Finalizat'])
      );
      const snap = await getDocs(q);
      if (snap.empty) return defaultStart;

      // Find the latest start time
      let maxTime = '00:00';
      snap.docs.forEach(d => {
        const v = d.data();
        if (v.oraProgramare && v.oraProgramare !== 'OFF' && v.oraProgramare > maxTime) {
          maxTime = v.oraProgramare;
        }
      });

      if (maxTime === '00:00') return defaultStart;

      // Add 1 hour
      const [h, m] = maxTime.split(':').map(Number);
      let nextH = h + 1;
      let nextM = m;

      // Round to 30 mins
      if (nextM < 15) nextM = 0;
      else if (nextM < 45) nextM = 30;
      else {
        nextM = 0;
        nextH++;
      }

      const endH = parseInt((orgSettings?.endTime || '18:00').split(':')[0]);
      if (nextH >= endH) return defaultStart; 

      return `${nextH.toString().padStart(2, '0')}:${nextM.toString().padStart(2, '0')}`;
    } catch (e) {
      console.error("Error calculating time:", e);
      return defaultStart;
    }
  };

  const handleOpenSchedule = async (client: Client) => {
    let dateStr = format(new Date(), 'yyyy-MM-dd'); // Default to today
    let propId = '';
    const clientProps = properties.filter(p => p.clientId === client.id);
    if (clientProps.length > 0) propId = clientProps[0].id;

    // Check if there's already a scheduled visit FOR THE SELECTED property
    const existingVisit = visits.find(v => 
        v.clientId === client.id && 
        v.propertyId === propId &&
        (v.status === 'Programat' || v.status === 'Activ')
    );
    
    if (existingVisit) {
        // Use the visit date if it exists
        dateStr = existingVisit.data || format(new Date(), "yyyy-MM-dd");
    } else if (client.contractType === 'maintenance') {
        // Calculate next date based on frequency
        let baseDate = new Date();
        baseDate.setHours(0, 0, 0, 0);
        try {
            const clientVisits = (visits || []).filter(v => v.clientId === client.id && v.status === 'Finalizat');
            if (clientVisits.length > 0) {
                const sorted = clientVisits.sort((a,b) => {
                    const timeA = a.completedAt?.toMillis ? a.completedAt.toMillis() : (a.completedAt instanceof Date ? a.completedAt.getTime() : 0);
                    const timeB = b.completedAt?.toMillis ? b.completedAt.toMillis() : (b.completedAt instanceof Date ? b.completedAt.getTime() : 0);
                    return timeB - timeA;
                });
                if (sorted[0] && sorted[0].completedAt) {
                    baseDate = sorted[0].completedAt.toDate ? sorted[0].completedAt.toDate() : new Date(sorted[0].completedAt as any);
                    baseDate.setHours(0, 0, 0, 0);
                }
            }
        } catch(err) { console.error(err); }
        
        let daysToAdd = 0;
        if (client.maintenanceFrequency === 'weekly') daysToAdd = 7;
        else if (client.maintenanceFrequency === 'biweekly') daysToAdd = 14;
        else if (client.maintenanceFrequency === 'monthly') daysToAdd = 30;

        if (daysToAdd > 0) {
            baseDate.setDate(baseDate.getDate() + daysToAdd);
        }

        // If calculated date is in the past, default to today
        if (baseDate < new Date(new Date().setHours(0,0,0,0))) {
            baseDate = new Date();
            baseDate.setHours(0,0,0,0);
        }

        dateStr = format(baseDate, 'yyyy-MM-dd');
    }

    setScheduleModal({ 
        isOpen: true, 
        client, 
        date: dateStr, 
        propertyId: propId,
        assignedTo: auth.currentUser?.uid || '',
        tipLucrare: t('Maintenance')
    });
  };

  const handleDeleteLead = async (leadId: string) => {
    setDeleteLeadModal({ isOpen: true, leadId });
  };

  const handleUpdateLeadNote = async (id: string, note: string) => {
    try {
      await updateDoc(doc(db, 'leads', id), { notite: note });
      toast.success(t('Note updated'));
    } catch (err) {
      console.error(err);
      toast.error(t('Error updating note'));
    }
  };

  const handleUpdateLeadStatus = async (leadId: string, status: PotentialClient['status'], lostReason?: PotentialClient['lostReason']) => {
    try {
      const updateData: any = { status };
      if (lostReason) {
          updateData.lostReason = lostReason;
      }
      await updateDoc(doc(db, 'leads', leadId), updateData);
      setLostReasonModal({ isOpen: false, leadId: null });
      logger.log(t('Lead Status Updated'), "success");
    } catch (err: any) {
      console.error("Error updating lead status:", err);
      alert(t('Error updating status', { message: err.message }));
    }
  };

  const handleEditLead = (lead: PotentialClient) => {
    setEditLeadModal({ isOpen: true, lead });
  };



  // Removed local properties query

  // Removed local visits query

  // Migrated to global context
  

  // Migrated to global context
  // Migrated to global context

  const propertiesByClientId = useMemo(() => {
    const map: Record<string, Property[]> = {};
    (properties || []).forEach(p => {
      if (!map[p.clientId]) map[p.clientId] = [];
      map[p.clientId].push(p);
    });
    return map;
  }, [properties]);

  const visitsByClientId = useMemo(() => {
    const map: Record<string, Visit[]> = {};
    (visits || []).forEach(v => {
      if (!map[v.clientId]) map[v.clientId] = [];
      map[v.clientId].push(v);
    });
    return map;
  }, [visits]);

  useEffect(() => {
    if (!debouncedClientsSearch.trim()) {
      setSearchedClients(null);
      return;
    }

    const searchClients = async () => {
      setIsSearching(true);
      try {
        const term = debouncedClientsSearch.trim();
        const termLower = term.toLowerCase();
        const capitalizedTerm = term.charAt(0).toUpperCase() + term.slice(1);

        const q1 = query(
          collection(db, 'clients'),
          where('organizationId', '==', organizationId),
          where('nume', '>=', capitalizedTerm),
          where('nume', '<=', capitalizedTerm + '\uf8ff'),
          limit(30)
        );

        const q2 = query(
          collection(db, 'clients'),
          where('organizationId', '==', organizationId),
          where('nume', '>=', termLower),
          where('nume', '<=', termLower + '\uf8ff'),
          limit(30)
        );

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        const map: Record<string, Client> = {};
        
        snap1.forEach(d => {
          map[d.id] = { id: d.id, ...d.data() } as Client;
        });
        snap2.forEach(d => {
          map[d.id] = { id: d.id, ...d.data() } as Client;
        });

        clients.forEach(c => {
          if (
            (c.nume || '').toLowerCase().includes(termLower) ||
            (c.numeFirma || '').toLowerCase().includes(termLower) ||
            (c.adresa || '').toLowerCase().includes(termLower) ||
            (c.telefon || '').toLowerCase().includes(termLower)
          ) {
            map[c.id] = c;
          }
        });

        setSearchedClients(Object.values(map));
      } catch (err) {
        console.error("On-demand search error:", err);
      } finally {
        setIsSearching(false);
      }
    };
    searchClients();
  }, [debouncedClientsSearch, organizationId, clients]);

  const augmentedClients = useMemo(() => {
    const activeClientsList = searchedClients !== null ? searchedClients : (clients || []);
    return activeClientsList.map(client => {
      const clientProps = propertiesByClientId[client.id] || [];
      
      if (clientProps.length === 0) {
        return {
          ...client,
          sold: client.sold || 0,
          tarifLunar: client.tarifLunar || 0,
          suprafataMp: client.suprafataMp || 0,
          propertyCount: 0
        };
      }

      let sumSold = 0;
      let sumTarif = 0;
      let sumSuprafata = 0;
      let contractType = client.contractType;
      let maintenanceFrequency = client.maintenanceFrequency;
      let ziScadenta = client.ziScadenta;
      let dataScadenta = client.dataScadenta;

      const hasMaintenance = clientProps.some(p => p.contractType === 'maintenance');
      if (hasMaintenance) {
        contractType = 'maintenance';
        const maintProp = clientProps.find(p => p.contractType === 'maintenance' && p.maintenanceFrequency);
        if (maintProp) {
          maintenanceFrequency = maintProp.maintenanceFrequency;
        }
      } else if (clientProps.length > 0 && clientProps[0].contractType) {
        contractType = clientProps[0].contractType;
      }

      clientProps.forEach(p => {
        sumSold += Number(p.sold || 0);
        sumTarif += Number(p.tarifLunar || 0);
        sumSuprafata += Number(p.surfaceArea || p.suprafataMp || 0);
        if (Number(p.sold || 0) > 0 && p.ziScadenta && (!ziScadenta || p.ziScadenta < ziScadenta)) {
          ziScadenta = p.ziScadenta;
        }
        if (p.dataScadenta) {
          dataScadenta = p.dataScadenta;
        }
      });

      return {
        ...client,
        sold: sumSold,
        tarifLunar: sumTarif,
        suprafataMp: sumSuprafata,
        contractType,
        maintenanceFrequency,
        ziScadenta,
        dataScadenta,
        propertyCount: clientProps.length
      };
    });
  }, [clients, propertiesByClientId, searchedClients]);

  // Using sorted serviceTypes from DataContext
  

  const [clientsStatusFilter, setClientsStatusFilter] = useState<string>('All');
  const [leadsStatusFilter, setLeadsStatusFilter] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'clients' | 'leads'>('clients');
  const [showBadPayersOnly, setShowBadPayersOnly] = useState(false);
  const [contractTypeFilter, setContractTypeFilter] = useState<string>('All');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('All');
  const [daysWithoutVisitFilter, setDaysWithoutVisitFilter] = useState<string>('All');
  const [clientSortOrder, setClientSortOrder] = useState<string>('manual');
  const [isCompactView, setIsCompactView] = useState(false);
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [dragOverClientId, setDragOverClientId] = useState<string | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Load preferences from profile
  useEffect(() => {
    if (profile) {
      const p = profile as any;
      if (p.clientsCompactView !== undefined) setIsCompactView(p.clientsCompactView);
      if (p.clientsStatusFilter) setClientsStatusFilter(p.clientsStatusFilter);
      if (p.leadsStatusFilter) setLeadsStatusFilter(p.leadsStatusFilter);
      if (p.clientsShowBadPayersOnly !== undefined) setShowBadPayersOnly(p.clientsShowBadPayersOnly);
      if (p.contractTypeFilter) setContractTypeFilter(p.contractTypeFilter);
      if (p.frequencyFilter) setFrequencyFilter(p.frequencyFilter);
      if (p.daysWithoutVisitFilter) setDaysWithoutVisitFilter(p.daysWithoutVisitFilter);
      if (p.clientSortOrder) setClientSortOrder(p.clientSortOrder);
      setProfileLoaded(true);
    }
  }, [profile]);
  useEffect(() => {
    const handleMobileAdd = (e: any) => {
      if (e.detail.page === 'Clients') {
        if (activeTab === 'clients') onNavigate('ClientForm' as any);
        else setShowLeadModal(true);
      }
    };
    window.addEventListener('ls_mobile_add_click', handleMobileAdd);
    return () => window.removeEventListener('ls_mobile_add_click', handleMobileAdd);
  }, [activeTab, onNavigate]);
  const isInitialMount = useRef(true);

  // Save view preferences to Firestore
  useEffect(() => {
    if (!profileLoaded) return; // Don't save default state before loading
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    updateDoc(userRef, {
      clientsCompactView: isCompactView,
      clientsStatusFilter: clientsStatusFilter,
      leadsStatusFilter: leadsStatusFilter,
      clientsShowBadPayersOnly: showBadPayersOnly,
      contractTypeFilter,
      frequencyFilter,
      daysWithoutVisitFilter,
      clientSortOrder
    }).catch(err => {
      console.error("Error saving view preferences:", err);
    });
  }, [isCompactView, clientsStatusFilter, leadsStatusFilter, showBadPayersOnly, contractTypeFilter, frequencyFilter, daysWithoutVisitFilter, clientSortOrder, profileLoaded]);


  const sortedClients = useMemo(() => {
    const items = [...augmentedClients];
    items.sort((a, b) => {
      if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
      return (a.nume || '').localeCompare(b.nume || '');
    });
    return items;
  }, [augmentedClients]);

  const filteredClients = useMemo(() => {
    let result = sortedClients.filter(c => {
      const matchesSearch = (c.nume || '').toLowerCase().includes(debouncedClientsSearch.toLowerCase()) ||
      (c.numeFirma || '').toLowerCase().includes(debouncedClientsSearch.toLowerCase()) ||
      (c.adresa || '').toLowerCase().includes(debouncedClientsSearch.toLowerCase());
      
      const actualStatus = (c.status || 'Activ').toLowerCase();
      const filterStatus = clientsStatusFilter.toLowerCase();
      
      let matchesStatus = false;
      if (filterStatus === 'all') {
        matchesStatus = true;
      } else if (filterStatus === 'activ') {
        matchesStatus = actualStatus === 'activ' || actualStatus === 'active';
      } else if (filterStatus === 'inactiv') {
        matchesStatus = actualStatus === 'inactiv' || actualStatus === 'inactive';
      } else if (filterStatus === 'programati') {
        const clientVisits = visitsByClientId[c.id] || [];
        matchesStatus = clientVisits.some(v => v.status === 'Programat' || v.status === 'Activ');
      } else if (filterStatus === 'neprogramati') {
        const clientVisits = visitsByClientId[c.id] || [];
        matchesStatus = !clientVisits.some(v => v.status === 'Programat' || v.status === 'Activ');
      }

      const matchesBadPayer = !showBadPayersOnly || isDebtor(c, true);
      
      const clientProps = propertiesByClientId[c.id] || [];
      
      let matchesContract = contractTypeFilter === 'All' || c.contractType === contractTypeFilter || clientProps.some(p => p.contractType === contractTypeFilter);
      let matchesFrequency = frequencyFilter === 'All' || c.maintenanceFrequency === frequencyFilter || clientProps.some(p => p.maintenanceFrequency === frequencyFilter);
      
      let matchesDaysWithoutVisit = true;
      if (daysWithoutVisitFilter !== 'All') {
          const limit = parseInt(daysWithoutVisitFilter, 10);
          const diffDays = calculateDaysSinceLastVisit(visitsByClientId[c.id] || [], c.id, clientProps[0]?.id);
          // If diffDays is null, they have never been visited, which means days without visit is essentially Infinity, so it matches.
          if (diffDays !== null && diffDays < limit) matchesDaysWithoutVisit = false;
      }
      
      return matchesSearch && matchesStatus && matchesBadPayer && matchesContract && matchesFrequency && matchesDaysWithoutVisit;
    });

    if (clientSortOrder !== 'manual') {
      result.sort((a, b) => {
        switch (clientSortOrder) {
          case 'area-desc': return (b.suprafataMp || 0) - (a.suprafataMp || 0);
          case 'area-asc': return (a.suprafataMp || 0) - (b.suprafataMp || 0);
          case 'debt-desc': return (b.sold || 0) - (a.sold || 0);
          case 'debt-asc': return (a.sold || 0) - (b.sold || 0);
          case 'price-desc': return (b.tarifLunar || 0) - (a.tarifLunar || 0);
          case 'price-asc': return (a.tarifLunar || 0) - (b.tarifLunar || 0);
          case 'date-desc':
          case 'date-asc': {
            // Function to safely parse dates inside the loop
            const getSortDate = (c: any) => {
              const scheduled = (visitsByClientId[c.id] || []).filter(v => v.status === 'Programat' || v.status === 'Activ');
              if (scheduled.length === 0) return Infinity;
              return scheduled.map(v => {
                const parts = (v.data || '').split('-');
                if (parts.length === 3) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
                return Infinity;
              }).sort((x, y) => x - y)[0] || Infinity;
            };
            const vA = getSortDate(a);
            const vB = getSortDate(b);
            return clientSortOrder === 'date-asc' ? vA - vB : vB - vA;
          }
          case 'name-asc': return (a.tip_persoana === 'PJ' ? a.numeFirma || a.nume : a.nume || '').localeCompare(b.tip_persoana === 'PJ' ? b.numeFirma || b.nume : b.nume || '');
          case 'name-desc': return (b.tip_persoana === 'PJ' ? b.numeFirma || b.nume : b.nume || '').localeCompare(a.tip_persoana === 'PJ' ? a.numeFirma || a.nume : a.nume || '');
          default: return 0;
        }
      });
    }

    return result;
  }, [sortedClients, debouncedClientsSearch, clientsStatusFilter, showBadPayersOnly, contractTypeFilter, frequencyFilter, daysWithoutVisitFilter, clientSortOrder, visitsByClientId, propertiesByClientId]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchesSearch = (l.nume || '').toLowerCase().includes(debouncedLeadsSearch.toLowerCase()) ||
      (l.adresa || '').toLowerCase().includes(debouncedLeadsSearch.toLowerCase()) ||
      (l.telefon || '').toLowerCase().includes(debouncedLeadsSearch.toLowerCase());
      const matchesStatus = leadsStatusFilter === 'All' || l.status === leadsStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, debouncedLeadsSearch, leadsStatusFilter]);

  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * leadsPerPage;
    return filteredLeads.slice(startIndex, startIndex + leadsPerPage);
  }, [filteredLeads, currentPage, leadsPerPage]);

  const totalClients = augmentedClients.length;
  const activeCount = useMemo(() => augmentedClients.filter(c => (c.status || 'Activ').toLowerCase() === 'activ' || (c.status || '').toLowerCase() === 'active').length, [augmentedClients]);
  const inactiveCount = useMemo(() => augmentedClients.filter(c => (c.status || '').toLowerCase() === 'inactiv' || (c.status || '').toLowerCase() === 'inactive').length, [augmentedClients]);
  const badPayerCount = augmentedClients.filter(c => isDebtor(c, true)).length;

  const handleResetSearch = () => {
    if (activeTab === 'clients') {
      setClientsSearchTerm('');
      setClientsStatusFilter('All');
      setShowBadPayersOnly(false);
      setContractTypeFilter('All');
      setFrequencyFilter('All');
      setDaysWithoutVisitFilter('All');
      setClientSortOrder('manual');
    } else {
      setLeadsSearchTerm('');
      setLeadsStatusFilter('All');
    }
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleClearSearch = () => {
    if (activeTab === 'clients') setClientsSearchTerm('');
    else setLeadsSearchTerm('');
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const migrateFrequencies = async () => {
    try {
      toast.loading('Se migrează frecvențele...', { id: 'migrateFreq' });
      const batch = writeBatch(db);
      let count = 0;

      const normalize = (freq: string) => {
        const lower = freq.toLowerCase();
        if (lower.includes('săptămânal') || lower.includes('saptamanal') || lower === 'weekly') return 'weekly';
        if (lower.includes('2 săptămâni') || lower.includes('2 saptamani') || lower === 'biweekly') return 'biweekly';
        if (lower.includes('lunar') || lower === 'monthly') return 'monthly';
        if (lower.includes('ocazional') || lower === 'occasional') return 'occasional';
        return freq;
      };

      // 1. Clients
      const clientsSnap = await getDocs(query(collection(db, 'clients'), where('organizationId', '==', organizationId)));
      clientsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.maintenanceFrequency) {
          const norm = normalize(data.maintenanceFrequency);
          if (norm !== data.maintenanceFrequency) {
            batch.update(docSnap.ref, { maintenanceFrequency: norm });
            count++;
          }
        }
      });

      // 2. Properties
      const propsSnap = await getDocs(query(collection(db, 'properties'), where('organizationId', '==', organizationId)));
      propsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.maintenanceFrequency) {
          const norm = normalize(data.maintenanceFrequency);
          if (norm !== data.maintenanceFrequency) {
            batch.update(docSnap.ref, { maintenanceFrequency: norm });
            count++;
          }
        }
      });

      if (count > 0) {
        await batch.commit();
        toast.success(`Succes: am actualizat ${count} documente.`, { id: 'migrateFreq' });
      } else {
        toast.success('Baza de date este curată, niciun document modificat.', { id: 'migrateFreq' });
      }
    } catch (e: any) {
      toast.error('Eroare: ' + e.message, { id: 'migrateFreq' });
      console.error(e);
    }
  };

  const handleMove = async (client: Client, direction: 'up' | 'down', list: Client[]) => {
    const index = list.findIndex(c => c.id === client.id);
    if (index === -1) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    // Create a copy of the list to manipulate
    const reorderedList = [...list];
    // Swap the elements in the array
    [reorderedList[index], reorderedList[targetIndex]] = [reorderedList[targetIndex], reorderedList[index]];

    try {
        const batch = writeBatch(db);
        
        // Update order for ALL items in the list to ensure consistency and prevent jumps
        // This effectively normalizes the order values to 0, 1, 2, ...
        reorderedList.forEach((c, i) => {
            // Only update if the order is different to save writes (though batch counts operations, not writes strictly)
            // But for safety and simplicity in batch, we just overwrite.
            // To optimize: check if c.order !== i.
            if (c.order !== i) {
                batch.update(doc(db, 'clients', c.id), { order: i });
            }
        });

        await batch.commit();
    } catch (err) {
        console.error("Error reordering:", err);
        logger.log(t('Reorder Error'), "error");
    }
  };

  const handleDelete = async (id: string) => {
    console.log("handleDelete called for client:", id);
    
    setIsProcessing(true);
    try {
      console.log("Starting batch delete for client:", id);
      const batch = writeBatch(db);

      const clientToDelete = clients.find(c => c.id === id);

      // 1. Delete Client
      batch.delete(doc(db, 'clients', id));

      // 2. Delete Properties
      const propsSnap = await getDocs(query(collection(db, 'properties'), where('clientId', '==', id)));
      propsSnap.forEach(d => batch.delete(d.ref));

      // 3. Delete Visits
      const visitsSnap = await getDocs(query(collection(db, 'visits'), where('clientId', '==', id)));
      visitsSnap.forEach(d => batch.delete(d.ref));

      // 4. Delete History
      const historySnap = await getDocs(query(collection(db, 'client_history'), where('clientId', '==', id)));
      historySnap.forEach(d => batch.delete(d.ref));

      await batch.commit();

      // 5. Delete Storage Files (Recursive for client folder)
      const clientFolderRef = ref(storage, `uploads/${organizationId}/${auth.currentUser?.uid || profile.uid}/${id}`);
      const deleteFolder = async (folderRef: any) => {
        try {
            const list = await listAll(folderRef);
            await Promise.all(list.items.map(item => deleteObject(item)));
            await Promise.all(list.prefixes.map(prefix => deleteFolder(prefix)));
        } catch (err: any) {
            if (err.code !== 'storage/object-not-found') {
                console.warn("Storage delete partial error:", err);
            }
        }
      };
      await deleteFolder(clientFolderRef);

      logger.log(t('Client and associated data deleted completely.'), "warn");
      setDeleteClientModal({ isOpen: false, clientId: null });
    } catch (err: any) {
      console.error("Delete Error:", err);
      toast.error(t('Delete Error') + ": " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleModal.client || !scheduleModal.date) return;

    // Use robust parsing for the selected date
    const scheduledDate = parseSafeDate(scheduleModal.date);
    if (!scheduledDate || isNaN(scheduledDate.getTime())) {
        alert(t('Invalid Date'));
        return;
    }

    const dayOfWeek = getDay(scheduledDate);
    let isWorkingDay = true;
    const workDays = orgSettings?.workDays || 'L-S';
    if (workDays === 'L-V' && (dayOfWeek === 0 || dayOfWeek === 6)) isWorkingDay = false;
    if (workDays === 'L-S' && dayOfWeek === 0) isWorkingDay = false;

    if (!isWorkingDay) {
        alert(t('This day is not a working day.'));
        return;
    }

    setIsProcessing(true);
    try {
      scheduledDate.setHours(0, 0, 0, 0);
      const dateString = format(scheduledDate, 'yyyy-MM-dd');

      // Get property details if selected
      let propertyId = scheduleModal.propertyId;
      
      const clientProps = properties.filter(p => p.clientId === scheduleModal.client!.id);
      const mainProp = clientProps.find(p => p.name === t("Main Location")) || clientProps[0];
      
      let propertyAddress = mainProp?.address || scheduleModal.client.adresa || '';
      let propertyMapsLink = mainProp?.mapsLink || scheduleModal.client.Maps_link || '';

      if (propertyId) {
        const prop = properties.find(p => p.id === propertyId);
        if (prop) {
            propertyAddress = prop.address;
            propertyMapsLink = prop.mapsLink || '';
        }
      }

      // Check if there is already an active/scheduled visit for THIS SPECIFIC property
      const existingVisit = visits.find(v => 
          v.clientId === scheduleModal.client!.id && 
          v.propertyId === (propertyId || (mainProp?.id || null)) &&
          (v.status === 'Programat' || v.status === 'Activ')
      );

      if (existingVisit) {
         await updateDoc(doc(db, 'visits', existingVisit.id), {
             data: format(scheduledDate, 'yyyy-MM-dd'),
             propertyId: propertyId || existingVisit.propertyId,
             propertyAddress: propertyAddress || existingVisit.propertyAddress,
             propertyMapsLink: propertyMapsLink || existingVisit.propertyMapsLink,
             assignedTo: scheduleModal.assignedTo || existingVisit.assignedTo || auth.currentUser?.uid || '',
             assignedToName: employees.find(e => e.uid === scheduleModal.assignedTo)?.displayName || existingVisit.assignedToName || auth.currentUser?.displayName || auth.currentUser?.email || '',
             tipLucrare: scheduleModal.tipLucrare || existingVisit.tipLucrare || t('Maintenance')
         });
         logger.log(t('Rescheduled'), "info");
      } else {
          await addDoc(collection(db, 'visits'), {
            clientId: scheduleModal.client.id,
            clientName: scheduleModal.client.nume || 'Client',
            clientAddress: propertyAddress,
            organizationId,
            status: 'Programat',
            data: format(scheduledDate, 'yyyy-MM-dd'),
            tipLucrare: scheduleModal.tipLucrare || t('Maintenance'),
            createdAt: serverTimestamp(),
            propertyId: propertyId || (mainProp?.id || null),
            propertyAddress: propertyAddress,
            propertyMapsLink: propertyMapsLink,
            assignedTo: scheduleModal.assignedTo || auth.currentUser?.uid || '',
            assignedToName: employees.find(e => e.uid === scheduleModal.assignedTo)?.displayName || auth.currentUser?.displayName || auth.currentUser?.email || ''
          });
          logger.log(t('Scheduled'), "info");
      }

      setScheduleModal({ isOpen: false, client: null, date: '' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedClientId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Small delay to allow the drag image to be created before adding the dragging class
    setTimeout(() => {
      const el = document.getElementById(`client-row-${id}`);
      if (el) el.classList.add('opacity-50');
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== draggedClientId) {
      setDragOverClientId(id);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverClientId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverClientId(null);
    
    if (!draggedClientId || draggedClientId === targetId) {
      const el = document.getElementById(`client-row-${draggedClientId}`);
      if (el) el.classList.remove('opacity-50');
      setDraggedClientId(null);
      return;
    }

    const el = document.getElementById(`client-row-${draggedClientId}`);
    if (el) el.classList.remove('opacity-50');

    // Find indices
    const draggedIndex = clients.findIndex(c => c.id === draggedClientId);
    const targetIndex = clients.findIndex(c => c.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedClientId(null);
      return;
    }

    // Reorder array locally for immediate feedback
    const newClients = [...clients];
    const [draggedClient] = newClients.splice(draggedIndex, 1);
    newClients.splice(targetIndex, 0, draggedClient);

    // Update order in Firestore
    try {
      // We need to update the order field for all affected clients
      // To keep it simple, we can just assign a new order value based on index
      // But it's better to use a batch update
      const batch = writeBatch(db);
      
      newClients.forEach((client, index) => {
        const clientRef = doc(db, 'clients', client.id);
        batch.update(clientRef, { order: index });
      });

      await batch.commit();
      logger.log(t('Clients Reordered'), "info");
    } catch (error) {
      console.error("Error updating client order:", error);
      logger.log(t('Reorder Error'), "error");
    }

    setDraggedClientId(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (draggedClientId) {
      const el = document.getElementById(`client-row-${draggedClientId}`);
      if (el) el.classList.remove('opacity-50');
    }
    setDraggedClientId(null);
    setDragOverClientId(null);
  };



  const LeadCard = React.memo(({ 
    lead, 
    t,
    onNavigate,
    setEditLeadModal,
    setDeleteLeadModal,
    setLostReasonModal
  }: { 
    lead: PotentialClient, 
    t: any,
    onNavigate: (page: Page, id?: string) => void,
    setEditLeadModal: (val: any) => void,
    setDeleteLeadModal: (val: any) => void,
    setLostReasonModal: (val: any) => void
  }) => {
    const cleanPhone = (lead.telefon || '').replace(/[^0-9+]/g, '');
    const waLink = `https://wa.me/${cleanPhone.startsWith('0') ? '4' + cleanPhone : cleanPhone}`;
    
    return (
      <div className="stihl-card bg-bg-card border border-black/5 dark:border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 group">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="font-black text-main uppercase tracking-tighter text-lg">{lead.nume || t('Unnamed Lead')}</h3>
              <p className="text-[11px] font-bold text-text-secondary uppercase tracking-widest">{t('Potential Client')}</p>
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditLeadModal({ isOpen: true, lead })} className="p-2 text-text-secondary hover:text-accent-color hover:bg-accent-color/10 rounded-lg transition-colors"><Pencil size={16} /></button>
            <button onClick={() => setDeleteLeadModal({ isOpen: true, leadId: lead.id })} className="p-2 text-text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16} /></button>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-text-secondary">
            <MapPin size={14} className="text-orange-500/50" />
            <span className="text-xs font-bold truncate">{lead.adresa || t('No Address')}</span>
          </div>
          <div className="flex items-center gap-3 text-text-secondary">
            <Phone size={14} className="text-orange-500/50" />
            <span className="text-xs font-bold">{lead.telefon}</span>
          </div>
          {lead.nextActionDate && (
            <div className="flex items-center gap-3 text-text-secondary">
              <Calendar size={14} className="text-orange-500/50" />
              <span className="text-xs font-bold text-accent-color">{t('Next action')}: {format(new Date(lead.nextActionDate), 'dd.MM.yyyy')}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#25D366]/20">
            <WhatsAppIcon size={14} /> WhatsApp
          </a>
          <button 
            onClick={() => onNavigate(Page.ClientForm, lead.id + '?fromLead=true')}
            className="flex-1 bg-accent-color hover:bg-accent-color/90 text-white py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-accent-color/20"
          >
            <Check size={14} strokeWidth={2.5} /> {t('Convert')}
          </button>
        </div>
      </div>
    );
  });

  const clientStats = useMemo(() => {
    const active = augmentedClients.filter(c => c.status !== 'Inactiv');
    const inactive = augmentedClients.filter(c => c.status === 'Inactiv');
    const activeMaintenance = active.filter(c => c.contractType === 'maintenance');
    const activeOneTime = active.filter(c => c.contractType === 'one-time' || c.contractType === 'project');
    
    return {
      active: active.length,
      inactive: inactive.length,
      maintenance: activeMaintenance.length,
      oneTime: activeOneTime.length
    };
  }, [clients]);


  if (!profileLoaded || loading) {
    return <ClientsPageSkeleton />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20">
      {/* ── PREMIUM TERMINAL HEADER ── */}
      <div className="flex flex-row items-center justify-between gap-4 bg-gradient-to-r from-blue-500/10 via-transparent to-transparent p-3 md:p-5 md:min-h-[104px] rounded-2xl border border-blue-500/10 mb-4 md:mb-6 animate-in slide-in-from-top-4 duration-700">
        
        <div className="flex items-center gap-3 md:gap-5 w-full">
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/30 transform -rotate-3 hover:rotate-0 transition-transform duration-500 shrink-0">
            {profile.accountType === 'PF' ? <LayoutGrid className="w-5 h-5 md:w-7 md:h-7" strokeWidth={2.5} /> : <Users className="w-5 h-5 md:w-7 md:h-7" strokeWidth={2.5} />}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/logo.png" alt="Scapeflow" className="w-3 h-3 md:w-4 md:h-4 object-contain drop-shadow-sm" />
              <h2 className="text-[9px] md:text-[11px] font-black text-blue-500 uppercase tracking-[0.4em] leading-none">Scapeflow</h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[8px] font-black uppercase tracking-tighter shadow-sm">
                {t('Intelligence Terminal')}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-0.5 md:mb-1">
                <h1 className="text-lg md:text-3xl font-black text-main uppercase tracking-tighter leading-none">
                  {profile.accountType === 'PF' ? t('My Garden') : t('Clients Portfolio')}
                </h1>
            </div>
            <p className="text-[9px] md:text-xs text-text-secondary font-bold uppercase tracking-[0.2em] opacity-60 hidden sm:block">
              {profile.accountType === 'PF' ? t('Garden Ledger') : t('Client Relations')}
            </p>
          </div>
        </div>

        <div className="flex flex-row items-center justify-end gap-3 w-auto">
          {profile.accountType !== 'PF' && (
            <div className="hidden md:flex items-center gap-2 mr-2">
              <div className="flex flex-col items-center justify-center px-2.5 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20" title={t('Activi: Mentenanță')}>
                <span className="text-[12px] font-black text-emerald-600 dark:text-emerald-400 leading-none">{clientStats.maintenance}</span>
                <span className="text-[7px] font-bold text-emerald-600/70 dark:text-emerald-400/70 uppercase">Mentenanță</span>
              </div>
              <div className="flex flex-col items-center justify-center px-2.5 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20" title={t('Activi: Intervenții')}>
                <span className="text-[12px] font-black text-blue-600 dark:text-blue-400 leading-none">{clientStats.oneTime}</span>
                <span className="text-[7px] font-bold text-blue-600/70 dark:text-blue-400/70 uppercase">Intervenții</span>
              </div>
              <div className="flex flex-col items-center justify-center px-2.5 py-1 bg-gray-500/10 rounded-lg border border-gray-500/20" title={t('Total Inactivi')}>
                <span className="text-[12px] font-black text-text-secondary leading-none">{clientStats.inactive}</span>
                <span className="text-[7px] font-bold text-text-secondary/70 uppercase">Inactivi</span>
              </div>
            </div>
          )}

          {profile.accountType !== 'PF' && (
            <button 
              onClick={() => {
                if (activeTab === 'clients') {
                  const clientLimit = limits.maxClients;
                  if (activeCount >= clientLimit) {
                    setUpsellModal({ isOpen: true, featureName: `adăugarea de Clienți (max. ${clientLimit})` });
                    return;
                  }
                  onNavigate(Page.ClientForm);
                } else {
                  setShowLeadModal(true);
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all shrink-0"
            >
              <UserPlus size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">{activeTab === 'clients' ? t('Add Client') : t('Add Lead')}</span>
            </button>
          )}
        </div>
      </div>



        {/* Search & Filters */}
        <div id="clients-content-anchor" className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-bg-card border border-black/5 dark:border-white/10 rounded-xl">
          {profile.accountType !== 'PF' && (
            <div className="flex gap-2 p-1.5 bg-bg-main/50 border border-black/5 dark:border-white/5 rounded-2xl">
              <button
                onClick={() => setActiveTab('clients')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'clients'
                    ? 'bg-accent-color text-white shadow-md'
                    : 'text-text-secondary hover:text-main hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {t('Clients')}
              </button>
              <button
                onClick={() => setActiveTab('leads')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'leads'
                    ? 'bg-accent-color text-white shadow-md'
                    : 'text-text-secondary hover:text-main hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {t('Leads')}
              </button>
            </div>
          )}
          </div>

          <div className={`flex w-full sm:w-auto flex-1 ${activeTab === 'clients' ? 'flex-row gap-2' : 'flex-col sm:flex-row gap-3'}`}>
            <div className="relative flex-1 group">
              {isSearching && activeTab === 'clients' ? (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-color animate-spin" size={18} />
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent-color transition-colors" size={18} />
              )}
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder={profile.accountType === 'PF' ? t("Search by name or address...") : t("Search by name, phone or address...")} 
                value={activeTab === 'clients' ? clientsSearchTerm : leadsSearchTerm}
                onChange={(e) => activeTab === 'clients' ? setClientsSearchTerm(e.target.value) : setLeadsSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-bg-card border border-black/5 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-color/50 focus:border-accent-color transition-all placeholder:text-text-secondary/50"
                style={{ paddingLeft: '2.5rem' }}
              />
              {(activeTab === 'clients' ? clientsSearchTerm : leadsSearchTerm) && (
                <button 
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-main p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  title={t("Clear Search")}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            {activeTab === 'clients' && (
              <div className="flex shrink-0">
                <button 
                  onClick={() => setIsCompactView(!isCompactView)}
                  className={`px-4 py-2.5 bg-bg-card border border-black/5 dark:border-white/10 rounded-xl text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-2 whitespace-nowrap h-full ${isCompactView ? 'bg-accent-color/10' : ''}`}
                >
                  {isCompactView ? <List size={18} /> : <LayoutGrid size={18} />}
                </button>
              </div>
            )}

            {activeTab === 'leads' && (
              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                <div className="flex bg-bg-card border border-black/5 dark:border-white/10 rounded-xl p-1 gap-1">
                  {(['All', 'activ', 'lost', 'converted'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setLeadsStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        leadsStatusFilter === status 
                          ? 'bg-orange-500 text-white shadow-md' 
                          : 'text-text-secondary hover:text-main hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {t(status.charAt(0).toUpperCase() + status.slice(1))}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Advanced Filters Row */}
        {activeTab === 'clients' && (
          <div className="flex gap-2 items-center mb-4 overflow-x-auto no-scrollbar pb-2">
            {/* Bad Payers Toggle (Primary Pill) */}
            {profile.accountType !== 'PF' && (
              <button
                onClick={() => setShowBadPayersOnly(!showBadPayersOnly)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 border shrink-0 whitespace-nowrap
                  ${showBadPayersOnly 
                    ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20' 
                    : 'bg-bg-card border-black/5 dark:border-white/10 text-text-secondary hover:text-red-500 hover:border-red-500/30'}`}
              >
                <Coins size={14} strokeWidth={2.5} />
                {t('Restanțieri')}
              </button>
            )}

            {/* Sort Dropdown */}
            <select
              value={clientSortOrder}
              onChange={(e) => setClientSortOrder(e.target.value)}
              className="bg-bg-card border border-black/5 dark:border-white/10 text-text-secondary text-[11px] font-black uppercase tracking-widest rounded-lg px-2 py-1.5 outline-none hover:border-accent-color/30 transition-colors cursor-pointer shrink-0"
            >
              <option value="manual">{t('Manuală')}</option>
              <option value="name-asc">{t('Nume: A-Z')}</option>
              <option value="name-desc">{t('Nume: Z-A')}</option>
              <option value="date-asc">{t('Data Prog. ↑')}</option>
              <option value="date-desc">{t('Data Prog. ↓')}</option>
              <option value="area-desc">{t('Suprafață ↓')}</option>
              <option value="area-asc">{t('Suprafață ↑')}</option>
              <option value="debt-desc">{t('Sold ↓')}</option>
              <option value="debt-asc">{t('Sold ↑')}</option>
              <option value="price-desc">{t('Preț ↓')}</option>
              <option value="price-asc">{t('Preț ↑')}</option>
            </select>

            {/* Contract Type Dropdown */}
            <select
              value={contractTypeFilter}
              onChange={(e) => setContractTypeFilter(e.target.value)}
              className="bg-bg-card border border-black/5 dark:border-white/10 text-text-secondary text-[11px] font-black uppercase tracking-widest rounded-lg px-2 py-1.5 outline-none hover:border-accent-color/30 transition-colors cursor-pointer shrink-0"
            >
              <option value="All">{t('Contracte: Toate')}</option>
              <option value="maintenance">{t('Mentenanță')}</option>
              <option value="one-time">{t('Intervenție / Proiect')}</option>
            </select>

            {/* Status Dropdown */}
            <select
              value={clientsStatusFilter}
              onChange={(e) => setClientsStatusFilter(e.target.value)}
              className="bg-bg-card border border-black/5 dark:border-white/10 text-text-secondary text-[11px] font-black uppercase tracking-widest rounded-lg px-2 py-1.5 outline-none hover:border-accent-color/30 transition-colors cursor-pointer shrink-0"
            >
              <option value="All">{t('Status: Toate')}</option>
              <option value="Activ">{t('Activ')}</option>
              <option value="Inactiv">{t('Inactiv')}</option>
              <option value="Programati">{t('Programati')}</option>
              <option value="Neprogramati">{t('Neprogramati')}</option>
            </select>

            {/* Frequency Dropdown */}
            <select
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value)}
              className="bg-bg-card border border-black/5 dark:border-white/10 text-text-secondary text-[11px] font-black uppercase tracking-widest rounded-lg px-2 py-1.5 outline-none hover:border-accent-color/30 transition-colors cursor-pointer shrink-0"
            >
              <option value="All">{t('Frecvență: Toate')}</option>
              <option value="weekly">{t('Săptămânal')}</option>
              <option value="biweekly">{t('Bilunar')}</option>
              <option value="monthly">{t('Lunar')}</option>
              <option value="occasional">{t('Ocazional')}</option>
            </select>

            {/* Days Without Visit Dropdown */}
            <select
              value={daysWithoutVisitFilter}
              onChange={(e) => setDaysWithoutVisitFilter(e.target.value)}
              className="bg-bg-card border border-black/5 dark:border-white/10 text-text-secondary text-[11px] font-black uppercase tracking-widest rounded-lg px-2 py-1.5 outline-none hover:border-accent-color/30 transition-colors cursor-pointer shrink-0"
            >
              <option value="All">{t('Zile lipsă: Toți')}</option>
              <option value="10">{t('> 10 zile')}</option>
              <option value="20">{t('> 20 zile')}</option>
              <option value="30">{t('> 30 zile')}</option>
            </select>

            {/* Reset Filters */}
            {(showBadPayersOnly || clientSortOrder !== 'manual' || contractTypeFilter !== 'All' || frequencyFilter !== 'All' || daysWithoutVisitFilter !== 'All' || clientsStatusFilter !== 'All' || clientsSearchTerm !== '') && (
              <button
                onClick={() => {
                  setShowBadPayersOnly(false);
                  setClientSortOrder('manual');
                  setContractTypeFilter('All');
                  setFrequencyFilter('All');
                  setDaysWithoutVisitFilter('All');
                  setClientsStatusFilter('All');
                  setClientsSearchTerm('');
                }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center gap-1.5 ml-auto shrink-0 whitespace-nowrap"
                title={t('Resetează toate filtrele')}
              >
                <X size={14} strokeWidth={2.5} />
                {t('Reset')}
              </button>
            )}
          </div>
        )}
          
      <DeleteConfirmationModal
        isOpen={deleteClientModal.isOpen}
        onClose={() => setDeleteClientModal({ isOpen: false, clientId: null })}
        onConfirm={async () => {
          if (deleteClientModal.clientId) {
            await handleDelete(deleteClientModal.clientId);
          }
        }}
        title={t("Delete Client")}
        message={t("Are you sure you want to delete this client? This will also delete all properties, history, visits, and associated files!")}
      />
      <UpsellModal 
        isOpen={upsellModal.isOpen}
        onClose={() => setUpsellModal({ isOpen: false, featureName: '' })}
        featureName={upsellModal.featureName}
      />

      <div id="anchor-clienti" className="scroll-mt-6">
        <div className="space-y-6">
          <VirtuosoGrid
                  useWindowScroll
                  data={activeTab === 'clients' ? filteredClients : (filteredLeads as any[])}
                  listClassName={activeTab === 'clients' && isCompactView ? "grid grid-cols-1 gap-1" : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4"}
                  itemContent={(index, item) => (
                    <div className={`w-full ${activeTab === 'clients' && isCompactView ? '' : 'px-1 py-1'}`}>
                      {activeTab === 'clients' ? (
                        <ClientCard
                          client={item as any}
                          list={filteredClients}
                          compact={isCompactView}
                          index={index}
                          propertiesByClientId={propertiesByClientId}
                          visitsByClientId={visitsByClientId}
                          orgSettings={orgSettings}
                          t={t}
                          onNavigate={onNavigate}
                          handleOpenSchedule={handleOpenSchedule}
                          handleMove={handleMove}
                          setPaymentModal={setPaymentModal}
                          setDeleteClientModal={setDeleteClientModal}
                          profileRole={profile?.role}
                          accountType={profile?.accountType}
                          userRole={userRole}
                          setShowHistoryModal={setShowHistoryModal}
                          isManualSort={clientSortOrder === 'manual'}
                        />
                      ) : (
                        <LeadCard
                          lead={item as any}
                          t={t}
                          onNavigate={onNavigate}
                          setEditLeadModal={setEditLeadModal}
                          setDeleteLeadModal={setDeleteLeadModal}
                          setLostReasonModal={setLostReasonModal}
                        />
                      )}
                    </div>
                  )}
                />
          </div>
      </div>
      <ScheduleModal
        scheduleModal={scheduleModal as any}
        setScheduleModal={setScheduleModal as any}
        properties={properties}
        visitsByClientId={visitsByClientId}
        employees={employees}
        isProcessing={isProcessing}
        handleSchedule={handleSchedule}
      />

      {/* New Lead Modal */}
      <NewLeadModal 
        isOpen={showLeadModal} 
        onClose={() => setShowLeadModal(false)} 
        organizationId={organizationId} 
        workDays={orgSettings?.workDays}
      />
      <EditLeadModal 
        isOpen={editLeadModal.isOpen} 
        lead={editLeadModal.lead} 
        onClose={() => setEditLeadModal({ isOpen: false, lead: null })} 
        workDays={orgSettings?.workDays}
      />
      <DeleteConfirmationModal 
        isOpen={deleteLeadModal.isOpen} 
        onClose={() => setDeleteLeadModal({ isOpen: false, leadId: null })}
        onConfirm={async () => {
          if (deleteLeadModal.leadId) {
            try {
              await deleteDoc(doc(db, 'leads', deleteLeadModal.leadId));
              logger.log(t("Lead deleted successfully"), "success");
              setDeleteLeadModal({ isOpen: false, leadId: null });
            } catch (err: any) {
              console.error("Error deleting lead:", err);
              toast.error(t("Error deleting lead") + ": " + err.message);
            }
          }
        }}
        title={t("Delete Lead")}
        message={t("Are you sure you want to delete this lead? This action cannot be undone.")}
      />

      {showHistoryModal && (
        <ClientHistoryModal 
          clientId={showHistoryModal.clientId}
          clientName={showHistoryModal.clientName}
          visits={visits}
          onClose={() => setShowHistoryModal(null)}
          onViewProfile={(clientId) => onNavigate(Page.Details, clientId)}
          propertyId={showHistoryModal.propertyId}
          propertyName={showHistoryModal.propertyName}
        />
      )}

      <PaymentModal 
        isOpen={paymentModal.isOpen}
        client={paymentModal.client}
        initialAmount={paymentModal.amount}
        properties={properties}
        organizationId={organizationId}
        onClose={() => setPaymentModal({ isOpen: false, client: null, amount: '' })}
        source={t('Quick collect from Clients')}
      />
    </div>
  );
};

export default Clients;