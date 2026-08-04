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
  | 'specii-plante'
  | 'amenajare-design'
  | 'irigatii'
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
  // Optional secondary categories. `category` still drives the cover
  // display and the Netflix-row grouping on "Toate"; this only widens
  // which category filters the article also matches under, for articles
  // that genuinely straddle more than one topic (e.g. a fungicide
  // protocol is both disease management and chemistry/treatments).
  categories?: ArticleCategory[];
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
    labelRo: 'Erbicide & Tratamente',
    labelEn: 'Herbicides & Treatments',
    description: 'pH, NPK, blocaj mineral. Îngrășăminte, erbicide, fungicide și insecticide — știința din spatele etichetelor.',
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
  },
  {
    id: 'specii-plante',
    labelRo: 'Specii de Plante',
    labelEn: 'Plant Species',
    description: 'Ghiduri complete de specii — copaci, arbuști și flori de grădină — pe categorii, cu cerințe reale de sol, lumină și climat.',
    color: 'text-lime-400',
    bgGradient: 'from-lime-950 via-green-950 to-slate-950',
    emoji: '🌳',
    totalFree: 0,
    totalPremium: 0
  },
  {
    id: 'amenajare-design',
    labelRo: 'Amenajare & Design',
    labelEn: 'Landscaping & Design',
    description: 'Principii de amenajare, proiectarea unei grădini de la zero și planificarea spațiilor verzi.',
    color: 'text-fuchsia-400',
    bgGradient: 'from-fuchsia-950 via-purple-950 to-slate-950',
    emoji: '🎨',
    totalFree: 0,
    totalPremium: 0
  },
  {
    id: 'irigatii',
    labelRo: 'Irigații',
    labelEn: 'Irrigation',
    description: 'Reguli de udare, diagnosticul stresului hidric și planificarea unui sistem de irigații pentru curte.',
    color: 'text-sky-400',
    bgGradient: 'from-sky-950 via-blue-950 to-slate-950',
    emoji: '💧',
    totalFree: 0,
    totalPremium: 0
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
    categories: ['irigatii'],
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
    excerpt: 'De ce arunci bani pe îngrășăminte și nu vezi rezultate? 90% din cazuri = pH incorect. Cum decodezi NPK-ul de pe etichetă și corectezi pH-ul real al solului tău.',
    category: 'chimie-tratamente',
    categoryLabel: 'Erbicide & Tratamente',
    isPremium: true,
    readTime: 6,
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
    excerpt: 'Brown Patch, Pythium, Dollar Spot — cum identifici boala, contact vs. sistemic, rotația substanțelor active și ce poate (și nu poate) face cuprul pe gazon.',
    category: 'managementul-bolilor',
    categoryLabel: 'Managementul Bolilor',
    categories: ['chimie-tratamente'],
    isPremium: true,
    readTime: 5,
    difficulty: 'Avansat',
    author: 'Ing. Agr. Maria Petrescu',
    coverGradient: 'from-green-900 via-emerald-900 to-teal-900',
    coverEmoji: '🔬',
    tags: ['fungicide', 'boli', 'brown-patch', 'pythium'],
    contentPath: 'content/academy/ro/protocoale-fungicide.md'
  },
  {
    id: 'ro-cupru-pomi-fructiferi',
    slug: 'cupru-tratamente-pomi-fructiferi',
    lang: 'ro',
    title: 'Cuprul la Pomii Fructiferi: Ghidul Complet pe Sezon',
    excerpt: 'Hidroxid, oxiclorură, sulfat tribazic, piatra vânătă sau zeamă bordeleză? Ce cupru folosești toamna, iarna și la dezmugurire — pe înțelesul tuturor, fără jargon de agronomie.',
    category: 'chimie-tratamente',
    categoryLabel: 'Erbicide & Tratamente',
    categories: ['managementul-bolilor'],
    isPremium: true,
    readTime: 9,
    difficulty: 'Intermediar',
    author: 'Ing. Agr. Maria Petrescu',
    coverGradient: 'from-orange-950 via-amber-900 to-stone-900',
    coverEmoji: '🍎',
    tags: ['cupru', 'fungicid', 'pomi fructiferi', 'repaus vegetativ', 'dezmugurire', 'piatra vanata'],
    contentPath: 'content/academy/ro/cupru-tratamente-pomi-fructiferi.md'
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
    title: 'Erbicide pentru Gazon: 13 Produse Reale de pe Piață, cu Doze și Explicații',
    excerpt: 'Dicopur, Cerlit, Foxtrot, Banvel, Lontrel, Stomp Aqua, Glifosat și altele — ce conțin, cum acționează, ce buruiană omoară fiecare și când le aplici.',
    category: 'chimie-tratamente',
    categoryLabel: 'Erbicide & Tratamente',
    isPremium: true,
    readTime: 20,
    difficulty: 'Avansat',
    author: 'Ing. Agr. Maria Petrescu',
    coverGradient: 'from-red-900 via-rose-900 to-pink-900',
    coverEmoji: '☠️',
    tags: ['erbicide', 'buruieni', 'selective', 'chimie', 'produse'],
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
    categories: ['chimie-tratamente'],
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
    categories: ['chimie-tratamente', 'sezonalitate'],
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
  },
  {
    id: 'ro-buruieni-gazon-ghid',
    slug: 'buruieni-gazon-ghid',
    lang: 'ro',
    title: 'Buruieni pe Gazon: Cum le Recunoști și Cum Scapi de Ele',
    excerpt: 'Un ghid complet, cu identificare pas cu pas, ca să știi exact ce crește în gazonul tău, de ce a apărut acolo și cum îl elimini fără să distrugi restul ierbii.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    isPremium: false,
    readTime: 16,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-lime-900 via-green-900 to-emerald-800',
    coverEmoji: '🌼',
    tags: ['buruieni', 'gazon', 'identificare', 'papadie', 'trifoi'],
    contentPath: 'content/academy/ro/buruieni-gazon-ghid.md'
  },
  {
    id: 'ro-acoperitoare-sol-alternativa-gazon',
    slug: 'acoperitoare-sol-alternativa-gazon',
    lang: 'ro',
    title: 'Nu Crește Iarbă Acolo? Încearcă Plante Acoperitoare de Sol',
    excerpt: 'Sub copaci mari sau în colțuri umbroase gazonul se răreşte mereu, oricât ai încerca. Iată de ce se întâmplă asta și alternativa care chiar funcționează acolo, cu specii concrete pentru fiecare situație.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    categories: ['specii-plante', 'amenajare-design'],
    isPremium: true,
    readTime: 9,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-emerald-950 via-teal-900 to-green-800',
    coverEmoji: '🍀',
    tags: ['acoperitor de sol', 'umbra', 'alternativa gazon', 'iedera', 'pachisandra'],
    contentPath: 'content/academy/ro/acoperitoare-sol-alternativa-gazon.md'
  },
  {
    id: 'ro-paianjeni-tetranichizi-plante',
    slug: 'paianjeni-tetranichizi-plante',
    lang: 'ro',
    title: 'Pânze Fine pe Plante? Sunt Păianjeni Tetranichizi, Nu Boală',
    excerpt: 'Frunze cu puncte argintii și o pânză fină, aproape invizibilă. Nu e o ciupercă — sunt niște acarieni minusculi, și au un punct slab clar: le e frică de apă.',
    category: 'managementul-bolilor',
    categoryLabel: 'Managementul Bolilor',
    isPremium: true,
    readTime: 9,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-red-950 via-rose-950 to-slate-950',
    coverEmoji: '🕸️',
    tags: ['paianjeni', 'acarieni', 'daunatori', 'trandafiri', 'secetă'],
    contentPath: 'content/academy/ro/paianjeni-tetranichizi-plante.md'
  },
  {
    id: 'ro-insecte-utile-gradina-ghid',
    slug: 'insecte-utile-gradina-ghid',
    lang: 'ro',
    title: 'Insectele Utile din Grădină: Cine Sunt, Ce Mănâncă și Cum Le Atragi',
    excerpt: 'O buburuză adultă mănâncă până la 50 de afide pe zi, iar larva ei — mai puțin recunoscută, dar la fel de lacomă — chiar mai multe. Ghidul complet al insectelor prădătoare și parazite care fac controlul dăunătorilor gratuit, dacă le lași să existe, plus cum le recunoști și cum le atragi activ în grădină.',
    category: 'managementul-bolilor',
    categoryLabel: 'Managementul Bolilor',
    isPremium: true,
    readTime: 13,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-emerald-950 via-green-950 to-lime-950',
    coverEmoji: '🐞',
    tags: ['insecte utile', 'control biologic', 'daunatori', 'buburuze', 'biodiversitate'],
    contentPath: 'content/academy/ro/insecte-utile-gradina-ghid.md'
  },
  {
    id: 'ro-cancerul-ramurilor-pomi-arbori-ghid',
    slug: 'cancerul-ramurilor-pomi-arbori-ghid',
    lang: 'ro',
    title: 'Cancerul Ramurilor la Pomi și Arbori: Recunoaștere, Prevenție și Tratament',
    excerpt: 'Pete brun-roșiatice pe scoarță, care se adâncesc, crapă și formează inele circulare de proliferare tumorală — cancerul ramurilor (Nectria) poate ucide complet un pom tânăr dacă nu intervii la timp. Cum recunoști boala, de ce nu se tratează cu substanțe chimice ca alte boli fungice, și tehnica exactă de excizie a rănilor infectate.',
    category: 'managementul-bolilor',
    categoryLabel: 'Managementul Bolilor',
    categories: ['specii-plante'],
    isPremium: true,
    readTime: 10,
    difficulty: 'Avansat',
    author: 'Echipa My Garden',
    coverGradient: 'from-amber-950 via-orange-950 to-red-950',
    coverEmoji: '🪓',
    tags: ['boli', 'pomi fructiferi', 'arbori', 'cancer', 'nectria', 'taiere'],
    contentPath: 'content/academy/ro/cancerul-ramurilor-pomi-arbori-ghid.md'
  },
  {
    id: 'ro-plante-protectoare-combatere-naturala-daunatori',
    slug: 'plante-protectoare-combatere-naturala-daunatori',
    lang: 'ro',
    title: 'Plante Protectoare: Combaterea Naturală a Dăunătorilor prin Combinații de Plante',
    excerpt: 'Crăițele plantate printre legume îndepărtează nematozii din sol. Cimbrișorul protejează fasolea de păduchi. Ceapa și morcovul formează o cultură mixtă clasică fiindcă fiecare alungă musca dăunătoare a celeilalte. Ghidul complet al combinațiilor de plante verificate empiric pentru control natural al dăunătorilor.',
    category: 'managementul-bolilor',
    categoryLabel: 'Managementul Bolilor',
    categories: ['amenajare-design'],
    isPremium: true,
    readTime: 11,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-lime-950 via-green-950 to-emerald-950',
    coverEmoji: '🌿',
    tags: ['control biologic', 'plante companion', 'daunatori', 'legume', 'combinatii'],
    contentPath: 'content/academy/ro/plante-protectoare-combatere-naturala-daunatori.md'
  },
  {
    id: 'ro-rotatia-culturilor-legume-ghid',
    slug: 'rotatia-culturilor-legume-ghid',
    lang: 'ro',
    title: 'Rotația Culturilor: Sistemul cu 4 Straturi pentru Grădina de Legume',
    excerpt: 'Cultivi aceleași legume în același loc, an de an, și randamentul scade constant, iar bolile revin mereu? Sistemul clasic de rotație pe 4 straturi, organizat după cerințele nutritive ale plantelor, rezolvă ambele probleme fără să cumperi mai mult îngrășământ.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    categories: ['specii-plante'],
    isPremium: true,
    readTime: 9,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-lime-950 via-green-950 to-emerald-950',
    coverEmoji: '🔄',
    tags: ['legume', 'rotatia culturilor', 'sol', 'ingrasamant verde', 'planificare'],
    contentPath: 'content/academy/ro/rotatia-culturilor-legume-ghid.md'
  },
  {
    id: 'ro-alegerea-tipului-de-iarba',
    slug: 'alegerea-tipului-de-iarba',
    lang: 'ro',
    title: 'Ce Tip de Iarbă Aleg pentru Gazon? Ghid pe Înțelesul Tuturor',
    excerpt: 'Sacul de semințe de la magazin are un nume ciudat pe etichetă și tu nu știi ce înseamnă. Iată ce se ascunde de fapt în spatele lui Lolium, Festuca sau Poa pratensis, și cum alegi corect pentru curtea ta.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    isPremium: false,
    readTime: 10,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-green-900 via-lime-900 to-emerald-800',
    coverEmoji: '🌱',
    tags: ['gazon', 'seminte', 'specii', 'insamantare'],
    contentPath: 'content/academy/ro/alegerea-tipului-de-iarba.md'
  },
  {
    id: 'ro-de-ce-se-imbolnaveste-gazonul',
    slug: 'de-ce-se-imbolnaveste-gazonul',
    lang: 'ro',
    title: 'De Ce Se Îmbolnăvește Gazonul? Explicat Simplu',
    excerpt: 'Înainte să cumperi orice fungicid, merită să înțelegi de ce apar de fapt bolile de gazon. Trei lucruri trebuie să se întâmple deodată — și dacă lipsește unul, boala nu prinde.',
    category: 'managementul-bolilor',
    categoryLabel: 'Managementul Bolilor',
    categories: ['protocoale-baza'],
    isPremium: false,
    readTime: 11,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-red-950 via-orange-950 to-slate-950',
    coverEmoji: '🔬',
    tags: ['boli gazon', 'preventie', 'diagnostic', 'fungi'],
    contentPath: 'content/academy/ro/de-ce-se-imbolnaveste-gazonul.md'
  },
  {
    id: 'ro-ce-au-nevoie-trandafirii',
    slug: 'ce-au-nevoie-trandafirii',
    lang: 'ro',
    title: 'Ce Au Nevoie Trandafirii Ca Să Înflorească Din Plin',
    excerpt: 'Trandafirii nu sunt capricioși fără motiv — au niște cerințe foarte precise de sol, lumină, orientare și nutriție. Dacă le respecți pe toate, diferența se vede din prima vară.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    categories: ['specii-plante'],
    isPremium: false,
    readTime: 9,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-rose-950 via-pink-950 to-red-950',
    coverEmoji: '🌹',
    tags: ['trandafiri', 'sol', 'lumina', 'ph', 'plantare'],
    contentPath: 'content/academy/ro/ce-au-nevoie-trandafirii.md'
  },
  {
    id: 'ro-tipuri-de-trandafiri',
    slug: 'tipuri-de-trandafiri',
    lang: 'ro',
    title: 'Ce Tip de Trandafir Aleg? Ghid de Alegere pe Formă și Utilizare',
    excerpt: 'Nu toți trandafirii sunt la fel — unii sunt făcuți pentru ghiveci pe balcon, alții pentru garduri vii, alții cață pe un gard. Iată clasificarea completă și cum alegi tipul potrivit pentru locul tău exact.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    categories: ['specii-plante'],
    isPremium: true,
    readTime: 8,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-pink-950 via-rose-950 to-red-950',
    coverEmoji: '🌹',
    tags: ['trandafiri', 'tipuri', 'alegere', 'gradina'],
    contentPath: 'content/academy/ro/tipuri-de-trandafiri.md'
  },
  {
    id: 'ro-taierea-trandafirilor',
    slug: 'taierea-trandafirilor',
    lang: 'ro',
    title: 'Protocolul Complet de Tăiere a Trandafirilor, pe Fiecare Tip',
    excerpt: 'Câți muguri lași la tăiere depinde de tipul de trandafir și de vigoarea lui — greșești aici și ori nu mai înflorește, ori epuizezi tufa în câțiva ani. Ghid complet, cu unelte, tehnică și protocol pe fiecare tip.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    categories: ['specii-plante'],
    isPremium: true,
    readTime: 10,
    difficulty: 'Avansat',
    author: 'Echipa My Garden',
    coverGradient: 'from-rose-950 via-pink-950 to-slate-950',
    coverEmoji: '✂️',
    tags: ['trandafiri', 'taieri', 'protocol', 'avansat'],
    contentPath: 'content/academy/ro/taierea-trandafirilor.md'
  },
  {
    id: 'ro-protectia-trandafirilor-iarna-ghid',
    slug: 'protectia-trandafirilor-iarna-ghid',
    lang: 'ro',
    title: 'Protecția Trandafirilor pentru Iarnă: Mușuroirea și Tehnica Completă',
    excerpt: 'Un trandafir care supraviețuiește 5 ierni la rând poate muri complet la a 6-a, dintr-un ger neobișnuit de sever, dacă punctul de altoire nu e protejat corect. Tehnica de mușuroire, momentul exact al aplicării și al îndepărtării, și ce faci diferit la trandafirii urcători.',
    category: 'sezonalitate',
    categoryLabel: 'Calendar Sezonier',
    categories: ['specii-plante'],
    isPremium: true,
    readTime: 9,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-slate-950 via-blue-950 to-indigo-950',
    coverEmoji: '❄️',
    tags: ['trandafiri', 'iarna', 'protectie', 'musuroire', 'ger'],
    contentPath: 'content/academy/ro/protectia-trandafirilor-iarna-ghid.md'
  },
  {
    id: 'ro-plante-companion-trandafiri-ghid',
    slug: 'plante-companion-trandafiri-ghid',
    lang: 'ro',
    title: 'Ce Plantezi Lângă Trandafiri: Combinații Clasice de Grădină Englezească',
    excerpt: 'Un trandafir plantat singur, izolat pe un petic de pământ gol, arată de regulă mai sărăcăcios decât unul înconjurat de plante companion — o combinație recurentă în grădinăritul englezesc clasic: nemțișor, lavandă, clopoței și jaleș. De ce funcționează vizual, și cum alegi combinația potrivită pentru tipul tău de trandafir.',
    category: 'amenajare-design',
    categoryLabel: 'Amenajare & Design',
    categories: ['specii-plante'],
    isPremium: true,
    readTime: 8,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-rose-950 via-fuchsia-950 to-purple-950',
    coverEmoji: '💐',
    tags: ['trandafiri', 'plante companion', 'design', 'gradina englezeasca'],
    contentPath: 'content/academy/ro/plante-companion-trandafiri-ghid.md'
  },
  {
    id: 'ro-sisteme-irigatii-planificare',
    slug: 'sisteme-irigatii-planificare',
    lang: 'ro',
    title: 'Cum Îți Planifici un Sistem de Irigații pentru Curte',
    excerpt: 'Vrei să renunți la furtunul cu care alergi prin curte seară de seară? Iată cum se proiectează un sistem de aspersoare de la zero, pas cu pas, înainte să sapi primul șanț.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    categories: ['amenajare-design', 'irigatii'],
    isPremium: true,
    readTime: 13,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-blue-950 via-cyan-950 to-slate-950',
    coverEmoji: '💧',
    tags: ['irigatii', 'aspersoare', 'sistem', 'planificare'],
    contentPath: 'content/academy/ro/sisteme-irigatii-planificare.md'
  },
  {
    id: 'ro-conifere-ornamentale-ghid',
    slug: 'conifere-ornamentale-ghid',
    lang: 'ro',
    title: 'Conifere Ornamentale: Ghid Complet pentru Alegerea Speciei Potrivite',
    excerpt: 'De la tisa care crește la umbră deasă până la chiparosul de Arizona care vrea soare mediteranean — 27 de specii de conifere, organizate pe cerințe reale de spațiu, lumină și sol.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    categories: ['amenajare-design'],
    isPremium: true,
    readTime: 9,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-emerald-950 via-teal-950 to-slate-950',
    coverEmoji: '🌲',
    tags: ['conifere', 'copaci', 'arbusti', 'ornamental', 'specii'],
    contentPath: 'content/academy/ro/conifere-ornamentale-ghid.md'
  },
  {
    id: 'ro-arbori-foiosi-ornamentali-ghid',
    slug: 'arbori-foiosi-ornamentali-ghid',
    lang: 'ro',
    title: 'Copaci Foioși Ornamentali: Ghid pe Specii (Arțari, Stejari, Sălcii și Alții)',
    excerpt: 'Sisteme radiculare invazive de evitat lângă fundații, temperament de lumină vs. umbră și culori de toamnă — 24 de specii de arțari, stejari, sălcii, plopi și altele, organizate practic.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    categories: ['amenajare-design'],
    isPremium: true,
    readTime: 7,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-amber-950 via-yellow-950 to-slate-950',
    coverEmoji: '🍁',
    tags: ['copaci', 'foiosi', 'artari', 'stejari', 'salcii', 'specii'],
    contentPath: 'content/academy/ro/arbori-foiosi-ornamentali-ghid.md'
  },
  {
    id: 'ro-copaci-flori-spectaculoase-ghid',
    slug: 'copaci-flori-spectaculoase-ghid',
    lang: 'ro',
    title: 'Copaci Ornamentali cu Flori Spectaculoase: Catalpa, Paulownia, Salcâm și Alții',
    excerpt: 'Copaci aleși pentru un singur moment — înflorirea. De la sakura japoneză la salcâmul înmiresmat, cum alegi specia potrivită pentru spectacolul pe care ți-l dorești.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    categories: ['amenajare-design'],
    isPremium: true,
    readTime: 5,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-pink-950 via-rose-950 to-slate-950',
    coverEmoji: '🌸',
    tags: ['copaci', 'flori', 'catalpa', 'paulownia', 'salcam', 'specii'],
    contentPath: 'content/academy/ro/copaci-flori-spectaculoase-ghid.md'
  },
  {
    id: 'ro-arbusti-foiosi-ornamentali-ghid',
    slug: 'arbusti-foiosi-ornamentali-ghid',
    lang: 'ro',
    title: 'Arbuști Ornamentali: Ghid Complet pe Specii — Flori, Fructe, Garduri Vii și Liane',
    excerpt: 'Peste 25 de arbuști și liane, de la cimișir și piracanta la glicină și trâmbiță — organizați pe rol practic: gard viu, fructe de iarnă, culoare de toamnă sau plantă cățărătoare pe pergolă.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    categories: ['amenajare-design'],
    isPremium: true,
    readTime: 16,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-green-950 via-lime-950 to-slate-950',
    coverEmoji: '🌿',
    tags: ['arbusti', 'garduri vii', 'liane', 'fructe', 'specii'],
    contentPath: 'content/academy/ro/arbusti-foiosi-ornamentali-ghid.md'
  },
  {
    id: 'ro-clasificare-flori-gradina-ghid',
    slug: 'clasificare-flori-gradina-ghid',
    lang: 'ro',
    title: 'Cum Alegi Florile pentru Grădină: Anuale, Bienale, Perene și Ce Le Diferențiază',
    excerpt: 'Anuale, bienale, perene, hemicriptofite, geofite — clasificarea de bază care îți spune dinainte dacă o floare revine singură anul viitor sau trebuie cumpărată din nou.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    isPremium: true,
    readTime: 6,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-fuchsia-950 via-pink-950 to-slate-950',
    coverEmoji: '🌷',
    tags: ['flori', 'clasificare', 'anuale', 'perene', 'bulbi'],
    contentPath: 'content/academy/ro/clasificare-flori-gradina-ghid.md'
  },
  {
    id: 'ro-flori-anuale-ghid-specii',
    slug: 'flori-anuale-ghid-specii',
    lang: 'ro',
    title: 'Flori Anuale de Grădină: Ghid Complet pe Specii',
    excerpt: 'De la Portulaca rezistentă la secetă până la Gura Leului care înflorește până toamna târziu — 15 specii de flori anuale, cu cerințe exacte de sol, apă și expunere.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    isPremium: true,
    readTime: 6,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-orange-950 via-red-950 to-slate-950',
    coverEmoji: '🌼',
    tags: ['flori', 'anuale', 'specii', 'gradina'],
    contentPath: 'content/academy/ro/flori-anuale-ghid-specii.md'
  },
  {
    id: 'ro-flori-bulboase-ghid-specii',
    slug: 'flori-bulboase-ghid-specii',
    lang: 'ro',
    title: 'Flori Bulboase: Ghid Complet pe Specii, Organizat pe Sezonul de Înflorire',
    excerpt: 'Allium, Fritillaria, Crini, Dalii, Gladiole și altele — momentul exact de plantare, adâncimea și cerințele de sol pentru fiecare specie, organizate ca să proiectezi înflorire continuă tot anul.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    isPremium: true,
    readTime: 7,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-violet-950 via-purple-950 to-slate-950',
    coverEmoji: '🌷',
    tags: ['flori', 'bulboase', 'specii', 'gradina'],
    contentPath: 'content/academy/ro/flori-bulboase-ghid-specii.md'
  },
  {
    id: 'ro-flori-perene-ghid-specii',
    slug: 'flori-perene-ghid-specii',
    lang: 'ro',
    title: 'Flori Perene de Grădină: Ghid Complet pe Specii',
    excerpt: 'De la Astilbe (care preferă umbra umedă) la Yucca (aproape indestructibilă la secetă) — cerințele exacte de sol, lumină și tăiere pentru cele mai populare perene de grădină.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    isPremium: true,
    readTime: 7,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-teal-950 via-cyan-950 to-slate-950',
    coverEmoji: '🌺',
    tags: ['flori', 'perene', 'specii', 'gradina'],
    contentPath: 'content/academy/ro/flori-perene-ghid-specii.md'
  },
  {
    id: 'ro-flori-stancarie-acoperitoare-ghid',
    slug: 'flori-stancarie-acoperitoare-ghid',
    lang: 'ro',
    title: 'Flori de Stâncărie și Acoperitoare de Sol: Ghid Complet pe Specii',
    excerpt: 'De la Edelweiss la suculentele pentru acoperișuri verzi — plante pentru solul sărac, drenajul excelent și zonele unde vrei un covor des care ține buruienile la distanță.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    categories: ['amenajare-design'],
    isPremium: true,
    readTime: 6,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-stone-950 via-neutral-950 to-slate-950',
    coverEmoji: '🪨',
    tags: ['flori', 'stancarie', 'acoperitoare de sol', 'specii'],
    contentPath: 'content/academy/ro/flori-stancarie-acoperitoare-ghid.md'
  },
  {
    id: 'ro-flori-bienale-ghid-specii',
    slug: 'flori-bienale-ghid-specii',
    lang: 'ro',
    title: 'Flori Bienale de Grădină: Ghid Complet pe Specii',
    excerpt: 'Nici anuale, nici perene — bienalele cresc un an, înfloresc în al doilea, apoi mor. Cum planifici valuri succesive ca să nu ai goluri de înflorire de la un an la altul.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    isPremium: true,
    readTime: 4,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-purple-950 via-violet-950 to-slate-950',
    coverEmoji: '🔔',
    tags: ['flori', 'bienale', 'specii', 'gradina'],
    contentPath: 'content/academy/ro/flori-bienale-ghid-specii.md'
  },
  {
    id: 'ro-flori-cataratoare-volubile-ghid',
    slug: 'flori-cataratoare-volubile-ghid',
    lang: 'ro',
    title: 'Flori Cățărătoare (Volubile): Ghid pe Specii pentru Garduri, Pergole și Suporți',
    excerpt: 'Zorele, măzărichea parfumată, călțunași — flori volubile care acoperă un gard sau o pergolă într-un singur sezon, cu suport instalat din start.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    categories: ['amenajare-design'],
    isPremium: true,
    readTime: 4,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-indigo-950 via-blue-950 to-slate-950',
    coverEmoji: '🪴',
    tags: ['flori', 'cataratoare', 'volubile', 'specii'],
    contentPath: 'content/academy/ro/flori-cataratoare-volubile-ghid.md'
  },
  {
    id: 'ro-plante-balta-acvatice-ghid',
    slug: 'plante-balta-acvatice-ghid',
    lang: 'ro',
    title: 'Plante de Baltă și Acvatice: Ghid pe Specii pentru Iaz și Zone Mlăștinoase',
    excerpt: 'Nuferi, papură, lotus și plante de mal — ce plantezi în apă, ce plantezi doar pe sol permanent umed, și ce specii invadează rapid dacă nu le ții sub control.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    categories: ['amenajare-design'],
    isPremium: true,
    readTime: 6,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-blue-950 via-teal-950 to-slate-950',
    coverEmoji: '🪷',
    tags: ['plante acvatice', 'balta', 'iaz', 'specii'],
    contentPath: 'content/academy/ro/plante-balta-acvatice-ghid.md'
  },
  {
    id: 'ro-flori-frunze-decorative-graminee-ghid',
    slug: 'flori-frunze-decorative-graminee-ghid',
    lang: 'ro',
    title: 'Plante Decorative prin Frunziș și Graminee Ornamentale: Ghid pe Specii',
    excerpt: 'Coleus, Iresine, Festuca albastră, Miscanthus — plante alese nu pentru floare, ci pentru culoarea și textura frunzișului, cu valoare decorativă aproape tot sezonul.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    categories: ['amenajare-design'],
    isPremium: true,
    readTime: 6,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-emerald-950 via-lime-950 to-slate-950',
    coverEmoji: '🍂',
    tags: ['frunzis', 'graminee', 'specii', 'gradina'],
    contentPath: 'content/academy/ro/flori-frunze-decorative-graminee-ghid.md'
  },
  {
    id: 'ro-amenajare-gradina-ghid-complet',
    slug: 'amenajare-gradina-ghid-complet',
    lang: 'ro',
    title: 'Amenajarea Grădinii: Ghidul Complet de la Principii de Design la Planul Final',
    excerpt: 'Cel mai cuprinzător ghid din Academy: stiluri de amenajare, principii estetice, linii/forme/textură/culoare, tipuri de plantații, și procesul complet de proiectare — de la prima discuție cu clientul până la planul la scară, cu un exemplu aplicat pas cu pas pentru o curte de 300mp.',
    category: 'amenajare-design',
    categoryLabel: 'Amenajare & Design',
    isPremium: true,
    readTime: 30,
    difficulty: 'Avansat',
    author: 'Echipa My Garden',
    coverGradient: 'from-fuchsia-950 via-purple-950 to-indigo-950',
    coverEmoji: '🎨',
    tags: ['amenajare', 'design', 'proiectare', 'stiluri', 'principii'],
    contentPath: 'content/academy/ro/amenajare-gradina-ghid-complet.md'
  },
  {
    id: 'ro-gradini-celebre-inspiratie-design',
    slug: 'gradini-celebre-inspiratie-design',
    lang: 'ro',
    title: '15 Grădini Celebre Care Îți Pot Inspira Propriul Design',
    excerpt: 'De la simetria geometrică a Versailles-ului la stâncile zen din Kyoto — 15 grădini care au definit stiluri întregi de amenajare, cu ce anume le face memorabile și ce poți fura din fiecare pentru curtea ta.',
    category: 'amenajare-design',
    categoryLabel: 'Amenajare & Design',
    isPremium: false,
    readTime: 8,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-fuchsia-950 via-purple-950 to-indigo-950',
    coverEmoji: '🏛️',
    tags: ['design', 'inspiratie', 'amenajare', 'stiluri', 'istorie'],
    contentPath: 'content/academy/ro/gradini-celebre-inspiratie-design.md'
  },
  {
    id: 'ro-mulch-tundere-greseli-frecvente-gazon',
    slug: 'mulch-tundere-greseli-frecvente-gazon',
    lang: 'ro',
    title: 'Mulch sau Colectare, Direcția de Tundere și Cele Mai Frecvente Greșeli la Gazon',
    excerpt: 'Când colectezi iarba tăiată și când o lași pe loc, de ce să schimbi direcția de tundere, programul general de fertilizare și lista completă a greșelilor mărunte care, cumulate, distrug un gazon altfel sănătos.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    isPremium: true,
    readTime: 5,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-green-950 via-teal-950 to-slate-950',
    coverEmoji: '🌱',
    tags: ['gazon', 'tundere', 'mulch', 'fertilizare', 'greseli'],
    contentPath: 'content/academy/ro/mulch-tundere-greseli-frecvente-gazon.md'
  },
  {
    id: 'ro-borduri-denivelari-gazon-dificil-ghid',
    slug: 'borduri-denivelari-gazon-dificil-ghid',
    lang: 'ro',
    title: 'Borduri de Gazon, Denivelări și Zone Dificile: Ghid Practic de Întreținere Fizică',
    excerpt: 'Trei probleme fizice pe care le întâlnește aproape orice proprietar de gazon, dar despre care nu se vorbește destul: cum montezi o bordură care chiar rezistă, cum repari o movilă sau o groapă fără să lași o cicatrice vizibilă, și ce faci cu gazonul care refuză să crească sub conifere.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    categories: ['amenajare-design'],
    isPremium: true,
    readTime: 14,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-green-950 via-teal-950 to-slate-950',
    coverEmoji: '🧱',
    tags: ['gazon', 'bordura', 'denivelari', 'reparatii', 'umbra', 'conifere'],
    contentPath: 'content/academy/ro/borduri-denivelari-gazon-dificil-ghid.md'
  },
  {
    id: 'ro-pajiste-flori-alternativa-gazon-ghid',
    slug: 'pajiste-flori-alternativa-gazon-ghid',
    lang: 'ro',
    title: 'Pajiștea cu Flori: Alternativa la Gazonul Clasic, Pas cu Pas',
    excerpt: 'Tunzi de doar 2-3 ori pe an, nu mai fertilizezi, și în schimb ai un covor viu de flori sălbatice care hrănește albinele și fluturii — dar ai nevoie de răbdare: o pajiște cu flori nu arată spectaculos decât din al treilea an. Ghidul complet, cu ambele variante: conversia unui gazon existent și înființarea de la zero.',
    category: 'protocoale-baza',
    categoryLabel: 'Protocoale de Bază',
    categories: ['amenajare-design', 'specii-plante'],
    isPremium: true,
    readTime: 11,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-green-950 via-teal-950 to-slate-950',
    coverEmoji: '🌼',
    tags: ['gazon', 'pajiste', 'flori salbatice', 'alternativa', 'biodiversitate'],
    contentPath: 'content/academy/ro/pajiste-flori-alternativa-gazon-ghid.md'
  },
  {
    id: 'ro-pomi-arbusti-fructiferi-ghid',
    slug: 'pomi-arbusti-fructiferi-ghid',
    lang: 'ro',
    title: 'Pomi și Arbuști Fructiferi: Ghid pe Specii pentru Grădina de Acasă',
    excerpt: 'De la afinul care cere strict sol acid la migdalul cu flori sensibile la brumă — 13 specii de pomi și arbuști fructiferi, cu cerințe exacte de sol, polenizare, tăiere și recoltare, pentru grădina de acasă.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    isPremium: true,
    readTime: 12,
    difficulty: 'Intermediar',
    author: 'Echipa My Garden',
    coverGradient: 'from-amber-950 via-orange-950 to-red-950',
    coverEmoji: '🍇',
    tags: ['pomi fructiferi', 'arbusti fructiferi', 'afin', 'zmeur', 'nuc', 'specii'],
    contentPath: 'content/academy/ro/pomi-arbusti-fructiferi-ghid.md'
  },
  {
    id: 'ro-legume-condimentare-ghid-specii',
    slug: 'legume-condimentare-ghid-specii',
    lang: 'ro',
    title: 'Legume și Plante Condimentare: Ghid pe Specii pentru Grădina de Bucătărie',
    excerpt: 'De la rozmarinul care preferă sol calcaros la menta care invadează grădina dacă n-o ții în ghiveci — patru specii de legume și aromatice, cu cerințe tehnice exacte de sol, căldură și recoltare.',
    category: 'specii-plante',
    categoryLabel: 'Specii de Plante',
    isPremium: true,
    readTime: 5,
    difficulty: 'Începător',
    author: 'Echipa My Garden',
    coverGradient: 'from-lime-950 via-green-950 to-emerald-950',
    coverEmoji: '🌶️',
    tags: ['legume', 'condimentare', 'rozmarin', 'ardei iute', 'vinete', 'menta', 'specii'],
    contentPath: 'content/academy/ro/legume-condimentare-ghid-specii.md'
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

// Helper: every category an article should match under (primary + secondary),
// deduplicated. Use this instead of comparing `article.category` directly
// wherever filtering/grouping by category — articles with `categories` set
// belong to more than one topic.
export const articleMatchesCategory = (article: ArticleMeta, categoryId: ArticleCategory): boolean =>
  article.category === categoryId || (article.categories?.includes(categoryId) ?? false);

// Helper: get free articles count
export const getFreeArticleCount = (lang: 'ro' | 'en') => {
  const articles = getArticlesByLang(lang);
  return articles.filter(a => !a.isPremium).length;
};

// Helper: get total articles count
export const getTotalArticleCount = (lang: 'ro' | 'en') => {
  return getArticlesByLang(lang).length;
};
