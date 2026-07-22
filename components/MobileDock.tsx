import React from 'react';
import { useTranslation } from 'react-i18next';
import { Page } from '../src/types';
import { LayoutDashboard, Calendar, Camera, BookOpen, User, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface Props {
  activePage: Page;
  onNavigate: (page: Page) => void;
  profile: any;
  subscriptionTier: 'free' | 'pro' | 'enterprise' | 'lifetime';
}

// The 5 tabs every screen size shares (see DesktopSidebar for the desktop
// counterpart — keep both lists in sync). Tools/GardenSetup/Explore live
// under "Eu" (AccountSettings' Quick Links) instead of being separate tabs.
const MobileDock: React.FC<Props> = ({ activePage, onNavigate, profile }) => {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();

  const items: { id: Page; icon: any }[] = [
    { id: Page.Dashboard, icon: LayoutDashboard },
    { id: Page.CareCalendar, icon: Calendar },
    { id: Page.Academy, icon: BookOpen },
    { id: Page.GardenJournal, icon: Camera },
    { id: Page.Administration, icon: User },
  ];

  const getLabel = (id: string) => {
    if (id === Page.Dashboard) return t('Acasă');
    if (id === Page.CareCalendar) return t('Calendar');
    if (id === Page.Academy) return t('Academie');
    if (id === Page.GardenJournal) return t('Jurnal');
    if (id === Page.Administration) return t('Eu');
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

      </div>
    </div>
  );
};

export default MobileDock;
