/**
 * Identity match from an aligned face image.
 * Landmark positions are not used: every frontal face has eyes, nose, and
 * mouth in nearly the same places, so that distance accepts other people.
 */

const FACE_SIZE = 64;
const GRID = 8;
const CELL = FACE_SIZE / GRID;
const UNIFORM_BIN = 58;
const BINS_PER_CELL = UNIFORM_BIN + 1;

export const FACE_DESCRIPTOR_LENGTH = GRID * GRID * BINS_PER_CELL;

/**
 * Lower is more similar.
 * Frontal photos of the same person land near 0. Same-day lighting changes stay small.
 * A different person, also facing the camera, lands around 0.23 or higher.
 */
export const FACE_MATCH_THRESHOLD = 0.18;

const LEFT_EYE_X = 20;
const RIGHT_EYE_X = 44;
const EYE_Y = 24;

const UNIFORM_MAP = buildUniformMap();

export interface Point {
  x: number;
  y: number;
}

export function isCurrentFaceDescriptor(descriptor: number[] | null | undefined): boolean {
  return descriptor?.length === FACE_DESCRIPTOR_LENGTH;
}

export function isFaceMatch(distance: number): boolean {
  return distance <= FACE_MATCH_THRESHOLD;
}

export function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 1;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 1;
  }
  const cosine = dot / Math.sqrt(normA * normB);
  return 1 - Math.min(1, Math.max(-1, cosine));
}

export function bestMatchDistance(enrolled: number[], live: number[], liveFlipped: number[]): number {
  return Math.min(cosineDistance(enrolled, live), cosineDistance(enrolled, liveFlipped));
}

export function embedFace(
  rgba: Uint8Array,
  width: number,
  height: number,
  leftEye: Point,
  rightEye: Point
): { descriptor: number[]; flippedDescriptor: number[] } {
  const imageLeft = leftEye.x <= rightEye.x ? leftEye : rightEye;
  const imageRight = leftEye.x <= rightEye.x ? rightEye : leftEye;
  const eyeDistance = Math.hypot(imageRight.x - imageLeft.x, imageRight.y - imageLeft.y);
  if (eyeDistance < 24) {
    throw new Error('Move closer so the face fills more of the frame.');
  }

  const gray = warpFace(rgba, width, height, imageLeft, imageRight);
  const equalized = equalize(gray);
  return {
    descriptor: lbpDescriptor(equalized),
    flippedDescriptor: lbpDescriptor(equalize(flipHorizontal(gray))),
  };
}

function buildUniformMap(): Uint8Array {
  const map = new Uint8Array(256);
  const uniformIndex = new Int16Array(256).fill(-1);
  let next = 0;
  for (let code = 0; code < 256; code++) {
    if (circularTransitions(code) <= 2) {
      uniformIndex[code] = next;
      next += 1;
    }
  }
  if (next !== UNIFORM_BIN) {
    throw new Error(`Expected ${UNIFORM_BIN} uniform LBP codes, found ${next}.`);
  }
  for (let code = 0; code < 256; code++) {
    map[code] = uniformIndex[code] === -1 ? UNIFORM_BIN : uniformIndex[code];
  }
  return map;
}

function circularTransitions(code: number): number {
  let count = 0;
  let previous = code & 1;
  for (let i = 1; i <= 8; i++) {
    const bit = (code >> (i % 8)) & 1;
    if (bit !== previous) {
      count += 1;
    }
    previous = bit;
  }
  return count;
}

function warpFace(
  rgba: Uint8Array,
  width: number,
  height: number,
  leftEye: Point,
  rightEye: Point
): Float32Array {
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const sourceDistance = Math.hypot(dx, dy);
  const targetDistance = RIGHT_EYE_X - LEFT_EYE_X;
  const scale = sourceDistance / targetDistance;
  const angle = Math.atan2(dy, dx);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const gray = new Float32Array(FACE_SIZE * FACE_SIZE);
  let outside = 0;

  for (let y = 0; y < FACE_SIZE; y++) {
    for (let x = 0; x < FACE_SIZE; x++) {
      const vx = (x - LEFT_EYE_X) * scale;
      const vy = (y - EYE_Y) * scale;
      const sx = leftEye.x + vx * cos - vy * sin;
      const sy = leftEye.y + vx * sin + vy * cos;
      if (sx < 0 || sy < 0 || sx >= width - 1 || sy >= height - 1) {
        outside += 1;
        gray[y * FACE_SIZE + x] = 0;
        continue;
      }
      gray[y * FACE_SIZE + x] = sampleGray(rgba, width, sx, sy);
    }
  }

  if (outside > FACE_SIZE * FACE_SIZE * 0.12) {
    throw new Error('Center the face in the frame and try again.');
  }
  return gray;
}

