import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, MapPin, Save, AlertCircle, CheckCircle2, ChevronDown, TestTube } from 'lucide-react';

interface PhReading {
  id: number;
  date: string;
  zoneName: string;
  ph: number;
}

const SoilPhLog: React.FC = () => {
  const [savedZones, setSavedZones] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [phInput, setPhInput] = useState<string>('6.5');
  const [readings, setReadings] = useState<PhReading[]>(() => {
    const saved = localStorage.getItem('landscape_pf_ph_logs');
    if (saved) return JSON.parse(saved);
    // Mock initial data as requested
    return [
      { id: Date.now(), date: '5 Iul 2026', zoneName: 'Gazon Față', ph: 5.9 }
    ];
  });

  useEffect(() => {
    const zones = localStorage.getItem('landscape_pf_zones');
    if (zones) {
      const parsed = JSON.parse(zones);
      setSavedZones(parsed);
      if (parsed.length > 0 && !selectedZone) {
        setSelectedZone(parsed[0].name);
      }
    } else {
      const fallbackZones = [{ id: '1', name: 'Gazon Față' }, { id: '2', name: 'Curte Spate' }];
      setSavedZones(fallbackZones);
      setSelectedZone('Gazon Față');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('landscape_pf_ph_logs', JSON.stringify(readings));
  }, [readings]);

  const handleSave = () => {
    const phValue = parseFloat(phInput);
    if (isNaN(phValue) || phValue < 4.0 || phValue > 9.0) {
      alert("Te rugăm să introduci o valoare validă între 4.0 și 9.0");
      return;
    }

    const newReading = {
      id: Date.now(),
      date: new Date().toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' }),
      zoneName: selectedZone,
      ph: phValue
    };

    setReadings([newReading, ...readings]);
    setPhInput('');
  };

  const latestReading = readings[0];

  const renderConsultingAlert = (ph: number) => {
    if (ph < 6.0) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mt-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-amber-700">
            <AlertCircle className="w-5 h-5" />
            <h4 className="font-bold text-lg">Sol Ușor Acid (Sub 6.0)</h4>
          </div>
          <p className="text-amber-800 text-sm font-medium leading-relaxed">
            Anumiți macronutrienți se pot bloca în sol și nu sunt disponibili plantei. 
            <strong className="block mt-2 text-amber-900">Recomandare: Amendare cu calciu (var/dolomită) și utilizare îngrășăminte echilibrate.</strong>
          </p>
        </div>
      );
    } else if (ph >= 6.0 && ph <= 7.0) {
      return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mt-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
            <h4 className="font-bold text-lg">pH Ideal (6.0 - 7.0)</h4>
          </div>
          <p className="text-emerald-800 text-sm font-medium leading-relaxed">
            Nutrienții sunt asimilați la capacitate maximă de către sistemul radicular.
            <strong className="block mt-2 text-emerald-900">Nu necesită amendamente corective. Continuă programul normal de nutriție.</strong>
          </p>
        </div>
      );
    } else {
      return (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mt-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <h4 className="font-bold text-lg">Sol Alcalin (Peste 7.0)</h4>
          </div>
          <p className="text-red-800 text-sm font-medium leading-relaxed">
            Fierul și manganul pot fi blocați în sol, apărând riscul major de cloroză (îngălbenire).
            <strong className="block mt-2 text-red-900">Recomandare: Aplicare de sulf sau îngrășăminte pe bază de amoniu pentru acidifiere ușoară.</strong>
          </p>
        </div>
      );
    }
  };

  // Calculăm poziția markerului pe o scală de la 4.0 la 9.0 (range = 5)
  const calculateMarkerPosition = (ph: number) => {
    const safePh = Math.max(4.0, Math.min(9.0, ph));
    return ((safePh - 4.0) / 5.0) * 100;
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-3xl mx-auto relative overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-6">
        <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100 shadow-inner">
          <FlaskConical className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-xl leading-tight">Jurnal pH Sol & Nutrienți</h2>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">
            Înregistrare și Consultanță
          </p>
        </div>
      </div>

      <div className="space-y-8">
        
        {/* Secțiunea 1: Înregistrare */}
        <section className="bg-gray-50 border border-gray-100 rounded-2xl p-5 shadow-inner">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TestTube className="w-4 h-4 text-orange-500" /> Înregistrare Analiză Nouă
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-1.5">
                Zonă Grădină
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                <select 
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-gray-800 font-semibold focus:ring-2 focus:ring-orange-500 outline-none appearance-none"
                >
                  {savedZones.map(z => (
                    <option key={z.id} value={z.name}>{z.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-1.5">
                Valoare pH (4.0 - 9.0)
              </label>
              <input 
                type="number" 
                step="0.1"
                min="4.0"
                max="9.0"
                value={phInput}
                onChange={(e) => setPhInput(e.target.value)}
                placeholder="ex: 6.5"
                className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-gray-800 font-bold focus:ring-2 focus:ring-orange-500 outline-none text-center"
              />
            </div>

            <div className="md:col-span-3">
              <button 
                onClick={handleSave}
                className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Save className="w-4 h-4" /> Salvează
              </button>
            </div>
          </div>
        </section>

        {/* Secțiunea 2 & 3: Ultima citire și Consultanță */}
        {latestReading && (
          <section>
            <h3 className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span> Rezultat și Recomandări (Ultima Citire)
            </h3>

            <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm relative">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Zona: {latestReading.zoneName}</p>
                  <p className="text-xs text-gray-500 font-medium">Data înregistrării: {latestReading.date}</p>
                </div>
                <div className="bg-orange-50 border border-orange-100 px-4 py-2 rounded-xl text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-orange-600 mb-0.5">pH Curent</span>
                  <span className="text-2xl font-black text-gray-900">{latestReading.ph.toFixed(1)}</span>
                </div>
              </div>

              {/* Slider vizual */}
              <div className="relative pt-6 pb-2">
                {/* Zona Ideală */}
                <div 
                  className="absolute top-0 h-full border-x-2 border-dashed border-gray-300 bg-gray-50/50" 
                  style={{ left: `${calculateMarkerPosition(6.0)}%`, width: `${calculateMarkerPosition(7.0) - calculateMarkerPosition(6.0)}%` }}
                >
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Ideal</span>
                </div>

                {/* Bara de culori */}
                <div className="h-4 w-full rounded-full relative overflow-hidden bg-gradient-to-r from-red-500 via-emerald-500 to-purple-600 shadow-inner"></div>
                
                {/* Etichete scală */}
                <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400">
                  <span>4.0 (Acid)</span>
                  <span>9.0 (Alcalin)</span>
                </div>

                {/* Marker pH Cureent */}
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1, left: `${calculateMarkerPosition(latestReading.ph)}%` }}
                  transition={{ type: 'spring', damping: 15 }}
                  className="absolute top-4 w-1 h-8 bg-gray-900 rounded-full shadow-md -translate-x-1/2"
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold py-1 px-2 rounded-lg whitespace-nowrap">
                    {latestReading.ph.toFixed(1)}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                  </div>
                </motion.div>
              </div>

              {/* Logica de consultanță */}
              {renderConsultingAlert(latestReading.ph)}
              
            </div>
          </section>
        )}

      </div>
    </div>
  );
};

export default SoilPhLog;
