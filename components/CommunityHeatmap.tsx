import React, { useState, useEffect, useMemo } from 'react';
import { GoogleMap, useLoadScript, HeatmapLayer } from '@react-google-maps/api';
import { Map, AlertTriangle, X, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { alertService, PublicAlert } from '../services/pf/alertService';
import { gardenService, GardenZone } from '../services/pf/gardenService';
import { auth } from '../services/firebase';
import toast from 'react-hot-toast';

const libraries: any[] = ['visualization', 'geometry'];

const mapContainerStyle = {
  width: '100%',
  height: '100vh'
};

const defaultCenter = {
  lat: 44.4268,
  lng: 26.1025
};

const options = {
  styles: [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
    { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
  ],
  disableDefaultUI: true,
  zoomControl: true,
};

interface Props {
  onClose?: () => void;
  isStandalone?: boolean;
}

export const CommunityHeatmap: React.FC<Props> = ({ onClose, isStandalone = true }) => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const [alerts, setAlerts] = useState<PublicAlert[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const uid = auth.currentUser?.uid || 'pf_anonymous_user';

  // Load User Location from Zones
  useEffect(() => {
    const unsub = gardenService.subscribeToZones(uid, (zones: GardenZone[]) => {
      let found = false;
      for (const z of zones) {
        if (z.boundaryCoordinates && z.boundaryCoordinates.length > 0) {
          setUserLocation(z.boundaryCoordinates[0]);
          found = true;
          break;
        }
      }
      if (!found && 'geolocation' in navigator) {
        // Fallback to browser geolocation
        navigator.geolocation.getCurrentPosition(pos => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        });
      }
    });
    return () => unsub();
  }, [uid]);

  // Load Alerts (last 7 days)
  useEffect(() => {
    const unsub = alertService.subscribeToRecentAlerts(7, (data) => {
      setAlerts(data);
    });
    return () => unsub();
  }, []);

  // Proximity Alert logic
  useEffect(() => {
    if (!isLoaded || !userLocation || alerts.length === 0) return;

    const userLatLng = new window.google.maps.LatLng(userLocation.lat, userLocation.lng);
    
    alerts.forEach(alert => {
      const alertLatLng = new window.google.maps.LatLng(alert.lat, alert.lng);
      const distance = window.google.maps.geometry.spherical.computeDistanceBetween(userLatLng, alertLatLng);
      
      // 5km = 5000 meters
      if (distance < 5000) {
        // In a real app we'd track notified alerts to avoid spamming
        // For this mock, we just show a toast if it's within 5km
        toast(`Atenție: ${alert.diseaseType} raportată în apropiere! (${(distance/1000).toFixed(1)} km)`, {
          icon: '⚠️',
          duration: 5000,
          style: {
            borderRadius: '10px',
            background: '#333',
            color: '#fff',
          },
        });
      }
    });
  }, [alerts, userLocation, isLoaded]);

  const heatmapData = useMemo(() => {
    if (!isLoaded) return [];
    return alerts.map(a => new window.google.maps.LatLng(a.lat, a.lng));
  }, [alerts, isLoaded]);

  if (loadError) return <div className="p-4 text-red-500 bg-red-50 rounded-xl">Eroare la încărcarea hărții Google.</div>;
  if (!isLoaded) return <div className="p-4 text-center text-gray-500">Se încarcă harta...</div>;

  const content = (
    <div className="relative w-full h-full bg-black">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={12}
        center={userLocation || defaultCenter}
        options={options}
      >
        {showHeatmap && heatmapData.length > 0 && (
          <HeatmapLayer
            data={heatmapData}
            options={{
              radius: 40,
              opacity: 0.8,
              gradient: [
                'rgba(0, 255, 255, 0)',
                'rgba(0, 255, 255, 1)',
                'rgba(0, 191, 255, 1)',
                'rgba(0, 127, 255, 1)',
                'rgba(0, 63, 255, 1)',
                'rgba(0, 0, 255, 1)',
                'rgba(0, 0, 223, 1)',
                'rgba(0, 0, 191, 1)',
                'rgba(0, 0, 159, 1)',
                'rgba(0, 0, 127, 1)',
                'rgba(63, 0, 91, 1)',
                'rgba(127, 0, 63, 1)',
                'rgba(191, 0, 31, 1)',
                'rgba(255, 0, 0, 1)'
              ]
            }}
          />
        )}
      </GoogleMap>

      {/* UI Controls */}
      <div className="absolute top-6 left-6 right-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pointer-events-none z-10">
        
        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-white pointer-events-auto shadow-2xl">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
            <Activity className="w-5 h-5 text-red-400" />
            Community Heatmap
          </h2>
          <p className="text-xs text-gray-300 font-medium">Boli și dăunători raportați în ultimele 7 zile.</p>
          <div className="mt-4 flex items-center justify-between bg-white/5 px-3 py-2 rounded-xl">
            <span className="text-sm font-bold">Arată Heatmap</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={showHeatmap} onChange={() => setShowHeatmap(!showHeatmap)} />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>
        </div>

        {onClose && (
          <button 
            onClick={onClose}
            className="w-12 h-12 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition pointer-events-auto border border-white/10"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-6 py-2 pointer-events-auto">
        <p className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          {alerts.length} alerte active
        </p>
      </div>

    </div>
  );

  if (isStandalone) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50"
      >
        {content}
      </motion.div>
    );
  }

  return content;
};
