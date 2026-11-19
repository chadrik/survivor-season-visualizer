/* Photo manifest written by scripts/fetch-photos.ts and applied to the dataset. */
import type { Dataset } from '../../src/model.ts';

export interface PhotoEntry {
  title: string | null;  // Survivor Wiki page found for the player, if any
  file: string | null;   // photo file in public/photos, if any
  source: string | null; // wiki page URL the photo came from
}

/* pid -> lookup result */
export type PhotoManifest = Record<string, PhotoEntry>;

export function applyPhotos(dataset: Dataset, manifest: PhotoManifest): void {
  for (const [pid, entry] of Object.entries(manifest)) {
    const person = dataset.people[pid];
    if (!person || !entry) continue;
    if (entry.title) person.wikiTitle = entry.title;
    person.photo = entry.file
      ? { src: `photos/${entry.file}`, credit: `Photo: CBS, via Survivor Wiki (${entry.title}), ${entry.source}` }
      : null;
  }
}
