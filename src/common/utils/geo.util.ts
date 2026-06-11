// src/common/utils/geo.util.ts
export function generateRandomPointInRadius(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
): { lat: number; lng: number } {
  const radiusEarth = 6371000; // Bán kính trái đất tính bằng mét
  const r = radiusMeters / radiusEarth;
  
  // Random góc từ 0 đến 360 độ (2 PI)
  const theta = 2 * Math.PI * Math.random();
  // Random khoảng cách từ tâm (căn bậc 2 để phân bố đều diện tích)
  const distance = Math.sqrt(Math.random()) * r;

  const latRad = centerLat * (Math.PI / 180);
  const lngRad = centerLng * (Math.PI / 180);

  const finalLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(distance) +
    Math.cos(latRad) * Math.sin(distance) * Math.cos(theta)
  );

  const finalLngRad = lngRad + Math.atan2(
    Math.sin(theta) * Math.sin(distance) * Math.cos(latRad),
    Math.cos(distance) - Math.sin(latRad) * Math.sin(finalLatRad)
  );

  return {
    lat: finalLatRad * (180 / Math.PI),
    lng: finalLngRad * (180 / Math.PI),
  };
}