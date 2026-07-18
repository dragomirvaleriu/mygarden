import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, Beaker, ThermometerSun, Package, ClipboardList, BarChart3, Droplets, FlaskConical, ArrowRightLeft, BookOpen, Gauge, Scissors, Calendar as CalendarIcon, TrendingUp, Truck, Activity, Store } from 'lucide-react';
import NPKCalculator from '../components/NPKCalculator';
import TwoStrokeCalculator from '../components/TwoStrokeCalculator';
import GDDTracker from '../components/GDDTracker';
import ProductInventory from '../components/ProductInventory';
import ApplicationLogs from '../components/ApplicationLogs';
import SeasonalTotals from '../components/SeasonalTotals';
import SmartWatering from '../components/SmartWatering';
import SoilPhLog from '../components/SoilPhLog';
import UnitConverter from '../components/UnitConverter';
import GrassDictionary from '../components/GrassDictionary';
import IrrigationCalibration from '../components/IrrigationCalibration';
import MowingTracker from '../components/MowingTracker';
import { MaintenanceCalendar } from '../components/MaintenanceCalendar';
import { FinancialDashboard } from '../components/FinancialDashboard';
import { FleetManager } from '../components/FleetManager';
import { CommunityHeatmap } from '../components/CommunityHeatmap';
import { GardenixMarketplace } from '../components/GardenixMarketplace';
import { useData } from '../src/context/DataContext';
import { CheckCircle2, Zap } from 'lucide-react';
import { AILensScanner } from '../components/vision/AILensScanner';
import { auth } from '../services/firebase';

