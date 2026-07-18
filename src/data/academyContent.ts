// ============================================================
// ACADEMY CONTENT REGISTRY
// This is the source of truth for all articles in the Academy.
// Articles are stored as .md files in content/academy/{lang}/
// This registry provides frontmatter metadata for UI rendering
// WITHOUT reading the full file contents (keeping it fast & cheap).
// Full content is lazy-loaded only when an article is opened.
// ============================================================

export type ArticleCategory =
  | 'protocoale-baza'
  | 'managementul-bolilor'
  | 'chimie-tratamente'
  | 'sezonalitate'
  | 'echipamente'
  | 'core-protocols'
  | 'disease-management'
  | 'chemistry-treatments';

export interface ArticleMeta {
  id: string;
  slug: string;
  lang: 'ro' | 'en' | 'de' | 'nl' | 'fr';
  title: string;
  excerpt: string;
  category: ArticleCategory;
  categoryLabel: string;
  isPremium: boolean;
  readTime: number; // minutes
  difficulty: 'Începător' | 'Intermediar' | 'Avansat' | 'Beginner' | 'Intermediate' | 'Advanced';
  author: string;
  coverGradient: string; // Tailwind gradient classes
  coverEmoji: string;
  tags: string[];
  // Content file path (relative to project root)
  contentPath: string;
}

export interface ArticleCategory_Config {
  id: ArticleCategory;
  labelRo: string;
  labelEn: string;
  description: string;
  color: string; // accent color class
  bgGradient: string;
  emoji: string;
  totalFree: number;
  totalPremium: number;
}

// ────────────────────────────────────────────────
// CATEGORIES
// ────────────────────────────────────────────────
export const ACADEMY_CATEGORIES: ArticleCategory_Config[] = [
  {
    id: 'protocoale-baza',
    labelRo: 'Protocoale de Bază',
    labelEn: 'Core Protocols',
    description: 'Fundamentele biologice ale gazonului sănătos. Irigare, tundere, sol.',
    color: 'text-cyan-400',
    bgGradient: 'from-cyan-950 via-blue-950 to-slate-950',
    emoji: '📋',
    totalFree: 2,
    totalPremium: 6
  },
  {
    id: 'managementul-bolilor',
    labelRo: 'Managementul Bolilor',
    labelEn: 'Disease Management',
    description: 'Diagnosticare vizuală rapidă și protocoale de tratament pentru ciuperci, bacterii și dăunători.',
    color: 'text-red-400',
    bgGradient: 'from-red-950 via-rose-950 to-slate-950',
    emoji: '🔬',
    totalFree: 1,
    totalPremium: 8
  },
  {
    id: 'chimie-tratamente',
    labelRo: 'Chimie & Tratamente',
    labelEn: 'Chemistry & Treatments',
    description: 'pH, NPK, blocaj mineral. Îngrășăminte, fungicide și insecticide — știința din spatele etichetelor.',
    color: 'text-amber-400',
    bgGradient: 'from-amber-950 via-orange-950 to-slate-950',
    emoji: '🧪',
    totalFree: 1,
    totalPremium: 7
  },
  {
    id: 'sezonalitate',
    labelRo: 'Calendar Sezonier',
    labelEn: 'Seasonal Calendar',
    description: 'Ce faci lună de lună. Protocoale complete pentru fiecare sezon, de la spargerea geții la pregătirea de iernare.',
    color: 'text-green-400',
    bgGradient: 'from-green-950 via-emerald-950 to-slate-950',
    emoji: '🗓️',
    totalFree: 2,
    totalPremium: 10
  },
  {
    id: 'echipamente',
    labelRo: 'Echipamente & Mașini',
    labelEn: 'Equipment & Machinery',
    description: 'Întreținere preventivă, greșeli de reglaj și cum să prelungești viața sculelor tale.',
    color: 'text-violet-400',
    bgGradient: 'from-violet-950 via-purple-950 to-slate-950',
    emoji: '⚙️',
    totalFree: 1,
    totalPremium: 4
  }
];

