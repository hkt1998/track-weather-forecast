import {
  PointWeather,
  DailyWeather,
  getWeatherDescription,
} from "./weather-service";

export interface Advice {
  level: "info" | "warning" | "danger";
  icon: string;
  text: string;
}

export interface SegmentAdvice {
  pointIndex: number;
  distanceKm: number;
  lat: number;
  lon: number;
  arrivalDate: string | null;
  arrivalTime: string | null;
  weather: DailyWeather | null;
  advices: Advice[];
}

export interface AdviceResult {
  summary: string;
  overall: Advice[];
  segments: SegmentAdvice[];
}

function analyzeDaily(day: DailyWeather): Advice[] {
  const advices: Advice[] = [];

  // Precipitation
  if (day.precipitationProbability > 70) {
    advices.push({
      level: "warning",
      icon: "🌧️",
      text: `降水概率 ${day.precipitationProbability}%，建议携带雨具`,
    });
  } else if (day.precipitationProbability > 50) {
    advices.push({
      level: "info",
      icon: "🌦️",
      text: `降水概率 ${day.precipitationProbability}%，可考虑带伞`,
    });
  }

  // Thunderstorm
  if (day.weatherCode >= 95) {
    advices.push({
      level: "danger",
      icon: "⛈️",
      text: `${getWeatherDescription(day.weatherCode)}，建议避开户外活动`,
    });
  }

  // High temperature
  if (day.tempMax >= 35) {
    advices.push({
      level: "warning",
      icon: "🔥",
      text: `最高 ${day.tempMax}°C，注意防暑降温、多补充水分`,
    });
  } else if (day.tempMax >= 30) {
    advices.push({
      level: "info",
      icon: "☀️",
      text: `最高 ${day.tempMax}°C，注意防晒`,
    });
  }

  // Low temperature
  if (day.tempMin <= 0) {
    advices.push({
      level: "warning",
      icon: "🥶",
      text: `最低 ${day.tempMin}°C，路面可能结冰，注意防滑`,
    });
  } else if (day.tempMin <= 5) {
    advices.push({
      level: "info",
      icon: "🧥",
      text: `最低 ${day.tempMin}°C，注意保暖`,
    });
  }

  // Wind
  if (day.windSpeedMax > 50) {
    advices.push({
      level: "danger",
      icon: "🌪️",
      text: `最大风速 ${day.windSpeedMax}km/h，强烈建议避免户外`,
    });
  } else if (day.windSpeedMax > 30) {
    advices.push({
      level: "warning",
      icon: "💨",
      text: `最大风速 ${day.windSpeedMax}km/h，注意大风影响`,
    });
  }

  // Snow
  if (
    day.weatherCode >= 71 &&
    day.weatherCode <= 86 &&
    day.weatherCode !== 77
  ) {
    advices.push({
      level: "info",
      icon: "❄️",
      text: `${getWeatherDescription(day.weatherCode)}，注意路面湿滑`,
    });
  }

  return advices;
}

export function generateAdvice(
  weatherData: PointWeather[]
): AdviceResult {
  const segments: SegmentAdvice[] = [];
  const allAdvices: Advice[] = [];

  for (const pw of weatherData) {
    // Use the weather matched to arrival date
    const weather = pw.weather;
    const advices = weather ? analyzeDaily(weather) : [];

    segments.push({
      pointIndex: pw.point.index,
      distanceKm: pw.point.distanceFromStart,
      lat: pw.point.lat,
      lon: pw.point.lon,
      arrivalDate: pw.arrivalDate,
      arrivalTime: pw.arrivalTime,
      weather,
      advices,
    });

    allAdvices.push(...advices);
  }

  // Deduplicate overall advices by category (icon), merging with worst-case values
  const categoryMap = new Map<string, { advice: Advice; worstValue: number; lowerIsWorse: boolean }>();
  for (const a of allAdvices) {
    const key = a.icon;
    const numMatch = a.text.match(/([\d.]+)/);
    const numVal = numMatch ? parseFloat(numMatch[1]) : 0;
    // Low temp and low-precip are "lower is worse" scenarios
    const lowerIsWorse = a.icon === "🥶" || a.icon === "🧥";

    const existing = categoryMap.get(key);
    if (!existing) {
      categoryMap.set(key, { advice: a, worstValue: numVal, lowerIsWorse });
    } else {
      const isWorse = lowerIsWorse
        ? numVal < existing.worstValue
        : numVal > existing.worstValue;
      if (isWorse) {
        categoryMap.set(key, { advice: a, worstValue: numVal, lowerIsWorse });
      }
    }
  }

  const overall: Advice[] = Array.from(categoryMap.values()).map((v) => v.advice);

  // Sort by severity
  const levelOrder = { danger: 0, warning: 1, info: 2 };
  overall.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  // Generate summary
  const matchedForecasts = weatherData
    .map((pw) => pw.weather)
    .filter(Boolean) as DailyWeather[];

  let summary = "";
  if (matchedForecasts.length > 0) {
    const avgMax = Math.round(
      matchedForecasts.reduce((s, d) => s + d.tempMax, 0) /
        matchedForecasts.length
    );
    const avgMin = Math.round(
      matchedForecasts.reduce((s, d) => s + d.tempMin, 0) /
        matchedForecasts.length
    );
    const maxPrecip = Math.max(
      ...matchedForecasts.map((d) => d.precipitationProbability)
    );
    const codes = matchedForecasts.map((d) => getWeatherDescription(d.weatherCode));
    const uniqueCodes = [...new Set(codes)];

    summary = `沿途气温 ${avgMin}°C ~ ${avgMax}°C，天气状况：${uniqueCodes.join("、")}，最高降水概率 ${maxPrecip}%。`;

    if (overall.length === 0) {
      summary += " 整体天气良好，适合出行！";
    }
  }

  return { summary, overall, segments };
}
