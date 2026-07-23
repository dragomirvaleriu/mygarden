import React, { useState, useEffect } from 'react';
import { Page, UserProfile } from '../src/types';
import { auth, logout, db, doc, updateDoc } from '../services/firebase';
import { Sun, Moon, LogOut, Calendar, LayoutDashboard, ShieldCheck, Shield, User, Camera, BookOpen, ShieldAlert } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useTranslation } from 'react-i18next';
import { APP_NAME } from '../src/config/appVariant';
import NotificationBell from './NotificationBell';

interface Props {
  activePage: Page;
  onNavigate: (page: Page) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  accentColors: string[];
  selectedAccentColor: string;
  onSelectAccentColor: (color: string) => void;
  profile: UserProfile | null;
  subscriptionTier: 'free' | 'pro' | 'enterprise' | 'lifetime';
}

const DesktopSidebar: React.FC<Props> = ({
  activePage,
  onNavigate,
  theme,
  onToggleTheme,
  accentColors,
  selectedAccentColor,
  onSelectAccentColor,
  profile,
  subscriptionTier
}) => {
  const isOnline = useOnlineStatus();
  const { t, i18n } = useTranslation();
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Same 5 tabs on every screen size (see MobileDock for the mobile
  // counterpart — keep both lists in sync). Tools/GardenSetup/Explore live
  // under "Eu" (AccountSettings' Quick Links) instead of being separate tabs.
  const navItems: { id: Page; label: string; icon: any; hasNotification?: boolean }[] = [
    { id: Page.Dashboard, label: t('Acasă'), icon: LayoutDashboard },
    { id: Page.GardenJournal, label: t('Jurnal'), icon: Camera },
    { id: Page.CareCalendar, label: t('Calendar'), icon: Calendar },
    { id: Page.Academy, label: t('Academie'), icon: BookOpen },
    { id: Page.Administration, label: t('Contul meu'), icon: User },
  ];

  // Add SuperAdmin link for superadmin users
  if (profile?.role === 'superadmin' || profile?.email === 'dragomirvaleriu@gmail.com') {
    navItems.push({ id: Page.SuperAdmin, label: 'SuperAdmin', icon: ShieldAlert });
  }

  return (
    <div className="relative h-full bg-bg-card border-r border-border-color p-4 flex flex-col">
      {/* Online/Offline status dot — pinned to top-left edge of sidebar */}
      <span
        className={`absolute top-3 left-1 w-2.5 h-2.5 rounded-full z-50 ${
          isOnline
            ? 'bg-green-500 shadow-[0_0_6px_#22c55e]'
            : 'bg-red-500 shadow-[0_0_6px_#ef4444] animate-pulse'
        } transition-all duration-500`}
      />
      <div className="mb-6 flex flex-col items-center px-2 mt-2 gap-1.5 w-full">
        {/* Row 1: logo + title side by side */}
        <div className="flex items-center justify-center gap-2.5 w-full">
          <div className="shrink-0" style={{ width: '2.4rem', height: '2.4rem' }}>
            <img
              src="/logo.svg"
              alt={`${APP_NAME} Logo`}
              className="w-full h-full object-contain transition-transform duration-500 hover:scale-105"
            />
          </div>
          <h1
            className="leading-none whitespace-nowrap"
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '2rem',
              fontWeight: 400,
              color: '#2D3A3A',
              letterSpacing: '-0.5px',
              lineHeight: 1
            }}
          >
            {APP_NAME}
          </h1>
        </div>

        {/* Row 2: slogan below both */}
        <p className="text-[11.5px] font-medium text-center w-full" style={{ color: '#6B7876', letterSpacing: '0.01em' }}>
          {t('premiumSubtitle')}
        </p>
      </div>


      <nav className="flex-1 flex flex-col gap-0">
        {navItems.map((item: any) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              title={item.label}
              onClick={() => onNavigate(item.id)}
              className={`w-full min-w-0 flex items-center gap-3 transition-all relative group
                ${
                  isActive
                    ? 'px-2 py-2 my-0.5 rounded-2xl bg-bg-main border border-accent-color/25 shadow-lg shadow-accent-color/10 scale-[1.02] z-10'
                    : 'px-2 py-1 rounded-xl border border-transparent hover:bg-bg-main/40'
                }`}
            >
              <div className={`shrink-0 flex items-center justify-center transition-all duration-300
                ${
                  isActive
                    ? 'w-9 h-9 rounded-xl bg-accent-color text-white shadow-md shadow-accent-color/40 rotate-[-4deg] group-hover:rotate-0'
                    : 'w-8 h-8 text-text-secondary group-hover:text-accent-color'
                }`}
              >
                <Icon size={isActive ? 18 : 18} />
              </div>
              <span className={`min-w-0 flex-1 text-left truncate text-[15px] font-black tracking-wide transition-colors
                ${isActive ? 'text-main' : 'text-text-secondary group-hover:text-main'}`}
              >
                {item.label}
              </span>
              {item.hasNotification && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"></span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-border-color">
        <div className="flex items-center gap-2 px-2 pb-2">
          <button 
            onClick={onToggleTheme} 
            className="flex-[6] flex items-center justify-center gap-2 py-2.5 bg-bg-main border border-border-color rounded-xl text-text-secondary hover:text-main hover:border-accent-color transition-all shadow-sm"
            title={theme === 'dark' ? t('Light Mode') : t('Dark Mode')}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span className="text-[11px] font-black uppercase tracking-widest">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          
          <div className="relative group flex-[3]" ref={langMenuRef}>
            <button 
              className="w-full bg-bg-main border border-border-color rounded-xl py-2.5 text-xs font-bold text-main flex items-center justify-center gap-1.5 hover:border-accent-color transition-all shadow-sm"
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
            >
              <span className="text-sm leading-none">
                {i18n.language === 'ro' && '🇷🇴'}
                {i18n.language === 'en' && '🇺🇸'}
                {i18n.language === 'pl' && '🇵🇱'}
                {i18n.language === 'cs' && '🇨🇿'}
                {i18n.language === 'hu' && '🇭🇺'}
                {i18n.language === 'de' && '🇩🇪'}
                {i18n.language === 'nl' && '🇳🇱'}
                {i18n.language === 'fr' && '🇫🇷'}
                {i18n.language === 'es' && '🇪🇸'}
              </span>
              <span className="uppercase tracking-widest text-[11px] font-black">{i18n.language}</span>
            </button>
            
            {isLangMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-bg-card border border-border-color rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 z-[100]">
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                  {[
                    { code: 'en', label: 'English', flag: '🇺🇸' },
                    { code: 'ro', label: 'Română', flag: '🇷🇴' },
                    { code: 'de', label: 'German', flag: '🇩🇪' },
                    { code: 'cs', label: 'Czech', flag: '🇨🇿' },
                    { code: 'pl', label: 'Polski', flag: '🇵🇱' },
                    { code: 'hu', label: 'Magyar', flag: '🇭🇺' },
                    { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
                    { code: 'fr', label: 'Français', flag: '🇫🇷' },
                    { code: 'es', label: 'Español', flag: '🇪🇸' }
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      onClick={async () => {
                        i18n.changeLanguage(lang.code);
                        if (profile?.uid) {
                          await updateDoc(doc(db, 'users', profile.uid), { language: lang.code });
                        }
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${i18n.language === lang.code ? 'bg-accent-color text-white shadow-lg shadow-accent-color/20' : 'text-main hover:bg-bg-main/80 hover:text-accent-color'}`}
                    >
                      <span className="text-lg shrink-0">{lang.flag}</span>
                      <span className="flex-1 text-left text-[11px] uppercase tracking-wider">{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-2 border-t border-border-color/50">
          <div className="flex items-center justify-between gap-1.5">
            {accentColors.map((color, idx) => (
              <button
                key={idx}
                onClick={() => onSelectAccentColor(color)}
                className={`w-5 h-5 rounded-md transition-all ${selectedAccentColor === color ? 'ring-2 ring-offset-2 ring-offset-bg-card ring-text-main scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                style={{ backgroundColor: color }}
                title={`${t('Select Color')} ${color}`}
              />
            ))}
          </div>
        </div>

        <div className="px-4 py-2 flex items-center gap-2 border-b border-border-color mb-2">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-accent-color/10 flex items-center justify-center text-accent-color font-black text-xs border border-accent-color/20">
              {profile?.displayName?.charAt(0) || profile?.email?.charAt(0) || '?'}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-bg-card border border-border-color flex items-center justify-center shadow-sm">
              {profile?.email === 'dragomirvaleriu@gmail.com' ? (
                <ShieldCheck size={10} className="text-amber-500" />
              ) : profile?.role === 'admin' ? (
                <Shield size={10} className="text-accent-color" />
              ) : (
                <User size={10} className="text-text-secondary" />
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-main truncate">{profile?.displayName || t('User')}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {/* Subscription badge */}
              {subscriptionTier !== 'free' ? (
                <span className="px-1.5 py-0.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[7px] font-black rounded-full uppercase tracking-widest shadow-sm shrink-0">
                  {subscriptionTier === 'enterprise' ? 'Enterprise' : 'PRO'}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[7px] font-black rounded-full uppercase tracking-widest shadow-sm shrink-0">
                  Free
                </span>
              )}
            </div>
          </div>
          <NotificationBell uid={profile?.uid} />
        </div>

        <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 transition-all text-sm font-bold">
          <LogOut size={20} />
          <span>{t('Logout')}</span>
        </button>
      </div>
    </div>
  );
};

export default DesktopSidebar;