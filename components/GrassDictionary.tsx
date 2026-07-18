import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Droplets, Sun, Sprout, Info, Snowflake, Flame, AlertOctagon } from 'lucide-react';

const grassSpecies = [
  // SEZON RECE (Cool-Season) - Majoritare în România
  { category: 'Sezon Rece', euName: 'Poa pratensis', usName: 'Kentucky Bluegrass (KBG)', growth: 'Rizomi puternici', features: 'Toleranță excelentă la frig și trafic. Se regenerează singur. Necesită mult soare și irigare abundentă.', droughtTolerance: 'Medie', shadeTolerance: 'Slabă' },
  { category: 'Sezon Rece', euName: 'Festuca arundinacea', usName: 'Tall Fescue (TF)', growth: 'Tufe, rădăcini adânci', features: 'Cea mai rezistentă specie de sezon rece la secetă și căldură. Frunză mai lată. Nu se regenerează singură pe zonele goale.', droughtTolerance: 'Excelentă', shadeTolerance: 'Bună' },
  { category: 'Sezon Rece', euName: 'Lolium perenne', usName: 'Perennial Ryegrass (PRG)', growth: 'Tufe, germinare rapidă', features: 'Răsare în 5-7 zile. Frunză cu luciu pe spate. Rezistă bine la trafic intens. Tăierea curată e dificilă dacă lama nu e ascuțită.', droughtTolerance: 'Slabă', shadeTolerance: 'Medie' },
  { category: 'Sezon Rece', euName: 'Festuca rubra rubra', usName: 'Creeping Red Fescue', growth: 'Rizomi scurți', features: 'Făcând parte din categoria "Fine Fescues". Frunză fină, ca un ac. Ideală pentru umbră. Necesar foarte mic de azot.', droughtTolerance: 'Bună', shadeTolerance: 'Excelentă' },
  { category: 'Sezon Rece', euName: 'Festuca rubra commutata', usName: 'Chewings Fescue', growth: 'Tufe dense', features: 'Crește foarte dens. Rezistă la tunderi foarte scurte. Foarte tolerantă la umbră și soluri acide.', droughtTolerance: 'Bună', shadeTolerance: 'Excelentă' },
  { category: 'Sezon Rece', euName: 'Festuca trachyphylla', usName: 'Hard Fescue', growth: 'Tufe', features: 'Cea mai rezistentă la secetă și căldură dintre speciile cu frunză fină. Creștere foarte lentă.', droughtTolerance: 'Excelentă', shadeTolerance: 'Bună' },
  { category: 'Sezon Rece', euName: 'Agrostis stolonifera', usName: 'Creeping Bentgrass', growth: 'Stoloni agresivi', features: 'Folosită pe terenurile de golf (putting greens). Necesită tundere la câțiva milimetri, tratamente fungicide intense și aerare constantă.', droughtTolerance: 'Slabă', shadeTolerance: 'Slabă' },

  // SEZON CALD (Warm-Season) - Tradiționale SUA, intră în latență (se usucă) iarna la noi
  { category: 'Sezon Cald', euName: 'Cynodon dactylon', usName: 'Bermudagrass', growth: 'Rizomi și Stoloni', features: 'Creștere extrem de agresivă. Iubește căldura toridă. La prima brumă de toamnă se face complet galben (latență).', droughtTolerance: 'Excelentă', shadeTolerance: 'Foarte Slabă' },
  { category: 'Sezon Cald', euName: 'Zoysia japonica', usName: 'Zoysiagrass', growth: 'Rizomi și Stoloni', features: 'Formează un covor extrem de dens care sufocă buruienile. Crește foarte lent. Se îngălbenește iarna.', droughtTolerance: 'Bună', shadeTolerance: 'Medie spre Bună' },
  { category: 'Sezon Cald', euName: 'Stenotaphrum secundatum', usName: 'St. Augustinegrass', growth: 'Stoloni', features: 'Frunză foarte lată. Cea mai tolerantă la umbră dintre speciile de sezon cald. Sensibilă la ger.', droughtTolerance: 'Slabă', shadeTolerance: 'Excelentă' },

  // BURUIENI GRAMINEE (Probleme frecvente)
  { category: 'Buruieni/Probleme', euName: 'Poa annua', usName: 'Annual Bluegrass', growth: 'Tufe, semințe masive', features: 'Cea mai răspândită buruiană graminee. Face spiculețe albe (semințe) chiar și tunsă scurt. Moare vara la căldură lăsând goluri.', droughtTolerance: 'Foarte Slabă', shadeTolerance: 'Bună' },
  { category: 'Buruieni/Probleme', euName: 'Poa trivialis', usName: 'Rough Bluegrass', growth: 'Stoloni (patch-uri)', features: 'Culoare verde-gălbui deschis. Se întinde pe deasupra solului. Piere la secetă dar revine toamna din stoloni.', droughtTolerance: 'Slabă', shadeTolerance: 'Excelentă' },
  { category: 'Buruieni/Probleme', euName: 'Elymus repens', usName: 'Quackgrass / Pir', growth: 'Rizomi groși și albi', features: 'O buruiană perenă extrem de agresivă (pirul târâtor). Nu poate fi combătută selectiv din gazon, necesită glifosat.', droughtTolerance: 'Excelentă', shadeTolerance: 'Medie' }
];

