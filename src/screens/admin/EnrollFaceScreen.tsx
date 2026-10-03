import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert } from 'react-native';

import { FaceCameraCapture } from '../../components/FaceCameraCapture';
import { saveFaceEnrollment } from '../../db/database';
import { extractDescriptorFromPhoto } from '../../services/faceService';
import { persistPhoto } from '../../services/photoStorage';
import type { AdminStackParamList } from '../../types';

type Props = NativeStackScreenProps<AdminStackParamList, 'EnrollFace'>;

export function EnrollFaceScreen({ route, navigation }: Props) {
  const { staffId } = route.params;
  const [processing, setProcessing] = useState(false);

  const onCapture = async (uri: string) => {
    setProcessing(true);
    try {
      const descriptor = await extractDescriptorFromPhoto(uri);
      const savedUri = await persistPhoto(uri, `enroll_${staffId}`);
      await saveFaceEnrollment(staffId, savedUri, descriptor);
      Alert.alert('Success', 'Face enrolled successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert(
        'Enrollment failed',
        error instanceof Error ? error.message : 'Could not enroll face.'
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <FaceCameraCapture
      title="Enroll face"
      subtitle="Take a clear front-facing selfie, or upload a recent photo. Only one face should be visible."
      onCapture={onCapture}
      onCancel={() => navigation.goBack()}
      isProcessing={processing}
      allowUpload
      captureLabel="Capture selfie"
      permissionMessage="Camera access is required to enroll a staff face."
    />
  );
}
