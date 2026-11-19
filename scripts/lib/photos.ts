/* Photo manifest written by scripts/fetch-photos.ts and applied to the dataset. */
import type { Dataset } from '../../src/model.ts';

export interface PhotoManifest {
  /* pid -> photo, or null when no photo was found */
  [pid: string]: { file: string; source: string; title: string } | null;
}

export function applyPhotos(dataset: Dataset, manifest: PhotoManifest): void {
  for (const [pid, entry] of Object.entries(manifest)) {
    const person = dataset.people[pid];
    if (!person || !entry) continue;
    person.photo = {
      src: `photos/${entry.file}`,
      credit: `Photo: CBS, via Survivor Wiki (${entry.title}), ${entry.source}`,
    };
  }
}
