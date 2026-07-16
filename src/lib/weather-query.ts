import {
  SamplePoint,
  TrackPoint,
  estimateArrivalTimes,
} from "./gpx-parser";
import { fetchWeatherForPoints } from "./weather-service";
import { generateAdvice, AdviceResult } from "./advice-engine";
import { insertRoute } from "./database";

export interface WeatherQueryResult {
  weather: ReturnType<typeof fetchWeatherForPoints> extends Promise<infer T>
    ? T
    : never;
  advice: AdviceResult;
  routeId: number | null;
}

/**
 * Query weather for sample points, generate advice, and save to IndexedDB.
 * This replaces the old /api/weather route.
 */
export async function queryWeather(params: {
  name: string;
  samplePoints: SamplePoint[];
  allPoints: TrackPoint[];
  startTime: string;
  activityType: string;
}): Promise<WeatherQueryResult> {
  const { name, samplePoints, allPoints, startTime, activityType } = params;

  // Estimate arrival times
  const pointsToQuery = estimateArrivalTimes(
    samplePoints,
    startTime,
    activityType
  );

  // Fetch weather data
  const weatherResult = await fetchWeatherForPoints(pointsToQuery);

  // Generate advice
  const adviceResult = generateAdvice(weatherResult.points);

  // Calculate total distance from sample points
  const totalDistance =
    samplePoints.length > 0
      ? samplePoints[samplePoints.length - 1].distanceFromStart
      : 0;

  // Auto-save to IndexedDB
  let routeId: number | null = null;
  try {
    routeId = await insertRoute({
      name: name || "未命名轨迹",
      distanceKm: totalDistance,
      pointsCount: samplePoints.length,
      activityType,
      startTime,
      allPointsJson: JSON.stringify(allPoints || []),
      segments: adviceResult.segments.map((seg) => ({
        pointIndex: seg.pointIndex,
        distanceKm: seg.distanceKm,
        lat: seg.lat,
        lon: seg.lon,
        arrivalDate: seg.arrivalDate,
        arrivalTime: seg.arrivalTime,
        wmoCode: seg.weather?.weatherCode ?? null,
        tempMax: seg.weather?.tempMax ?? null,
        tempMin: seg.weather?.tempMin ?? null,
        precipProb: seg.weather?.precipitationProbability ?? null,
        windSpeedMax: seg.weather?.windSpeedMax ?? null,
        adviceLevel: seg.advices.some((a) => a.level === "danger")
          ? "danger"
          : seg.advices.some((a) => a.level === "warning")
          ? "warning"
          : "info",
        adviceText: seg.advices.map((a) => a.text).join(" | ") || undefined,
      })),
    });
  } catch (dbError) {
    console.error("Failed to save route to database:", dbError);
  }

  return {
    weather: weatherResult,
    advice: adviceResult,
    routeId,
  };
}
