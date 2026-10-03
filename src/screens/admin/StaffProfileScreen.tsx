import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenContainer } from '../../components/ScreenContainer';
import { getAttendanceForStaff, getStaffById } from '../../db/database';
import { isCurrentFaceDescriptor } from '../../services/faceService';
import { formatPlace } from '../../services/locationService';
import { colors } from '../../theme/colors';
import type { AdminStackParamList, AttendanceRecord, Staff } from '../../types';
import { formatDateTime } from '../../utils/format';

type Props = NativeStackScreenProps<AdminStackParamList, 'StaffProfile'>;

export function StaffProfileScreen({ route, navigation }: Props) {
  const { staffId } = route.params;
  const [staff, setStaff] = useState<Staff | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [places, setPlaces] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRow, records] = await Promise.all([
        getStaffById(staffId),
        getAttendanceForStaff(staffId),
      ]);
      setStaff(staffRow);
      setAttendance(records);
      const labels: Record<number, string> = {};
      for (const record of records) {
        labels[record.id] = await formatPlace(record.latitude, record.longitude);
      }
      setPlaces(labels);
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !staff) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>{staff.name}</Text>
      <Text style={styles.subtitle}>Employee ID: {staff.employeeId}</Text>

      <View style={styles.card}>
        <Text style={styles.rowLabel}>Face enrollment</Text>
        <Text style={styles.rowValue}>
          {isCurrentFaceDescriptor(staff.faceDescriptor)
            ? formatDateTime(staff.faceEnrolledAt ?? '')
            : staff.faceEnrolledAt
              ? 'Out of date. Enroll this face again before check-in.'
              : 'Not enrolled yet'}
        </Text>
      </View>

      <PrimaryButton
        title={staff.faceEnrolledAt ? 'Re-enroll face' : 'Enroll face'}
        onPress={() => navigation.navigate('EnrollFace', { staffId: staff.id })}
        style={styles.buttonGap}
      />

      <Text style={styles.sectionTitle}>Recent attendance</Text>
      {attendance.length === 0 ? (
        <Text style={styles.empty}>No attendance records yet.</Text>
      ) : (
        attendance.map((record) => (
          <View key={record.id} style={styles.record}>
            <Text style={styles.recordTime}>{formatDateTime(record.timestamp)}</Text>
            <Text style={styles.recordMeta}>{places[record.id] ?? 'Location unavailable'}</Text>
          </View>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.textMuted, marginBottom: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLabel: { fontWeight: '600', color: colors.text },
  rowValue: { color: colors.textMuted, marginTop: 4 },
  buttonGap: { marginTop: 14 },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  empty: { color: colors.textMuted },
  record: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recordTime: { fontWeight: '600', color: colors.text },
  recordMeta: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
});
