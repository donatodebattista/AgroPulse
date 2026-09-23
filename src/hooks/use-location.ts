import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { LatLng, isPointInsidePolygon, geoJsonToCoordinates } from '@/utils/geo';
import { PlotWithStatus } from '@/types/database.types';

export interface UseLocationResult {
  userLocation: LatLng | null;
  isLoadingLocation: boolean;
  locationError: string | null;
  permissionGranted: boolean;
  currentPlot: PlotWithStatus | null;
  refreshLocation: () => Promise<void>;
  simulateLocation: (coords: LatLng) => void;
}

export function useLocation(plots: PlotWithStatus[] = []): UseLocationResult {
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  const requestAndFetchLocation = useCallback(async () => {
    setIsLoadingLocation(true);
    setLocationError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setPermissionGranted(false);
        setLocationError('Ubicación no disponible');
        setIsLoadingLocation(false);
        return;
      }

      setPermissionGranted(true);

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (err: any) {
      console.warn('[useLocation] Error al obtener ubicación:', err?.message);
      setLocationError('Ubicación no disponible');
    } finally {
      setIsLoadingLocation(false);
    }
  }, []);

  useEffect(() => {
    requestAndFetchLocation();
  }, [requestAndFetchLocation]);

  // RF-06: Identificar si el usuario se encuentra dentro de alguno de los lotes
  const currentPlot = userLocation
    ? plots.find((plot) => {
        const polygonCoords = geoJsonToCoordinates(plot.geojson);
        return isPointInsidePolygon(userLocation, polygonCoords);
      }) ?? null
    : null;

  // Función útil para pruebas y demostraciones en emulador o aula: simular estar en un lote
  const simulateLocation = (coords: LatLng) => {
    setUserLocation(coords);
    setLocationError(null);
  };

  return {
    userLocation,
    isLoadingLocation,
    locationError,
    permissionGranted,
    currentPlot,
    refreshLocation: requestAndFetchLocation,
    simulateLocation,
  };
}
