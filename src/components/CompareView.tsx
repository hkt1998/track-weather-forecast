import { getWeatherIcon, getWeatherDescription } from "@/lib/weather-service";
import { SegmentRecord } from "@/lib/database";
import { RouteScore } from "@/lib/compare-engine";
import { ACTIVITY_TYPES } from "@/lib/gpx-parser";

export interface CompareRouteData {
  id: number;
  name: string;
  distance_km: number;
  activity_type: string | null;
  start_time: string | null;
  segments: SegmentRecord[];
}

interface CompareViewProps {
  routes: CompareRouteData[];
  scores: RouteScore[];
}

export default function CompareView({ routes, scores }: CompareViewProps) {
  const scoreMap = new Map(scores.map((s) => [s.routeId, s]));

  // Build aligned percentage rows (0%, 25%, 50%, 75%, 100%)
  const percentages = [0, 0.25, 0.5, 0.75, 1.0];

  function getSegmentAtPercent(
    segments: SegmentRecord[],
    totalDist: number,
    pct: number
  ): SegmentRecord | null {
    const targetDist = totalDist * pct;
    let closest: SegmentRecord | null = null;
    let minDiff = Infinity;
    for (const seg of segments) {
      const diff = Math.abs(seg.distance_km - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        closest = seg;
      }
    }
    return closest;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div
        className={`grid gap-4 ${
          routes.length === 2
            ? "grid-cols-1 md:grid-cols-2"
            : routes.length === 3
            ? "grid-cols-1 md:grid-cols-3"
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {routes.map((route) => {
          const score = scoreMap.get(route.id);
          const activity = route.activity_type
            ? ACTIVITY_TYPES.find((a) => a.id === route.activity_type)
            : null;
          const segs = route.segments;

          const temps = segs.map((s) => s.temp_max).filter((t): t is number => t != null);
          const minTemps = segs.map((s) => s.temp_min).filter((t): t is number => t != null);
          const maxPrecip = Math.max(
            ...segs.map((s) => s.precip_prob ?? 0)
          );
          const maxWind = Math.max(
            ...segs.map((s) => s.wind_speed_max ?? 0)
          );

          return (
            <div
              key={route.id}
              className={`relative bg-white dark:bg-gray-900 rounded-xl border-2 p-4 transition-all ${
                score?.isRecommended
                  ? "border-green-500 shadow-lg shadow-green-100 dark:shadow-green-900/20"
                  : "border-gray-200 dark:border-gray-800"
              }`}
            >
              {score?.isRecommended && (
                <div className="absolute -top-3 left-4 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                  推荐
                </div>
              )}

              {/* Name and rank */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white truncate">
                    {route.name}
                  </h3>
                  <div className="flex gap-2 text-xs text-gray-500 mt-0.5">
                    <span>📏 {route.distance_km} km</span>
                    {activity && (
                      <span>
                        {activity.icon} {activity.label}
                      </span>
                    )}
                  </div>
                </div>
                {score && (
                  <div className="text-right">
                    <div
                      className={`text-2xl font-bold ${
                        score.avgScore >= 80
                          ? "text-green-500"
                          : score.avgScore >= 60
                          ? "text-amber-500"
                          : "text-red-500"
                      }`}
                    >
                      {score.avgScore}
                    </div>
                    <div className="text-xs text-gray-400">分</div>
                  </div>
                )}
              </div>

              {/* Weather summary */}
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400 mb-3">
                <div className="flex items-center gap-1">
                  🌡️
                  <span>
                    {minTemps.length > 0 ? Math.min(...minTemps) : "-"} ~{" "}
                    {temps.length > 0 ? Math.max(...temps) : "-"}°C
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  🌧️ <span>降水 {Math.round(maxPrecip)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  💨 <span>风速 {Math.round(maxWind)}km/h</span>
                </div>
                <div className="flex items-center gap-1">
                  🏅 <span>第 {score?.rank ?? "-"} 名</span>
                </div>
              </div>

              {/* Highlights */}
              {score && score.highlights.length > 0 && (
                <div className="space-y-1">
                  {score.highlights.map((h, i) => (
                    <div
                      key={i}
                      className="text-xs px-2 py-0.5 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 rounded"
                    >
                      {h}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs">
                位置
              </th>
              {routes.map((route) => {
                const score = scoreMap.get(route.id);
                return (
                  <th
                    key={route.id}
                    className="text-center px-4 py-3 font-medium text-xs"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          score?.isRecommended ? "ring-2 ring-green-300" : ""
                        }`}
                        style={{
                          backgroundColor: getRouteColor(
                            routes.indexOf(route)
                          ),
                        }}
                      />
                      <span className="text-gray-700 dark:text-gray-300 truncate max-w-[100px]">
                        {route.name}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {percentages.map((pct) => {
              const pctLabel =
                pct === 0
                  ? "起点"
                  : pct === 1
                  ? "终点"
                  : `${Math.round(pct * 100)}%`;

              return (
                <tr
                  key={pct}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <td className="px-4 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">
                    {pctLabel}
                  </td>
                  {routes.map((route) => {
                    const seg = getSegmentAtPercent(
                      route.segments,
                      route.distance_km,
                      pct
                    );
                    const isDanger = seg?.advice_level === "danger";
                    const isWarning = seg?.advice_level === "warning";

                    return (
                      <td
                        key={route.id}
                        className={`text-center px-4 py-3 ${
                          isDanger
                            ? "bg-red-50 dark:bg-red-950/30"
                            : isWarning
                            ? "bg-amber-50 dark:bg-amber-950/20"
                            : ""
                        }`}
                      >
                        {seg && seg.wmo_code != null ? (
                          <div className="text-xs space-y-0.5">
                            <div className="text-lg">
                              {getWeatherIcon(seg.wmo_code)}
                            </div>
                            <div className="text-gray-600 dark:text-gray-400">
                              {getWeatherDescription(seg.wmo_code)}
                            </div>
                            <div className="text-gray-500">
                              {seg.temp_max ?? "-"}° / {seg.temp_min ?? "-"}°
                            </div>
                            <div className="flex justify-center gap-2 text-gray-400">
                              <span>🌧️{Math.round(seg.precip_prob ?? 0)}%</span>
                              <span>
                                💨{Math.round(seg.wind_speed_max ?? 0)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">
                            暂无数据
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ROUTE_COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#8b5cf6"];

export function getRouteColor(index: number): string {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}
