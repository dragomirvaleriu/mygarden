import React from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, Calendar, BookOpen, Settings, CheckCircle2, Wrench, Sprout } from 'lucide-react';
import { Page } from '../../src/types';
import { useData } from '../../src/context/DataContext';

interface Props {
  onNavigate: (page: Page) => void;
  activePage?: Page;
}

export const FloatingDock: React.FC<Props> = ({ onNavigate, activePage }) => {
  const { isExpertMode } = useData();

  const items = isExpertMode 
    ? [
        { id: Page.Dashboard, icon: LayoutGrid, label: 'Dashboard' },
        { id: Page.Tools, icon: Wrench, label: 'Scule' },
        { id: Page.CareCalendar, icon: Calendar, label: 'Calendar' },
        { id: Page.GardenSetup, icon: Sprout, label: 'Curte' }
      ]
    : [
        { id: Page.Dashboard, icon: LayoutGrid, label: 'Acasă' },
        { id: Page.Tools, icon: CheckCircle2, label: 'Sarcini' },
        { id: Page.Academy, icon: BookOpen, label: 'Ghiduri' },
        { id: Page.Administration, icon: Settings, label: 'Setări' }
      ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden">
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="flex items-center gap-2 px-4 py-3 rounded-full bg-white/70 dark:bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl"
      >
        {items.map((item) => {
          const isActive = activePage === item.id;
          const Icon = item.icon;
          
          return (
            <div key={item.id} className="relative group">
              <motion.button
                whileHover={{ scale: 1.2, y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigate(item.id)}
                className={`p-3 rounded-full transition-colors ${
                  isActive 
                    ? 'bg-accent-color text-white shadow-lg shadow-accent-color/40' 
                    : 'text-text-secondary hover:text-main hover:bg-white/50 dark:hover:bg-white/10'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </motion.button>
              
              {/* Tooltip */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {item.label}
              </div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
};
