import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, Monitor, Smartphone, Check, Sun, Moon, Zap, ShieldAlert, X as CloseIcon, Briefcase, BarChart3, Users as UsersIcon, User, Phone, Save, Loader2, MapPin } from 'lucide-react';
import { db, doc, updateDoc, getDoc } from '../../services/firebase';
import { UserSettings } from '../../services/settings';
import OrganizationSettings from './OrganizationSettings';
import toast from 'react-hot-toast';

interface Props {
  userEmail: string;
  userSettings: UserSettings | null;
  onUpdateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
  userId?: string;
  orgForm?: any;
  setOrgForm?: any;
  handleUpdateOrg?: any;
  isUpdatingOrg?: boolean;
  accentColors: string[];
  userRole: string;
  accountType?: 'PF' | 'PJ';
  view?: 'personal' | 'visual' | 'all';
  organizationId?: string;
}

const AccountSettings: React.FC<Props> = ({ 
  userEmail, 
  userSettings, 
  onUpdateUserSettings, 
  userId,
  orgForm,
  setOrgForm,
  handleUpdateOrg,
  isUpdatingOrg,
  accentColors,
  userRole,
  accountType = 'PJ',
  view = 'all',
  organizationId
}) => {
  const { t, i18n } = useTranslation();
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Personal info state (PF)
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    if (!userId || accountType !== 'PF') return;
    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setDisplayName(data.displayName || '');
        setPhoneNumber(data.phoneNumber || '');
      }
      setProfileLoaded(true);
    });
  }, [userId, accountType]);

  const handleSavePersonalInfo = async (e?: any) => {
    if (e?.preventDefault) e.preventDefault();
    if (!userId) return;
    setIsSavingProfile(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        displayName: displayName.trim(),
        phoneNumber: phoneNumber.trim(),
      });
      if (handleUpdateOrg) {
        await handleUpdateOrg(e || { preventDefault: () => {} });
      } else {
        toast.success(t('Profile updated successfully!'));
      }
    } catch (err) {
      toast.error(t('Update error'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const changeLanguage = async (code: string) => {
    i18n.changeLanguage(code);
    if (userId) {
      try {
        await updateDoc(doc(db, 'users', userId), { language: code });
        toast.success(t('Language updated'));
      } catch (err) {
        console.error("Error updating language:", err);
      }
    }
  };

  const languages = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ro', label: 'Română', flag: '🇷🇴' },
    { code: 'de', label: 'German', flag: '🇩🇪' },
    { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'es', label: 'Español', flag: '🇪🇸' }
  ];

  const updatePreference = async (key: keyof UserSettings, value: string) => {
    try {
      await onUpdateUserSettings({ [key]: value });
      toast.success(t('Preference updated'));
    } catch (err) {
      toast.error(t('Update error'));
    }
  };

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">

      {/* ────── INFORMAȚII PERSONALE (doar PF) ────── */}
      {(view === 'all' || view === 'personal') && accountType === 'PF' && (
        <div className="stihl-card p-8 rounded-3xl bg-bg-card border border-border-color shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -z-10 blur-3xl" />

          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-inner">
              <User size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-main uppercase tracking-tighter">{t('Personal Information & Contact')}</h3>
              <p className="text-[11px] text-text-secondary font-black uppercase tracking-[0.2em]">{t('This name will appear in your dashboard greeting')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nume */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-1.5">
                <User size={11} /> {t('Full Name')}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={t('Ex: Ion Popescu')}
                className="w-full bg-bg-main border border-border-color rounded-2xl px-5 py-3.5 text-sm font-bold text-main outline-none focus:border-emerald-500 transition-all shadow-inner placeholder:text-text-secondary/40"
              />
              <p className="text-[10px] text-text-secondary/60 ml-1">{t('Displayed in dashboard greeting')}</p>
            </div>

            {/* Telefon */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-1.5">
                <Phone size={11} /> {t('Phone Number')}
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="+40 7XX XXX XXX"
                className="w-full bg-bg-main border border-border-color rounded-2xl px-5 py-3.5 text-sm font-bold text-main outline-none focus:border-emerald-500 transition-all shadow-inner placeholder:text-text-secondary/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-border-color/50">
            {/* Localitate / Oraș */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-1.5">
                <MapPin size={11} /> {accountType === 'PF' ? 'Localitate / Oraș (pentru Meteo)' : 'Localitate / Oraș'}
              </label>
              <input
                type="text"
                value={orgForm?.localitate || ''}
                onChange={e => setOrgForm?.({...orgForm, localitate: e.target.value})}
                placeholder="Ex: București, Ilfov..."
                className="w-full bg-bg-main border border-border-color rounded-2xl px-5 py-3.5 text-sm font-bold text-main outline-none focus:border-emerald-500 transition-all shadow-inner placeholder:text-text-secondary/40"
              />
            </div>

            {/* Adresă / Locație Meteo */}
            <div className="space-y-2">
              <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-1.5">
                <MapPin size={11} /> {accountType === 'PF' ? 'Locație pentru Prognoză Meteo (Stradă)' : t('Home Address')}
              </label>
              <input
                type="text"
                value={orgForm?.address || ''}
                onChange={e => setOrgForm?.({...orgForm, address: e.target.value})}
                placeholder={t('Stradă, Număr')}
                className="w-full bg-bg-main border border-border-color rounded-2xl px-5 py-3.5 text-sm font-bold text-main outline-none focus:border-emerald-500 transition-all shadow-inner placeholder:text-text-secondary/40"
              />
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="mt-4 space-y-2">
            <label className="text-[11px] font-black text-text-secondary uppercase tracking-wider ml-1">{t('Email')}</label>
            <div className="w-full bg-bg-main/50 border border-border-color/50 rounded-2xl px-5 py-3.5 text-sm font-bold text-text-secondary cursor-not-allowed">
              {userEmail}
            </div>
            <p className="text-[10px] text-text-secondary/50 ml-1">{t('Email cannot be changed here')}</p>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSavePersonalInfo}
              disabled={isSavingProfile}
              className="flex items-center gap-2 px-8 py-3 bg-emerald-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSavingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isSavingProfile ? t('Saving...') : t('Save Profile')}
            </button>
          </div>
        </div>
      )}

      {/* ────── PLANT SITTER (VACATION MODE) ────── */}
      {(view === 'all' || view === 'personal') && accountType === 'PF' && (
        <div className="stihl-card p-8 rounded-3xl bg-bg-card border border-border-color shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/5 rounded-br-full -z-10 blur-3xl" />

          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 shadow-inner">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-main uppercase tracking-tighter">Plant Sitter (Mod Vacanță)</h3>
              <p className="text-[11px] text-text-secondary font-black uppercase tracking-[0.2em]">Generează un link securizat pentru un prieten</p>
            </div>
          </div>

          <p className="text-sm text-text-secondary mb-6 leading-relaxed">
            Pleci în vacanță? Generează un link temporar pentru prietenul sau vecinul care îți îngrijește grădina. 
            Acesta va putea accesa direct task-urile tale curente și bifa executarea lor, fără a avea nevoie de cont pe Scapeflow.
          </p>

          <button
            onClick={async () => {
              try {
                const toastId = toast.loading('Generăm link-ul securizat...');
                
                // Imports
                const { collection, addDoc, serverTimestamp } = await import('../../services/firebase');
                
                // Create a share document
                const shareRef = await addDoc(collection(db, 'temporary_shares'), {
                  targetOrganizationId: orgForm?.organizationId || userId || '',
                  userId: userId,
                  createdAt: serverTimestamp(),
                  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                  active: true
                });

                const shareUrl = `${window.location.origin}/sitter/${shareRef.id}`;
                
                toast.dismiss(toastId);
                
                // Copy to clipboard
                await navigator.clipboard.writeText(shareUrl);
                toast.success('Link copiat! Va expira în 7 zile.', { duration: 5000 });
                
              } catch(e) {
                toast.dismiss();
                toast.error('Nu am putut genera link-ul.');
                console.error(e);
              }
            }}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3.5 bg-blue-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-95 transition-all"
          >
            <ShieldAlert size={14} /> Generează Link (7 Zile)
          </button>
        </div>
      )}

      {/* ────── VISUAL CONFIGURATION (INTEGRATED) ────── */}
      {(view === 'all' || view === 'visual') && (
      <div className="stihl-card p-8 rounded-3xl bg-bg-card border border-border-color shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent-color/5 rounded-bl-full -z-10 blur-3xl"></div>
        
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-accent-color/10 flex items-center justify-center text-accent-color shadow-inner">
            <Palette size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black text-main uppercase tracking-tighter">{t('Visual & Personalization')}</h3>
            <p className="text-[11px] text-text-secondary font-black uppercase tracking-[0.2em]">{t('Control your experience across all devices')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
            {/* DEVICE SPECIFIC PREFERENCES */}
            <div className="space-y-10">
                {/* Desktop Preferences */}
                <div 
                    data-theme={userSettings?.themeDesktop || 'light'} 
                    className="rounded-[2rem] overflow-hidden shadow-xl border transition-all duration-500"
                    style={{ 
                        backgroundColor: userSettings?.themeDesktop === 'dark' ? '#0E0F11' : '#f8f9fa',
                        color: userSettings?.themeDesktop === 'dark' ? '#F2F2F2' : '#09090b',
                        borderColor: userSettings?.themeDesktop === 'dark' ? '#2D2E32' : '#e4e4e7',
                        '--accent-color': userSettings?.accentColorDesktop || '#f07d00' 
                    } as any}
                >
                    <div className="space-y-6 p-8 relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-accent-color/10 flex items-center justify-center text-accent-color">
                                <Monitor size={16} />
                            </div>
                            <h4 className="text-xs font-black uppercase tracking-widest" style={{ color: 'inherit' }}>{t('Desktop Mode')}</h4>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-5">
                            {/* Theme */}
                            <div className="space-y-3 shrink-0 sm:w-[150px]">
                                <label className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60" style={{ color: 'inherit' }}>{t('Theme')}</label>
                                <div className="flex p-1 rounded-2xl border shadow-inner" style={{ backgroundColor: userSettings?.themeDesktop === 'dark' ? '#18191B' : '#ffffff', borderColor: 'inherit' }}>
                                    <button 
                                        onClick={() => updatePreference('themeDesktop', 'light')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${userSettings?.themeDesktop === 'light' ? 'bg-[var(--accent-color)] text-white shadow-lg' : 'opacity-60 hover:opacity-100'}`}
                                        style={{ color: userSettings?.themeDesktop === 'light' ? 'white' : 'inherit' }}
                                    >
                                        <Sun size={12} /> <span className="text-[10px] font-black uppercase">Light</span>
                                    </button>
                                    <button 
                                        onClick={() => updatePreference('themeDesktop', 'dark')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${userSettings?.themeDesktop === 'dark' ? 'bg-[var(--accent-color)] text-white shadow-lg' : 'opacity-60 hover:opacity-100'}`}
                                        style={{ color: userSettings?.themeDesktop === 'dark' ? 'white' : 'inherit' }}
                                    >
                                        <Moon size={12} /> <span className="text-[10px] font-black uppercase">Dark</span>
                                    </button>
                                </div>
                            </div>
                            {/* Accent Color */}
                            <div className="space-y-3 flex-1 min-w-0">
                                <label className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60" style={{ color: 'inherit' }}>{t('Accent Color')}</label>
                                <div className="flex gap-2 overflow-visible">
                                    {accentColors.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => updatePreference('accentColorDesktop', color)}
                                            className="w-8 h-8 shrink-0 rounded-full border-[3px] border-transparent transition-all hover:scale-110 flex items-center justify-center relative"
                                            style={{ backgroundColor: color, borderColor: userSettings?.accentColorDesktop === color ? 'currentColor' : 'transparent' }}
                                        >
                                            {userSettings?.accentColorDesktop === color && <Check size={12} className="text-white drop-shadow-md" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {orgForm && setOrgForm && (
                        <div className="mt-5 pt-5 border-t border-black/10 dark:border-white/10 space-y-4">
                            <label className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60" style={{ color: 'inherit' }}>{t('Active Schedule Views')}</label>
                            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                                {[
                                    { id: 'list', label: t('List') },
                                    { id: 'agenda', label: t('Agenda') },
                                    { id: 'kanban', label: t('Kanban') },
                                    { id: 'route', label: t('Route') }
                                ].map(view => {
                                    const isActive = orgForm.activeViewsDesktop?.includes(view.id) ?? true;
                                    return (
                                        <button
                                            key={`desktop-${view.id}`}
                                            type="button"
                                            onClick={async () => {
                                                const current = orgForm.activeViewsDesktop || ['list', 'agenda', 'kanban', 'route'];
                                                let updated;
                                                if (current.includes(view.id)) {
                                                    if (current.length === 1) return;
                                                    updated = current.filter((v: string) => v !== view.id);
                                                } else {
                                                    updated = [...current, view.id];
                                                }
                                                setOrgForm({...orgForm, activeViewsDesktop: updated});
                                                if (organizationId) {
                                                    try {
                                                        await updateDoc(doc(db, 'organizations', organizationId), {
                                                            activeViewsDesktop: updated
                                                        });
                                                    } catch (err) {}
                                                }
                                            }}
                                            className={`py-1.5 px-2 rounded-xl text-[8px] sm:text-[8.5px] font-bold uppercase tracking-widest transition-all border flex flex-col sm:flex-row items-center justify-between gap-1 text-center sm:text-left ${
                                                isActive 
                                                    ? 'bg-[var(--accent-color)] text-white shadow-md' 
                                                    : 'border-black/10 dark:border-white/10 opacity-60 hover:opacity-100'
                                            }`}
                                            style={!isActive ? { color: 'inherit', borderColor: 'inherit' } : { borderColor: 'transparent' }}
                                        >
                                            <span className="truncate w-full">{view.label}</span>
                                            <div className={`w-3 h-3 shrink-0 rounded flex items-center justify-center ${isActive ? 'bg-white/20' : 'border border-current opacity-50'}`}>
                                                {isActive && <Check size={8} className="text-white" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        )}
                    </div>
                </div>

                {/* Mobile Preferences */}
                <div 
                    data-theme={userSettings?.themeMobile || 'light'} 
                    className="rounded-[2rem] overflow-hidden shadow-xl border transition-all duration-500"
                    style={{ 
                        backgroundColor: userSettings?.themeMobile === 'dark' ? '#0E0F11' : '#f8f9fa',
                        color: userSettings?.themeMobile === 'dark' ? '#F2F2F2' : '#09090b',
                        borderColor: userSettings?.themeMobile === 'dark' ? '#2D2E32' : '#e4e4e7',
                        '--accent-color': userSettings?.accentColorMobile || '#f07d00' 
                    } as any}
                >
                    <div className="space-y-6 p-8 relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-accent-color/10 flex items-center justify-center text-accent-color">
                                <Smartphone size={16} />
                            </div>
                            <h4 className="text-xs font-black uppercase tracking-widest" style={{ color: 'inherit' }}>{t('Mobile Mode')}</h4>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-5">
                            {/* Theme */}
                            <div className="space-y-3 shrink-0 sm:w-[150px]">
                                <label className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60" style={{ color: 'inherit' }}>{t('Theme')}</label>
                                <div className="flex p-1 rounded-2xl border shadow-inner" style={{ backgroundColor: userSettings?.themeMobile === 'dark' ? '#18191B' : '#ffffff', borderColor: 'inherit' }}>
                                    <button 
                                        onClick={() => updatePreference('themeMobile', 'light')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${userSettings?.themeMobile === 'light' ? 'bg-[var(--accent-color)] text-white shadow-lg' : 'opacity-60 hover:opacity-100'}`}
                                        style={{ color: userSettings?.themeMobile === 'light' ? 'white' : 'inherit' }}
                                    >
                                        <Sun size={12} /> <span className="text-[10px] font-black uppercase">Light</span>
                                    </button>
                                    <button 
                                        onClick={() => updatePreference('themeMobile', 'dark')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all ${userSettings?.themeMobile === 'dark' ? 'bg-[var(--accent-color)] text-white shadow-lg' : 'opacity-60 hover:opacity-100'}`}
                                        style={{ color: userSettings?.themeMobile === 'dark' ? 'white' : 'inherit' }}
                                    >
                                        <Moon size={12} /> <span className="text-[10px] font-black uppercase">Dark</span>
                                    </button>
                                </div>
                            </div>
                            {/* Accent Color */}
                            <div className="space-y-3 flex-1 min-w-0">
                                <label className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60" style={{ color: 'inherit' }}>{t('Accent Color')}</label>
                                <div className="flex gap-2 overflow-visible">
                                    {accentColors.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => updatePreference('accentColorMobile', color)}
                                            className="w-8 h-8 shrink-0 rounded-full border-[3px] border-transparent transition-all hover:scale-110 flex items-center justify-center relative"
                                            style={{ backgroundColor: color, borderColor: userSettings?.accentColorMobile === color ? 'currentColor' : 'transparent' }}
                                        >
                                            {userSettings?.accentColorMobile === color && <Check size={12} className="text-white drop-shadow-md" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {orgForm && setOrgForm && (
                        <div className="mt-5 pt-5 border-t border-black/10 dark:border-white/10 space-y-4">
                            <label className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60" style={{ color: 'inherit' }}>{t('Active Schedule Views')}</label>
                            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                                {[
                                    { id: 'list', label: t('List') },
                                    { id: 'agenda', label: t('Agenda') },
                                    { id: 'kanban', label: t('Kanban') },
                                    { id: 'route', label: t('Route') }
                                ].map(view => {
                                    const isActive = orgForm.activeViewsMobile?.includes(view.id) ?? true;
                                    return (
                                        <button
                                            key={`mobile-${view.id}`}
                                            type="button"
                                            onClick={async () => {
                                                const current = orgForm.activeViewsMobile || ['list', 'agenda', 'kanban', 'route'];
                                                let updated;
                                                if (current.includes(view.id)) {
                                                    if (current.length === 1) return;
                                                    updated = current.filter((v: string) => v !== view.id);
                                                } else {
                                                    updated = [...current, view.id];
                                                }
                                                setOrgForm({...orgForm, activeViewsMobile: updated});
                                                if (organizationId) {
                                                    try {
                                                        await updateDoc(doc(db, 'organizations', organizationId), {
                                                            activeViewsMobile: updated
                                                        });
                                                    } catch (err) {}
                                                }
                                            }}
                                            className={`py-1.5 px-2 rounded-xl text-[8px] sm:text-[8.5px] font-bold uppercase tracking-widest transition-all border flex flex-col sm:flex-row items-center justify-between gap-1 text-center sm:text-left ${
                                                isActive 
                                                    ? 'bg-[var(--accent-color)] text-white shadow-md' 
                                                    : 'border-black/10 dark:border-white/10 opacity-60 hover:opacity-100'
                                            }`}
                                            style={!isActive ? { color: 'inherit', borderColor: 'inherit' } : { borderColor: 'transparent' }}
                                        >
                                            <span className="truncate w-full">{view.label}</span>
                                            <div className={`w-3 h-3 shrink-0 rounded flex items-center justify-center ${isActive ? 'bg-white/20' : 'border border-current opacity-50'}`}>
                                                {isActive && <Check size={8} className="text-white" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        )}
                    </div>
                </div>

                {/* Language Selection */}
                <div className="space-y-4">
                    <label className="text-[11px] font-black text-text-secondary uppercase tracking-[0.2em] ml-1">{t('Application Language')}</label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {languages.map((lang) => (
                        <button
                        key={lang.code}
                        onClick={() => changeLanguage(lang.code)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${i18n.language === lang.code ? 'bg-accent-color text-white border-accent-color shadow-md shadow-accent-color/20' : 'bg-bg-main text-text-secondary border-border-color hover:border-accent-color/30'}`}
                        >
                        <span className="text-xl">{lang.flag}</span>
                        <span className="text-[11px] font-black uppercase">{lang.code}</span>
                        </button>
                    ))}
                    </div>
                </div>
            </div>

            {/* ORGANIZATION SPECIFIC PREFERENCES */}
            {userRole === 'admin' && orgForm && (
                <div className="space-y-8 border-l border-border-color/50 pl-0 xl:pl-12">
                    <OrganizationSettings 
                        orgForm={orgForm}
                        setOrgForm={setOrgForm}
                        handleUpdateOrg={handleUpdateOrg}
                        isUpdatingOrg={isUpdatingOrg}
                        view="visual"
                        readOnly={false}
                        accountType={accountType}
                    />

                    {/* Account Type Migration Section */}
                    {accountType === 'PF' && (
                        <div className="pt-10 border-t border-border-color/30">
                            <h4 className="text-[11px] font-black text-text-secondary uppercase tracking-[0.2em] mb-4">{t('Account Migration')}</h4>
                            <div className="bg-accent-color/5 p-6 rounded-2xl border border-accent-color/20">
                                <p className="text-xs font-bold text-main mb-2">{t('Commercial Upgrade Available')}</p>
                                <p className="text-[11px] text-text-secondary mb-4 leading-relaxed">
                                    {t('Upgrade to a Commercial account to unlock professional tools and team management.')}
                                </p>
                                <button 
                                    onClick={() => setShowMigrationModal(true)}
                                    className="px-6 py-2.5 bg-accent-color text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-accent-color/20 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    {t('Upgrade to Commercial')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* ────── MIGRATION MODAL ────── */}
        {showMigrationModal && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
                <div className="bg-bg-card border border-border-color p-0 rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-300">
                    {/* Header Image/Pattern */}
                    <div className="h-32 bg-accent-color relative flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 opacity-10">
                            <Zap className="w-full h-full transform -rotate-12 scale-150" />
                        </div>
                        <Zap size={48} className="text-white relative z-10" />
                        <button 
                            onClick={() => setShowMigrationModal(false)}
                            className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/40 transition-all"
                        >
                            <CloseIcon size={18} />
                        </button>
                    </div>

                    <div className="p-10 space-y-8">
                        <div className="text-center">
                            <h3 className="text-2xl font-black text-main uppercase tracking-tight mb-2">{t('Elevate to Commercial')}</h3>
                            <p className="text-xs text-text-secondary font-bold uppercase tracking-widest opacity-60">{t('Professional Grade Garden Management')}</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-bg-main/50 border border-border-color/50">
                                <div className="w-8 h-8 rounded-xl bg-accent-color/10 flex items-center justify-center text-accent-color shrink-0">
                                    <Briefcase size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-main uppercase tracking-tight">{t('Complete Business Suite')}</p>
                                    <p className="text-[11px] text-text-secondary font-medium leading-relaxed">{t('Access CRM Leads, Clients Portfolio, and detailed Invoicing.')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-bg-main/50 border border-border-color/50">
                                <div className="w-8 h-8 rounded-xl bg-accent-color/10 flex items-center justify-center text-accent-color shrink-0">
                                    <UsersIcon size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-main uppercase tracking-tight">{t('Team Management')}</p>
                                    <p className="text-[11px] text-text-secondary font-medium leading-relaxed">{t('Assign tasks to employees and track field activity in real-time.')}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-bg-main/50 border border-border-color/50">
                                <div className="w-8 h-8 rounded-xl bg-accent-color/10 flex items-center justify-center text-accent-color shrink-0">
                                    <BarChart3 size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-main uppercase tracking-tight">{t('Advanced Analytics')}</p>
                                    <p className="text-[11px] text-text-secondary font-medium leading-relaxed">{t('Financial forecasts, activity heatmaps, and collection rate reports.')}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 flex items-start gap-3">
                            <ShieldAlert size={16} className="text-red-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-red-500/80 font-bold leading-relaxed">
                                {t('IMPORTANT: This process is irreversible. Once migrated to a Commercial account, you cannot revert back to a Personal account. All your existing data will be safely migrated.')}
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={() => setShowMigrationModal(false)}
                                className="flex-1 py-4 rounded-2xl border border-border-color font-black uppercase text-[11px] tracking-widest text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                            >
                                {t('Keep Personal')}
                            </button>
                            <button 
                                onClick={async () => {
                                    setIsMigrating(true);
                                    try {
                                        await updateDoc(doc(db, 'users', userId || ''), { accountType: 'PJ' });
                                        toast.success(t('Account successfully migrated to Commercial!'));
                                        setShowMigrationModal(false);
                                    } catch (err) {
                                        toast.error(t('Migration error'));
                                    } finally {
                                        setIsMigrating(false);
                                    }
                                }}
                                disabled={isMigrating}
                                className="flex-1 py-4 rounded-2xl bg-accent-color text-white font-black uppercase text-[11px] tracking-widest shadow-xl shadow-accent-color/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isMigrating ? t('Migrating...') : t('Upgrade Now')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
      )}
    </div>
  );
};

export default AccountSettings;
