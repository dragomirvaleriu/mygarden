import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, ArrowRight, CheckCircle2, RotateCcw,
  Droplets, Sprout, Bug, Waves, ThermometerSun, Leaf, Info, ArrowLeft, BookOpen
} from 'lucide-react';
import { Page } from '../src/types';

type NodeId = string;

interface DecisionNode {
  id: NodeId;
  title?: string;
  question: string;
  description?: string;
  options: {
    label: string;
    subtext?: string;
    nextNodeId: NodeId;
    icon?: React.ReactNode;
  }[];
}

interface DiagnosisNode {
  id: NodeId;
  type: 'danger' | 'warning' | 'success' | 'info';
  title: string;
  cause: string;
  solutionTitle: string;
  solutionSteps: string[];
  articleSlug?: string;
  articleTitle?: string;
}

interface Props {
  onNavigate?: (page: Page) => void;
}

export const SmartTroubleshooter: React.FC<Props> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [history, setHistory] = useState<NodeId[]>(['root']);
  const currentNodeId = history[history.length - 1];

  const goNext = (nodeId: NodeId) => {
    setHistory(prev => [...prev, nodeId]);
  };

  const goBack = () => {
    if (history.length > 1) {
      setHistory(prev => prev.slice(0, -1));
    }
  };

  const reset = () => {
    setHistory(['root']);
  };

  // --- DECISION TREE DATA ---
  const decisions: Record<NodeId, DecisionNode> = {
    'root': {
      id: 'root',
      question: 'Ce problemă principală întâmpini cu gazonul tău?',
      options: [
        { label: 'Pete Uscate sau Galbene', subtext: 'Zone în care iarba moare sau se îngălbenește.', nextNodeId: 'dry_patches', icon: <ThermometerSun size={20} className="text-amber-500" /> },
        { label: 'Buruieni sau Mușchi', subtext: 'Plante nedorite care sufocă gazonul.', nextNodeId: 'weeds_moss', icon: <Leaf size={20} className="text-green-500" /> },
        { label: 'Culoare Palidă / Creștere Lentă', subtext: 'Gazonul este verde deschis sau crește greu.', nextNodeId: 'growth_color', icon: <Sprout size={20} className="text-emerald-400" /> },
        { label: 'Sol Compact / Bălți', subtext: 'Apa stagnează după irigare sau ploaie.', nextNodeId: 'soil_water', icon: <Waves size={20} className="text-blue-500" /> },
        { label: 'Dăunători', subtext: 'Cârtițe, mușuroaie, viermi sau insecte.', nextNodeId: 'pests', icon: <Bug size={20} className="text-red-500" /> },
      ]
    },
    // BRANCH 1: DRY PATCHES
    'dry_patches': {
      id: 'dry_patches',
      title: 'Pete Uscate',
      question: 'Execută Testul Șurubelniței: Înfige o șurubelniță de 15 cm exact în centrul zonei uscate. Cum intră?',
      description: 'Acest test ne spune dacă problema este din cauza lipsei de apă sau din alte cauze (boli).',
      options: [
        { label: 'Intră foarte greu', subtext: 'Pământul pare pietrificat și uscat la adâncime.', nextNodeId: 'diag_water_deficit' },
        { label: 'Intră ușor, ca în unt', subtext: 'Solul este moale și umed sub pată.', nextNodeId: 'dry_patches_fungus_check' }
      ]
    },
    'dry_patches_fungus_check': {
      id: 'dry_patches_fungus_check',
      title: 'Verificare Boli Fungice',
      question: 'Cum arată forma petelor și marginile acestora?',
      options: [
        { label: 'Pete circulare cu margine activă/închisă', subtext: 'Poate apărea și puf alb dimineața (miceliu).', nextNodeId: 'diag_fungus_active' },
        { label: 'Decolorare generalizată pe zone mari', subtext: 'Fără o formă clară, gazonul pare subțiat.', nextNodeId: 'diag_root_rot' }
      ]
    },
    // BRANCH 2: WEEDS & MOSS
    'weeds_moss': {
      id: 'weeds_moss',
      title: 'Buruieni și Mușchi',
      question: 'Ce tip de invazie observi majoritar?',
      options: [
        { label: 'Mușchi dens (verde închis/gălbui)', subtext: 'Apare mai ales în zone umbroase și umede.', nextNodeId: 'diag_moss' },
        { label: 'Buruieni cu frunză lată', subtext: 'Trifoi, Păpădie, Pătlagină.', nextNodeId: 'diag_broadleaf' },
        { label: 'Buruieni tip iarbă (frunză îngustă)', subtext: 'Mohor, Pir, Iarbă bărboasă.', nextNodeId: 'diag_grassy_weeds' }
      ]
    },
    // BRANCH 3: GROWTH & COLOR
    'growth_color': {
      id: 'growth_color',
      title: 'Nutriție și Culoare',
      question: 'Când a fost aplicat ultimul îngrășământ solid (granulat)?',
      options: [
        { label: 'Acum mai bine de 6 săptămâni / Niciodată', subtext: 'Timpul de eliberare al nutrienților s-a scurs.', nextNodeId: 'diag_nitrogen_def' },
        { label: 'Recent (în ultimele 2-4 săptămâni)', subtext: 'Și totuși gazonul este palid sau prezintă vârfuri uscate.', nextNodeId: 'color_mower_check' }
      ]
    },
    'color_mower_check': {
      id: 'color_mower_check',
      title: 'Verificare Mașină de Tuns',
      question: 'Privește îndeaproape un fir de iarbă tăiat. Cum arată vârful lui?',
      options: [
        { label: 'Vârful este franjurat / zdrențuit', subtext: 'Capătul firului este albicios și sfâșiat.', nextNodeId: 'diag_dull_blade' },
        { label: 'Tăietura este curată și netedă', subtext: 'Dar solul este dur sau compactat.', nextNodeId: 'diag_iron_soil' }
      ]
    },
    // BRANCH 4: SOIL & WATER
    'soil_water': {
      id: 'soil_water',
      title: 'Bălți și Sol Compact',
      question: 'Cât de repede se drenează apa după o ploaie serioasă sau o irigare lungă?',
      options: [
        { label: 'Băltește ore întregi / Solul are mușchi', subtext: 'Terenul este foarte compactat și argilos.', nextNodeId: 'diag_compaction' },
        { label: 'Apa dispare imediat', subtext: 'Dar gazonul se usucă foarte repede a doua zi.', nextNodeId: 'diag_sandy_soil' }
      ]
    },
    // BRANCH 5: PESTS
    'pests': {
      id: 'pests',
      title: 'Dăunători',
      question: 'Ce fel de activitate ai observat în gazon?',
      options: [
        { label: 'Mușuroaie de pământ (mari)', subtext: 'Apar peste noapte, fără gaură la suprafață vizibilă.', nextNodeId: 'diag_moles' },
        { label: 'Iarba se smulge ca un covor', subtext: 'Păsările ciugulesc mult în gazon. La suprafață/rădăcină sunt viermi albi.', nextNodeId: 'diag_grubs' },
        { label: 'Mici mușuroaie de pământ nisipos', subtext: 'Activitate de furnici abundentă.', nextNodeId: 'diag_ants' }
      ]
    }
  };

  const diagnoses: Record<NodeId, DiagnosisNode> = {
    // --- DRY PATCHES DIAGNOSES ---
    'diag_water_deficit': {
      id: 'diag_water_deficit', type: 'warning',
      articleSlug: 'regula-irigarii', articleTitle: 'Ghidul Suprem de Irigare & Protocolul de Însămânțare',
      title: 'Deficit Local de Apă',
      cause: 'Aceasta nu este o boală! 80% din petele uscate vara sunt „zone de umbră” ale aspersoarelor (acoperire neuniformă sau vânt care deviază jetul).',
      solutionTitle: 'Cum remediezi:',
      solutionSteps: [
        'Reglează unghiul și raza aspersorului care acoperă zona respectivă.',
        'Curăță filtrul duzei de eventuale impurități (nisip, calcar).',
        'Irigă manual zona afectată cu furtunul, abundent, timp de 3-4 zile până își revine.'
      ]
    },
    'diag_fungus_active': {
      id: 'diag_fungus_active', type: 'danger',
      articleSlug: 'protocoale-fungicide', articleTitle: 'Protocolul Complet al Fungicidelor',
      title: 'Boală Fungică Activă (ex: Brown Patch, Dollar Spot)',
      cause: 'Ciupercile prosperă când solul este foarte umed, iar frunza stă udă mult timp (mai ales noaptea, combinat cu temperaturi mari).',
      solutionTitle: 'Acțiune de Urgență:',
      solutionSteps: [
        'Oprește complet irigarea automată timp de 2-3 zile pentru a usca frunza.',
        'MUTĂ ORA DE IRIGARE DOAR DIMINEAȚA! (între 04:00 și 06:00). Nu mai uda niciodată seara.',
        'Aplică un tratament fungicid sistemic (ex: Amistar, Signum) combinat cu un fungicid de contact.',
        'Spală cu apă și clor puntea mașinii de tuns după fiecare utilizare, pentru a nu răspândi sporii.'
      ]
    },
    'diag_root_rot': {
      id: 'diag_root_rot', type: 'danger',
      articleSlug: 'regula-irigarii', articleTitle: 'Ghidul Suprem de Irigare & Protocolul de Însămânțare',
      title: 'Putrezirea Rădăcinilor (Asfixiere / Pythium)',
      cause: 'Supra-irigarea constantă (udare zilnică) sufocă rădăcinile lipsindu-le de oxigen, declanșând putregaiul.',
      solutionTitle: 'Protocol de Salvare:',
      solutionSteps: [
        'Nu mai iriga până când pământul nu se usucă considerabil la suprafață.',
        'Efectuează o aerare cu furca (găurește manual zonele afectate pentru a elibera apa/gazele).',
        'Redu frecvența udărilor pe viitor (udă profund, dar rar – o dată la 3-4 zile).'
      ]
    },
    // --- WEEDS MOSS DIAGNOSES ---
    'diag_moss': {
      id: 'diag_moss', type: 'warning',
      articleSlug: 'aerare-scarificare-completa', articleTitle: 'Aerare & Scarificare: Respirația Solului',
      title: 'Invazie de Mușchi (Moss)',
      cause: 'Mușchiul este doar un simptom. Cauzele reale: Umbră deasă, sol compactat, umiditate excesivă, pH acid sau lipsă de nutrienți.',
      solutionTitle: 'Protocol Combatere Mușchi:',
      solutionSteps: [
        'Aplică un tratament cu Sulfat de Fier (Sare de Fier) sau îngrășământ anti-mușchi. Așteaptă 7-10 zile să se înnegrească și să moară.',
        'Scarifică agresiv zona pentru a extrage mușchiul mort.',
        'Rezvolvă cauza de bază: aerează solul (dacă băltește) și fertilizează gazonul pentru a deveni mai dens.',
        'Reduceți irigarea în zonele umbroase.'
      ]
    },
    'diag_broadleaf': {
      id: 'diag_broadleaf', type: 'success',
      articleSlug: 'erbicide-selective-gazon', articleTitle: 'Erbicide Selective: Cum Ucizi Buruiana fără să Distrugi Gazonul',
      title: 'Buruieni Dicotiledonate (Frunză Lată)',
      cause: 'Semințele purtate de vânt/păsări au germinat deoarece gazonul nu este suficient de dens pentru a bloca lumina la nivelul solului.',
      solutionTitle: 'Control și Eradicare:',
      solutionSteps: [
        'Aplică un erbicid selectiv pentru dicotiledonate (ex: Dicopur Top, Cerlit).',
        'Nu tunde gazonul cu 3 zile înainte și 3 zile după aplicare.',
        'Nu iriga gazonul cel puțin 6-8 ore după aplicarea erbicidului.',
        'Pentru a preveni reapariția, menține un program riguros de fertilizare. Un gazon des nu lasă loc buruienilor!'
      ]
    },
    'diag_grassy_weeds': {
      id: 'diag_grassy_weeds', type: 'danger',
      articleSlug: 'erbicide-selective-gazon', articleTitle: 'Erbicide Selective: Cum Ucizi Buruiana fără să Distrugi Gazonul',
      title: 'Buruieni Monocotiledonate (Ierburi Nedorite)',
      cause: 'Cel mai greu inamic. Fiind din aceeași familie cu gazonul (graminee), erbicidele selective nu vor funcționa fără a distruge și gazonul.',
      solutionTitle: 'Ce ai de făcut:',
      solutionSteps: [
        'Extragere manuală (plivire) - cea mai sigură metodă dacă nu sunt prea multe.',
        'Dacă infestarea este masivă (ex: Mohor/Pir pe zone mari), singura soluție este aplicarea localizată cu pensula a unui erbicid TOTAL (glifosat) doar pe buruiană.',
        'Primăvara devreme se poate folosi un erbicid pre-emergent (ex: Pendimetalin) pentru a bloca germinarea noilor semințe de mohor.'
      ]
    },
    // --- GROWTH DIAGNOSES ---
    'diag_nitrogen_def': {
      id: 'diag_nitrogen_def', type: 'info',
      articleSlug: 'chimia-solului', articleTitle: 'Chimia Solului: pH, Macronutrienți și Blocaj Mineral',
      title: 'Carență Severă de Azot (Subnutriție)',
      cause: 'Gazonul este un mare consumator de nutrienți. După 6-8 săptămâni, rezerva de îngrășământ solid s-a epuizat, iar iarba devine verde pal / gălbuie.',
      solutionTitle: 'Program de Hrănire:',
      solutionSteps: [
        'Aplică imediat un îngrășământ granulat (NPK) bogat în Azot (ex: 20-5-8) primăvara/vara, sau echilibrat (K mare) toamna târziu.',
        'Udați din abundență (10-15L/mp) imediat după aplicare pentru a dizolva granulele.',
        'Setează un reminder în Calendar pentru a fertiliza regulat la fiecare 6 săptămâni.'
      ]
    },
    'diag_dull_blade': {
      id: 'diag_dull_blade', type: 'warning',
      articleSlug: 'ascutire-cutit-masina', articleTitle: 'Întreținere: De ce cuțitul bont distruge gazonul și cum îl ascuți',
      title: 'Lamă Mașină de Tuns Tocită',
      cause: 'Lama ruptă sau neascuțită "sfâșie" frunza în loc să o taie curat. Franjurile se usucă, dând gazonului o nuanță generală albicioasă/galbenă și favorizând bolile.',
      solutionTitle: 'Soluție mecanică:',
      solutionSteps: [
        'Ascute lama mașinii de tuns! Trebuie ascuțită cel puțin de 2-3 ori pe sezon.',
        'Aplică un îngrășământ foliar cu aminoacizi pentru a ajuta gazonul să treacă de stresul mecanic.',
        'Asigură-te că nu tunzi iarba când este udă.'
      ]
    },
    'diag_iron_soil': {
      id: 'diag_iron_soil', type: 'info',
      articleSlug: 'chimia-solului', articleTitle: 'Chimia Solului: pH, Macronutrienți și Blocaj Mineral',
      title: 'Blocaj Nutrițional (Lipsă Fier / pH necorespunzător)',
      cause: 'Dacă ai fertilizat, dar iarba rămâne galbenă-pal (cloroză), solul este prea alcalin sau are un deficit de Fier asimilabil.',
      solutionTitle: 'Revitalizare prin Microelemente:',
      solutionSteps: [
        'Aplică un îngrășământ foliar bogat în Fier (Fe) chelatat. Vei vedea rezultatul (înverzire închisă) în 24-48 de ore.',
        'Efectuează o aerare dacă solul este dur (ajută rădăcinile să absoarbă oxigen și nutrienți).'
      ]
    },
    // --- SOIL COMPACTION ---
    'diag_compaction': {
      id: 'diag_compaction', type: 'warning',
      articleSlug: 'aerare-scarificare-completa', articleTitle: 'Aerare & Scarificare: Respirația Solului',
      title: 'Sol Puternic Compactat (Argilos)',
      cause: 'Traficul, utilajele grele sau pur și simplu un sol lutos creează o crustă impermeabilă. Rădăcinile nu mai respiră, iar apa băltește și provoacă mușchi sau boli.',
      solutionTitle: 'Procedura de Aerare:',
      solutionSteps: [
        'Închirierea sau achiziția unui aerator cu preducele (Carotare / Hollow Tine Aeration).',
        'Extragerea "dopurilor" de pământ pe întreaga suprafață.',
        'Măturarea sau împrăștierea de nisip spălat (Top-Dressing) pentru a umple găurile și a schimba structura solului.',
        'Se face ideal primăvara sau toamna devreme.'
      ]
    },
    'diag_sandy_soil': {
      id: 'diag_sandy_soil', type: 'info',
      articleSlug: 'top-dressing-nisip', articleTitle: 'Top-Dressing: Arta Nivelării cu Nisip',
      title: 'Sol Foarte Nisipos',
      cause: 'Solul nu reține apa și nutrienții, aceștia spălându-se instantaneu (levigare). Gazonul suferă constant de sete și foame.',
      solutionTitle: 'Îmbunătățirea Retenției:',
      solutionSteps: [
        'Modifică irigarea: udă mai des și cu cantități mai mici față de un sol normal.',
        'Efectuează Top-Dressing cu compost de înaltă calitate de 1-2 ori pe an pentru a adăuga materie organică.',
        'Folosește exclusiv îngrășăminte cu eliberare lentă sau peliculate, pentru a nu pierde rapid nutrienții.'
      ]
    },
    // --- PESTS ---
    'diag_moles': {
      id: 'diag_moles', type: 'danger',
      articleSlug: 'insecticide-viermi-sol', articleTitle: 'Dăunători Subterani: Viermii Albi și Scotocitoarele',
      title: 'Prezență Cârtițe',
      cause: 'Cârtițele au simțit activitate de viermi (hrana lor preferată) în gazonul tău și caută mâncare.',
      solutionTitle: 'Metode de control:',
      solutionSteps: [
        'Cea mai eficientă metodă rămân capcanele mecanice speciale pentru cârtițe (tip "clește" sau "tun"), plasate corect pe galeriile active.',
        'Aparatele cu ultrasunete au eficiență redusă pe termen lung.',
        'Tratează gazonul cu insecticide de sol pentru a omorî viermii/larvele (sursa de hrană a cârtiței). Fără mâncare, ele vor pleca.'
      ]
    },
    'diag_grubs': {
      id: 'diag_grubs', type: 'danger',
      articleSlug: 'insecticide-viermi-sol', articleTitle: 'Dăunători Subterani: Viermii Albi și Scotocitoarele',
      title: 'Larve Albe (Coropișnițe / Cărăbuș de Mai)',
      cause: 'Larvele trăiesc sub suprafața solului și mănâncă rădăcinile gazonului. Gazonul se desprinde efectiv ca un covor lipsit de ancorare.',
      solutionTitle: 'Tratament Eradicare:',
      solutionSteps: [
        'Aplică urgent un insecticid de sol (ex: Trika Expert, Force, sau insecticide lichide specifice cu udare masivă post-aplicare).',
        'Pentru soluții biologice, se pot folosi Nematode benefice aplicate pe solul umed.',
        'Reface zonele smulse prin supraînsămânțare după 1-2 săptămâni de la eradicare.'
      ]
    },
    'diag_ants': {
      id: 'diag_ants', type: 'info',
      title: 'Mușuroaie de Furnici',
      cause: 'Furnicile scoat nisip și pământ la suprafață, sufocând iarba sub mușuroi, mai ales în soluri bine drenate sau pe marginea aleilor.',
      solutionTitle: 'Control Localizat:',
      solutionSteps: [
        'Aplică praf/granule anti-furnici direct pe mușuroi (acestea le vor duce în cuib).',
        'Pulverizează o soluție insecticidă de contact în perimetrul afectat.',
        'Nivelează mecanic (cu o greblă) mușuroaiele după tratament pentru ca iarba să poată primi din nou lumină.'
      ]
    }
  };

  const isDiagnosis = (id: NodeId) => id.startsWith('diag_');

  return (
    <div className="stihl-card bg-bg-card border border-border-color rounded-2xl shadow-lg relative overflow-hidden flex flex-col min-h-[450px]">
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent-color/5 rounded-bl-full -z-10 blur-3xl transition-colors pointer-events-none"></div>
      
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-border-color/50 flex items-center justify-between z-10 bg-bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-color/10 flex items-center justify-center text-accent-color">
            <AlertTriangle size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-main">Doctorul Grădinii</h3>
            <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest mt-0.5">Sistem Expert de Diagnoză</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {history.length > 1 && (
            <button onClick={goBack} className="w-8 h-8 rounded-full bg-bg-main border border-border-color flex items-center justify-center text-text-secondary hover:text-main hover:border-accent-color/50 transition-colors">
              <ArrowLeft size={16} />
            </button>
          )}
          {history.length > 1 && (
            <button onClick={reset} className="w-8 h-8 rounded-full bg-bg-main border border-border-color flex items-center justify-center text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Resetează diagnoza">
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 flex flex-col justify-center relative z-10">
        {!isDiagnosis(currentNodeId) ? (
          // RENDER DECISION NODE
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-2xl mx-auto w-full">
            {decisions[currentNodeId].title && (
              <div className="inline-block px-3 py-1 bg-accent-color/10 text-accent-color text-[10px] font-black uppercase tracking-widest rounded-lg mb-4">
                {decisions[currentNodeId].title}
              </div>
            )}
            
            <h4 className="text-xl md:text-2xl font-black text-main mb-3 leading-tight">
              {decisions[currentNodeId].question}
            </h4>
            
            {decisions[currentNodeId].description && (
              <p className="text-sm font-medium text-text-secondary mb-8">
                {decisions[currentNodeId].description}
              </p>
            )}

            <div className="flex flex-col gap-3 mt-6">
              {decisions[currentNodeId].options.map((opt, idx) => (
                <button 
                  key={idx}
                  onClick={() => goNext(opt.nextNodeId)}
                  className="w-full p-4 bg-bg-main border border-border-color rounded-2xl text-left hover:border-accent-color/50 hover:bg-accent-color/5 transition-all flex items-center gap-4 group shadow-sm hover:shadow-md"
                >
                  {opt.icon && (
                    <div className="w-12 h-12 rounded-xl bg-bg-card border border-border-color flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                      {opt.icon}
                    </div>
                  )}
                  <div className="flex-1">
                    <span className="text-sm font-black text-main block group-hover:text-accent-color transition-colors">{opt.label}</span>
                    {opt.subtext && <span className="text-[11px] font-bold text-text-secondary mt-1 block">{opt.subtext}</span>}
                  </div>
                  <ArrowRight size={18} className="text-text-secondary group-hover:text-accent-color group-hover:translate-x-1 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          // RENDER DIAGNOSIS NODE
          <div className="animate-in fade-in zoom-in-95 duration-400 max-w-2xl mx-auto w-full">
            {(() => {
              const diag = diagnoses[currentNodeId];
              const colorClasses = {
                danger: 'bg-red-500/10 border-red-500/20 text-red-500',
                warning: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
                success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
                info: 'bg-blue-500/10 border-blue-500/20 text-blue-500'
              }[diag.type];
              
              const Icon = {
                danger: AlertTriangle,
                warning: AlertTriangle,
                success: CheckCircle2,
                info: Info
              }[diag.type];

              return (
                <div className="space-y-6">
                  {/* Diagnosis Alert */}
                  <div className={`p-6 border rounded-2xl ${colorClasses}`}>
                    <h4 className="text-sm md:text-base font-black uppercase mb-3 flex items-center gap-2">
                      <Icon size={20} strokeWidth={2.5} /> Diagnostic Confirmat:
                    </h4>
                    <h2 className="text-2xl font-black mb-3">{diag.title}</h2>
                    <p className="text-sm font-medium leading-relaxed opacity-90">
                      {diag.cause}
                    </p>
                  </div>

                  {/* Solution Block */}
                  <div className="bg-bg-main p-6 rounded-2xl border border-border-color shadow-sm">
                    <h5 className="text-xs font-black uppercase tracking-widest text-accent-color mb-4 flex items-center gap-2">
                      <Sprout size={16} /> {diag.solutionTitle}
                    </h5>
                    <ul className="space-y-3">
                      {diag.solutionSteps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-accent-color/10 text-accent-color flex items-center justify-center shrink-0 mt-0.5 border border-accent-color/20">
                            <span className="text-[10px] font-black">{idx + 1}</span>
                          </div>
                          <span className="text-sm font-bold text-main leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap justify-center gap-3 pt-4">
                    {diag.articleSlug && onNavigate && (
                      <button
                        onClick={() => {
                          try { sessionStorage.setItem('academy_open_slug', diag.articleSlug!); } catch {}
                          onNavigate(Page.Academy);
                        }}
                        className="px-6 py-3 bg-accent-color/10 border border-accent-color/30 rounded-xl text-xs font-black uppercase tracking-widest text-accent-color hover:bg-accent-color hover:text-white transition-all flex items-center gap-2"
                      >
                        <BookOpen size={14} /> Vezi Ghidul Complet
                      </button>
                    )}
                    <button
                      onClick={reset}
                      className="px-6 py-3 bg-bg-main border border-border-color rounded-xl text-xs font-black uppercase tracking-widest text-text-secondary hover:border-accent-color hover:text-main transition-all flex items-center gap-2"
                    >
                      <RotateCcw size={14} /> Reia Diagnoza
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
