import React, { useState, useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet';
// @ts-ignore
import { EditControl } from 'react-leaflet-draw';
import { MapPin, Save, X } from 'lucide-react';
import { motion } from 'framer-motion';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import * as L from 'leaflet';

// Fix leaflet icon issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface YardMapperProps {
  onSave: (area: number, coordinates: { lat: number, lng: number }[]) => void;
  onClose: () => void;
}

const defaultCenter: [number, number] = [44.4268, 26.1025]; // Default Bucharest

export const YardMapper: React.FC<YardMapperProps> = ({ onSave, onClose }) => {
  const [polygonCoords, setPolygonCoords] = useState<{lat: number, lng: number}[]>([]);
  const [area, setArea] = useState<number>(0);
  const featureGroupRef = useRef<any>(null);

  const _onCreated = (e: any) => {
    const type = e.layerType;
    const layer = e.layer;
    if (type === 'polygon') {
      const latLngs = layer.getLatLngs()[0];
      const coords = latLngs.map((ll: any) => ({ lat: ll.lat, lng: ll.lng }));
      setPolygonCoords(coords);
      
      // Calculate area using Leaflet geometry util
      const calculatedArea = (L as any).GeometryUtil.geodesicArea(latLngs);
      setArea(Math.round(calculatedArea));
    }
  };

  const _onDeleted = () => {
    setPolygonCoords([]);
    setArea(0);
  };

  const clearDrawing = () => {
    if (featureGroupRef.current) {
      featureGroupRef.current.clearLayers();
    }
    setPolygonCoords([]);
    setArea(0);
  };

  const handleSave = () => {
    if (area > 0 && polygonCoords.length > 2) {
      onSave(area, polygonCoords);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[4000] bg-black"
    >
      <MapContainer
        center={defaultCenter}
        zoom={18}
        style={{ width: '100%', height: '100vh' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
        />
        <FeatureGroup ref={featureGroupRef}>
          <EditControl
            position="topright"
            onCreated={_onCreated}
            onDeleted={_onDeleted}
            draw={{
              rectangle: false,
              circle: false,
              circlemarker: false,
              marker: false,
              polyline: false,
              polygon: {
                allowIntersection: false,
                drawError: {
                  color: '#e1e100',
                  message: '<strong>Eroare:</strong> Poligoanele nu se pot intersecta!'
                },
                shapeOptions: {
                  color: '#2D8C3C',
                  fillOpacity: 0.5,
                  weight: 2
                }
              }
            }}
          />
        </FeatureGroup>
      </MapContainer>

      {/* Floating UI */}
      <div className="absolute top-6 left-6 right-16 flex justify-between items-start pointer-events-none z-[4001]">
        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-white pointer-events-auto shadow-2xl max-w-sm">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
            <MapPin className="w-5 h-5 text-emerald-400" />
            Cartografiere Curte
          </h2>
          <p className="text-xs text-gray-300 font-medium leading-relaxed">
            Folosește unealta de desen (colțul dreapta-sus) pentru a delimita perimetrul grădinii. Funcționează complet gratuit (Satelit).
          </p>
          
          {area > 0 && (
            <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl">
              <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-widest mb-1">Suprafață Calculată</p>
              <p className="text-3xl font-black text-white">{area} <span className="text-sm text-emerald-200">mp</span></p>
            </div>
          )}
        </div>

        <button 
          onClick={onClose}
          className="w-12 h-12 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-red-500/80 transition pointer-events-auto border border-white/10 absolute right-6 top-6"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {area > 0 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 pointer-events-auto z-[4001]">
          <button 
            onClick={clearDrawing}
            className="px-6 py-4 bg-gray-900/80 backdrop-blur-md hover:bg-black text-white font-bold rounded-2xl transition border border-white/10"
          >
            Refă desenul
          </button>
          <button 
            onClick={handleSave}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition shadow-[0_0_30px_rgba(16,185,129,0.3)] flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            Salvează Curtea
          </button>
        </div>
      )}
    </motion.div>
  );
};
