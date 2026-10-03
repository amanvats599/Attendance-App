import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { getAllStaff } from '../../db/database';
import { isCurrentFaceDescriptor } from '../../services/faceService';
import { colors } from '../../theme/colors';
import type { AdminStackParamList, Staff } from '../../types';

type Props = NativeStackScreenProps<AdminStackParamList, 'StaffList'>;

export function StaffListScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStaff(await getAllStaff());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Staff</Text>
          <Text style={styles.subtitle}>Manage employees and face enrollment</Text>
        </View>
        <Pressable onPress={logout} accessibilityRole="button">
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={staff.length === 0 ? styles.emptyList : undefined}
          ListEmptyComponent={
            <Text style={styles.empty}>No staff yet. Add your first employee.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('StaffProfile', { staffId: item.id })}
            >
              <View style={styles.rowText}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.employeeId}</Text>
              </View>
              <Text style={isCurrentFaceDescriptor(item.faceDescriptor) ? styles.enrolled : styles.pending}>
                {isCurrentFaceDescriptor(item.faceDescriptor)
                  ? 'Face enrolled'
                  : item.faceEnrolledAt
                    ? 'Re-enroll face'
                    : 'Not enrolled'}
              </Text>
            </Pressable>
          )}
        />
      )}

      <PrimaryButton
        title="Add staff member"
        onPress={() => navigation.navigate('AddStaff')}
        style={styles.addButton}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: 4 },
  logout: { color: colors.primary, fontWeight: '600', paddingTop: 8 },
  loader: { marginTop: 40 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { color: colors.textMuted, marginTop: 2 },
  enrolled: { color: colors.success, fontSize: 12, fontWeight: '600' },
  pending: { color: colors.warning, fontSize: 12, fontWeight: '600' },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  empty: { textAlign: 'center', color: colors.textMuted },
  addButton: { marginTop: 8 },
});
