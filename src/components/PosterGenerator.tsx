import { useRef, useState, useMemo, useEffect, forwardRef } from "react";
import { toPng } from "html-to-image";
import { TrackPoint, ACTIVITY_TYPES } from "@/lib/gpx-parser";
import { SegmentAdvice } from "@/lib/advice-engine";
import {
  DailyWeather,
  getWeatherIcon,
  getWeatherDescription,
  getBeaufortScale,
  getBeaufortLabel,
} from "@/lib/weather-service";

type TemplateStyle = "sport" | "minimal" | "data";

interface PosterGeneratorProps {
  name?: string;
  totalDistance?: number;
  allPoints?: TrackPoint[];
  segments?: SegmentAdvice[];
  summary?: string;
  activityType?: string;
  startTime?: string;
}

const TEMPLATE_LABELS: Record<TemplateStyle, string> = {
  sport: "运动风",
  minimal: "简约风",
  data: "数据风",
};

interface SessionData {
  name: string;
  totalDistance: number;
  allPoints: TrackPoint[];
  segments: SegmentAdvice[];
  summary: string;
  activityType: string;
  startTime: string;
}

function loadFromSession(): SessionData | null {
  try {
    const stored = sessionStorage.getItem("gpx-result");
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return {
      name: parsed.name ?? "",
      totalDistance: parsed.totalDistance ?? 0,
      allPoints: parsed.allPoints ?? [],
      segments: parsed.advice?.segments ?? [],
      summary: parsed.advice?.summary ?? "",
      activityType: parsed.activityType ?? "",
      startTime: parsed.startTime ?? "",
    };
  } catch {
    return null;
  }
}

export default function PosterGenerator(props: PosterGeneratorProps) {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  useEffect(() => {
    // If no props provided, try loading from sessionStorage
    if (!props.name && !props.allPoints) {
      setSessionData(loadFromSession());
    }
  }, []);

  const name = props.name ?? sessionData?.name ?? "";
  const totalDistance = props.totalDistance ?? sessionData?.totalDistance ?? 0;
  const allPoints = props.allPoints ?? sessionData?.allPoints ?? [];
  const segments = props.segments ?? sessionData?.segments ?? [];
  const summary = props.summary ?? sessionData?.summary ?? "";
  const activityType = props.activityType ?? sessionData?.activityType ?? "";
  const startTime = props.startTime ?? sessionData?.startTime ?? "";

  const posterRef = useRef<HTMLDivElement>(null);
  const [template, setTemplate] = useState<TemplateStyle>("sport");
  const [downloading, setDownloading] = useState(false);

  const activity = ACTIVITY_TYPES.find((a) => a.id === activityType);
  const activityIcon = activity?.icon ?? "🚶";
  const activityLabel = activity?.label ?? "未知";

  const dateStr = startTime
    ? new Date(startTime).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("zh-CN");

  // --- Weather statistics ---
  const weathers = useMemo(
    () => segments.map((s) => s.weather).filter((w): w is DailyWeather => w != null),
    [segments]
  );

  const stats = useMemo(() => {
    if (weathers.length === 0) return null;
    const temps = weathers.flatMap((w) => [w.tempMax, w.tempMin]);
    const maxTemp = Math.max(...temps);
    const minTemp = Math.min(...temps);
    const maxPrecipProb = Math.max(...weathers.map((w) => w.precipitationProbability));
    const maxWind = Math.max(...weathers.map((w) => w.windSpeedMax));
    const codes = [...new Set(weathers.map((w) => getWeatherDescription(w.weatherCode)))];
    return { maxTemp, minTemp, maxPrecipProb, maxWind, codes };
  }, [weathers]);

  // --- SVG route path ---
  const routePath = useMemo(() => {
    if (allPoints.length < 2) return null;
    const lats = allPoints.map((p) => p.lat);
    const lons = allPoints.map((p) => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const latRange = maxLat - minLat || 1;
    const lonRange = maxLon - minLon || 1;

    const svgW = 360;
    const svgH = 180;
    const pad = 16;
    const drawW = svgW - pad * 2;
    const drawH = svgH - pad * 2;

    // Downsample for performance: max 300 points
    const step = Math.max(1, Math.floor(allPoints.length / 300));
    const pts: string[] = [];
    for (let i = 0; i < allPoints.length; i += step) {
      const p = allPoints[i];
      const x = pad + ((p.lon - minLon) / lonRange) * drawW;
      const y = pad + (1 - (p.lat - minLat) / latRange) * drawH;
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    // Ensure last point is included
    const last = allPoints[allPoints.length - 1];
    const lx = pad + ((last.lon - minLon) / lonRange) * drawW;
    const ly = pad + (1 - (last.lat - minLat) / latRange) * drawH;

    const first = allPoints[0];
    const fx = pad + ((first.lon - minLon) / lonRange) * drawW;
    const fy = pad + (1 - (first.lat - minLat) / latRange) * drawH;

    return {
      d: pts.join(" ") + ` L${lx.toFixed(1)},${ly.toFixed(1)}`,
      startX: fx,
      startY: fy,
      endX: lx,
      endY: ly,
      svgW,
      svgH,
    };
  }, [allPoints]);

  // --- Download handler ---
  async function handleDownload() {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: template === "data" ? "#0f172a" : undefined,
      });
      const link = document.createElement("a");
      link.download = `行程海报_${name}_${dateStr}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Poster export failed:", err);
      alert("海报导出失败，请重试");
    } finally {
      setDownloading(false);
    }
  }

  const isEmpty = allPoints.length === 0 || segments.length === 0;

  return (
    <div className="space-y-4">
      {/* Template tabs + download */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          {(Object.keys(TEMPLATE_LABELS) as TemplateStyle[]).map((key) => (
            <button
              key={key}
              onClick={() => setTemplate(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                template === key
                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {TEMPLATE_LABELS[key]}
            </button>
          ))}
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading || isEmpty}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            downloading || isEmpty
              ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          }`}
        >
          {downloading ? "导出中..." : "📥 下载海报"}
        </button>
      </div>

      {/* Poster container */}
      <div className="flex justify-center">
        {template === "sport" && (
          <SportPoster
            ref={posterRef}
            name={name}
            dateStr={dateStr}
            activityIcon={activityIcon}
            activityLabel={activityLabel}
            totalDistance={totalDistance}
            routePath={routePath}
            segments={segments}
            stats={stats}
            weathers={weathers}
            isEmpty={isEmpty}
          />
        )}
        {template === "minimal" && (
          <MinimalPoster
            ref={posterRef}
            name={name}
            dateStr={dateStr}
            activityIcon={activityIcon}
            activityLabel={activityLabel}
            totalDistance={totalDistance}
            routePath={routePath}
            segments={segments}
            stats={stats}
            weathers={weathers}
            isEmpty={isEmpty}
          />
        )}
        {template === "data" && (
          <DataPoster
            ref={posterRef}
            name={name}
            dateStr={dateStr}
            activityIcon={activityIcon}
            activityLabel={activityLabel}
            totalDistance={totalDistance}
            routePath={routePath}
            segments={segments}
            stats={stats}
            weathers={weathers}
            isEmpty={isEmpty}
            summary={summary}
          />
        )}
      </div>
    </div>
  );
}

