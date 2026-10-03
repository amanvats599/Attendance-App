import * as SQLite from 'expo-sqlite';

import type { AttendanceRecord, Staff, User } from '../types';

const DB_NAME = 'attendance.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let openingDatabase: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  if (!openingDatabase) {
    openingDatabase = openDatabase().finally(() => {
      openingDatabase = null;
    });
  }
  return openingDatabase;
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME, { useNewConnection: true });
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'staff')),
      staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      face_enrolled_at TEXT,
      enrollment_photo_uri TEXT,
      face_descriptor TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      selfie_uri TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      match_score REAL
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await seedDatabase(db);
  await clearExistingStaff(db);
  await db.runAsync(`UPDATE users SET password = ? WHERE username = 'admin'`, 'Test123');
  dbInstance = db;
  return db;
}

async function seedDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  const userCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM users'
  );
  if ((userCount?.count ?? 0) > 0) {
    return;
  }

  await db.runAsync(
    `INSERT INTO users (username, password, role, staff_id) VALUES (?, ?, ?, ?)`,
    'admin',
    'Test123',
    'admin',
    null
  );
}

async function clearExistingStaff(db: SQLite.SQLiteDatabase): Promise<void> {
  const cleared = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = 'staff_cleared'`
  );
  if (cleared) {
    return;
  }

  await db.runAsync(`DELETE FROM users WHERE role = 'staff'`);
  await db.runAsync(`DELETE FROM staff`);
  await db.runAsync(
    `INSERT OR IGNORE INTO app_meta (key, value) VALUES ('staff_cleared', '1')`
  );
}

function parseStaff(row: Record<string, unknown>): Staff {
  const descriptorRaw = row.face_descriptor as string | null;
  return {
    id: row.id as number,
    employeeId: row.employee_id as string,
    name: row.name as string,
    createdAt: row.created_at as string,
    faceEnrolledAt: (row.face_enrolled_at as string | null) ?? null,
    enrollmentPhotoUri: (row.enrollment_photo_uri as string | null) ?? null,
    faceDescriptor: descriptorRaw ? (JSON.parse(descriptorRaw) as number[]) : null,
  };
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<User | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT id, username, password, role, staff_id FROM users WHERE username = ? AND password = ?`,
    username.trim(),
    password
  );
  if (!row) {
    return null;
  }
  return {
    id: row.id as number,
    username: row.username as string,
    password: row.password as string,
    role: row.role as User['role'],
    staffId: (row.staff_id as number | null) ?? null,
  };
}

export async function getAllStaff(): Promise<Staff[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM staff ORDER BY name COLLATE NOCASE ASC'
  );
  return rows.map(parseStaff);
}

export async function getStaffById(id: number): Promise<Staff | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM staff WHERE id = ?',
    id
  );
  return row ? parseStaff(row) : null;
}

const STAFF_DEFAULT_PASSWORD = 'Test123';

export interface StaffAccount {
  username: string;
  password: string;
}

export async function addStaff(
  name: string,
  employeeId: string
): Promise<{ staff: Staff; account: StaffAccount }> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const trimmedName = name.trim();
  const trimmedEmployeeId = employeeId.trim();
  let staffId = 0;

  const result = await db.runAsync(
    `INSERT INTO staff (employee_id, name, created_at) VALUES (?, ?, ?)`,
    trimmedEmployeeId,
    trimmedName,
    now
  );
  staffId = result.lastInsertRowId;
  try {
    const username = await uniqueStaffUsername(db, trimmedName, trimmedEmployeeId, staffId);
    await db.runAsync(
      `INSERT INTO users (username, password, role, staff_id) VALUES (?, ?, 'staff', ?)`,
      username,
      STAFF_DEFAULT_PASSWORD,
      staffId
    );
  } catch (error) {
    await db.runAsync(`DELETE FROM staff WHERE id = ?`, staffId);
    throw error;
  }

  const staff = await getStaffById(staffId);
  const account = await getStaffAccount(staffId);
  if (!staff || !account) {
    throw new Error('Failed to create staff member');
  }
  return { staff, account };
}

