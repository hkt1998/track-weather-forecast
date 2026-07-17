import { SamplePoint } from "./gpx-parser";

export interface DailyWeather {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
  precipitationSum: number; // daily total precipitation in mm
  windSpeedMax: number;
  windDirection: number | null; // dominant wind direction in degrees
  weatherCode: number;
  lightningRisk: "none" | "low" | "moderate" | "high";
}

export interface HourlyWeather {
  time: string[];                    // 24 hourly timestamps
  temperature: number[];             // 24 hourly temperatures (°C)
  precipitationProbability: number[]; // 24 hourly precipitation probabilities (%)
  weatherCode: number[];             // 24 hourly WMO weather codes
}

export interface PointWeather {
  point: SamplePoint;
  arrivalDate: string | null; // YYYY-MM-DD of estimated arrival
  arrivalTime: string | null; // HH:MM
  weather: DailyWeather | null; // weather for arrival date
  forecast: DailyWeather[]; // full 7-day forecast
  hourly?: HourlyWeather | null; // hourly data for arrival day
}

export interface WeatherResult {
  points: PointWeather[];
}

// WMO Weather interpretation codes
export function getWeatherDescription(code: number): string {
  const map: Record<number, string> = {
    0: "晴朗",
    1: "大部晴朗",
    2: "多云",
    3: "阴天",
    45: "雾",
    48: "雾凇",
    51: "毛毛雨(小)",
    53: "毛毛雨(中)",
    55: "毛毛雨(大)",
    56: "冻毛毛雨(小)",
    57: "冻毛毛雨(大)",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    66: "冻雨(小)",
    67: "冻雨(大)",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    77: "雪粒",
    80: "阵雨(小)",
    81: "阵雨(中)",
    82: "阵雨(大)",
    85: "阵雪(小)",
    86: "阵雪(大)",
    95: "雷暴",
    96: "雷暴+小冰雹",
    99: "雷暴+大冰雹",
  };
  return map[code] || "未知";
}

export function getWeatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "❄️";
  return "⛈️";
}

/**
 * Determine lightning risk from WMO weather code.
 * 95 = thunderstorm, 96 = thunderstorm + small hail, 99 = thunderstorm + heavy hail
 */
export function getLightningRisk(weatherCode: number): "none" | "low" | "moderate" | "high" {
  if (weatherCode >= 99) return "high"; // Thunderstorm + heavy hail
  if (weatherCode >= 96) return "high"; // Thunderstorm + small hail
  if (weatherCode >= 95) return "moderate"; // Thunderstorm
  // Showers / overcast with storm potential
  if (weatherCode >= 80) return "low";
  return "none";
}

/**
 * Enhance lightning risk using hourly weather codes around arrival time.
 * If hourly data shows thunderstorm during arrival window, upgrade risk level.
 */
export function enhanceLightningRisk(
  baseRisk: "none" | "low" | "moderate" | "high",
  hourlyCodes: number[],
  arrivalHour: number | null
): "none" | "low" | "moderate" | "high" {
  if (arrivalHour == null || hourlyCodes.length === 0) return baseRisk;

  // Check ±2 hours around arrival time
  const startIdx = Math.max(0, arrivalHour - 2);
  const endIdx = Math.min(hourlyCodes.length - 1, arrivalHour + 2);

  for (let i = startIdx; i <= endIdx; i++) {
    const code = hourlyCodes[i];
    if (code >= 95) {
      // Thunderstorm detected in arrival window — upgrade to at least moderate
      if (code >= 96) return "high";
      return baseRisk === "high" ? "high" : "moderate";
    }
  }
  return baseRisk;
}

/**
 * Convert wind direction degrees to compass label
 */
export function getWindDirectionLabel(degrees: number | null): string {
  if (degrees == null) return "-";
  const dirs = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
  const idx = Math.round(degrees / 45) % 8;
  return dirs[idx];
}

/**
 * Get wind direction arrow icon
 */
export function getWindDirectionArrow(degrees: number | null): string {
  if (degrees == null) return "";
  const arrows = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
  const idx = Math.round(degrees / 45) % 8;
  return arrows[idx];
}

/**
 * Convert wind speed (km/h) to Beaufort scale level (0-12)
 */
export function getBeaufortScale(speedKmh: number): number {
  if (speedKmh < 1) return 0;
  if (speedKmh < 6) return 1;
  if (speedKmh < 12) return 2;
  if (speedKmh < 20) return 3;
  if (speedKmh < 29) return 4;
  if (speedKmh < 39) return 5;
  if (speedKmh < 50) return 6;
  if (speedKmh < 62) return 7;
  if (speedKmh < 75) return 8;
  if (speedKmh < 89) return 9;
  if (speedKmh < 103) return 10;
  if (speedKmh < 118) return 11;
  return 12;
}

/**
 * Get Chinese description for Beaufort scale level
 */
export function getBeaufortLabel(level: number): string {
  const labels = [
    "无风", "软风", "轻风", "微风", "和风",
    "清风", "强风", "疾风", "大风", "烈风",
    "狂风", "暴风", "飓风",
  ];
  return labels[Math.min(level, 12)] || "未知";
}

