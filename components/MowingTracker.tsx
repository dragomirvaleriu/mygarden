import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Scissors, Calendar, AlertOctagon, CheckCircle2, Clock, Trash2 } from 'lucide-react';

const MowingTracker: React.FC = () => {
  const [currentHeight, setCurrentHeight] = useState<string>('8');
  const [targetHeight, setTargetHeight] = useState<string>('5');
  const [nextMowingDate, setNextMowingDate] = useState<string | null>(null);

  useEffect(() => {
    const savedDate = localStorage.getItem('landscape_pf_mowing_reminder');
    if (savedDate) {
      setNextMowingDate(savedDate);
    }
  }, []);

  const handleSetReminder = () => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 5); // +5 days
    const formattedDate = nextDate.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    setNextMowingDate(formattedDate);
    localStorage.setItem('landscape_pf_mowing_reminder', formattedDate);
  };

  const handleClearReminder = () => {
    setNextMowingDate(null);
    localStorage.removeItem('landscape_pf_mowing_reminder');
  };

  // Logica 1/3
  const current = parseFloat(currentHeight);
  const target = parseFloat(targetHeight);
  let maxCut = 0;
  let actualCut = 0;
  let isShockRisk = false;
  
  if (!isNaN(current) && !isNaN(target) && current > 0) {
    maxCut = current / 3;
    actualCut = current - target;
    isShockRisk = actualCut > maxCut && target < current;
  }

  const isValidInputs = !isNaN(current) && !isNaN(target) && target < current;

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-2xl mx-auto relative overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-6">
        <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center border border-green-100 shadow-inner">
          <Scissors className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-xl leading-tight">Tracker Tundere (Regula 1/3)</h2>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">
            Monitorizare tundere și setare program
          </p>
        </div>
      </div>

      <div className="space-y-8">
        
        {/* Secțiunea 1: Input Heights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 shadow-inner">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-2">
              Înălțime actuală (cm)
            </label>
            <input 
              type="number" 
              step="0.5"
              min="0"
              value={currentHeight}
              onChange={(e) => setCurrentHeight(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl py-4 px-4 text-gray-800 font-black text-xl focus:ring-2 focus:ring-green-500 outline-none shadow-sm"
            />
          </div>
          
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 shadow-inner">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-2">
              Înălțime țintă (cm)
            </label>
            <input 
              type="number" 
              step="0.5"
              min="0"
              value={targetHeight}
              onChange={(e) => setTargetHeight(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl py-4 px-4 text-gray-800 font-black text-xl focus:ring-2 focus:ring-green-500 outline-none shadow-sm"
            />
          </div>
        </div>

        {/* Secțiunea 2: Logica Regula 1/3 */}
        {isValidInputs && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`border rounded-2xl p-6 ${isShockRisk ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${isShockRisk ? 'bg-white text-red-500' : 'bg-white text-emerald-500'}`}>
                {isShockRisk ? <AlertOctagon className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </div>
              <div>
                <h4 className={`font-bold text-lg mb-1 ${isShockRisk ? 'text-red-700' : 'text-emerald-700'}`}>
                  {isShockRisk ? 'RISC DE ȘOC: Taie prea mult!' : 'Tundere optimă respectând regula 1/3'}
                </h4>
                <p className={`text-sm font-medium leading-relaxed ${isShockRisk ? 'text-red-600/90' : 'text-emerald-600/90'}`}>
                  {isShockRisk 
                    ? `Vrei să tai ${actualCut.toFixed(1)} cm, dar limita de siguranță este de doar ${maxCut.toFixed(1)} cm (o treime din ${current} cm). Ajustează înălțimea de tăiere a mașinii sau tunde mai des pentru a evita șocarea și îngălbenirea gazonului.` 
                    : `Vei tăia ${actualCut.toFixed(1)} cm, ceea ce se încadrează perfect în limita maximă permisă de ${maxCut.toFixed(1)} cm.`}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Secțiunea 3: Reminder */}
        <div className="border-t border-gray-100 pt-8">
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-500" /> Programator de tuns
          </h3>

          {!nextMowingDate ? (
            <button 
              onClick={handleSetReminder}
              className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 shadow-md"
            >
              <Clock className="w-4 h-4" /> Setează reminder (peste 5 zile)
            </button>
          ) : (
            <div className="bg-green-600 text-white rounded-2xl p-5 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2.5 rounded-xl">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-green-100 text-xs font-bold uppercase tracking-wider mb-0.5">Următoarea tundere programată</p>
                  <p className="font-bold text-lg capitalize">{nextMowingDate}</p>
                </div>
              </div>
              <button 
                onClick={handleClearReminder}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl transition text-sm font-bold flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Anulează
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default MowingTracker;
