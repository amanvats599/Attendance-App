#!/usr/bin/env bash
# Build, install, and open the app on a running emulator/device.

set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! adb devices | awk 'NR>1 && $2=="device"{found=1} END{exit !found}'; then
  echo "No Android device/emulator connected."
  echo "USB phone: ./scripts/run-on-usb-phone.sh"
  echo "Emulator:   ./scripts/start-emulator.sh"
  exit 1
fi

PHONE_SERIAL="$(adb devices | awk '$2=="device" && $1 !~ /^emulator-/{print $1; exit}')"
if [ -n "$PHONE_SERIAL" ]; then
  export ANDROID_SERIAL="$PHONE_SERIAL"
  adb -s "$PHONE_SERIAL" reverse tcp:8081 tcp:8081
fi

npm run android
