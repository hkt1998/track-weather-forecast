import { Suspense, useEffect, useMemo, useState, lazy } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import WeatherTable from "@/components/WeatherTable";
import AdvicePanel from "@/components/AdvicePanel";
import {
  TrackPoint,
  SamplePoint,
  ACTIVITY_TYPES,
  ForecastInterval,
  resamplePoints,
  resampleByTime,
} from "@/lib/gpx-parser";
import { SegmentAdvice, Advice } from "@/lib/advice-engine";
import {
  DailyWeather,
  getWeatherDescription,
  getWindDirectionLabel,
  getBeaufortScale,
} from "@/lib/weather-service";
import { queryWeather } from "@/lib/weather-query";
import { getRouteById } from "@/lib/database";
import { recordRecentTime } from "@/lib/recent-times";
import DateTimePicker from "@/components/DateTimePicker";
import DangerBanner from "@/components/DangerBanner";
import GearPanel from "@/components/GearPanel";
import { recommendEquipment } from "@/lib/gear-recommender";
import { exportToImage, exportToPDF, generateOfflineSummary } from "@/lib/export-utils";
import PosterGenerator from "@/components/PosterGenerator";

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
  const [showPoster, setShowPoster] = useState(false);
  const [requeryTime, setRequeryTime] = useState("");
  const [isRequerying, setIsRequerying] = useState(false);

  // 预报节点间隔选择
  const [forecastInterval, setForecastInterval] = useState<ForecastInterval>({
    type: "distance",
    km: 5,
  });
  const [isResampling, setIsResampling] = useState(false);

  // 导出下拉菜单状态
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // 装备推荐缓存
  const gearItems = useMemo(
    () => recommendEquipment(data?.segments ?? [], data?.activityType ?? ""),
    [data?.segments, data?.activityType]
  );

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
                precipitationSum: seg.precip_sum ?? 0,
                windSpeedMax: seg.wind_speed_max ?? 0,
                windDirection: seg.wind_direction ?? null,
                weatherCode: seg.wmo_code,
                lightningRisk: (seg.lightning_risk as "none" | "low" | "moderate" | "high") ?? "none",
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
        const totalPrecipSum = matchedWeathers.reduce(
          (s, d) => s + d.precipitationSum, 0
        );
        const maxWind = Math.max(
          ...matchedWeathers.map((d) => d.windSpeedMax)
        );
        const maxBeaufort = getBeaufortScale(maxWind);
        const dominantWindDir = matchedWeathers.find(
          (d) => d.windDirection != null
        )?.windDirection;
        const hasLightning = matchedWeathers.some(
          (d) => d.lightningRisk !== "none"
        );
        const codes = matchedWeathers.map((d) =>
          getWeatherDescription(d.weatherCode)
        );
        const uniqueCodes = [...new Set(codes)];
        summary = `沿途气温 ${avgMin}°C ~ ${avgMax}°C，天气状况：${uniqueCodes.join("、")}，最高降水概率 ${maxPrecip}%，累计降水量 ${totalPrecipSum.toFixed(1)}mm。`;
        if (dominantWindDir != null) {
          summary += ` 主导风向 ${getWindDirectionLabel(dominantWindDir)}，最大风力 ${maxBeaufort}级（${maxWind}km/h）。`;
        }
        if (hasLightning) {
          summary += ` ⚠️ 部分路段存在雷击风险，请注意防范。`;
        }
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

  // DateTimePicker handler — only record recent time
  const handleRequeryTimeChange = (newTime: string) => {
    setRequeryTime(newTime);
  };

  async function handleRequery() {
    if (!data || !requeryTime) return;
    setIsRequerying(true);
    try {
      // Record recent departure time
      const timePart = requeryTime.split("T")[1];
      if (timePart) {
        recordRecentTime(timePart);
      }

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

  /**
   * 切换预报节点间隔：重新采样并重新查询天气
   */
  async function handleIntervalChange(newInterval: ForecastInterval) {
    if (!data) return;
    setForecastInterval(newInterval);
    setIsResampling(true);
    try {
      // 根据新间隔重新采样
      let newSamplePoints: SamplePoint[];
      if (newInterval.type === "distance") {
        newSamplePoints = resamplePoints(
          data.allPoints,
          data.totalDistance,
          newInterval.km
        );
      } else {
        newSamplePoints = resampleByTime(
          data.allPoints,
          data.totalDistance,
          data.startTime,
          data.activityType,
          newInterval.minutes
        );
      }

      // 重新查询天气
      const weatherData = await queryWeather({
        name: data.name,
        samplePoints: newSamplePoints,
        allPoints: data.allPoints,
        startTime: data.startTime,
        activityType: data.activityType,
      });

      // 更新数据
      setData({
        ...data,
        samplePoints: newSamplePoints,
        segments: weatherData.advice.segments,
        summary: weatherData.advice.summary,
        overallAdvices: weatherData.advice.overall,
        routeId: weatherData.routeId ?? data.routeId,
      });
    } catch (err) {
      console.error("Resample failed:", err);
      alert(err instanceof Error ? err.message : "重新采样失败");
    } finally {
      setIsResampling(false);
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
              onClick={() => navigate("/compare")}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors"
            >
              🔀 对比视图
            </button>
            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown((v) => !v)}
                disabled={isExporting}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors flex items-center gap-1"
              >
                {isExporting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>📥 导出 <span className="text-xs">▼</span></>
                )}
              </button>
              {showExportDropdown && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={async () => {
                      setIsExporting(true);
                      try { await exportToImage("result-content"); } catch {}
                      setIsExporting(false);
                      setShowExportDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    📷 下载图片
                  </button>
                  <button
                    onClick={() => { exportToPDF(); setShowExportDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    📄 打印/保存PDF
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(generateOfflineSummary(data));
                        setCopiedText(true);
                        setTimeout(() => setCopiedText(false), 2000);
                      } catch {}
                      setShowExportDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {copiedText ? "✅ 已复制" : "📋 复制文本摘要"}
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowPoster(true)}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors"
            >
              🎨 生成海报
            </button>
            <button
              onClick={() => navigate("/history")}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors"
            >
              📋 历史记录
            </button>
          </div>
        </div>
      </header>

      {/* Extreme weather danger banner */}
      {data.overallAdvices.some((a) => a.level === "danger") && (
        <DangerBanner advices={data.overallAdvices} segments={data.segments} />
      )}

      {/* Main content */}
      <main id="result-content" className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                  <DateTimePicker
                    value={requeryTime}
                    onChange={handleRequeryTimeChange}
                  />
                </div>

                {/* Quick adjust buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "-1h", hours: -1, days: 0 },
                    { label: "+1h", hours: 1, days: 0 },
                    { label: "-1d", hours: 0, days: -1 },
                    { label: "+1d", hours: 0, days: 1 },
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
                        const d = new Date(year, month - 1, day + btn.days, hour + btn.hours, minute);
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
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              路线颜色反映各路段天气风险等级
            </p>
          </div>

          {/* Equipment recommendations */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <GearPanel items={gearItems} activityType={data.activityType} />
          </div>
        </div>

        {/* Data source attribution */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <details className="group">
            <summary className="cursor-pointer flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none">
              <span className="text-xs transition-transform group-open:rotate-90">▶</span>
              <span>ℹ️ 数据来源与查询说明</span>
            </summary>
            <div className="mt-3 pl-5 text-xs text-gray-500 dark:text-gray-400 space-y-2 leading-relaxed">
              <p>
                本应用的天气数据来自 <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Open-Meteo</a> 开源天气 API，该服务基于 ECMWF、DWD 等权威气象机构的数据模型，提供免费且开放的气象预报数据。
              </p>
              <p>查询的信息包括：</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>每日最高气温 / 最低气温（°C）</li>
                <li>降水概率（%）与累计降水量（mm）</li>
                <li>最大风速（km/h）与主导风向</li>
                <li>WMO 标准天气代码（用于判断天气状况与雷击风险）</li>
                <li>逐小时天气代码（用于到达时段雷击风险评估）</li>
              </ul>
              <p>
                系统根据轨迹采样点坐标与预计到达时间，查询对应位置与日期的天气预报数据，并结合到达时刻的逐小时数据进行精细化风险分析。
              </p>
            </div>
          </details>
        </div>

        {/* Weather table - full width */}
        <div className="lg:col-span-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h3 className="font-semibold text-gray-700 dark:text-gray-200">
              📋 沿途天气详情
            </h3>
            {/* 间隔选择器 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                节点间隔：
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    handleIntervalChange({ type: "distance", km: 1 })
                  }
                  disabled={isResampling}
                  className={`px-3 py-1 text-xs rounded-md border transition ${
                    forecastInterval.type === "distance" &&
                    forecastInterval.km === 1
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400"
                  } ${isResampling ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  1 km
                </button>
                <button
                  onClick={() =>
                    handleIntervalChange({ type: "distance", km: 5 })
                  }
                  disabled={isResampling}
                  className={`px-3 py-1 text-xs rounded-md border transition ${
                    forecastInterval.type === "distance" &&
                    forecastInterval.km === 5
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400"
                  } ${isResampling ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  5 km
                </button>
                <button
                  onClick={() =>
                    handleIntervalChange({ type: "time", minutes: 30 })
                  }
                  disabled={isResampling}
                  className={`px-3 py-1 text-xs rounded-md border transition ${
                    forecastInterval.type === "time"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400"
                  } ${isResampling ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  每30分钟
                </button>
              </div>
              {isResampling && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>更新中...</span>
                </div>
              )}
            </div>
          </div>
          <WeatherTable segments={data.segments} />
        </div>
      </main>

      {/* Poster Modal */}
      {showPoster && (
        <div
          className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4"
          onClick={() => setShowPoster(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-gray-900 dark:text-white">
                🎨 行程天气海报
              </h2>
              <button
                onClick={() => setShowPoster(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                ✕
              </button>
            </div>
            <PosterGenerator
              name={data.name}
              totalDistance={data.totalDistance}
              allPoints={data.allPoints}
              segments={data.segments}
              summary={data.summary}
              activityType={data.activityType}
              startTime={data.startTime}
            />
          </div>
        </div>
      )}
    </div>
  );
}
