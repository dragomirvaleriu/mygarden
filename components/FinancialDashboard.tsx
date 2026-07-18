import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Droplets, Wrench, Package, TrendingUp, Loader2 } from 'lucide-react';
import { logService, TreatmentLog } from '../services/pf/logService';
import { gardenService, GardenZone } from '../services/pf/gardenService';
import { auth } from '../services/firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const FinancialDashboard: React.FC = () => {
  const [logs, setLogs] = useState<TreatmentLog[]>([]);
  const [zones, setZones] = useState<GardenZone[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [waterCostMonthly, setWaterCostMonthly] = useState<number>(150); // Simulated average
  const [maintenanceCostMonthly, setMaintenanceCostMonthly] = useState<number>(50); // Simulated average (gas, oil)
  
  const uid = auth.currentUser?.uid || 'pf_anonymous_user';

  useEffect(() => {
    const unsubLogs = logService.subscribeToLogs(uid, setLogs);
    const unsubZones = gardenService.subscribeToZones(uid, setZones);
    
    // Simulate loading time for DB fetch
    const t = setTimeout(() => setLoading(false), 800);

    return () => {
      unsubLogs();
      unsubZones();
      clearTimeout(t);
    };
  }, [uid]);

  const totalArea = useMemo(() => zones.reduce((sum, z) => sum + z.area, 0), [zones]);
  
  const treatmentsCost = useMemo(() => logs.reduce((sum, log) => sum + (log.cost || 0), 0), [logs]);
  const waterCostYearly = waterCostMonthly * 12;
  const maintenanceCostYearly = maintenanceCostMonthly * 12;
  const totalCost = treatmentsCost + waterCostYearly + maintenanceCostYearly;

  const costPerSqm = totalArea > 0 ? (totalCost / totalArea).toFixed(2) : '0.00';

  // Prepare chart data (simulating months based on logs or standard 12 months)
  const chartData = useMemo(() => {
    const months = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = months.map(m => ({
      month: m,
      Tratamente: 0,
      Apa: waterCostMonthly,
      Mentenanta: maintenanceCostMonthly
    }));

    logs.forEach(log => {
      if (!log.date) return;
      const date = new Date(log.date);
      if (!isNaN(date.getTime())) {
        const monthIndex = date.getMonth(); // 0-11
        if (data[monthIndex]) {
          data[monthIndex].Tratamente += (log.cost || 0);
        }
      }
    });

    return data;
  }, [logs, waterCostMonthly, maintenanceCostMonthly]);

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-12 shadow-sm border border-gray-100 flex flex-col items-center justify-center max-w-5xl mx-auto">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
        <p className="font-bold text-gray-500">Calculăm datele financiare...</p>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-5xl mx-auto relative overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-6">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-xl leading-tight">Dashboard Financiar</h2>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Analiza Costurilor Anuale</p>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-5 rounded-2xl shadow-lg shadow-gray-900/20 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20"><DollarSign className="w-12 h-12" /></div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 relative z-10">Total Cheltuieli / An</p>
          <p className="text-3xl font-black relative z-10">{totalCost.toLocaleString('ro-RO', {maximumFractionDigits:0})} <span className="text-sm font-medium text-gray-400">RON</span></p>
        </div>
        
        <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Package className="w-12 h-12 text-emerald-600" /></div>
          <p className="text-[10px] text-emerald-600/80 font-bold uppercase tracking-wider mb-1 relative z-10">Cost Tratamente (Real)</p>
          <p className="text-2xl font-black text-emerald-700 relative z-10">{treatmentsCost.toLocaleString('ro-RO', {maximumFractionDigits:0})} <span className="text-sm font-medium text-emerald-600/60">RON</span></p>
        </div>

        <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Droplets className="w-12 h-12 text-blue-600" /></div>
          <p className="text-[10px] text-blue-600/80 font-bold uppercase tracking-wider mb-1 relative z-10">Cost Apă (Estimat)</p>
          <p className="text-2xl font-black text-blue-700 relative z-10">{waterCostYearly.toLocaleString('ro-RO', {maximumFractionDigits:0})} <span className="text-sm font-medium text-blue-600/60">RON</span></p>
        </div>

        <div className="bg-orange-50 border border-orange-100 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Wrench className="w-12 h-12 text-orange-600" /></div>
          <p className="text-[10px] text-orange-600/80 font-bold uppercase tracking-wider mb-1 relative z-10">Mentenanță (Estimat)</p>
          <p className="text-2xl font-black text-orange-700 relative z-10">{maintenanceCostYearly.toLocaleString('ro-RO', {maximumFractionDigits:0})} <span className="text-sm font-medium text-orange-600/60">RON</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-6">Evoluție Costuri / Lună</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                <Bar dataKey="Tratamente" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                <Bar dataKey="Apa" stackId="a" fill="#3b82f6" />
                <Bar dataKey="Mentenanta" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Adjustments & Stats */}
        <div className="space-y-6">
          <div className="bg-gray-50 border border-gray-100 rounded-3xl p-6">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Ajustează Estimările Lunare</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Apă Irigații (RON/Lună)</label>
                <input 
                  type="number" 
                  value={waterCostMonthly} 
                  onChange={e => setWaterCostMonthly(Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Mentenanță Utilaje (RON/Lună)</label>
                <input 
                  type="number" 
                  value={maintenanceCostMonthly} 
                  onChange={e => setMaintenanceCostMonthly(Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-[#2D8C3C] rounded-3xl p-6 text-white relative overflow-hidden shadow-lg shadow-green-900/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200 mb-1">Eficiență Cost</p>
            <h3 className="text-sm font-bold mb-4">Cost per metru pătrat</h3>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black">{costPerSqm}</span>
              <span className="text-sm font-bold text-emerald-200">RON / an</span>
            </div>
            <p className="text-xs text-emerald-100 mt-3 font-medium leading-relaxed">
              Bazat pe suprafața totală salvată de {totalArea} mp. Include tratamente, estimări apă și utilaje.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};
