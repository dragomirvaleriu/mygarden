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
    <div className="bg-bg-card border border-border-color rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${status === 'ACTIVE' ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'}`}>
            <Droplets size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[11px] font-black text-main uppercase tracking-widest leading-none truncate">Sistem Irigații</h3>
            <p className="text-[9px] font-bold text-text-secondary uppercase tracking-[0.15em] mt-0.5">Controller Smart</p>
          </div>
        </div>

        {/* iOS style Toggle */}
        <button
          onClick={() => setIsSmartSync(!isSmartSync)}
          title="Smart Sync Meteo"
          className={`relative w-9 h-5 rounded-full transition-colors duration-300 shrink-0 ${isSmartSync ? 'bg-emerald-500' : 'bg-border-color'}`}
        >
          <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${isSmartSync ? 'translate-x-4 shadow-sm' : ''}`} />
        </button>
      </div>

      <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border transition-all ${status === 'ACTIVE' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
        <div className="flex items-center gap-2 min-w-0">
          {status === 'ACTIVE' ? (
            <CheckCircle2 size={16} className="text-blue-500 shrink-0" />
          ) : (
            <Clock size={16} className="text-amber-500 shrink-0 animate-pulse" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-black text-main leading-tight">{status === 'ACTIVE' ? 'Activ' : 'Suspendat'}</p>
            <p className="text-[10px] text-text-secondary font-medium truncate">
              {status === 'ACTIVE' ? 'Conform programului stabilit' : `Reluare în ~${suspendHoursLeft}h`}
            </p>
          </div>
        </div>

        {status === 'ACTIVE' ? (
          <button
            onClick={() => handleSuspend(24)}
            disabled={isLoading}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-main border border-border-color text-[10px] font-black text-main uppercase tracking-wider hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all disabled:opacity-50"
          >
            {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <PowerOff size={12} />}
            Suspendă
          </button>
        ) : (
          <button
            onClick={handleResume}
            disabled={isLoading}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-[10px] font-black uppercase tracking-wider hover:bg-blue-600 transition-all disabled:opacity-50"
          >
            {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Droplets size={12} />}
            Reluare
          </button>
        )}
      </div>

      {status === 'SUSPENDED' && isSmartSync && mockWeather.precipitationProbability > 60 && (
        <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-1 rounded-lg w-fit">
          <CloudRain size={12} /> Ploaie iminentă
        </div>
      )}
    </div>
  );
};
