"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRandomPointInRadius = generateRandomPointInRadius;
const TO_RAD = Math.PI / 180;
const TO_DEG = 180 / Math.PI;
const RADIUS_EARTH = 6371000;
function generateRandomPointInRadius(centerLat, centerLng, radiusMeters) {
    const r = radiusMeters / RADIUS_EARTH;
    const theta = 2 * Math.PI * Math.random();
    const distance = Math.sqrt(Math.random()) * r;
    const latRad = centerLat * TO_RAD;
    const lngRad = centerLng * TO_RAD;
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinDist = Math.sin(distance);
    const cosDist = Math.cos(distance);
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    const finalLatRad = Math.asin(sinLat * cosDist + cosLat * sinDist * cosTheta);
    const finalLngRad = lngRad + Math.atan2(sinTheta * sinDist * cosLat, cosDist - sinLat * Math.sin(finalLatRad));
    return {
        lat: Math.max(-90, Math.min(90, finalLatRad * TO_DEG)),
        lng: ((finalLngRad * TO_DEG + 540) % 360) - 180,
    };
}
//# sourceMappingURL=geo.util.js.map