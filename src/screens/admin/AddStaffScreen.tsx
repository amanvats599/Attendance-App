import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenContainer } from '../../components/ScreenContainer';
import { addStaff } from '../../db/database';
import { colors } from '../../theme/colors';
import type { AdminStackParamList } from '../../types';

type Props = NativeStackScreenProps<AdminStackParamList, 'AddStaff'>;

export function AddStaffScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);

  const onSave = async () => {
    if (!name.trim() || !employeeId.trim()) {
      Alert.alert('Missing fields', 'Enter both name and employee ID.');
      return;
    }
    setLoading(true);
    try {
      const { staff, account } = await addStaff(name, employeeId);
      Alert.alert(
        'Staff login created',
        `Username: ${account.username}\nPassword: ${account.password}`,
        [{ text: 'OK', onPress: () => navigation.replace('StaffProfile', { staffId: staff.id }) }]
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add staff.';
      Alert.alert('Error', message.includes('UNIQUE') ? 'Employee ID already exists.' : message);
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>Add staff</Text>
      <Text style={styles.subtitle}>Create an employee profile before face enrollment.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Full name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Jane Doe" />

        <Text style={styles.label}>Employee ID</Text>
        <TextInput
          value={employeeId}
          onChangeText={setEmployeeId}
          style={styles.input}
          autoCapitalize="characters"
          placeholder="EMP002"
        />

        <PrimaryButton title="Save" onPress={onSave} loading={loading} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.textMuted, marginBottom: 16, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  label: { fontWeight: '600', color: colors.text, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FAFBFC',
  },
});
