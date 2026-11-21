const MAX_DIMENSION = 1024;
const TARGET_BYTES = 300_000;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

/**
 * Downscale and re-encode a photo in the browser before upload.
 * A 4 MB phone photo becomes ~150–300 KB: faster uploads on mobile data,
 * fewer Gemini input tokens, and it fits comfortably in a Firestore document.
 */
export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length * 0.75 > TARGET_BYTES && quality > 0.4) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Location is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Location permission was denied. Type the address or pick it on the map.'
              : 'Could not get your location. Type the address or pick it on the map.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

/** Reverse geocode with OpenStreetMap Nominatim (free, no key; used only on explicit user action). */
export async function reverseGeocode({ lat, lng }: Coordinates): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name?.split(',').slice(0, 4).join(',').trim() ?? null;
  } catch {
    return null;
  }
}
