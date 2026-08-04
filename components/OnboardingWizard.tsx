import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sprout,
  HelpCircle,
  Zap,
  CheckCircle2,
  Plus,
  Star,
  ThermometerSun,
  Leaf,
  Waves,
  Bug
} from 'lucide-react';
import { db, updateDoc, doc, auth, getDoc } from '../services/firebase';
import { toast } from 'react-hot-toast';

interface Props {
  organizationId: string;
  onComplete: () => void;
}

const OnboardingWizard: React.FC<Props> = ({ organizationId, onComplete }) => {
  const { t } = useTranslation();

  const CONCERN_OPTIONS: { value: string; label: string; subtext: string; icon: React.ReactNode }[] = [
    { value: 'dry_patches', label: t('Pete Uscate sau Galbene'), subtext: t('Zone în care iarba moare sau se îngălbenește.'), icon: <ThermometerSun size={20} className="text-amber-500" /> },
    { value: 'weeds_moss', label: t('Buruieni sau Mușchi'), subtext: t('Plante nedorite care sufocă gazonul.'), icon: <Leaf size={20} className="text-green-500" /> },
    { value: 'growth_color', label: t('Culoare Palidă / Creștere Lentă'), subtext: t('Gazonul este verde deschis sau crește greu.'), icon: <Sprout size={20} className="text-accent-color" /> },
    { value: 'soil_water', label: t('Sol Compact / Bălți'), subtext: t('Apa stagnează după irigare sau ploaie.'), icon: <Waves size={20} className="text-blue-500" /> },
    { value: 'pests', label: t('Dăunători'), subtext: t('Cârtițe, mușuroaie, viermi sau insecte.'), icon: <Bug size={20} className="text-red-500" /> },
  ];

  const CONCERN_LABELS: Record<string, string> = Object.fromEntries(CONCERN_OPTIONS.map(o => [o.value, o.label]));
  const [hasExistingName, setHasExistingName] = useState(true);
  const [startingStep, setStartingStep] = useState(2);
  const [step, setStep] = useState(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [primaryConcern, setPrimaryConcern] = useState<string | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      getDoc(doc(db, 'users', uid)).then(snap => {
        if (snap.exists()) {
          const name = snap.data().displayName;
          if (name) {
            setHasExistingName(true);
            setStep(2);
            setStartingStep(2);
          } else {
            setHasExistingName(false);
            setStep(1);
            setStartingStep(1);
          }
        }
      }).catch(() => {});
    }
  }, []);

  const finishOnboarding = async () => {
    setIsProcessing(true);
    try {
      const auth = (await import('../services/firebase')).auth;
      const uid = auth.currentUser?.uid;

      // Save displayName to user profile
      if (uid && displayName.trim()) {
        const { updateDoc: ud, doc: d } = await import('../services/firebase');
        await ud(d(db, 'users', uid), { displayName: displayName.trim() });
      }

      // Save organization settings
      await updateDoc(doc(db, 'organizations', organizationId), {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
        ...(primaryConcern ? { primaryLawnConcern: primaryConcern } : {})
      });
      if (primaryConcern) {
        toast.success(`${t('Am notat:')} ${CONCERN_LABELS[primaryConcern]}. ${t('Găsești diagnosticul complet în cardul "Doctorul Grădinii" de pe Acasă.')}`, { duration: 6000 });
      }
      onComplete();
    } catch (error) {
      toast.error(t('Error finishing onboarding'));
    } finally {
      setIsProcessing(false);
    }
  };

  const steps = [
    {
      id: 1,
      title: t('Cum te cheamă?'),
      description: t('Hai să pornim treaba în 3 pași simpli.'),
      icon: <Sprout className="text-accent-color" size={32} />
    },
    {
      id: 2,
      title: t('Ce problemă principală ai?'),
      description: t('Așa îți arătăm din prima zi conținutul potrivit pentru tine.'),
      icon: <HelpCircle className="text-red-500" size={32} />
    },
    {
      id: 3,
      title: 'My Garden PRO',
      description: t('Deblochează ghidurile avansate și calculatoarele precise.'),
      icon: <Zap className="text-amber-500" size={32} />
    }
  ];

  const totalSteps = hasExistingName ? 2 : 3;
  const currentStepNum = hasExistingName ? (step === 1 ? 1 : step - 1) : step;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-bg-card border border-border-color rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden"
      >

        {/* Progress Bar */}
        <div className="flex h-1.5 w-full bg-border-color/20">
            {Array.from({length: totalSteps}).map((_, idx) => {
              const progressStep = hasExistingName ? idx + 2 : idx + 1;
              return (
                <div
                    key={idx}
                    className={`flex-1 transition-all duration-500 ${progressStep <= step ? 'bg-accent-color' : ''}`}
                />
              );
            })}
        </div>

        <div className="p-4 sm:p-8 md:p-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-bg-main rounded-2xl border border-border-color shadow-inner">
                        {steps[step-1].icon}
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-accent-color uppercase tracking-[0.2em] mb-1">
                            {t('Step')} {currentStepNum} {t('of')} {totalSteps}
                        </p>
                        <h2 className="text-2xl font-black text-main tracking-tight">{steps[step-1].title}</h2>
                    </div>
                </div>
                <button onClick={finishOnboarding} className="text-text-secondary hover:text-red-500 transition-colors">
                    <X size={24} />
                </button>
            </div>

            {/* Content Area */}
            <div className="min-h-[240px] py-4">
                {step === 1 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <p className="text-lg text-text-secondary font-medium leading-relaxed">
                            {t('Spune-ne cum te cheamă ca să personalizez saluturile și dashboard-ul pentru tine.')}
                        </p>
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder={t('Exemplu: Ion, Maria, etc.')}
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                autoFocus
                                className="w-full bg-bg-main border border-border-color rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-accent-color"
                            />
                            <p className="text-xs text-text-secondary font-medium">✨ {t('Vei vedea "Bună seara, [Nume] 🌙" pe dashboard!')}</p>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-3 animate-in slide-in-from-right-4 duration-300">
                        <p className="text-sm text-text-secondary font-medium mb-4">
                            {steps[1].description}
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                            {CONCERN_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setPrimaryConcern(opt.value)}
                                    className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                                        primaryConcern === opt.value
                                        ? 'bg-accent-color/5 border-accent-color shadow-sm'
                                        : 'bg-bg-main border-border-color hover:border-accent-color/40'
                                    }`}
                                >
                                    <div className="w-11 h-11 rounded-xl bg-bg-card border border-border-color flex items-center justify-center shrink-0">
                                        {opt.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-main">{opt.label}</p>
                                        <p className="text-[11px] text-text-secondary font-medium">{opt.subtext}</p>
                                    </div>
                                    {primaryConcern === opt.value && <CheckCircle2 size={18} className="text-accent-color shrink-0" />}
                                </button>
                            ))}
                            <button
                                onClick={() => setPrimaryConcern(null)}
                                className={`p-3 rounded-2xl border text-center text-xs font-bold uppercase tracking-widest transition-all ${
                                    primaryConcern === null
                                    ? 'bg-accent-color/5 border-accent-color text-accent-color'
                                    : 'bg-bg-main border-border-color text-text-secondary hover:border-accent-color/40'
                                }`}
                            >
                                {t('Nu știu încă / Doar vreau sfaturi generale')}
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-6 bg-bg-main rounded-3xl border border-border-color relative overflow-hidden group">
                                <div className="absolute -top-4 -right-4 opacity-5 group-hover:scale-110 transition-transform">
                                    <Star size={80} />
                                </div>
                                <h4 className="text-xs font-black text-text-secondary uppercase tracking-widest mb-4">{t('Free')}</h4>
                                <ul className="space-y-3">
                                    <li className="text-xs font-bold text-main flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> {t('Ghiduri de bază Academy')}</li>
                                    <li className="text-xs font-bold text-main flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> {t('Calendar & memento-uri')}</li>
                                    <li className="text-xs font-bold text-main flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> {t('Doctorul Grădinii')}</li>
                                </ul>
                            </div>
                            <div className="p-6 bg-accent-color text-white rounded-3xl relative overflow-hidden shadow-xl shadow-accent-color/20">
                                <div className="absolute -top-4 -right-4 opacity-20">
                                    <Zap size={80} />
                                </div>
                                <h4 className="text-xs font-black uppercase tracking-widest mb-4 opacity-80">PRO</h4>
                                <ul className="space-y-3">
                                    <li className="text-xs font-bold flex items-center gap-2"><Plus size={12} /> {t('Peste 50 de ghiduri avansate')}</li>
                                    <li className="text-xs font-bold flex items-center gap-2"><Plus size={12} /> {t('Calculatoare precise de tratamente')}</li>
                                    <li className="text-xs font-bold flex items-center gap-2"><Plus size={12} /> {t('Fără reclame')}</li>
                                </ul>
                            </div>
                        </div>
                        <p className="text-xs text-center text-text-secondary font-bold uppercase tracking-widest py-4">
                            {t('Poți trece la PRO oricând din Academie')}
                        </p>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between mt-12 pt-8 border-t border-border-color">
                <button
                    onClick={() => {
                      if (hasExistingName && step === 2) {
                        finishOnboarding();
                      } else if (step > startingStep) {
                        setStep(step - 1);
                      } else {
                        finishOnboarding();
                      }
                    }}
                    className="flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-main transition-colors px-4 py-2"
                >
                    <ChevronLeft size={20} />
                    {(hasExistingName && step === 2) || (!hasExistingName && step === 1) ? t('Skip Tutorial') : t('Back')}
                </button>

                {step === 3 ? (
                    <button
                        onClick={finishOnboarding}
                        disabled={isProcessing}
                        className="px-8 py-4 bg-accent-color text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-accent-color/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3"
                    >
                        {isProcessing ? t('Saving...') : 'Începe'}
                        <CheckCircle2 size={18} />
                    </button>
                ) : step === 1 ? (
                    <button
                        onClick={() => setStep(step + 1)}
                        disabled={!displayName.trim()}
                        className="px-8 py-4 bg-accent-color text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-accent-color/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                        {t('Continue')}
                        <ChevronRight size={18} />
                    </button>
                ) : (
                    <button
                        onClick={() => setStep(step + 1)}
                        className="px-8 py-4 bg-accent-color text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-accent-color/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3"
                    >
                        {t('Continue')}
                        <ChevronRight size={18} />
                    </button>
                )}
            </div>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingWizard;
