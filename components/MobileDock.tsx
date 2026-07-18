import React from 'react';
import { useTranslation } from 'react-i18next';
import { Page, Visit } from '../src/types';
import { LayoutDashboard, Users, Calendar, Settings, X, Power, BarChart, Wifi, WifiOff, Plus, Square, ShieldCheck, CreditCard, Sun, Sprout, Camera, Image as ImageIcon, Wrench, BookOpen, User, Clock } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface Props {
  activePage: Page;
  onNavigate: (page: Page) => void;
  activeVisit?: Visit | null;
  onStopWork?: () => void;
  isAdmin: boolean;
  profile: any;
  subscriptionTier: 'free' | 'pro' | 'enterprise' | 'lifetime';
}

const MobileDock: React.FC<Props> = ({ activePage, onNavigate, activeVisit, onStopWork, isAdmin, profile, subscriptionTier }) => {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const isPF = profile?.accountType === 'PF';
  
  let items: { id: Page; icon: any }[] = [
    { id: Page.Dashboard, icon: LayoutDashboard },
  ];

  if (isPF) {
    items = items.concat([
      { id: Page.Tools, icon: Wrench },
      { id: Page.Gallery, icon: Camera },
      { id: Page.Academy, icon: BookOpen },
      { id: Page.GardenSetup, icon: Sprout },
      { id: Page.Administration, icon: User }
    ]);
  } else {
    items.push({ id: Page.Clients, icon: Users });
    items.push({ id: Page.Schedule, icon: Calendar });
    if (isAdmin) {
      items.push({ id: Page.Reports, icon: BarChart });
    }
    items.push({ id: Page.Gallery, icon: ImageIcon });

    if (isAdmin || profile?.role === 'employee') {
      items.push({ id: Page.Administration, icon: Settings });
    }
  }

  // For labels, we can map common page IDs to short labels
  const getLabel = (id: string) => {
    if (id === Page.Dashboard) return t('Acasă');
    if (id === Page.Clients) return t('Clienți');
    if (id === Page.Schedule) return t('Program');
    if (id === Page.Reports) return t('Rapoarte');
    if (id === Page.Administration) return t('Setări');
    if (id === Page.GardenSetup) return t('Curte');
    if (id === Page.Academy) return t('Ghiduri');
    if (id === Page.Tools) return t('Scule');
    if (id === Page.Gallery) return t('Galerie');
    return '';
  };

  return (
    <div className="px-2 pb-2">
      <div className="bg-bg-card/95 backdrop-blur-xl border border-border-color rounded-full w-full mx-auto px-1.5 py-1.5 flex flex-row items-center justify-between shadow-[0_16px_32px_rgba(0,0,0,0.5)] relative pointer-events-auto overflow-hidden">
        
        {!isOnline && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full animate-bounce shadow-lg flex items-center gap-1">
            <WifiOff size={8} />
            {t('Offline')}
          </div>
        )}

        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="relative flex items-center justify-center transition-all duration-500 ease-out py-1 group"
            >
              {isActive && (
                <div className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-6 h-[3px] bg-accent-color rounded-b-full shadow-[0_2px_8px_rgba(var(--accent-color-rgb),0.8)]" />
              )}
              <div className={`flex flex-row items-center gap-1 ${isActive ? 'px-3 py-1.5' : 'px-1.5 py-1.5'} rounded-full transition-all duration-500 ${isActive ? 'bg-accent-color/15' : 'bg-transparent'}`}>
                <Icon 
                  size={isActive ? 20 : 18} 
                  className={`transition-all duration-500 ${isActive ? 'text-accent-color' : 'text-text-secondary opacity-50 group-hover:opacity-100'}`} 
                  strokeWidth={isActive ? 2.5 : 2} 
                />
                <div 
                  className={`overflow-hidden transition-all duration-500 flex items-center ${isActive ? 'max-w-[100px] opacity-100' : 'max-w-0 opacity-0'}`}
                >
                  <span className="text-[10px] font-black tracking-widest uppercase text-accent-color whitespace-nowrap">
                    {getLabel(item.id)}
                  </span>
                </div>
              </div>
            </button>
          )
        })}

        {/* INJECT STOP BUTTON AT THE END IF ACTIVE */}
        {activeVisit && (
          <button
            onClick={() => onStopWork?.()}
            className="relative flex items-center justify-center transition-all duration-500 ease-out py-1 ml-1"
          >
            <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping opacity-75"></div>
            <div className="flex flex-row items-center px-2.5 py-2 rounded-full bg-red-600 text-white shadow-lg shadow-red-600/30 relative z-10">
              <Square size={16} fill="currentColor" strokeWidth={2.5} />
            </div>
          </button>
        )}

      </div>
    </div>
  );
};

export default MobileDock;
