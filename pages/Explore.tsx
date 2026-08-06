import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, ArrowLeft, Check, Sprout, Sun, Droplets, Gauge, Ruler, SlidersHorizontal, MapPin, Layers, Flower2, Scissors, Bug, Shuffle, X, ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, Thermometer, Snowflake, RefreshCw, TestTube2 } from 'lucide-react';
import { useModalBackNavigation } from '../src/hooks/useModalBackNavigation';
import {
  plantCatalog,
  plantDifficulties,
  plantCategories,
  plantHeights,
  plantWaterNeeds,
  plantLightNeeds,
  plantSeasons,
  PLANT_CATEGORY_LABELS,
  PLANT_HEIGHT_LABELS,
  PLANT_WATER_LABELS,
  PLANT_LIGHT_LABELS,
  PLANT_SEASON_LABELS,
  PlantCatalogEntry,
} from '../src/data/plantCatalog';
import {
  getLocalizedPlant,
  PLANT_CATEGORY_LABELS_EN,
  PLANT_HEIGHT_LABELS_EN,
  PLANT_WATER_LABELS_EN,
  PLANT_LIGHT_LABELS_EN,
  PLANT_SEASON_LABELS_EN,
  DIFFICULTY_LABELS_EN,
} from '../src/data/plantCatalogEn';
import { db, collection, addDoc, serverTimestamp, functions, httpsCallable } from '../services/firebase';
import { auth } from '../services/firebase';
import { plantMainImagePath } from '../services/contentImages';
import ContentImage from '../components/ContentImage';
import PlantCard from '../components/PlantCard';
import PremiumUpgradeModal from '../components/PremiumUpgradeModal';
import toast from 'react-hot-toast';

interface Props {
  organizationId: string;
  subscriptionTier?: 'free' | 'pro' | 'enterprise' | 'lifetime';
  onNavigateToUpgrade?: () => void;
}

type TypeFilter = 'toate' | 'interior' | 'exterior';
type DifficultyFilter = 'toate' | PlantCatalogEntry['difficulty'];
type CategoryFilter = 'toate' | PlantCatalogEntry['category'];
type HeightFilter = 'toate' | PlantCatalogEntry['heightCategory'];
type WaterFilter = 'toate' | PlantCatalogEntry['waterNeed'];
type LightFilter = 'toate' | PlantCatalogEntry['lightNeed'];
type SeasonFilter = 'toate' | PlantCatalogEntry['seasons'][number];

