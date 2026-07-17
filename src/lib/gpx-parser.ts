import { gpx, kml } from "@tmcw/togeojson";
import type { FeatureCollection, Geometry, GeoJsonProperties } from "geojson";

export interface TrackPoint {
  lat: number;
  lon: number;
  elevation?: number;
  time?: string;
}

export interface SamplePoint extends TrackPoint {
  index: number;
  distanceFromStart: number;
  estimatedArrival?: string; // ISO datetime
}

export interface ActivityType {
  id: string;
  label: string;
  icon: string;
  avgSpeedKmh: number;
}

export const ACTIVITY_TYPES: ActivityType[] = [
  { id: "walking", label: "步行/徒步", icon: "🚶", avgSpeedKmh: 5 },
  { id: "hiking", label: "登山/越野", icon: "🥾", avgSpeedKmh: 3.5 },
  { id: "cycling", label: "骑行/公路", icon: "🚴", avgSpeedKmh: 20 },
  { id: "mtb", label: "骑行/山地", icon: "🚵", avgSpeedKmh: 12 },
  { id: "running", label: "跑步", icon: "🏃", avgSpeedKmh: 10 },
  { id: "driving", label: "驾车", icon: "🚗", avgSpeedKmh: 60 },
];

export interface SampleIntervalOption {
  km: number;
  label: string;
}

export const SAMPLE_INTERVALS: SampleIntervalOption[] = [
  { km: 1, label: "每 1 km" },
  { km: 5, label: "每 5 km" },
  { km: 10, label: "每 10 km" },
];

/** 预报节点间隔模式 */
export type ForecastInterval =
  | { type: "distance"; km: number }
  | { type: "time"; minutes: number };

export function resamplePoints(
  allPoints: TrackPoint[],
  totalDistance: number,
  intervalKm: number
): SamplePoint[] {
  const maxSamples = Math.max(
    2,
    Math.min(50, Math.ceil(totalDistance / intervalKm) + 2)
  );
  const samplePoints: SamplePoint[] = [];
  let cumulativeDist = 0;
  let nextSampleDist = intervalKm;

  // Always add first point
  samplePoints.push({
    ...allPoints[0],
    index: 0,
    distanceFromStart: 0,
  });

  for (let i = 1; i < allPoints.length - 1; i++) {
    cumulativeDist += haversineDistance(
      allPoints[i - 1].lat,
      allPoints[i - 1].lon,
      allPoints[i].lat,
      allPoints[i].lon
    );

    if (cumulativeDist >= nextSampleDist) {
      if (samplePoints.length < maxSamples) {
        samplePoints.push({
          ...allPoints[i],
          index: i,
          distanceFromStart: Math.round(cumulativeDist * 10) / 10,
        });
        nextSampleDist = cumulativeDist + intervalKm;
      }
    }
  }

  // Always add last point
  const lastIdx = allPoints.length - 1;
  const lastPoint = allPoints[lastIdx];
  const lastSample = samplePoints[samplePoints.length - 1];
  if (lastSample.index !== lastIdx && samplePoints.length < maxSamples) {
    samplePoints.push({
      ...lastPoint,
      index: lastIdx,
      distanceFromStart: Math.round(totalDistance * 10) / 10,
    });
  }

  return samplePoints;
}

/**
 * 按时间间隔采样：根据预计到达时间，每隔 intervalMinutes 分钟取一个采样点。
 */
export function resampleByTime(
  allPoints: TrackPoint[],
  totalDistance: number,
  startTime: string,
  activityTypeId: string,
  intervalMinutes: number
): SamplePoint[] {
  const activity = ACTIVITY_TYPES.find((a) => a.id === activityTypeId);
  if (!activity) return resamplePoints(allPoints, totalDistance, 5);

  const start = new Date(startTime);
  if (isNaN(start.getTime())) return resamplePoints(allPoints, totalDistance, 5);

  // Compute cumulative distance and arrival time for every track point
  const cumDist: number[] = [0];
  for (let i = 1; i < allPoints.length; i++) {
    cumDist.push(
      cumDist[i - 1] +
        haversineDistance(
          allPoints[i - 1].lat,
          allPoints[i - 1].lon,
          allPoints[i].lat,
          allPoints[i].lon
        )
    );
  }

  const samplePoints: SamplePoint[] = [];
  let nextIntervalMin = 0; // minutes from start

  for (let i = 0; i < allPoints.length; i++) {
    const hours = cumDist[i] / activity.avgSpeedKmh;
    const minutesFromStart = hours * 60;

    if (i === 0 || minutesFromStart >= nextIntervalMin) {
      if (samplePoints.length === 0 || i === 0) {
        samplePoints.push({
          ...allPoints[i],
          index: i,
          distanceFromStart: Math.round(cumDist[i] * 10) / 10,
        });
        nextIntervalMin += intervalMinutes;
      } else {
        samplePoints.push({
          ...allPoints[i],
          index: i,
          distanceFromStart: Math.round(cumDist[i] * 10) / 10,
        });
        // Advance to next interval boundary past current point
        nextIntervalMin =
          Math.ceil(minutesFromStart / intervalMinutes) * intervalMinutes;
        if (nextIntervalMin <= minutesFromStart) {
          nextIntervalMin += intervalMinutes;
        }
      }
    }
  }

  // Always add last point
  const lastIdx = allPoints.length - 1;
  const lastSample = samplePoints[samplePoints.length - 1];
  if (lastSample.index !== lastIdx) {
    samplePoints.push({
      ...allPoints[lastIdx],
      index: lastIdx,
      distanceFromStart: Math.round(totalDistance * 10) / 10,
    });
  }

  return samplePoints;
}

