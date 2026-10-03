#!/usr/bin/env bash
# Install dev build on a physical Android phone over USB and wire Metro through adb reverse.

set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

EMULATOR_COUNT="$(adb devices | awk '$2=="device" && $1 ~ /^emulator-/{c++} END{print c+0}')"
PHONE_SERIAL="$(adb devices | awk '$2=="device" && $1 !~ /^emulator-/{print $1; exit}')"

if [ -z "$PHONE_SERIAL" ]; then
  if [ "$EMULATOR_COUNT" -gt 0 ]; then
    echo "Only an emulator is connected (adb sees emulator-5554), not your phone."
    echo "Close the Android emulator, keep the S24 plugged in, then run: adb devices"
    echo ""
  fi
  echo "No physical phone detected over USB."
  echo ""
  echo "On your phone:"
  echo "  1. Settings → About phone → tap Build number 7 times (Developer options)"
  echo "  2. Settings → Developer options → enable USB debugging"
  echo "  3. Connect USB cable; unlock phone; tap Allow on the debugging prompt"
  echo ""
  echo "Then run: adb devices"
  echo "You should see your device serial (not emulator-5554)."
  exit 1
fi

export ANDROID_SERIAL="$PHONE_SERIAL"
echo "Using phone: $PHONE_SERIAL"

echo "Forwarding Metro (8081) to the phone over USB…"
adb -s "$PHONE_SERIAL" reverse tcp:8081 tcp:8081

echo "Building and installing the app (first time may take a few minutes)…"
npm run android

echo ""
echo "If the app opens but shows a connection error, start Metro in another terminal:"
echo "  cd \"$ROOT\" && npx expo start --dev-client"
