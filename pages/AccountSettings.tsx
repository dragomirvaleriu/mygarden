import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Page, UserProfile } from '../src/types';
import {
  User,
  Lock,
  Globe,
  Sparkles,
  LogOut,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  ChevronRight,
  Wrench,
  Sprout,
  Search
} from 'lucide-react';
import { Card } from '../components/ui/primitives';
import {
  auth,
  db,
  doc,
  updateDoc,
  logout,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from '../services/firebase';
import toast from 'react-hot-toast';

interface Props {
  userProfile: UserProfile;
  onNavigate: (page: Page) => void;
  subscriptionTier: 'free' | 'pro' | 'enterprise' | 'lifetime';
}

const TIER_LABEL: Record<Props['subscriptionTier'], string> = {
  free: 'Free',
  pro: 'PRO',
  enterprise: 'Enterprise',
  lifetime: 'Lifetime'
};

const AccountSettings: React.FC<Props> = ({ userProfile, onNavigate, subscriptionTier }) => {
  const { t, i18n } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);

  const handleChangeLanguage = async (lang: 'ro' | 'en') => {
    if (lang === (userProfile.language || 'ro') || isSavingLanguage) return;
    setIsSavingLanguage(true);
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), { language: lang });
      i18n.changeLanguage(lang);
      toast.success(t('Saved'));
    } catch (err: any) {
      toast.error(err.message || t('Error'));
    } finally {
      setIsSavingLanguage(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Parola nouă trebuie să aibă cel puțin 6 caractere.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Parolele nu coincid.');
      return;
    }
    const user = auth.currentUser;
    if (!user || !user.email) return;

    setIsSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast.success('Parola a fost schimbată cu succes.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error('Parola curentă este greșită.');
      } else if (err.code === 'auth/weak-password') {
        toast.error('Parola nouă este prea slabă.');
      } else {
        toast.error(err.message || 'Nu am putut schimba parola.');
      }
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const currentLang = (userProfile.language || 'ro') as 'ro' | 'en';

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      <div>
        <h1 className="text-2xl font-black text-main tracking-tight">Setări Cont</h1>
        <p className="text-sm text-text-secondary font-medium mt-1">Contul tău, parola și preferințele.</p>
      </div>

      {/* Profile summary */}
      <div className="stihl-card rounded-lg p-5 bg-bg-card border border-border-color flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-accent-color/10 text-accent-color flex items-center justify-center shrink-0">
          <User size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-main truncate">{userProfile.displayName || 'Utilizator'}</p>
          <p className="text-sm text-text-secondary font-medium truncate">{userProfile.email}</p>
        </div>
        <span className="px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shrink-0">
          {TIER_LABEL[subscriptionTier]}
        </span>
      </div>

      {/* Quick Links — Tools/GardenSetup/Explore live here instead of as
          separate tabs, now that navigation is unified to 5 tabs. */}
      <Card padding="none" className="overflow-hidden divide-y divide-border-color">
        {[
          { page: Page.Tools, icon: Wrench, label: 'Trusa de Scule', desc: 'Calculatoare, jurnal de tratamente și unelte pentru gazon' },
          { page: Page.GardenSetup, icon: Sprout, label: 'Configurare Curte', desc: 'Suprafață, tip de sol, zone și echipamente' },
          { page: Page.Explore, icon: Search, label: 'Explorează', desc: 'Descoperă conținut și idei noi' },
        ].map(({ page, icon: Icon, label, desc }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className="w-full flex items-center gap-4 p-5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
          >
            <div className="w-11 h-11 rounded-full bg-accent-color/10 text-accent-color flex items-center justify-center shrink-0">
              <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-main">{label}</p>
              <p className="text-xs text-text-secondary font-medium mt-0.5">{desc}</p>
            </div>
            <ChevronRight size={18} className="text-text-secondary shrink-0" />
          </button>
        ))}
      </Card>

      {/* Subscription */}
      {subscriptionTier === 'free' && (
        <button
          onClick={() => onNavigate(Page.Academy)}
          className="w-full stihl-card rounded-lg p-5 bg-gradient-to-r from-amber-400/10 to-amber-500/10 border border-amber-500/30 flex items-center gap-4 hover:scale-[1.01] active:scale-[0.99] transition-transform text-left"
        >
          <div className="w-11 h-11 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-main">Treci la My Garden PRO</p>
            <p className="text-xs text-text-secondary font-medium mt-0.5">Ghiduri complete, calculatoare avansate și diagnoză AI fără limite.</p>
          </div>
          <ChevronRight size={20} className="text-text-secondary shrink-0" />
        </button>
      )}

      {/* Language */}
      <div className="stihl-card rounded-lg p-5 bg-bg-card border border-border-color">
        <div className="flex items-center gap-2 mb-3 text-text-secondary">
          <Globe size={14} className="text-accent-color" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Limbă</span>
        </div>
        <div className="flex gap-2">
          {(['ro', 'en'] as const).map(lang => (
            <button
              key={lang}
              onClick={() => handleChangeLanguage(lang)}
              disabled={isSavingLanguage}
              className={`flex-1 py-2.5 rounded-md text-xs font-black uppercase tracking-wider transition-all ${
                currentLang === lang
                  ? 'bg-accent-color text-white shadow-md'
                  : 'bg-bg-main border border-border-color text-text-secondary hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {lang === 'ro' ? 'Română' : 'English'}
            </button>
          ))}
        </div>
      </div>

      {/* Change password */}
      <form onSubmit={handleChangePassword} className="stihl-card rounded-lg p-5 bg-bg-card border border-border-color space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 text-text-secondary">
            <Lock size={14} className="text-accent-color" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Schimbă Parola</span>
          </div>
          <button
            type="button"
            onClick={() => setShowPasswords(v => !v)}
            className="text-text-secondary hover:text-main transition-colors"
            title={showPasswords ? 'Ascunde' : 'Arată'}
          >
            {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <input
          type={showPasswords ? 'text' : 'password'}
          placeholder="Parola curentă"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2.5 text-sm font-medium outline-none focus:border-accent-color"
        />
        <input
          type={showPasswords ? 'text' : 'password'}
          placeholder="Parola nouă"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2.5 text-sm font-medium outline-none focus:border-accent-color"
        />
        <input
          type={showPasswords ? 'text' : 'password'}
          placeholder="Confirmă parola nouă"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          className="w-full bg-bg-main border border-border-color rounded-md px-3 py-2.5 text-sm font-medium outline-none focus:border-accent-color"
        />

        <button
          type="submit"
          disabled={isSavingPassword}
          className="w-full stihl-button py-3 rounded-md font-bold uppercase tracking-wider text-xs text-white shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isSavingPassword ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          Salvează Parola Nouă
        </button>
      </form>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 rounded-md font-bold uppercase tracking-wider text-xs text-red-500 border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
      >
        <LogOut size={16} />
        Deconectează-te
      </button>
    </div>
  );
};

export default AccountSettings;
