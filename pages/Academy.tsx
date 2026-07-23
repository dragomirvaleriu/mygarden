import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen, Lock, Crown, Zap, Star, Clock, ChevronRight,
  X, Sprout, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Droplets, Sun, Scissors, FlaskConical, Tractor, Filter,
  GraduationCap, TrendingUp, Globe, ArrowLeft, Eye, BarChart3,
  ShieldCheck
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ARTICLES_RO, ARTICLES_EN, ACADEMY_CATEGORIES,
  ArticleMeta, getArticlesByLang, getFreeArticleCount, getTotalArticleCount
} from '../src/data/academyContent';
import { auth, functions, httpsCallable } from '../services/firebase';
import { usePlan } from '../src/hooks/usePlan';
import toast from 'react-hot-toast';
import { SmartTroubleshooter } from '../components/SmartTroubleshooter';
import AIAssistantModal from '../components/academy/AIAssistantModal';
import { useData } from '../src/context/DataContext';

// ─── Types ────────────────────────────────────────────
interface Props {
  subscriptionTier?: 'free' | 'pro' | 'enterprise' | 'lifetime';
  onNavigateToUpgrade?: () => void;
}

// ─── Buy Button ────────────────────────────────────────
const BuyButton: React.FC<{ onClick: () => void; loading: boolean }> = ({ onClick, loading }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="relative w-full group overflow-hidden"
    aria-label="Cumpără abonament anual My Garden PRO"
  >
    <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 via-amber-300 to-emerald-500 md:min-h-[104px] rounded-3xl blur opacity-60 group-hover:opacity-90 animate-pulse transition-opacity" />
    <div className="relative flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black py-5 px-8 md:min-h-[104px] rounded-2xl transition-all duration-300 active:scale-95 shadow-xl shadow-emerald-500/30">
      {loading ? (
        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <>
          <Zap size={22} className="shrink-0 fill-current" />
          <span className="text-base uppercase tracking-widest leading-tight text-center">Începe Acum — 29 RON / An 🚀</span>
        </>
      )}
    </div>
  </button>
);

// ─── Benefit Row ───────────────────────────────────────
const BenefitRow: React.FC<{ text: string; subtext?: string }> = ({ text, subtext }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
      <CheckCircle2 size={13} className="text-emerald-400" />
    </div>
    <div>
      <p className="text-sm font-bold text-white/90">{text}</p>
      {subtext && <p className="text-xs text-white/50 mt-0.5">{subtext}</p>}
    </div>
  </div>
);

