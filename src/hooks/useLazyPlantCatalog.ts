import { useState, useEffect } from 'react';
import type { PlantCatalogEntry } from '../data/plantCatalog';

interface PlantCatalogData {
  plantCatalog: PlantCatalogEntry[];
  plantDifficulties: string[];
  plantCategories: string[];
  plantHeights: string[];
  plantWaterNeeds: string[];
  plantLightNeeds: string[];
  plantSeasons: string[];
  PLANT_CATEGORY_LABELS: Record<string, string>;
  PLANT_HEIGHT_LABELS: Record<string, string>;
  PLANT_WATER_LABELS: Record<string, string>;
  PLANT_LIGHT_LABELS: Record<string, string>;
  PLANT_SEASON_LABELS: Record<string, string>;
}

export function useLazyPlantCatalog() {
  const [catalog, setCatalog] = useState<PlantCatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCatalog = async () => {
      try {
        const module = await import('../data/plantCatalog');
        if (isMounted) {
          setCatalog({
            plantCatalog: module.plantCatalog,
            plantDifficulties: module.plantDifficulties,
            plantCategories: module.plantCategories,
            plantHeights: module.plantHeights,
            plantWaterNeeds: module.plantWaterNeeds,
            plantLightNeeds: module.plantLightNeeds,
            plantSeasons: module.plantSeasons,
            PLANT_CATEGORY_LABELS: module.PLANT_CATEGORY_LABELS,
            PLANT_HEIGHT_LABELS: module.PLANT_HEIGHT_LABELS,
            PLANT_WATER_LABELS: module.PLANT_WATER_LABELS,
            PLANT_LIGHT_LABELS: module.PLANT_LIGHT_LABELS,
            PLANT_SEASON_LABELS: module.PLANT_SEASON_LABELS,
          });
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to load catalog'));
          setLoading(false);
        }
      }
    };

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  return { catalog, loading, error };
}