// ============ Shared types for sub-components ============
interface PosterContentProps {
  name: string;
  dateStr: string;
  activityIcon: string;
  activityLabel: string;
  totalDistance: number;
  routePath: {
    d: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    svgW: number;
    svgH: number;
  } | null;
  segments: SegmentAdvice[];
  stats: {
    maxTemp: number;
    minTemp: number;
    maxPrecipProb: number;
    maxWind: number;
    codes: string[];
  } | null;
  weathers: DailyWeather[];
  isEmpty: boolean;
  summary?: string;
}

const SportPoster = forwardRef<HTMLDivElement, PosterContentProps>(
  ({ name, dateStr, activityIcon, activityLabel, totalDistance, routePath, segments, stats, isEmpty }, ref) => (
    <div
      ref={ref}
      className="w-[400px] rounded-2xl overflow-hidden shadow-xl"
      style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 40%, #10b981 100%)" }}
    >
      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* Header */}
          <div className="px-6 pt-6 pb-3">
            <div className="flex items-center gap-2 text-white/80 text-xs mb-1">
              <span>{activityIcon}</span>
              <span>{activityLabel}</span>
              <span className="mx-1">·</span>
              <span>{dateStr}</span>
            </div>
            <h2 className="text-white text-xl font-black tracking-wide leading-tight truncate">
              {name}
            </h2>
          </div>

          {/* SVG Route */}
          <div className="px-4">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3">
              {routePath ? (
                <svg
                  viewBox={`0 0 ${routePath.svgW} ${routePath.svgH}`}
                  className="w-full"
                  style={{ height: 180 }}
                >
                  <defs>
                    <linearGradient id="sport-route" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                  <path
                    d={routePath.d}
                    fill="none"
                    stroke="url(#sport-route)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx={routePath.startX} cy={routePath.startY} r="5" fill="#22c55e" stroke="#fff" strokeWidth="2" />
                  <circle cx={routePath.endX} cy={routePath.endY} r="5" fill="#ef4444" stroke="#fff" strokeWidth="2" />
                  <text x={routePath.startX + 8} y={routePath.startY + 4} fill="#fff" fontSize="10" fontWeight="bold">起点</text>
                  <text x={routePath.endX + 8} y={routePath.endY + 4} fill="#fff" fontSize="10" fontWeight="bold">终点</text>
                </svg>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-white/60 text-sm">路线数据不可用</div>
              )}
            </div>
          </div>

          {/* Weather timeline */}
          <WeatherTimeline segments={segments} variant="light" />

          {/* Bottom stats */}
          <div className="px-6 py-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <StatBox label="总距离" value={`${totalDistance}km`} light />
              <StatBox
                label="温度"
                value={stats ? `${stats.minTemp}~${stats.maxTemp}°` : "-"}
                light
              />
              <StatBox
                label="降水概率"
                value={stats ? `${stats.maxPrecipProb}%` : "-"}
                light
              />
              <StatBox
                label="采样点"
                value={`${segments.length}`}
                light
              />
            </div>
          </div>

          {/* Watermark */}
          <div className="text-center text-white/40 text-[10px] pb-3">
            TrackWeather · {dateStr}
          </div>
        </>
      )}
    </div>
  )
);
SportPoster.displayName = "SportPoster";

