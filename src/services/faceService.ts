import FaceDetection, { type Face } from '@react-native-ml-kit/face-detection';
import { Platform } from 'react-native';

import { decodeOrientedImage } from './faceImage';
import {
  bestMatchDistance,
  embedFace,
  FACE_MATCH_THRESHOLD,
  isCurrentFaceDescriptor,
  isFaceMatch,
} from './faceMatch';

export { FACE_MATCH_THRESHOLD, isCurrentFaceDescriptor, isFaceMatch };

const DETECT_OPTIONS = {
  performanceMode: 'accurate' as const,
  landmarkMode: 'all' as const,
  contourMode: 'none' as const,
  classificationMode: 'none' as const,
  minFaceSize: 0.15,
};

function normalizeImageUri(uri: string): string {
  if (Platform.OS === 'android' && !uri.startsWith('file://')) {
    return `file://${uri}`;
  }
  return uri;
}

export async function detectSingleFace(imageUri: string): Promise<Face> {
  const faces = await FaceDetection.detect(normalizeImageUri(imageUri), DETECT_OPTIONS);
  if (faces.length === 0) {
    throw new Error('No face detected. Center the face in the frame.');
  }
  if (faces.length > 1) {
    throw new Error('Multiple faces detected. Only one person should be in the frame.');
  }
  return faces[0];
}

export async function extractDescriptorFromPhoto(imageUri: string): Promise<number[]> {
  const embedding = await embedPhoto(imageUri);
  return embedding.descriptor;
}

export async function verifyFaceAgainstEnrollment(
  imageUri: string,
  enrolledDescriptor: number[]
): Promise<{ match: boolean; distance: number }> {
  if (!isCurrentFaceDescriptor(enrolledDescriptor)) {
    throw new Error('This face enrollment is out of date. Ask an admin to enroll the face again.');
  }
  const live = await embedPhoto(imageUri);
  const distance = bestMatchDistance(enrolledDescriptor, live.descriptor, live.flippedDescriptor);
  return { match: isFaceMatch(distance), distance };
}

async function embedPhoto(imageUri: string) {
  const uri = normalizeImageUri(imageUri);
  const face = await detectSingleFace(uri);
  if (Math.abs(face.rotationY) > 25) {
    throw new Error('Look straight at the camera, then try again.');
  }

  const leftEye = face.landmarks?.leftEye?.position;
  const rightEye = face.landmarks?.rightEye?.position;
  if (!leftEye || !rightEye) {
    throw new Error('Both eyes must be visible. Try again in better lighting.');
  }

  const image = await decodeOrientedImage(uri, leftEye, rightEye);
  return embedFace(image.rgba, image.width, image.height, image.leftEye, image.rightEye);
}