export async function fetchWeatherForPoints(
  samplePoints: SamplePoint[]
): Promise<WeatherResult> {
  const points: PointWeather[] = [];

  // Batch requests
  const batchSize = 5;
  for (let i = 0; i < samplePoints.length; i += batchSize) {
    const batch = samplePoints.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((point) => fetchSinglePointWeather(point))
    );
    points.push(...results);
  }

  return { points };
}

async function fetchSinglePointWeather(
  point: SamplePoint
): Promise<PointWeather> {
  // Calculate arrival date if available
  let arrivalDate: string | null = null;
  let arrivalTime: string | null = null;

  if (point.estimatedArrival) {
    const arrival = new Date(point.estimatedArrival);
    arrivalDate = arrival.toISOString().split("T")[0];
    arrivalTime = arrival.toTimeString().slice(0, 5);
  }

  // Determine date range for API query
  // Use arrival dates if available, otherwise fallback to today + 7 days
  let startDate: string;
  let endDate: string;

  if (arrivalDate) {
    const today = new Date().toISOString().split("T")[0];
    startDate = today < arrivalDate ? today : arrivalDate;
    // Add a buffer of 1 day
    const end = new Date(arrivalDate);
    end.setDate(end.getDate() + 1);
    const todayDate = new Date();
    const maxEnd = new Date(todayDate.getTime() + 16 * 86400000);
    endDate =
      end.toISOString().split("T")[0] <= maxEnd.toISOString().split("T")[0]
        ? end.toISOString().split("T")[0]
        : maxEnd.toISOString().split("T")[0];
    // Ensure start_date is not in the past
    if (startDate < today) startDate = today;
  } else {
    const today = new Date();
    startDate = today.toISOString().split("T")[0];
    const end = new Date(today.getTime() + 7 * 86400000);
    endDate = end.toISOString().split("T")[0];
  }

  const params = new URLSearchParams({
    latitude: point.lat.toString(),
    longitude: point.lon.toString(),
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weathercode,windspeed_10m_max,winddirection_10m_dominant",
    hourly: "weathercode,temperature_2m,precipitation_probability",
    timezone: "auto",
    start_date: startDate,
    end_date: endDate,
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(
      `天气 API 请求失败: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();

  // Parse hourly weather codes for lightning enhancement
  const hourlyCodes: number[] = data.hourly?.weathercode ?? [];

  // Extract full hourly data for arrival day
  let hourly: HourlyWeather | null = null;
  if (arrivalDate && data.hourly?.time) {
    // Find the day index for arrival date
    const dayIndex = data.daily?.time?.indexOf(arrivalDate) ?? -1;
    if (dayIndex >= 0) {
      const dayStart = dayIndex * 24;
      const dayEnd = dayStart + 24;
      if (dayEnd <= data.hourly.time.length) {
        hourly = {
          time: data.hourly.time.slice(dayStart, dayEnd),
          temperature: (data.hourly.temperature_2m ?? []).slice(dayStart, dayEnd),
          precipitationProbability: (data.hourly.precipitation_probability ?? []).slice(dayStart, dayEnd),
          weatherCode: hourlyCodes.slice(dayStart, dayEnd),
        };
      }
    }
    // Fallback: if no arrival date match but we have hourly data, take first 24
    if (!hourly && data.hourly.time.length >= 24) {
      hourly = {
        time: data.hourly.time.slice(0, 24),
        temperature: (data.hourly.temperature_2m ?? []).slice(0, 24),
        precipitationProbability: (data.hourly.precipitation_probability ?? []).slice(0, 24),
        weatherCode: hourlyCodes.slice(0, 24),
      };
    }
  }

  const forecast: DailyWeather[] = [];
  if (data.daily) {
    for (let i = 0; i < data.daily.time.length; i++) {
      const dailyCode = data.daily.weathercode[i];
      let risk = getLightningRisk(dailyCode);

      // If this day matches arrival date, enhance with hourly data
      if (arrivalDate && data.daily.time[i] === arrivalDate && arrivalTime) {
        const hour = parseInt(arrivalTime.split(":")[0], 10);
        // Hourly data is indexed by day * 24 + hour
        const dayStartIdx = i * 24;
        const dayHourlyCodes = hourlyCodes.slice(dayStartIdx, dayStartIdx + 24);
        risk = enhanceLightningRisk(risk, dayHourlyCodes, hour);
      }

      forecast.push({
        date: data.daily.time[i],
        tempMax: data.daily.temperature_2m_max[i],
        tempMin: data.daily.temperature_2m_min[i],
        precipitationProbability:
          data.daily.precipitation_probability_max[i],
        precipitationSum: data.daily.precipitation_sum?.[i] ?? 0,
        windSpeedMax: data.daily.windspeed_10m_max[i],
        windDirection: data.daily.winddirection_10m_dominant?.[i] ?? null,
        weatherCode: dailyCode,
        lightningRisk: risk,
      });
    }
  }

  // Match weather to arrival date
  let weather: DailyWeather | null = null;
  if (arrivalDate) {
    weather = forecast.find((d) => d.date === arrivalDate) || null;
  }
  // Fallback to first day
  if (!weather && forecast.length > 0) {
    weather = forecast[0];
  }

  return { point, arrivalDate, arrivalTime, weather, forecast, hourly };
}
