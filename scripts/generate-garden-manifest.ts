// Runs as part of the `prebuild` step (see package.json) — writes
// content/garden/plant-manifest.json fresh on every build.
// This manifest contains plant care metadata needed by the auto-task
// generation API without having to import the full plantCatalog.ts
// (which would fail in production bundlers).

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { plantCatalog } from '../src/data/plantCatalog';

const manifest = plantCatalog.map(p => ({
  id: p.id,
  name: p.name,
  emoji: p.emoji,
  watering: p.watering,
  pruningTime: p.pruningTime,
  fertilizing: p.fertilizing,
  frostHardiness: p.frostHardiness,
  heightCategory: p.heightCategory,
}));

const outputPath = 'content/garden/plant-manifest.json';
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(manifest));
console.log(`[generate-garden-manifest] wrote ${manifest.length} plants`);
