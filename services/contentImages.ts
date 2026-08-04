// App-level content image storage — Academy article covers/inline images,
// Encyclopedia plant photos, and Calendar monthly-guide covers. Deliberately
// separate from the per-user photo gallery
// (`uploads/{organizationId}/{userId}/...`, see GardenJournal.tsx and
// CareCalendar.tsx's task-completion photos): those are private,
// user-generated journal photos; these are shared reference images, the same
// for every user, that today fall back to an emoji/gradient/icon cover when
// absent, and will progressively be filled in with real photography.
//
// Storage layout (see storage.rules for the matching security rules):
//   content-images/academy/{articleId}/cover.jpg
//   content-images/academy/{articleId}/{n}.jpg        (inline images, optional)
//   content-images/plants/{plantId}/main.jpg
//   content-images/plants/{plantId}/{n}.jpg            (gallery, optional)
//   content-images/calendar/{01..12}/cover.jpg
//
// `articleId` and `plantId` are the same IDs already used everywhere else in
// the app (AcademyArticle.slug / .id, PlantCatalogEntry.id) — no separate ID
// scheme to keep in sync. Calendar months use a zero-padded 2-digit number
// (01 = January, matching monthlyGuide.ts's 0-indexed `month` field + 1), not
// the Romanian month name — a folder listing sorts and scans chronologically
// at a glance ("06" is obviously June) without depending on translated
// strings that could drift if the app adds calendar UI in another language.

import { storage, ref, uploadBytes, getDownloadURL, deleteObject, listAll } from './firebase';
import { compressImage } from '../utils/image';

export type ContentImageKind = 'academy' | 'plants' | 'calendar';

const basePath = (kind: ContentImageKind, contentId: string) => `content-images/${kind}/${contentId}`;

/** Storage path for an Academy article's cover image. */
export const academyCoverPath = (articleId: string) => `${basePath('academy', articleId)}/cover.jpg`;

/** Storage path for the Nth inline image of an Academy article (1-indexed). */
export const academyInlineImagePath = (articleId: string, index: number) =>
  `${basePath('academy', articleId)}/${index}.jpg`;

/** Storage path for a plant's primary photo. */
export const plantMainImagePath = (plantId: string) => `${basePath('plants', plantId)}/main.jpg`;

/** Storage path for the Nth gallery photo of a plant (1-indexed). */
export const plantGalleryImagePath = (plantId: string, index: number) =>
  `${basePath('plants', plantId)}/${index}.jpg`;

/**
 * Storage path for a monthly calendar guide's cover image.
 * @param monthIndex 0-indexed month, exactly as stored in monthlyGuide.ts's
 * `month` field (0 = January ... 11 = December) — converted here to the
 * 1-indexed, zero-padded folder name (01-12) so files are legible in a
 * plain Storage browser without cross-referencing code.
 */
export const calendarCoverPath = (monthIndex: number) => {
  const folder = String(monthIndex + 1).padStart(2, '0');
  return `${basePath('calendar', folder)}/cover.jpg`;
};

/**
 * Resolves a content image's public download URL, or null if nothing has
 * been uploaded at that path yet. Callers should treat null as "fall back to
 * the emoji/gradient cover", not as an error.
 */
export async function getContentImageUrl(path: string): Promise<string | null> {
  try {
    return await getDownloadURL(ref(storage, path));
  } catch {
    return null;
  }
}

/** Lists every image already uploaded for a given plant or article (gallery view for admin curation). */
export async function listContentImages(kind: ContentImageKind, contentId: string): Promise<string[]> {
  const { items } = await listAll(ref(storage, basePath(kind, contentId)));
  return Promise.all(items.map((item) => getDownloadURL(item)));
}

/**
 * Uploads (and overwrites, if one already exists) a content image at the
 * given path, compressing it client-side first. Restricted to the
 * superadmin by storage.rules — regular users/org admins cannot write here.
 */
export async function uploadContentImage(path: string, file: File): Promise<string> {
  const compressed = await compressImage(file, 1600);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, compressed);
  return getDownloadURL(storageRef);
}

/** Deletes a content image. No-ops (does not throw) if nothing exists at that path. */
export async function deleteContentImage(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch {
    // Already absent — fine, callers don't need to check existence first.
  }
}
