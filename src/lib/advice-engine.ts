import {
  PointWeather,
  DailyWeather,
  HourlyWeather,
  getWeatherDescription,
  getWindDirectionLabel,
  getWindDirectionArrow,
  getBeaufortScale,
  getBeaufortLabel,
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
  hourly?: HourlyWeather | null;
}

export interface AdviceResult {
  summary: string;
  overall: Advice[];
  segments: SegmentAdvice[];
}

function analyzeDaily(day: DailyWeather): Advice[] {
  const advices: Advice[] = [];

  // Precipitation probability
  if (day.precipitationProbability > 70) {
    advices.push({
      level: "warning",
      icon: "🌧️",
      text: `降水概率 ${day.precipitationProbability}%，预计降水量 ${day.precipitationSum}mm，建议携带雨具`,
    });
  } else if (day.precipitationProbability > 50) {
    advices.push({
      level: "info",
      icon: "🌦️",
      text: `降水概率 ${day.precipitationProbability}%，预计降水量 ${day.precipitationSum}mm，可考虑带伞`,
    });
  } else if (day.precipitationSum > 10) {
    advices.push({
      level: "warning",
      icon: "️",
      text: `预计降水量 ${day.precipitationSum}mm，建议携带雨具`,
    });
  } else if (day.precipitationSum > 5) {
    advices.push({
      level: "info",
      icon: "🌦️",
      text: `预计降水量 ${day.precipitationSum}mm，可考虑带伞`,
    });
  }

  // Thunderstorm / Lightning
  if (day.weatherCode >= 95) {
    const lightningLabel =
      day.lightningRisk === "high"
        ? "高雷击风险"
        : day.lightningRisk === "moderate"
          ? "中等雷击风险"
          : "雷暴";
    advices.push({
      level: "danger",
      icon: "⛈️",
      text: `${getWeatherDescription(day.weatherCode)}，${lightningLabel}，建议避开户外活动`,
    });
  } else if (day.lightningRisk === "low") {
    advices.push({
      level: "info",
      icon: "⚡",
      text: `存在潜在雷击风险，请关注天气变化`,
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
  const beaufort = getBeaufortScale(day.windSpeedMax);
  const windLabel = `${getBeaufortLabel(beaufort)}（${beaufort}级）`;
  if (beaufort >= 10) {
    advices.push({
      level: "danger",
      icon: "🌪️",
      text: `${windLabel}，${day.windSpeedMax}km/h（${getWindDirectionLabel(day.windDirection)}${getWindDirectionArrow(day.windDirection)}），强烈建议避免户外`,
    });
  } else if (beaufort >= 6) {
    advices.push({
      level: "warning",
      icon: "💨",
      text: `${windLabel}，${day.windSpeedMax}km/h（${getWindDirectionLabel(day.windDirection)}${getWindDirectionArrow(day.windDirection)}），注意大风影响`,
    });
  } else if (beaufort >= 3 && day.windDirection != null) {
    advices.push({
      level: "info",
      icon: "🧭",
      text: `${windLabel}，${day.windSpeedMax}km/h（${getWindDirectionLabel(day.windDirection)}${getWindDirectionArrow(day.windDirection)}）`,
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
      hourly: pw.hourly ?? null,
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
    const totalPrecipSum = matchedForecasts.reduce(
      (s, d) => s + d.precipitationSum, 0
    );
    const maxWind = Math.max(
      ...matchedForecasts.map((d) => d.windSpeedMax)
    );
    const maxBeaufort = getBeaufortScale(maxWind);
    const dominantWindDir = matchedForecasts.find(
      (d) => d.windDirection != null
    )?.windDirection;
    const hasLightning = matchedForecasts.some(
      (d) => d.lightningRisk !== "none"
    );
    const codes = matchedForecasts.map((d) => getWeatherDescription(d.weatherCode));
    const uniqueCodes = [...new Set(codes)];

    summary = `沿途气温 ${avgMin}°C ~ ${avgMax}°C，天气状况：${uniqueCodes.join("、")}，最高降水概率 ${maxPrecip}%，累计降水量 ${totalPrecipSum.toFixed(1)}mm。`;
    if (dominantWindDir != null) {
      summary += ` 主导风向 ${getWindDirectionLabel(dominantWindDir)}，最大风力 ${maxBeaufort}级（${maxWind}km/h）。`;
    }
    if (hasLightning) {
      summary += ` ️ 部分路段存在雷击风险，请注意防范。`;
    }

    if (overall.length === 0) {
      summary += " 整体天气良好，适合出行！";
    }
  }

  return { summary, overall, segments };
}
