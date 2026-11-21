/* Photo manifest written by scripts/fetch-photos.ts and applied to the dataset. */
import type { Dataset } from '../../src/model.ts';

export interface PhotoEntry {
  title: string | null;   // Survivor Wiki page found for the player, if any
  source: string | null;  // wiki page URL
  /* Season id -> photo file in public/photos for that Appearance, or null when the wiki has none. */
  seasons: Record<string, string | null>;
  /* The page's main photo, kept only for a player who lacks a season photo. */
  file: string | null;
}

/* pid -> lookup result */
export type PhotoManifest = Record<string, PhotoEntry>;

const credit = (e: PhotoEntry) => `Photo: CBS, via Survivor Wiki (${e.title}), ${e.source}`;

export function applyPhotos(dataset: Dataset, manifest: PhotoManifest): void {
  for (const [pid, entry] of Object.entries(manifest)) {
    const person = dataset.people[pid];
    if (!person || !entry) continue;
    if (entry.title) person.wikiTitle = entry.title;
    person.photo = entry.file ? { src: `photos/${entry.file}`, credit: credit(entry) } : null;
  }
  for (const s of dataset.seasons) {
    for (const a of s.cast) {
      const entry = manifest[a.pid];
      const file = entry?.seasons?.[s.id];
      a.photo = entry && file ? { src: `photos/${file}`, credit: credit(entry) } : null;
    }
  }
}
