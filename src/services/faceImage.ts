import { EncodingType, readAsStringAsync } from 'expo-file-system/legacy';
import { decode as decodeJpeg } from 'jpeg-js';

import type { Point } from './faceMatch';

const MAX_EDGE = 1280;

export async function decodeOrientedImage(
  uri: string,
  leftEye: Point,
  rightEye: Point
): Promise<{ rgba: Uint8Array; width: number; height: number; leftEye: Point; rightEye: Point }> {
  const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  const bytes = base64ToBytes(base64);
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('Use a JPEG photo from the camera or photo library.');
  }

  let decoded: { data: Uint8Array; width: number; height: number };
  try {
    decoded = decodeJpeg(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 24,
      maxMemoryUsageInMB: 256,
    });
  } catch {
    throw new Error('Could not read that photo. Take another picture and try again.');
  }

  const oriented = applyExifOrientation(decoded.data, decoded.width, decoded.height, readJpegOrientation(bytes));
  const fitted = fitMaxEdge(oriented.data, oriented.width, oriented.height, MAX_EDGE);
  return {
    rgba: fitted.data,
    width: fitted.width,
    height: fitted.height,
    leftEye: scalePoint(leftEye, fitted.scale),
    rightEye: scalePoint(rightEye, fitted.scale),
  };
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function scalePoint(point: Point, scale: number): Point {
  return { x: point.x * scale, y: point.y * scale };
}

function readJpegOrientation(bytes: Uint8Array): number {
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      break;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) {
      break;
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) {
      break;
    }
    if (marker === 0xe1) {
      const start = offset + 4;
      if (
        bytes[start] === 0x45 &&
        bytes[start + 1] === 0x78 &&
        bytes[start + 2] === 0x69 &&
        bytes[start + 3] === 0x66
      ) {
        return readTiffOrientation(bytes, start + 6) ?? 1;
      }
    }
    offset += 2 + length;
  }
  return 1;
}

function readTiffOrientation(bytes: Uint8Array, tiffStart: number): number | null {
  if (tiffStart + 8 > bytes.length) {
    return null;
  }
  const little = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
  const big = bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d;
  if (!little && !big) {
    return null;
  }
  const read16 = (position: number) => {
    if (position + 1 >= bytes.length) {
      return 0;
    }
    return little ? bytes[position] | (bytes[position + 1] << 8) : (bytes[position] << 8) | bytes[position + 1];
  };
  const read32 = (position: number) => {
    if (position + 3 >= bytes.length) {
      return 0;
    }
    return little
      ? bytes[position] |
          (bytes[position + 1] << 8) |
          (bytes[position + 2] << 16) |
          (bytes[position + 3] << 24)
      : (bytes[position] << 24) |
          (bytes[position + 1] << 16) |
          (bytes[position + 2] << 8) |
          bytes[position + 3];
  };
  if (read16(tiffStart + 2) !== 42) {
    return null;
  }
  let ifd = tiffStart + read32(tiffStart + 4);
  if (ifd + 2 > bytes.length) {
    return null;
  }
  const entries = read16(ifd);
  ifd += 2;
  for (let i = 0; i < entries; i++) {
    const entry = ifd + i * 12;
    if (entry + 8 > bytes.length) {
      return null;
    }
    if (read16(entry) === 0x0112) {
      const value = read16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

function applyExifOrientation(
  data: Uint8Array,
  width: number,
  height: number,
  orientation: number
): { data: Uint8Array; width: number; height: number } {
  switch (orientation) {
    case 2:
      return flipHorizontal(data, width, height);
    case 3:
      return rotate180(data, width, height);
    case 4:
      return flipVertical(data, width, height);
    case 5:
      return flipHorizontal(rotate90CW(data, width, height).data, height, width);
    case 6:
      return rotate90CW(data, width, height);
    case 7:
      return flipHorizontal(rotate90CCW(data, width, height).data, height, width);
    case 8:
      return rotate90CCW(data, width, height);
    default:
      return { data, width, height };
  }
}

function rotate90CW(data: Uint8Array, width: number, height: number) {
  const out = new Uint8Array(data.length);
  const newWidth = height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      copyPixel(data, width, x, y, out, newWidth, height - 1 - y, x);
    }
  }
  return { data: out, width: newWidth, height: width };
}

function rotate90CCW(data: Uint8Array, width: number, height: number) {
  const out = new Uint8Array(data.length);
  const newWidth = height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      copyPixel(data, width, x, y, out, newWidth, y, width - 1 - x);
    }
  }
  return { data: out, width: newWidth, height: width };
}

function rotate180(data: Uint8Array, width: number, height: number) {
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      copyPixel(data, width, x, y, out, width, width - 1 - x, height - 1 - y);
    }
  }
  return { data: out, width, height };
}

function flipHorizontal(data: Uint8Array, width: number, height: number) {
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      copyPixel(data, width, x, y, out, width, width - 1 - x, y);
    }
  }
  return { data: out, width, height };
}

function flipVertical(data: Uint8Array, width: number, height: number) {
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      copyPixel(data, width, x, y, out, width, x, height - 1 - y);
    }
  }
  return { data: out, width, height };
}

function copyPixel(
  source: Uint8Array,
  sourceWidth: number,
  sx: number,
  sy: number,
  target: Uint8Array,
  targetWidth: number,
  tx: number,
  ty: number
) {
  const from = (sy * sourceWidth + sx) * 4;
  const to = (ty * targetWidth + tx) * 4;
  target[to] = source[from];
  target[to + 1] = source[from + 1];
  target[to + 2] = source[from + 2];
  target[to + 3] = source[from + 3];
}

function fitMaxEdge(data: Uint8Array, width: number, height: number, maxEdge: number) {
  const edge = Math.max(width, height);
  if (edge <= maxEdge) {
    return { data, width, height, scale: 1 };
  }
  const scale = maxEdge / edge;
  const nextWidth = Math.max(1, Math.round(width * scale));
  const nextHeight = Math.max(1, Math.round(height * scale));
  const out = new Uint8Array(nextWidth * nextHeight * 4);
  for (let y = 0; y < nextHeight; y++) {
    const sy = Math.min(height - 1, Math.round(y / scale));
    for (let x = 0; x < nextWidth; x++) {
      const sx = Math.min(width - 1, Math.round(x / scale));
      copyPixel(data, width, sx, sy, out, nextWidth, x, y);
    }
  }
  return { data: out, width: nextWidth, height: nextHeight, scale };
}