// ────────────────────────────────────────────────
// ARTICLE REGISTRY (Română)
// ────────────────────────────────────────────────
export const ARTICLES_RO: ArticleMeta[] = [
  {
    id: 'ro-irigare-regula',
    slug: 'regula-irigarii',
    lang: 'ro',
    title: 'Ghidul Suprem de Irigare & Protocolul de Însămânțare',
    excerpt: 'Fizica solului, testul caserolelor, diagnosticul stresului hidric și regula critică de udare a semințelor noi.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    isPremium: false,
    readTime: 6,
    difficulty: 'Începător',
    author: 'Agr. Andrei Constantin',
    coverGradient: 'from-blue-900 via-cyan-900 to-teal-800',
    coverEmoji: '💧',
    tags: ['irigare', 'apa', 'radacini', 'gazon'],
    contentPath: 'content/academy/ro/regula-irigarii.md'
  },
  {
    id: 'ro-ghid-insamantare',
    slug: 'ghid-insamantare',
    lang: 'ro',
    title: 'Ghidul Complet: Pregătirea Terenului și Însămânțarea',
    excerpt: 'Erori critice la pregătirea terenului, selecția semințelor și ingineria germinației.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    isPremium: true,
    readTime: 10,
    difficulty: 'Avansat',
    author: 'Agr. Andrei Constantin',
    coverGradient: 'from-emerald-900 via-green-900 to-teal-900',
    coverEmoji: '🌱',
    tags: ['insamantare', 'teren', 'seminte', 'gazon'],
    contentPath: 'content/academy/ro/ghid-insamantare.md'
  },
  {
    id: 'ro-chimia-solului',
    slug: 'chimia-solului',
    lang: 'ro',
    title: 'Chimia Solului: pH, Macronutrienți și Blocaj Mineral',
    excerpt: 'De ce arunci bani pe îngrășăminte și nu vezi rezultate? 90% din cazuri = pH incorect.',
    category: 'chimie-tratamente',
    categoryLabel: 'Chimie & Tratamente',
    isPremium: true,
    readTime: 12,
    difficulty: 'Avansat',
    author: 'Ing. Agr. Maria Petrescu',
    coverGradient: 'from-amber-900 via-orange-900 to-red-900',
    coverEmoji: '🧪',
    tags: ['chimie', 'ph', 'ingrasaminte', 'sol', 'NPK'],
    contentPath: 'content/academy/ro/chimia-solului.md'
  },
  {
    id: 'ro-fungicide',
    slug: 'protocoale-fungicide',
    lang: 'ro',
    title: 'Protocolul Complet al Fungicidelor',
    excerpt: 'Brown Patch, Pythium, Fusarium — cum identifici boala, ce produs aplici, și de ce ordinea contează.',
    category: 'managementul-bolilor',
    categoryLabel: 'Managementul Bolilor',
    isPremium: true,
    readTime: 10,
    difficulty: 'Avansat',
    author: 'Ing. Agr. Maria Petrescu',
    coverGradient: 'from-green-900 via-emerald-900 to-teal-900',
    coverEmoji: '🔬',
    tags: ['fungicide', 'boli', 'brown-patch', 'pythium'],
    contentPath: 'content/academy/ro/protocoale-fungicide.md'
  },
  // ── Placeholder articles (to be written) ──
  {
    id: 'ro-regula-o-treime',
    slug: 'regula-o-treime-tundere',
    lang: 'ro',
    title: 'Regula 1/3 la Tundere: Fiziologia Stresului',
    excerpt: 'Tăierea agresivă ucide gazonul lent. Înțelege bilanțul energetic al plantei înainte de a apăsa pe trăgaci.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    isPremium: false,
    readTime: 5,
    difficulty: 'Începător',
    author: 'Agr. Andrei Constantin',
    coverGradient: 'from-emerald-900 via-green-900 to-lime-900',
    coverEmoji: '✂️',
    tags: ['tundere', 'stres', 'gazon'],
    contentPath: 'content/academy/ro/regula-o-treime-tundere.md'
  },
  {
    id: 'ro-top-dressing',
    slug: 'top-dressing-nisip',
    lang: 'ro',
    title: 'Top-Dressing: Arta Nivelării cu Nisip',
    excerpt: 'De ce nisipul spălat este cel mai bun prieten al gazonului. Protocol complet de aplicare și alegerea granulometriei corecte.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    isPremium: true,
    readTime: 8,
    difficulty: 'Intermediar',
    author: 'Agr. Andrei Constantin',
    coverGradient: 'from-yellow-900 via-amber-900 to-orange-800',
    coverEmoji: '⛱️',
    tags: ['top-dressing', 'nisip', 'nivelare'],
    contentPath: 'content/academy/ro/top-dressing-nisip.md'
  },
  {
    id: 'ro-aerare-scarificare',
    slug: 'aerare-scarificare-completa',
    lang: 'ro',
    title: 'Aerare & Scarificare: Respirația Solului',
    excerpt: 'Solul compactat ucide rădăcinile prin asfixiere. Protocolul complet pentru primăvară și toamnă.',
    category: 'sezonalitate',
    categoryLabel: 'Calendar Sezonier',
    isPremium: true,
    readTime: 9,
    difficulty: 'Intermediar',
    author: 'Agr. Andrei Constantin',
    coverGradient: 'from-teal-900 via-cyan-900 to-sky-900',
    coverEmoji: '🌬️',
    tags: ['aerare', 'scarificare', 'sol', 'primavara'],
    contentPath: 'content/academy/ro/aerare-scarificare-completa.md'
  },
  {
    id: 'ro-erbicide-selective',
    slug: 'erbicide-selective-gazon',
    lang: 'ro',
    title: 'Erbicide Selective: Cum Ucizi Buruiana fără să Distrugi Gazonul',
    excerpt: 'Diferența dintre monocotiledonate și dicotiledonate determină ce erbicid poți folosi. Ghid complet cu produse și doze.',
    category: 'chimie-tratamente',
    categoryLabel: 'Chimie & Tratamente',
    isPremium: true,
    readTime: 11,
    difficulty: 'Avansat',
    author: 'Ing. Agr. Maria Petrescu',
    coverGradient: 'from-red-900 via-rose-900 to-pink-900',
    coverEmoji: '☠️',
    tags: ['erbicide', 'buruieni', 'selective', 'chimie'],
    contentPath: 'content/academy/ro/erbicide-selective-gazon.md'
  },
  {
    id: 'ro-insecticide-viermi',
    slug: 'insecticide-viermi-sol',
    lang: 'ro',
    title: 'Dăunători Subterani: Viermii Albi și Scotocitoarele',
    excerpt: 'Gazonul se ridică ca un covor? Probabilitate 90% = larvele de cărăbuș. Protocol complet de combatere.',
    category: 'managementul-bolilor',
    categoryLabel: 'Managementul Bolilor',
    isPremium: true,
    readTime: 7,
    difficulty: 'Avansat',
    author: 'Ing. Agr. Maria Petrescu',
    coverGradient: 'from-slate-900 via-zinc-900 to-stone-900',
    coverEmoji: '🪲',
    tags: ['insecticide', 'daunatori', 'viermi', 'carplus'],
    contentPath: 'content/academy/ro/insecticide-viermi-sol.md'
  },
  {
    id: 'ro-fertilizare-starter',
    slug: 'fertilizare-starter-nou-gazon',
    lang: 'ro',
    title: 'Fertilizarea Starter: Fosforul și Rădăcina Nouă',
    excerpt: 'La semănat nou, Fosforul (P) este regele. De ce îngrășământul de lawn universal strică gazonul nou și ce să folosești în schimb.',
    category: 'sezonalitate',
    categoryLabel: 'Calendar Sezonier',
    isPremium: false,
    readTime: 6,
    difficulty: 'Începător',
    author: 'Agr. Andrei Constantin',
    coverGradient: 'from-lime-900 via-green-900 to-emerald-900',
    coverEmoji: '🌱',
    tags: ['fertilizare', 'starter', 'fosfor', 'gazon-nou'],
    contentPath: 'content/academy/ro/fertilizare-starter-nou-gazon.md'
  },
  {
    id: 'ro-iernare-gazon',
    slug: 'iernare-gazon-protocol',
    lang: 'ro',
    title: 'Iernarea Gazonului: Pregătirea pentru Îngheț',
    excerpt: 'Ultima fertilizare, înălțimea de tundere de toamnă și de ce gazonul negrit iarna nu e neapărat mort.',
    category: 'sezonalitate',
    categoryLabel: 'Calendar Sezonier',
    isPremium: true,
    readTime: 8,
    difficulty: 'Intermediar',
    author: 'Agr. Andrei Constantin',
    coverGradient: 'from-blue-950 via-indigo-950 to-slate-950',
    coverEmoji: '❄️',
    tags: ['iernare', 'toamna', 'potasiu', 'frig'],
    contentPath: 'content/academy/ro/iernare-gazon-protocol.md'
  },
  {
    id: 'ro-brown-patch-vara',
    slug: 'brown-patch-vara',
    lang: 'ro',
    title: 'Boli de Vară: Cum oprești Brown Patch în 24 de ore',
    excerpt: 'Identificarea corectă a inelului de fum și intervenția chimică de urgență pentru a salva gazonul.',
    category: 'managementul-bolilor',
    categoryLabel: 'Managementul Bolilor',
    isPremium: true,
    readTime: 5,
    difficulty: 'Intermediar',
    author: 'Ing. Agr. Maria Petrescu',
    coverGradient: 'from-orange-900 via-red-900 to-rose-900',
    coverEmoji: '🔥',
    tags: ['boli', 'vara', 'brown-patch', 'fungicid'],
    contentPath: 'content/academy/ro/brown-patch-vara.md'
  },
  {
    id: 'ro-calendar-primavara',
    slug: 'calendar-primavara',
    lang: 'ro',
    title: 'Calendar Primăvară: Primele lucrări după topirea zăpezii',
    excerpt: 'Pașii exacți pe care trebuie să îi faci în martie/aprilie pentru a ieși din iarnă cu o peluză perfectă.',
    category: 'sezonalitate',
    categoryLabel: 'Calendar Sezonier',
    isPremium: false,
    readTime: 7,
    difficulty: 'Începător',
    author: 'Agr. Andrei Constantin',
    coverGradient: 'from-green-600 via-emerald-600 to-teal-600',
    coverEmoji: '🌸',
    tags: ['primavara', 'calendar', 'sezonal', 'curatenie'],
    contentPath: 'content/academy/ro/calendar-primavara.md'
  },
  {
    id: 'ro-ascutire-cutit-masina',
    slug: 'ascutire-cutit-masina',
    lang: 'ro',
    title: 'Întreținere: De ce cuțitul bont distruge gazonul și cum îl ascuți',
    excerpt: 'Fiziologia tăieturii și cum un cuțit neascuțit favorizează bolile și deshidratarea plantei.',
    category: 'echipamente',
    categoryLabel: 'Echipamente & Mașini',
    isPremium: true,
    readTime: 6,
    difficulty: 'Intermediar',
    author: 'Ing. Mihai Stan',
    coverGradient: 'from-slate-700 via-gray-800 to-zinc-900',
    coverEmoji: '🔪',
    tags: ['echipamente', 'tuns', 'ascutire', 'intretinere'],
    contentPath: 'content/academy/ro/ascutire-cutit-masina.md'
  }
];

