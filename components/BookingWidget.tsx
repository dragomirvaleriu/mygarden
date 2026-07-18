import React, { useState, useEffect } from 'react';
import { Sprout, Phone, User, Maximize2, AlertCircle, CheckCircle2, ArrowRight, HelpCircle } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface BookingWidgetProps {
  organizationId: string;
}

export const BookingWidget: React.FC<BookingWidgetProps> = ({ organizationId }) => {
  const [companyName, setCompanyName] = useState<string>('Scapeflow Company');
  const [loadingCompany, setLoadingCompany] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [yardArea, setYardArea] = useState('');
  const [mainProblem, setMainProblem] = useState('Gazon Uscat');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch company details to display the branding nicely!
  useEffect(() => {
    const fetchCompany = async () => {
      if (!organizationId) return;
      try {
        const orgRef = doc(db, 'organizations', organizationId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
          setCompanyName(orgSnap.data().name || 'Scapeflow Partner');
        }
      } catch (err) {
        console.error('Error fetching organization name:', err);
      } finally {
        setLoadingCompany(false);
      }
    };
    fetchCompany();
  }, [organizationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !yardArea.trim() || !mainProblem) {
      setError('Vă rugăm să completați toate câmpurile obligatorii.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await addDoc(collection(db, 'leads'), {
        name: name.trim(),
        phone: phone.trim(),
        yardArea: Number(yardArea) || 0,
        mainProblem: mainProblem,
        description: description.trim() || `Problemă selectată: ${mainProblem}`,
        status: 'new',
        createdAt: serverTimestamp(),
        organizationId: organizationId,
        source: 'Booking Widget'
      });
      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Error adding lead:', err);
      setError('A apărut o eroare la trimiterea solicitării. Vă rugăm să încercați din nou.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-bg-dark flex items-center justify-center p-4 antialiased">
        <div className="w-full max-w-md bg-white dark:bg-bg-card rounded-3xl shadow-2xl border border-slate-100 dark:border-border-color p-8 text-center animate-fade-in">
          <div className="w-20 h-20 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle2 size={44} />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white mb-3">
            Solicitare Înregistrată!
          </h2>
          <p className="text-sm text-slate-500 dark:text-text-secondary mb-6 leading-relaxed">
            Cererea ta a fost trimisă cu succes. Echipa noastră te va contacta în curând pentru a stabili detaliile vizitei.
          </p>
          <div className="border-t border-slate-100 dark:border-border-color pt-6">
            <p className="text-xs text-slate-400 dark:text-text-secondary">
              Securizat prin Scapeflow pentru {companyName}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-bg-dark dark:to-bg-dark flex flex-col justify-between p-4 antialiased">
      {/* Centered card container */}
      <div className="w-full max-w-md mx-auto my-auto bg-white dark:bg-bg-card rounded-3xl shadow-2xl border border-slate-100 dark:border-border-color overflow-hidden">
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white text-center relative">
          <div className="absolute top-4 left-4 opacity-15">
            <Sprout size={48} />
          </div>
          <h1 className="text-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 mb-1">
            <Sprout size={20} className="animate-pulse" />
            {companyName}
          </h1>
          <p className="text-xs text-emerald-100/90 font-medium tracking-wider uppercase">
            Programare Evaluare Curte & Gazon
          </p>
        </div>

        {/* Form area */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-semibold animate-shake">
              {error}
            </div>
          )}

          {/* Name input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-text-secondary block">
              Nume Complet *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <User size={16} />
              </span>
              <input
                type="text"
                required
                placeholder="Ex: Andrei Popescu"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-bg-dark/50 border border-slate-200 dark:border-border-color rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200"
              />
            </div>
          </div>

          {/* Phone input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-text-secondary block">
              Număr de Telefon *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Phone size={16} />
              </span>
              <input
                type="tel"
                required
                placeholder="Ex: 0722 000 000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-bg-dark/50 border border-slate-200 dark:border-border-color rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200"
              />
            </div>
          </div>

          {/* Yard Area input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-text-secondary block">
              Suprafață Curte / Gazon (mp) *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Maximize2 size={16} />
              </span>
              <input
                type="number"
                required
                placeholder="Ex: 250"
                value={yardArea}
                onChange={(e) => setYardArea(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-bg-dark/50 border border-slate-200 dark:border-border-color rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200"
              />
            </div>
          </div>

          {/* Main Problem select dropdown */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-text-secondary block">
              Problema Principală *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <AlertCircle size={16} />
              </span>
              <select
                required
                value={mainProblem}
                onChange={(e) => setMainProblem(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-bg-dark/50 border border-slate-200 dark:border-border-color rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 appearance-none"
              >
                <option value="Gazon Uscat">Gazon Uscat</option>
                <option value="Scarificare">Scarificare</option>
                <option value="Mentenanță Generală">Mentenanță Generală</option>
                <option value="Altceva">Altceva</option>
              </select>
              <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 pointer-events-none">
                ▼
              </span>
            </div>
          </div>

          {/* Description input (Optional for extra details) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-text-secondary block">
              Detalii suplimentare (Opțional)
            </label>
            <div className="relative">
              <span className="absolute top-3.5 left-3.5 text-slate-400">
                <HelpCircle size={16} />
              </span>
              <textarea
                rows={2}
                placeholder="Ex: Curtea are sistem de irigații funcțional..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-bg-dark/50 border border-slate-200 dark:border-border-color rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 resize-none"
              />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting || loadingCompany}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 px-6 rounded-xl text-sm uppercase tracking-wider shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                Trimite Solicitare
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer info */}
      <footer className="text-center text-[10px] text-slate-400 dark:text-text-secondary mt-4 font-medium uppercase tracking-widest">
        Powered by Scapeflow
      </footer>
    </div>
  );
};
