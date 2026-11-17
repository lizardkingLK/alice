/** Max data-URL length stored in localStorage for a note cover (~300KB). */
export const NOTE_COVER_DATA_URL_MAX = 300_000;

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Could not read the image.'));
    });
    reader.addEventListener('error', () => {
      reject(new Error('Could not read the image.'));
    });
    reader.readAsDataURL(file);
  });
}

export function assertNoteCoverDataUrl(dataUrl: string): string {
  if (dataUrl.length > NOTE_COVER_DATA_URL_MAX) {
    throw new Error(
      'Cover image is too large for this device. Try a smaller crop.'
    );
  }
  return dataUrl;
}
