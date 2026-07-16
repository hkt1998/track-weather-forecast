import { Suspense, useEffect, useState, lazy } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import WeatherTable from "@/components/WeatherTable";
import AdvicePanel from "@/components/AdvicePanel";
import {
  TrackPoint,
  SamplePoint,
  ACTIVITY_TYPES,
} from "@/lib/gpx-parser";
import { SegmentAdvice, Advice } from "@/lib/advice-engine";
import {
  DailyWeather,
  getWeatherDescription,
} from "@/lib/weather-service";
import { queryWeather } from "@/lib/weather-query";
import { getRouteById } from "@/lib/database";

const WeatherMap = lazy(() => import("@/components/WeatherMap"));

interface ResultData {
  name: string;
  totalDistance: number;
  pointCount: number;
  allPoints: TrackPoint[];
  samplePoints: SamplePoint[];
  segments: SegmentAdvice[];
  summary: string;
  overallAdvices: Advice[];
  startTime: string;
  activityType: string;
  routeId: number | null;
}

export default function ResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequery, setShowRequery] = useState(false);
  const [requeryTime, setRequeryTime] = useState("");
  const [isRequerying, setIsRequerying] = useState(false);

  useEffect(() => {
    const idParam = searchParams.get("id");

    if (idParam) {
      const routeId = parseInt(idParam, 10);
      if (!isNaN(routeId)) {
        loadFromDatabase(routeId);
        return;
      }
    }

    // Fallback: load from sessionStorage
    loadFromSession();
  }, [searchParams]);

  async function loadFromDatabase(id: number) {
    try {
      setLoading(true);
      const route = await getRouteById(id);
      if (!route) {
        setLoading(false);
        return;
      }

      // Parse allPoints from JSON
      let allPoints: TrackPoint[] = [];
      try {
        allPoints = JSON.parse(route.all_points_json);
      } catch {
        // ignore
      }

      // Transform DB segments to SegmentAdvice
      const segments: SegmentAdvice[] = route.segments.map((seg) => {
        const weather: DailyWeather | null =
          seg.wmo_code != null
            ? {
                date: seg.arrival_date || "",
                tempMax: seg.temp_max ?? 0,
                tempMin: seg.temp_min ?? 0,
                precipitationProbability: seg.precip_prob ?? 0,
                windSpeedMax: seg.wind_speed_max ?? 0,
                weatherCode: seg.wmo_code,
              }
            : null;

        // Parse advice_text into Advice[]
        const advices: Advice[] = [];
        if (seg.advice_text) {
          const parts = seg.advice_text.split(" | ");
          for (const text of parts) {
            if (!text.trim()) continue;
            const level =
              seg.advice_level === "danger"
                ? "danger"
                : seg.advice_level === "warning"
                ? "warning"
                : "info";
            const iconMatch = text.match(
              /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u
            );
            const icon = iconMatch ? iconMatch[0] : "";
            const cleanText = iconMatch
              ? text.slice(iconMatch[0].length).trim()
              : text;
            advices.push({
              level: level as "info" | "warning" | "danger",
              icon,
              text: cleanText,
            });
          }
        }

        return {
          pointIndex: seg.point_index,
          distanceKm: seg.distance_km,
          lat: seg.lat,
          lon: seg.lon,
          arrivalDate: seg.arrival_date,
          arrivalTime: seg.arrival_time,
          weather,
          advices,
        };
      });

      // Generate summary
      const matchedWeathers = segments
        .map((s) => s.weather)
        .filter((w): w is DailyWeather => w != null);
      let summary = "";
      if (matchedWeathers.length > 0) {
        const avgMax = Math.round(
          matchedWeathers.reduce((s, d) => s + d.tempMax, 0) /
            matchedWeathers.length
        );
        const avgMin = Math.round(
          matchedWeathers.reduce((s, d) => s + d.tempMin, 0) /
            matchedWeathers.length
        );
        const maxPrecip = Math.max(
          ...matchedWeathers.map((d) => d.precipitationProbability)
        );
        const codes = matchedWeathers.map((d) =>
          getWeatherDescription(d.weatherCode)
        );
        const uniqueCodes = [...new Set(codes)];
        summary = `沿途气温 ${avgMin}°C ~ ${avgMax}°C，天气状况：${uniqueCodes.join("、")}，最高降水概率 ${maxPrecip}%。`;
      }

      // Collect overall advices (deduplicated)
      const seen = new Set<string>();
      const overallAdvices: Advice[] = [];
      for (const seg of segments) {
        for (const a of seg.advices) {
          if (!seen.has(a.text)) {
            seen.add(a.text);
            overallAdvices.push(a);
          }
        }
      }
      const levelOrder = { danger: 0, warning: 1, info: 2 };
      overallAdvices.sort(
        (a, b) => levelOrder[a.level] - levelOrder[b.level]
      );

      // Reconstruct samplePoints from DB segments
      const samplePoints: SamplePoint[] = route.segments.map((seg) => ({
        index: seg.point_index,
        distanceFromStart: seg.distance_km,
        lat: seg.lat,
        lon: seg.lon,
        estimatedArrival:
          seg.arrival_date && seg.arrival_time
            ? `${seg.arrival_date}T${seg.arrival_time}:00`
            : undefined,
      }));

      setData({
        name: route.name,
        totalDistance: route.distance_km,
        pointCount: route.points_count,
        allPoints,
        samplePoints,
        segments,
        summary,
        overallAdvices,
        startTime: route.start_time || "",
        activityType: route.activity_type || "",
        routeId: route.id,
      });
    } catch (err) {
      console.error("Failed to load route from database:", err);
    } finally {
      setLoading(false);
    }
  }

  function loadFromSession() {
    const stored = sessionStorage.getItem("gpx-result");
    if (stored) {
      const parsed = JSON.parse(stored);
      setData({
        name: parsed.name,
        totalDistance: parsed.totalDistance,
        pointCount: parsed.pointCount,
        allPoints: parsed.allPoints,
        samplePoints: parsed.samplePoints || [],
        segments: parsed.advice.segments,
        summary: parsed.advice.summary,
        overallAdvices: parsed.advice.overall,
        startTime: parsed.startTime || "",
        activityType: parsed.activityType || "",
        routeId: parsed.routeId ?? null,
      });
    }
    setLoading(false);
  }

  async function handleRequery() {
    if (!data || !requeryTime) return;
    setIsRequerying(true);
    try {
      const weatherData = await queryWeather({
        name: data.name,
        samplePoints: data.samplePoints,
        allPoints: data.allPoints,
        startTime: requeryTime,
        activityType: data.activityType,
      });

      // Update UI directly
      setData({
        ...data,
        startTime: requeryTime,
        segments: weatherData.advice.segments,
        summary: weatherData.advice.summary,
        overallAdvices: weatherData.advice.overall,
        routeId: weatherData.routeId ?? data.routeId,
      });
      setShowRequery(false);
    } catch (err) {
      console.error("Requery failed:", err);
      alert(err instanceof Error ? err.message : "重新查询失败");
    } finally {
      setIsRequerying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-52px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-3 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[calc(100vh-52px)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-500">未找到轨迹数据</p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-52px)] bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="返回"
            >
              ←
            </button>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white">
                {data.name}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                总距离 {data.totalDistance} km · {data.pointCount} 个轨迹点
                {data.startTime && (
                  <span className="ml-1">
                    · 出发 {new Date(data.startTime).toLocaleString("zh-CN")}
                  </span>
                )}
                {data.activityType && (
                  <span className="ml-1">
                    ·{" "}
                    {ACTIVITY_TYPES.find((a) => a.id === data.activityType)
                      ?.icon}{" "}
                    {ACTIVITY_TYPES.find((a) => a.id === data.activityType)
                      ?.label}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data.routeId && (
              <span className="text-xs text-green-500 bg-green-50 dark:bg-green-950 px-2 py-1 rounded-full">
                ✅ 已保存到历史记录
              </span>
            )}
            <button
              onClick={() => navigate("/history")}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors"
            >
              📋 历史记录
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map - takes 2 columns on large screens */}
        <div className="lg:col-span-2 h-[500px] lg:h-[600px]">
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl min-h-[400px]">
                <div className="flex items-center gap-3 text-gray-500">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>加载地图...</span>
                </div>
              </div>
            }
          >
            <WeatherMap
              allPoints={data.allPoints}
              segments={data.segments}
            />
          </Suspense>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 overflow-y-auto max-h-[600px]">
          {/* Advice */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <AdvicePanel
              summary={data.summary}
              advices={data.overallAdvices}
            />
          </div>

          {/* Requery panel */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <button
              onClick={() => {
                if (!showRequery) {
                  if (data.startTime) {
                    const d = new Date(data.startTime);
                    const local = new Date(
                      d.getTime() - d.getTimezoneOffset() * 60000
                    )
                      .toISOString()
                      .slice(0, 16);
                    setRequeryTime(local);
                  } else {
                    const now = new Date();
                    const local = new Date(
                      now.getTime() - now.getTimezoneOffset() * 60000
                    )
                      .toISOString()
                      .slice(0, 16);
                    setRequeryTime(local);
                  }
                }
                setShowRequery(!showRequery);
              }}
              className="w-full flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-500 transition-colors"
            >
              <span>🔄 调整出发时间重新查询</span>
              <span className="text-gray-400 text-xs">
                {showRequery ? "收起" : "展开"}
              </span>
            </button>

            {showRequery && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    新的出发时间
                  </label>
                  <input
                    type="datetime-local"
                    value={requeryTime}
                    onChange={(e) => setRequeryTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Quick adjust buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "-2h", hours: -2 },
                    { label: "-1h", hours: -1 },
                    { label: "+1h", hours: 1 },
                    { label: "+2h", hours: 2 },
                    { label: "+3h", hours: 3 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      onClick={() => {
                        const current = requeryTime || "";
                        if (!current) return;
                        const [datePart, timePart] = current.split("T");
                        const [year, month, day] = datePart
                          .split("-")
                          .map(Number);
                        const [hour, minute] = timePart.split(":").map(Number);
                        const newHour = hour + btn.hours;
                        const d = new Date(year, month - 1, day, newHour, minute);
                        const pad = (n: number) =>
                          n.toString().padStart(2, "0");
                        const result = `${d.getFullYear()}-${pad(
                          d.getMonth() + 1
                        )}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
                          d.getMinutes()
                        )}`;
                        setRequeryTime(result);
                      }}
                      className="px-2.5 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleRequery}
                  disabled={isRequerying || !requeryTime}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium text-white transition ${
                    isRequerying
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isRequerying ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      查询中...
                    </span>
                  ) : (
                    "重新查询天气"
                  )}
                </button>

                <p className="text-xs text-gray-400 dark:text-gray-500">
                  将使用相同路线，仅更改出发时间重新获取天气
                </p>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2 text-sm">
              🎨 图例说明
            </h3>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                天气良好
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                需要注意
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                天气恶劣
              </span>
            </div>
          </div>
        </div>

        {/* Weather table - full width */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">
            📋 沿途天气详情
          </h3>
          <WeatherTable segments={data.segments} />
        </div>
      </main>
    </div>
  );
}
