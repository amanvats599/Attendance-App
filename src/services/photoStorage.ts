import {
  copyAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';

const PHOTOS_DIR = `${documentDirectory}attendance-photos/`;

async function ensurePhotosDir(): Promise<void> {
  const info = await getInfoAsync(PHOTOS_DIR);
  if (!info.exists) {
    await makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

export async function persistPhoto(tempUri: string, prefix: string): Promise<string> {
  await ensurePhotosDir();
  const filename = `${prefix}_${Date.now()}.jpg`;
  const destination = `${PHOTOS_DIR}${filename}`;
  await copyAsync({ from: tempUri, to: destination });
  return destination;
}
