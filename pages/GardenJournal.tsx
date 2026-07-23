import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db, collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, storage, ref, uploadBytes, getDownloadURL, auth, updateDoc, doc, getDoc, deleteDoc } from '../services/firebase';
import { ClientHistory, Page } from '../src/types';
import { Camera, Calendar, MapPin, User, ChevronRight, Image as ImageIcon, Filter, Clock, Play, X, ChevronLeft, Pause, Plus, Search, LayoutGrid, LayoutList, Maximize2, Droplets, Scissors, Sprout, Bug, PlusCircle, Check, ScanLine, MoreVertical, Edit2, Trash2, Columns2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { parseSafeDate } from '../utils/date';
import { useData } from '../src/context/DataContext';
import { compressImage } from '../utils/image';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import toast from 'react-hot-toast';

interface Props {
  organizationId: string;
  onNavigate: (page: Page, id?: string) => void;
  userId?: string;
  isPF?: boolean;
}

const GardenJournal: React.FC<Props> = ({ organizationId, onNavigate, userId, isPF = false }) => {
  const { t } = useTranslation();
  const { visits, clients, properties } = useData();

  const historyQuery = useMemo(() => {
    if (!organizationId) return null;
    if (isPF && userId) {
      // PF: use isolated garden_journal collection per userId
      return query(
        collection(db, 'garden_journal'),
        where('organizationId', '==', organizationId),
        where('userId', '==', userId)
      );
    }
    // PJ: use shared client_history
    return query(
      collection(db, 'client_history'),
      where('organizationId', '==', organizationId)
    );
  }, [organizationId, isPF, userId]);

  const { data: history, loading: historyLoading } = useFirestoreQuery<ClientHistory>(historyQuery, { pageSize: 0 });

  // View States
  const [activeTab, setActiveTab] = useState<'timeline' | 'gallery'>('timeline');
  const [filter, setFilter] = useState<'all' | 'with_photos'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('grid');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; date: Date; clientName?: string; propertyId?: string; propertyName?: string; details?: string } | null>(null);
  
  // Add Event Form State
  const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [eventType, setEventType] = useState('treatment');
  const [eventNotes, setEventNotes] = useState('');
  const [eventPropertyId, setEventPropertyId] = useState('general');
  const [eventPhoto, setEventPhoto] = useState<File | null>(null);

  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  const pfClient = clients.length > 0 ? clients[0] : null;

  const nextCalculatedVisit = useMemo(() => {
    if (!pfClient) return null;
    
    const scheduled = visits.filter(v => v.clientId === pfClient.id && v.status === 'Programat')
                            .sort((a,b) => parseSafeDate(a.data).getTime() - parseSafeDate(b.data).getTime());
    if (scheduled.length > 0) {
      return { date: parseSafeDate(scheduled[0].data), isCalculated: false, details: scheduled[0].detalii };
    }

    const completed = [...history].sort((a,b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : parseSafeDate(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : parseSafeDate(b.date);
        return dateB.getTime() - dateA.getTime();
    });

    if (completed.length === 0) return null;

    let baseDate = completed[0].date?.toDate ? completed[0].date.toDate() : parseSafeDate(completed[0].date);
    let daysToAdd = 0;
    if (pfClient.maintenanceFrequency === 'weekly') daysToAdd = 7;
    else if (pfClient.maintenanceFrequency === 'biweekly') daysToAdd = 14;
    else if (pfClient.maintenanceFrequency === 'monthly') daysToAdd = 28;

    if (daysToAdd > 0) {
        baseDate.setDate(baseDate.getDate() + daysToAdd);
        return { date: baseDate, isCalculated: true, details: null };
    }
    return null;
  }, [pfClient, history, visits]);

  // Timeline list filtering
  const filteredHistory = useMemo(() => {
    const sorted = [...history].sort((a,b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : parseSafeDate(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : parseSafeDate(b.date);
        return dateB.getTime() - dateA.getTime();
    });
    return sorted.filter(item => {
      if (filter === 'with_photos' && (!item.photos || item.photos.length === 0)) return false;
      
      if (categoryFilter !== 'all') {
        const cat = item.activityType || item.type;
        if (categoryFilter === 'mowing' && !(cat === 'mowing' || cat?.toLowerCase().includes('tundere'))) return false;
        if (categoryFilter === 'watering' && !(cat === 'watering' || cat?.toLowerCase().includes('udare'))) return false;
        if (categoryFilter === 'treatment' && !(cat === 'treatment' || cat?.toLowerCase().includes('tratament') || cat === 'pest' || cat?.toLowerCase().includes('dăunători'))) return false;
        if (categoryFilter === 'fertilizing' && !(cat === 'fertilizing' || cat?.toLowerCase().includes('îngrășământ'))) return false;
        if (categoryFilter === 'other' && ['mowing','watering','treatment','pest','fertilizing'].includes(cat as string)) return false;
      }
      return true;
    });
  }, [history, filter, categoryFilter]);

  // Extract all photos chronologically for Time-lapse & Gallery
  const extractedPhotos = useMemo(() => {
    const photos: { url: string; date: Date; clientName?: string; propertyId?: string; propertyName?: string; details?: string }[] = [];
    
    const sortedHistory = [...history].sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : parseSafeDate(a.date);
      const dateB = b.date?.toDate ? b.date.toDate() : parseSafeDate(b.date);
      return dateB.getTime() - dateA.getTime(); // Descending for gallery grid
    });

    sortedHistory.forEach(item => {
      if (item.photos && item.photos.length > 0) {
        const itemDate = item.date?.toDate ? item.date.toDate() : parseSafeDate(item.date);
        const client = clients.find(c => c.id === item.clientId);
        const clientName = client ? (client.tip_persoana === 'PJ' ? client.numeFirma : client.nume) : 'Grădinar';
        
        item.photos.forEach(photo => {
          photos.push({
            url: typeof photo === 'string' ? photo : (photo as any).url,
            date: itemDate,
            clientName: clientName,
            propertyId: item.propertyId || item.clientId,
            propertyName: item.propertyName || t('General Activity'),
            details: item.details || item.note
          });
        });
      }
    });
    return photos;
  }, [history, clients, t]);

  // Filter gallery photos based on search and property
  const galleryPhotos = useMemo(() => {
    return extractedPhotos.filter(p => {
      const matchesSearch = !searchTerm || (
        (p.propertyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.details || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchesProperty = selectedPropertyId === 'all' || p.propertyId === selectedPropertyId;
      return matchesSearch && matchesProperty;
    });
  }, [extractedPhotos, searchTerm, selectedPropertyId]);

  // Unique properties list for gallery dropdown filter
  const uniqueProperties = useMemo(() => {
    const props = new Map<string, string>();
    extractedPhotos.forEach(p => {
      if (p.propertyId) {
        props.set(p.propertyId, p.propertyName || t('General Activity'));
      }
    });
    return Array.from(props.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [extractedPhotos, t]);

  // Timelapse list (must be oldest first)
  const timelapsePhotos = useMemo(() => {
    return [...extractedPhotos].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [extractedPhotos]);

  const [showTimelapse, setShowTimelapse] = useState(false);
  const [timelapseIndex, setTimelapseIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const [showCompare, setShowCompare] = useState(false);
  const [compareBeforeIdx, setCompareBeforeIdx] = useState(0);
  const [compareAfterIdx, setCompareAfterIdx] = useState(0);

  // Auto-play effect for timelapse
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showTimelapse && isPlaying && timelapsePhotos.length > 0) {
      interval = setInterval(() => {
        setTimelapseIndex((prev) => (prev + 1) % timelapsePhotos.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [showTimelapse, isPlaying, timelapsePhotos.length]);

  // Lightbox navigation
  const nextPhoto = () => {
    if (!selectedPhoto) return;
    const idx = galleryPhotos.findIndex(p => p.url === selectedPhoto.url);
    if (idx < galleryPhotos.length - 1) setSelectedPhoto(galleryPhotos[idx + 1]);
    else setSelectedPhoto(galleryPhotos[0]);
  };

  const prevPhoto = () => {
    if (!selectedPhoto) return;
    const idx = galleryPhotos.findIndex(p => p.url === selectedPhoto.url);
    if (idx > 0) setSelectedPhoto(galleryPhotos[idx - 1]);
    else setSelectedPhoto(galleryPhotos[galleryPhotos.length - 1]);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedPhoto(null);
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft') prevPhoto();
    };
    if (selectedPhoto) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhoto, galleryPhotos]);

  // Add/Edit event handler
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !eventNotes) return;
    if (!isPF && !eventPropertyId) return;

    setIsSubmitting(true);
    try {
      let photoUrl = '';
      if (eventPhoto) {
        const compressedBlob = await compressImage(eventPhoto);
        const path = `uploads/${organizationId}/${auth.currentUser?.uid}/journal/${Date.now()}_${eventPhoto.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, compressedBlob);
        photoUrl = await getDownloadURL(storageRef);
      }

      const selectedProp = eventPropertyId && eventPropertyId !== 'general' ? properties.find(p => p.id === eventPropertyId) : null;
      const propName = selectedProp?.name || (isPF ? 'Grădina Mea' : 'Grădină');

      let formattedTypeName = 'Activitate Jurnal';
      if (eventType === 'treatment') formattedTypeName = 'Tratament Horticol';
      else if (eventType === 'watering') formattedTypeName = 'Udare Gazon / Plante';
      else if (eventType === 'mowing') formattedTypeName = 'Tundere Gazon';
      else if (eventType === 'planting') formattedTypeName = 'Plantare';
      else if (eventType === 'observation') formattedTypeName = 'Observație';
      else if (eventType === 'pest') formattedTypeName = 'Dăunători';
      else if (eventType === 'blooming') formattedTypeName = 'Înflorit';
      else if (eventType === 'fertilizing') formattedTypeName = 'Fertilizare';
      else if (eventType === 'pruning') formattedTypeName = 'Tăiat / Curățat';

      if (isPF && userId) {
        // Write to isolated PF collection
        await addDoc(collection(db, 'garden_journal'), {
          organizationId,
          userId,
          zoneId: eventPropertyId === 'general' ? null : (eventPropertyId || null),
          zoneName: propName,
          type: eventType,
          date: parseISO(eventDate),
          notes: eventNotes,
          details: eventNotes,
          photos: photoUrl ? [photoUrl] : [],
          services: [{ name: formattedTypeName }],
          propertyName: propName,
          propertyId: eventPropertyId === 'general' ? null : (eventPropertyId || null),
          performedByName: pfClient?.nume || t('Owner'),
          createdAt: new Date(),
        });
      } else {
        if (editingItem) {
          await updateDoc(doc(db, 'client_history', editingItem.id), {
            propertyId: eventPropertyId === 'general' ? '' : eventPropertyId,
            propertyName: propName,
            date: parseISO(eventDate),
            details: eventNotes,
            type: eventType,
            services: [{ name: formattedTypeName }],
            ...(photoUrl ? { photos: editingItem.photos ? [...editingItem.photos, photoUrl] : [photoUrl] } : {})
          });
        } else {
          await addDoc(collection(db, 'client_history'), {
            organizationId,
            clientId: selectedProp?.clientId || pfClient?.id || '',
            propertyId: eventPropertyId === 'general' ? '' : eventPropertyId,
            propertyName: propName,
            type: eventType,
            date: parseISO(eventDate),
            details: eventNotes,
            photos: photoUrl ? [photoUrl] : [],
            performedByName: pfClient?.nume || t('Owner'),
            services: [{ name: formattedTypeName }]
          });
        }
      }

      // Gamification: Add XP (+15 for journal entries)
      if (userId) {
        try {
          const userSnap = await getDoc(doc(db, 'users', userId));
          if (userSnap.exists()) {
            const currentExp = userSnap.data().exp || 0;
            await updateDoc(doc(db, 'users', userId), { exp: currentExp + 15 });
          }
        } catch (e) {
          console.error("Error updating XP", e);
        }
      }

      toast.success(editingItem ? t('Entry updated successfully!') : t('Journal entry saved successfully! +15 XP 🌿'));
      setShowAddModal(false);
      setEditingItem(null);
      setEventNotes('');
      setEventPhoto(null);
      setEventType('treatment');
      setEventDate(format(new Date(), 'yyyy-MM-dd'));
    } catch (err: any) {
      console.error(err);
      toast.error(t('Error saving entry: ') + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (item: any) => {
    setEditingItem(item);
    setEventDate(item.date?.toDate ? format(item.date.toDate(), 'yyyy-MM-dd') : format(parseSafeDate(item.date), 'yyyy-MM-dd'));
    setEventType(item.activityType || item.type || 'observation');
    setEventNotes(item.details || item.note || '');
    setEventPropertyId(item.propertyId || 'general');
    setShowAddModal(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      try {
        const collectionName = isPF && userId ? 'garden_journal' : 'client_history';
        await deleteDoc(doc(db, collectionName, itemToDelete.id));
        toast.success(t('Entry deleted successfully!'));
      } catch (err: any) {
        toast.error(t('Error deleting entry: ') + err.message);
      }
    }
    setItemToDelete(null);
  };

  if (historyLoading) return <div className="p-20 text-center animate-pulse font-black uppercase tracking-widest opacity-30">{t('Loading Journal...')}</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      
      {/* ── PREMIUM TERMINAL HEADER ── */}
      <div className="relative flex flex-col md:flex-row md:items-center justify-between bg-gradient-to-r from-violet-500/10 via-transparent to-transparent p-4 md:p-6 md:min-h-[104px] rounded-3xl border border-violet-500/20 mb-6 shadow-sm gap-4 overflow-hidden">
        
        {/* Dictando Lines Pattern */}
        <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px)', backgroundSize: '100% 28px' }} />

        <div className="relative z-10 flex items-center gap-4 md:gap-5">
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-violet-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/30 transform -rotate-3 hover:rotate-0 transition-transform duration-300 shrink-0">
            <Camera className="w-6 h-6 md:w-7 md:h-7" strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/logo.png" alt="My Garden" className="w-3 h-3 md:w-4 md:h-4 object-contain drop-shadow-sm" />
              <h2 className="text-[9px] md:text-[11px] font-black text-violet-500 uppercase tracking-[0.4em] leading-none">My Garden</h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500 text-white text-[8px] font-black uppercase tracking-tighter shadow-sm">{t('Intelligence Terminal')}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-main tracking-tight leading-tight mb-1">
              {t('Garden Journal')}
            </h1>
            <p className="text-text-secondary text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
              {t('Centralized garden timeline and premium gallery')}
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-row items-center justify-end gap-3 w-auto">
          {/* Main Tabs */}
          <div className="flex bg-bg-card border border-border-color rounded-xl p-1 shadow-sm">
            <button 
              onClick={() => setActiveTab('timeline')}
              className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'timeline' ? 'bg-violet-500 text-white shadow-md' : 'text-text-secondary hover:text-main'}`}
            >
              Timeline Jurnal
            </button>
            <button 
              onClick={() => setActiveTab('gallery')}
              className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'gallery' ? 'bg-violet-500 text-white shadow-md' : 'text-text-secondary hover:text-main'}`}
            >
              Galerie Foto
            </button>
          </div>

          {/* Time-lapse Button */}
          {timelapsePhotos.length > 0 && (
            <button
              onClick={() => {
                setTimelapseIndex(0);
                setIsPlaying(true);
                setShowTimelapse(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-bg-card text-violet-500 border border-border-color hover:border-violet-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              <Play size={14} fill="currentColor" />
              <span className="hidden sm:inline">{t('Play Time-lapse')}</span>
            </button>
          )}

          {/* Before/After Compare Button */}
          {timelapsePhotos.length > 1 && (
            <button
              onClick={() => {
                setCompareBeforeIdx(0);
                setCompareAfterIdx(timelapsePhotos.length - 1);
                setShowCompare(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-bg-card text-violet-500 border border-border-color hover:border-violet-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              <Columns2 size={14} />
              <span className="hidden sm:inline">Compară Progres</span>
            </button>
          )}

          {/* Add Event Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-violet-500/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Adaugă Însemnare</span>
          </button>
        </div>
      </div>

      {/* Tab Context Contents */}
      {activeTab === 'timeline' ? (
        // TIMELINE TAB
        <div className="space-y-6">
          {nextCalculatedVisit && (
            <div className="bg-gradient-to-r from-accent-color/10 to-transparent border-l-4 border-accent-color rounded-r-2xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent-color rounded-xl flex items-center justify-center text-white shadow-lg">
                  <Calendar size={24} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-text-secondary mb-1">
                    {nextCalculatedVisit.isCalculated ? t('Estimated Next Intervention') : t('Scheduled Intervention')}
                  </p>
                  <h3 className="text-xl font-black text-main">
                    {format(nextCalculatedVisit.date, 'dd MMMM yyyy')}
                  </h3>
                  {nextCalculatedVisit.details && (
                    <p className="text-xs text-text-secondary font-medium mt-1">"{nextCalculatedVisit.details}"</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary">Istoric Timeline</h2>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center bg-bg-card border border-border-color rounded-xl p-1 shadow-sm">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-transparent border-none text-[10px] font-black uppercase tracking-wider text-text-secondary focus:text-main outline-none px-2 py-1 cursor-pointer"
                >
                  <option value="all">Toate Categoriile</option>
                  <option value="mowing">✂️ Tunderi</option>
                  <option value="watering">💧 Udări</option>
                  <option value="treatment">🪲 Tratamente/Dăunători</option>
                  <option value="fertilizing">🌱 Fertilizări</option>
                  <option value="other">📝 Altele</option>
                </select>
              </div>

              <div className="flex bg-bg-card border border-border-color rounded-xl p-1 shadow-sm">
                <button 
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${filter === 'all' ? 'bg-accent-color text-white' : 'text-text-secondary hover:text-main'}`}
                >
                  {t('All Activities')}
                </button>
                <button 
                  onClick={() => setFilter('with_photos')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${filter === 'with_photos' ? 'bg-accent-color text-white' : 'text-text-secondary hover:text-main'}`}
                >
                  {t('Photos Only')}
                </button>
              </div>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center opacity-30">
              <Camera size={64} className="mb-6" />
              <p className="text-sm font-black uppercase tracking-[0.3em]">{t('No entries found')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredHistory.map((item) => (
                <div key={item.id} className="flex flex-col group transition-all duration-300">
                  
                  {/* Photo Wrapper */}
                  <div className="relative aspect-square w-full rounded-[1.8rem] overflow-hidden bg-bg-card border border-border-color/60 shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:scale-[1.01]">
                    {item.photos && item.photos.length > 0 ? (
                      <img 
                        src={typeof item.photos[0] === 'string' ? item.photos[0] : (item.photos[0] as any).url} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                        alt="Activity" 
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-950/40 via-slate-900 to-emerald-950/20 flex flex-col items-center justify-center text-emerald-500/30 gap-2 p-6 text-center">
                        <Sprout size={44} className="opacity-40 animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary/50">Jurnal Activitate</span>
                      </div>
                    )}
                    
                    {/* Category Badge Overlay */}
                    <div className="absolute top-3 left-3 flex gap-2 z-10">
                       {(() => {
                          const cat = item.activityType || item.type;
                          if (cat === 'mowing' || cat?.toLowerCase().includes('tundere')) {
                            return <span className="bg-green-600/60 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/10 shadow-sm">Tundere</span>;
                          }
                          if (cat === 'watering' || cat?.toLowerCase().includes('udare')) {
                            return <span className="bg-blue-600/60 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/10 shadow-sm">Udare</span>;
                          }
                          if (cat === 'treatment' || cat?.toLowerCase().includes('tratament') || cat === 'pest' || cat?.toLowerCase().includes('dăunători')) {
                            return <span className="bg-red-600/60 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/10 shadow-sm">Dăunători</span>;
                          }
                          if (cat === 'fertilizing' || cat?.toLowerCase().includes('îngrășământ')) {
                            return <span className="bg-emerald-600/60 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/10 shadow-sm">Fertilizare</span>;
                          }
                          if (cat === 'ai_diagnosis') {
                            return <span className="bg-emerald-600/60 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/10 shadow-sm flex items-center gap-1"><ScanLine size={10} /> Diagnoză AI</span>;
                          }
                          return (
                            <div className="bg-black/50 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-black text-white uppercase tracking-wider border border-white/10 shadow-sm">
                              {item.type === 'visit_completion' ? t('Visit') : (item.type === 'payment' ? t('Payment') : 'Însemnare')}
                            </div>
                          );
                       })()}
                    </div>

                    {/* Photo count overlay */}
                    {item.photos && item.photos.length > 1 && (
                      <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black border border-white/10">
                        +{item.photos.length - 1}
                      </div>
                    )}

                    {/* Actions Menu (Always Visible) */}
                    <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEditClick(item); }}
                        className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-accent-color hover:border-accent-color transition-all shadow-sm"
                        title={t('Edit')}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setItemToDelete(item); }}
                        className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-red-500 hover:border-red-500 transition-all shadow-sm"
                        title={t('Delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Under-Photo Metadata & Description */}
                  <div className="mt-3 px-1">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1">
                      <span>
                        {item.date?.toDate ? format(item.date.toDate(), 'dd MMM yyyy') : (item.date ? format(parseSafeDate(item.date), 'dd MMM yyyy') : '-')}
                      </span>
                      <span className="opacity-30">•</span>
                      <span className="truncate max-w-[120px]">{item.performedByName || 'Grădinar'}</span>
                    </div>

                    <h3 className="text-sm font-black text-main leading-tight mb-1 uppercase tracking-tight group-hover:text-accent-color transition-colors truncate">
                      {item.type === 'ai_diagnosis' ? 'Rezultat Diagnoză AI' : (item.propertyName || t('General Activity'))}
                    </h3>
                    
                    <p className="text-[11px] text-text-secondary leading-snug line-clamp-2">
                      {item.details || item.note || t('No additional details provided.')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // DYNAMIC INTEGRATED GALLERY TAB
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-bg-card border border-border-color rounded-2xl p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input 
                  type="text" 
                  placeholder="Caută în descrierile pozelor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-bg-main border border-border-color rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-main focus:border-accent-color transition-all outline-none"
                />
              </div>

              <select 
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="bg-bg-main border border-border-color rounded-xl px-4 py-2 text-xs font-bold text-main focus:border-accent-color outline-none min-w-[150px]"
              >
                <option value="all">Toate Zonele</option>
                {uniqueProperties.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>

            <div className="flex bg-bg-main border border-border-color rounded-xl p-1">
              <button 
                onClick={() => setViewMode('masonry')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'masonry' ? 'bg-accent-color text-white shadow-sm' : 'text-text-secondary hover:text-main'}`}
                title={t('Masonry View')}
              >
                <LayoutList size={16} />
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-accent-color text-white shadow-sm' : 'text-text-secondary hover:text-main'}`}
                title={t('Square Grid')}
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>

          {galleryPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center opacity-30">
              <ImageIcon size={64} className="mb-6" />
              <p className="text-sm font-black uppercase tracking-[0.3em]">{t('No visual memories yet')}</p>
            </div>
          ) : (
            <div className={
              viewMode === 'grid' 
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" 
                : "columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 space-y-4"
            }>
              {galleryPhotos.map((photo, i) => (
                <div 
                  key={i} 
                  onClick={() => setSelectedPhoto(photo)}
                  className={`
                    group relative overflow-hidden rounded-[1.5rem] bg-bg-card border border-border-color/20 cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 hover:border-accent-color/30
                    ${viewMode === 'grid' ? 'aspect-square' : 'break-inside-avoid'}
                  `}
                >
                  <img 
                    src={photo.url} 
                    alt="Garden" 
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                  />
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                    <p className="text-[10px] font-black text-white/90 uppercase tracking-widest mb-1">
                      {format(photo.date, 'dd MMM yyyy', { locale: ro })}
                    </p>
                    <p className="text-[11px] text-white/70 font-bold uppercase truncate">
                      {photo.propertyName || t('General Activity')}
                    </p>
                    <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md p-2 rounded-full border border-white/20 transform scale-50 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-500">
                      <Maximize2 size={12} className="text-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-hidden">
          <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Calendar size={14} className="text-accent-color" />
                <span className="text-xs font-black text-white uppercase tracking-widest">
                  {format(selectedPhoto.date, 'EEEE, dd MMMM yyyy', { locale: ro })}
                </span>
              </div>
              <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest">
                {selectedPhoto.propertyName || t('General Activity')}
              </p>
            </div>
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-red-500 hover:rotate-90 transition-all duration-500 border border-white/10"
            >
              <X size={24} />
            </button>
          </div>

          <div className="relative w-full h-full flex items-center justify-center p-4 md:p-20">
            <img 
              src={selectedPhoto.url} 
              alt="Garden Full" 
              className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-500"
            />

            <button 
              onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
              className="absolute left-6 md:left-10 w-14 h-14 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-accent-color transition-all border border-white/10 group"
            >
              <ChevronLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
              className="absolute right-6 md:right-10 w-14 h-14 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-accent-color transition-all border border-white/10 group"
            >
              <ChevronRight size={32} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {selectedPhoto.details && (
            <div className="absolute bottom-10 max-w-2xl w-[90%] bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center animate-in slide-in-from-bottom-10 duration-700">
              <p className="text-sm font-medium text-white/90 leading-relaxed italic">
                "{selectedPhoto.details}"
              </p>
            </div>
          )}
        </div>
      )}

      {/* Time-lapse Modal */}
      {showTimelapse && timelapsePhotos.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
          <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
            <div className="flex items-center gap-4">
               <h2 className="text-white text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                 <Camera className="text-accent-color" />
                 Garden Time-lapse
               </h2>
               <div className="px-3 py-1 bg-white/10 rounded-full text-white text-[11px] font-black uppercase tracking-widest">
                 {timelapseIndex + 1} / {timelapsePhotos.length}
               </div>
            </div>
            <button 
              onClick={() => setShowTimelapse(false)}
              className="p-3 bg-white/10 text-white rounded-full hover:bg-white/20 hover:rotate-90 transition-all"
            >
              <X size={24} />
            </button>
          </div>

          <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-12">
            <img 
              key={timelapseIndex} 
              src={timelapsePhotos[timelapseIndex].url} 
              alt="Garden Progress" 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-95 fade-in duration-500"
            />
            
            <div className="absolute bottom-12 inset-x-4 sm:inset-x-12 flex justify-center z-10">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 w-full max-w-2xl text-center transform translate-y-4 animate-in slide-in-from-bottom-8 fade-in duration-700">
                <div className="inline-block px-4 py-1.5 bg-accent-color text-white rounded-full text-xs font-black uppercase tracking-widest mb-3 shadow-lg shadow-accent-color/20">
                  {format(timelapsePhotos[timelapseIndex].date, 'dd MMMM yyyy')}
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-2">
                  {timelapsePhotos[timelapseIndex].propertyName}
                </h3>
                {timelapsePhotos[timelapseIndex].details && (
                  <p className="text-sm text-gray-300 font-medium">
                    {timelapsePhotos[timelapseIndex].details}
                  </p>
                )}
              </div>
            </div>

            <button 
              onClick={() => {
                setIsPlaying(false);
                setTimelapseIndex(prev => (prev === 0 ? timelapsePhotos.length - 1 : prev - 1));
              }}
              className="absolute left-4 sm:left-12 p-4 bg-black/50 text-white rounded-full hover:bg-accent-color transition-all z-20 group"
            >
              <ChevronLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
            </button>

            <button 
              onClick={() => {
                setIsPlaying(false);
                setTimelapseIndex(prev => (prev + 1) % timelapsePhotos.length);
              }}
              className="absolute right-4 sm:right-12 p-4 bg-black/50 text-white rounded-full hover:bg-accent-color transition-all z-20 group"
            >
              <ChevronRight size={32} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="absolute bottom-0 inset-x-0 p-6 flex justify-center bg-gradient-to-t from-black/80 to-transparent z-10">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-3 px-8 py-4 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 transition-all font-black uppercase tracking-widest text-[11px]"
            >
              {isPlaying ? (
                <><Pause size={16} fill="currentColor" /> {t('Pause')}</>
              ) : (
                <><Play size={16} fill="currentColor" /> {t('Play')}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Before/After Compare Modal */}
      {showCompare && timelapsePhotos.length > 1 && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500 p-4 sm:p-8">
          <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
            <h2 className="text-white text-xl font-black uppercase tracking-tighter flex items-center gap-2">
              <Columns2 className="text-accent-color" />
              Compară Progresul
            </h2>
            <button
              onClick={() => setShowCompare(false)}
              className="p-3 bg-white/10 text-white rounded-full hover:bg-white/20 hover:rotate-90 transition-all"
            >
              <X size={24} />
            </button>
          </div>

          <div className="w-full max-w-2xl mt-16">
            <BeforeAfterSlider
              beforeUrl={timelapsePhotos[compareBeforeIdx].url}
              afterUrl={timelapsePhotos[compareAfterIdx].url}
              beforeLabel={format(timelapsePhotos[compareBeforeIdx].date, 'dd MMM yyyy')}
              afterLabel={format(timelapsePhotos[compareAfterIdx].date, 'dd MMM yyyy')}
            />

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <label className="block text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">Înainte</label>
                <select
                  value={compareBeforeIdx}
                  onChange={(e) => setCompareBeforeIdx(Number(e.target.value))}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-accent-color [&>option]:text-black"
                >
                  {timelapsePhotos.map((p, idx) => (
                    <option key={idx} value={idx}>{format(p.date, 'dd MMM yyyy')} · {p.propertyName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">Acum</label>
                <select
                  value={compareAfterIdx}
                  onChange={(e) => setCompareAfterIdx(Number(e.target.value))}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-accent-color [&>option]:text-black"
                >
                  {timelapsePhotos.map((p, idx) => (
                    <option key={idx} value={idx}>{format(p.date, 'dd MMM yyyy')} · {p.propertyName}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-center text-white/40 text-xs font-medium mt-4">Trage linia pentru a compara cele două fotografii.</p>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={() => setShowAddModal(false)}></div>
          <div className="stihl-card w-full max-w-md bg-bg-card rounded-[2.5rem] p-8 relative animate-in zoom-in slide-in-from-bottom-8 duration-500 shadow-[0_32px_64px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent-color/10 rounded-bl-full -z-10 blur-3xl"></div>
            
            <div className="flex items-center justify-between mb-6">
              <div>
                 <h2 className="text-2xl font-black text-main uppercase tracking-tighter">{editingItem ? 'Editează Însemnare' : 'Înregistrează Activitate'}</h2>
                 <p className="text-[10px] font-black text-accent-color uppercase tracking-[0.3em]">Jurnalul Grădinii</p>
              </div>
              <button onClick={() => { setShowAddModal(false); setEditingItem(null); }} className="w-8 h-8 flex items-center justify-center bg-bg-main rounded-xl hover:bg-red-500 hover:text-white transition-all">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleAddEvent} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider ml-1">{t('Date')}</label>
                  <input 
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-xs font-bold text-main outline-none focus:border-accent-color transition-all"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider ml-1">Tip Activitate</label>
                  <select 
                    value={eventType}
                    onChange={e => setEventType(e.target.value)}
                    className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-xs font-bold text-main outline-none focus:border-accent-color transition-all"
                    required
                  >
                    <option value="treatment">🪲 Tratament Horticol</option>
                    <option value="watering">💧 Udare</option>
                    <option value="mowing">✂️ Tundere Gazon</option>
                    <option value="fertilizing">🌱 Fertilizare</option>
                    <option value="pruning">🌿 Tăiat / Curățat</option>
                    <option value="planting">🌸 Plantare / Semănat</option>
                    <option value="observation">👁️ Observație</option>
                    <option value="pest">🐛 Dăunători</option>
                    <option value="blooming">🌺 A Înflorit</option>
                    <option value="other">📝 Alte activități</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider ml-1">Zona Grădinii</label>
                <select 
                  value={eventPropertyId}
                  onChange={e => setEventPropertyId(e.target.value)}
                  className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-xs font-bold text-main outline-none focus:border-accent-color transition-all cursor-pointer"
                  required
                >
                  <option value="general">General (Întreaga curte)</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider ml-1">Detalii și Observații</label>
                <textarea 
                  value={eventNotes}
                  onChange={e => setEventNotes(e.target.value)}
                  className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-2.5 text-xs font-bold text-main outline-none focus:border-accent-color transition-all min-h-[80px]"
                  placeholder="Descrie pe scurt activitatea (ex: Am aplicat 200g Champ 77 WG pe peluză...)"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-wider ml-1">Atașează Poză (Opțional)</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer hover:bg-bg-main border-border-color hover:border-accent-color transition-all">
                    <div className="flex flex-col items-center justify-center pt-2 pb-2">
                      <Camera className="w-6 h-6 mb-1 text-text-secondary" />
                      <p className="text-[11px] text-text-secondary font-bold">
                        {eventPhoto ? eventPhoto.name : t('Apasă pentru a alege o poză')}
                      </p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={e => setEventPhoto(e.target.files ? e.target.files[0] : null)}
                    />
                  </label>
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-accent-color text-white py-3 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2 shadow-2xl shadow-accent-color/30 hover:bg-accent-color/90 active:scale-95 transition-all mt-4"
              >
                {isSubmitting ? 'Se salvează...' : (editingItem ? 'Salvează Modificările' : 'Adaugă în Jurnal')}
                <Check size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={() => setItemToDelete(null)}></div>
          <div className="stihl-card w-full max-w-sm bg-bg-card rounded-[2rem] p-6 relative animate-in zoom-in-95 duration-300 shadow-[0_32px_64px_rgba(0,0,0,0.5)] border border-border-color text-center overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-bl-full -z-10 blur-3xl"></div>
            
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto mb-4 border border-red-500/20">
              <Trash2 size={28} />
            </div>
            
            <h3 className="text-xl font-black text-main uppercase tracking-tight mb-2">Ștergere Însemnare</h3>
            <p className="text-sm font-medium text-text-secondary mb-8">
              Ești sigur că vrei să ștergi definitiv această însemnare din jurnal? Această acțiune nu poate fi anulată.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setItemToDelete(null)}
                className="flex-1 px-4 py-3 bg-bg-main border border-border-color rounded-xl text-xs font-black uppercase tracking-widest text-text-secondary hover:text-main hover:border-accent-color/50 transition-all"
              >
                Anulează
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 active:scale-95 transition-all"
              >
                Șterge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GardenJournal;
