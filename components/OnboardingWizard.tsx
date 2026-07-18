import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Building2, 
  Wrench, 
  Users, 
  Zap, 
  CheckCircle2,
  Plus,
  Star
} from 'lucide-react';
import { db, collection, addDoc, updateDoc, doc, getDocs, query, where } from '../services/firebase';
import { toast } from 'react-hot-toast';

interface Props {
  organizationId: string;
  onComplete: () => void;
}

const OnboardingWizard: React.FC<Props> = ({ organizationId, onComplete }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Step 2: Services
  const [services, setServices] = useState([
    { name: 'Tuns Gazon', unit: 'mp', isDefault: true, isActive: true },
    { name: 'Aplicare ingrasamant solid', unit: 'mp', isDefault: true, isActive: true },
  ]);

  const handleAddDefaultServices = async () => {
    setIsProcessing(true);
    try {
      const batch = services.filter(s => s.isDefault).map(s => 
        addDoc(collection(db, 'service_types'), {
          organizationId,
          ...s,
          createdAt: new Date()
        })
      );
      await Promise.all(batch);
      setStep(3);
    } catch (error) {
      toast.error(t('Error saving services'));
    } finally {
      setIsProcessing(false);
    }
  };

  const finishOnboarding = async () => {
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'organizations', organizationId), {
        onboardingCompleted: true,
        onboardingCompletedAt: new Date()
      });
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
      title: t('Welcome to Scapeflow'),
      description: t('Lets get your organization ready in 3 simple steps.'),
      icon: <Building2 className="text-accent-color" size={32} />
    },
    {
      id: 2,
      title: t('Setup Services'),
      description: t('What services do you offer? We added some defaults for you.'),
      icon: <Wrench className="text-blue-500" size={32} />
    },
    {
      id: 3,
      title: t('Invite Your Team'),
      description: t('Work better together by inviting your colleagues.'),
      icon: <Users className="text-green-500" size={32} />
    },
    {
      id: 4,
      title: t('Power of Pro'),
      description: t('Unlock the full potential of your landscape business.'),
      icon: <Zap className="text-amber-500" size={32} />
    }
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-bg-card border border-border-color rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        
        {/* Progress Bar */}
        <div className="flex h-1.5 w-full bg-border-color/20">
            {[1, 2, 3, 4].map((s) => (
                <div 
                    key={s} 
                    className={`flex-1 transition-all duration-500 ${s <= step ? 'bg-accent-color' : ''}`}
                />
            ))}
        </div>

        <div className="p-8 md:p-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-bg-main rounded-2xl border border-border-color shadow-inner">
                        {steps[step-1].icon}
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-accent-color uppercase tracking-[0.2em] mb-1">
                            {t('Step')} {step} {t('of')} 4
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
                            {t('Scapeflow onboarding intro')}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-bg-main rounded-2xl border border-border-color">
                                <h4 className="font-bold text-main mb-2 flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    {t('Manage Clients')}
                                </h4>
                                <p className="text-xs text-text-secondary leading-relaxed">{t('Keep all your client data in one place.')}</p>
                            </div>
                            <div className="p-4 bg-bg-main rounded-2xl border border-border-color">
                                <h4 className="font-bold text-main mb-2 flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                    {t('Smart Scheduling')}
                                </h4>
                                <p className="text-xs text-text-secondary leading-relaxed">{t('Optimize your routes and team time.')}</p>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                        <p className="text-sm text-text-secondary font-medium mb-6">
                            {t('Select the services you want to start with:')}
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                            {services.map((s, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => {
                                        const newS = [...services];
                                        newS[idx].isDefault = !newS[idx].isDefault;
                                        setServices(newS);
                                    }}
                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                        s.isDefault 
                                        ? 'bg-accent-color/5 border-accent-color shadow-sm' 
                                        : 'bg-bg-main border-border-color opacity-60 hover:opacity-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${s.isDefault ? 'bg-accent-color border-accent-color' : 'border-border-color'}`}>
                                            {s.isDefault && <CheckCircle2 size={14} className="text-white" />}
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-main">{s.name}</p>
                                            <p className="text-[11px] text-text-secondary font-bold uppercase">{t('Unit')}: {s.unit}</p>
                                        </div>
                                    </div>
                                    <Wrench size={16} className={s.isDefault ? 'text-accent-color' : 'text-text-secondary'} />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <p className="text-lg text-text-secondary font-medium leading-relaxed">
                            {t('Onboarding team intro')}
                        </p>
                        <div className="p-6 bg-accent-color/5 rounded-3xl border border-dashed border-accent-color/30 flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-accent-color/10 flex items-center justify-center text-accent-color mb-4">
                                <Users size={32} />
                            </div>
                            <h4 className="text-lg font-black text-main mb-2">{t('Collaborate in Real-Time')}</h4>
                            <p className="text-sm text-text-secondary mb-6 max-w-sm">
                                {t('You can add your team members from the Administration panel later.')}
                            </p>
                            <button 
                                onClick={() => setStep(4)}
                                className="px-6 py-3 bg-bg-main border border-border-color rounded-xl font-bold text-main hover:border-accent-color transition-all shadow-sm flex items-center gap-2"
                            >
                                <ChevronRight size={18} />
                                {t('Got it, next')}
                            </button>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-6 bg-bg-main rounded-3xl border border-border-color relative overflow-hidden group">
                                <div className="absolute -top-4 -right-4 opacity-5 group-hover:scale-110 transition-transform">
                                    <Star size={80} />
                                </div>
                                <h4 className="text-xs font-black text-text-secondary uppercase tracking-widest mb-4">{t('Free Plan')}</h4>
                                <ul className="space-y-3">
                                    <li className="text-xs font-bold text-main flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> 20 {t('Clients')}</li>
                                    <li className="text-xs font-bold text-main flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> 1 {t('Employee')}</li>
                                    <li className="text-xs font-bold text-main flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> {t('Basic Reports')}</li>
                                </ul>
                            </div>
                            <div className="p-6 bg-accent-color text-white rounded-3xl relative overflow-hidden shadow-xl shadow-accent-color/20">
                                <div className="absolute -top-4 -right-4 opacity-20">
                                    <Zap size={80} />
                                </div>
                                <h4 className="text-xs font-black uppercase tracking-widest mb-4 opacity-80">{t('Pro Plan')}</h4>
                                <ul className="space-y-3">
                                    <li className="text-xs font-bold flex items-center gap-2"><Plus size={12} /> {t('Unlimited Clients')}</li>
                                    <li className="text-xs font-bold flex items-center gap-2"><Plus size={12} /> {t('Unlimited Team')}</li>
                                    <li className="text-xs font-bold flex items-center gap-2"><Plus size={12} /> {t('Inventory Management')}</li>
                                    <li className="text-xs font-bold flex items-center gap-2"><Plus size={12} /> {t('Advanced Analytics')}</li>
                                </ul>
                            </div>
                        </div>
                        <p className="text-xs text-center text-text-secondary font-bold uppercase tracking-widest py-4">
                            {t('Scapeflow is better with Pro')}
                        </p>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between mt-12 pt-8 border-t border-border-color">
                <button 
                    onClick={() => step > 1 ? setStep(step - 1) : finishOnboarding()}
                    className="flex items-center gap-2 text-sm font-bold text-text-secondary hover:text-main transition-colors px-4 py-2"
                >
                    <ChevronLeft size={20} />
                    {step === 1 ? t('Skip Tutorial') : t('Back')}
                </button>

                {step === 2 ? (
                    <button 
                        onClick={handleAddDefaultServices}
                        disabled={isProcessing}
                        className="px-8 py-4 bg-accent-color text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-accent-color/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3"
                    >
                        {isProcessing ? t('Saving...') : t('Install Services')}
                        <ChevronRight size={18} />
                    </button>
                ) : step === 4 ? (
                    <button 
                        onClick={finishOnboarding}
                        disabled={isProcessing}
                        className="px-8 py-4 bg-main text-white dark:bg-white dark:text-main rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3"
                    >
                        {t('Start Managing')}
                        <CheckCircle2 size={18} />
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
      </div>
    </div>
  );
};

export default OnboardingWizard;
