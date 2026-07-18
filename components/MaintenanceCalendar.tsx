import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CheckCircle2, Circle, Sparkles, Loader2 } from 'lucide-react';
import { taskService, MaintenanceTask } from '../services/pf/taskService';
import { auth } from '../services/firebase';
import toast from 'react-hot-toast';

const DEFAULT_TASKS = [
  { title: "Scarificare ușoară", month: "Martie" },
  { title: "Fertilizare N-start", month: "Aprilie" },
  { title: "Supraînsămânțare", month: "Aprilie" },
  { title: "Tratament fungicid preventiv", month: "Mai" },
  { title: "Erbicidare selectivă", month: "Iunie" },
  { title: "Fertilizare menținere (Echilibrat)", month: "Iulie" },
  { title: "Tratament fungicid (Brown Patch)", month: "August" },
  { title: "Aerare cu carote", month: "Septembrie" },
  { title: "Supraînsămânțare toamnă", month: "Septembrie" },
  { title: "Fertilizare K-winter", month: "Octombrie" }
];

const MONTHS_ORDER = ["Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie"];

export const MaintenanceCalendar: React.FC = () => {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = auth.currentUser?.uid || 'pf_anonymous_user';

  useEffect(() => {
    const unsub = taskService.subscribeToTasks(uid, (data) => {
      setTasks(data);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const handleGeneratePlan = async () => {
    if (!uid) return;
    try {
      const promises = DEFAULT_TASKS.map(t => 
        taskService.addTask(uid, {
          title: t.title,
          month: t.month,
          isCompleted: false
        })
      );
      await Promise.all(promises);
      toast.success("Plan anual generat cu succes!");
    } catch (err) {
      toast.error("Eroare la generarea planului.");
    }
  };

  const toggleTask = async (id: string, isCompleted: boolean) => {
    try {
      await taskService.toggleTaskStatus(id, !isCompleted);
      if (!isCompleted) toast.success("Task finalizat! Felicitări.");
    } catch (err) {
      toast.error("Eroare la actualizarea task-ului.");
    }
  };

  const tasksByMonth = MONTHS_ORDER.reduce((acc, month) => {
    acc[month] = tasks.filter(t => t.month === month);
    return acc;
  }, {} as Record<string, MaintenanceTask[]>);

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-4xl mx-auto relative overflow-hidden">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-gray-100 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center border border-purple-100 text-purple-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-xl leading-tight">Calendar Mentenanță</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Planificare Anuală Gazon</p>
          </div>
        </div>
        
        <button 
          onClick={handleGeneratePlan}
          className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition shadow-sm flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" /> Generează Plan Standard
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-4" />
          <p className="font-medium">Se încarcă calendarul...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-16 text-center bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
          <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="font-bold text-lg text-gray-600 mb-1">Niciun plan activ.</p>
          <p className="text-sm text-gray-500">Apasă pe "Generează Plan Standard" pentru a adăuga pașii recomandați.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {MONTHS_ORDER.map(month => {
            const monthTasks = tasksByMonth[month];
            if (!monthTasks || monthTasks.length === 0) return null;
            
            const progress = Math.round((monthTasks.filter(t => t.isCompleted).length / monthTasks.length) * 100);

            return (
              <div key={month} className="relative pl-6 border-l-2 border-gray-100">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-purple-100 border-2 border-white"></div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-gray-800">{month}</h3>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                    {progress}% Finalizat
                  </span>
                </div>
                
                <div className="space-y-3">
                  {monthTasks.map(task => (
                    <motion.div 
                      key={task.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-center gap-3 p-4 rounded-2xl border transition cursor-pointer group ${task.isCompleted ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-100 shadow-sm hover:shadow-md'}`}
                      onClick={() => toggleTask(task.id!, task.isCompleted)}
                    >
                      <button className="text-purple-500 shrink-0 group-hover:scale-110 transition-transform">
                        {task.isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6 text-gray-300" />}
                      </button>
                      <span className={`font-bold text-sm ${task.isCompleted ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                        {task.title}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
