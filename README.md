# Attendance App

Android attendance app with two roles. An admin adds staff and enrolls a face. A staff member checks in with a selfie. The selfie is compared with the enrolled face, then the app saves the time, photo, and location on the device.

Data stays in a local SQLite database. There is no server.

## Login

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | `admin`  | `Test123` |

The app starts with no staff. After an admin adds someone, that person gets:

- Username: first name plus the last 3 characters of the employee ID, such as `mukesh004`
- Password: `Test123`

A staff member can check in only after a face is enrolled.

## Face check-in

Google ML Kit (`@react-native-ml-kit/face-detection`) finds one face and the eye positions. `src/services/faceMatch.ts` aligns that face, equalizes brightness, and builds a uniform local binary pattern descriptor. Check-in compares the live photo with the stored descriptor using cosine distance. A distance of `0.18` or less is a match. The comparison also tries a mirrored face.

This is an on-device appearance match, not a cloud face-recognition service. A large change in angle or lighting can fail a real match, and the admin can enroll the face again.

## Layout

- `src/screens/admin` — staff list, add staff, profile, face enrollment
- `src/screens/staff` — home and check-in
- `src/services/faceService.ts` — detect one face and verify it against enrollment
- `src/services/faceMatch.ts` — descriptor and match threshold
- `src/db/database.ts` — users, staff, and attendance records
- `src/services/locationService.ts` — GPS required to finish check-in
- `src/services/photoStorage.ts` — saved enrollment and check-in photos

Each attendance row stores the time, selfie path, latitude, longitude, and match distance.

## Run

ML Kit needs a native build. Expo Go cannot run face detection.

```bash
npm install
npx expo run:android
```

`npx expo run:android` generates the Android project, installs the app, and starts Metro. Use a phone with USB debugging enabled, or an emulator.