const Explore: React.FC<Props> = ({ organizationId, subscriptionTier = 'free', onNavigateToUpgrade }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : 'ro';
  const categoryLabels = lang === 'en' ? PLANT_CATEGORY_LABELS_EN : PLANT_CATEGORY_LABELS;
  const heightLabels = lang === 'en' ? PLANT_HEIGHT_LABELS_EN : PLANT_HEIGHT_LABELS;
  const waterLabels = lang === 'en' ? PLANT_WATER_LABELS_EN : PLANT_WATER_LABELS;
  const lightLabels = lang === 'en' ? PLANT_LIGHT_LABELS_EN : PLANT_LIGHT_LABELS;
  const seasonLabels = lang === 'en' ? PLANT_SEASON_LABELS_EN : PLANT_SEASON_LABELS;
  const difficultyLabels = lang === 'en' ? DIFFICULTY_LABELS_EN : undefined;
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('toate');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('toate');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('toate');
  const [heightFilter, setHeightFilter] = useState<HeightFilter>('toate');
  const [waterFilter, setWaterFilter] = useState<WaterFilter>('toate');
  const [lightFilter, setLightFilter] = useState<LightFilter>('toate');
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>('toate');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPlant, setSelectedPlant] = useState<PlantCatalogEntry | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [paywallPlant, setPaywallPlant] = useState<PlantCatalogEntry | null>(null);
  const isPro = subscriptionTier !== 'free';

  // "Vitrină" paywall: every plant stays visible and browsable in the grid
  // for free users — only opening the detail view of an isPremium plant is
  // gated, so the catalog itself still reads as generous, not locked-down.
  const handlePlantClick = (plant: PlantCatalogEntry) => {
    if (plant.isPremium && !isPro) {
      setPaywallPlant(plant);
      return;
    }
    setSelectedPlant(plant);
    setGalleryIndex(0);
  };

  // Mobile quick-search FAB: the full search bar collapses into a floating
  // icon (bottom-right) once scrolled out of view, so search stays one tap
  // away instead of requiring a scroll back to the top of a 262-plant list.
  const searchBarRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchBarVisible, setSearchBarVisible] = useState(true);
  const [fabSearchOpen, setFabSearchOpen] = useState(false);

  useEffect(() => {
    const el = searchBarRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setSearchBarVisible(entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Closing the gap once the real bar is back in view keeps the FAB's
  // expanded state from being stuck open after scrolling back to the top.
  useEffect(() => {
    if (searchBarVisible) setFabSearchOpen(false);
  }, [searchBarVisible]);

  useEffect(() => {
    if (fabSearchOpen) searchInputRef.current?.focus();
  }, [fabSearchOpen]);

  const { requestClose: closePlantDetail } = useModalBackNavigation(!!selectedPlant, () => setSelectedPlant(null));

  // Lock the page behind the modal. Without this the background keeps
  // scrolling under the overlay, which reads as the modal itself "jumping".
  useEffect(() => {
    if (!selectedPlant) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [selectedPlant]);

  const localizedCatalog = useMemo(() => plantCatalog.map((p) => getLocalizedPlant(p, lang)), [lang]);

  const filteredPlants = useMemo(() => {
    const term = search.trim().toLowerCase();
    return localizedCatalog.filter((plant) => {
      if (typeFilter !== 'toate' && plant.type !== typeFilter) return false;
      if (difficultyFilter !== 'toate' && plant.difficulty !== difficultyFilter) return false;
      if (categoryFilter !== 'toate' && plant.category !== categoryFilter) return false;
      if (heightFilter !== 'toate' && plant.heightCategory !== heightFilter) return false;
      if (waterFilter !== 'toate' && plant.waterNeed !== waterFilter) return false;
      if (lightFilter !== 'toate' && plant.lightNeed !== lightFilter) return false;
      if (seasonFilter !== 'toate' && !plant.seasons.includes(seasonFilter)) return false;
      if (term && !plant.name.toLowerCase().includes(term) && !plant.scientificName.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [localizedCatalog, search, typeFilter, difficultyFilter, categoryFilter, heightFilter, waterFilter, lightFilter, seasonFilter]);

  // Any change to the result set invalidates the current page — e.g. page 4
  // of an unfiltered list is nonsense once a filter drops it to 15 results.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, difficultyFilter, categoryFilter, heightFilter, waterFilter, lightFilter, seasonFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredPlants.length / pageSize));
  const pagedPlants = useMemo(
    () => filteredPlants.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredPlants, currentPage, pageSize]
  );

  const activeExtraFilterCount = [categoryFilter, heightFilter, waterFilter, lightFilter, seasonFilter].filter(f => f !== 'toate').length;
  const totalActiveFilterCount = activeExtraFilterCount + [typeFilter, difficultyFilter].filter(f => f !== 'toate').length;

  const resetFilters = () => {
    setTypeFilter('toate');
    setDifficultyFilter('toate');
    setCategoryFilter('toate');
    setHeightFilter('toate');
    setWaterFilter('toate');
    setLightFilter('toate');
    setSeasonFilter('toate');
  };

  const handleAddToGarden = async (plant: PlantCatalogEntry) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setAddingId(plant.id);
    try {
      await addDoc(collection(db, 'user_plants'), {
        userId: uid,
        organizationId,
        catalogId: plant.id,
        name: plant.name,
        emoji: plant.emoji,
        type: plant.type,
        addedAt: serverTimestamp(),
      });
      setAddedIds((prev) => new Set(prev).add(plant.id));
      toast.success(`${plant.name} ${t('a fost adăugat în grădina ta!')}`);
    } catch (err) {
      console.error('Error adding plant to garden:', err);
      toast.error(t('Nu am putut adăuga planta. Încearcă din nou.'));
    } finally {
      setAddingId(null);
    }
  };

  const difficultyColor = (difficulty: PlantCatalogEntry['difficulty']) => {
    if (difficulty === 'ușor') return 'text-accent-color bg-accent-color/10 border-accent-color/20';
    if (difficulty === 'mediu') return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-red-500 dark:text-red-400 bg-red-500/10 border-red-500/20';
  };

  const difficultyLabel = (difficulty: PlantCatalogEntry['difficulty']) =>
    difficultyLabels ? difficultyLabels[difficulty] : difficulty;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-accent-color flex items-center justify-center text-white shadow-lg shadow-accent-color/30 shrink-0">
          <Sprout className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-text-main tracking-tight leading-tight">{t('Explorează')}</h1>
          <p className="text-text-secondary text-sm font-medium mt-1">
            {t('Caută plante, vezi cum le îngrijești și adaugă-le în grădina ta.')}
          </p>
        </div>
      </div>

      <div ref={searchBarRef} className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('Caută o plantă după nume...')}
          className="w-full bg-bg-card border border-border-color rounded-2xl py-3.5 pl-12 pr-4 text-text-main font-semibold placeholder:text-text-secondary focus:ring-2 focus:ring-accent-color focus:border-transparent outline-none transition shadow-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['toate', 'interior', 'exterior'] as TypeFilter[]).map((option) => (
          <button
            key={option}
            onClick={() => setTypeFilter(option)}
            className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition ${
              typeFilter === option
                ? 'bg-accent-color text-white border-accent-color shadow-lg shadow-accent-color/30'
                : 'bg-bg-card border-border-color text-text-secondary hover:border-accent-color/30 hover:text-text-main'
            }`}
          >
            {option === 'toate' ? t('Toate') : option === 'interior' ? t('Interior') : t('Exterior')}
          </button>
        ))}
        <span className="w-px bg-border-color mx-1" />
        {(['toate', ...plantDifficulties] as DifficultyFilter[]).map((option) => (
          <button
            key={option}
            onClick={() => setDifficultyFilter(option)}
            className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition ${
              difficultyFilter === option
                ? 'bg-accent-color text-white border-accent-color shadow-lg shadow-accent-color/30'
                : 'bg-bg-card border-border-color text-text-secondary hover:border-accent-color/30 hover:text-text-main'
            }`}
          >
            {option === 'toate' ? t('Orice dificultate') : difficultyLabel(option)}
          </button>
        ))}
        <span className="w-px bg-border-color mx-1" />
        <button
          onClick={() => setShowMoreFilters(v => !v)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition ${
            showMoreFilters || activeExtraFilterCount > 0
              ? 'bg-accent-color/10 border-accent-color/40 text-accent-color'
              : 'bg-bg-card border-border-color text-text-secondary hover:border-accent-color/30 hover:text-text-main'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {t('Mai multe filtre')}
          {activeExtraFilterCount > 0 && (
            <span className="bg-accent-color text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
              {activeExtraFilterCount}
            </span>
          )}
        </button>
        {totalActiveFilterCount > 0 && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border border-border-color text-text-secondary hover:border-red-400/50 hover:text-red-500 bg-bg-card transition"
          >
            <X className="w-3.5 h-3.5" />
            {t('Resetează filtrele')}
          </button>
        )}
      </div>

      {showMoreFilters && (
        <div className="bg-accent-subtle border border-accent-border/50 rounded-2xl p-4 space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary mb-2">{t('Categorie')}</p>
            <div className="flex flex-wrap gap-2">
              {(['toate', ...plantCategories] as CategoryFilter[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setCategoryFilter(option)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
                    categoryFilter === option
                      ? 'bg-accent-color text-white border-accent-color'
                      : 'bg-bg-main border-border-color text-text-secondary hover:border-accent-color/30 hover:text-text-main'
                  }`}
                >
                  {option === 'toate' ? t('Toate') : categoryLabels[option]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1.5">
              <Ruler className="w-3 h-3" /> {t('Înălțime')}
            </p>
            <div className="flex flex-wrap gap-2">
              {(['toate', ...plantHeights] as HeightFilter[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setHeightFilter(option)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
                    heightFilter === option
                      ? 'bg-accent-color text-white border-accent-color'
                      : 'bg-bg-main border-border-color text-text-secondary hover:border-accent-color/30 hover:text-text-main'
                  }`}
                >
                  {option === 'toate' ? t('Orice înălțime') : heightLabels[option]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1.5">
              <Droplets className="w-3 h-3" /> {t('Nevoie de apă')}
            </p>
            <div className="flex flex-wrap gap-2">
              {(['toate', ...plantWaterNeeds] as WaterFilter[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setWaterFilter(option)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
                    waterFilter === option
                      ? 'bg-accent-color text-white border-accent-color'
                      : 'bg-bg-main border-border-color text-text-secondary hover:border-accent-color/30 hover:text-text-main'
                  }`}
                >
                  {option === 'toate' ? t('Orice nevoie') : waterLabels[option]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1.5">
              <Sun className="w-3 h-3" /> {t('Lumină / zonă de plantare')}
            </p>
            <div className="flex flex-wrap gap-2">
              {(['toate', ...plantLightNeeds] as LightFilter[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setLightFilter(option)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
                    lightFilter === option
                      ? 'bg-accent-color text-white border-accent-color'
                      : 'bg-bg-main border-border-color text-text-secondary hover:border-accent-color/30 hover:text-text-main'
                  }`}
                >
                  {option === 'toate' ? t('Orice lumină') : lightLabels[option]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1.5">
              <CalendarDays className="w-3 h-3" /> {t('Anotimp de interes')}
            </p>
            <div className="flex flex-wrap gap-2">
              {(['toate', ...plantSeasons] as SeasonFilter[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setSeasonFilter(option)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
                    seasonFilter === option
                      ? 'bg-accent-color text-white border-accent-color'
                      : 'bg-bg-main border-border-color text-text-secondary hover:border-accent-color/30 hover:text-text-main'
                  }`}
                >
                  {option === 'toate' ? t('Orice anotimp') : seasonLabels[option]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {filteredPlants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
          <Search className="w-10 h-10 mb-3 opacity-40" />
          <p className="font-bold">{t('Nicio plantă găsită')}</p>
          <p className="text-sm mt-1">{t('Încearcă alți termeni de căutare sau alte filtre.')}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold text-text-secondary">
              {t('Afișare')} {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredPlants.length)} {t('din')} {filteredPlants.length}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-secondary">{t('Pe pagină')}:</span>
              {[20, 50, 100].map((size) => (
                <button
                  key={size}
                  onClick={() => setPageSize(size)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                    pageSize === size
                      ? 'bg-accent-color text-white'
                      : 'bg-bg-card border border-border-color text-text-secondary hover:border-accent-color/30 hover:text-text-main'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
            {pagedPlants.map((plant) => (
              <PlantCard
                key={plant.id}
                plant={plant}
                heightLabel={heightLabels[plant.heightCategory]}
                waterLabel={waterLabels[plant.waterNeed]}
                lightLabel={lightLabels[plant.lightNeed]}
                seasonLabel={plant.seasons.map((s) => seasonLabels[s]).join(', ')}
                categoryLabel={categoryLabels[plant.category]}
                difficultyLabel={difficultyLabel(plant.difficulty)}
                difficultyColorClass={difficultyColor(plant.difficulty)}
                onClick={() => handlePlantClick(plant)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-bg-card border border-border-color text-text-secondary hover:border-accent-color/30 hover:text-text-main disabled:opacity-30 disabled:pointer-events-none transition"
                aria-label={t('Pagina anterioară')}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-text-secondary px-2">
                {t('Pagina')} {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-bg-card border border-border-color text-text-secondary hover:border-accent-color/30 hover:text-text-main disabled:opacity-30 disabled:pointer-events-none transition"
                aria-label={t('Pagina următoare')}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {selectedPlant && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-x-hidden"
            onClick={closePlantDetail}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              // Full screen on mobile (a real "page", not a shrunken desktop
              // dialog with a gap at the top) — `100dvh`/`rounded-none` edge
              // to edge. From `sm:` up it's back to the centered card dialog.
              // `overflow-hidden` clips the scroll area to the (rounded, on
              // desktop) corners; `overflow-x-hidden` on top of that rules
              // out any stray horizontal scroll from long content.
              className="relative w-full h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[92dvh] sm:max-w-lg flex flex-col overflow-hidden overflow-x-hidden bg-bg-card rounded-none sm:rounded-3xl shadow-2xl"
            >
              {/* Floating back button only — the photo and title scroll
                  away with the rest of the content instead of sitting in a
                  pinned header, so the info list gets the full modal height
                  instead of losing a fixed chunk to a photo that's already
                  been seen once on the grid card. */}
              <button
                onClick={closePlantDetail}
                aria-label={t('Înapoi')}
                className="absolute z-10 left-3 top-[max(env(safe-area-inset-top),12px)] sm:top-3 flex items-center gap-1.5 min-w-[44px] min-h-[44px] px-3 rounded-full bg-black/40 hover:bg-black/55 backdrop-blur-sm text-white text-sm font-bold transition-all [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]"
              >
                <ArrowLeft className="w-5 h-5 shrink-0" />
                <span>{t('Înapoi')}</span>
              </button>

              {/* `min-h-0` is required: a flex child defaults to min-height:auto,
                  which refuses to shrink below its content and breaks the scroll.
                  `-webkit-overflow-scrolling: touch` gives old iOS Safari
                  momentum/inertia scrolling inside the panel. */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              {selectedPlant.images && selectedPlant.images.length > 0 ? (
                <div className="relative w-full aspect-[4/3] overflow-hidden shadow-inner bg-bg-main group/gallery">
                  <img
                    src={`/${selectedPlant.images[galleryIndex]}`}
                    alt={`${selectedPlant.name} ${galleryIndex + 1}`}
                    onClick={() => setLightboxOpen(true)}
                    className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
                  />
                  {selectedPlant.images.length > 1 && (
                    <>
                      <button
                        onClick={() => setGalleryIndex((i) => (i === 0 ? selectedPlant.images!.length - 1 : i - 1))}
                        aria-label={t('Poza anterioară') as string}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={() => setGalleryIndex((i) => (i === selectedPlant.images!.length - 1 ? 0 : i + 1))}
                        aria-label={t('Poza următoare') as string}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition"
                      >
                        <ChevronRight size={18} />
                      </button>
                      <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-1.5">
                        {selectedPlant.images.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setGalleryIndex(i)}
                            aria-label={`${t('Poza')} ${i + 1}`}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${i === galleryIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="pt-[max(env(safe-area-inset-top),16px)] px-4 sm:px-6">
                  <ContentImage
                    path={plantMainImagePath(selectedPlant.id)}
                    alt={selectedPlant.name}
                    className="w-16 h-16 rounded-2xl object-cover shadow-inner mb-4"
                    fallback={
                      <div className="w-16 h-16 rounded-2xl bg-bg-main flex items-center justify-center text-3xl shadow-inner mb-4">
                        {selectedPlant.emoji}
                      </div>
                    }
                  />
                </div>
              )}
              <div className="px-4 sm:px-6 pt-4 pb-5">
              <h2 className="text-xl font-black text-text-main leading-tight">{selectedPlant.name}</h2>
              <p className="text-sm text-text-secondary italic mb-5">{selectedPlant.scientificName}</p>
              <p className="text-sm text-text-main leading-relaxed mb-5">{selectedPlant.description}</p>

              <div className="grid grid-cols-1 gap-3 mb-6">
                <div className="flex items-start gap-3 bg-bg-main rounded-2xl p-3 border border-border-color">
                  <Droplets className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Udare')}</p>
                    <p className="text-sm text-text-main font-medium">{selectedPlant.watering}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-bg-main rounded-2xl p-3 border border-border-color">
                  <Sun className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Lumină')}</p>
                    <p className="text-sm text-text-main font-medium">{selectedPlant.light}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-bg-main rounded-2xl p-3 border border-border-color">
                  <Gauge className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Dificultate')}</p>
                    <p className="text-sm text-text-main font-medium capitalize">{difficultyLabel(selectedPlant.difficulty)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Origine')}</p>
                    <p className="text-sm text-text-main">{selectedPlant.origin}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Layers className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Sol')}</p>
                    <p className="text-sm text-text-main">{selectedPlant.soil}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Flower2 className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Perioadă de înflorire')}</p>
                    <p className="text-sm text-text-main">{selectedPlant.bloomTime}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Sprout className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Fertilizare')}</p>
                    <p className="text-sm text-text-main">{selectedPlant.fertilizing}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Scissors className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Întreținere')}</p>
                    <p className="text-sm text-text-main">{selectedPlant.maintenance}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Bug className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Probleme frecvente')}</p>
                    <p className="text-sm text-text-main">{selectedPlant.commonProblems}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shuffle className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Înmulțire')}</p>
                    <p className="text-sm text-text-main">{selectedPlant.propagation}</p>
                  </div>
                </div>

                {/* Second expansion pass — every row here is conditional on
                    the field actually being filled in, so plants not yet
                    backfilled render exactly as before (no empty rows, no
                    "N/A" clutter). Toxicity applies to both types; the rest
                    are split by which type they're meaningful for. */}
                {selectedPlant.toxicity && (
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Toxicitate')}</p>
                      <p className="text-sm text-text-main">{selectedPlant.toxicity}</p>
                    </div>
                  </div>
                )}
                {selectedPlant.matureSize && (
                  <div className="flex items-start gap-3">
                    <Ruler className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Dimensiuni la maturitate')}</p>
                      <p className="text-sm text-text-main">{selectedPlant.matureSize}</p>
                    </div>
                  </div>
                )}
                {selectedPlant.tempHumidity && (
                  <div className="flex items-start gap-3">
                    <Thermometer className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Temperatură & Umiditate')}</p>
                      <p className="text-sm text-text-main">{selectedPlant.tempHumidity}</p>
                    </div>
                  </div>
                )}
                {selectedPlant.repotting && (
                  <div className="flex items-start gap-3">
                    <RefreshCw className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Replantare')}</p>
                      <p className="text-sm text-text-main">{selectedPlant.repotting}</p>
                    </div>
                  </div>
                )}
                {selectedPlant.sunExposure && (
                  <div className="flex items-start gap-3">
                    <Sun className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Expunere la soare')}</p>
                      <p className="text-sm text-text-main">{selectedPlant.sunExposure}</p>
                    </div>
                  </div>
                )}
                {selectedPlant.frostHardiness && (
                  <div className="flex items-start gap-3">
                    <Snowflake className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Rezistență la ger')}</p>
                      <p className="text-sm text-text-main">{selectedPlant.frostHardiness}</p>
                    </div>
                  </div>
                )}
                {selectedPlant.sizeSpacing && (
                  <div className="flex items-start gap-3">
                    <Ruler className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Dimensiuni & Distanțare')}</p>
                      <p className="text-sm text-text-main">{selectedPlant.sizeSpacing}</p>
                    </div>
                  </div>
                )}
                {selectedPlant.pruningTime && (
                  <div className="flex items-start gap-3">
                    <Scissors className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Perioadă de tăiere')}</p>
                      <p className="text-sm text-text-main">{selectedPlant.pruningTime}</p>
                    </div>
                  </div>
                )}
                {selectedPlant.soilPh && (
                  <div className="flex items-start gap-3">
                    <TestTube2 className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-text-secondary">{t('Cerințe sol/pH')}</p>
                      <p className="text-sm text-text-main">{selectedPlant.soilPh}</p>
                    </div>
                  </div>
                )}
              </div>
              </div>
              </div>

              <div className="shrink-0 px-4 sm:px-6 pt-4 pb-[max(env(safe-area-inset-bottom),16px)] sm:pb-4 border-t border-border-color bg-bg-card">
              <button
                onClick={() => handleAddToGarden(selectedPlant)}
                disabled={addingId === selectedPlant.id || addedIds.has(selectedPlant.id)}
                className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg active:scale-[0.98] ${
                  addedIds.has(selectedPlant.id)
                    ? 'bg-accent-color/20 text-accent-color cursor-default'
                    : 'bg-accent-color text-white hover:brightness-95 shadow-accent-color/30'
                }`}
              >
                {addedIds.has(selectedPlant.id) ? (
                  <>
                    <Check className="w-5 h-5" /> {t('Adăugată în grădina ta')}
                  </>
                ) : addingId === selectedPlant.id ? (
                  t('Se adaugă...')
                ) : (
                  t('+ Adaugă în grădina mea')
                )}
              </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox — full-screen zoom, separate overlay from the detail
          modal so its own open/close animation doesn't fight the modal's. */}
      <AnimatePresence>
        {lightboxOpen && selectedPlant?.images && selectedPlant.images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              aria-label={t('Închide')}
              className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
            >
              <X size={20} />
            </button>

            <img
              src={`/${selectedPlant.images[galleryIndex]}`}
              alt={`${selectedPlant.name} ${galleryIndex + 1}`}
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-full object-contain rounded-lg"
            />

            {selectedPlant.images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setGalleryIndex((i) => (i === 0 ? selectedPlant.images!.length - 1 : i - 1)); }}
                  aria-label={t('Poza anterioară') as string}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setGalleryIndex((i) => (i === selectedPlant.images!.length - 1 ? 0 : i + 1)); }}
                  aria-label={t('Poza următoare') as string}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                >
                  <ChevronRight size={22} />
                </button>
                <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-2">
                  {selectedPlant.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setGalleryIndex(i); }}
                      aria-label={`${t('Poza')} ${i + 1}`}
                      className={`h-2 rounded-full transition-all ${i === galleryIndex ? 'bg-white w-6' : 'bg-white/40 w-2'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile quick-search FAB — collapses/expands with the real search
          bar's visibility rather than page scroll position directly, so it
          reacts correctly however the bar leaves view (scroll, filters
          panel opening and pushing it up, etc). Sits above MobileDock. */}
      <div
        className="md:hidden fixed right-4 z-40 pointer-events-none"
        style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}
      >
        <AnimatePresence>
          {!searchBarVisible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto flex items-center justify-end"
            >
              {fabSearchOpen ? (
                <div className="flex items-center gap-2 bg-bg-card border border-border-color rounded-full shadow-2xl pl-4 pr-2 py-2 w-[min(80vw,320px)]">
                  <Search className="w-4 h-4 text-text-secondary shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('Caută o plantă după nume...') as string}
                    className="flex-1 min-w-0 bg-transparent text-sm text-text-main font-semibold placeholder:text-text-secondary outline-none"
                  />
                  <button
                    onClick={() => {
                      // Mirrors the standard search-field convention: the X
                      // clears the query first (so it doubles as a reset,
                      // not just a close button) and only collapses the box
                      // back to the icon once there's nothing left to clear.
                      if (search) {
                        setSearch('');
                        searchInputRef.current?.focus();
                      } else {
                        setFabSearchOpen(false);
                      }
                    }}
                    aria-label={(search ? t('Resetează căutarea') : t('Închide')) as string}
                    className="shrink-0 w-7 h-7 rounded-full bg-bg-main flex items-center justify-center text-text-secondary hover:text-text-main transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setFabSearchOpen(true)}
                  aria-label={t('Caută o plantă după nume...') as string}
                  className="w-12 h-12 rounded-full bg-accent-color text-white shadow-2xl shadow-accent-color/40 flex items-center justify-center hover:brightness-95 active:scale-95 transition"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {paywallPlant && (
        <PremiumUpgradeModal
          triggerItem={{
            title: paywallPlant.name,
            emoji: paywallPlant.emoji,
            categoryLabel: categoryLabels[paywallPlant.category],
            meta: `${t('Dificultate')}: ${difficultyLabel(paywallPlant.difficulty)}`,
          }}
          onClose={() => setPaywallPlant(null)}
          onUpgrade={async () => {
            try {
              const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
              const base = `${window.location.origin}${window.location.pathname}`;
              const result: any = await createCheckoutSession({
                successUrl: `${base}#explore?upgraded=1`,
                cancelUrl: `${base}#explore`,
              });
              const url = result?.data?.url;
              if (!url) throw new Error('No checkout URL returned.');
              window.location.href = url;
            } catch (err: any) {
              console.error(err);
              const message: string = err?.message || '';
              if (message.includes('not configured')) {
                toast.error(t('Plățile online nu sunt încă active. Contactează-ne pentru un cod de acces.'));
              } else {
                toast.error(t('Nu am putut iniția plata. Încearcă din nou.'));
              }
              setPaywallPlant(null);
            }
          }}
        />
      )}
    </div>
  );
};

export default Explore;
