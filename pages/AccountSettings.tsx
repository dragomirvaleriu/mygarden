import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Page, UserProfile } from '../src/types';
import {
  User,
  Mail,
  Lock,
  Globe,
  LogOut,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  Wrench,
  Sprout,
  Gift,
  Copy,
  Share2,
  CheckCircle,
  Download
} from 'lucide-react';
import { Card, Pill } from '../components/ui/primitives';
import { ActivityManagement } from '../components/ActivityManagement';
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

const TIER_META: Record<Props['subscriptionTier'], { label: string; tone: 'neutral' | 'accent' | 'success' }> = {
  free: { label: 'Free', tone: 'neutral' },
  pro: { label: 'PRO', tone: 'accent' },
  enterprise: { label: 'Enterprise', tone: 'accent' },
  lifetime: { label: 'Lifetime', tone: 'success' },
};

const inputCls =
  'w-full px-4 py-3 rounded-xl bg-bg-main border border-border-color text-sm font-medium text-main placeholder:text-text-secondary/60 outline-none focus:border-accent-color focus:ring-2 focus:ring-accent-color/20 transition';

const primaryBtnCls =
  'px-6 py-3 rounded-xl bg-accent-color text-accent-text font-bold text-sm hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2';

const SectionCard: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ icon: Icon, title, children, className }) => (
  <Card padding="lg" className={className}>
    <div className="flex items-center gap-3 mb-6">
      <div className="w-9 h-9 rounded-xl bg-accent-color/10 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-accent-color" />
      </div>
      <h2 className="text-lg font-black text-main">{title}</h2>
    </div>
    {children}
  </Card>
);

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
      toast.error(t('Parola nouă trebuie să aibă cel puțin 6 caractere.'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('Parolele nu coincid.'));
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

      toast.success(t('Parola a fost schimbată cu succes. Vei fi delogat din alte sesiuni.'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Logout after a short delay so user sees the message
      setTimeout(() => logout(), 2000);
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error(t('Parola curentă este greșită.'));
      } else if (err.code === 'auth/weak-password') {
        toast.error(t('Parola nouă este prea slabă.'));
      } else {
        toast.error(err.message || t('Nu am putut schimba parola.'));
      }
    } finally {
      setIsSavingPassword(false);
    }
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
      toast.error(t('Eroare la inițierea cumpărăturii:') + ' ' + (err?.message || 'Unknown error'));
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
      toast.success(t('Cod activat! Contul tău este acum PRO.'));
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
  const tierMeta = TIER_META[subscriptionTier];

  return (
    <div className="min-h-screen bg-bg-main">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent-color/10 flex items-center justify-center shrink-0">
            <User size={24} className="text-accent-color" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-main tracking-tight">{t('Contul Meu')}</h1>
            <p className="text-text-secondary text-xs font-semibold mt-0.5">{t('Gestionează datele, securitatea și preferințele')}</p>
          </div>
        </div>

        {/* MAIN LAYOUT: Sidebar + Content */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* ── SIDEBAR: Profile summary ── */}
          <div className="lg:sticky lg:top-8 space-y-5">
            <Card padding="lg">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent-color text-accent-text flex items-center justify-center text-xl font-black mb-3">
                  {displayName.charAt(0).toUpperCase() || 'G'}
                </div>
                <h3 className="text-base font-black text-main truncate max-w-full">{displayName || t('Grădinar')}</h3>
                <p className="text-xs text-text-secondary font-medium mt-0.5 truncate max-w-full">{userProfile.email}</p>

                <div className="w-full mt-4 pt-4 border-t border-border-color flex flex-col items-center gap-2">
                  <Pill tone={tierMeta.tone}>{tierMeta.label}</Pill>
                  {userProfile.subscriptionExpiresAt && (
                    <p className="text-[11px] text-text-secondary font-medium">
                      {t('Expiră')}: {(
                        (userProfile.subscriptionExpiresAt as any)?.toDate
                          ? (userProfile.subscriptionExpiresAt as any).toDate()
                          : new Date(userProfile.subscriptionExpiresAt as any)
                      ).toLocaleDateString('ro-RO')}
                    </p>
                  )}
                </div>
              </div>
            </Card>

            <Card padding="lg">
              <p className="text-[10px] font-black text-text-secondary uppercase tracking-wider mb-3">{t('Progres')}</p>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-bold text-main">{t('Nivel')} {userProfile.level || 1}</span>
                <span className="text-[10px] text-text-secondary tabular-nums">{(userProfile.exp || 0) % 100}/100 XP</span>
              </div>
              <div className="w-full bg-bg-main rounded-full h-2 overflow-hidden">
                <div
                  className="bg-accent-color h-2 rounded-full transition-all"
                  style={{ width: `${(userProfile.exp || 0) % 100}%` }}
                />
              </div>
            </Card>

            <button
              onClick={() => {
                logout();
                onNavigate(Page.Dashboard);
              }}
              className="hidden lg:flex w-full px-4 py-3 rounded-xl bg-red-500/10 text-red-500 font-bold text-sm hover:bg-red-500/20 transition items-center justify-center gap-2"
            >
              <LogOut size={16} />
              {t('Deconectare')}
            </button>
          </div>

          {/* ── CONTENT: Settings sections ── */}
          <div className="space-y-5 min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* Identity */}
              <SectionCard icon={User} title={t('Date Personale')}>
                <div className="space-y-5">
                  <form onSubmit={handleSaveName} className="space-y-2.5">
                    <label className="block text-[11px] font-black text-text-secondary uppercase tracking-wide">
                      {t('Cum te cheamă?')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={t('Exemplu: Ion Popescu')}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className={`flex-1 min-w-0 ${inputCls}`}
                      />
                      <button
                        type="submit"
                        disabled={isSavingName || !displayName.trim()}
                        className={primaryBtnCls}
                      >
                        {isSavingName ? <Loader2 size={16} className="animate-spin" /> : t('Salvează')}
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2.5">
                    <label className="block text-[11px] font-black text-text-secondary uppercase tracking-wide">
                      Email
                    </label>
                    <div className="flex items-center justify-between gap-3 bg-bg-main border border-border-color rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <Mail size={16} className="text-accent-color shrink-0" />
                        <span className="font-medium text-sm text-main truncate">{userProfile.email}</span>
                      </div>
                      <Pill tone="success" icon={CheckCircle}>{t('Verificat')}</Pill>
                    </div>
                  </div>

                  <form onSubmit={handleSavePhone} className="space-y-2.5">
                    <label className="block text-[11px] font-black text-text-secondary uppercase tracking-wide">
                      {t('Telefon')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        placeholder="+40 7XX XXX XXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={`flex-1 min-w-0 ${inputCls}`}
                      />
                      <button
                        type="submit"
                        disabled={isSavingPhone}
                        className={primaryBtnCls}
                      >
                        {isSavingPhone ? <Loader2 size={16} className="animate-spin" /> : t('Salvează')}
                      </button>
                    </div>
                    <p className="text-[11px] text-text-secondary font-medium">
                      {t('Folosit pentru mesaje WhatsApp (ex: „e timpul să uzi", „tunde gazonul")')}
                    </p>
                  </form>
                </div>
              </SectionCard>

              {/* Security */}
              <SectionCard icon={Lock} title={t('Securitate')}>
                <form onSubmit={handleChangePassword} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-black text-text-secondary uppercase tracking-wide mb-2">
                      {t('Parola curentă')}
                    </label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-text-secondary uppercase tracking-wide mb-2">
                      {t('Parola nouă')}
                    </label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-text-secondary uppercase tracking-wide mb-2">
                      {t('Confirmă parola nouă')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        className={`flex-1 min-w-0 ${inputCls}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(v => !v)}
                        className="p-3 rounded-xl bg-bg-main border border-border-color hover:border-accent-color/30 transition text-text-secondary shrink-0"
                        title={showPasswords ? t('Ascunde') : t('Arată')}
                      >
                        {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingPassword}
                    className={`w-full ${primaryBtnCls}`}
                  >
                    {isSavingPassword ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    {t('Schimbă Parola')}
                  </button>
                </form>
              </SectionCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* Preferences */}
              <SectionCard icon={Globe} title={t('Preferințe')}>
                <label className="block text-[11px] font-black text-text-secondary uppercase tracking-wide mb-2">
                  {t('Limbă')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChangeLanguage('ro')}
                    className={`py-3 px-4 rounded-xl font-bold text-sm transition ${
                      currentLang === 'ro'
                        ? 'bg-accent-color text-accent-text'
                        : 'bg-bg-main border border-border-color text-main hover:border-accent-color/30'
                    }`}
                  >
                    🇷🇴 Română
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeLanguage('en')}
                    className={`py-3 px-4 rounded-xl font-bold text-sm transition ${
                      currentLang === 'en'
                        ? 'bg-accent-color text-accent-text'
                        : 'bg-bg-main border border-border-color text-main hover:border-accent-color/30'
                    }`}
                  >
                    🇬🇧 English
                  </button>
                </div>
              </SectionCard>

              {/* Gift code */}
              <SectionCard icon={Gift} title={t('Cod Cadou')}>
                <p className="text-sm text-text-secondary font-medium mb-4">
                  {t('Ai un cod cadou? Activează-l aici pentru a primi Pro gratis!')}
                </p>
                <form onSubmit={handleRedeemGiftCode} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('Introdu codul cadou...')}
                    value={giftCode}
                    onChange={(e) => setGiftCode(e.target.value)}
                    className={`flex-1 min-w-0 ${inputCls}`}
                    maxLength={50}
                  />
                  <button
                    type="submit"
                    disabled={isRedeeming || !giftCode.trim()}
                    className={primaryBtnCls}
                  >
                    {isRedeeming ? <Loader2 size={16} className="animate-spin" /> : t('Activează')}
                  </button>
                </form>
              </SectionCard>
            </div>

            {/* Referral */}
            {referralCode && (
              <Card padding="lg" className="border-accent-color/20 bg-accent-color/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-accent-color/10 flex items-center justify-center shrink-0">
                    <Share2 size={18} className="text-accent-color" />
                  </div>
                  <h2 className="text-lg font-black text-main">{t('Recomandă & Câștigă')}</h2>
                </div>
                <p className="text-sm text-text-secondary font-medium mb-4">
                  {t('Trimite link-ul tău și ambii primiți +7 zile PRO gratuit!')}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/?ref=${referralCode}`}
                    className={`flex-1 min-w-0 ${inputCls} font-mono select-all`}
                  />
                  <button
                    onClick={handleCopyReferralLink}
                    className={primaryBtnCls}
                  >
                    <Copy size={16} />
                    {t('Copiază')}
                  </button>
                </div>
              </Card>
            )}

            {/* Activity management */}
            <SectionCard icon={Sprout} title={t('Activități Grădină')}>
              <ActivityManagement
                userId={userProfile.uid}
                organizationId={userProfile.organizationId || 'default'}
              />
            </SectionCard>

            {/* Data & logout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleExportData}
                className="px-6 py-3 rounded-xl bg-bg-card border border-border-color text-main font-bold text-sm hover:border-accent-color/30 transition flex items-center justify-center gap-2"
              >
                <Download size={16} />
                {t('Export Date')}
              </button>
              <button
                onClick={() => {
                  logout();
                  onNavigate(Page.Dashboard);
                }}
                className="lg:hidden px-6 py-3 rounded-xl bg-red-500/10 text-red-500 font-bold text-sm hover:bg-red-500/20 transition flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                {t('Deconectare')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
