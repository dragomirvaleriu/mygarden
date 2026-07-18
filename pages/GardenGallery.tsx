import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { db, collection, query, where, onSnapshot } from '../services/firebase';
import { ClientHistory, Page, Visit } from '../src/types';
import { Camera, Calendar, Image as ImageIcon, X, ChevronLeft, ChevronRight, Maximize2, LayoutGrid, LayoutList, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ro, enUS } from 'date-fns/locale';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { parseSafeDate } from '../utils/date';
import { useData } from '../src/context/DataContext';
import { getUserSettings, updateUserSettings } from '../services/settings';
import { useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce';

interface Props {
  organizationId: string;
  onNavigate: (page: Page, id?: string) => void;
  accountType?: 'PF' | 'PJ';
  userId?: string;
}

const GardenGallery: React.FC<Props> = ({ organizationId, onNavigate, accountType = 'PJ', userId }) => {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language === 'ro' ? ro : enUS;
  const { visits, clients, properties } = useData();
  const isPF = accountType === 'PF';
  
  const historyQuery = useMemo(() => {
    if (!organizationId) return null;
    return query(
      collection(db, 'client_history'),
      where('organizationId', '==', organizationId)
    );
  }, [organizationId]);

  const { data: history, loading: historyLoading } = useFirestoreQuery<ClientHistory>(historyQuery, { pageSize: 0 });

  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; date: Date; clientName?: string; propertyId?: string; propertyName?: string; details?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('grid');
  const [visiblePhotosCount, setVisiblePhotosCount] = useState(20);
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    if (!hasScrolled && !historyLoading) {
      const timer = setTimeout(() => {
        const el = document.getElementById('anchor-galerie');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          setHasScrolled(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasScrolled, historyLoading]);

  useEffect(() => {
    if (userId) {
      getUserSettings(userId).then(settings => {
        if (settings?.galleryViewMode) setViewMode(settings.galleryViewMode);
      });
    }
  }, [userId]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setVisiblePhotosCount(20);
  }, [debouncedSearchTerm, selectedPropertyId]);

  // Facebook feed-like infinite scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 150) {
        setVisiblePhotosCount(prev => prev + 20);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);



  const handleViewModeChange = (mode: 'grid' | 'masonry') => {
    setViewMode(mode);
    if (userId) updateUserSettings(userId, { galleryViewMode: mode });
  };

  // 1. Extract all photos from history
  const extractedPhotos = useMemo(() => {
    const photos: { url: string; date: Date; clientName?: string; propertyId?: string; propertyName?: string; details?: string }[] = [];
    
    // Sort history by date descending
    const sortedHistory = [...history].sort((a, b) => {
      const dateA = a.date?.toDate ? a.date.toDate() : parseSafeDate(a.date);
      const dateB = b.date?.toDate ? b.date.toDate() : parseSafeDate(b.date);
      return dateB.getTime() - dateA.getTime();
    });

    sortedHistory.forEach(item => {
      if (item.photos && item.photos.length > 0) {
        const itemDate = item.date?.toDate ? item.date.toDate() : parseSafeDate(item.date);
        const client = clients.find(c => c.id === item.clientId);
        const clientName = client ? (client.tip_persoana === 'PJ' ? client.numeFirma : client.nume) : 'Client';
        
        // Resolve property information elegantly
        let finalPropertyId = item.propertyId;
        let finalPropertyName = item.propertyName;
        
        const clientProps = properties.filter(p => p.clientId === item.clientId);
        
        if (finalPropertyId) {
          const prop = properties.find(p => p.id === finalPropertyId);
          if (prop) {
            finalPropertyName = prop.name;
          }
        } else if (clientProps.length > 0) {
          // Merge "General Activity" into the client's actual main property
          finalPropertyId = clientProps[0].id;
          finalPropertyName = clientProps[0].name;
        } else {
          finalPropertyId = item.clientId;
          finalPropertyName = t('General Activity');
        }
        
        item.photos.forEach(photo => {
          photos.push({
            url: typeof photo === 'string' ? photo : (photo as any).url,
            date: itemDate,
            clientName: clientName,
            propertyId: finalPropertyId,
            propertyName: finalPropertyName,
            details: item.details || item.note
          });
        });
      }
    });
    
    return photos;
  }, [history, clients, properties, t]);

  // 2. Filter and sort ALL matching photos
  const filteredPhotos = useMemo(() => {
    return extractedPhotos.filter(p => {
        const matchesSearch = !debouncedSearchTerm || (
            (p.clientName || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
            (p.propertyName || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
            (p.details || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        );
        const matchesProperty = selectedPropertyId === 'all' || p.propertyId === selectedPropertyId;
        return matchesSearch && matchesProperty;
    }).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [extractedPhotos, debouncedSearchTerm, selectedPropertyId]);

  // 3. Slice photos for current viewport window size
  const allPhotos = useMemo(() => {
    return filteredPhotos.slice(0, visiblePhotosCount);
  }, [filteredPhotos, visiblePhotosCount]);

  // 4. Extract unique properties for filtering (from ALL extracted photos)
  const uniqueProperties = useMemo(() => {
    const props = new Map<string, string>();
    extractedPhotos.forEach(p => {
      if (p.propertyId) {
        props.set(p.propertyId, `${p.clientName} - ${p.propertyName || t('General Activity')}`);
      }
    });
    return Array.from(props.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [extractedPhotos]);

  const nextPhoto = () => {
    if (!selectedPhoto) return;
    const idx = filteredPhotos.findIndex(p => p.url === selectedPhoto.url);
    if (idx < filteredPhotos.length - 1) setSelectedPhoto(filteredPhotos[idx + 1]);
    else setSelectedPhoto(filteredPhotos[0]);
  };

  const prevPhoto = () => {
    if (!selectedPhoto) return;
    const idx = filteredPhotos.findIndex(p => p.url === selectedPhoto.url);
    if (idx > 0) setSelectedPhoto(filteredPhotos[idx - 1]);
    else setSelectedPhoto(filteredPhotos[filteredPhotos.length - 1]);
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
  }, [selectedPhoto, filteredPhotos]);

  if (historyLoading) return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-20">
        <div className="flex flex-col items-center gap-4 animate-pulse">
            <div className="w-12 h-12 border-4 border-accent-color border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-accent-color">{t('Loading Gallery')}...</p>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-main p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
      {/* ── PREMIUM TERMINAL HEADER ── */}
      <div className="flex flex-row justify-between items-center gap-4 bg-gradient-to-r from-accent-color/10 via-transparent to-transparent p-3 md:p-5 md:min-h-[104px] rounded-2xl border border-accent-color/10 mb-4 md:mb-6 animate-in slide-in-from-top-4 duration-700">
        
        <div className="flex items-center gap-3 md:gap-5 w-full">
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-accent-color flex items-center justify-center text-white shadow-xl shadow-accent-color/30 transform -rotate-3 hover:rotate-0 transition-transform duration-500 shrink-0">
            <Camera className="w-5 h-5 md:w-7 md:h-7" strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/logo.png" alt="Scapeflow" className="w-3 h-3 md:w-4 md:h-4 object-contain drop-shadow-sm" />
              <h2 className="text-[9px] md:text-[11px] font-black text-accent-color uppercase tracking-[0.4em] leading-none">Scapeflow</h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-color text-white text-[8px] font-black uppercase tracking-tighter shadow-sm">
                {t('Intelligence Terminal')}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-0.5 md:mb-1">
                <h1 className="text-lg md:text-3xl font-black text-main uppercase tracking-tighter leading-none">
                  {isPF ? t('My Garden Gallery') : t('Garden Gallery')}
                </h1>
            </div>
            <p className="text-[9px] md:text-xs text-text-secondary font-bold uppercase tracking-[0.2em] opacity-60 hidden sm:block">
              {filteredPhotos.length} {t('Photos captured in your projects')}
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-3 w-full md:w-auto">
          {!isPF && (
            <>
              <div className="relative w-full lg:w-64">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                  <input 
                      type="text" 
                      placeholder={t('Search by client or location')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-bg-card border border-border-color rounded-xl pr-4 py-2.5 text-sm font-bold text-main focus:border-accent-color transition-all outline-none"
                      style={{ paddingLeft: '56px' }}
                  />
              </div>
              
              <select 
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="bg-bg-card border border-border-color rounded-xl px-4 py-2.5 text-sm font-bold text-main focus:border-accent-color outline-none min-w-[200px]"
              >
                <option value="all">{t('All Locations')}</option>
                {uniqueProperties.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </>
          )}
          
          {/* View mode toggle removed to force left-to-right grid layout */}
        </div>
      </div>

      {/* Gallery Content */}
      {allPhotos.length === 0 ? (
        <div id="anchor-galerie" className="flex flex-col items-center justify-center py-40 text-center opacity-30 grayscale scroll-mt-6">
          <ImageIcon size={80} strokeWidth={1} className="mb-6" />
          <p className="text-sm font-black uppercase tracking-[0.4em]">{t('No visual memories yet')}</p>
        </div>
      ) : (
        <div id="anchor-galerie" className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 scroll-mt-6">
          {allPhotos.map((photo, i) => (
            <div 
              key={i} 
              onClick={() => setSelectedPhoto(photo)}
              className="group relative overflow-hidden rounded-[1.5rem] bg-bg-card border border-border-color/20 cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 hover:border-accent-color/30 aspect-square"
            >
              <img 
                src={photo.url} 
                alt="Garden" 
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
              />
              
              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                <p className="text-[11px] font-black text-white/90 uppercase tracking-widest mb-1">
                    {format(photo.date, 'dd MMM yyyy', { locale: currentLocale })}
                </p>
                {!isPF && (
                    <p className="text-[11px] font-black text-white uppercase truncate tracking-tight mb-0.5">
                        {photo.clientName}
                    </p>
                )}
                <p className="text-[11px] text-white/70 font-bold uppercase truncate">
                    {photo.propertyName || t('General Activity')}
                </p>
                <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md p-2 rounded-full border border-white/20 transform scale-50 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-500">
                    <Maximize2 size={14} className="text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox / Preview Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-hidden">
            {/* Top Bar */}
            <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <Calendar size={14} className="text-accent-color" />
                        <span className="text-xs font-black text-white uppercase tracking-widest">
                            {format(selectedPhoto.date, 'EEEE, dd MMMM yyyy', { locale: currentLocale })}
                        </span>
                    </div>
                    {!isPF && (
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                            {selectedPhoto.clientName}
                        </h2>
                    )}
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

            {/* Main Image */}
            <div className="relative w-full h-full flex items-center justify-center p-4 md:p-20">
                <img 
                    src={selectedPhoto.url} 
                    alt="Garden Full" 
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-500"
                />

                {/* Nav Controls */}
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

            {/* Bottom Info Overlay */}
            {selectedPhoto.details && (
                <div className="absolute bottom-10 max-w-2xl w-[90%] bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center animate-in slide-in-from-bottom-10 duration-700">
                    <p className="text-sm font-medium text-white/90 leading-relaxed italic">
                        "{selectedPhoto.details}"
                    </p>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default GardenGallery;
