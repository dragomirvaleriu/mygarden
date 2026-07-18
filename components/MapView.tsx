import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { MapPin, Map as MapIcon } from 'lucide-react';
import { Client, Property, Organization, Page } from '../src/types';
import { db, doc, updateDoc } from '../services/firebase';
import { resolveAndParseMapsLink } from '../utils/maps';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';

// Fix for default icon issue with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface MapViewProps {
  clients?: Client[];
  properties?: Property[];
  orgSettings?: Organization | null;
  onNavigate?: (page: string, id: string) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: { id: string; lat: number; lng: number; title: string; label: string; color: string; details: string; }[];
}

const createCustomIcon = (name: string, isShortLink: boolean, order?: number) => {
  return L.divIcon({
    className: 'custom-map-marker',
    html: `<div class="flex flex-col items-center transform transition-transform hover:scale-110" style="width: max-content;">
             <div class="relative bg-bg-card px-3 py-1.5 rounded-lg shadow-lg text-xs font-bold whitespace-nowrap border-2 ${isShortLink ? 'border-blue-500 text-blue-600' : 'border-emerald-500 text-emerald-600'} flex items-center gap-1">
               ${order ? `<span class="absolute -top-2 -left-2 bg-red-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-[11px] border border-white shadow-sm">${order}</span>` : ''}
               ${isShortLink ? '<span class="text-[11px]">📍</span>' : ''}
               ${name}
             </div>
             <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] ${isShortLink ? 'border-t-blue-500' : 'border-t-emerald-500'} shadow-sm -mt-[1px]"></div>
           </div>`,
    iconSize: [0, 0], // Size is handled by CSS/content
    iconAnchor: [50, 40] // Adjust anchor to point correctly
  });
};

const FitBounds = ({ markers }: { markers: { lat: number; lng: number }[] }) => {
  const map = useMap();
  const hasFitted = React.useRef(false);

  useEffect(() => {
    // Only fit once when we have at least one marker
    if (markers.length > 0 && !hasFitted.current) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      hasFitted.current = true;
    }
  }, [markers.length, map]); // Depend on length to avoid unnecessary triggers

  return null;
};

