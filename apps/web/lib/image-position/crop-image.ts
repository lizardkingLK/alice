import type { Area } from 'react-easy-crop';

/**
 * Rasterize the cropped region from `react-easy-crop` into a JPEG File
 * suitable for multipart upload (profile/project images).
 */
export async function cropImageToFile(
  imageSrc: string,
  pixelCrop: Area,
  fileName: string,
  mimeType = 'image/jpeg',
  quality = 0.92
): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const width = Math.max(1, Math.round(pixelCrop.width));
  const height = Math.max(1, Math.round(pixelCrop.height));
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not prepare the image for upload.');
  }

  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    width,
    height
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error('Could not encode the cropped image.'));
      },
      mimeType,
      quality
    );
  });

  const baseName = fileName.replace(/\.[^.]+$/, '') || 'image';
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  return new File([blob], `${baseName}.${extension}`, { type: mimeType });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () =>
      reject(new Error('Could not load the selected image.'))
    );
    image.crossOrigin = 'anonymous';
    image.src = src;
  });
}