// ============ MINIMAL TEMPLATE ============
const MinimalPoster = forwardRef<HTMLDivElement, PosterContentProps>(
  ({ name, dateStr, activityIcon, activityLabel, totalDistance, routePath, segments, stats, isEmpty }, ref) => (
    <div
      ref={ref}
      className="w-[400px] rounded-2xl overflow-hidden shadow-xl bg-white"
    >
      {isEmpty ? (
        <EmptyState dark />
      ) : (
        <>
          {/* Header */}
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
              <span>{activityIcon}</span>
              <span>{activityLabel}</span>
              <span className="mx-1">·</span>
              <span>{dateStr}</span>
            </div>
            <h2 className="text-gray-900 text-xl font-bold tracking-wide leading-tight truncate">
              {name}
            </h2>
            <div className="mt-2 h-px bg-gray-200" />
          </div>

          {/* SVG Route */}
          <div className="px-6 py-2">
            {routePath ? (
              <svg
                viewBox={`0 0 ${routePath.svgW} ${routePath.svgH}`}
                className="w-full"
                style={{ height: 180 }}
              >
                <path
                  d={routePath.d}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={routePath.startX} cy={routePath.startY} r="4" fill="#22c55e" />
                <circle cx={routePath.endX} cy={routePath.endY} r="4" fill="#ef4444" />
                <text x={routePath.startX + 8} y={routePath.startY + 4} fill="#64748b" fontSize="10">起点</text>
                <text x={routePath.endX + 8} y={routePath.endY + 4} fill="#64748b" fontSize="10">终点</text>
              </svg>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-gray-300 text-sm">路线数据不可用</div>
            )}
          </div>

          {/* Weather timeline */}
          <WeatherTimeline segments={segments} variant="dark" />

          {/* Bottom stats */}
          <div className="px-6 py-4">
            <div className="flex justify-between text-center border-t border-gray-100 pt-4">
              <StatBox label="距离" value={`${totalDistance}km`} />
              <StatBox label="温度" value={stats ? `${stats.minTemp}~${stats.maxTemp}°` : "-"} />
              <StatBox label="降水" value={stats ? `${stats.maxPrecipProb}%` : "-"} />
              <StatBox label="节点" value={`${segments.length}`} />
            </div>
          </div>

          {/* Watermark */}
          <div className="text-center text-gray-300 text-[10px] pb-3">
            TrackWeather · {dateStr}
          </div>
        </>
      )}
    </div>
  )
);
MinimalPoster.displayName = "MinimalPoster";