const ClientMarker = React.memo(({ client, order, showRoute, onNavigate }: { 
  client: Client & { lat: number; lng: number; isShortLink: boolean; displayAddress: string };
  order?: number;
  showRoute: boolean;
  onNavigate: (page: string, id: string) => void;
}) => {
  const { t } = useTranslation();
  const icon = useMemo(() => 
    createCustomIcon(
      client.tip_persoana === 'PJ' ? (client.numeFirma || client.nume) : client.nume, 
      client.isShortLink, 
      showRoute ? order : undefined
    ), 
    [client.nume, client.numeFirma, client.tip_persoana, client.isShortLink, showRoute, order]
  );

  return (
    <Marker 
      position={[client.lat, client.lng]}
      icon={icon}
    >
      <Popup>
        <div className="text-slate-800 min-w-[200px]">
          <h3 className="font-bold text-lg mb-1">{client.tip_persoana === 'PJ' ? (client.numeFirma || client.nume) : client.nume}</h3>
          <p className="text-sm text-gray-600 mb-3">{client.displayAddress}</p>
          <div className="flex gap-2">
            <button 
              onClick={() => onNavigate('details', client.id)}
              className="flex-1 bg-emerald-500 text-white py-1.5 px-3 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
            >
              {t('Details')}
            </button>
            {client.Maps_link && (
              <a 
                href={client.Maps_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-blue-500 text-white py-1.5 px-3 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors text-center"
              >
                Maps
              </a>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

const RecenterButton = ({ markers }: { markers: { lat: number; lng: number }[] }) => {
  const { t } = useTranslation();
  const map = useMap();
  
  const handleRecenter = () => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  return (
    <button 
      onClick={handleRecenter}
      className="bg-bg-card/90 backdrop-blur-sm p-2 rounded-xl shadow-lg text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-center"
      title={t('Recenter Map')}
    >
      <MapIcon size={20} />
    </button>
  );
};

// Haversine Distance
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

const MapView: React.FC<MapViewProps> = ({ clients = [], properties = [], orgSettings, onNavigate, center, zoom, markers }) => {
  const { t } = useTranslation();
  const [geocodedCoords, setGeocodedCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hqLocation, setHqLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showRoute, setShowRoute] = useState(true);
  const geocodingQueue = React.useRef<Set<string>>(new Set());

  // Get User Location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn("Geolocation error:", error);
        }
      );
    }
  }, []);

  // Get HQ Location
  useEffect(() => {
    const fetchHq = async () => {
      if (!orgSettings?.address || orgSettings.address.trim().length < 5) return;
      
      try {
        // Add a small delay to prevent rapid-fire requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log("Fetching HQ location for address:", orgSettings.address);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(orgSettings.address)}&limit=1&email=support@landscapeos.com`);
        
        if (!response.ok) {
          throw new Error(`Nominatim API returned ${response.status}`);
        }
        
        const data = await response.json();
        if (data && data.length > 0) {
          setHqLocation({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
      } catch (e) {
        console.error("Error fetching HQ location:", e);
      }
    };
    fetchHq();
  }, [orgSettings?.address]);

  // Effect to geocode addresses or extract coords and SAVE to Firestore
  useEffect(() => {
    const processClients = async () => {
      for (const client of clients) {
        // If already has saved coords or is in queue, skip
        if ((client.latitude && client.longitude) || geocodingQueue.current.has(client.id)) continue;

        const clientProps = properties.filter(p => p.clientId === client.id);
        const mainProp = clientProps.find(p => p.name === "Locație Principală") || clientProps[0];
        const mapsLink = mainProp?.mapsLink || client.Maps_link;

        // 1. Try to extract from Maps Link (including short links)
        if (mapsLink) {
          geocodingQueue.current.add(client.id);
          try {
            const coords = await resolveAndParseMapsLink(mapsLink);
            if (coords) {
              const { lat, lng } = coords;
              
              // Update local state for immediate feedback
              setGeocodedCoords(prev => ({ ...prev, [client.id]: { lat, lng } }));

              // Save to Firestore for persistence
              if (mainProp) {
                await updateDoc(doc(db, 'properties', mainProp.id), { latitude: lat, longitude: lng });
              }
              await updateDoc(doc(db, 'clients', client.id), { latitude: lat, longitude: lng });
              continue;
            }
          } catch (e) {
            console.error("Error resolving maps link:", e);
          } finally {
            geocodingQueue.current.delete(client.id);
          }
        }
        
        // 2. Geocode if no coords found from link
        if (geocodedCoords[client.id]) continue;

        let address = mainProp?.address || client.adresa;

        if (address && address.length > 5) {
          // If address doesn't contain a comma, it might be just a street.
          // Append the city from organization address if available to narrow down search.
          if (!address.includes(',') && orgSettings?.address) {
            const orgCityMatch = orgSettings.address.match(/,\s*([^,]+)$/) || orgSettings.address.match(/^([^,]+),/);
            if (orgCityMatch) {
              address = `${address}, ${orgCityMatch[1]}`;
            }
          }

          geocodingQueue.current.add(client.id);
          try {
            // Nominatim rate limit is 1 request per second
            await new Promise(resolve => setTimeout(resolve, 1500)); 
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&email=support@landscapeos.com`);
            
            if (response.ok) {
              const data = await response.json();
              if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                
                // Update local state for immediate feedback
                setGeocodedCoords(prev => ({ ...prev, [client.id]: { lat, lng } }));
                
                // Save to Firestore for persistence
                if (mainProp) {
                  await updateDoc(doc(db, 'properties', mainProp.id), { latitude: lat, longitude: lng });
                }
                await updateDoc(doc(db, 'clients', client.id), { latitude: lat, longitude: lng });
              }
            }
          } catch (err) {
            console.warn(`Geocoding failed for ${client.nume}:`, err);
          } finally {
            geocodingQueue.current.delete(client.id);
          }
        }
      }
    };

    processClients();
  }, [clients.length, properties.length]); // Only re-run if counts change, not on every client update

  const clientsWithCoords = useMemo(() => {
    return clients.map(client => {
      let lat: number | null = null;
      let lng: number | null = null;
      let isShortLink = false;

      // Find main property for this client
      const clientProps = properties.filter(p => p.clientId === client.id);
      const mainProp = clientProps.find(p => p.name === "Locație Principală") || clientProps[0];

      // 1. Check Property Coords
      if (mainProp?.latitude && mainProp?.longitude) {
        lat = mainProp.latitude;
        lng = mainProp.longitude;
      } 
      // 2. Check Client Coords (Legacy)
      else if (client.latitude && client.longitude) {
        lat = client.latitude;
        lng = client.longitude;
      }

      // 3. Try to extract from Maps Link if still null
      const mapsLink = mainProp?.mapsLink || client.Maps_link;
      if ((lat === null || lng === null) && mapsLink) {
        const match = mapsLink.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) {
          lat = parseFloat(match[1]);
          lng = parseFloat(match[2]);
        } else if (mapsLink.includes('maps.app.goo.gl')) {
          isShortLink = true;
        }
      }

      // 4. Check Geocoded Coords
      if ((lat === null || lng === null) && geocodedCoords[client.id]) {
        lat = geocodedCoords[client.id].lat;
        lng = geocodedCoords[client.id].lng;
        isShortLink = true;
      }

      if (mapsLink && mapsLink.includes('maps.app.goo.gl')) {
          isShortLink = true;
      }

      if (lat !== null && lng !== null) {
        return { ...client, lat, lng, isShortLink, displayAddress: mainProp?.address || client.adresa || '' };
      }
      return null;
    }).filter(Boolean) as (Client & { lat: number; lng: number; isShortLink: boolean; displayAddress: string })[];
  }, [clients, properties, geocodedCoords]);

  // Calculate Optimized Route (TSP Nearest Neighbor)
  const { route, orderedClients } = useMemo(() => {
    if (!userLocation || clientsWithCoords.length === 0) return { route: [], orderedClients: [] };

    const points = [...clientsWithCoords];
    const ordered: (Client & { lat: number; lng: number; isShortLink: boolean })[] = [];
    let currentPos = userLocation;
    
    // Start with User Location
    const routePath: [number, number][] = [[userLocation.lat, userLocation.lng]];

    while (points.length > 0) {
      let nearestIndex = -1;
      let minDist = Infinity;

      for (let i = 0; i < points.length; i++) {
        const dist = getDistance(currentPos.lat, currentPos.lng, points[i].lat, points[i].lng);
        if (dist < minDist) {
          minDist = dist;
          nearestIndex = i;
        }
      }

      if (nearestIndex !== -1) {
        const nextPoint = points[nearestIndex];
        ordered.push(nextPoint);
        routePath.push([nextPoint.lat, nextPoint.lng]);
        currentPos = nextPoint;
        points.splice(nearestIndex, 1);
      } else {
        break; 
      }
    }

    // End at HQ (if available) or back to start? User said "catre sediul central"
    if (hqLocation) {
      routePath.push([hqLocation.lat, hqLocation.lng]);
    }

    return { route: routePath, orderedClients: ordered };
  }, [userLocation, hqLocation, clientsWithCoords]);

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden glass relative">
      <MapContainer 
        center={center ? [center.lat, center.lng] : [45.9432, 24.9668]} 
        zoom={zoom || 7} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%', backgroundColor: '#f8fafc' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <FitBounds markers={clientsWithCoords.length > 0 ? clientsWithCoords : (markers || [])} />
        
        {/* Route Polyline */}
        {showRoute && route.length > 1 && (
          <Polyline 
            positions={route} 
            color="#3b82f6" 
            weight={4} 
            opacity={0.7} 
            dashArray="10, 10" 
          />
        )}

        {/* User Location Marker */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={L.divIcon({
            className: 'custom-map-marker',
            html: `<div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg pulse-ring"></div>`,
            iconSize: [16, 16]
          })}>
            <Popup>{t('Your Location')} ({t('Start')})</Popup>
          </Marker>
        )}

        {/* HQ Location Marker */}
        {hqLocation && (
          <Marker position={[hqLocation.lat, hqLocation.lng]} icon={L.divIcon({
            className: 'custom-map-marker',
            html: `<div class="w-6 h-6 bg-purple-600 rounded-md border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold">HQ</div>`,
            iconSize: [24, 24]
          })}>
            <Popup>{t('HQ')} ({t('Final')})</Popup>
          </Marker>
        )}

        {/* Client Markers */}
        {clientsWithCoords.map(client => {
          const orderIndex = orderedClients.findIndex(c => c.id === client.id);
          const order = orderIndex !== -1 ? orderIndex + 1 : undefined;

          return (
            <ClientMarker 
              key={client.id}
              client={client}
              order={order}
              showRoute={showRoute}
              onNavigate={onNavigate || (() => {})}
            />
          );
        })}

        {/* Generic Markers */}
        {markers && markers.map(m => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={L.divIcon({
                className: 'custom-map-marker',
                html: `<div class="flex flex-col items-center">
                         <div class="bg-white px-2 py-1 rounded border-2 shadow-sm text-[11px] font-black uppercase whitespace-nowrap mb-1" style="border-color: ${m.color}; color: ${m.color}">
                           ${m.label}
                         </div>
                         <div class="w-3 h-3 rounded-full shadow-lg" style="background-color: ${m.color}; border: 2px solid white;"></div>
                       </div>`,
                iconSize: [0, 0],
                iconAnchor: [20, 35]
            })}>
                <Popup>
                    <div className="text-slate-800 p-1">
                        <h4 className="font-bold text-sm mb-1">{m.title}</h4>
                        <p className="text-[11px] text-gray-600 font-medium">{m.details}</p>
                    </div>
                </Popup>
            </Marker>
        ))}

        {/* Controls & Legend - Moved inside MapContainer for Leaflet Context */}
        <div className="leaflet-bottom leaflet-left !mb-4 !ml-4 flex flex-col gap-2 z-[1000] pointer-events-auto">
          <div className="flex gap-2">
              <RecenterButton markers={clientsWithCoords} />
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRoute(!showRoute);
                }}
                className="bg-bg-card/90 backdrop-blur-sm px-4 py-2 rounded-xl shadow-lg text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2"
              >
                <span className="text-lg">{showRoute ? '👁️' : '🚫'}</span>
                {showRoute ? t('Route') : t('Show Route')}
              </button>
          </div>

          <div className="bg-bg-card/90 backdrop-blur-sm p-3 rounded-xl shadow-lg text-xs pointer-events-auto">
            <div className="font-bold mb-2 text-main">{t('Map Legend')}</div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                <MapPin size={10} />
              </div>
              <span>{t('Exact Location')} (GPS)</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <MapIcon size={10} />
              </div>
              <span>{t('Approximate Location')} ({t('Address')})</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-blue-600 border border-white"></div>
              <span>{t('Your Location')} ({t('Start')})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-md bg-purple-600 border border-white"></div>
              <span>{t('HQ')} ({t('Final')})</span>
            </div>
          </div>
        </div>
      </MapContainer>
    </div>
  );
};

export default MapView;
