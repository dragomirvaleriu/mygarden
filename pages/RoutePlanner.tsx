import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { MapPin, Navigation, CheckCircle2, Clock, AlertCircle, Info, Map as MapIcon, User, Droplets, History, Eye, EyeOff, Loader2 } from 'lucide-react';
import { isIrrigatingToday } from '../utils/irrigation';
import { db, collection, query, where, getDocs, auth, doc, updateDoc } from '../services/firebase';
import { Visit, Property, Client } from '../src/types';
import { resolveAndParseMapsLink, extractVisitCoordinates, getGoogleMapsDirDestination, parseCoordsFromUrl } from '../utils/maps';
import { calculateDaysSinceLastVisit, calculateDaysSinceVisitCompleted } from '../utils/date';
import { useData } from '../src/context/DataContext';
import { optimizeRouteNearestNeighbor } from '../utils/routeUtils';
import { writeBatch } from 'firebase/firestore';

// Fix for default icon issue with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface Props {
  organizationId: string;
  userRole: string;
  userId: string;
  onClientClick?: (clientId: string, clientName: string, propertyId?: string, propertyName?: string) => void;
  onNavigate?: (page: any, id?: string) => void;
}

const MapController = ({ waypoints }: { waypoints: L.LatLng[] }) => {
  const map = useMap();
  const hasFitted = useRef(false);
  const hasInvalidated = useRef(false);

  useEffect(() => {
    if (waypoints.length > 0 && !hasFitted.current) {
      try {
        const bounds = L.latLngBounds(waypoints);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        hasFitted.current = true;
      } catch (e) {
        console.error("Error fitting bounds:", e);
      }
    }
    
    // Force a resize check only once to fix "grey map" issue
    if (!hasInvalidated.current) {
      const timer = setTimeout(() => {
        map.invalidateSize();
        hasInvalidated.current = true;
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [map, waypoints.length]);

  return null;
};

const RoutePlanner: React.FC<Props> = ({ organizationId, userRole, userId, onClientClick, onNavigate }) => {
  const { t } = useTranslation();
  const { clients: contextClients, properties: contextProperties, visits: contextVisits, organization } = useData();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [resolvedCoords, setResolvedCoords] = useState<Record<string, L.LatLng>>({});
  const [lastVisits, setLastVisits] = useState<Record<string, Visit[]>>({});

  const [map, setMap] = useState<L.Map | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const routingControlRef = useRef<any>(null);
  const [orgAddress, setOrgAddress] = useState<string | null>(null);
  const [hqLocation, setHqLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userFullName, setUserFullName] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDoc = await import('../services/firebase').then(m => m.getDoc(m.doc(m.db, 'users', user.uid)));
          if (userDoc.exists()) {
            setUserFullName(userDoc.data().displayName || null);
          }
        } catch (e) {
          console.error("Error fetching user profile:", e);
        }
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (organizationId) {
        const fetchOrg = async () => {
            try {
                const orgDoc = await import('../services/firebase').then(m => m.getDoc(m.doc(m.db, 'organizations', organizationId)));
                if (orgDoc.exists()) {
                    const data = orgDoc.data();
                    setOrgAddress(data.address || null);
                }
            } catch (e) {
                console.error("Error fetching org address:", e);
            }
        };
        fetchOrg();
    }
  }, [organizationId]);

  useEffect(() => {
    if (organization) {
      const hqSource = organization.mapsLink || organization.address;
      if (hqSource) {
        const resolved = parseCoordsFromUrl(hqSource);
        if (resolved) {
          setHqLocation(resolved);
        } else {
          resolveAndParseMapsLink(hqSource)
            .then(coords => {
              if (coords) setHqLocation(coords);
            })
            .catch(err => console.error("Error resolving HQ address:", err));
        }
      }
    }
  }, [organization]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const user = auth.currentUser;
          const rawName = userFullName || user?.displayName || user?.email?.split('@')[0] || t('My Location');
          const shortName = rawName.length > 20 ? rawName.substring(0, 17) + '...' : rawName;
          
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            name: shortName
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, [userFullName]);

  const optimizedVisits = useMemo(() => {
    if (visits.length === 0) return [];

    const sorted = [...visits].sort((a, b) => {
      const idxA = a.orderIndex !== undefined ? a.orderIndex : 999;
      const idxB = b.orderIndex !== undefined ? b.orderIndex : 999;
      return idxA - idxB;
    });

    return sorted;
  }, [visits]);

  // Helper: returns a Leaflet LatLng for a visit, or null if no coords available
  const getVisitCoords = (visit: Visit): L.LatLng | null => {
    const prop = properties.find(p => p.id === visit.propertyId);
    const client = clients.find(c => c.id === visit.clientId);
    const coords = extractVisitCoordinates(visit, prop, client, resolvedCoords);
    if (coords) return L.latLng(coords.lat, coords.lng);
    return null;
  };

  const handleOptimize = async () => {
    if (!userLocation || visits.length === 0) return;
    setIsOptimizing(true);
    try {
      const points = visits
        .filter(v => v.status !== 'Finalizat')
        .map(v => {
          const prop = properties.find(p => p.id === v.propertyId);
          const client = clients.find(c => c.id === v.clientId);
          const coords = extractVisitCoordinates(v, prop, client, resolvedCoords);
          if (coords) return { id: v.id!, lat: coords.lat, lng: coords.lng };
          return null;
        })
        .filter(p => p !== null) as { id: string; lat: number; lng: number }[];

      if (points.length <= 1) return;

      const startCoords = { lat: userLocation.lat, lng: userLocation.lng };
      const route = optimizeRouteNearestNeighbor(startCoords, points, hqLocation);
      const order = route.map(r => r.id);
      
      const unmapped = visits.filter(v => v.status !== 'Finalizat' && !order.includes(v.id!)).map(v => v.id!);
      const finalOrder = [...order, ...unmapped];

      const batch = writeBatch(db);
      finalOrder.forEach((id, index) => {
        if (id.startsWith('lead_')) {
          const realId = id.replace('lead_', '');
          batch.update(doc(db, 'leads', realId), { orderIndex: index });
        } else {
          batch.update(doc(db, 'visits', id), { orderIndex: index });
        }
      });
      await batch.commit();
    } catch (e) {
      console.error("Optimization failed:", e);
    } finally {
      setIsOptimizing(false);
    }
  };

  const openInGoogleMaps = () => {
    const activeVisits = optimizedVisits.filter(v => v.status !== 'Finalizat');
    if (activeVisits.length === 0) return;

    const destinations: string[] = [];
    
    activeVisits.forEach(v => {
      const prop = properties.find(p => p.id === v.propertyId);
      const client = clients.find(c => c.id === v.clientId);
      const dest = getGoogleMapsDirDestination(v, prop, client, resolvedCoords);
      if (dest) {
        destinations.push(dest);
      }
    });

    if (organization) {
      const hqSource = organization.mapsLink || organization.address;
      if (hqSource) {
        const match = hqSource.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
        if (match) {
          destinations.push(`${match[1]},${match[2]}`);
        } else {
          destinations.push(encodeURIComponent(hqSource));
        }
      }
    }

    let url = `https://www.google.com/maps/dir/`;
    if (userLocation) {
        url += `${userLocation.lat},${userLocation.lng}/`;
    }
    url += destinations.join('/');
    
    // Use an anchor tag to ensure it opens reliably (especially in PWAs)
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    if (contextClients) setClients(contextClients);
  }, [contextClients]);

  useEffect(() => {
    if (contextProperties) setProperties(contextProperties);
  }, [contextProperties]);

  useEffect(() => {
    if (!contextVisits) return;
    
    // Filter visits for selected date
    const filteredVisits = contextVisits.filter(v => {
      const isDateMatch = v.data === selectedDate;
      const isUserMatch = v.assignedTo === userId || !v.assignedTo;
      return isDateMatch && isUserMatch;
    });

    // If no visits for today, let's search for future ones
    if (filteredVisits.length === 0) {
      const futureVisits = contextVisits.filter(v => {
        const isFuture = v.data > selectedDate;
        const isUserMatch = v.assignedTo === userId || !v.assignedTo;
        return isFuture && isUserMatch;
      });

      if (futureVisits.length > 0) {
        const dates = futureVisits.map(v => v.data).filter(Boolean);
        if (dates.length > 0) {
          const closestDate = dates.reduce((min, d) => d < min ? d : min, dates[0]);
          console.log("[RoutePlanner] Auto-skipping route date to:", closestDate);
          setSelectedDate(closestDate);
          return;
        }
      }
    }

    setVisits(filteredVisits);
  }, [contextVisits, selectedDate, userId]);

  useEffect(() => {
    if (!contextVisits || visits.length === 0) return;
    
    const clientIds = [...new Set(visits.map(v => v.clientId))].filter(Boolean);
    const clientVisitsMap: Record<string, Visit[]> = {};
    
    clientIds.forEach(cId => {
      clientVisitsMap[cId] = contextVisits.filter(v => v.clientId === cId && v.status === 'Finalizat');
    });
    
    setLastVisits(clientVisitsMap);
  }, [contextVisits, visits]);

  useEffect(() => {
    if (visits.length === 0 || properties.length === 0) return;

    visits.forEach(async (visit) => {
      const prop = properties.find(p => p.id === visit.propertyId);
      const linkSource = prop?.mapsLink || visit.propertyMapsLink;
      
      if (linkSource && (linkSource.includes('maps.app.goo.gl') || linkSource.includes('goo.gl/maps')) && visit.id && !resolvedCoords[visit.id]) {
        try {
          const coords = await resolveAndParseMapsLink(linkSource);
          if (coords) {
            const latLng = L.latLng(coords.lat, coords.lng);
            setResolvedCoords(prev => ({ ...prev, [visit.id!]: latLng }));
            if (prop) {
              await updateDoc(doc(db, 'properties', prop.id), {
                latitude: coords.lat,
                longitude: coords.lng
              });
            }
          }
        } catch (err) {
          console.error("Error resolving link for visit:", visit.id, err);
        }
      }
    });
  }, [visits, properties]);

  useEffect(() => {
    if (!map || optimizedVisits.length === 0) return;

    const activeVisits = optimizedVisits.filter(v => v.status !== 'Finalizat');

    const waypoints = [
        ...(userLocation ? [L.latLng(userLocation.lat, userLocation.lng)] : []),
        ...activeVisits.map(v => {
          const prop = properties.find(p => p.id === v.propertyId);
          const client = clients.find(c => c.id === v.clientId);
          const coords = extractVisitCoordinates(v, prop, client, resolvedCoords);
          return coords ? L.latLng(coords.lat, coords.lng) : null;
        }).filter(c => c !== null) as L.LatLng[]
    ];

    if (waypoints.length < 2) return;
    
    // @ts-ignore - L.Routing is added by the plugin
    try {
      routingControlRef.current = (L.Routing as any).control({
        waypoints,
        routeWhileDragging: false,
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        showAlternatives: false,
        show: false, // Hide the itinerary panel
        createMarker: () => null, // Don't create default markers
        lineOptions: {
          styles: [{ color: '#f07d00', weight: 6, opacity: 0.8 }],
          extendToWaypoints: true,
          missingRouteTolerance: 0
        }
      }).addTo(map);
    } catch (e) {
      console.error("Error adding routing control:", e);
    }

    return () => {
      if (routingControlRef.current) {
        try {
          const control = routingControlRef.current;
          // Check if map is still valid and not disposed
          if (map && map.getContainer()) {
            map.removeControl(control);
          }
          // Prevent async callbacks from throwing
          // leaflet-routing-machine has a bug where it tries to access this._map
          // after the control has been removed from the map.
          control._clearLines = () => {};
          control._routeDone = () => {};
        } catch (e) {
          console.error("Error removing routing control:", e);
        }
        routingControlRef.current = null;
      }
    };
  }, [map, optimizedVisits, userLocation]);

  const displayedVisits = useMemo(() => {
    return showCompleted ? optimizedVisits : optimizedVisits.filter(v => v.status !== 'Finalizat');
  }, [optimizedVisits, showCompleted]);

  return (
    <div className="flex flex-col md:flex-row h-auto md:h-[calc(100vh-10rem)] w-full gap-4 pb-10 md:pb-0">
        <div className="w-full md:w-1/3 flex flex-col h-auto md:h-full gap-4">
            <div className="stihl-card p-4 flex flex-col h-auto md:h-full overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-black text-main uppercase tracking-tight">{t('Route')}</h2>
                    <div className="flex items-center gap-2">
                        <div className="relative overflow-hidden rounded-lg border border-border-color bg-bg-main flex items-center h-[34px] w-[80px] shadow-sm">
                            <div className="absolute inset-0 flex items-center justify-between px-2.5 pointer-events-none z-10 bg-bg-main">
                                <span className="text-sm font-bold text-main">
                                    {selectedDate.split('-').reverse().slice(0, 2).join('.')}
                                </span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-main"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                            </div>
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={e => setSelectedDate(e.target.value)}
                                className="absolute inset-0 w-full h-[50px] -top-2 opacity-0 cursor-pointer z-20"
                            />
                        </div>
                        <button 
                            onClick={handleOptimize}
                            disabled={isOptimizing}
                            className={`p-2 rounded-lg border transition-all ${isOptimizing ? 'bg-gray-100 text-gray-400' : 'bg-accent-color text-white border-accent-color hover:bg-white hover:text-accent-color cursor-pointer'} opacity-100`}
                            title={t('Optimizează Traseu')}
                        >
                            {isOptimizing ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                        </button>
                        <button 
                            onClick={openInGoogleMaps}
                            className="p-2 bg-[#4285F4] text-white rounded-lg hover:bg-[#357ae8] transition-all shadow-md border border-[#4285F4]"
                            title={t('Open Route in Google Maps')}
                        >
                            <MapIcon size={18} />
                        </button>
                        <button
                            onClick={() => setShowCompleted(!showCompleted)}
                            className={`p-2 rounded-lg border transition-all ${showCompleted ? 'bg-bg-main border-border-color text-text-secondary hover:border-accent-color' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 border-gray-300 dark:border-gray-600'}`}
                            title={showCompleted ? t('Hide Completed') : t('Show Completed')}
                        >
                            {showCompleted ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar max-h-[50vh] md:max-h-none">
                    {userLocation && (
                        <div className="p-3 rounded-lg border bg-blue-500/5 border-blue-500/20 flex items-center gap-3 mb-2">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 shrink-0">
                                <User size={16} />
                            </div>
                            <div>
                                <h3 className="font-bold text-main text-sm">{userLocation.name}</h3>
                                <p className="text-[11px] text-text-secondary">{t('Current Location')} ({t('Starting Point')})</p>
                            </div>
                        </div>
                    )}
                    {displayedVisits.length === 0 ? (
                        <p className="text-text-secondary italic text-center py-8">{t('No visits scheduled for today.')}</p>
                    ) : (
                        displayedVisits.map((visit, idx) => {
                            const coords = getVisitCoords(visit);
                            const prop = properties.find(p => p.id === visit.propertyId);
                            const linkSource = prop?.mapsLink || visit.propertyMapsLink;
                            const isShortLink = linkSource?.includes('maps.app.goo.gl') || linkSource?.includes('goo.gl/maps');
                            const hasGoogleLink = !!(linkSource && (linkSource.includes('google') || linkSource.includes('goo.gl') || linkSource.startsWith('http')));
                            
                            const diffDays = visit.status === 'Finalizat'
                               ? calculateDaysSinceVisitCompleted(visit)
                               : calculateDaysSinceLastVisit(lastVisits[visit.clientId] || [], visit.clientId, visit.propertyId, visit.id);
                            
                            return (
                                <div key={visit.id} className={`p-3 rounded-lg border transition-all ${visit.status === 'Finalizat' ? 'bg-gray-500/5 border-gray-500/20 opacity-40 grayscale pointer-events-none' : 'bg-bg-main border-border-color hover:border-accent-color/50'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent-color/10 text-accent-color text-[11px] font-bold">
                                                {idx + 1}
                                            </span>
                                        <div className="flex items-center gap-1 min-w-0">
                                            <h3 
                                                onClick={() => {
                                                    if (onNavigate) {
                                                        onNavigate('details' as any, visit.clientId);
                                                    } else {
                                                        window.location.hash = `#details/${visit.clientId}`;
                                                    }
                                                }}
                                                className="font-bold text-main text-sm truncate max-w-[150px] cursor-pointer hover:text-accent-color hover:underline"
                                            >
                                                {(() => {
                                                    const client = clients.find(c => c.id === visit.clientId) || clients.find(c => c.nume === visit.clientName);
                                                    const companyName = client?.tip_persoana === 'PJ' ? client.numeFirma : '';
                                                    const contactName = client?.nume || visit.clientName || 'Client Necunoscut';
                                                    return companyName ? `${companyName} (${contactName})` : contactName;
                                                })()}
                                            </h3>
                                            <button 
                                                onClick={(e) => { 
                                                    if (onClientClick) {
                                                        const client = clients.find(c => c.id === visit.clientId) || clients.find(c => c.nume === visit.clientName);
                                                        const companyName = client?.tip_persoana === 'PJ' ? client.numeFirma : '';
                                                        const contactName = client?.nume || visit.clientName || 'Client Necunoscut';
                                                        const displayName = companyName ? `${companyName} (${contactName})` : contactName;
                                                        onClientClick(visit.clientId, displayName, visit.propertyId, visit.propertyAddress);
                                                    }
                                                }}
                                                className="p-1 text-text-secondary hover:text-accent-color hover:bg-accent-color/10 rounded-lg transition-all shrink-0 flex items-center gap-1"
                                                title="Istoric Servicii"
                                            >
                                                <History size={14} />
                                                {diffDays !== null && <span className="text-[12.5px] font-bold italic">[{diffDays}z]</span>}
                                            </button>
                                        </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!coords && (
                                                <div className="group relative">
                                                    <AlertCircle size={14} className="text-red-500 cursor-help" />
                                                    <div className="absolute right-0 bottom-full mb-2 w-48 p-2 bg-black text-white text-[11px] rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                                                        {isShortLink 
                                                            ? "Se procesează link-ul scurt... Dacă eroarea persistă, folosește link-ul lung (cu @lat,lng) sau introdu coordonatele manual." 
                                                            : "Lipsesc coordonatele. Adaugă un link Google Maps valid sau Lat/Long în setările locației."}
                                                    </div>
                                                </div>
                                            )}
                                            {visit.status === 'Finalizat' && (
                                                <CheckCircle2 size={14} className="text-green-500" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-text-secondary text-[11px]">
                                        {hasGoogleLink ? (
                                            <MapPin size={12} className="shrink-0 text-blue-500" />
                                        ) : (
                                            <MapIcon size={12} className="shrink-0" />
                                        )}
                                        <p className="truncate">{properties.find(p => p.id === visit.propertyId)?.address || visit.propertyAddress}</p>
                                        {(() => {
                                            const prop = properties.find(p => p.id === visit.propertyId);
                                            if (prop?.irrigation) {
                                                const [y, m, d] = (visit.data || '').split('-').map(Number);
                                                const visitDate = visit.data ? new Date(y, m - 1, d) : new Date();
                                                return (
                                                    <Droplets 
                                                        size={12} 
                                                        className={isIrrigatingToday(prop, visitDate) ? "text-blue-500 shrink-0" : "text-gray-300 shrink-0"} 
                                                    />
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {optimizedVisits.some(v => {
                    const prop = properties.find(p => p.id === v.propertyId);
                    const linkSource = prop?.mapsLink || v.propertyMapsLink;
                    const isShort = linkSource?.includes('maps.app.goo.gl') || linkSource?.includes('goo.gl/maps');
                    return isShort && !resolvedCoords[v.id!];
                }) && (
                    <div className="mt-2 p-2 bg-blue-50/5 border border-blue-500/20 rounded-lg flex gap-2 items-start">
                        <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-text-secondary leading-tight">
                            {t('Some links are shortened and processing...')} 
                            <strong> {t('Tip')}:</strong> {t('If a location does not appear, open the link in a browser and copy the final (long) address back to the app.')}
                        </p>
                    </div>
                )}
            </div>
        </div>
        <div className="w-full md:flex-1 h-[400px] md:h-full rounded-xl overflow-hidden border border-border-color bg-bg-main relative">
            <MapContainer center={[45.9432, 24.9668]} zoom={7} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }} ref={setMap}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapController waypoints={[
                    ...(userLocation ? [L.latLng(userLocation.lat, userLocation.lng)] : []),
                    ...optimizedVisits.filter(v => v.status !== 'Finalizat').map(v => getVisitCoords(v)).filter(c => c !== null) as L.LatLng[]
                ]} />
                {userLocation && (
                    <Marker position={[userLocation.lat, userLocation.lng]} icon={new L.Icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/markers/marker-icon-blue.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    })}>
                        <Tooltip permanent direction="top" offset={[0, -20]} opacity={0.9}>
                            <div className="font-bold text-[11px] text-blue-600">{userLocation.name}</div>
                        </Tooltip>
                        <Popup>
                            <div className="font-bold text-main">{userLocation.name}</div>
                            <div className="text-xs text-text-secondary">{t('Current Location')}</div>
                        </Popup>
                    </Marker>
                )}
                {optimizedVisits.filter(v => v.status !== 'Finalizat').map(visit => {
                    const coords = getVisitCoords(visit);
                    if (coords) {
                        return (
                            <Marker key={visit.id} position={coords}>
                                <Tooltip permanent direction="top" offset={[0, -20]} opacity={0.9}>
                                    <div className="font-bold text-[11px] flex flex-col items-center">
                                        <span>
                                            {(() => {
                                                const client = clients.find(c => c.id === visit.clientId);
                                                return client?.tip_persoana === 'PJ' && client.numeFirma ? client.numeFirma : visit.clientName;
                                            })()}
                                        </span>
                                        <span className="text-[8px] font-normal opacity-70">
                                            {properties.find(p => p.id === visit.propertyId)?.address || visit.propertyAddress}
                                        </span>
                                    </div>
                                </Tooltip>
                                <Popup>
                                    <div className="p-1">
                                        <div className="font-bold text-main">
                                            {(() => {
                                                const client = clients.find(c => c.id === visit.clientId);
                                                return client?.tip_persoana === 'PJ' && client.numeFirma ? client.numeFirma : visit.clientName;
                                            })()}
                                        </div>
                                        <div className="text-xs text-text-secondary">{visit.tipLucrare}</div>
                                        <div className="text-[11px] mt-1">{properties.find(p => p.id === visit.propertyId)?.address || visit.propertyAddress}</div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    }
                    return null;
                })}
            </MapContainer>
        </div>
    </div>
  );
};

export default RoutePlanner;
