import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Page, UserProfile } from '../src/types';
import {
  User,
  Mail,
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
  Share2,
  Phone
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
  const [phone, setPhone] = useState(userProfile.phoneNumber || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
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

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingPhone) return;
    setIsSavingPhone(true);
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), { phoneNumber: phone.trim() });
      toast.success('Telefon actualizat cu succes!');
    } catch (err: any) {
      toast.error(err.message || t('Error'));
    } finally {
      setIsSavingPhone(false);
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

      // Record password change timestamp to invalidate other sessions
      await updateDoc(doc(db, 'users', userProfile.uid), {
        passwordChangedAt: new Date().toISOString()
      });

      toast.success('Parola a fost schimbată cu succes. Vei fi delogat din alte sesiuni.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Logout after a short delay so user sees the message
      setTimeout(() => logout(), 2000);
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
          phoneNumber: userProfile.phoneNumber,
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
    <div className="min-h-screen bg-gradient-to-br from-bg-main via-bg-main to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 animate-in fade-in duration-700">
        {/* ── HEADER SECTION ── */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/40">
              <User size={28} strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-main tracking-tight">Contul Meu</h1>
              <p className="text-text-secondary text-sm font-semibold mt-1">Gestionează datele, securitatea și preferințele</p>
            </div>
          </div>
        </div>

        {/* MAIN LAYOUT: Sidebar + Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* ── LEFT SIDEBAR: Profile Card ── */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Profile Card */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 flex items-center justify-center text-white text-2xl font-black mb-4 shadow-lg">
                    {displayName.charAt(0).toUpperCase() || 'G'}
                  </div>
                  <h3 className="text-xl font-black text-main">{displayName || 'Grădinar'}</h3>
                  <p className="text-xs text-text-secondary font-semibold mt-1 truncate">{userProfile.email}</p>

                  <div className="w-full mt-5 pt-5 border-t border-slate-200 dark:border-slate-700">
                    <span className="inline-block px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-sky-600 text-white text-xs font-black uppercase rounded-full shadow-md">
                      {TIER_LABEL[subscriptionTier]}
                    </span>
                    {userProfile.subscriptionExpiresAt && (
                      <p className="text-xs text-text-secondary font-medium mt-3">
                        Expirare: {new Date(userProfile.subscriptionExpiresAt).toLocaleDateString('ro-RO')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-lg border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-black text-text-secondary uppercase tracking-wide mb-3">Progres</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-bold text-main mb-1">Level {userProfile.level || 1}</p>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-sky-500 h-2 rounded-full"
                        style={{width: `${((userProfile.exp || 0) % 100)}%`}}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT CONTENT: Settings Sections ── */}
          <div className="lg:col-span-3 space-y-6">
            {/* 1. IDENTITY SECTION */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                  <User size={20} className="text-sky-600 dark:text-sky-400" />
                </div>
                <h2 className="text-2xl font-black text-main">Date Personale</h2>
              </div>

              <div className="space-y-6">
                {/* Name */}
                <form onSubmit={handleSaveName} className="space-y-3">
                  <label className="block text-xs font-black text-text-secondary uppercase tracking-wide">
                    Cum te cheamă?
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="Exemplu: Ion Popescu"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-sm font-medium outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                    />
                    <button
                      type="submit"
                      disabled={isSavingName || !displayName.trim()}
                      className="sm:w-auto w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm rounded-lg hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
                    >
                      {isSavingName ? <Loader2 size={18} className="animate-spin" /> : 'Salvează'}
                    </button>
                  </div>
                  <p className="text-xs text-text-secondary font-medium">Salut personalizat pe pagina principală</p>
                </form>

                {/* Email Display */}
                <div className="space-y-3">
                  <label className="block text-xs font-black text-text-secondary uppercase tracking-wide">
                    Email
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Mail size={18} className="text-sky-500 flex-shrink-0" />
                      <span className="font-medium text-sm text-main truncate">{userProfile.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full w-fit shrink-0">
                      <CheckCircle size={14} />
                      <span className="hidden sm:inline">Verificat</span>
                    </div>
                  </div>
                </div>

                {/* Phone */}
                <form onSubmit={handleSavePhone} className="space-y-3">
                  <label className="block text-xs font-black text-text-secondary uppercase tracking-wide">
                    Telefon
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="tel"
                      placeholder="+40 7XX XXX XXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-sm font-medium outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                    />
                    <button
                      type="submit"
                      disabled={isSavingPhone}
                      className="sm:w-auto w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm rounded-lg hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
                    >
                      {isSavingPhone ? <Loader2 size={18} className="animate-spin" /> : 'Salvează'}
                    </button>
                  </div>
                  <p className="text-xs text-text-secondary font-medium">Pentru contactare urgență (viitor)</p>
                </form>
              </div>
            </div>

            {/* 2. SECURITY SECTION */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Lock size={20} className="text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-black text-main">Securitate</h2>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-text-secondary uppercase tracking-wide mb-3">
                    Parola curentă
                  </label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-sm font-medium outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-text-secondary uppercase tracking-wide mb-3">
                    Parola nouă
                  </label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-sm font-medium outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-text-secondary uppercase tracking-wide mb-3">
                    Confirmă parola nouă
                  </label>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-sm font-medium outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPasswords(v => !v)}
                      className="p-3 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition text-text-secondary"
                      title={showPasswords ? 'Ascunde' : 'Arată'}
                    >
                      {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-lg hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {isSavingPassword ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                  Schimbă Parola
                </button>
              </form>
            </div>

            {/* 3. PREFERENCES SECTION */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Globe size={20} className="text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-2xl font-black text-main">Preferințe</h2>
              </div>

              <form onSubmit={handleChangeLanguage} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-text-secondary uppercase tracking-wide mb-3">
                    Limbă
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        i18n.changeLanguage('ro');
                        setIsSavingLanguage(true);
                      }}
                      className={`py-3 px-4 rounded-lg font-bold text-sm transition ${
                        currentLang === 'ro'
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg'
                          : 'bg-slate-100 dark:bg-slate-700 text-main hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      🇷🇴 Română
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        i18n.changeLanguage('en');
                        setIsSavingLanguage(true);
                      }}
                      className={`py-3 px-4 rounded-lg font-bold text-sm transition ${
                        currentLang === 'en'
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg'
                          : 'bg-slate-100 dark:bg-slate-700 text-main hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      🇬🇧 English
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* 4. REFERRAL SECTION */}
            {referralCode && (
              <div className="bg-gradient-to-br from-emerald-50 to-sky-50 dark:from-emerald-900/20 dark:to-sky-900/20 rounded-2xl p-8 shadow-lg border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                    <Share2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-black text-main">Recomandă & Câștigă</h2>
                </div>
                <p className="text-sm text-text-secondary font-medium mb-4">
                  Trimite link-ul tău și ambii primiți +7 zile PRO gratuit!
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/?ref=${referralCode}`}
                    className="flex-1 bg-white dark:bg-slate-700 border border-emerald-300 dark:border-emerald-700 rounded-lg px-4 py-3 text-sm font-mono text-main select-all"
                  />
                  <button
                    onClick={handleCopyReferralLink}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-lg hover:shadow-lg transition flex items-center gap-2"
                  >
                    <Copy size={18} />
                    Copiază
                  </button>
                </div>
              </div>
            )}

            {/* 5. GIFT CODE SECTION */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Gift size={20} className="text-yellow-600 dark:text-yellow-400" />
                </div>
                <h2 className="text-2xl font-black text-main">Cod Cadou</h2>
              </div>
              <p className="text-sm text-text-secondary font-medium mb-4">
                Ai un cod cadou? Activează-l aici pentru a primi Pro gratis!
              </p>
              <form onSubmit={handleRedeemGiftCode} className="flex gap-3">
                <input
                  type="text"
                  placeholder="Introdu codul cadou..."
                  value={giftCode}
                  onChange={(e) => setGiftCode(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-sm font-medium outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
                  maxLength={50}
                />
                <button
                  type="submit"
                  disabled={isRedeeming || !giftCode.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold rounded-lg hover:shadow-lg disabled:opacity-50 transition"
                >
                  {isRedeeming ? <Loader2 size={18} className="animate-spin" /> : 'Activează'}
                </button>
              </form>
            </div>

            {/* 6. DATA & LOGOUT SECTION */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleExportData}
                  className="px-6 py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition flex items-center justify-center gap-2"
                >
                  <Wrench size={18} />
                  Export Date
                </button>
                <button
                  onClick={() => {
                    logout();
                    onNavigate(Page.Dashboard);
                  }}
                  className="px-6 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-bold rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition flex items-center justify-center gap-2"
                >
                  <LogOut size={18} />
                  Deconectare
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
