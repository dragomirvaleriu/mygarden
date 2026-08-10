
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
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
import { Eye, EyeOff, Loader2, Lock, Mail, User, CheckCircle2, AlertCircle, ShieldCheck, ArrowLeft, KeyRound, Sun, Moon } from 'lucide-react';
import { UserProfile } from '../src/types';

// Standard multi-color Google "G" mark — inline so the button doesn't need an
// external asset (and works offline in the Capacitor shell).
const GoogleIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

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
// Set once a code is verified this session, so a reload between "verified"
// and "onboarding finished" (e.g. a persistence-error recovery reload) can
// tell promptOrResumeSetup not to demand a second code.
const VERIFIED_MARKER_KEY = 'mg_email_verified_session';

const MIN_PASSWORD_LENGTH = 6;
const VERIFICATION_CODE_LENGTH = 6;

interface Props {
  onOnboarded: (profile: UserProfile) => void;
}

const Login: React.FC<Props> = ({ onOnboarded }) => {
  const { t } = useTranslation();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isAlreadyLoggedIn, setIsAlreadyLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [inviteData, setInviteData] = useState<{ organizationId: string; role: string; code: string } | null>(null);

  // Post-signup flow: 'form' is the normal Sign in / Sign up screen; 'verify'
  // is the 6-digit email-code screen shown right after account creation;
  // 'name' only appears if a reload wiped the in-memory name between
  // verifying and finishing onboarding (see promptOrResumeSetup).
  const [authStep, setAuthStep] = useState<'form' | 'verify' | 'name'>('form');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Pre-login theme: no profile/user_settings exist yet to read a saved
  // preference from, so this is its own small local override — written
  // straight to the DOM + localStorage, and read back by App.tsx's own
  // theme effect (see the `mg_theme_override` check there) so a mount-order
  // race between the two effects can't silently flip it back. Defaults to
  // dark rather than following device pointer-type, which used to make the
  // login screen flip themes depending on mobile vs. desktop with no way to
  // control it.
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('mg_theme_override') as 'light' | 'dark' | null) || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeState(next);
    try { localStorage.setItem('mg_theme_override', next); } catch { /* best effort */ }
  };

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
      // Right after sign-in, Firestore's connection can take a moment to pick
      // up the freshly-issued auth token, so the first server read often
      // fails with a transient permission error even for a valid, existing
      // user. Retry once after a short pause before falling back to cache —
      // without this, that transient failure used to surface as a scary
      // (and instantly-dismissed, since App.tsx's own listener resolves the
      // login moments later regardless) error banner on almost every login.
      console.warn("Profile server read failed, retrying once", e);
      try {
        await new Promise((r) => setTimeout(r, 400));
        return await getDocFromServer(doc(db, 'users', uid));
      } catch (e2) {
        console.warn("Profile server retry failed, falling back to cache", e2);
        return await getDoc(doc(db, 'users', uid));
      }
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
      // Reachable here only after checkProfileAndOnboard's own retries are
      // exhausted (see there) — never leak Firestore's raw "Missing or
      // insufficient permissions" string, which reads like an account
      // problem when it's actually just a slow session handoff.
      case 'permission-denied':
        return t("Couldn't verify your session just now. Please try again in a moment.");
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
   * Requests a fresh 6-digit code for the currently-signed-in Firebase user
   * and emails it via /api/auth/send-verification-code. Shared by the initial
   * signup submit, the resend button, and promptOrResumeSetup's recovery path.
   */
  const sendVerificationCode = async (firebaseUser: { getIdToken: () => Promise<string> }): Promise<boolean> => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        if (res.status === 429 && data.waitSeconds) {
          setResendCooldown(data.waitSeconds);
          setError(t('Please wait {{seconds}}s before requesting another code.', { seconds: data.waitSeconds }));
        } else {
          setError(data.error || t('Could not send verification code.'));
        }
        return false;
      }
      setResendCooldown(60);
      return true;
    } catch (e) {
      console.error('Send verification code failed', e);
      setError(t('Could not send verification code. Check your connection.'));
      return false;
    }
  };

  /**
   * The account exists in Auth but has no usable profile yet. Normally we ask
   * the user to press "Finalize setup"; if we got here right after recovering
   * from a broken local cache, carry on by ourselves so the reload is invisible.
   */
  const promptOrResumeSetup = async (user: { uid: string; email: string | null; getIdToken: () => Promise<string>; providerData?: { providerId: string }[] }) => {
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

    // A Firebase Auth account with no profile and no resume marker is either
    // a Google sign-in (pre-verified, never goes through the code screen) or
    // an email/password signup interrupted before the code was entered —
    // never one that already finished onboarding, since that always writes
    // organizationId. Re-send a code rather than trusting an unverified email.
    const isGoogleUser = user.providerData?.some(p => p.providerId === 'google.com') ?? false;
    let alreadyVerifiedThisSession = false;
    try { alreadyVerifiedThisSession = sessionStorage.getItem(VERIFIED_MARKER_KEY) === '1'; } catch { /* ignore */ }

    if (!isGoogleUser && !alreadyVerifiedThisSession) {
      setPendingEmail(user.email || '');
      setAuthStep('verify');
      setStatusMsg('');
      await sendVerificationCode(user);
      return;
    }

    setStatusMsg(t("Account detected. Finish setting up your garden."));
  };

  const MAX_PROFILE_CHECK_ATTEMPTS = 3;

  /**
   * Resolves an already-authenticated Firebase user to an app profile
   * (existing profile -> recovered org -> prompt/resume setup). Pulled out
   * of the auth-state-changed effect so a manual retry (the "Finalize
   * Setup" button, when it lands on a stuck error) can re-run exactly the
   * same check instead of falling through to the plain-login form logic,
   * which expects fields this screen never shows for a signed-in user.
   *
   * Retries on 'permission-denied' specifically: right after sign-in,
   * Firestore's own auth context can lag a beat behind the freshly-issued
   * token, so a security-rule check evaluated against the user's own uid
   * can transiently deny before the token finishes propagating.
   * readProfile() already worked around this for the simple doc read; the
   * organizations lookup below it had no such protection, so a slow token
   * handoff there used to surface a raw "Missing or insufficient
   * permissions" straight to the user with no way to recover short of
   * logging out and back in.
   */
  const checkProfileAndOnboard = async (user: { uid: string; email: string | null; getIdToken: () => Promise<string> }, attempt: number = 1): Promise<void> => {
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
          // merge: true is critical here — "profile not found" can be a
          // false negative from a transient read failure (see readProfile),
          // not proof the document is actually missing. A bare setDoc would
          // silently wipe displayName/phoneNumber/everything else on every
          // false positive of this recovery path. App.tsx's own profile
          // onSnapshot listener will pick up the real merged document and
          // correct any fields missing from this local minimal object.
          await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
          finishOnboarding(profile);
        } else {
          console.log("No organization found in auth state, attempting server recovery");
          const recovered = await attemptServerRecovery(user);
          if (!recovered) await promptOrResumeSetup(user);
        }
      }
    } catch (e: any) {
      if (e?.code === 'permission-denied' && attempt < MAX_PROFILE_CHECK_ATTEMPTS) {
        console.warn(`Profile check denied (attempt ${attempt}), retrying...`, e);
        await new Promise((r) => setTimeout(r, attempt * 900));
        return checkProfileAndOnboard(user, attempt + 1);
      }
      console.error("Firestore error:", e);
      setStatusMsg('');
      setError(describeError(e));
      // Keep the "Finalize setup" button available so the check can be
      // retried; don't strand them on a dead screen.
    }
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
        await checkProfileAndOnboard(user);
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

  // Countdown for the verify screen's "Resend" button. The server enforces
  // the real cooldown (see /api/auth/send-verification-code) — this just
  // keeps the button disabled in sync so a click can't be wasted on a 429.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown > 0]);

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
        // completeOnboarding is only ever reached after a code was verified
        // (or via Google, which pre-verifies) — see handleVerifyCode /
        // handleGoogleSignIn / promptOrResumeSetup's resume branch.
        emailVerified: true,
        ...(referredByRef.current ? { referredBy: referredByRef.current } : {})
      };

      // merge: true — this path can also fire for a returning user whose
      // profile read failed transiently (see readProfile), so it must not
      // blindly overwrite fields (phoneNumber, etc.) that already exist.
      await setDoc(doc(db, 'users', uid), profile, { merge: true });

      // Mark invitation as accepted
      if (inviteData) {
        const q = query(collection(db, 'invitations'), where('code', '==', inviteData.code));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(snap.docs[0].ref, { status: 'accepted' });
        }
      }

      try { sessionStorage.removeItem(VERIFIED_MARKER_KEY); } catch { /* best effort */ }
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

  /** Submits the 6-digit code the user just typed against /api/auth/verify-code. */
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !auth.currentUser) return;
    const trimmedCode = verificationCode.trim();
    if (trimmedCode.length !== VERIFICATION_CODE_LENGTH) {
      setError(t('Enter the 6-digit code.'));
      return;
    }
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ code: trimmedCode })
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data.verified) {
        setError(data.error || t('Incorrect code.'));
        return;
      }
      try { sessionStorage.setItem(VERIFIED_MARKER_KEY, '1'); } catch { /* best effort */ }
      // Normal path: name was collected on the same screen that created the
      // account, still in state. Recovery path (a reload wiped it): ask for
      // it on a dedicated screen instead of guessing.
      if (name.trim()) {
        await completeOnboarding(auth.currentUser.uid, pendingEmail || auth.currentUser.email || '', name);
      } else {
        setAuthStep('name');
      }
    } catch (err) {
      console.error('Verify code failed', err);
      setError(t('Could not verify code. Check your connection.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !auth.currentUser || loading) return;
    setError('');
    setInfo('');
    setLoading(true);
    const sent = await sendVerificationCode(auth.currentUser);
    setLoading(false);
    if (sent) setInfo(t('A new code has been sent to your email.'));
  };

  /**
   * Escape hatch for a typo'd signup email: the Firebase Auth account is
   * real at this point (createUserWithEmailAndPassword already succeeded),
   * so simply going "back" would leave an orphaned, permanently-unverified
   * account. Deleting it is safe here — it's within Firebase's own
   * recent-login grace window, right after creation.
   */
  const handleCancelVerification = async () => {
    setLoading(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.delete().catch(() => logout());
      }
    } catch (e) {
      console.error('Cancel verification cleanup failed', e);
    } finally {
      try { sessionStorage.removeItem(VERIFIED_MARKER_KEY); } catch { /* best effort */ }
      busyRef.current = false;
      setVerificationCode('');
      setPendingEmail('');
      setAuthStep('form');
      setError('');
      setInfo('');
      setStatusMsg('');
      setLoading(false);
    }
  };

  /** Only reached via promptOrResumeSetup's reload-recovery path — see there. */
  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !auth.currentUser) return;
    if (!name.trim()) {
      setError(t('Please enter your name.'));
      return;
    }
    await completeOnboarding(auth.currentUser.uid, auth.currentUser.email || pendingEmail, name);
  };

  const handleGoogleSignIn = async () => {
    if (loading || googleLoading) return;
    setError('');
    setInfo('');
    setGoogleLoading(true);
    busyRef.current = true;
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const gUser = cred.user;
      setStatusMsg(t("Active session detected. Checking profile..."));
      const profileSnap = await readProfile(gUser.uid);
      if (profileSnap.exists()) {
        const data = profileSnap.data() as UserProfile;
        if (data.organizationId) {
          setStatusMsg('');
          busyRef.current = false;
          finishOnboarding(data);
          return;
        }
      }
      // New Google account (or an existing one with no completed profile) —
      // Google already verifies the address, so this skips the code screen.
      try { sessionStorage.setItem(VERIFIED_MARKER_KEY, '1'); } catch { /* best effort */ }
      const fallbackName = gUser.displayName || (gUser.email ? gUser.email.split('@')[0] : '') || t('Grădinar');
      await completeOnboarding(gUser.uid, gUser.email || '', fallbackName);
    } catch (err: any) {
      console.error('Google sign-in failed', err);
      setStatusMsg('');
      busyRef.current = false;
      // Silent on a plain popup dismissal — not a real error.
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setError(describeError(err));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setInfo('');

    // Stuck on a failed automatic profile check (see checkProfileAndOnboard)
    // — this screen shows no email/password/name fields for an
    // already-authenticated user, so "Finalize Setup" here must retry that
    // check directly rather than falling through to the plain-login branch
    // below, which would call completeOnboarding() and demand a name that
    // was never asked for.
    if (isAlreadyLoggedIn && !isRegister && auth.currentUser) {
      setLoading(true);
      setStatusMsg(t("Active session detected. Checking profile..."));
      await checkProfileAndOnboard(auth.currentUser);
      setLoading(false);
      return;
    }

    if (isRegister) {
      // Single-screen signup: name + email + password all validated together,
      // then straight into account creation — no intermediate steps.
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim();
      if (!trimmedName) {
        setError(t("Please enter your name."));
        return;
      }
      if (!trimmedEmail || !password) {
        setError(t("Enter your email and password."));
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(t("Password must be at least 6 characters."));
        return;
      }

      busyRef.current = true;
      setLoading(true);
      setStatusMsg(t("Creating your account..."));
      try {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        setPendingEmail(trimmedEmail);
        setAuthStep('verify');
        setStatusMsg('');
        // Errors from this surface via setError inside sendVerificationCode;
        // the account already exists, so the verify screen's Resend button
        // is the retry path rather than leaving them stuck on this form.
        await sendVerificationCode(cred.user);
      } catch (err: any) {
        console.error("Auth failed:", err);
        setStatusMsg('');

        if (isPersistenceError(err) && recoverFromPersistenceError()) {
          setStatusMsg(t("Optimizing for your device..."));
          window.location.reload();
          return;
        }

        if (err.code === 'auth/email-already-in-use') {
          setIsRegister(false);
        }
        setError(describeError(err));
        // Account creation itself never happened — nothing pending to guard.
        busyRef.current = false;
      } finally {
        setLoading(false);
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
            // merge: true — same false-negative risk as the auth-state-change
            // recovery branch above; must not wipe displayName/phoneNumber/etc.
            await setDoc(doc(db, 'users', cred.user.uid), profile, { merge: true });
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
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-bg-main relative overflow-hidden text-main">
      <div className="stihl-card w-full max-w-md rounded-2xl p-6 sm:p-10 relative z-10 shadow-xl animate-in fade-in zoom-in duration-500 bg-bg-card border border-border-color">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? t('Light Mode') : t('Dark Mode')}
          title={theme === 'dark' ? t('Light Mode') : t('Dark Mode')}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 flex items-center justify-center rounded-full border border-border-color text-text-secondary hover:text-main hover:border-accent-color transition-all"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <div className="flex flex-col items-center mb-6 sm:mb-8 text-center">
          <img src="/logo.png" alt="My Garden Logo" className="w-20 h-20 sm:w-24 sm:h-24 object-contain mb-2 drop-shadow-md" />
          <div className="flex flex-col items-center">
            <h1 className="text-3xl sm:text-4xl tracking-tighter mb-0 leading-none" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700 }}>
              <span style={{ color: 'var(--accent-color)' }}>my</span>
              <span style={{ color: '#4F7942' }}> garden</span>
            </h1>
            <span className="text-[10px] font-black tracking-[0.2em] uppercase opacity-80 mt-2 mb-1 text-center leading-tight" style={{ color: 'var(--brand-olive)' }}>
              Your garden,<br/>smartly cared for
            </span>
          </div>
        </div>

        {/* Sign in / Sign up tab toggle — only during the normal form step,
            since switching modes mid-verification (or mid-"Finalize Setup")
            makes no sense. */}
        {authStep === 'form' && !isAlreadyLoggedIn && (
          <div className="flex bg-bg-main border border-border-color rounded-full p-1 mb-6">
            <button
              type="button"
              onClick={() => { if (isRegister) { setIsRegister(false); setError(''); setInfo(''); } }}
              className={`flex-1 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${!isRegister ? 'stihl-button shadow-sm' : 'text-text-secondary'}`}
            >
              {t('Sign in')}
            </button>
            <button
              type="button"
              onClick={() => { if (!isRegister) { setIsRegister(true); setError(''); setInfo(''); } }}
              className={`flex-1 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${isRegister ? 'stihl-button shadow-sm' : 'text-text-secondary'}`}
            >
              {t('Sign up')}
            </button>
          </div>
        )}

        {/* ─── Verify screen: 6-digit code, shown right after account creation ─── */}
        {authStep === 'verify' ? (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-md flex items-center gap-3 font-bold">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {info && !error && (
              <div className="p-4 bg-accent-subtle border border-accent-border text-accent-ink text-xs rounded-md flex items-center gap-3 font-bold">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{info}</span>
              </div>
            )}

            <div className="flex flex-col items-center text-center gap-3 pb-1">
              <div className="w-14 h-14 rounded-full bg-accent-subtle flex items-center justify-center">
                <ShieldCheck size={26} className="text-accent-color" />
              </div>
              <div>
                <h2 className="text-lg font-black text-main">{t('Verify your email')}</h2>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  {t("We've sent a 6-digit confirmation code to")} <span className="font-bold text-main">{pendingEmail}</span>. {t('Enter it below to activate your account.')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-2 justify-center">
                <KeyRound size={10} />
                {t('6-digit code')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={VERIFICATION_CODE_LENGTH}
                required
                autoFocus
                className="w-full bg-bg-main rounded-md px-4 py-3 outline-none text-main font-black text-center text-2xl tracking-[0.5em] border border-border-color focus:border-accent-color transition-all"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, VERIFICATION_CODE_LENGTH))}
              />
            </div>

            <button
              type="submit"
              disabled={loading || verificationCode.length !== VERIFICATION_CODE_LENGTH}
              className="w-full stihl-button py-4 rounded-md font-bold uppercase tracking-wider text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 text-white flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? t('Processing...') : t('Verify & continue')}
            </button>

            <div className="flex flex-col items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || loading}
                className="text-[11px] font-bold text-accent-color uppercase tracking-wider hover:underline disabled:opacity-50 disabled:no-underline disabled:text-text-secondary"
              >
                {resendCooldown > 0 ? t("Resend in {{seconds}}s", { seconds: resendCooldown }) : t("Didn't get a code? Resend")}
              </button>
              <button
                type="button"
                onClick={handleCancelVerification}
                disabled={loading}
                className="flex items-center gap-1.5 text-[11px] font-bold text-text-secondary uppercase tracking-wider hover:text-main transition-colors py-2 disabled:opacity-50"
              >
                <ArrowLeft size={12} /> {t('Wrong email? Start over')}
              </button>
            </div>
          </form>
        ) : authStep === 'name' ? (
          /* ─── Recovery screen: only reached if a reload wiped the in-memory
             name between verifying and finishing onboarding — see promptOrResumeSetup. ─── */
          <form onSubmit={handleNameSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-md flex items-center gap-3 font-bold">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-accent-color uppercase tracking-wider ml-1 flex items-center gap-2">
                <User size={10} />
                {t('Your Name')}
              </label>
              <input
                type="text"
                autoComplete="name"
                required
                autoFocus
                className="w-full bg-bg-main rounded-md px-4 py-3 outline-none text-main font-black border border-accent-color focus:ring-1 focus:ring-accent-color transition-all shadow-sm"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('Ex: Ion, Maria...')}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full stihl-button py-4 rounded-md font-bold uppercase tracking-wider text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 text-white"
            >
              {loading ? t('Processing...') : t('Finish setup')}
            </button>
          </form>
        ) : (
          /* ─── Normal Sign in / Sign up form ─── */
          <form onSubmit={handleFormSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-md flex items-center gap-3 font-bold">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {info && !error && (
              <div className="p-4 bg-accent-subtle border border-accent-border text-accent-ink text-xs rounded-md flex items-center gap-3 font-bold">
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
                {/* Signup: name + email + password all on one screen. */}
                {isRegister && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-2">
                      <User size={10} />
                      {t('Your Name')}
                    </label>
                    <input
                      type="text"
                      autoComplete="name"
                      required
                      className="w-full bg-bg-main rounded-md px-4 py-3 outline-none text-main font-bold border border-border-color focus:border-accent-color transition-all"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={t('Ex: Ion, Maria...')}
                    />
                  </div>
                )}

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

            <div className="pt-1 space-y-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full stihl-button py-4 rounded-md font-bold uppercase tracking-wider text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 text-white flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? t('Processing...') : isAlreadyLoggedIn ? t('Finalize Setup') : isRegister ? t('Create account') : t('Sign in')}
              </button>

              {statusMsg && !isAlreadyLoggedIn && (
                <p className="text-[11px] text-center font-bold text-accent-color uppercase tracking-wider">
                  {statusMsg}
                </p>
              )}

              {!isAlreadyLoggedIn && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border-color" />
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t('or')}</span>
                    <div className="h-px flex-1 bg-border-color" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading || googleLoading}
                    className="w-full flex items-center justify-center gap-3 py-3.5 rounded-md border border-border-color bg-bg-main hover:bg-bg-card font-bold text-xs uppercase tracking-wider text-main transition-all active:scale-95 disabled:opacity-50"
                  >
                    {googleLoading ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon size={18} />}
                    {t('Continue with Google')}
                  </button>
                </>
              )}
            </div>

            {!isAlreadyLoggedIn ? (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => { setIsRegister(!isRegister); setError(''); setInfo(''); setStatusMsg(''); }}
                  className="text-[11px] font-bold text-text-secondary uppercase tracking-wider hover:text-main transition-colors py-2"
                >
                  {isRegister ? t('Already have an account? Login') : t('New here? Create account')}
                </button>
              </div>
            ) : (
              <div className="text-center pt-1">
                <button type="button" onClick={handleForceLogout} className="text-[11px] font-bold text-red-500 uppercase tracking-wider hover:underline">
                  {t('Not you? Logout')}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