export async function getStaffAccount(staffId: number): Promise<StaffAccount | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ username: string; password: string }>(
    `SELECT username, password FROM users WHERE staff_id = ? AND role = 'staff'`,
    staffId
  );
  return row ?? null;
}

function staffUsernameBase(name: string, employeeId: string): string {
  const firstName = slugLoginPart(name.trim().split(/\s+/)[0] ?? '');
  const idPart = slugLoginPart(employeeId).slice(-3);
  if (firstName && idPart) {
    return `${firstName}${idPart}`;
  }
  return firstName || idPart || 'staff';
}

function slugLoginPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

async function uniqueStaffUsername(
  db: SQLite.SQLiteDatabase,
  name: string,
  employeeId: string,
  staffId: number
): Promise<string> {
  const base = staffUsernameBase(name, employeeId);
  const taken = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM users WHERE username = ?',
    base
  );
  if (!taken) {
    return base;
  }
  return `${base}.${staffId}`;
}

export async function saveFaceEnrollment(
  staffId: number,
  photoUri: string,
  descriptor: number[]
): Promise<void> {
  const enrolledAt = new Date().toISOString();
  const descriptorJson = JSON.stringify(descriptor);
  await runDatabaseWrite(async (db) => {
    await db.runAsync(
      `UPDATE staff SET face_enrolled_at = ?, enrollment_photo_uri = ?, face_descriptor = ? WHERE id = ?`,
      enrolledAt,
      photoUri,
      descriptorJson,
      staffId
    );
  });
}

async function runDatabaseWrite(
  work: (db: SQLite.SQLiteDatabase) => Promise<void>
): Promise<void> {
  try {
    await work(await getDatabase());
  } catch (error) {
    if (!isBrokenDatabaseConnection(error)) {
      throw error;
    }
    await resetDatabase();
    await work(await getDatabase());
  }
}

function isBrokenDatabaseConnection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('NullPointerException') || message.includes('prepareAsync');
}

async function resetDatabase(): Promise<void> {
  const current = dbInstance;
  dbInstance = null;
  if (!current) {
    return;
  }
  try {
    await current.closeAsync();
  } catch {
    // The Android connection is already unusable.
  }
}

export async function insertAttendance(
  staffId: number,
  selfieUri: string,
  latitude: number | null,
  longitude: number | null,
  matchScore: number
): Promise<AttendanceRecord> {
  const db = await getDatabase();
  const timestamp = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO attendance (staff_id, timestamp, selfie_uri, latitude, longitude, match_score)
     VALUES (?, ?, ?, ?, ?, ?)`,
    staffId,
    timestamp,
    selfieUri,
    latitude,
    longitude,
    matchScore
  );
  return {
    id: result.lastInsertRowId,
    staffId,
    timestamp,
    selfieUri,
    latitude,
    longitude,
    matchScore,
  };
}

export async function getAttendanceForStaff(staffId: number): Promise<AttendanceRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM attendance WHERE staff_id = ? ORDER BY timestamp DESC LIMIT 20`,
    staffId
  );
  return rows.map((row) => ({
    id: row.id as number,
    staffId: row.staff_id as number,
    timestamp: row.timestamp as string,
    selfieUri: row.selfie_uri as string,
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
    matchScore: (row.match_score as number | null) ?? null,
  }));
}

export async function getLatestAttendanceForStaff(
  staffId: number
): Promise<AttendanceRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM attendance WHERE staff_id = ? ORDER BY timestamp DESC LIMIT 1`,
    staffId
  );
  if (!row) {
    return null;
  }
  return {
    id: row.id as number,
    staffId: row.staff_id as number,
    timestamp: row.timestamp as string,
    selfieUri: row.selfie_uri as string,
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
    matchScore: (row.match_score as number | null) ?? null,
  };
}
