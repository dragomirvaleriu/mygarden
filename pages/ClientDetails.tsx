import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  db, 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  updateDoc, 
  storage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  auth, 
  serverTimestamp,
  addDoc,
  getDoc,
  deleteDoc,
  Timestamp,
  handleFirestoreError,
  OperationType
} from '../services/firebase';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { usePlan } from '../src/hooks/usePlan';
import { Client, Page, Property, ClientHistory, Visit } from '../src/types';
import { logger } from '../services/logger';
import { MapPin, Ruler, Droplets, FileText, Image as ImageIcon, Upload, X, Loader2, Trash2, Map as MapIcon, Sprout } from 'lucide-react';
import { format } from 'date-fns';
import { formatLongDate, parseSafeDate } from '../utils/date';
import { compressImage } from '../utils/image';
import { getMapsUrl } from '../utils/maps';
import { calculateTotalDuration } from '../utils/time';
import { PageSkeleton } from '../components/ui/Skeleton';
import ClientForm from './ClientForm';

interface Props {
  id: string;
  onNavigate: (page: Page, id?: string) => void;
  organizationId: string;
  accountType?: 'PF' | 'PJ';
  userRole?: string;
}

const ClientDetails: React.FC<Props> = ({ id, onNavigate, organizationId, accountType = 'PJ', userRole = 'employee' }) => {
  const { t } = useTranslation();
  const { subscriptionTier } = usePlan();
  const [client, setClient] = useState<Client | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [history, setHistory] = useState<ClientHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'current_year' | 'last_10'>('last_10');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [defaultFertilizerDosage, setDefaultFertilizerDosage] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [hasHiddenByPlanLimit, setHasHiddenByPlanLimit] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historyFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ historyId: string; photoUrl: string } | null>(null);
  const [itemDeleteConfirmation, setItemDeleteConfirmation] = useState<string | null>(null);
  const [docDeleteConfirmation, setDocDeleteConfirmation] = useState<string | null>(null);
  const [zonePhotoDeleteConfirmation, setZonePhotoDeleteConfirmation] = useState<{ propertyId: string; areaId: string; photoUrl: string } | null>(null);
  const [photoViewer, setPhotoViewer] = useState<string | null>(null);
  const [selectedPropertyForFertilizer, setSelectedPropertyForFertilizer] = useState<Property | null>(null);

  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editHistoryData, setEditHistoryData] = useState<{ details: string; date: string }>({ details: '', date: '' });

  useEffect(() => {
    if (properties.length <= 1) {
      setPropertyFilter('all');
    }
  }, [properties]);

  // Handle ESC key for photo viewer
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhotoViewer(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleDeleteHistoryItem = async (historyId: string) => {
    try {
        await deleteDoc(doc(db, 'client_history', historyId));
        logger.log(t('History entry deleted successfully'), "warn");
        setItemDeleteConfirmation(null);
    } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `client_history/${historyId}`);
        logger.log("Eroare la ștergerea intrării: " + err.message, "error");
        alert("Eroare la ștergerea intrării. Vă rugăm să încercați din nou.");
    }
  };

  const startEditHistoryItem = (item: ClientHistory) => {
    setEditingHistoryId(item.id);
    const date = item.date?.toDate ? item.date.toDate() : new Date(item.date as any);
    setEditHistoryData({
        details: item.details || '',
        date: date.toISOString().split('T')[0]
    });
  };

  const saveHistoryEdit = async () => {
    if (!editingHistoryId) return;
    
    try {
        const historyRef = doc(db, 'client_history', editingHistoryId);
        await updateDoc(historyRef, {
            details: editHistoryData.details,
            date: Timestamp.fromDate(new Date(editHistoryData.date))
        });
        logger.log(t('History entry updated successfully'), "success");
        setEditingHistoryId(null);
    } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `client_history/${editingHistoryId}`);
        logger.log("Eroare la actualizarea intrării: " + err.message, "error");
        alert("Eroare la actualizarea intrării. Vă rugăm să încercați din nou.");
    }
  };

  const propsQuery = useMemo(() => id && organizationId ? query(
    collection(db, 'properties'), 
    where('clientId', '==', id),
    where('organizationId', '==', organizationId)
  ) : null, [id, organizationId]);
  const { data: propertiesData } = useFirestoreQuery<Property>(propsQuery, { pageSize: 0 });

  const historyQuery = useMemo(() => id && organizationId ? query(
    collection(db, 'client_history'),
    where('clientId', '==', id),
    where('organizationId', '==', organizationId)
  ) : null, [id, organizationId]);
  const { data: historyData } = useFirestoreQuery<ClientHistory>(historyQuery, { pageSize: 0 });

  useEffect(() => {
    if (propertiesData) {
      const sorted = [...propertiesData].sort((a, b) => (a.order || 0) - (b.order || 0));
      setProperties(sorted);
    }
  }, [propertiesData]);

  useEffect(() => {
    if (historyData) {
      let data = [...historyData];
      
      // Filter out hidden items
      data = data.filter(d => !d.hidden);
      
      // Sort manually to avoid composite index requirement
      data.sort((a, b) => {
        const dateA = a.date?.toDate?.() || new Date(0);
        const dateB = b.date?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      let planFilteredData = [...data];
      // Apply 90-day limit for Free plan
      if (subscriptionTier === 'free') {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        planFilteredData = data.filter(d => {
          const itemDate = d.date?.toDate?.() || new Date(0);
          return itemDate >= ninetyDaysAgo;
        });
        setHasHiddenByPlanLimit(planFilteredData.length < data.length);
      } else {
        setHasHiddenByPlanLimit(false);
      }

      data = planFilteredData;

      if (propertyFilter !== 'all') {
        data = data.filter(d => d.propertyId === propertyFilter);
      }

      if (historyFilter === 'last_10') {
        data = data.slice(0, 10);
      }
      
      if (historyFilter === 'current_year') {
        const currentYear = new Date().getFullYear();
        data = data.filter(d => {
          const date = d.date?.toDate();
          return date && date.getFullYear() === currentYear;
        });
      }
      
      setHistory(data);
      setCurrentPage(1); // Reset to first page on filter change
      setLoading(false);
    }
  }, [historyData, propertyFilter, historyFilter, subscriptionTier]);

  useEffect(() => {
    if (!id) return;
    
    // Fetch Client
    const docRef = doc(db, 'clients', id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setClient({ id: docSnap.id, ...docSnap.data() } as Client);
      } else {
        setClient(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `clients/${id}`);
    });

    // Fetch Organization for settings
    const orgRef = doc(db, 'organizations', organizationId);
    getDoc(orgRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.defaultFertilizerDosage) {
          setDefaultFertilizerDosage(data.defaultFertilizerDosage);
        }
      }
    }).catch(err => {
      handleFirestoreError(err, OperationType.GET, `organizations/${organizationId}`);
    });

    return () => {
      unsubscribe();
    };
  }, [id, organizationId]);

  const handleDeleteDocument = async (docUrl: string) => {
    if (!client || !client.documents) return;

    try {
        const updatedDocs = client.documents.filter(d => d.url !== docUrl);
        await updateDoc(doc(db, 'clients', client.id), {
            documents: updatedDocs
        });
        logger.log(t('Document deleted successfully'), "info");
        setDocDeleteConfirmation(null);
    } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `clients/${client.id}`);
        logger.log("Eroare la ștergerea documentului.", "error");
        alert("Eroare la ștergerea documentului. Vă rugăm să încercați din nou.");
    }
  };

  const handleDeletePhoto = async (historyId: string, photoUrl: string) => {
    if (!client) return;

    try {
        const historyRef = doc(db, 'client_history', historyId);
        const historySnap = await getDoc(historyRef);

        if (historySnap.exists()) {
            const historyData = historySnap.data() as ClientHistory;
            const updatedPhotos = historyData.photos?.filter(p => (typeof p === 'string' ? p : p.url) !== photoUrl) || [];
            
            await updateDoc(historyRef, { photos: updatedPhotos });

            // Also attempt to delete from the linked visit, if it exists
            if (historyData.visitId) {
                const visitRef = doc(db, 'visits', historyData.visitId);
                const visitSnap = await getDoc(visitRef);
                if (visitSnap.exists()) {
                    const visitData = visitSnap.data() as Visit;
                    const updatedVisitPhotos = visitData.photos?.filter(url => url !== photoUrl) || [];
                    await updateDoc(visitRef, { photos: updatedVisitPhotos });
                }
            }

            logger.log(`Photo deleted from history item ${historyId}`, "warn");
        }
    } catch (error: any) {
        handleFirestoreError(error, OperationType.UPDATE, `client_history/${historyId}`);
        logger.log(`Failed to delete photo: ${error}`, "error");
        alert("Eroare la ștergerea fotografiei. Vă rugăm să încercați din nou.");
    }
    setDeleteConfirmation(null);
  };

  const handleDeleteZonePhoto = async (propertyId: string, areaId: string, photoUrl: string) => {
    try {
      const propertyRef = doc(db, 'properties', propertyId);
      const propertySnap = await getDoc(propertyRef);
      
      if (propertySnap.exists()) {
        const propData = propertySnap.data() as Property;
        const updatedAreas = propData.customAreas?.map(area => {
          if (area.id === areaId) {
            return { ...area, photoUrl: undefined }; // Remove photo URL
          }
          return area;
        });
        
        await updateDoc(propertyRef, { customAreas: updatedAreas });
        logger.log(`Poză ștearsă din zona ${areaId}`, "info");
        setZonePhotoDeleteConfirmation(null);
      }
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `properties/${propertyId}`);
      logger.log("Eroare la ștergerea pozei: " + error, "error");
      alert("Eroare la ștergerea pozei. Vă rugăm să încercați din nou.");
    }
  };

  const handleZonePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, propertyId: string, areaId: string) => {
    if (!e.target.files || e.target.files.length === 0 || !client) return;
    const file = e.target.files[0];
    setUploading(true);

    try {
      const compressedBlob = await compressImage(file);
      const path = `uploads/${client.organizationId}/${auth.currentUser?.uid}/properties/${propertyId}/${areaId}_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, compressedBlob);
      const url = await getDownloadURL(storageRef);

      const propertyRef = doc(db, 'properties', propertyId);
      const propertySnap = await getDoc(propertyRef);
      
      if (propertySnap.exists()) {
        const propData = propertySnap.data() as Property;
        const updatedAreas = propData.customAreas?.map(area => {
          if (area.id === areaId) {
            return { ...area, photoUrl: url };
          }
          return area;
        });
        
        await updateDoc(propertyRef, { customAreas: updatedAreas });
        logger.log(`Poză încărcată pentru zona ${areaId}`, "success");
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `properties/${propertyId}`);
      logger.log("Eroare la încărcare: " + err, "error");
      alert("Eroare la încărcarea pozei. Vă rugăm să încercați din nou.");
    } finally {
      setUploading(false);
      // Reset input value if needed, though we render a fresh input for each area usually
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'client_doc' | 'history_photo') => {
    if (!e.target.files || e.target.files.length === 0 || !client) return;
    const file = e.target.files[0];
    setUploading(true);

    try {
      // Compress only if image
      let uploadBlob: Blob = file;
      if (file.type.startsWith('image/')) {
          uploadBlob = await compressImage(file);
      }
      
      // Upload
      const path = `uploads/${client.organizationId}/${auth.currentUser?.uid}/${client.id}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, uploadBlob);
      const url = await getDownloadURL(storageRef);

      if (type === 'client_doc') {
        const newDoc = {
          name: file.name,
          url: url,
          type: file.type.includes('image') ? 'image' : 'document',
          date: new Date().toISOString()
        };
        const currentDocs = client.documents || [];
        await updateDoc(doc(db, 'clients', client.id), {
          documents: [...currentDocs, newDoc]
        });
      } else if (type === 'history_photo' && selectedHistoryId) {
        const historyItem = history.find(h => h.id === selectedHistoryId);
        if (historyItem) {
            const newPhoto = { url, date: new Date().toISOString() };
            const currentPhotos = historyItem.photos || [];
            await updateDoc(doc(db, 'client_history', selectedHistoryId), {
                photos: [...currentPhotos, newPhoto]
            });

            // Sync back to Visit if linked
            if (historyItem.visitId) {
              try {
                const visitRef = doc(db, 'visits', historyItem.visitId);
                const visitSnap = await getDoc(visitRef);
                if (visitSnap.exists()) {
                  const visitData = visitSnap.data() as Visit;
                  const visitPhotos = visitData.photos || [];
                  // Avoid duplicates
                  if (!visitPhotos.includes(url)) {
                    await updateDoc(visitRef, {
                      photos: [...visitPhotos, url]
                    });
                    logger.log("Poză sincronizată cu vizita originală", "info");
                  }
                }
              } catch (e: any) {
                handleFirestoreError(e, OperationType.UPDATE, `visits/${historyItem.visitId}`);
                console.error("Error syncing photo to visit:", e);
              }
            }
        }
      }

    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `clients/${client.id}`);
      logger.log("Eroare la încărcare: " + err, "error");
      alert("Eroare la încărcarea fișierului. Vă rugăm să încercați din nou.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (historyFileInputRef.current) historyFileInputRef.current.value = '';
      setSelectedHistoryId(null);
    }
  };

  const isBadPayer = (c: Client) => {
    if ((c.sold || 0) <= 0) return false;
    
    if (c.contractType === 'one-time' && c.dataScadenta) {
      const dueDate = new Date(c.dataScadenta);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today > dueDate;
    }

    if (!c.ziScadenta) return false;
    const today = new Date().getDate();
    return today > c.ziScadenta;
  };

  const augmentedClient = useMemo(() => {
    if (!client) return null;
    let totalSold = 0;
    let totalTarifLunar = 0;
    let combinedContractType = '';

    properties.forEach(prop => {
      totalSold += prop.sold || 0;
      totalTarifLunar += prop.tarifLunar || 0;
      if (prop.contractType) {
        if (!combinedContractType) {
          combinedContractType = prop.contractType;
        } else if (combinedContractType !== prop.contractType) {
          combinedContractType = 'mixed';
        }
      }
    });

    return {
      ...client,
      sold: totalSold,
      tarifLunar: totalTarifLunar,
      contractType: (combinedContractType || client.contractType) as any,
    };
  }, [client, properties]);

  if (!client || !augmentedClient) return (
    <div className="stihl-card rounded-lg p-8 text-center">
      <h2 className="text-xl font-bold text-text-secondary">Entity not found in database.</h2>
      <button onClick={() => onNavigate(Page.Clients)} className="mt-4 text-accent-color font-bold">Return to portfolio</button>
    </div>
  );

  const formatDuration = (minutes: number) => {
    if (!minutes) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const totalSurface = properties.reduce((sum, p) => sum + (p.surfaceArea || 0), 0);
  const mainAddress = properties.length > 0 ? properties[0].address : client.adresa; // Fallback to client address if no props

  const payments = history.filter(h => h.type === 'payment');
  const activities = history.filter(h => h.type !== 'payment');

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentHistory = activities.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(activities.length / itemsPerPage);

  return (
    <>
      {/* Item Delete Confirmation Modal */}
      {itemDeleteConfirmation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] animate-in fade-in">
          <div className="bg-bg-card rounded-lg p-6 shadow-xl max-w-sm w-full mx-4 border border-border-color">
            <h3 className="font-bold text-lg text-main">Confirmare Ștergere</h3>
            <p className="text-sm text-text-secondary mt-2">Sigur doriți să ștergeți această intrare din istoric? Acțiunea este ireversibilă!</p>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setItemDeleteConfirmation(null)} 
                className="px-4 py-2 rounded-md text-xs font-bold bg-bg-main border border-border-color hover:border-accent-color transition-colors"
              >
                Anulare
              </button>
              <button 
                onClick={() => handleDeleteHistoryItem(itemDeleteConfirmation)} 
                className="px-4 py-2 rounded-md text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Șterge Intrarea
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Delete Confirmation Modal */}
      {docDeleteConfirmation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] animate-in fade-in">
          <div className="bg-bg-card rounded-lg p-6 shadow-xl max-w-sm w-full mx-4 border border-border-color">
            <h3 className="font-bold text-lg text-main">Confirmare Ștergere</h3>
            <p className="text-sm text-text-secondary mt-2">Sigur doriți să ștergeți acest document?</p>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setDocDeleteConfirmation(null)} 
                className="px-4 py-2 rounded-md text-xs font-bold bg-bg-main border border-border-color hover:border-accent-color transition-colors"
              >
                Anulare
              </button>
              <button 
                onClick={() => handleDeleteDocument(docDeleteConfirmation)} 
                className="px-4 py-2 rounded-md text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Șterge Documentul
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zone Photo Delete Confirmation Modal */}
      {zonePhotoDeleteConfirmation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] animate-in fade-in">
          <div className="bg-bg-card rounded-lg p-6 shadow-xl max-w-sm w-full mx-4 border border-border-color">
            <h3 className="font-bold text-lg text-main">Confirmare Ștergere</h3>
            <p className="text-sm text-text-secondary mt-2">Sigur doriți să ștergeți poza acestei zone?</p>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setZonePhotoDeleteConfirmation(null)} 
                className="px-4 py-2 rounded-md text-xs font-bold bg-bg-main border border-border-color hover:border-accent-color transition-colors"
              >
                Anulare
              </button>
              <button 
                onClick={() => handleDeleteZonePhoto(zonePhotoDeleteConfirmation.propertyId, zonePhotoDeleteConfirmation.areaId, zonePhotoDeleteConfirmation.photoUrl)} 
                className="px-4 py-2 rounded-md text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Șterge Poza
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-in fade-in">
          <div className="bg-bg-card rounded-lg p-6 shadow-xl max-w-sm w-full mx-4 border border-border-color">
            <h3 className="font-bold text-lg text-main">Confirmare Ștergere</h3>
            <p className="text-sm text-text-secondary mt-2">Sunteți sigur că doriți să ștergeți această fotografie? Acțiunea este ireversibilă.</p>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setDeleteConfirmation(null)} 
                className="px-4 py-2 rounded-md text-xs font-bold bg-bg-main border border-border-color hover:border-accent-color transition-colors"
              >
                Anulare
              </button>
              <button 
                onClick={() => handleDeletePhoto(deleteConfirmation.historyId, deleteConfirmation.photoUrl)} 
                className="px-4 py-2 rounded-md text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Șterge Fotografia
              </button>
            </div>
          </div>
        </div>
      )}
    <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-500">
      <button 
        onClick={() => onNavigate(Page.Clients)}
        className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-text-secondary hover:text-main transition-colors bg-bg-main px-4 py-2 rounded-md border border-border-color"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {t('Back to Portfolio')}
      </button>

      <div className="flex flex-col md:flex-row items-center gap-10 bg-bg-card rounded-lg p-8 border border-border-color relative overflow-hidden shadow-md">
        <div className="w-32 h-32 rounded-full bg-accent-color flex items-center justify-center text-5xl font-black shadow-lg relative z-10 text-white">
          {client.nume?.charAt(0) || 'C'}
        </div>
        <div className="text-center md:text-left relative z-10 flex-1">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-accent-color">{accountType === 'PF' ? t('Garden File') : t('Client File')}</p>
            {accountType !== 'PF' && isBadPayer(augmentedClient) && (
              <span className="bg-red-500 text-white px-2 py-0.5 rounded-sm text-[11px] font-black uppercase tracking-tighter animate-pulse">{t('Bad Payer')}</span>
            )}
            <span className={`px-2 py-0.5 rounded-sm text-[11px] font-black uppercase tracking-tighter ${augmentedClient.status === 'Activ' ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>
              {t(augmentedClient.status)}
            </span>
          </div>
          <h2 className="text-[11px] font-black text-accent-color uppercase tracking-[0.2em] mb-1">
            {accountType === 'PF' ? t('Garden Details') : t('Client Details')}
          </h2>
          <h1 className="text-4xl font-black text-main uppercase tracking-tighter truncate max-w-lg leading-none mb-3">
            {client.nume}
          </h1>
          
          <div className="flex flex-wrap justify-center md:justify-start gap-3 items-center mb-4">
            {accountType !== 'PF' && (
              <button 
                onClick={async () => {
                  const message = prompt('Enter SMS message:');
                  if (message) {
                    const { sendSms } = await import('../services/sms');
                    await sendSms(client.telefon, message);
                    logger.log('SMS sent!', 'success');
                  }
                }}
                className="text-sm text-green-500 hover:underline"
              >
                Send SMS
              </button>
            )}
            <span className="bg-accent-color/10 text-accent-color px-3 py-1.5 rounded-sm text-xs font-bold border border-accent-color/20 uppercase tracking-wider">
              {properties.length} {accountType === 'PF' ? t('Zones') : t('Properties')}
            </span>
            {accountType !== 'PF' && userRole === 'admin' && augmentedClient.tarifLunar > 0 && (
              <span className="bg-green-500/10 text-green-500 px-3 py-1.5 rounded-sm text-xs font-bold border border-green-500/20 uppercase tracking-wider">
                Total Tarif: {augmentedClient.tarifLunar.toLocaleString()} RON
              </span>
            )}
            {accountType !== 'PF' && userRole === 'admin' && augmentedClient.sold > 0 && (
              <span className="bg-red-500/10 text-red-500 px-3 py-1.5 rounded-sm text-xs font-bold border border-red-500/20 uppercase tracking-wider">
                Total Restanțe (Sold): {augmentedClient.sold.toLocaleString()} RON
              </span>
            )}
            {accountType !== 'PF' && (
              <span className="bg-blue-500/10 text-blue-500 px-3 py-1.5 rounded-sm text-xs font-bold border border-blue-500/20 uppercase tracking-wider">
                {augmentedClient.tip_persoana || 'Client'}
              </span>
            )}
          </div>

          {/* Action Buttons - Bottom Right on Desktop, Stacked on Mobile */}
          {accountType !== 'PF' && (
            <div className="mt-6 md:mt-0 md:absolute md:bottom-0 md:right-0 flex flex-col sm:flex-row items-center gap-2">
              <div className="flex w-full sm:w-auto gap-1">
                <button 
                  onClick={async () => {
                    const link = `${window.location.origin}/#client-portal/${client.id}`;
                    navigator.clipboard.writeText(link);
                    logger.log('Link portal copiat în clipboard!', 'success');
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md text-xs font-bold uppercase tracking-wider hover:bg-blue-600 transition-colors shadow-sm"
                  title="Copiază link portal"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Link Portal
                </button>
                <button 
                  onClick={() => {
                    const link = `${window.location.origin}/#client-portal/${client.id}`;
                    const text = encodeURIComponent(`Bună ziua! Acesta este link-ul către portalul dumneavoastră de client: ${link}`);
                    const cleanPhone = (client.telefon || '').replace(/[^0-9+]/g, '');
                    const waPhone = cleanPhone.startsWith('0') ? '4' + cleanPhone : cleanPhone;
                    window.open(`https://wa.me/${waPhone}?text=${text}`, '_blank');
                  }}
                  className="flex items-center justify-center p-2 bg-[#25D366] text-white rounded-md hover:bg-[#128C7E] transition-colors shadow-sm"
                  title="Trimite pe WhatsApp"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ClientForm id={client.id} onNavigate={onNavigate} organizationId={organizationId} isEmbedded={true} />

      {/* PROPERTIES SECTION */}
      <div className="bg-bg-card border border-border-color rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
              <MapPin size={20} />
            </div>
            <h3 className="text-lg font-black text-main uppercase tracking-tight">{accountType === 'PF' ? t('Garden Zones') : t('Properties')}</h3>
          </div>
          <button 
            onClick={() => onNavigate(Page.ClientForm, id)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
          >
            <Upload size={14} />
            {accountType === 'PF' ? t('Add Zone') : t('Add Property')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map(property => (
            <div key={property.id} className="relative bg-bg-main/50 border border-border-color rounded-xl p-4 hover:border-accent-color transition-all group/prop overflow-hidden">
               {/* Property Card Content */}
               <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-black text-main uppercase truncate pr-8">{property.name}</h4>
                    <p className="text-[11px] text-text-secondary truncate">{property.address}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {property.mapsLink && (
                      <a href={property.mapsLink} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500 hover:text-white transition-all">
                        <MapIcon size={14} />
                      </a>
                    )}
                  </div>
               </div>
               
               <div className="flex flex-wrap gap-2 mb-4">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-bg-card rounded-md border border-border-color">
                    <Ruler size={12} className="text-accent-color" />
                    <span className="text-[11px] font-black text-main">{property.surfaceArea || 0} m²</span>
                  </div>
                  {accountType === 'PF' && (
                    <button 
                      onClick={() => setSelectedPropertyForFertilizer(property)}
                      className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-md border border-emerald-500/20 text-emerald-600 transition-colors"
                      title={t('Calculate Fertilizer')}
                    >
                      <Sprout size={12} />
                      <span className="text-[11px] font-black">{t('Calculator')}</span>
                    </button>
                  )}
                  {property.irrigation && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-bg-card rounded-md border border-border-color">
                      <Droplets size={12} className="text-blue-500" />
                      <span className="text-[11px] font-black text-main">{t('Irrigation: {{type}}', { type: property.irrigation.type })}</span>
                    </div>
                  )}
               </div>

               {property.customAreas && property.customAreas.length > 0 && (
                  <div className="space-y-2 mt-4 pt-4 border-t border-border-color/50">
                    <p className="text-[11px] font-black text-text-secondary uppercase tracking-widest">{t('Garden Zones')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {property.customAreas.map(area => (
                        <div key={area.id} className="group/area relative">
                          <span className="px-2 py-1 bg-accent-color/5 border border-accent-color/10 rounded-md text-[11px] font-bold text-accent-color">
                            {area.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
               )}
            </div>
          ))}
        </div>
      </div>

      {accountType !== 'PF' && userRole === 'admin' && (
          <div className="bg-bg-card border border-border-color rounded-2xl p-6 shadow-xl relative overflow-hidden group mt-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                <FileText size={20} />
              </div>
              <h3 className="text-lg font-black text-main uppercase tracking-tight">{t('Financial')}</h3>
            </div>
            
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-black text-text-secondary uppercase tracking-widest mb-1">{t('Current Balance')}</p>
                <p className={`text-3xl font-black tracking-tighter ${(client.sold || 0) > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {client.sold || 0} <span className="text-sm opacity-30">RON</span>
                </p>
              </div>
              
              <div>
                <p className="text-[11px] font-black text-text-secondary uppercase tracking-widest mb-1">{t('Monthly Rate')}</p>
                <p className="text-2xl font-black text-main tracking-tighter">
                  {client.tarifLunar || 0} <span className="text-sm opacity-30">RON/lună</span>
                </p>
              </div>
            </div>
          </div>
        )}

      {accountType !== 'PF' && userRole === 'admin' && (
      <div className="stihl-card rounded-lg p-8 mt-8">
        <h3 className="text-lg font-bold mb-6 tracking-tight flex items-center gap-3 text-main">
            {t('Payments')}
            <span className="px-2 py-0.5 rounded-sm bg-bg-main text-xs font-bold text-text-secondary uppercase tracking-wider border border-border-color">{payments.length} {t('Entries')}</span>
        </h3>
        {payments.length === 0 ? (
            <p className="text-xs text-text-secondary uppercase font-bold text-center py-8">Nu există încasări înregistrate.</p>
        ) : (
            <div className="space-y-2">
                {payments.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-3 rounded-md bg-bg-main border border-border-color">
                        <span className="text-xs font-bold text-text-secondary uppercase">{p.date?.toDate ? formatLongDate(p.date.toDate()) : '-'}</span>
                        <span className="text-sm font-black text-green-600">{p.amount?.toLocaleString()} RON</span>
                    </div>
                ))}
            </div>
        )}
      </div>
      )}

      {/* HISTORY & PHOTOS */}
      <div className="stihl-card rounded-lg p-8 mt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-bold tracking-tight flex items-center gap-3 text-main">
            {t('Activity History & Photos')}
            <span className="px-2 py-0.5 rounded-sm bg-bg-main text-xs font-bold text-text-secondary uppercase tracking-wider border border-border-color">{activities.length} {t('Entries')}</span>
          </h3>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-text-secondary uppercase">Total Timp: {formatDuration(activities.reduce((sum, item) => sum + (item.duration || 0), 0))}</span>
            <div className="flex gap-2">
            {properties.length > 1 && (
              <select 
                className="bg-bg-main border border-border-color rounded-md px-3 py-1.5 text-xs font-bold outline-none focus:border-accent-color max-w-[150px]"
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
              >
                <option value="all">Toate Locațiile</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
              <select 
                className="bg-bg-main border border-border-color rounded-md px-3 py-1.5 text-xs font-bold outline-none focus:border-accent-color"
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value as any)}
              >
                <option value="last_10">Ultimele 10</option>
                <option value="current_year">Anul curent</option>
                <option value="all">Tot Istoricul</option>
              </select>
            </div>
          </div>
        </div>
        
        {subscriptionTier === 'free' && hasHiddenByPlanLimit && (
          <div className="mb-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ImageIcon className="text-orange-500" size={20} />
              <p className="text-[11px] font-black text-orange-600 uppercase tracking-widest">
                {t('Some older activities and photos are hidden.')} {t('Upgrade to PRO for unlimited history.')}
              </p>
            </div>
            <button 
              onClick={() => onNavigate(Page.Administration)}
              className="px-3 py-1 bg-orange-500 text-white rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-md"
            >
              {t('Upgrade Now')}
            </button>
          </div>
        )}
        
        {/* Hidden Input for History Photos */}
        <input 
            type="file" 
            ref={historyFileInputRef}
            onChange={(e) => handleFileUpload(e, 'history_photo')}
            className="hidden"
            accept="image/*"
        />

        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-xs text-text-secondary uppercase font-bold text-center py-4">Nu există activități înregistrate.</p>
          ) : (
            currentHistory.map((item) => (
              <div key={item.id} className="p-2 rounded-md bg-bg-main border border-border-color hover:border-accent-color transition-all group relative text-[11px]">
                {editingHistoryId === item.id ? (
                    <div className="space-y-1.5 animate-in fade-in">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-accent-color uppercase">Editare Intrare</h4>
                            <button onClick={() => setEditingHistoryId(null)} className="text-text-secondary hover:text-main"><X size={12} /></button>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-0.5">
                              <label className="font-bold text-text-secondary uppercase">Dată</label>
                              <input 
                                  type="date" 
                                  className="w-full bg-bg-card border border-border-color rounded px-1.5 py-0.5 font-bold outline-none focus:border-accent-color"
                                  value={editHistoryData.date}
                                  onChange={e => setEditHistoryData({...editHistoryData, date: e.target.value})}
                              />
                          </div>
                          <div className="flex-[2] space-y-0.5">
                              <label className="font-bold text-text-secondary uppercase">Detalii / Notițe</label>
                              <textarea 
                                  className="w-full bg-bg-card border border-border-color rounded px-1.5 py-0.5 font-bold outline-none focus:border-accent-color min-h-[30px]"
                                  value={editHistoryData.details}
                                  onChange={e => setEditHistoryData({...editHistoryData, details: e.target.value})}
                              />
                          </div>
                        </div>
                        <div className="flex justify-end gap-1.5 pt-0.5">
                            <button onClick={() => setEditingHistoryId(null)} className="px-2 py-0.5 rounded bg-bg-card font-bold text-text-secondary hover:bg-border-color">Anulează</button>
                            <button onClick={saveHistoryEdit} className="px-2 py-0.5 rounded bg-accent-color text-white font-bold hover:bg-accent-color/90">Salvează</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-start mb-0.5">
                          <div className="flex items-center gap-1.5">
                              <p className="font-bold text-accent-color uppercase tracking-wider">
                              {item.type === 'visit_completion' ? t('Mission Completed') : t('Activity')}
                              {item.propertyName && <span className="text-text-secondary ml-1">• {item.propertyName}</span>}
                              </p>
                              <p className="text-text-secondary italic">
                               {item.date?.toDate ? formatLongDate(item.date.toDate()) : (item.date ? formatLongDate(parseSafeDate(item.date)) : '-')}
                               {item.startTime && ` • ${item.startTime.toDate().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`}
                              </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                              <p className="font-bold text-text-secondary uppercase">De: <span className="text-main">{item.performedByName}</span></p>
                              
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                      onClick={() => {
                                          setSelectedHistoryId(item.id);
                                          historyFileInputRef.current?.click();
                                      }}
                                      disabled={uploading}
                                      className="text-text-secondary hover:text-accent-color p-0.5"
                                      title={t('Add Photo')}
                                  >
                                      <Upload size={10} />
                                  </button>
                                  <button 
                                      onClick={() => startEditHistoryItem(item)}
                                      className="text-text-secondary hover:text-accent-color p-0.5"
                                      title="Editează"
                                  >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  </button>
                                  <button 
                                      onClick={() => setItemDeleteConfirmation(item.id)}
                                      className="text-text-secondary hover:text-red-500 p-0.5"
                                      title="Șterge"
                                  >
                                      <Trash2 size={10} />
                                  </button>
                              </div>
                          </div>
                        </div>
                        
                        {(item.details || item.note) && (
                            <p className="text-main mb-0.5 whitespace-pre-wrap bg-bg-card/50 p-1 rounded border border-border-color/30 leading-tight">
                                {item.details || item.note}
                            </p>
                        )}
                        
                        {item.services && item.services.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                          {item.services.map((s: any, idx: number) => (
                              <span key={idx} className="bg-bg-card border border-border-color px-1 py-0.5 rounded font-bold text-main uppercase">
                              {s.name} {s.quantity ? `: ${s.quantity} ${s.unit || ''}` : ''}
                              </span>
                          ))}
                          </div>
                        )}

                        {/* Photos Section for this History Item */}
                        <div className="mt-1 pt-1 border-t border-border-color/50 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                                <div className="flex items-center gap-1">
                                    <p className="font-bold text-text-secondary uppercase tracking-wider">Foto:</p>
                                </div>
                                <div className="flex gap-1 overflow-x-auto custom-scrollbar">
                                    {(item.photos || []).map((photo: any, idx: number) => (
                                        <div key={idx} className="relative group/photo">
                                            <div onClick={() => setPhotoViewer(typeof photo === 'string' ? photo : photo.url)} className="cursor-pointer block w-16 h-16 shrink-0 rounded overflow-hidden border border-border-color hover:border-accent-color transition-all">
                                                <img src={typeof photo === 'string' ? photo : photo.url} className="w-full h-full object-cover" alt="Work proof" referrerPolicy="no-referrer" />
                                            </div>
                                            <button 
                                                onClick={() => setDeleteConfirmation({ historyId: item.id, photoUrl: typeof photo === 'string' ? photo : photo.url })}
                                                className="absolute -top-2 -right-2 bg-red-600/80 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover/photo:opacity-100 transition-opacity focus:opacity-100"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {(item.photos || []).length === 0 && (
                                        <span className="text-text-secondary italic">Nicio poză.</span>
                                    )}
                                </div>
                            </div>
                             {!!item.duration && (
                                 <p className="font-bold text-text-secondary uppercase tracking-widest whitespace-nowrap">
                                     Durată: {formatDuration(item.duration)}
                                 </p>
                             )}
                        </div>
                    </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8 pt-4 border-t border-border-color">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-md bg-bg-main border border-border-color text-xs font-bold text-text-secondary hover:text-main hover:border-accent-color disabled:opacity-50 transition-all"
            >
              Anterior
            </button>
            <span className="text-xs font-bold text-main px-4">
              Pagina {currentPage} din {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-md bg-bg-main border border-border-color text-xs font-bold text-text-secondary hover:text-main hover:border-accent-color disabled:opacity-50 transition-all"
            >
              Următor
            </button>
          </div>
        )}
      </div>
    </div>

    {/* Fertilizer Calculator Modal for PF */}
    {selectedPropertyForFertilizer && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedPropertyForFertilizer(null)}></div>
        <div className="stihl-card w-full max-w-sm bg-bg-card rounded-3xl p-8 relative z-10 shadow-2xl border border-white/10 animate-in zoom-in duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-main uppercase tracking-tighter flex items-center gap-2">
              <Sprout size={24} className="text-emerald-500" />
              {t('Calculator')}
            </h3>
            <button onClick={() => setSelectedPropertyForFertilizer(null)} className="p-2 hover:bg-bg-main rounded-xl transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-bg-main border border-border-color flex justify-between items-center">
               <span className="text-xs font-bold text-text-secondary uppercase">{t('Zone Area')}</span>
               <span className="text-lg font-black text-main">{selectedPropertyForFertilizer.surfaceArea || 0} m²</span>
            </div>
            
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
               <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-2">{t('Recommended Dosage')}</p>
               <p className="text-4xl font-black text-emerald-500 tracking-tighter">
                  {((selectedPropertyForFertilizer.surfaceArea || 0) * (defaultFertilizerDosage || 30) / 1000).toFixed(2)} <span className="text-xl opacity-60">kg</span>
               </p>
               <p className="text-[11px] font-bold text-emerald-600/60 mt-2">
                  *Bazat pe o medie de {defaultFertilizerDosage || 30}g/m²
               </p>
            </div>

            <button 
              onClick={() => setSelectedPropertyForFertilizer(null)}
              className="w-full py-4 rounded-xl bg-emerald-500 text-white font-black uppercase text-xs tracking-widest hover:bg-emerald-600 transition-colors"
            >
              {t('Close')}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Photo Viewer Modal */}
    {photoViewer && (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setPhotoViewer(null)}>
        <button 
          onClick={() => setPhotoViewer(null)}
          className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all"
        >
          <X size={24} />
        </button>
        <img 
          src={photoViewer} 
          alt="Full size" 
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          referrerPolicy="no-referrer"
        />
      </div>
    )}
    </>
  );
};

export default ClientDetails;