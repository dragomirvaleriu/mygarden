
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
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
  Timestamp,
  isPersistenceError,
  recoverFromPersistenceError
} from '../services/firebase';
import { Eye, EyeOff, Loader2, Lock, Mail, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserProfile } from '../src/types';

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

// Set when a write dies on a broken IndexedDB cache: the page reloads into
// memory-cache mode and picks the setup back up where it left off. The name
// rides along since it only lives in component state and would otherwise be
// lost across the reload.
const RESUME_SETUP_KEY = 'mg_resume_setup';
const RESUME_NAME_KEY = 'mg_resume_setup_name';

const MIN_PASSWORD_LENGTH = 6;

interface Props {
  onOnboarded: (profile: UserProfile) => void;
}

const Login: React.FC<Props> = ({ onOnboarded }) => {
  const { t } = useTranslation();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isAlreadyLoggedIn, setIsAlreadyLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [inviteData, setInviteData] = useState<{ organizationId: string; role: string; code: string } | null>(null);

  // Multi-step signup flow
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1); // 1: email/pass, 2: name/phone, 3: plans preview

  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  // Captured once on mount, before any hash-routing navigation could strip
  // the query string — used to attribute a new signup to whoever shared the link.
  const referredByRef = useRef<string | null>(new URLSearchParams(window.location.search).get('ref'));
  // The auth listener and a manual submit both resolve the profile. Without
  // this guard they can race and create two organizations for one account.
  const busyRef = useRef(false);
  const onboardedRef = useRef(false);

  const finishOnboarding = (profile: UserProfile) => {
    if (onboardedRef.current) return;
    onboardedRef.current = true;
    onOnboarded(profile);
  };

  /**
   * Server-first, cache-fallback profile read. A forced server read alone
   * turns a flaky mobile connection into "profile not found", which used to
   * push returning users into the registration form.
   */
  const readProfile = async (uid: string) => {
    try {
      return await getDocFromServer(doc(db, 'users', uid));
    } catch (e) {
      console.warn("Profile server read failed, falling back to cache", e);
      return await getDoc(doc(db, 'users', uid));
    }
  };

  const describeError = (err: any): string => {
    if (isPersistenceError(err)) {
      return t("Your browser blocked local storage. Reload the page and try again, or close some tabs.");
    }
    switch (err?.code) {
      case 'auth/email-already-in-use':
        return t("Email already in use. Try logging in.");
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return t("Incorrect email or password.");
      case 'auth/invalid-email':
        return t("That email address is not valid.");
      case 'auth/weak-password':
        return t("Password must be at least 6 characters.");
      case 'auth/too-many-requests':
        return t("Too many attempts. Please try again in a few minutes.");
      case 'auth/network-request-failed':
        return t("Connection problem. Check your internet and try again.");
      case 'auth/user-disabled':
        return t("This account has been disabled.");
      default:
        return err?.message || t("Something went wrong. Please try again.");
    }
  };

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
      // This endpoint only exists on the local express server; on the hosted
      // build it 404s to the SPA shell. Parsing that as JSON throws and buries
      // the real flow in noise, so bail out quietly instead.
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
        return false;
      }
      const data = await res.json();
      if (data.recovered && data.profile && data.profile.organizationId) {
        finishOnboarding(data.profile);
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

      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
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

  /**
   * The account exists in Auth but has no usable profile yet. Normally we ask
   * the user to press "Finalize setup"; if we got here right after recovering
   * from a broken local cache, carry on by ourselves so the reload is invisible.
   */
  const promptOrResumeSetup = async (user: { uid: string; email: string | null }) => {
    setIsRegister(true);

    let resumeName: string | null = null;
    try {
      if (sessionStorage.getItem(RESUME_SETUP_KEY) === '1') {
        resumeName = sessionStorage.getItem(RESUME_NAME_KEY) || '';
        sessionStorage.removeItem(RESUME_SETUP_KEY);
        sessionStorage.removeItem(RESUME_NAME_KEY);
      }
    } catch { /* no session storage — fall through to the manual prompt */ }

    // My Garden accounts need only a name, so an interrupted setup can finish
    // on its own — unless the name itself didn't survive the reload, in which
    // case we still need the person to type it.
    if (resumeName) {
      setName(resumeName);
      await completeOnboarding(user.uid, user.email || '', resumeName);
      return;
    }

    setStatusMsg(t("Account detected. Finish setting up your garden."));
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        console.log("Auth state changed: user is logged in", user.uid);
        setIsAlreadyLoggedIn(true);

        // A manual login/registration is already resolving this same user —
        // let it finish rather than racing it.
        if (busyRef.current) {
          setCheckingAuth(false);
          return;
        }

        setStatusMsg(t("Active session detected. Checking profile..."));

        try {
          const snap = await readProfile(user.uid);
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            console.log("Profile found in auth state:", data);
            if (data.organizationId) {
              finishOnboarding(data);
            } else {
              console.log("Profile missing organizationId in auth state, attempting recovery");
              const recovered = await attemptServerRecovery(user);
              if (!recovered) await promptOrResumeSetup(user);
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
              finishOnboarding(profile);
            } else {
              console.log("No organization found in auth state, attempting server recovery");
              const recovered = await attemptServerRecovery(user);
              if (!recovered) await promptOrResumeSetup(user);
            }
          }
        } catch (e) {
          console.error("Firestore error:", e);
          setStatusMsg('');
          setError(describeError(e));
          // Keep the "Finalize setup" button available so the check can be
          // retried; don't strand them on a dead screen.
        }
        setCheckingAuth(false);
      } else {
        // Signed out. Firebase Auth restores the session by itself, so there
        // is nothing to recover here — just show the form.
        setIsAlreadyLoggedIn(false);
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

  const completeOnboarding = async (uid: string, userEmail: string, nameOverride?: string) => {
    const trimmedName = (nameOverride ?? name).trim();
    if (!trimmedName) {
      setError(t("Enter your name to finish setup."));
      return;
    }

    busyRef.current = true;
    setError('');
    setLoading(true);
    setStatusMsg(inviteData ? t("Finalizing invitation...") : t("Setting up your garden..."));
    try {
      let orgId = inviteData?.organizationId;

      if (!orgId) {
        // An earlier attempt may have created the organization and then failed
        // on the profile write. Reuse it instead of leaving orphans behind and
        // handing the user a second, empty garden.
        const existing = await getDocs(query(collection(db, 'organizations'), where('adminUid', '==', uid)));
        if (!existing.empty) orgId = existing.docs[0].id;
      }

      if (!orgId) {
        const orgRef = doc(collection(db, 'organizations'));
        orgId = orgRef.id;

        // My Garden is homeowner-only: every account gets a personal garden,
        // never a company. Named after them since it's the only thing shown
        // next to the dashboard date.
        const orgName = `Grădina lui ${trimmedName}`;

        await setDoc(orgRef, {
          id: orgId,
          name: orgName,
          adminUid: uid,
          createdAt: serverTimestamp()
        });
      }

      const profile: UserProfile = {
        uid,
        email: userEmail.toLowerCase(),
        organizationId: orgId,
        role: (inviteData?.role as any) || 'admin',
        theme: 'dark',
        displayName: trimmedName,
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
      finishOnboarding(profile);
    } catch (err: any) {
      console.error("Onboarding failed:", err);

      // The local cache died mid-write (the classic iOS Safari
      // IndexedDbTransactionError). Switch that off and reload: the org we may
      // have already created is picked up again above, so this is a clean retry.
      if (isPersistenceError(err) && recoverFromPersistenceError()) {
        try {
          sessionStorage.setItem(RESUME_SETUP_KEY, '1');
          sessionStorage.setItem(RESUME_NAME_KEY, trimmedName);
        } catch { /* best effort */ }
        setStatusMsg(t("Optimizing for your device..."));
        window.location.reload();
        return;
      }

      setStatusMsg('');
      setError(describeError(err));
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  const handleSignupStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setInfo('');

    if (isRegister) {
      // Step 1: Email & Password validation
      if (signupStep === 1) {
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail || !password) {
          setError(t("Enter your email and password."));
          return;
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
          setError(t("Password must be at least 6 characters."));
          return;
        }
        if (password !== confirmPassword) {
          setError(t("The passwords do not match."));
          return;
        }
        setSignupStep(2);
        return;
      }

      // Step 2: Name validation
      if (signupStep === 2) {
        if (!name.trim()) {
          setError(t("Please enter your name."));
          return;
        }
        setSignupStep(3);
        return;
      }

      // Step 3: Create account & onboard
      if (signupStep === 3) {
        busyRef.current = true;
        setLoading(true);
        try {
          const trimmedEmail = email.trim().toLowerCase();
          const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
          await completeOnboarding(cred.user.uid, trimmedEmail);
        } catch (err: any) {
          console.error("Auth failed:", err);
          setStatusMsg('');

          if (isPersistenceError(err) && recoverFromPersistenceError()) {
            try {
              sessionStorage.setItem(RESUME_SETUP_KEY, '1');
              sessionStorage.setItem(RESUME_NAME_KEY, name.trim());
            } catch { /* best effort */ }
            setStatusMsg(t("Optimizing for your device..."));
            window.location.reload();
            return;
          }

          if (err.code === 'auth/email-already-in-use') {
            setIsRegister(false);
            setConfirmPassword('');
            setSignupStep(1);
          }
          setError(describeError(err));
        } finally {
          busyRef.current = false;
          setLoading(false);
        }
      }
    } else {
      // Login flow
      const trimmedEmail = email.trim().toLowerCase();

      if (auth.currentUser) {
        await completeOnboarding(auth.currentUser.uid, auth.currentUser.email || trimmedEmail);
        return;
      }

      if (!trimmedEmail || !password) {
        setError(t("Enter your email and password."));
        return;
      }

      busyRef.current = true;
      setLoading(true);
      try {
        const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        console.log("Login successful, uid:", cred.user.uid);
        saveCredentials();
        setStatusMsg(t("Active session detected. Checking profile..."));
        const profileSnap = await readProfile(cred.user.uid);
        if (profileSnap.exists()) {
          const data = profileSnap.data() as UserProfile;
          console.log("Profile found:", data);
          if (data.organizationId) {
            finishOnboarding(data);
          } else {
            console.log("Profile missing organizationId, attempting recovery");
            const recovered = await attemptServerRecovery(cred.user);
            if (!recovered) await promptOrResumeSetup(cred.user);
          }
        } else {
          console.log("Profile not found, checking organizations for adminUid:", cred.user.uid);
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
            finishOnboarding(profile);
          } else {
            console.log("No organization found, attempting server recovery");
            const recovered = await attemptServerRecovery(cred.user);
            if (!recovered) await promptOrResumeSetup(cred.user);
          }
        }
      } catch (err: any) {
        console.error("Auth failed:", err);
        setStatusMsg('');

        if (isPersistenceError(err) && recoverFromPersistenceError()) {
          try {
            sessionStorage.setItem(RESUME_SETUP_KEY, '1');
          } catch { /* best effort */ }
          setStatusMsg(t("Optimizing for your device..."));
          window.location.reload();
          return;
        }

        if (err.code === 'auth/email-already-in-use') {
          setIsRegister(false);
          setConfirmPassword('');
        }
        setError(describeError(err));
      } finally {
        busyRef.current = false;
        setLoading(false);
      }
    }
  };

  const handlePasswordReset = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    setError('');
    setInfo('');
    if (!trimmedEmail) {
      setError(t("Enter your email address first, then tap 'Forgot password?'."));
      emailRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      // Deliberately the same message whether or not the account exists, so
      // this can't be used to probe which emails are registered.
      setInfo(t("If an account exists for this address, a reset link is on its way. Check your spam folder too."));
    } catch (err: any) {
      console.error("Password reset failed:", err);
      if (err?.code === 'auth/user-not-found') {
        setInfo(t("If an account exists for this address, a reset link is on its way. Check your spam folder too."));
      } else {
        setError(describeError(err));
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

        <form onSubmit={handleSignupStep} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-md flex items-center gap-3 font-bold">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {info && !error && (
            <div className="p-4 bg-accent-subtle dark:bg-accent-subtle border border-accent-border dark:border-accent-border text-accent-ink dark:text-accent-ink text-xs rounded-md flex items-center gap-3 font-bold">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{info}</span>
            </div>
          )}

          {statusMsg && !error && !info && (
            <div className="p-4 bg-accent-color/10 border border-accent-color/20 text-accent-color text-xs rounded-md flex items-center gap-3 font-bold animate-pulse">
              <Loader2 size={16} className="animate-spin shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {(!isAlreadyLoggedIn || loading) ? (
            <>
              {/* STEP 1: Email & Password (Signup) or Email & Password (Login) */}
              {!isRegister || signupStep === 1 ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-2">
                      <Mail size={10} />
                      {t('User Email')}
                    </label>
                    <input
                      ref={emailRef}
                      type="email"
                      name="email"
                      autoComplete="username"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
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
                        ref={passRef}
                        type={showPassword ? "text" : "password"}
                        name="password"
                        autoComplete={isRegister ? "new-password" : "current-password"}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        required
                        minLength={isRegister ? MIN_PASSWORD_LENGTH : undefined}
                        className="w-full bg-bg-main rounded-md px-4 py-3 outline-none text-main font-bold border border-border-color focus:border-accent-color transition-all pr-12"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? t('Hide password') : t('Show password')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent-color transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {isRegister && (
                      <p className="text-[10px] font-bold text-text-secondary ml-1 pt-1">
                        {t("At least 6 characters.")}
                      </p>
                    )}
                  </div>

                  {isRegister && signupStep === 1 && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-2">
                        <Lock size={10} />
                        {t('Confirm Password')}
                      </label>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="confirmPassword"
                        autoComplete="new-password"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        required
                        className="w-full bg-bg-main rounded-md px-4 py-3 outline-none text-main font-bold border border-border-color focus:border-accent-color transition-all"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  )}

                  {!isRegister && (
                    <div className="flex items-center justify-between gap-3 px-1">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="remember"
                          className="w-4 h-4 rounded border-border-color bg-bg-main text-accent-color focus:ring-accent-color"
                          checked={rememberMe}
                          onChange={e => setRememberMe(e.target.checked)}
                        />
                        <label htmlFor="remember" className="text-[11px] font-bold text-text-secondary uppercase tracking-wider cursor-pointer select-none">{t('Remember me')}</label>
                      </div>

                      <button
                        type="button"
                        onClick={handlePasswordReset}
                        disabled={loading}
                        className="text-[11px] font-bold text-accent-color uppercase tracking-wider hover:underline disabled:opacity-50"
                      >
                        {t('Forgot password?')}
                      </button>
                    </div>
                  )}
                </>
              ) : null}

              {/* STEP 2: Name (Signup only) */}
              {isRegister && signupStep === 2 && (
                <div className="space-y-2 animate-in slide-in-from-top-4 duration-500 border-t border-border-color pt-4">
                  <label className="text-[11px] font-bold text-accent-color uppercase tracking-wider ml-1 flex items-center gap-2">
                    <User size={10} />
                    {t('Your Name')}
                  </label>
                  <input
                    type="text"
                    autoComplete="name"
                    required
                    className="w-full bg-bg-main rounded-md px-4 py-3 outline-none text-main font-black border border-accent-color focus:ring-1 focus:ring-accent-color transition-all shadow-sm"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('Ex: Ion, Maria...')}
                    autoFocus
                  />
                </div>
              )}

              {/* STEP 3: Plan Preview (Signup only) */}
              {isRegister && signupStep === 3 && (
                <div className="space-y-3 animate-in slide-in-from-top-4 duration-500 border-t border-border-color pt-4">
                  <div className="text-center mb-4">
                    <h3 className="text-sm font-black text-accent-color mb-1">Alege planul tău</h3>
                    <p className="text-[10px] font-bold text-text-secondary">Poți schimba oricând după creare</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-lg border-2 border-accent-border bg-accent-subtle">
                      <div className="text-2xl mb-2">🌱</div>
                      <p className="text-xs font-black text-main mb-1">FREE</p>
                      <p className="text-[9px] font-bold text-text-secondary">Pân la 3 proprietăți</p>
                    </div>
                    <div className="p-4 rounded-lg border-2 border-amber-500/30 bg-amber-500/5">
                      <div className="text-2xl mb-2">👑</div>
                      <p className="text-xs font-black text-main mb-1">PRO</p>
                      <p className="text-[9px] font-bold text-text-secondary">Ilimitat + Premium</p>
                    </div>
                  </div>

                  <p className="text-[9px] font-bold text-text-secondary text-center pt-2">
                    Poți trece la PRO oricând din Academie
                  </p>
                </div>
              )}
            </>
          ) : null}

          <div className="pt-4 space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full stihl-button py-4 rounded-md font-bold uppercase tracking-wider text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 text-white"
            >
              {loading ? t('Processing...') : isAlreadyLoggedIn ? t('Finalize Setup') : isRegister ? (signupStep === 1 || signupStep === 2 ? t('Continuă') : t('Create Account')) : t('Authorize Access')}
            </button>

            {statusMsg && (
              <p className="text-[11px] text-center font-bold text-accent-color uppercase tracking-wider mt-4">
                {statusMsg}
              </p>
            )}

            {!isAlreadyLoggedIn ? (
              <div className="flex flex-col gap-2 pt-4 text-center">
                {isRegister && signupStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setSignupStep((signupStep - 1) as 1 | 2 | 3)}
                    className="text-[11px] font-bold text-text-secondary uppercase tracking-wider hover:text-main transition-colors py-2"
                  >
                    ← {t('Înapoi')}
                  </button>
                )}
                {!(isRegister && signupStep > 1) && (
                  <button
                    type="button"
                    onClick={() => { setIsRegister(!isRegister); setError(''); setInfo(''); setStatusMsg(''); setConfirmPassword(''); setSignupStep(1); }}
                    className="text-[11px] font-bold text-text-secondary uppercase tracking-wider hover:text-main transition-colors py-2"
                  >
                    {isRegister ? t('Already have an account? Login') : t('New here? Create account')}
                  </button>
                )}
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
