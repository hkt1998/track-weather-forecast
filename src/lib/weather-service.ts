import { SamplePoint } from "./gpx-parser";

export interface DailyWeather {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
  windSpeedMax: number;
  weatherCode: number;
}

export interface PointWeather {
  point: SamplePoint;
  arrivalDate: string | null; // YYYY-MM-DD of estimated arrival
  arrivalTime: string | null; // HH:MM
  weather: DailyWeather | null; // weather for arrival date
  forecast: DailyWeather[]; // full 7-day forecast
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
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,windspeed_10m_max",
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

  const forecast: DailyWeather[] = [];
  if (data.daily) {
    for (let i = 0; i < data.daily.time.length; i++) {
      forecast.push({
        date: data.daily.time[i],
        tempMax: data.daily.temperature_2m_max[i],
        tempMin: data.daily.temperature_2m_min[i],
        precipitationProbability:
          data.daily.precipitation_probability_max[i],
        windSpeedMax: data.daily.windspeed_10m_max[i],
        weatherCode: data.daily.weathercode[i],
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

  return { point, arrivalDate, arrivalTime, weather, forecast };
}
