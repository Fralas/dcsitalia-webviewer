/** Standard square output for squadron logos uploaded during creation. */
export const SQUADRON_LOGO_SIZE = 256;
export const SQUADRON_LOGO_BACKGROUND = '#2a2a2a';
export const SQUADRON_LOGO_MIME = 'image/jpeg';
export const SQUADRON_LOGO_QUALITY = 0.9;

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    image.src = objectUrl;
  });
}

/**
 * Resize and letterbox uploaded squadron logos to a common square size.
 * @param {File} file
 * @returns {Promise<string>} normalized JPEG data URL
 */
export async function normalizeSquadronLogo(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Invalid image file');
  }

  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = SQUADRON_LOGO_SIZE;
  canvas.height = SQUADRON_LOGO_SIZE;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas is not supported');
  }

  context.fillStyle = SQUADRON_LOGO_BACKGROUND;
  context.fillRect(0, 0, SQUADRON_LOGO_SIZE, SQUADRON_LOGO_SIZE);

  const scale = Math.min(
    SQUADRON_LOGO_SIZE / image.width,
    SQUADRON_LOGO_SIZE / image.height,
  );
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (SQUADRON_LOGO_SIZE - drawWidth) / 2;
  const offsetY = (SQUADRON_LOGO_SIZE - drawHeight) / 2;

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  return canvas.toDataURL(SQUADRON_LOGO_MIME, SQUADRON_LOGO_QUALITY);
}
