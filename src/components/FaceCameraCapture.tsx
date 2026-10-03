import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { PrimaryButton } from './PrimaryButton';

interface FaceCameraCaptureProps {
  title: string;
  subtitle: string;
  onCapture: (uri: string) => void;
  onCancel: () => void;
  isProcessing?: boolean;
  allowUpload?: boolean;
  captureLabel?: string;
  permissionMessage?: string;
}

export function FaceCameraCapture({
  title,
  subtitle,
  onCapture,
  onCancel,
  isProcessing,
  allowUpload = false,
  captureLabel = 'Capture selfie',
  permissionMessage = 'Camera access is required for face attendance.',
}: FaceCameraCaptureProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>();
  const busy = isCapturing || Boolean(isProcessing);

  const choosePictureSize = async () => {
    try {
      const sizes = await cameraRef.current?.getAvailablePictureSizesAsync();
      if (!sizes?.length) {
        return;
      }
      const ranked = sizes
        .map((size) => {
          const [width, height] = size.split('x').map((value) => Number(value));
          return { size, edge: Math.max(width || 0, height || 0) };
        })
        .filter((item) => item.edge >= 640)
        .sort((a, b) => Math.abs(a.edge - 1600) - Math.abs(b.edge - 1600));
      const chosen = ranked[0]?.size;
      if (chosen) {
        setPictureSize((current) => (current === chosen ? current : chosen));
      }
    } catch {
      // The camera default size still works if the device does not list sizes.
    }
  };

  const capture = async () => {
    if (!cameraRef.current || busy) {
      return;
    }
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (photo?.uri) {
        onCapture(photo.uri);
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const pickFromLibrary = async () => {
    if (busy) {
      return;
    }
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo library access to upload a staff face photo.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
      ...(Platform.OS === 'ios'
        ? {
            preferredAssetRepresentationMode:
              ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
          }
        : {}),
    });

    if (!result.canceled && result.assets[0]?.uri) {
      onCapture(result.assets[0].uri);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{permissionMessage}</Text>
        <PrimaryButton title="Grant camera permission" onPress={requestPermission} />
        {allowUpload ? (
          <PrimaryButton
            title="Upload photo"
            variant="secondary"
            onPress={() => {
              void pickFromLibrary();
            }}
            style={styles.gap}
          />
        ) : null}
        <PrimaryButton title="Cancel" variant="secondary" onPress={onCancel} style={styles.gap} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          pictureSize={pictureSize}
          onCameraReady={() => {
            void choosePictureSize();
          }}
        />
        <View style={styles.overlayFrame} pointerEvents="none" />
      </View>
      <PrimaryButton
        title={isProcessing ? 'Processing…' : captureLabel}
        onPress={() => {
          void capture();
        }}
        loading={busy}
      />
      {allowUpload ? (
        <PrimaryButton
          title="Upload photo"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            void pickFromLibrary();
          }}
          style={styles.gap}
        />
      ) : null}
      <PrimaryButton title="Cancel" variant="secondary" onPress={onCancel} disabled={busy} style={styles.gap} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.background,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 16,
  },
  cameraWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlayFrame: {
    position: 'absolute',
    top: '18%',
    left: '12%',
    right: '12%',
    bottom: '18%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 999,
  },
  message: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  gap: {
    marginTop: 10,
  },
});