// ============ DATA TEMPLATE ============
const DataPoster = forwardRef<HTMLDivElement, PosterContentProps>(
  ({ name, dateStr, activityIcon, activityLabel, totalDistance, routePath, segments, stats, isEmpty, summary }, ref) => {
    const maxBeaufort = stats ? getBeaufortScale(stats.maxWind) : 0;
    const beaufortLabel = stats ? getBeaufortLabel(maxBeaufort) : "";

    return (
      <div
        ref={ref}
        className="w-[400px] rounded-2xl overflow-hidden shadow-xl"
        style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)" }}
      >
        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-400 text-xs">
                  <span className="text-lg">{activityIcon}</span>
                  <span className="font-mono">{activityLabel}</span>
                </div>
                <span className="text-slate-500 text-xs font-mono">{dateStr}</span>
              </div>
              <h2 className="text-white text-lg font-bold mt-1 truncate">{name}</h2>
            </div>

            {/* Data grid top */}
            <div className="px-6 pb-3">
              <div className="grid grid-cols-4 gap-2">
                <DataCell label="DIST" value={`${totalDistance}`} unit="km" />
                <DataCell label="TEMP" value={stats ? `${stats.minTemp}~${stats.maxTemp}` : "-"} unit="°C" />
                <DataCell label="PRECIP" value={stats ? `${stats.maxPrecipProb}` : "-"} unit="%" />
                <DataCell label="WIND" value={stats ? `${beaufortLabel}` : "-"} unit={`${maxBeaufort}级`} />
              </div>
            </div>

            {/* SVG Route */}
            <div className="px-4 pb-2">
              <div className="border border-slate-700 rounded-lg p-2 bg-slate-800/50">
                {routePath ? (
                  <svg
                    viewBox={`0 0 ${routePath.svgW} ${routePath.svgH}`}
                    className="w-full"
                    style={{ height: 150 }}
                  >
                    <defs>
                      <linearGradient id="data-route" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <path
                      d={routePath.d}
                      fill="none"
                      stroke="url(#data-route)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx={routePath.startX} cy={routePath.startY} r="4" fill="#22c55e" stroke="#0f172a" strokeWidth="2" />
                    <circle cx={routePath.endX} cy={routePath.endY} r="4" fill="#ef4444" stroke="#0f172a" strokeWidth="2" />
                  </svg>
                ) : (
                  <div className="h-[150px] flex items-center justify-center text-slate-600 text-sm">NO DATA</div>
                )}
              </div>
            </div>

            {/* Weather timeline */}
            <WeatherTimeline segments={segments} variant="dark-bg" />

            {/* Weather code summary */}
            {stats && (
              <div className="px-6 py-2">
                <div className="flex flex-wrap gap-1">
                  {stats.codes.map((code, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-[10px] font-mono bg-slate-700 text-slate-300 rounded"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {summary && (
              <div className="px-6 py-2">
                <p className="text-slate-400 text-[10px] leading-relaxed line-clamp-3">{summary}</p>
              </div>
            )}

            {/* Bottom bar */}
            <div className="px-6 py-3 flex items-center justify-between border-t border-slate-700/50">
              <span className="text-slate-500 text-[10px] font-mono">
                SAMPLES: {segments.length}
              </span>
              <span className="text-slate-600 text-[10px] font-mono">
                TrackWeather · {dateStr}
              </span>
            </div>
          </>
        )}
      </div>
    );
  }
);
DataPoster.displayName = "DataPoster";

// ============ Shared sub-components ============

function EmptyState({ dark }: { dark?: boolean }) {
  return (
    <div className={`h-[500px] flex flex-col items-center justify-center gap-2 ${dark ? "text-gray-400" : "text-white/60"}`}>
      <span className="text-4xl">🗺️</span>
      <span className="text-sm">暂无数据，请先上传轨迹文件</span>
    </div>
  );
}

function StatBox({
  label,
  value,
  light,
}: {
  label: string;
  value: string;
  light?: boolean;
}) {
  return (
    <div>
      <div className={`text-[10px] ${light ? "text-white/60" : "text-gray-400"}`}>{label}</div>
      <div className={`text-sm font-bold ${light ? "text-white" : "text-gray-800"}`}>{value}</div>
    </div>
  );
}

function DataCell({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="text-center bg-slate-800/60 rounded-lg py-2">
      <div className="text-cyan-400/70 text-[9px] font-mono tracking-wider">{label}</div>
      <div className="text-white text-sm font-bold font-mono">{value}</div>
      <div className="text-slate-500 text-[9px]">{unit}</div>
    </div>
  );
}

function WeatherTimeline({
  segments,
  variant,
}: {
  segments: SegmentAdvice[];
  variant: "light" | "dark" | "dark-bg";
}) {
  const withWeather = segments.filter((s) => s.weather != null);
  if (withWeather.length === 0) return null;

  // Show max 10 evenly spaced points
  const maxShow = 10;
  const step = Math.max(1, Math.floor(withWeather.length / maxShow));
  const shown: SegmentAdvice[] = [];
  for (let i = 0; i < withWeather.length; i += step) {
    shown.push(withWeather[i]);
  }
  // Always include last
  const lastSeg = withWeather[withWeather.length - 1];
  if (shown[shown.length - 1] !== lastSeg) shown.push(lastSeg);

  const textColor =
    variant === "light"
      ? "text-white/80"
      : variant === "dark"
      ? "text-gray-500"
      : "text-slate-400";
  const tempColor =
    variant === "light" ? "text-white" : variant === "dark" ? "text-gray-800" : "text-white";

  return (
    <div className="px-4 py-3">
      <div className="flex justify-between items-end gap-0.5 overflow-hidden">
        {shown.map((seg, i) => {
          const w = seg.weather!;
          return (
            <div key={i} className="flex flex-col items-center min-w-0 flex-1">
              <span className="text-lg leading-none">{getWeatherIcon(w.weatherCode)}</span>
              <span className={`text-[10px] font-bold mt-0.5 ${tempColor}`}>
                {Math.round(w.tempMax)}°
              </span>
              <span className={`text-[9px] ${textColor}`}>
                {seg.distanceKm}km
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
