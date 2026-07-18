import React, { useState, useEffect } from 'react';
import { Droplets, PowerOff, RefreshCw, CloudRain, CheckCircle2, Clock } from 'lucide-react';
import { evaluateSmartIrrigation } from '../../src/utils/weatherSync';
import toast from 'react-hot-toast';

export const IrrigationWidget: React.FC = () => {
  const [isSmartSync, setIsSmartSync] = useState(true);
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [isLoading, setIsLoading] = useState(false);
  const [suspendHoursLeft, setSuspendHoursLeft] = useState<number | null>(null);

  // Mock Weather Data for demo purposes
  const mockWeather = { precipitationProbability: 75, precipitationAmount: 8 };

  useEffect(() => {
    if (isSmartSync) {
      const result = evaluateSmartIrrigation(mockWeather);
      if (result.shouldSuspend && status === 'ACTIVE') {
        handleSuspend(24, true);
        toast(result.reason, { icon: '🌧️', duration: 5000 });
      } else if (!result.shouldSuspend && status === 'SUSPENDED') {
        handleResume();
      }
    }
  }, [isSmartSync]);

  const handleSuspend = async (hours: number = 24, auto: boolean = false) => {
    setIsLoading(true);
    try {
      // API call to mock Next.js route (or intercepted in Vite)
      // Since it's a mock, we'll simulate the latency directly
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setStatus('SUSPENDED');
      setSuspendHoursLeft(hours);
      
      if (!auto) {
        toast.success(`Irigația a fost suspendată manual pentru ${hours}h`);
      }
    } catch (e) {
      toast.error('Eroare la comunicarea cu controller-ul');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      setStatus('ACTIVE');
      setSuspendHoursLeft(null);
      toast.success('Program reluat');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-bg-card border border-border-color rounded-3xl p-6 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${status === 'ACTIVE' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'}`}>
            <Droplets size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-main uppercase tracking-widest">Sistem Irigații</h3>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">Controller Smart</p>
          </div>
        </div>
        
        {/* iOS style Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Smart Sync Meteo</span>
          <button 
            onClick={() => setIsSmartSync(!isSmartSync)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${isSmartSync ? 'bg-emerald-500' : 'bg-border-color'}`}
          >
            <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${isSmartSync ? 'translate-x-5 shadow-sm' : ''}`} />
          </button>
        </div>
      </div>

      <div className={`flex-1 rounded-2xl p-6 border flex flex-col items-center justify-center text-center transition-all ${status === 'ACTIVE' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        {status === 'ACTIVE' ? (
          <>
            <CheckCircle2 size={32} className="text-blue-500 mb-3" />
            <h4 className="text-lg font-black text-main mb-1">Active & Optimized</h4>
            <p className="text-xs text-text-secondary font-medium">Sistemul funcționează conform programului stabilit.</p>
          </>
        ) : (
          <>
            <Clock size={32} className="text-amber-500 mb-3 animate-pulse" />
            <h4 className="text-lg font-black text-main mb-1">Suspended</h4>
            <p className="text-xs text-text-secondary font-medium mb-2">Reluare automată în aprox. {suspendHoursLeft}h</p>
            {isSmartSync && mockWeather.precipitationProbability > 60 && (
               <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-1 rounded-lg">
                 <CloudRain size={12} /> Ploaie iminentă
               </div>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        {status === 'ACTIVE' ? (
          <button 
            onClick={() => handleSuspend(24)}
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl bg-bg-main border border-border-color text-xs font-black text-main uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <PowerOff size={16} />}
            Suspendă Udarea (24h)
          </button>
        ) : (
          <button 
            onClick={handleResume}
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/20 text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Droplets size={16} />}
            Reluare Program
          </button>
        )}
      </div>
    </div>
  );
};
