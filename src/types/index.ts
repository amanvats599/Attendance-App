export type UserRole = 'admin' | 'staff';

export interface User {
  id: number;
  username: string;
  password: string;
  role: UserRole;
  staffId: number | null;
}

export interface Staff {
  id: number;
  employeeId: string;
  name: string;
  createdAt: string;
  faceEnrolledAt: string | null;
  enrollmentPhotoUri: string | null;
  faceDescriptor: number[] | null;
}

export interface AttendanceRecord {
  id: number;
  staffId: number;
  timestamp: string;
  selfieUri: string;
  latitude: number | null;
  longitude: number | null;
  matchScore: number | null;
}

export type RootStackParamList = {
  Login: undefined;
  AdminTabs: undefined;
  StaffHome: undefined;
};

export type AdminStackParamList = {
  StaffList: undefined;
  AddStaff: undefined;
  StaffProfile: { staffId: number };
  EnrollFace: { staffId: number };
};

export type StaffStackParamList = {
  StaffHome: undefined;
  MarkAttendance: undefined;
};
