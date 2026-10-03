import * as Location from 'expo-location';

export async function getCheckInLocation(): Promise<{
  latitude: number;
  longitude: number;
}> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is required to mark attendance.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

export async function formatPlace(
  latitude: number | null,
  longitude: number | null
): Promise<string> {
  if (latitude == null || longitude == null) {
    return 'Location unavailable';
  }

  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (!current.granted) {
      const requested = await Location.requestForegroundPermissionsAsync();
      if (!requested.granted) {
        return 'Location unavailable';
      }
    }

    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!place) {
      return 'Location unavailable';
    }
    if (place.formattedAddress) {
      return place.formattedAddress;
    }

    const parts = [
      place.name,
      place.street,
      place.district,
      place.city,
      place.region,
      place.postalCode,
    ].filter((part): part is string => Boolean(part));
    return [...new Set(parts)].join(', ') || 'Location unavailable';
  } catch {
    return 'Location unavailable';
  }
}