const getToleranceColor = (level: string) => {
  switch (level.toLowerCase()) {
    case 'excelentă': return 'bg-emerald-500 text-emerald-900 border-emerald-200';
    case 'bună': return 'bg-green-400 text-green-900 border-green-200';
    case 'medie spre bună': return 'bg-green-300 text-green-900 border-green-200';
    case 'medie': return 'bg-amber-400 text-amber-900 border-amber-200';
    case 'slabă': return 'bg-red-400 text-red-900 border-red-200';
    case 'foarte slabă': return 'bg-red-600 text-white border-red-700';
    default: return 'bg-gray-400 text-gray-900 border-gray-200';
  }
};

const getToleranceWidth = (level: string) => {
  switch (level.toLowerCase()) {
    case 'excelentă': return '100%';
    case 'bună': return '75%';
    case 'medie spre bună': return '65%';
    case 'medie': return '50%';
    case 'slabă': return '25%';
    case 'foarte slabă': return '10%';
    default: return '0%';
  }
};

const GrassDictionary: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('Sezon Rece');

  const filteredSpecies = grassSpecies.filter(s => s.category === activeTab);

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-5xl mx-auto relative overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-6">
        <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 shadow-inner shrink-0">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-xl leading-tight">Dicționar Specii Gazon (EU vs SUA)</h2>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">
            Învață să citești etichetele și să recunoști problemele.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex flex-col sm:flex-row bg-gray-50 border border-gray-100 rounded-2xl p-1.5 shadow-inner gap-1">
          <button 
            onClick={() => setActiveTab('Sezon Rece')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'Sezon Rece' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
          >
            <Snowflake className="w-4 h-4" /> Sezon Rece (Adaptate EU)
          </button>
          <button 
            onClick={() => setActiveTab('Sezon Cald')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'Sezon Cald' ? 'bg-amber-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
          >
            <Flame className="w-4 h-4" /> Sezon Cald (Tipic SUA)
          </button>
          <button 
            onClick={() => setActiveTab('Buruieni/Probleme')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'Buruieni/Probleme' ? 'bg-rose-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
          >
            <AlertOctagon className="w-4 h-4" /> Buruieni Graminee
          </button>
        </div>

        {/* Grid Specii */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredSpecies.map((species, index) => (
              <motion.div 
                key={species.euName}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition relative overflow-hidden group flex flex-col justify-between"
              >
                {/* Fundal subtil decorativ funcție de categorie */}
                <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-2xl transition opacity-50 ${
                  species.category === 'Sezon Rece' ? 'bg-teal-500/10 group-hover:bg-teal-500/20' :
                  species.category === 'Sezon Cald' ? 'bg-amber-500/10 group-hover:bg-amber-500/20' :
                  'bg-rose-500/10 group-hover:bg-rose-500/20'
                }`}></div>

                <div>
                  <h3 className={`text-2xl font-black tracking-tight ${
                    species.category === 'Sezon Rece' ? 'text-teal-700' :
                    species.category === 'Sezon Cald' ? 'text-amber-700' :
                    'text-rose-700'
                  }`}>
                    {species.euName}
                  </h3>
                  <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 mt-2 mb-4">
                    <img src="https://flagcdn.com/w20/us.png" alt="US Flag" className="w-4 h-auto rounded-sm opacity-80" />
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                      SUA: <span className="text-gray-900">{species.usName}</span>
                    </span>
                  </div>

                  <div className="space-y-4 mt-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1">
                        <Sprout className="w-3 h-3 text-gray-400" /> Tip Creștere
                      </p>
                      <p className="text-sm font-semibold text-gray-800">{species.growth}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1">
                        <Info className="w-3 h-3 text-gray-400" /> Caracteristici Cheie
                      </p>
                      <p className="text-sm text-gray-600 leading-relaxed font-medium">{species.features}</p>
                    </div>
                  </div>
                </div>

                {/* Toleranțe */}
                <div className="mt-6 pt-5 border-t border-gray-50 space-y-3">
                  
                  {/* Toleranță Secetă */}
                  <div>
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                        <Droplets className="w-3 h-3 text-blue-500" /> Secetă
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-opacity-20 ${getToleranceColor(species.droughtTolerance).replace('bg-', 'text-').split(' ')[0]}`}>
                        {species.droughtTolerance}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: getToleranceWidth(species.droughtTolerance) }}
                        transition={{ duration: 1, delay: 0.1 }}
                        className={`h-full rounded-full ${getToleranceColor(species.droughtTolerance).split(' ')[0]}`}
                      ></motion.div>
                    </div>
                  </div>

                  {/* Toleranță Umbră */}
                  <div>
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                        <Sun className="w-3 h-3 text-amber-500" /> Umbră
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-opacity-20 ${getToleranceColor(species.shadeTolerance).replace('bg-', 'text-').split(' ')[0]}`}>
                        {species.shadeTolerance}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: getToleranceWidth(species.shadeTolerance) }}
                        transition={{ duration: 1, delay: 0.2 }}
                        className={`h-full rounded-full ${getToleranceColor(species.shadeTolerance).split(' ')[0]}`}
                      ></motion.div>
                    </div>
                  </div>

                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
};

export default GrassDictionary;
