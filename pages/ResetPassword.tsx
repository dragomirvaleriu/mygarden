import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, verifyPasswordResetCode, confirmPasswordReset, signInWithEmailAndPassword } from '../services/firebase';
import { Eye, EyeOff, Loader2, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 6;

interface Props {
  onDone: () => void;
}

// Firebase's action link puts its params after the hash fragment we gave it
// as actionCodeSettings.url (see server.ts's generatePasswordResetLink call),
// so they land in location.hash rather than location.search — same pattern
// Login.tsx already uses for invite/purchase links.
const parseOobCode = (): string | null => {
  const params = new URLSearchParams(window.location.hash.split('?')[1]);
  return params.get('oobCode');
};

const ResetPassword: React.FC<Props> = ({ onDone }) => {
  const { t } = useTranslation();

  useEffect(() => {
    // [data-theme='dark']'s own CSS default for --accent-color is pink, not
    // brand green — see the identical fix in Login.tsx for why this needs
    // forcing here too.
    document.documentElement.style.setProperty('--accent-color', '#4A7C59');
  }, []);

  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oobCode, setOobCode] = useState('');

  useEffect(() => {
    const code = parseOobCode();
    if (!code) {
      setStatus('invalid');
      return;
    }
    setOobCode(code);
    verifyPasswordResetCode(auth, code)
      .then((resolvedEmail) => {
        setEmail(resolvedEmail);
        setStatus('ready');
      })
      .catch(() => setStatus('invalid'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("Password must be at least 6 characters."));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("The passwords do not match."));
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);

      // Sign in immediately with the new password — gives this device a
      // fresh, valid session (nicer than making them re-type credentials on
      // the login screen right after), and gives us an authenticated
      // context to call revoke-sessions with next, which is what actually
      // logs out any OTHER device still holding the old session (any device
      // that stays open gets caught on its own next forced token refresh —
      // see App.tsx's onAuthStateChanged).
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await cred.user.getIdToken();
        await fetch('/api/auth/revoke-sessions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` }
        });
        // Revocation invalidates tokens issued before the call above,
        // including — by a few hundred ms — the one this device just got.
        // Force one more refresh so this device ends up with a token
        // stamped *after* its own revocation call instead of getting
        // caught by it too.
        await cred.user.getIdToken(true);
      } catch (signInErr) {
        // Non-fatal — the password itself was already changed successfully
        // above; worst case they land on the sign-in screen and type it
        // once, and other devices simply stay logged in a bit longer.
        console.warn('Post-reset sign-in/revocation failed', signInErr);
      }

      setStatus('done');
    } catch (err: any) {
      console.error("Confirm password reset failed:", err);
      if (err?.code === 'auth/expired-action-code' || err?.code === 'auth/invalid-action-code') {
        setStatus('invalid');
      } else if (err?.code === 'auth/weak-password') {
        setError(t("Password must be at least 6 characters."));
      } else {
        setError(err?.message || t("Something went wrong. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    window.location.hash = '';
    onDone();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-bg-main relative overflow-hidden text-main">
      <div className="stihl-card w-full max-w-md rounded-2xl p-6 sm:p-10 relative z-10 shadow-xl animate-in fade-in zoom-in duration-500 bg-bg-card border border-border-color">
        <div className="flex flex-col items-center mb-6 sm:mb-8 text-center">
          <img src="/logo.png" alt="My Garden Logo" className="w-20 h-20 sm:w-24 sm:h-24 object-contain mb-2 drop-shadow-md" />
          <h1 className="text-3xl sm:text-4xl tracking-tighter mb-0 leading-none" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700 }}>
            <span style={{ color: 'var(--accent-color)' }}>my</span>
            <span style={{ color: '#4F7942' }}> garden</span>
          </h1>
        </div>

        {status === 'checking' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={28} className="animate-spin text-accent-color" />
            <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">{t('Checking...')}</p>
          </div>
        )}

        {status === 'invalid' && (
          <div className="space-y-6">
            <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-md flex items-center gap-3 font-bold">
              <AlertCircle size={16} className="shrink-0" />
              <span>{t('This reset link is invalid or has expired. Request a new one from the sign-in screen.')}</span>
            </div>
            <button
              type="button"
              onClick={goToLogin}
              className="w-full stihl-button py-4 rounded-md font-bold uppercase tracking-wider text-xs shadow-md active:scale-95 transition-all text-white"
            >
              {t('Back to sign in')}
            </button>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <p className="text-xs text-text-secondary text-center -mt-2">
              {t('Setting a new password for')} <span className="font-bold text-main">{email}</span>
            </p>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-md flex items-center gap-3 font-bold">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-2">
                <Lock size={10} />
                {t('New Password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  className="w-full bg-bg-main rounded-md px-4 py-3 outline-none text-main font-bold border border-border-color focus:border-accent-color transition-all pr-12"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
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
              <p className="text-[10px] font-bold text-text-secondary ml-1 pt-1">{t('At least 6 characters.')}</p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider ml-1 flex items-center gap-2">
                <Lock size={10} />
                {t('Confirm Password')}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="w-full bg-bg-main rounded-md px-4 py-3 outline-none text-main font-bold border border-border-color focus:border-accent-color transition-all"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full stihl-button py-4 rounded-md font-bold uppercase tracking-wider text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 text-white flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? t('Processing...') : t('Set new password')}
            </button>
          </form>
        )}

        {status === 'done' && (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-accent-subtle flex items-center justify-center">
                <CheckCircle2 size={26} className="text-accent-color" />
              </div>
              <h2 className="text-lg font-black text-main">{t('Password updated')}</h2>
              <p className="text-xs text-text-secondary">{t('You can now sign in with your new password.')}</p>
            </div>
            <button
              type="button"
              onClick={goToLogin}
              className="w-full stihl-button py-4 rounded-md font-bold uppercase tracking-wider text-xs shadow-md active:scale-95 transition-all text-white"
            >
              {t('Back to sign in')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
