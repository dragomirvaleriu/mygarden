import React, { useState, useEffect, useMemo } from 'react';
import { Clock, MapPin, CheckCircle2, Calendar, User, Building2, Droplets, Ruler, X, XCircle, Star } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface PortalClient { nume: string; }
interface PortalProperty { id: string; name: string; address: string; surfaceArea: number | null; irrigation: boolean; }
interface PortalHistoryItem {
  id: string;
  date: string | null;
  startTime: string | null;
  type: string;
  propertyId: string | null;
  propertyName: string | null;
  visitId: string | null;
  duration: number;
  services?: Array<{ name: string; quantity?: string; unit?: string }>;
  photos?: Array<string | { url: string }>;
}
interface PortalVisit { id: string; propertyId: string | null; propertyAddress: string | null; clientAddress: string | null; }

const ClientPortal: React.FC = () => {
  const { t } = useTranslation();
  const [client, setClient] = useState<PortalClient | null>(null);
  const [properties, setProperties] = useState<PortalProperty[]>([]);
  const [history, setHistory] = useState<PortalHistoryItem[]>([]);
  const [visitsData, setVisitsData] = useState<PortalVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoViewer, setPhotoViewer] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;
  const hash = window.location.hash.replace('#client-portal/', '');

  // Handle ESC key for photo viewer
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhotoViewer(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const resolvedHistory = useMemo(() => {
    if (!history) return [];

    const normalizeAddress = (addr?: string): string => {
      if (!addr) return '';
      return addr.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    return history.map(item => {
      let propertyId = item.propertyId || '';
      let propertyName = item.propertyName || '';

      // Try to find matching visit
      let matchedVisit: PortalVisit | undefined;
      if (item.visitId && visitsData) {
        matchedVisit = visitsData.find(v => v.id === item.visitId);
      }

      // If we found a visit, see if it has property details
      if (matchedVisit) {
        if (matchedVisit.propertyId) {
          propertyId = matchedVisit.propertyId;
        }
        // If we don't have propertyId yet, we can try to resolve it using the address on the visit
        if (!propertyId) {
          const visitAddr = matchedVisit.propertyAddress || matchedVisit.clientAddress || '';
          if (visitAddr) {
            const normVisitAddr = normalizeAddress(visitAddr);
            const foundProp = properties.find(p => 
              normalizeAddress(p.address) === normVisitAddr || 
              normalizeAddress(p.name) === normVisitAddr
            );
            if (foundProp) {
              propertyId = foundProp.id;
              propertyName = foundProp.name;
            }
          }
        }
      }

      // If we still don't have a propertyId, but we have propertyName (which is address or name) in the history item, try to find a matching property
      if (!propertyId && propertyName) {
        const normPropName = normalizeAddress(propertyName);
        const foundProp = properties.find(p => 
          normalizeAddress(p.name) === normPropName || 
          normalizeAddress(p.address) === normPropName
        );
        if (foundProp) {
          propertyId = foundProp.id;
          propertyName = foundProp.name;
        }
      }

      // If we have resolved propertyId now, get its name and address
      const prop = properties.find(p => p.id === propertyId);
      if (prop) {
        propertyName = prop.name;
      }

      return {
        ...item,
        propertyId: propertyId || null,
        propertyName: propertyName || null
      };
    });
  }, [history, properties, visitsData]);

  const totalPages = Math.ceil(resolvedHistory.length / ITEMS_PER_PAGE);

  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return resolvedHistory.slice(start, start + ITEMS_PER_PAGE);
  }, [resolvedHistory, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setTimeout(() => {
      document.getElementById('activity-log-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    if (!hash) {
      setError(t('Invalid or expired link.'));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/client-portal/${encodeURIComponent(hash)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'not_found' : 'load_error');
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setClient(data.client);
        setProperties(data.properties || []);
        setVisitsData(data.visits || []);
        const sortedHistory = [...(data.history || [])].sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA;
        });
        setHistory(sortedHistory);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError(err.message === 'not_found' ? t('Client not found.') : t('Error loading data.'));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hash, t]);

  const formatDuration = (minutes: number) => {
    if (!minutes) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-border-color border-t-accent-color rounded-full animate-spin"></div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">{t('Loading portal...')}</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-bg-card rounded-2xl p-8 shadow-xl text-center border border-border-color">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-black text-main mb-2">{t('Access Denied')}</h1>
          <p className="text-text-secondary mb-8">{error || t('The accessed link is not valid.')}</p>
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-secondary opacity-50">Scapeflow Security Protocol</p>
        </div>
      </div>
    );
  }

  const totalMinutes = history.reduce((sum, h) => sum + (h.duration || 0), 0);
  const totalVisits = history.filter(h => h.type === 'visit_completion').length;

  return (
    <div className="min-h-screen bg-bg-main text-text-secondary font-sans selection:bg-accent-color/20">
      {/* Header Section */}
      <header className="bg-bg-card border-b border-border-color sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-color rounded-full flex items-center justify-center text-white font-black text-xl">
              {client.nume?.charAt(0)}
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none text-main">{client.nume}</h1>
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-secondary mt-1">{t('Secure Client Portal')}</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-secondary">{t('Total Visits')}</p>
              <p className="text-sm font-black text-main">{totalVisits}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-secondary">{t('Total Time')}</p>
              <p className="text-sm font-black text-main">{formatDuration(totalMinutes)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-8">
        {/* Google Reviews Banner */}
        <section className="bg-bg-card rounded-2xl border border-border-color p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
          {/* Subtle Google themed accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#FBBC05] via-[#34A853]" />
          
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 shrink-0">
              <Star size={26} className="fill-current animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-main mb-1">
                {t("We're glad you're happy!")}
              </h3>
              <p className="text-xs text-text-secondary">
                {t("Help us reach other garden lovers by leaving a review on Google.")}
              </p>
            </div>
          </div>
          
          <a
            href="https://g.page/r/CSY9ZW3hlOHTEBM/review"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto px-5 py-3 bg-[#4285F4] hover:bg-[#357AE8] text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-6.887 4.114-4.636 0-8.4-3.764-8.4-8.4s3.764-8.4 8.4-8.4c2.083 0 3.978.77 5.44 2.081l3.073-3.073C18.6 1.341 15.62 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c6.8 0 12.24-5.44 12.24-12.24 0-.82-.096-1.614-.26-2.385H12.24z"/>
            </svg>
            <span>{t('Write a review')}</span>
          </a>
        </section>

        {/* Properties Section */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-secondary mb-1">{t('Locations & Status')}</p>
              <h2 className="text-3xl font-black tracking-tighter text-main">{t('Your Locations')}</h2>
            </div>
            {history[0]?.date && (
              <div className="bg-bg-card px-4 py-2 rounded-2xl border border-border-color shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 bg-accent-color/10 text-accent-color rounded-xl flex items-center justify-center">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-text-secondary leading-none mb-1">{t('Last Visit')}</p>
                  <p className="text-sm font-black text-main leading-none">
                    {format(new Date(history[0].date as string), 'dd/MM/yyyy')}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {properties.map(prop => (
              <div key={prop.id} className="bg-bg-card rounded-xl border border-border-color p-4 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <h3 className="text-base font-black text-main leading-tight mb-1">{prop.name}</h3>
                    <p className="text-xs text-text-secondary font-medium flex items-center gap-1.5">
                      <MapPin size={13} className="text-text-secondary shrink-0" />
                      <span>{prop.address}</span>
                    </p>
                  </div>
                  {prop.surfaceArea && (
                    <div className="text-right shrink-0">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-text-secondary leading-none mb-1">{t('Surface Area')}</p>
                      <p className="text-sm font-black text-main leading-none">{prop.surfaceArea} m²</p>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border-color/60">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                    prop.irrigation 
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' 
                      : 'bg-text-secondary/10 text-text-secondary border border-border-color/50'
                  }`}>
                    <Droplets size={12} />
                    <span>{t('Irrigation')}: {prop.irrigation ? t('Active') : 'N/A'}</span>
                  </span>
                  
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <CheckCircle2 size={12} />
                    <span>Status: {t('Monitored')}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline Section */}
        <section id="activity-log-section" className="scroll-mt-20">
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-secondary mb-1">{t('History')}</p>
            <h2 className="text-3xl font-black tracking-tighter text-main">{t('Activity Log')}</h2>
          </div>
          
          <div className="space-y-4">
            {paginatedHistory.map((item, idx) => (
              <div key={item.id} className="relative pl-10 group">
                {/* Timeline Line */}
                {idx !== paginatedHistory.length - 1 && (
                  <div className="absolute left-[15px] top-8 bottom-[-20px] w-[1.5px] bg-border-color group-hover:bg-accent-color/30 transition-colors"></div>
                )}
                
                {/* Timeline Dot */}
                <div className="absolute left-0 top-0 w-8 h-8 bg-bg-card border-2 border-main rounded-full flex items-center justify-center z-10 group-hover:scale-110 transition-transform">
                  <div className="w-1.5 h-1.5 bg-main rounded-full"></div>
                </div>

                <div className="bg-bg-card p-5 rounded-2xl border border-border-color shadow-sm group-hover:shadow-md transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-text-secondary mb-0.5">
                        {item.date ? format(new Date(item.date), 'dd/MM/yyyy') : ''}
                        {item.startTime && ` • ${new Date(item.startTime).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                      <h4 className="text-base font-black tracking-tight text-main">
                        {item.type === 'visit_completion' ? t('Intervention Completed') : t('Activity Registered')}
                      </h4>
                      {(item.propertyId || item.propertyName) && (
                        <p className="text-xs font-bold text-accent-color mt-0.5 flex items-center gap-1">
                          <MapPin size={12} />
                          {(() => {
                            const prop = properties.find(p => p.id === item.propertyId);
                            if (prop) {
                              return `${prop.name} - ${prop.address}`;
                            }
                            return item.propertyName;
                          })()}
                        </p>
                      )}
                    </div>
                    {!!item.duration && (
                      <div className="bg-accent-color text-white px-3 py-1 rounded-xl flex items-center gap-1.5 w-fit">
                        <Clock size={12} />
                        <span className="text-[11px] font-bold">{t('Duration')}: {formatDuration(item.duration)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {item.services?.map((s, i) => {
                      const unitLower = (s.unit || '').toLowerCase();
                      const isAreaUnit = unitLower === 'm²' || unitLower === 'mp' || unitLower === 'm2';
                      
                      // Resolve property to get specific surface area
                      const prop = properties.find(p => p.id === item.propertyId) || 
                                   (item.propertyName ? properties.find(p => p.name === item.propertyName || p.address === item.propertyName) : null);
                      
                      const displayQuantity = isAreaUnit && prop && prop.surfaceArea 
                        ? prop.surfaceArea 
                        : s.quantity;

                      return (
                        <span key={i} className="bg-bg-main px-2 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider text-text-secondary border border-border-color/50">
                          {t(s.name)} {displayQuantity ? `• ${displayQuantity} ${s.unit || ''}` : ''}
                        </span>
                      );
                    })}
                  </div>

                  {item.photos && item.photos.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border-color">
                      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory custom-scrollbar">
                        {item.photos.map((photo, pIdx) => (
                          <div key={pIdx} className="snap-start shrink-0 w-[140px] h-[140px] rounded-xl overflow-hidden border border-border-color group/photo cursor-pointer" onClick={() => setPhotoViewer(typeof photo === 'string' ? photo : photo.url)}>
                            <img 
                              src={typeof photo === 'string' ? photo : photo.url} 
                              alt={t('Activity')} 
                              className="w-full h-full object-cover group-hover/photo:scale-110 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <div className="text-center py-12 bg-bg-card rounded-2xl border border-dashed border-border-color">
                <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">{t('No activity registered yet.')}</p>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border-color pt-6 mt-8">
              <button
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="px-4 py-2 bg-bg-card border border-border-color hover:bg-lead-accent hover:border-accent-color disabled:opacity-50 disabled:hover:bg-bg-card disabled:hover:border-border-color text-xs font-bold uppercase tracking-widest text-main rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {t('Back')}
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                  const isCurrent = p === currentPage;
                  return (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p)}
                      className={`w-8 h-8 rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-accent-color text-white shadow-md font-black scale-105'
                          : 'bg-bg-card text-text-secondary border border-border-color hover:bg-lead-accent hover:border-accent-color'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className="px-4 py-2 bg-bg-card border border-border-color hover:bg-lead-accent hover:border-accent-color disabled:opacity-50 disabled:hover:bg-bg-card disabled:hover:border-border-color text-xs font-bold uppercase tracking-widest text-main rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {t('Next')}
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-border-color text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-secondary">
          {t('Automatically generated by Scapeflow')} • {new Date().getFullYear()}
        </p>
      </footer>

      {/* Photo Viewer Modal */}
      {photoViewer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setPhotoViewer(null)}>
          <button 
            onClick={() => setPhotoViewer(null)}
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all"
          >
            <X size={24} />
          </button>
          <img 
            src={photoViewer} 
            alt={t('View')} 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default ClientPortal;
