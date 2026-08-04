import React from 'react';
import { useTranslation } from 'react-i18next';
import { Ruler, Droplets, Sun, CalendarDays, Tag, Gauge } from 'lucide-react';
import { PlantCatalogEntry } from '../src/data/plantCatalog';

interface PlantCardProps {
  plant: PlantCatalogEntry;
  heightLabel: string;
  waterLabel: string;
  lightLabel: string;
  seasonLabel: string;
  categoryLabel: string;
  difficultyLabel: string;
  difficultyColorClass: string;
  onClick: () => void;
}

const AttributeRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2 text-xs min-w-0">
    <span className="text-text-secondary shrink-0">{icon}</span>
    <span className="text-text-secondary font-medium shrink-0">{label}:</span>
    <span className="text-text-main font-bold truncate">{value}</span>
  </div>
);

const PlantCard: React.FC<PlantCardProps> = ({
  plant,
  heightLabel,
  waterLabel,
  lightLabel,
  seasonLabel,
  categoryLabel,
  difficultyLabel,
  difficultyColorClass,
  onClick,
}) => {
  const { t } = useTranslation();
  const hasPhoto = !!plant.images && plant.images.length > 0;

  return (
    <button
      onClick={onClick}
      className="group text-left bg-accent-subtle border border-accent-border/50 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg hover:border-accent-color transition-all active:scale-[0.99] flex flex-col sm:flex-row"
    >
      {/* Left column: image + name overlay */}
      <div className="relative w-full sm:w-[38%] sm:shrink-0 aspect-[16/10] sm:aspect-auto sm:min-h-[180px] overflow-hidden bg-bg-main">
        {hasPhoto ? (
          <img
            src={`/${plant.images![0]}`}
            alt={plant.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-5xl">
            {plant.emoji}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-10 pb-2.5 px-3">
          <h3 className="font-black text-white text-sm leading-tight truncate [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]">{plant.name}</h3>
          <p className="text-[11px] text-white/90 italic truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">{plant.scientificName}</p>
        </div>
      </div>

      {/* Right column: structured attribute list */}
      <div className="flex-1 min-w-0 p-4 flex flex-col justify-center gap-2">
        <AttributeRow icon={<Ruler className="w-3.5 h-3.5" />} label={t('Înălțime') as string} value={heightLabel} />
        <AttributeRow icon={<Droplets className="w-3.5 h-3.5" />} label={t('Nevoie de apă') as string} value={waterLabel} />
        <AttributeRow icon={<Sun className="w-3.5 h-3.5" />} label={t('Lumină / zonă de plantare') as string} value={lightLabel} />
        <AttributeRow icon={<CalendarDays className="w-3.5 h-3.5" />} label={t('Anotimp de interes') as string} value={seasonLabel} />
        <AttributeRow icon={<Tag className="w-3.5 h-3.5" />} label={t('Categorie') as string} value={categoryLabel} />
        <div className="flex items-center gap-2 pt-1">
          <Gauge className="w-3.5 h-3.5 text-text-secondary shrink-0" />
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${difficultyColorClass}`}>
            {difficultyLabel}
          </span>
        </div>
      </div>
    </button>
  );
};

export default PlantCard;