export function estimateArrivalTimes(
  samplePoints: SamplePoint[],
  startTime: string,
  activityTypeId: string
): SamplePoint[] {
  const activity = ACTIVITY_TYPES.find((a) => a.id === activityTypeId);
  if (!activity) return samplePoints;

  const start = new Date(startTime);
  if (isNaN(start.getTime())) return samplePoints;

  return samplePoints.map((point) => {
    const hours = point.distanceFromStart / activity.avgSpeedKmh;
    const arrival = new Date(start.getTime() + hours * 3600 * 1000);
    return { ...point, estimatedArrival: arrival.toISOString() };
  });
}

export interface ParseResult {
  name: string;
  totalDistance: number; // km
  allPoints: TrackPoint[];
  samplePoints: SamplePoint[];
}

// Haversine formula: distance in km between two lat/lon points
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Common GeoJSON processing: extract points, compute distance, resample.
 */
function parseGeoJson(
  geojson: FeatureCollection<Geometry | null, GeoJsonProperties>,
  defaultName: string,
  formatLabel: string
): ParseResult {
  // Extract all track points from LineString features
  const allPoints: TrackPoint[] = [];
  for (const feature of geojson.features) {
    if (feature.geometry?.type === "LineString") {
      for (const coord of feature.geometry.coordinates) {
        allPoints.push({
          lon: coord[0],
          lat: coord[1],
          elevation: coord[2],
        });
      }
    }
  }

  if (allPoints.length === 0) {
    throw new Error(`${formatLabel}文件中未找到有效的轨迹点`);
  }

  // Calculate total distance
  let totalDistance = 0;
  for (let i = 1; i < allPoints.length; i++) {
    totalDistance += haversineDistance(
      allPoints[i - 1].lat,
      allPoints[i - 1].lon,
      allPoints[i].lat,
      allPoints[i].lon
    );
  }
  totalDistance = Math.round(totalDistance * 10) / 10;

  // Default sampling: 5km interval
  const samplePoints = resamplePoints(allPoints, totalDistance, 5);

  // Extract track name
  const name =
    geojson.features[0]?.properties?.name || defaultName;

  return {
    name,
    totalDistance,
    allPoints,
    samplePoints,
  };
}

/**
 * Parse GPX XML string and extract track data.
 * Uses browser's native DOMParser.
 */
export function parseGpx(xmlString: string): ParseResult {
  const doc = new DOMParser().parseFromString(xmlString, "text/xml");

  // Check for parse errors
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("GPX 文件解析失败：文件格式无效");
  }

  const geojson = gpx(doc);
  return parseGeoJson(geojson, "未命名轨迹", "GPX");
}

/**
 * Parse KML XML string and extract track data.
 * Uses @tmcw/togeojson's kml() converter.
 */
export function parseKml(xmlString: string): ParseResult {
  const doc = new DOMParser().parseFromString(xmlString, "text/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("KML 文件解析失败：文件格式无效");
  }

  const geojson = kml(doc);
  return parseGeoJson(geojson, "未命名轨迹", "KML");
}

/**
 * Unified entry point: parse a track file (GPX or KML) based on file extension.
 */
export function parseTrackFile(fileName: string, content: string): ParseResult {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "kml") {
    return parseKml(content);
  } else if (ext === "gpx") {
    return parseGpx(content);
  } else {
    throw new Error(`不支持的文件格式: .${ext}，目前支持 .gpx 和 .kml`);
  }
}