export const PFTools: React.FC = () => {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const { isExpertMode, gardenTasks, organization } = useData();

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700 pb-24">
      
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[#2D8C3C] flex items-center justify-center text-white shadow-lg shadow-green-500/30">
          {isExpertMode ? <Calculator className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
            {isExpertMode ? 'Trusa de Scule' : 'Sarcinile Mele'}
          </h1>
          <p className="text-gray-500 text-[11px] font-bold uppercase tracking-[0.2em]">
            {isExpertMode ? 'Unelte profesionale pentru gazonul tău' : 'Aplicația gândește pentru tine'}
          </p>
        </div>
      </div>

      {!isExpertMode ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {gardenTasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gardenTasks.map(task => (
                <div key={task.id} className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 relative overflow-hidden group hover:shadow-md transition">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition"></div>
                  <h3 className="text-lg font-black text-gray-900 mb-2">{task.title}</h3>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed mb-4">
                    {task.notes || 'Această sarcină a fost programată automat de asistentul tău Scapeflow.'}
                  </p>
                  <button className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 px-4 py-2 rounded-xl text-sm font-bold transition w-full justify-center">
                    <Zap size={16} /> Începe Acțiunea
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-10 text-center">
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Totul este la zi!</h3>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                Gazonul tău nu are nevoie de nicio intervenție în acest moment. Relaxează-te și bucură-te de priveliște.
              </p>
            </div>
          )}

          <div className="mt-8">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4">Acțiuni Rapide</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button onClick={() => setActiveTool('mowing')} className="bg-white border border-gray-100 p-4 rounded-2xl text-left hover:border-emerald-500/30 hover:shadow-lg transition flex items-center justify-between group">
                <span className="font-bold text-gray-700 group-hover:text-emerald-600 transition">Vreau să tund iarba</span>
                <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-emerald-50 flex items-center justify-center text-gray-400 group-hover:text-emerald-500 transition">
                  <ArrowRightLeft size={14} />
                </div>
              </button>
              <button onClick={() => setActiveTool('watering')} className="bg-white border border-gray-100 p-4 rounded-2xl text-left hover:border-emerald-500/30 hover:shadow-lg transition flex items-center justify-between group">
                <span className="font-bold text-gray-700 group-hover:text-emerald-600 transition">Vreau să ud curtea</span>
                <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-emerald-50 flex items-center justify-center text-gray-400 group-hover:text-emerald-500 transition">
                  <ArrowRightLeft size={14} />
                </div>
              </button>
              <button onClick={() => setActiveTool('sos')} className="bg-white border border-gray-100 p-4 rounded-2xl text-left hover:border-emerald-500/30 hover:shadow-lg transition flex items-center justify-between group">
                <span className="font-bold text-gray-700 group-hover:text-emerald-600 transition">Văd o problemă (SOS)</span>
                <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-emerald-50 flex items-center justify-center text-gray-400 group-hover:text-emerald-500 transition">
                  <ArrowRightLeft size={14} />
                </div>
              </button>
            </div>
          </div>
        </motion.div>
      ) : activeTool === 'sos' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi
          </button>
          <div className="mt-4">
            <AILensScanner 
              organizationId={organization?.id || ''} 
              userId={auth.currentUser?.uid || ''} 
              userName={auth.currentUser?.displayName || ''} 
              asCard={true}
              onNavigate={() => setActiveTool(null)}
            />
          </div>
        </motion.div>
      ) : activeTool === 'npk' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <NPKCalculator />
        </motion.div>
      ) : activeTool === 'twostroke' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <TwoStrokeCalculator />
        </motion.div>
      ) : activeTool === 'gdd' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <GDDTracker />
        </motion.div>
      ) : activeTool === 'inventory' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <ProductInventory />
        </motion.div>
      ) : activeTool === 'logs' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <ApplicationLogs />
        </motion.div>
      ) : activeTool === 'season' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <SeasonalTotals />
        </motion.div>
      ) : activeTool === 'watering' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <SmartWatering />
        </motion.div>
      ) : activeTool === 'soil' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <SoilPhLog />
        </motion.div>
      ) : activeTool === 'converter' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <UnitConverter />
        </motion.div>
      ) : activeTool === 'dict' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <GrassDictionary />
        </motion.div>
      ) : activeTool === 'calibration' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <IrrigationCalibration />
        </motion.div>
      ) : activeTool === 'mowing' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <MowingTracker />
        </motion.div>
      ) : activeTool === 'maintenance' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <MaintenanceCalendar />
        </motion.div>
      ) : activeTool === 'finance' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <FinancialDashboard />
        </motion.div>
      ) : activeTool === 'fleet' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <FleetManager />
        </motion.div>
      ) : activeTool === 'heatmap' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm z-50 absolute top-4 left-4"
          >
            ← Înapoi la scule
          </button>
          <CommunityHeatmap onClose={() => setActiveTool(null)} isStandalone={false} />
        </motion.div>
      ) : activeTool === 'market' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <button 
            onClick={() => setActiveTool(null)}
            className="mb-6 text-sm font-bold text-gray-500 hover:text-gray-800 flex items-center gap-2 transition bg-white border border-gray-100 px-4 py-2 rounded-full shadow-sm"
          >
            ← Înapoi la scule
          </button>
          <GardenixMarketplace />
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('npk')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-green-50 text-[#2D8C3C] flex items-center justify-center mb-4">
              <Calculator className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Calculator NPK</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Calculează exact necesarul de îngrășământ comercial în funcție de doza de substanță activă dorită.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('twostroke')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <Beaker className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Amestec 2T</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Calculează proporția perfectă de ulei pentru utilajele tale cu motor în 2 timpi.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('gdd')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <ThermometerSun className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Tracker GDD & Tratamente</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Urmărește acumularea termică și ciclurile optime de aplicare pentru PGR și fungicide.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('inventory')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Inventar Produse (Garaj)</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Gestionează stocul tău de îngrășăminte, fungicide și ierbicide, cu calcul de valoare totală.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('logs')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-gray-500/10 rounded-full blur-2xl group-hover:bg-gray-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-600 flex items-center justify-center mb-4">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Jurnal Tratamente (Logs)</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Istoricul complet al aplicărilor tale, cu cantități folosite și costuri calculate.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('season')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Total Nutrienți Anuali</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Vizualizează grafic progresul macronutrienților față de targetul anual per zonă.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('watering')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-4">
              <Droplets className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Irigare & Meteo Tratamente</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Balanță hidrică și ferestre optime pentru aplicarea tratamentelor foliare.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('soil')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
              <FlaskConical className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Jurnal pH Sol & Nutrienți</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Înregistrează valorile pH-ului și primește consultanță inteligentă pentru amendamente.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('converter')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Convertor Unități (Imperial / Metric)</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Conversii rapide de greutate, suprafață și volum specifice industriei agrochimice.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('dict')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Dicționar Specii (EU/SUA)</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Învață să citești etichetele și să înțelegi ce tip de iarbă ai în curte.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('calibration')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Gauge className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Calibrare Aspersoare</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Măsoară uniformitatea irigării (DU) pentru a elimina zonele uscate prin testul paharelor.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('mowing')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mb-4">
              <Scissors className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Regula 1/3 (Tracker Tundere)</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Verifică siguranța tăierii și programează viitoarea rundă de cosit.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('maintenance')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Calendar Mentenanță</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Generează planul tău anual de fertilizare, tratamente și intervenții.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('finance')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Dashboard Financiar</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Vizualizează costurile estimate și reale cu materialele și utilitățile pe tot parcursul anului.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('fleet')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Fleet Manager</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Gestionează reviziile pentru parcul tău de utilaje motorizate.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('heatmap')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Community Heatmap</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Fii mereu la curent cu bolile și dăunătorii din zona ta pentru prevenție eficientă.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTool('market')}
            className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl group-hover:bg-yellow-500/20 transition"></div>
            <div className="w-12 h-12 rounded-2xl bg-yellow-50 text-yellow-600 flex items-center justify-center mb-4">
              <Store className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Gardenix Marketplace</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">
              Descoperă, închiriază sau cumpără utilaje grele de la partenerii autorizați din zona ta.
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PFTools;