// ─── Premium Upgrade Modal ──────────────────────────────
const PremiumUpgradeModal: React.FC<{
  triggerArticle: { title: string; emoji: string; categoryLabel: string; readTime: number; difficulty: string; coverGradient: string };
  onClose: () => void;
  onUpgrade: () => Promise<void>;
}> = ({ triggerArticle, onClose, onUpgrade }) => {
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleUpgrade = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onUpgrade();
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    { text: 'Peste 50 de ghiduri și protocoale de sezon', subtext: 'Actualizate lunar cu conținut nou de la agronomi' },
    { text: 'Calculatoare precise pentru tratamente horticole', subtext: 'Doze, volume de apă și costuri estimate instant' },
    { text: 'Modul SOS: Diagnoză imediată pentru boli și dăunători', subtext: 'Brown Patch, Pythium, dăunători subterani și mai mult' },
    { text: 'Fără reclame, 100% știință aplicată', subtext: 'Zero marketing. Doar informații verificate agronomic' },
  ];

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center transition-all duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
      <div className={`relative w-full sm:max-w-2xl max-h-[96dvh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] shadow-[0_0_120px_rgba(0,0,0,0.9)] transition-all duration-500 ${visible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'}`} style={{ scrollbarWidth: 'none' }}>
        {/* Dark bg */}
        <div className="absolute inset-0 bg-[#080f0c] rounded-t-[2rem] sm:rounded-[2rem]" />
        {/* Glow */}
        <div className="absolute inset-0 opacity-60 rounded-t-[2rem] sm:rounded-[2rem]" style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(16,185,129,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(245,158,11,0.08) 0%, transparent 50%)' }} />
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

        <div className="relative p-6 sm:p-8 md:p-10">
          <button onClick={onClose} className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/70 transition-all" aria-label="Închide">
            <X size={16} />
          </button>

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative mb-5">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.35)]">
                <Crown size={38} className="text-white" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-9 h-9 bg-zinc-900 border-2 border-white/10 rounded-full flex items-center justify-center">
                <Zap size={15} className="text-amber-400" />
              </div>
            </div>

            {/* Article preview */}
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 mb-5 w-full max-w-sm">
              <span className="text-2xl select-none">{triggerArticle.emoji}</span>
              <div className="text-left">
                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{triggerArticle.categoryLabel}</p>
                <p className="text-sm font-black text-white leading-snug">{triggerArticle.title}</p>
                <p className="text-[10px] text-white/70 mt-0.5">{triggerArticle.readTime} min · {triggerArticle.difficulty}</p>
              </div>
              <Zap size={14} className="text-amber-400 shrink-0 ml-auto" />
            </div>

            <h2 id="paywall-title" className="text-2xl sm:text-3xl font-black text-white tracking-tighter leading-tight mb-3">
              Deblochează{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-amber-400">Master Academy.</span>
              <br />Devino expertul propriei grădini.
            </h2>
            <p className="text-sm text-white/75 leading-relaxed max-w-md">
              Acces nelimitat la toate protocoalele secrete, diagnosticele AI și calculatoarele avansate pentru un an întreg.{' '}
              <span className="text-white/80 font-bold">Totul pentru prețul unei cafele în oraș.</span>
            </p>
          </div>

          {/* Price + Benefits grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            {/* Price card */}
            <div className="relative">
              <div className="flex justify-center mb-3">
                <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-1.5">
                  <Star size={12} className="text-amber-400" />
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em]">Cel mai ales plan</span>
                </div>
              </div>
              <div className="relative bg-white/5 border border-white/10 rounded-3xl p-6 text-center overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-emerald-500/10 blur-3xl rounded-full" />
                </div>
                <div className="relative flex items-center justify-center gap-3 mb-1">
                  <span className="text-white/30 line-through text-lg font-black">119 RON</span>
                  <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded-full text-[9px] font-black text-red-400 uppercase tracking-widest">−76% azi</span>
                </div>
                <div className="relative flex items-end justify-center gap-2">
                  <span className="text-6xl font-black text-white leading-none tracking-tighter">29</span>
                  <div className="flex flex-col items-start mb-2">
                    <span className="text-xl font-black text-emerald-400">RON</span>
                    <span className="text-xs font-bold text-white/40 uppercase tracking-wider">/ an</span>
                  </div>
                </div>
                <p className="relative text-[12px] text-emerald-300/80 font-bold mt-2">≈ 0.08 RON pe zi • Mai puțin decât o cafea pe lună</p>
                <div className="relative mt-3 pt-3 border-t border-white/5">
                  <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">Facturat anual · O singură plată</span>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="flex flex-col gap-4 justify-center">
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Ce deblochezi instant</p>
              {benefits.map((b, i) => <BenefitRow key={i} text={b.text} subtext={b.subtext} />)}
            </div>
          </div>

          {/* CTA area */}
          <div className="space-y-4">
            <BuyButton onClick={handleUpgrade} loading={loading} />
            <div className="flex items-start gap-3 bg-white/3 border border-white/5 rounded-2xl px-5 py-4">
              <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-white/75 leading-relaxed">
                <span className="font-black text-white/80">Fără reînnoire automată ascunsă.</span>{' '}
                Plătești o dată, ai acces complet <span className="font-black text-emerald-400">365 de zile</span>. Nicio surpriză pe card.
              </p>
            </div>
            <button onClick={onClose} className="w-full text-center text-[11px] text-white/70 hover:text-white/90 font-medium py-2 transition-colors">
              Continuă cu conținut gratuit
            </button>
          </div>

          {/* Comparison table */}
          <div className="mt-8 pt-6 border-t border-white/5">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest text-center mb-4">Gratuit vs. PRO</p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="text-white/30 font-black uppercase tracking-wider text-[9px] text-left">Funcție</div>
              <div className="text-white/30 font-black uppercase tracking-wider text-[9px]">Gratuit</div>
              <div className="text-amber-400 font-black uppercase tracking-wider text-[9px]">PRO 👑</div>
              {[
                ['Ghiduri de bază', '4', '50+'],
                ['Calculatoare tratamente', '✓', '✓ Avansat'],
                ['Modul SOS / Diagnoze', '—', '✓'],
                ['Calendar Sezonier complet', '—', '✓'],
                ['Fără reclame', '—', '✓'],
              ].map(([feat, free, pro], i) => (
                <React.Fragment key={i}>
                  <div className="text-left py-2 border-t border-white/5 text-white/50 text-[11px]">{feat}</div>
                  <div className={`py-2 border-t border-white/5 text-[11px] ${free === '—' ? 'text-white/20' : 'text-white/60'}`}>{free}</div>
                  <div className="py-2 border-t border-white/5 text-[11px] text-emerald-400 font-bold">{pro}</div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Category Filter Pill ──────────────────────────────
const CategoryPill: React.FC<{ label: string; emoji: string; active: boolean; onClick: () => void }> = ({ label, emoji, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all
      ${active
        ? 'bg-accent-color text-white shadow-lg shadow-accent-color/30'
        : 'bg-bg-card border border-border-color text-text-secondary hover:border-accent-color/30 hover:text-text-main'
      }`}
  >
    <span>{emoji}</span> {label}
  </button>
);

// ─── Article Card ──────────────────────────────────────
const ArticleCard: React.FC<{
  article: ArticleMeta;
  subscriptionTier: 'free' | 'pro' | 'enterprise' | 'lifetime';
  isRead: boolean;
  onClick: () => void;
}> = ({ article, subscriptionTier, isRead, onClick }) => {
  const isLocked = article.isPremium && subscriptionTier === 'free';
  return (
    <button
      onClick={onClick}
      className={`group relative w-full text-left rounded-3xl overflow-hidden transition-all duration-300
        bg-bg-card border border-border-color hover:shadow-2xl hover:border-accent-color/30 hover:-translate-y-1 active:translate-y-0
        ${isRead ? 'ring-2 ring-emerald-500/30' : ''}
      `}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${article.coverGradient} opacity-5 dark:opacity-100 transition-opacity`} />
      <div className="absolute inset-0 bg-white/40 dark:bg-black/40" />
      <div className="relative p-6 min-h-[200px] flex flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border backdrop-blur-sm shadow-sm
            ${article.isPremium
              ? 'bg-amber-100/80 border-amber-200 text-amber-700 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-300'
              : 'bg-emerald-100/80 border-emerald-200 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-300'
            }`}>
            {article.isPremium ? '👑 Premium' : '✓ Gratuit'}
          </span>
          <div className="flex items-center gap-2">
            {isRead && (
              <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
                <CheckCircle2 size={14} className="text-white" />
              </div>
            )}
            {isLocked && (
              <div className="w-8 h-8 bg-black/5 dark:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center border border-black/10 dark:border-white/20 shadow-sm">
                <Lock size={14} className="text-amber-500 dark:text-amber-400" />
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="text-4xl mb-3 select-none drop-shadow-md">{article.coverEmoji}</div>
          <div className="text-[10px] font-black uppercase tracking-widest text-text-secondary dark:text-white/60 mb-1">{article.categoryLabel}</div>
          <h3 className="font-black text-text-main dark:text-white text-base leading-tight mb-3 group-hover:text-accent-color dark:group-hover:text-amber-200 transition-colors drop-shadow-sm">{article.title}</h3>
          <p className="text-xs text-text-secondary dark:text-white/60 leading-relaxed line-clamp-2">{article.excerpt}</p>
          <div className="flex items-center gap-3 mt-4">
            <span className="flex items-center gap-1 text-[10px] font-bold text-text-secondary dark:text-white/50">
              <Clock size={10} /> {article.readTime} min
            </span>
            <span className="w-1 h-1 bg-border-color dark:bg-white/30 rounded-full" />
            <span className="text-[10px] font-bold text-text-secondary dark:text-white/50">{article.difficulty}</span>
            {!isLocked && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-black text-text-main dark:text-white/70 group-hover:text-accent-color dark:group-hover:text-white transition-colors uppercase tracking-widest">
                Citește <ChevronRight size={12} />
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="absolute inset-0 ring-1 ring-inset ring-black/5 dark:ring-white/5 rounded-3xl group-hover:ring-black/10 dark:group-hover:ring-white/10 transition-all pointer-events-none" />
    </button>
  );
};

// ─── Article Reader Modal ──────────────────────────────
const ArticleReader: React.FC<{
  article: ArticleMeta;
  content: string;
  onClose: () => void;
}> = ({ article, content, onClose }) => (
  <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center">
    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
    <div className="relative w-full sm:max-w-3xl max-h-[92vh] bg-bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-400 overflow-hidden">
      {/* Header */}
      <div className={`relative p-6 bg-gradient-to-br ${article.coverGradient} flex-shrink-0 dark:!bg-none`}>
        {/* Light mode specific background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${article.coverGradient} opacity-10 dark:opacity-100 transition-opacity`} />
        <div className="absolute inset-0 bg-white/60 dark:bg-black/50 backdrop-blur-[2px] dark:backdrop-blur-none" />
        <div className="relative z-10">
          <button onClick={onClose} className="absolute top-0 right-0 z-50 flex items-center gap-2 px-3 py-1.5 bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 rounded-xl text-text-secondary dark:text-white/70 text-xs font-bold transition-all cursor-pointer">
            <ArrowLeft size={14} /> Înapoi
          </button>
          <div className="text-4xl mb-3 drop-shadow-md">{article.coverEmoji}</div>
          <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary dark:text-white/60">{article.categoryLabel}</span>
          <h1 className="text-xl font-black text-text-main dark:text-white leading-tight mt-1 drop-shadow-sm">{article.title}</h1>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-text-secondary dark:text-white/60 font-bold">✍️ {article.author}</span>
            <span className="w-1 h-1 bg-border-color dark:bg-white/30 rounded-full" />
            <span className="text-xs text-text-secondary dark:text-white/60 font-bold">{article.readTime} min citire</span>
            <span className="w-1 h-1 bg-border-color dark:bg-white/30 rounded-full" />
            <span className="text-xs text-text-secondary dark:text-white/60 font-bold">{article.difficulty}</span>
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="overflow-y-auto flex-1 p-6 md:p-8">
        <div className="prose prose-sm max-w-none text-text-main space-y-4">
          {content.split('\n').map((line, i) => {
            if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-black text-text-main mt-8 mb-3 border-b border-border-color pb-2">{line.slice(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={i} className="text-base font-black text-accent-color mt-6 mb-2">{line.slice(4)}</h3>;
            if (line.startsWith('# ') || line.startsWith('---') || line.startsWith('| ')) return null;
            if (line.startsWith('- **')) {
              const parts = line.slice(2).split('**');
              return <li key={i} className="text-sm text-text-main font-medium ml-4"><strong className="text-text-main">{parts[1]}</strong>{parts[2]}</li>;
            }
            if (line.startsWith('**')) return <p key={i} className="text-sm font-bold text-text-main">{line.replace(/\*\*/g, '')}</p>;
            if (line.trim() === '') return <div key={i} className="h-2" />;
            return <p key={i} className="text-sm text-text-main font-medium leading-relaxed">{line}</p>;
          })}
        </div>
        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border-color">
          {article.tags.map(tag => (
            <span key={tag} className="px-3 py-1 bg-bg-main border border-border-color rounded-full text-[10px] font-black uppercase tracking-widest text-text-secondary">#{tag}</span>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ─── Main Academy Component ────────────────────────────
export const Academy: React.FC<Props> = ({ subscriptionTier: externalSubscriptionTier = 'free', onNavigateToUpgrade }) => {
  const isPro = externalSubscriptionTier !== 'free';
  const { i18n } = useTranslation();
  const { organization } = useData();
  const lang = i18n.language?.startsWith('en') ? 'en' : 'ro';

  const [activeCategory, setActiveCategory] = useState('all');
  const [paywallArticle, setPaywallArticle] = useState<ArticleMeta | null>(null);
  const [openArticle, setOpenArticle] = useState<ArticleMeta | null>(null);
  const [articleContent, setArticleContent] = useState('');
  const [loadingArticleId, setLoadingArticleId] = useState<string | null>(null);
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  const [readArticles, setReadArticles] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('landscapeos_read_articles');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const articles = getArticlesByLang(lang);
  const freeCount = getFreeArticleCount(lang);
  const totalCount = getTotalArticleCount(lang);
  const readCount = articles.filter(a => readArticles.has(a.id)).length;

  const filteredArticles = useMemo(() =>
    activeCategory === 'all' ? articles : articles.filter(a => a.category === activeCategory),
    [articles, activeCategory]
  );

  const availableCategories = useMemo(() => {
    const cats = [...new Set(articles.map(a => a.category))];
    return ACADEMY_CATEGORIES.filter(c => cats.includes(c.id));
  }, [articles]);

  const markRead = (id: string) => {
    setReadArticles(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem('landscapeos_read_articles', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const handleArticleClick = async (article: ArticleMeta) => {
    if (article.isPremium && !isPro) {
      setPaywallArticle(article);
      return;
    }
    setLoadingArticleId(article.id);
    try {
      const headers: Record<string, string> = {};
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/academy/article?id=${article.id}`, { headers });
      if (!res.ok) {
        if (res.status === 403) { toast.error('Acces refuzat: Necesită abonament PRO'); setPaywallArticle(article); return; }
        throw new Error(`Failed to load article: ${res.statusText}`);
      }
      const text = await res.text();
      setArticleContent(text);
      setOpenArticle(article);
      markRead(article.id);
    } catch (err) {
      console.error(err);
      toast.error('Eroare la încărcarea articolului');
      const fallback = `# ${article.title}\n\n${article.excerpt}\n\n## Conținut indisponibil momentan\n\nNu am putut încărca articolul de pe server. Te rugăm să verifici conexiunea la internet și să încerci din nou.`;
      setArticleContent(fallback);
      setOpenArticle(article);
    } finally {
      setLoadingArticleId(null);
    }
  };

  // Deep-link handoff from SmartTroubleshooter's "Vezi Ghidul Complet" button.
  // sessionStorage (not a hash query param) because App.tsx's hashchange
  // handler requires an exact Page match and would bounce '#academy?article=x'
  // straight back to the Dashboard.
  useEffect(() => {
    let slug: string | null = null;
    try { slug = sessionStorage.getItem('academy_open_slug'); } catch {}
    if (!slug) return;
    try { sessionStorage.removeItem('academy_open_slug'); } catch {}
    const article = articles.find(a => a.slug === slug);
    if (article) handleArticleClick(article);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressPct = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-3xl mb-8 p-8 md:p-10 border border-emerald-500/20 dark:border-none shadow-xl shadow-emerald-500/5 dark:shadow-none">
        {/* Light Mode Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:hidden" />
        {/* Dark Mode Background */}
        <div className="absolute inset-0 hidden dark:block bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950" />
        
        <div className="absolute inset-0 opacity-40 dark:opacity-30" style={{ backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(16,185,129,0.3) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(6,182,212,0.2) 0%, transparent 50%)' }} />
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-5" style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <GraduationCap size={24} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.3em]">My Garden</p>
                <h1 className="text-2xl md:text-3xl font-black text-emerald-950 dark:text-white tracking-tighter leading-none">Master Academy</h1>
              </div>
            </div>
            <p className="text-emerald-900/70 dark:text-white/60 text-sm font-medium max-w-lg leading-relaxed">
              Enciclopedie Horticolă. Protocoale scrise de agronomi cu experiență de teren, bazate pe știință, nu pe intuiție.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-5">
              <div className="flex items-center gap-2 bg-emerald-900/5 dark:bg-white/5 border border-emerald-900/10 dark:border-white/10 rounded-xl px-3 py-2">
                <BookOpen size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-black text-emerald-950 dark:text-white">{totalCount} Ghiduri</span>
              </div>
              <div className="flex items-center gap-2 bg-emerald-900/5 dark:bg-white/5 border border-emerald-900/10 dark:border-white/10 rounded-xl px-3 py-2">
                <CheckCircle2 size={14} className="text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-black text-emerald-950 dark:text-white">{freeCount} Gratuite</span>
              </div>
              <div className="flex items-center gap-2 bg-emerald-900/5 dark:bg-white/5 border border-emerald-900/10 dark:border-white/10 rounded-xl px-3 py-2">
                <Globe size={14} className="text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-black text-emerald-950 dark:text-white">10+ Limbi</span>
              </div>
            </div>
          </div>

          {/* Progress widget */}
          <div className="shrink-0 bg-white/60 dark:bg-white/5 border border-emerald-900/10 dark:border-white/10 rounded-3xl p-6 backdrop-blur-md min-w-[200px] shadow-sm dark:shadow-none">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-black text-emerald-900/70 dark:text-white/70 uppercase tracking-widest">Progresul Tău</span>
            </div>
            <div className="text-4xl font-black text-emerald-950 dark:text-white mb-1">
              {readCount}<span className="text-xl text-emerald-900/40 dark:text-white/40">/{totalCount}</span>
            </div>
            <p className="text-xs text-emerald-900/50 dark:text-white/40 font-bold mb-4">ghiduri citite</p>
            <div className="w-full h-2 bg-emerald-900/10 dark:bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 dark:to-cyan-400 rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-[10px] font-black text-emerald-900/40 dark:text-white/30 mt-2 text-right">{progressPct}% complet</p>
            {!isPro && (
              <button onClick={onNavigateToUpgrade} className="mt-4 w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-amber-400 dark:to-amber-600 text-black text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                <Crown size={14} /> Upgrade PRO
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Interactive Tools Banners ── */}
      <div className="mb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Asistent Noua Peluză */}
          <div className="relative overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-bg-card to-bg-card p-6 md:p-8 flex flex-col justify-between shadow-md hover:shadow-lg transition-all group">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 rounded-[2rem] blur opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
                  <Sprout size={24} className="group-hover:animate-bounce" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.25em]">Ghidare Pas cu Pas</span>
                  <h3 className="text-lg font-black text-text-main leading-tight mt-0.5">Asistent Noua Peluză</h3>
                </div>
              </div>
              <p className="text-xs text-text-secondary font-medium leading-relaxed max-w-sm mb-6">
                Calculează necesarul de semințe, protocolul de sol și timpii optimi de germinare personalizați pentru curtea ta.
              </p>
            </div>
            <button
              onClick={() => setShowAIAssistant(true)}
              className="relative z-10 w-full sm:w-auto self-start px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-md shadow-emerald-950/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              Lansează Asistentul <ChevronRight size={12} />
            </button>
          </div>

          {/* Doctorul Grădinii */}
          <div className="relative overflow-hidden rounded-[2rem] border border-red-500/20 bg-gradient-to-br from-red-950/30 via-bg-card to-bg-card p-6 md:p-8 flex flex-col justify-between shadow-md hover:shadow-lg transition-all group">
            <div className="absolute -inset-1 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 rounded-[2rem] blur opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center shrink-0 shadow-inner">
                  <AlertTriangle size={24} className="group-hover:animate-pulse" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-[0.25em]">Diagnostic SOS</span>
                  <h3 className="text-lg font-black text-text-main leading-tight mt-0.5">Doctorul Grădinii</h3>
                </div>
              </div>
              <p className="text-xs text-text-secondary font-medium leading-relaxed max-w-sm mb-6">
                Pete uscate sau galbene? Diagnostichează rapid problemele gazonului și obține tratamente bazate pe știință.
              </p>
            </div>
            <button
              onClick={() => setShowTroubleshooter(true)}
              className="relative z-10 w-full sm:w-auto self-start px-5 py-3 bg-red-500 hover:bg-red-400 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-md shadow-red-950/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              Diagnostichează Acum <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Category Filters ── */}
      <div className="flex items-center gap-3 overflow-x-auto pb-3 scrollbar-hide mb-8 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
        <CategoryPill label="Toate" emoji="📚" active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} />
        {availableCategories.map(cat => (
          <CategoryPill
            key={cat.id}
            label={lang === 'ro' ? cat.labelRo : cat.labelEn}
            emoji={cat.emoji}
            active={activeCategory === cat.id}
            onClick={() => setActiveCategory(cat.id)}
          />
        ))}
      </div>

      {/* ── Upgrade Banner (if not PRO) ── */}
      {!isPro && (
        <div className="relative overflow-hidden rounded-3xl mb-8 border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-bg-card to-bg-card p-5 flex flex-col sm:flex-row items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <Crown size={20} className="text-amber-500 dark:text-amber-400" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="font-black text-text-main text-sm">Ai acces la {freeCount}/{totalCount} ghiduri</p>
            <p className="text-xs text-text-secondary">Upgrade la PRO pentru acces complet la toate protocoalele avansate.</p>
          </div>
          <button
            onClick={onNavigateToUpgrade}
            className="shrink-0 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
          >
            <Zap size={14} /> Deblochează Tot
          </button>
        </div>
      )}

      {/* ── Articles: Netflix (all) or Grid (category) ── */}
      {activeCategory === 'all' ? (
        <div className="space-y-12 mb-12">
          {availableCategories.map(cat => {
            const catArticles = articles.filter(a => a.category === cat.id);
            if (catArticles.length === 0) return null;
            return (
              <div key={cat.id} className="relative">
                <div className="flex items-end justify-between mb-4 px-1">
                  <div>
                    <h2 className="text-lg font-black text-text-main flex items-center gap-2">
                      <span className="text-xl select-none">{cat.emoji}</span>
                      {lang === 'ro' ? cat.labelRo : cat.labelEn}
                    </h2>
                    <p className="text-xs text-text-secondary mt-1 font-medium max-w-xl">{cat.description}</p>
                  </div>
                </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-1 px-1">
                  {catArticles.map(article => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      subscriptionTier={externalSubscriptionTier}
                      isRead={readArticles.has(article.id)}
                      onClick={() => handleArticleClick(article)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6 px-1">
            <span className="text-2xl select-none">{availableCategories.find(c => c.id === activeCategory)?.emoji || '📚'}</span>
            <h2 className="text-xl font-black text-text-main">
              {lang === 'ro'
                ? availableCategories.find(c => c.id === activeCategory)?.labelRo
                : availableCategories.find(c => c.id === activeCategory)?.labelEn
              }
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredArticles.map(article => (
              <ArticleCard
                key={article.id}
                article={article}
                subscriptionTier={externalSubscriptionTier}
                isRead={readArticles.has(article.id)}
                onClick={() => handleArticleClick(article)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Myth Busters Section ── */}
      <div className="mb-10">
        <h2 className="text-xl font-black text-text-main mb-1 flex items-center gap-3">
          <AlertTriangle className="text-red-600 dark:text-red-400" size={22} />
          BUSTED: Erori Critice
        </h2>
        <p className="text-sm text-text-secondary mb-6">Cele mai comune mituri care distrug grădinile.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            {
              myth: '"Dau cu Erbicid Total și curăț terenul!"',
              truth: 'Glifosatul nu afectează semințele latente din sol. La prima udare a noului gazon, cele milioane de semințe de buruieni vor germina simultan.',
            },
            {
              myth: '"Pun pământ de umplutură peste iarba veche"',
              truth: 'Putrefacția anaerobă eliberează hidrogen sulfurat toxic. Rădăcinile noului gazon vor fi asfixiate, terenul se va lăsa neuniform.',
            },
            {
              myth: '"Semințele se greblează în pământ"',
              truth: 'Semințele de gazon NECESITĂ lumină pentru germinație. Se acoperă cu 1-1.5 cm de nisip fin (top-dressing) și se tăvălugesc.',
            },
            {
              myth: '"Ud gazonul în fiecare seară câte 10 minute"',
              truth: 'Irigarea seara + frunza umedă = 12 ore de incubație fungică. Udările scurte mențin rădăcinile la suprafață, vulnerabile la secetă.',
            },
          ].map(({ myth, truth }) => (
            <div key={myth} className="bg-bg-card border border-border-color rounded-3xl p-6 relative overflow-hidden group hover:border-red-500/20 transition-all">
              <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-2xl">BUSTED</div>
              <h4 className="font-black text-red-600 dark:text-red-400 mt-4 mb-3 leading-tight text-sm pr-16">{myth}</h4>
              <p className="text-xs text-text-secondary font-medium leading-relaxed">{truth}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modals ── */}
      {showAIAssistant && (
        <AIAssistantModal onClose={() => setShowAIAssistant(false)} />
      )}

      {showTroubleshooter && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowTroubleshooter(false)} />
          <div className="relative w-full sm:max-w-2xl bg-bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => setShowTroubleshooter(false)}
              className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full bg-bg-main hover:bg-border-color border border-border-color text-text-secondary hover:text-text-main transition-all z-10"
              aria-label="Închide"
            >
              <X size={16} />
            </button>
            <div className="mt-4">
              <SmartTroubleshooter />
            </div>
          </div>
        </div>
      )}

      {paywallArticle && (
        <PremiumUpgradeModal
          triggerArticle={{
            title: paywallArticle.title,
            emoji: paywallArticle.coverEmoji,
            categoryLabel: paywallArticle.categoryLabel,
            readTime: paywallArticle.readTime,
            difficulty: paywallArticle.difficulty,
            coverGradient: paywallArticle.coverGradient,
          }}
          onClose={() => setPaywallArticle(null)}
          onUpgrade={async () => {
            try {
              const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
              const base = `${window.location.origin}${window.location.pathname}`;
              const result: any = await createCheckoutSession({
                successUrl: `${base}#academy?upgraded=1`,
                cancelUrl: `${base}#academy`,
              });
              const url = result?.data?.url;
              if (!url) throw new Error('No checkout URL returned.');
              window.location.href = url;
            } catch (err: any) {
              console.error(err);
              const message: string = err?.message || '';
              if (message.includes('not configured')) {
                toast.error('Plățile online nu sunt încă active. Contactează-ne pentru un cod de acces.');
              } else {
                toast.error('Nu am putut iniția plata. Încearcă din nou.');
              }
              setPaywallArticle(null);
            }
          }}
        />
      )}

      {openArticle && (
        <ArticleReader article={openArticle} content={articleContent} onClose={() => setOpenArticle(null)} />
      )}

      {/* Loading Overlay */}
      {loadingArticleId && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-card border-2 border-border-color p-6 rounded-3xl flex flex-col items-center gap-3 shadow-2xl">
            <div className="w-8 h-8 border-2 border-accent-color/30 border-t-accent-color rounded-full animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest text-text-main">Se descarcă articolul...</p>
          </div>
        </div>
      )}
    </div>
  );
};