// ────────────────────────────────────────────────
// ARTICLE REGISTRY (English)
// ────────────────────────────────────────────────
export const ARTICLES_EN: ArticleMeta[] = [
  {
    id: 'en-irrigation-rule',
    slug: 'irrigation-rule',
    lang: 'en',
    title: 'The Golden Rule of Irrigation: Deep and Infrequent',
    excerpt: 'The biggest mistake amateur gardeners make is short daily watering. Discover root physiology.',
    category: 'core-protocols',
    categoryLabel: 'Core Protocols',
    isPremium: false,
    readTime: 6,
    difficulty: 'Beginner',
    author: 'Agr. Andrei Constantin',
    coverGradient: 'from-blue-900 via-cyan-900 to-teal-800',
    coverEmoji: '💧',
    tags: ['irrigation', 'water', 'roots', 'lawn'],
    contentPath: 'content/academy/en/irrigation-rule.md'
  },
  {
    id: 'en-soil-chemistry',
    slug: 'soil-chemistry',
    lang: 'en',
    title: 'Soil Chemistry: pH, Macronutrients & Mineral Lockout',
    excerpt: 'Why do you spend money on fertilizers and see no results? 90% of cases = wrong pH.',
    category: 'chemistry-treatments',
    categoryLabel: 'Chemistry & Treatments',
    isPremium: true,
    readTime: 12,
    difficulty: 'Advanced',
    author: 'Ing. Agr. Maria Petrescu',
    coverGradient: 'from-amber-900 via-orange-900 to-red-900',
    coverEmoji: '🧪',
    tags: ['chemistry', 'ph', 'fertilizers', 'soil', 'NPK'],
    contentPath: 'content/academy/en/soil-chemistry.md'
  }
];

// Helper: get articles by language
export const getArticlesByLang = (lang: 'ro' | 'en'): ArticleMeta[] => {
  return lang === 'en' ? ARTICLES_EN : ARTICLES_RO;
};

// Helper: get free articles count
export const getFreeArticleCount = (lang: 'ro' | 'en') => {
  const articles = getArticlesByLang(lang);
  return articles.filter(a => !a.isPremium).length;
};

// Helper: get total articles count
export const getTotalArticleCount = (lang: 'ro' | 'en') => {
  return getArticlesByLang(lang).length;
};
