#!/usr/bin/env bash
# Start a visible Android emulator (run this in macOS Terminal, not Expo Go).

set -euo pipefail

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

AVD="${1:-Medium_Phone_API_36}"

echo "Available AVDs:"
emulator -list-avds
echo ""
echo "Starting: $AVD (window should appear on your Mac)"
echo "First cold boot can take 2–3 minutes."

exec emulator -avd "$AVD" -gpu host -no-snapshot-load
