import React, { useState, useEffect } from 'react';
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
  Search,
  Gift,
  Copy,
  Share2
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
  EmailAuthProvider,
  functions,
  httpsCallable
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
  const [displayName, setDisplayName] = useState(userProfile.displayName || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);
  const [giftCode, setGiftCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [referralCode, setReferralCode] = useState(userProfile.referralCode || '');

  useEffect(() => {
    if (referralCode) return;
    const fetchReferralCode = async () => {
      try {
        const generate = httpsCallable(functions, 'generateReferralCode');
        const result: any = await generate({});
        setReferralCode(result.data.code);
      } catch (err) {
        // Non-critical — the Share & Earn card just won't populate this session.
      }
    };
    fetchReferralCode();
  }, [referralCode]);

  const handleCopyReferralLink = () => {
    const link = `${window.location.origin}/?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiat!');
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || isSavingName) return;
    setIsSavingName(true);
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), { displayName: displayName.trim() });
      toast.success('Nume actualizat cu succes!');
    } catch (err: any) {
      toast.error(err.message || t('Error'));
    } finally {
      setIsSavingName(false);
    }
  };

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

  const handlePurchaseProduct = async (product: 'adFree' | 'academyPro' | 'bundle') => {
    setIsPurchasing(true);
    try {
      const checkout = httpsCallable(functions, 'createCheckoutSession');
      const result: any = await checkout({
        successUrl: `${window.location.origin}?purchaseSuccess=${product}`,
        cancelUrl: window.location.origin,
        product,
      });
      if (result.data.url) {
        window.location.href = result.data.url;
      }
    } catch (err: any) {
      toast.error('Eroare la inițierea cumpărăturii: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRedeemGiftCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftCode.trim() || isRedeeming) return;
    setIsRedeeming(true);
    try {
      const redeem = httpsCallable(functions, 'redeemGiftCode');
      await redeem({ code: giftCode.trim() });
      toast.success('Cod activat! Contul tău este acum PRO.');
      setGiftCode('');
    } catch (err: any) {
      const message: string = err?.message || '';
      if (message.includes('Invalid gift code')) {
        toast.error('Cod invalid.');
      } else if (message.includes('already used')) {
        toast.error('Acest cod a fost deja folosit.');
      } else {
        toast.error(message || 'Nu am putut activa codul.');
      }
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleExportData = async () => {
    try {
      const data = {
        profile: {
          email: userProfile.email,
          displayName: userProfile.displayName,
          language: userProfile.language,
          role: userProfile.role,
          level: userProfile.level,
          exp: userProfile.exp,
        },
        subscription: {
          product: userProfile.subscriptionProduct,
          expiresAt: userProfile.subscriptionExpiresAt,
        },
        exportedAt: new Date().toISOString(),
      };

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mygarden-data-${userProfile.email}-${new Date().getTime()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully!');
    } catch (err) {
      toast.error('Failed to export data');
    }
  };

  const currentLang = (userProfile.language || 'ro') as 'ro' | 'en';

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-accent-color flex items-center justify-center text-white shadow-lg shadow-accent-color/30 shrink-0">
          <User className="w-6 h-6 md:w-7 md:h-7" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-black text-main tracking-tight leading-tight">Setări Cont</h1>
          <p className="text-text-secondary text-xs md:text-sm font-medium mt-0.5">Contul tău, parola și preferințele.</p>
        </div>
      </div>

      {/* Profile summary & name editor */}
      <div className="space-y-4">
        <div className="stihl-card rounded-lg p-5 bg-bg-card border border-border-color flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent-color/10 text-accent-color flex items-center justify-center shrink-0">
            <User size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-black text-main truncate">{displayName || 'Utilizator'}</p>
            <p className="text-sm text-text-secondary font-medium truncate">{userProfile.email}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shrink-0">
              {TIER_LABEL[subscriptionTier]}
            </span>
            {userProfile.subscriptionProduct && userProfile.subscriptionExpiresAt && (
              <span className="text-[9px] text-text-secondary font-medium">
                {new Date(userProfile.subscriptionExpiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveName} className="stihl-card rounded-lg p-5 bg-bg-card border border-border-color space-y-3">
          <div className="flex items-center gap-2 text-text-secondary">
            <User size={14} className="text-accent-color" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Cum te cheamă?</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Numele tău (ex: Ion, Maria, etc.)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="flex-1 min-w-0 bg-bg-main border border-border-color rounded-md px-3 py-2.5 text-sm font-medium outline-none focus:border-accent-color"
            />
            <button
              type="submit"
              disabled={isSavingName || !displayName.trim()}
              className="shrink-0 stihl-button px-5 py-2.5 rounded-md font-bold uppercase tracking-wider text-xs text-white shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSavingName ? <Loader2 size={16} className="animate-spin" /> : 'Salvează'}
            </button>
          </div>
          <p className="text-[10px] text-text-secondary font-medium">Acest nume va apărea în salutul personalizat de pe dashboard.</p>
        </form>
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

      {/* Subscription Products */}
      {subscriptionTier === 'free' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-text-secondary">
            <Sparkles size={14} className="text-accent-color" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Pachete Premium</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Ad-Free */}
            <div className="stihl-card rounded-lg p-5 bg-bg-card border border-border-color flex flex-col">
              <h3 className="font-black text-main mb-1">Ad-Free</h3>
              <p className="text-2xl font-black text-accent-color mb-3">$2</p>
              <ul className="text-xs text-text-secondary space-y-2 mb-4 flex-1">
                <li>✓ Fără reclame</li>
                <li>✓ Suport prioritar</li>
              </ul>
              <button
                onClick={() => handlePurchaseProduct('adFree')}
                disabled={isPurchasing}
                className="w-full stihl-button py-2.5 rounded-md font-bold uppercase tracking-wider text-xs text-white shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isPurchasing ? <Loader2 size={14} className="animate-spin" /> : 'Cumpără'}
              </button>
            </div>

            {/* Academy Pro */}
            <div className="stihl-card rounded-lg p-5 bg-bg-card border border-border-color flex flex-col ring-2 ring-accent-color ring-opacity-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-black text-main">Academy Pro</h3>
                <span className="text-[8px] font-black bg-accent-color text-white px-2 py-1 rounded">POPULAR</span>
              </div>
              <p className="text-2xl font-black text-accent-color mb-3">$2</p>
              <ul className="text-xs text-text-secondary space-y-2 mb-4 flex-1">
                <li>✓ Cursuri complete</li>
                <li>✓ Acces la Academy PRO</li>
              </ul>
              <button
                onClick={() => handlePurchaseProduct('academyPro')}
                disabled={isPurchasing}
                className="w-full stihl-button py-2.5 rounded-md font-bold uppercase tracking-wider text-xs text-white shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isPurchasing ? <Loader2 size={14} className="animate-spin" /> : 'Cumpără'}
              </button>
            </div>

            {/* Bundle */}
            <div className="stihl-card rounded-lg p-5 bg-gradient-to-br from-emerald-50 dark:from-emerald-900/20 to-teal-50 dark:to-teal-900/20 border border-emerald-500/30 flex flex-col">
              <h3 className="font-black text-main mb-1">Bundle</h3>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mb-3">$3</p>
              <ul className="text-xs text-text-secondary space-y-2 mb-4 flex-1">
                <li>✓ Fără reclame</li>
                <li>✓ Academy PRO complet</li>
              </ul>
              <button
                onClick={() => handlePurchaseProduct('bundle')}
                disabled={isPurchasing}
                className="w-full stihl-button py-2.5 rounded-md font-bold uppercase tracking-wider text-xs text-white shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isPurchasing ? <Loader2 size={14} className="animate-spin" /> : 'Cumpără'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gift code redemption */}
      {subscriptionTier === 'free' && (
        <form onSubmit={handleRedeemGiftCode} className="stihl-card rounded-lg p-5 bg-bg-card border border-border-color space-y-3">
          <div className="flex items-center gap-2 text-text-secondary">
            <Gift size={14} className="text-accent-color" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Ai un Cod Cadou?</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ex: GARDEN2026"
              value={giftCode}
              onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
              className="flex-1 min-w-0 bg-bg-main border border-border-color rounded-md px-3 py-2.5 text-sm font-medium uppercase tracking-wider outline-none focus:border-accent-color"
            />
            <button
              type="submit"
              disabled={isRedeeming || !giftCode.trim()}
              className="shrink-0 stihl-button px-5 py-2.5 rounded-md font-bold uppercase tracking-wider text-xs text-white shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isRedeeming ? <Loader2 size={16} className="animate-spin" /> : 'Activează'}
            </button>
          </div>
        </form>
      )}

      {/* Referral program */}
      {referralCode && (
        <div className="stihl-card rounded-lg p-5 bg-bg-card border border-border-color space-y-3">
          <div className="flex items-center gap-2 text-text-secondary">
            <Share2 size={14} className="text-accent-color" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Recomandă și Câștigă</span>
          </div>
          <p className="text-xs text-text-secondary font-medium">
            Trimite link-ul tău unui prieten. Când face prima achiziție, primiți amândoi +7 zile PRO gratuit.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={`${window.location.origin}/?ref=${referralCode}`}
              className="flex-1 min-w-0 bg-bg-main border border-border-color rounded-md px-3 py-2.5 text-xs font-medium outline-none"
            />
            <button
              onClick={handleCopyReferralLink}
              className="shrink-0 stihl-button px-4 py-2.5 rounded-md font-bold uppercase tracking-wider text-xs text-white shadow-md flex items-center justify-center gap-2"
            >
              <Copy size={14} />
            </button>
          </div>
          {(userProfile.referralCount || 0) > 0 && (
            <p className="text-[11px] font-bold text-accent-color">
              🎉 {userProfile.referralCount} {userProfile.referralCount === 1 ? 'persoană s-a alăturat' : 'persoane s-au alăturat'} prin linkul tău
            </p>
          )}
        </div>
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

      {/* Export Data */}
      <div className="stihl-card rounded-lg p-5 bg-bg-card border border-border-color">
        <div className="flex items-center gap-2 mb-3 text-text-secondary">
          <Wrench size={14} className="text-accent-color" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Date și Confidențialitate</span>
        </div>
        <button
          onClick={handleExportData}
          className="w-full py-2.5 rounded-md font-bold uppercase tracking-wider text-xs bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          📥 Exportă Datele Mele
        </button>
        <p className="text-[10px] text-text-secondary mt-2">Descarcă profilul și setările în format JSON</p>
      </div>

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
