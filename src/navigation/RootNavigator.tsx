import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { AddStaffScreen } from '../screens/admin/AddStaffScreen';
import { EnrollFaceScreen } from '../screens/admin/EnrollFaceScreen';
import { StaffListScreen } from '../screens/admin/StaffListScreen';
import { StaffProfileScreen } from '../screens/admin/StaffProfileScreen';
import { MarkAttendanceScreen } from '../screens/staff/MarkAttendanceScreen';
import { StaffHomeScreen } from '../screens/staff/StaffHomeScreen';
import { colors } from '../theme/colors';
import type { AdminStackParamList, StaffStackParamList } from '../types';

const AdminStack = createNativeStackNavigator<AdminStackParamList>();
const StaffStack = createNativeStackNavigator<StaffStackParamList>();

function AdminNavigator() {
  return (
    <AdminStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <AdminStack.Screen
        name="StaffList"
        component={StaffListScreen}
        options={{ title: 'Admin' }}
      />
      <AdminStack.Screen name="AddStaff" component={AddStaffScreen} options={{ title: 'Add staff' }} />
      <AdminStack.Screen
        name="StaffProfile"
        component={StaffProfileScreen}
        options={{ title: 'Staff profile' }}
      />
      <AdminStack.Screen
        name="EnrollFace"
        component={EnrollFaceScreen}
        options={{ title: 'Enroll face', headerShown: false }}
      />
    </AdminStack.Navigator>
  );
}

function StaffNavigator() {
  return (
    <StaffStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <StaffStack.Screen
        name="StaffHome"
        component={StaffHomeScreen}
        options={{ title: 'Staff' }}
      />
      <StaffStack.Screen
        name="MarkAttendance"
        component={MarkAttendanceScreen}
        options={{ title: 'Check in', headerShown: false }}
      />
    </StaffStack.Navigator>
  );
}

export function RootNavigator() {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <LoginScreen />
      ) : user.role === 'admin' ? (
        <AdminNavigator />
      ) : (
        <StaffNavigator />
      )}
    </NavigationContainer>
  );
}
