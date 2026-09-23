export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  center: LatLng;
}

/**
 * Convierte las coordenadas GeoJSON [lng, lat] a objetos { latitude, longitude } para React Native Maps
 */
export function geoJsonToCoordinates(geoJson: any): LatLng[] {
  if (!geoJson || !geoJson.coordinates || !Array.isArray(geoJson.coordinates)) {
    return [];
  }

  // GeoJSON Polygon coordinates tiene la estructura: [[[lng, lat], [lng, lat], ...]]
  const ring = geoJson.coordinates[0];
  if (!Array.isArray(ring)) {
    return [];
  }

  return ring.map((point: any) => ({
    latitude: point[1],
    longitude: point[0],
  }));
}

/**
 * Calcula el centroide aproximado de un polígono
 */
export function calculatePolygonCenter(coordinates: LatLng[]): LatLng {
  if (coordinates.length === 0) {
    return { latitude: -31.3925, longitude: -58.02 };
  }

  let totalLat = 0;
  let totalLng = 0;

  coordinates.forEach((c) => {
    totalLat += c.latitude;
    totalLng += c.longitude;
  });

  return {
    latitude: totalLat / coordinates.length,
    longitude: totalLng / coordinates.length,
  };
}

/**
 * Algoritmo Ray-Casting para determinar si un punto GPS {lat, lng} se encuentra dentro de un polígono (RF-06)
 */
export function isPointInsidePolygon(point: LatLng, polygon: LatLng[]): boolean {
  if (!polygon || polygon.length < 3) return false;

  const x = point.longitude;
  const y = point.latitude;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}
