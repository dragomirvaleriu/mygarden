// App-level content image storage — Academy article covers/inline images and
// Encyclopedia plant photos. Deliberately separate from the per-user photo
// gallery (`uploads/{organizationId}/{userId}/...`, see GardenJournal.tsx and
// CareCalendar.tsx): those are private, user-generated journal photos; these
// are shared reference images, the same for every user, that today fall back
// to an emoji/gradient cover when absent, and will progressively be filled in
// with real photography.
//
// Storage layout (see storage.rules for the matching security rules):
//   content-images/academy/{articleId}/cover.jpg
//   content-images/academy/{articleId}/{n}.jpg        (inline images, optional)
//   content-images/plants/{plantId}/main.jpg
//   content-images/plants/{plantId}/{n}.jpg            (gallery, optional)
//
// `articleId` and `plantId` are the same IDs already used everywhere else in
// the app (AcademyArticle.slug / .id, PlantCatalogEntry.id) — no separate ID
// scheme to keep in sync.

import { storage, ref, uploadBytes, getDownloadURL, deleteObject, listAll } from './firebase';
import { compressImage } from '../utils/image';

export type ContentImageKind = 'academy' | 'plants';

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
