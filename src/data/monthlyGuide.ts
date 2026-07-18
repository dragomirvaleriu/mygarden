export const monthlyGuide = [
  {
    month: 0,
    title: "Ianuarie",
    subtitle: "Latența și Planificarea",
    summary: "Gazon: Interdicție totală de trafic dacă iarba este acoperită de chiciură sau înghețată. Nu depozitați mormane mari de zăpadă pe peluză.\nPomi: Verificarea vizuală a scoarței. Se pot elimina crengile rupte sub greutatea zăpezii, dar tăierile majore se amână.\nEchipamente: Revizia tehnică anuală. Schimbul de ulei, filtrelor și ascuțirea cuțitelor (motocultor, mașină de tuns, scarificator).",
    science: "TIP: Regula de Aur: Celulele de iarbă înghețate se sparg sub presiunea pașilor, lăsând pete necrozate (negre/maronii) vizibile în martie. Evitați compactarea zăpezii pentru a preveni asfixierea rădăcinilor.",
    warning: "Interdicție totală de trafic dacă iarba este acoperită de chiciură sau înghețată.",
    tasks: [
      { id: "ian-1", title: "Fără trafic pe gazon", category: "other", important: true },
      { id: "ian-2", title: "Revizia tehnică anuală (motocultor, mașină de tuns, scarificator)", category: "other" },
      { id: "ian-3", title: "Verificarea vizuală a scoarței la pomi", category: "observation" }
    ]
  },
  {
    month: 1,
    title: "Februarie",
    subtitle: "Trezirea Biologică și Tăierile",
    summary: "Gazon: Aplicarea unui biostimulator (aminoacizi) doar dacă temperatura solului e peste 8°C. Adunarea resturilor vegetale.\nPomi & Arbuști: Executarea tăierilor de formare și rodire la măr, păr și prun (în zilele cu temperaturi pozitive).\nSolar: Semănatul răsadurilor timpurii (roșii, ardei) la interior.",
    science: "TIP: Aminoacizii ajută gazonul să proceseze rapid nutrienții stocați în rădăcină. La pomi, tăierile făcute greșit sau pe ger sever provoacă uscarea ramurilor de rod.",
    warning: "",
    tasks: [
      { id: "feb-1", title: "Tăieri de formare și rodire la pomi", category: "pruning", important: true },
      { id: "feb-2", title: "Tratament de iarnă fungicid cupru (ex: Alcupral 50 PU)", category: "treatment", important: true },
      { id: "feb-3", title: "Aplicare biostimulator (aminoacizi) pe gazon", category: "fertilizing" },
      { id: "feb-4", title: "Semănat răsaduri timpurii (solar)", category: "other" }
    ]
  },
  {
    month: 2,
    title: "Martie",
    subtitle: "Restartul de Primăvară",
    summary: "Gazon: Prima tundere pe sol uscat (treapta cea mai înaltă). Scarificare ușoară doar dacă e bine înrădăcinat. Fertilizare solidă (N și P).\nPlante Ornamentale: Tăierea drastică a trandafirilor (la 3-5 muguri orientați spre exterior) și curățarea hortensiilor.\nSol: Mărunțirea solului cu freza de pământ/motocultorul pentru pregătirea patului germinativ.",
    science: "TIP: Martie este despre stimularea sistemului radicular. Scarificarea prematură a unui gazon slăbit după iarnă va smulge plantele sănătoase din rădăcină.",
    warning: "",
    tasks: [
      { id: "mar-1", title: "Prima tundere a gazonului", category: "mowing", important: true },
      { id: "mar-2", title: "Fertilizare solidă de primăvară (Azot, Fosfor)", category: "fertilizing", important: true },
      { id: "mar-3", title: "Scarificare ușoară (Power Raking)", category: "other" },
      { id: "mar-4", title: "Tratament preventiv cupru (Kupferol) la pomi", category: "treatment" },
      { id: "mar-5", title: "Tăierea trandafirilor (3-5 muguri)", category: "pruning" },
      { id: "mar-6", title: "Mărunțirea solului pentru pat germinativ", category: "other" }
    ]
  },
  {
    month: 3,
    title: "Aprilie",
    subtitle: "Explozia Vegetativă",
    summary: "Gazon: Tundere la 5-7 zile (regula de 1/3 din fir). Erbicidare selectivă buruieni (la 15-22°C).\nPomi Fructiferi: Tratamente pre și post-florale. Sistarea insecticidelor la înflorit.\nLegume: Călire și plantare răsaduri în solar.",
    science: "TIP: Nu tăiați niciodată mai mult de 30% din lungimea firului la o trecere. Irigarea trebuie să fie profundă (10-15 L/mp), umezind solul la 10-15 cm adâncime.",
    warning: "Sistarea oricăror aplicări de insecticide în perioada înfloritului pomilor pentru protejarea albinelor.",
    tasks: [
      { id: "apr-1", title: "Tundere gazon (regula 1/3)", category: "mowing", important: true },
      { id: "apr-2", title: "Erbicidare selectivă buruieni", category: "treatment", important: true },
      { id: "apr-3", title: "Tratamente pre/post-florale pomi", category: "treatment" },
      { id: "apr-4", title: "Plantare răsaduri în solar", category: "other" }
    ]
  },
  {
    month: 4,
    title: "Mai",
    subtitle: "Fortificarea înainte de Căldură",
    summary: "Gazon: Înălțimea de tăiere la 5 cm. Ultima aplicare de azot cu eliberare rapidă.\nTratamente: Monitorizare dăunători (larve, afide). Tratamente de contact (Champ 77 WG) pentru boli fungice.\nPlante: Tunderea de formare a gardurilor vii și a arbuștilor (Forsythia).",
    science: "TIP: Înălțimea de 5 cm a gazonului permite soarelui să ajungă la baza noilor fire. Verificați zonele unde iarba se smulge ușor (atac de dăunători).",
    warning: "",
    tasks: [
      { id: "mai-1", title: "Tundere gazon la 5 cm", category: "mowing", important: true },
      { id: "mai-2", title: "Fertilizare azot (eliberare rapidă)", category: "fertilizing", important: true },
      { id: "mai-3", title: "Monitorizare și tratamente horticole (Champ 77 WG)", category: "treatment" },
      { id: "mai-4", title: "Tunderea gardurilor vii / arbuști", category: "pruning" }
    ]
  },
  {
    month: 5,
    title: "Iunie",
    subtitle: "Managementul Stresului Termic",
    summary: "Gazon: Ridicați înălțimea de tăiere la 7-8 cm. Irigare permisă exclusiv dimineața (5:00 - 8:00).\nNutriție: Fertilizant cu Potasiu (K) cu eliberare lentă. Aminoacizi lunar.\nSolar: Copilitul roșiilor, palisare și defoliere.",
    science: "TIP: Iarba lungă protejează nodul de creștere. Irigarea de seară în nopțile calde garantează apariția fungilor patogeni (Brown Patch).",
    warning: "Irigare permisă exclusiv dimineața! Niciodată seara pentru a preveni bolile fungice.",
    tasks: [
      { id: "iun-1", title: "Irigare doar dimineața (05:00-08:00)", category: "watering", important: true },
      { id: "iun-2", title: "Tundere gazon la 7-8 cm", category: "mowing", important: true },
      { id: "iun-3", title: "Fertilizare Potasiu (lentă) și Aminoacizi", category: "fertilizing" },
      { id: "iun-4", title: "Copilit roșii și defoliere solar", category: "other" }
    ]
  },
  {
    month: 6,
    title: "Iulie",
    subtitle: "Supraviețuirea Caniculei",
    summary: "Gazon: Irigare profundă și rară (25-30 L/mp pe săptămână în 1-2 ședințe). Tunderi rare cu colectarea ierbii.\nPomi & Legume: Instalare plase de umbrire. Recoltare continuă.",
    science: "TIP: Monitorizați apariția petelor galbene (Rhizoctonia). Stresul termic este la cote maxime.",
    warning: "Interdicție absolută pentru scarificare sau erbicidare! Stresul mecanic sau chimic pe fond de caniculă va arde iremediabil gazonul.",
    tasks: [
      { id: "iul-1", title: "Irigare profundă (25-30 L/mp/săpt)", category: "watering", important: true },
      { id: "iul-2", title: "Instalare plase de umbrire solar/pomi", category: "other", important: true },
      { id: "iul-3", title: "Tunderi rare, cu colectarea ierbii", category: "mowing" }
    ]
  },
  {
    month: 7,
    title: "August",
    subtitle: "Recuperarea și Pregătirea",
    summary: "Gazon: Extragerea manuală/locală a buruienilor (Mohor). Evaluarea compactării; planificare aerare preducele dacă apa băltește.\nGrădină: Curățarea straturilor, semănare culturi de toamnă.\nPomi: Tăieri în verde (summer pruning) pentru aerisirea coroanei.",
    science: "TIP: Mohorul produce mii de semințe care vor germina anul viitor; trebuie eliminat acum. E momentul planificării campaniei de toamnă.",
    warning: "",
    tasks: [
      { id: "aug-1", title: "Extragere buruieni vară (Mohor)", category: "other", important: true },
      { id: "aug-2", title: "Tăieri în verde pomi (summer pruning)", category: "pruning" },
      { id: "aug-3", title: "Curățare straturi și semănare culturi toamnă", category: "other" },
      { id: "aug-4", title: "Aprovizionare semințe/îngrășământ toamnă", category: "other" }
    ]
  },
  {
    month: 8,
    title: "Septembrie",
    subtitle: "Marea Regenerare (Luna de Aur)",
    summary: "Gazon: Scarificare agresivă în două direcții (eliminare pâslă). Supraînsămânțare și top-dressing.\nNutriție: Îngrășământ echilibrat NPK (Starter) pentru germinație.\nPomi: Tratamente post-recoltare la sâmburoase.",
    science: "TIP: După scarificare gazonul va arăta distrus timp de 10-14 zile, dar solul cald și roua nopților vor genera cea mai spectaculoasă regenerare din an.",
    warning: "",
    tasks: [
      { id: "sep-1", title: "Scarificare agresivă (Verticutting) 2 direcții", category: "other", important: true },
      { id: "sep-2", title: "Supraînsămânțare și top-dressing", category: "other", important: true },
      { id: "sep-3", title: "Fertilizare NPK (Starter)", category: "fertilizing", important: true },
      { id: "sep-4", title: "Tratamente post-recoltare sâmburoase", category: "treatment" }
    ]
  },
  {
    month: 9,
    title: "Octombrie",
    subtitle: "Stocarea Energiei",
    summary: "Gazon: Coborârea tăierii spre 5 cm. Adunarea frunzelor la max 2-3 zile.\nPomi: Plantarea noilor pomi fructiferi. Tratamente chimice la căderea masivă a frunzelor (spălare cuprice).\nSol: Săparea adâncă a grădinii (brazdă mare) peste iarnă.",
    science: "Săparea adâncă reține zăpada și distruge dăunătorii prin îngheț. Prinderea noilor pomi este superioară celei de primăvară.",
    warning: "Nu lăsați gazonul mai înalt de 6 cm (putrezire). Un strat gros de frunze ude provoacă asfixierea firelor în sub o săptămână.",
    tasks: [
      { id: "oct-1", title: "Adunarea frunzelor căzute", category: "other", important: true },
      { id: "oct-2", title: "Tratamente cuprice la căderea frunzelor", category: "treatment", important: true },
      { id: "oct-3", title: "Tundere gazon la 5 cm", category: "mowing" },
      { id: "oct-4", title: "Plantare noi pomi fructiferi", category: "other" },
      { id: "oct-5", title: "Săpare adâncă a grădinii", category: "other" }
    ]
  },
  {
    month: 10,
    title: "Noiembrie",
    subtitle: "Pregătirea de Iarnă",
    summary: "Gazon: Fertilizare de iarnă (Potasiu) pentru efect 'antigel'. Ultima tundere. Tratament foliar pe bază de Fier.\nSisteme: Golirea completă a sistemului de irigație (compresor). Curățarea utilajelor.\nTratamente: Văruirea trunchiurilor și instalarea plaselor împotriva rozătoarelor.",
    science: "TIP: Potasiul îngroașă pereții celulari, prevenind distrugerea țesuturilor la ciclurile repetate de îngheț-dezgheț.",
    warning: "Pericol de îngheț al conductelor. Sistemul de irigație trebuie golit neapărat cu compresorul de aer.",
    tasks: [
      { id: "nov-1", title: "Fertilizare de iarnă (Potasiu)", category: "fertilizing", important: true },
      { id: "nov-2", title: "Golirea completă a sistemului de irigații", category: "other", important: true },
      { id: "nov-3", title: "Tratament foliar pe bază de Fier", category: "treatment" },
      { id: "nov-4", title: "Văruire pomi și plase rozătoare", category: "other" },
      { id: "nov-5", title: "Ultima tundere a anului", category: "mowing" }
    ]
  },
  {
    month: 11,
    title: "Decembrie",
    subtitle: "Liniștea Sub Zăpadă",
    summary: "General: Repaus total. Evitarea stresului mecanic.\nManagement: Auditul echipamentelor, studiul jurnalului. Comandarea semințelor pentru răsaduri și a fertilizanților pentru primăvară.",
    science: "TIP: Urmele de pași făcute repetat pe un gazon înghețat se vor transforma în pământ mort primăvara. Lăsați natura să se odihnească.",
    warning: "Evitarea oricărui stres mecanic asupra suprafețelor verzi.",
    tasks: [
      { id: "dec-1", title: "Repaus total pentru gazon și grădină", category: "other", important: true },
      { id: "dec-2", title: "Audit echipamente și comandă provizii", category: "other" }
    ]
  }
];
