import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { getLatestAttendanceForStaff, getStaffById } from '../../db/database';
import { isCurrentFaceDescriptor } from '../../services/faceService';
import { formatPlace } from '../../services/locationService';
import { colors } from '../../theme/colors';
import type { AttendanceRecord, Staff, StaffStackParamList } from '../../types';
import { formatDateTime } from '../../utils/format';

type Props = NativeStackScreenProps<StaffStackParamList, 'StaffHome'>;

export function StaffHomeScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [latest, setLatest] = useState<AttendanceRecord | null>(null);
  const [place, setPlace] = useState('Location unavailable');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.staffId) {
      return;
    }
    setLoading(true);
    try {
      const [staffRow, latestRecord] = await Promise.all([
        getStaffById(user.staffId),
        getLatestAttendanceForStaff(user.staffId),
      ]);
      setStaff(staffRow);
      setLatest(latestRecord);
      setPlace(
        latestRecord
          ? await formatPlace(latestRecord.latitude, latestRecord.longitude)
          : 'Location unavailable'
      );
    } finally {
      setLoading(false);
    }
  }, [user?.staffId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const canCheckIn = isCurrentFaceDescriptor(staff?.faceDescriptor);
  const needsReenroll = staff?.faceEnrolledAt != null && !canCheckIn;

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Hello{staff ? `, ${staff.name}` : ''}</Text>
          <Text style={styles.subtitle}>Mark attendance with a face-verified selfie</Text>
        </View>
        <Text style={styles.logout} onPress={logout}>
          Log out
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Enrollment status</Text>
            <Text style={canCheckIn ? styles.ok : styles.warn}>
              {canCheckIn
                ? 'Ready to check in'
                : needsReenroll
                  ? 'Ask admin to enroll your face again'
                  : 'Ask admin to enroll your face first'}
            </Text>
          </View>

          {latest && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Last check-in</Text>
              <Text style={styles.cardValue}>{formatDateTime(latest.timestamp)}</Text>
              <Text style={styles.cardMeta}>{place}</Text>
            </View>
          )}

          <PrimaryButton
            title="Mark attendance"
            disabled={!canCheckIn}
            onPress={() => navigation.navigate('MarkAttendance')}
            style={styles.cta}
          />
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: 4 },
  logout: { color: colors.primary, fontWeight: '600', paddingTop: 6 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardLabel: { fontWeight: '700', color: colors.text },
  cardValue: { marginTop: 6, color: colors.text },
  cardMeta: { marginTop: 4, color: colors.textMuted, fontSize: 13 },
  ok: { marginTop: 6, color: colors.success, fontWeight: '600' },
  warn: { marginTop: 6, color: colors.warning, fontWeight: '600' },
  cta: { marginTop: 8 },
});
