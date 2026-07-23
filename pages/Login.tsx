
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc, 
  collection, 
  serverTimestamp,
  logout,
  query,
  where,
  getDocs,
  updateDoc,
  Timestamp
} from '../services/firebase';
import { Eye, EyeOff, Loader2, Lock, Mail, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserProfile } from '../src/types';
import { APP_VARIANT, isHomeownerApp } from '../src/config/appVariant';

const toBase64 = (str: string) => {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    return btoa(str);
  }
};

const fromBase64 = (str: string) => {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch (e) {
    return atob(str);
  }
};

interface Props {
  onOnboarded: (profile: UserProfile) => void;
}

const Login: React.FC<Props> = ({ onOnboarded }) => {
  const { t } = useTranslation();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firmName, setFirmName] = useState('');
  // My Garden is homeowner-only, so new accounts are always PF (see src/config/appVariant).
  const [accountType, setAccountType] = useState<'PF' | 'PJ'>(APP_VARIANT);
  const [rememberMe, setRememberMe] = useState(true);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isAlreadyLoggedIn, setIsAlreadyLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [inviteData, setInviteData] = useState<{ organizationId: string; role: string; code: string } | null>(null);
  
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  // Captured once on mount, before any hash-routing navigation could strip
  // the query string — used to attribute a new signup to whoever shared the link.
  const referredByRef = useRef<string | null>(new URLSearchParams(window.location.search).get('ref'));

  const attemptServerRecovery = async (firebaseUser: { getIdToken: () => Promise<string> }) => {
    try {
      setStatusMsg(t("Looking for previous account..."));
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/recover-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (data.recovered && data.profile && data.profile.organizationId) {
        onOnboarded(data.profile);
        return true;
      }
    } catch (e) {
      console.error("Server recovery failed", e);
    }
    return false;
  };

  useEffect(() => {
    const savedEmail = localStorage.getItem('ls_email');
    const remember = localStorage.getItem('ls_remember') !== 'false';

    setRememberMe(remember);
    if (remember && savedEmail) {
      setEmail(savedEmail);
    }

    const handleHashCheck = () => {
      const params = new URLSearchParams(window.location.hash.split('?')[1]);
      const inviteCode = params.get('invite');
      if (inviteCode) {
        checkInvite(inviteCode);
      }
    };

    handleHashCheck();
    window.addEventListener('hashchange', handleHashCheck);
    return () => window.removeEventListener('hashchange', handleHashCheck);
  }, []);

  const checkInvite = async (code: string) => {
    if (!code) return;
    setLoading(true);
    setStatusMsg(t("Checking invitation..."));
    try {
      const res = await fetch(`/api/invite-lookup?code=${encodeURIComponent(code)}`);

      if (res.ok) {
        const data = await res.json();

        // Check status in JS
        if (data.status === 'accepted') {
          setError(t("Invitation already used."));
          return;
        }

        setInviteData({
          organizationId: data.organizationId,
          role: data.role,
          code: code
        });
        setEmail(data.email);
        setIsRegister(true);
        setStatusMsg(t("Valid invitation detected! Create your account."));
      } else {
        setError(t("Invitation is invalid or expired."));
      }
    } catch (err: any) {
      console.error("Invite check error:", err);
      setError(t("Error checking invitation."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        console.log("Auth state changed: user is logged in", user.uid);
        setIsAlreadyLoggedIn(true);
        setStatusMsg(t("Active session detected. Checking profile..."));

        try {
          const snap = await getDocFromServer(doc(db, 'users', user.uid));
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            console.log("Profile found in auth state:", data);
            if (data.organizationId) {
              onOnboarded(data);
            } else {
              console.log("Profile missing organizationId in auth state, attempting recovery");
              const recovered = await attemptServerRecovery(user);
              if (!recovered) {
                setStatusMsg("Cont detectat. Finalizează configurarea firmei.");
                setIsRegister(true);
              }
            }
          } else {
            console.log("Profile not found in auth state, checking organizations for adminUid:", user.uid);
            // Recovery logic: check if they own an organization
            const orgsQuery = query(collection(db, 'organizations'), where('adminUid', '==', user.uid));
            const orgsSnap = await getDocs(orgsQuery);
            console.log("Organizations found in auth state:", orgsSnap.size);
            if (!orgsSnap.empty) {
              const orgId = orgsSnap.docs[0].id;
              console.log("Found organization in auth state:", orgId);
              const profile: UserProfile = {
                uid: user.uid,
                email: user.email || '',
                organizationId: orgId,
                role: 'admin',
                theme: 'dark'
              };
              await setDoc(doc(db, 'users', user.uid), profile);
              onOnboarded(profile);
            } else {
              console.log("No organization found in auth state, attempting server recovery");
              const recovered = await attemptServerRecovery(user);
              if (!recovered) {
                setStatusMsg("Cont detectat. Finalizează configurarea firmei.");
                setIsRegister(true); 
              }
            }
          }
        } catch (e) {
          console.error("Firestore error:", e);
          setIsRegister(true);
          setStatusMsg("Eroare la verificarea profilului.");
        }
        setCheckingAuth(false);
      } else {
        // Auto-login fallback if session was lost (e.g. iframe restrictions)
        const savedEmail = localStorage.getItem('ls_email');
        const remember = localStorage.getItem('ls_remember') !== 'false';
        
        // Firebase Auth manages session persistence natively
        // No need to store/restore passwords
        setCheckingAuth(false);
        setCheckingAuth(false);
      }
    });
    return unsub;
  }, []);

  const saveCredentials = () => {
    // Only save email for convenience - NEVER store passwords
    localStorage.removeItem('ls_pass'); // Clean up legacy storage
    if (rememberMe) {
      localStorage.setItem('ls_email', email.trim().toLowerCase());
      localStorage.setItem('ls_remember', 'true');
    } else {
      localStorage.removeItem('ls_email');
      localStorage.setItem('ls_remember', 'false');
    }
  };

  const completeOnboarding = async (uid: string, userEmail: string) => {
    if (!inviteData && !firmName.trim() && accountType === 'PJ') {
      setError("Introdu numele firmei pentru a finaliza setup-ul.");
      return;
    }
    
    setLoading(true);
    setStatusMsg(inviteData ? t("Finalizing invitation...") : t("Configuring company..."));
    try {
      let orgId = inviteData?.organizationId;

      if (!orgId) {
        const orgRef = doc(collection(db, 'organizations'));
        orgId = orgRef.id;

        const orgName = accountType === 'PF' ? (firmName || t('My Garden')) : firmName;
        
        // Calculate 14 days PRO trial
        const trialExpires = new Date();
        trialExpires.setDate(trialExpires.getDate() + 14);

        await setDoc(orgRef, {
          id: orgId,
          name: orgName,
          adminUid: uid,
          createdAt: serverTimestamp(),
          // Legacy fields for backward compatibility
          licenseType: 'pro',
          plan: 'pro',
          planExpires: Timestamp.fromDate(trialExpires),
          // New tier logic
          subscriptionTier: 'pro',
          trialExpiresAt: Timestamp.fromDate(trialExpires)
        });
      }

      const profile: UserProfile = {
        uid,
        email: userEmail.toLowerCase(),
        organizationId: orgId,
        role: (inviteData?.role as any) || 'admin',
        theme: 'dark',
        accountType: accountType,
        ...(referredByRef.current ? { referredBy: referredByRef.current } : {})
      };

      await setDoc(doc(db, 'users', uid), profile);

      // Mark invitation as accepted
      if (inviteData) {
        const q = query(collection(db, 'invitations'), where('code', '==', inviteData.code));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(snap.docs[0].ref, { status: 'accepted' });
        }
      }

      saveCredentials();
      onOnboarded(profile);
    } catch (err: any) {
      setError("Eroare: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedEmail = email.trim().toLowerCase();

    try {
      if (auth.currentUser) {
        await completeOnboarding(auth.currentUser.uid, auth.currentUser.email || trimmedEmail);
        return;
      }
    } catch (err: any) {
      setError(t("Error finalizing setup") + ": " + err.message);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await completeOnboarding(cred.user.uid, trimmedEmail);
      } else {
        const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        console.log("Login successful, uid:", cred.user.uid);
        saveCredentials();
        const profileSnap = await getDocFromServer(doc(db, 'users', cred.user.uid));
        if (profileSnap.exists()) {
          const data = profileSnap.data() as UserProfile;
          console.log("Profile found:", data);
          if (data.organizationId) {
            onOnboarded(data);
          } else {
            console.log("Profile missing organizationId, attempting recovery");
            const recovered = await attemptServerRecovery(cred.user);
            if (!recovered) {
              setIsRegister(true);
              setStatusMsg("Autentificare reușită. Introdu numele firmei.");
            }
          }
        } else {
          console.log("Profile not found, checking organizations for adminUid:", cred.user.uid);
          // Recovery logic
          const orgsQuery = query(collection(db, 'organizations'), where('adminUid', '==', cred.user.uid));
          const orgsSnap = await getDocs(orgsQuery);
          console.log("Organizations found:", orgsSnap.size);
          if (!orgsSnap.empty) {
            const orgId = orgsSnap.docs[0].id;
            console.log("Found organization:", orgId);
            const profile: UserProfile = {
              uid: cred.user.uid,
              email: cred.user.email || trimmedEmail,
              organizationId: orgId,
              role: 'admin',
              theme: 'dark'
            };
            await setDoc(doc(db, 'users', cred.user.uid), profile);
            onOnboarded(profile);
          } else {
            console.log("No organization found, attempting server recovery");
            const recovered = await attemptServerRecovery(cred.user);
            if (!recovered) {
              setIsRegister(true);
              setStatusMsg("Autentificare reușită. Introdu numele firmei.");
            }
          }
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError(t("Email already in use. Try logging in."));
        setIsRegister(false);
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError(t("Incorrect email or password."));
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForceLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Error during logout:", error);
    }
    window.location.reload();
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-accent-color rounded-md"></div>
          <div className="h-2 w-32 bg-accent-color/20 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg-main relative overflow-hidden text-main">
      <div className="stihl-card w-full max-w-md rounded-2xl p-10 relative z-10 shadow-xl animate-in fade-in zoom-in duration-500 bg-bg-card border border-border-color">
        <div className="flex flex-col items-center mb-10 text-center">
          <img src="/logo.png" alt="My Garden Logo" className="w-24 h-24 object-contain mb-2 drop-shadow-md" />
          <div className="flex flex-col items-center">
            <h1 className="text-4xl tracking-tighter mb-0 leading-none" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700 }}>
              <span style={{ color: 'var(--accent-color)' }}>my</span>
              <span style={{ color: '#4F7942' }}> garden</span>
            </h1>
            <span className="text-[10px] font-black tracking-[0.2em] uppercase opacity-80 mt-2 mb-4 text-center leading-tight" style={{ color: 'var(--brand-olive)' }}>
              Your garden,<br/>smartly cared for
            </span>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-md flex items-center gap-3 font-bold">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {statusMsg && !error && (
            <div className="p-4 bg-accent-color/10 border border-accent-color/20 text-accent-color text-xs rounded-md flex items-center gap-3 font-bold animate-pulse">
              <Loader2 size={16} className="animate-spin shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {(!isAlreadyLoggedIn || loading) ? (
            <>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-2">
                  <Mail size={10} />
                  {t('User Email')}
                </label>
                <input 
                  type="email" 
                  name="email"
                  autoComplete="username"
                  required 
                  className="w-full bg-bg-main rounded-md px-4 py-3 outline-none text-main font-bold border border-border-color focus:border-accent-color transition-all" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-2">
                  <Lock size={10} />
                  {t('Password')}
                </label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="password"
                    autoComplete="current-password"
                    required 
                    className="w-full bg-bg-main rounded-md px-4 py-3 outline-none text-main font-bold border border-border-color focus:border-accent-color transition-all pr-12" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent-color transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 px-1">
                <input 
                  type="checkbox" 
                  id="remember"
                  className="w-4 h-4 rounded border-border-color bg-bg-main text-accent-color focus:ring-accent-color"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                />
                <label htmlFor="remember" className="text-[11px] font-bold text-text-secondary uppercase tracking-wider cursor-pointer select-none">{t('Remember me')}</label>
              </div>
            </>
          ) : null}

          {/* Account-type selector is hidden in the homeowner app — every account is PF. */}
          {isRegister && !inviteData && !isHomeownerApp && (
            <div className="space-y-4 animate-in slide-in-from-top-4 duration-500 pt-2 border-t border-border-color">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1">
                {t('Account Type')}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAccountType('PJ')}
                  className={`flex-1 py-3 rounded-md text-[11px] font-black uppercase tracking-widest border transition-all ${accountType === 'PJ' ? 'bg-accent-color text-white border-accent-color' : 'bg-bg-main text-text-secondary border-border-color'}`}
                >
                  {t('Company (PJ)')}
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('PF')}
                  className={`flex-1 py-3 rounded-md text-[11px] font-black uppercase tracking-widest border transition-all ${accountType === 'PF' ? 'bg-accent-color text-white border-accent-color' : 'bg-bg-main text-text-secondary border-border-color'}`}
                >
                  {t('Individual (PF)')}
                </button>
              </div>
            </div>
          )}

          {(isRegister || (isAlreadyLoggedIn && !statusMsg.includes("Se verifică"))) && !inviteData && accountType === 'PJ' && (
            <div className="space-y-2 animate-in slide-in-from-top-4 duration-500 pt-2 border-t border-border-color">
              <label className="text-[11px] font-bold text-accent-color uppercase tracking-wider ml-1 flex items-center gap-2">
                <Building2 size={10} />
                {t('Company Name')}
              </label>
              <input 
                type="text" 
                required
                className="w-full bg-bg-main rounded-md px-4 py-3 outline-none text-main font-black border border-accent-color focus:ring-1 focus:ring-accent-color transition-all shadow-sm" 
                value={firmName} 
                onChange={e => setFirmName(e.target.value)} 
                placeholder="Ex: Landscape Design SRL" 
                autoFocus
              />
            </div>
          )}

          <div className="pt-4 space-y-4">
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full stihl-button py-4 rounded-md font-bold uppercase tracking-wider text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 text-white"
            >
              {loading ? t('Processing...') : isAlreadyLoggedIn ? t('Finalize Setup') : isRegister ? t('Create Account') : t('Authorize Access')}
            </button>

            {statusMsg && (
              <p className="text-[11px] text-center font-bold text-accent-color uppercase tracking-wider mt-4">
                {statusMsg}
              </p>
            )}

            {!isAlreadyLoggedIn ? (
              <div className="flex flex-col gap-2 pt-4 text-center">
                <button type="button" onClick={() => { setIsRegister(!isRegister); setError(''); }} className="text-[11px] font-bold text-text-secondary uppercase tracking-wider hover:text-main transition-colors py-2">
                  {isRegister ? t('Already have an account? Login') : (isHomeownerApp ? t('New here? Create account') : t('New company? Register'))}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-4 text-center">
                <button type="button" onClick={handleForceLogout} className="text-[11px] font-bold text-red-500 uppercase tracking-wider hover:underline">
                  {t('Not you? Logout')}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
