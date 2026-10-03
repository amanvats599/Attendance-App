import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert } from 'react-native';

import { FaceCameraCapture } from '../../components/FaceCameraCapture';
import { useAuth } from '../../context/AuthContext';
import { getStaffById, insertAttendance } from '../../db/database';
import { verifyFaceAgainstEnrollment } from '../../services/faceService';
import { getCheckInLocation } from '../../services/locationService';
import { persistPhoto } from '../../services/photoStorage';
import type { StaffStackParamList } from '../../types';

type Props = NativeStackScreenProps<StaffStackParamList, 'MarkAttendance'>;

export function MarkAttendanceScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);

  const onCapture = async (uri: string) => {
    if (!user?.staffId) {
      return;
    }
    setProcessing(true);
    try {
      const staff = await getStaffById(user.staffId);
      if (!staff?.faceDescriptor) {
        Alert.alert('Not enrolled', 'Your face is not enrolled yet.');
        return;
      }

      const { match, distance } = await verifyFaceAgainstEnrollment(uri, staff.faceDescriptor);
      if (!match) {
        Alert.alert(
          'Face not recognized',
          'This photo does not match the enrolled face. Check in with the enrolled staff member, looking straight at the camera.'
        );
        return;
      }

      const location = await getCheckInLocation();
      const savedUri = await persistPhoto(uri, `attendance_${staff.id}`);
      await insertAttendance(
        staff.id,
        savedUri,
        location.latitude,
        location.longitude,
        distance
      );

      Alert.alert('Attendance recorded', 'Your check-in was saved with selfie, time, and location.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert(
        'Check-in failed',
        error instanceof Error ? error.message : 'Could not mark attendance.'
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <FaceCameraCapture
      title="Mark attendance"
      subtitle="We will verify your face against the enrolled profile, then capture location."
      onCapture={onCapture}
      onCancel={() => navigation.goBack()}
      isProcessing={processing}
    />
  );
}