function sampleGray(rgba: Uint8Array, width: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const dx = x - x0;
  const dy = y - y0;
  const g00 = grayAt(rgba, width, x0, y0);
  const g10 = grayAt(rgba, width, x1, y0);
  const g01 = grayAt(rgba, width, x0, y1);
  const g11 = grayAt(rgba, width, x1, y1);
  const top = g00 + (g10 - g00) * dx;
  const bottom = g01 + (g11 - g01) * dx;
  return top + (bottom - top) * dy;
}

function grayAt(rgba: Uint8Array, width: number, x: number, y: number): number {
  const index = (y * width + x) * 4;
  return rgba[index] * 0.299 + rgba[index + 1] * 0.587 + rgba[index + 2] * 0.114;
}

function equalize(gray: Float32Array): Float32Array {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    histogram[clampByte(gray[i])] += 1;
  }
  const cdf = new Uint32Array(256);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }
  let cdfMin = 0;
  for (let i = 0; i < 256; i++) {
    if (cdf[i] > 0) {
      cdfMin = cdf[i];
      break;
    }
  }
  const span = gray.length - cdfMin || 1;
  const out = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = ((cdf[clampByte(gray[i])] - cdfMin) / span) * 255;
  }
  return out;
}

function flipHorizontal(gray: Float32Array): Float32Array {
  const out = new Float32Array(gray.length);
  for (let y = 0; y < FACE_SIZE; y++) {
    for (let x = 0; x < FACE_SIZE; x++) {
      out[y * FACE_SIZE + x] = gray[y * FACE_SIZE + (FACE_SIZE - 1 - x)];
    }
  }
  return out;
}

function lbpDescriptor(gray: Float32Array): number[] {
  const descriptor = new Array<number>(FACE_DESCRIPTOR_LENGTH).fill(0);
  for (let y = 1; y < FACE_SIZE - 1; y++) {
    for (let x = 1; x < FACE_SIZE - 1; x++) {
      const cellX = Math.min(GRID - 1, Math.floor(x / CELL));
      const cellY = Math.min(GRID - 1, Math.floor(y / CELL));
      const bin = UNIFORM_MAP[lbpCode(gray, x, y)];
      const offset = (cellY * GRID + cellX) * BINS_PER_CELL + bin;
      descriptor[offset] += 1;
    }
  }

  for (let cell = 0; cell < GRID * GRID; cell++) {
    const start = cell * BINS_PER_CELL;
    let sum = 0;
    for (let bin = 0; bin < BINS_PER_CELL; bin++) {
      sum += descriptor[start + bin];
    }
    if (sum === 0) {
      continue;
    }
    for (let bin = 0; bin < BINS_PER_CELL; bin++) {
      descriptor[start + bin] /= sum;
    }
  }
  return descriptor;
}

function lbpCode(gray: Float32Array, x: number, y: number): number {
  const center = gray[y * FACE_SIZE + x];
  const neighbors = [
    gray[(y - 1) * FACE_SIZE + (x - 1)],
    gray[(y - 1) * FACE_SIZE + x],
    gray[(y - 1) * FACE_SIZE + (x + 1)],
    gray[y * FACE_SIZE + (x + 1)],
    gray[(y + 1) * FACE_SIZE + (x + 1)],
    gray[(y + 1) * FACE_SIZE + x],
    gray[(y + 1) * FACE_SIZE + (x - 1)],
    gray[y * FACE_SIZE + (x - 1)],
  ];
  let code = 0;
  for (let i = 0; i < neighbors.length; i++) {
    if (neighbors[i] >= center) {
      code |= 1 << i;
    }
  }
  return code;
}

function clampByte(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 255) {
    return 255;
  }
  return Math.round(value);
}
