// Runs as part of the `prebuild` step (see package.json) — writes
// content/academy/manifest.json fresh on every build.
//
// api/academy/article.ts (a Vercel serverless function) needs to look up
// {contentPath, isPremium} by article id, but importing src/data/
// academyContent.ts directly from api/ 500s in production with
// ERR_MODULE_NOT_FOUND — Vercel's per-function bundler doesn't trace that
// import (same class of failure as the api/_lib case documented in the
// auth functions). Baking the lookup table into a plain JSON file instead
// sidesteps the bundler entirely: the function just reads a file off disk,
// which vercel.json's functions.includeFiles guarantees is present.
//
// Run with tsx (not plain node) since it imports a .ts source file.
import { writeFileSync } from 'fs';
import { ARTICLES_RO, ARTICLES_EN } from '../src/data/academyContent';

const manifest = [...ARTICLES_RO, ...ARTICLES_EN].map(a => ({
  id: a.id,
  contentPath: a.contentPath,
  isPremium: a.isPremium,
}));

writeFileSync('content/academy/manifest.json', JSON.stringify(manifest));
console.log(`[generate-academy-manifest] wrote ${manifest.length} articles`);
