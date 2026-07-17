import { Suspense, useEffect, useState, lazy } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CompareView, {
  CompareRouteData,
  getRouteColor,
} from "@/components/CompareView";
import { compareRoutes, RouteScore } from "@/lib/compare-engine";
import { TrackPoint } from "@/lib/gpx-parser";
import { getRouteById } from "@/lib/database";
import { SegmentRecord } from "@/lib/database";

const CompareMap = lazy(() => import("@/components/CompareMap"));

export default function ComparePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [routes, setRoutes] = useState<CompareRouteData[]>([]);
  const [scores, setScores] = useState<RouteScore[]>([]);
  const [mapRoutes, setMapRoutes] = useState<
    Array<{
      id: number;
      name: string;
      color: string;
      allPoints: TrackPoint[];
      segments: SegmentRecord[];
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const idsStr = searchParams.get("ids");
    if (!idsStr) {
      setError("未选择对比路线");
      setLoading(false);
      return;
    }

    const ids = idsStr
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    if (ids.length < 2) {
      setError("至少需要选择 2 条路线");
      setLoading(false);
      return;
    }

    async function fetchAll() {
      try {
        setLoading(true);
        const results = await Promise.all(
          ids.map(async (id) => {
            const route = await getRouteById(id);
            if (!route) throw new Error(`获取路线 ${id} 失败`);
            return route;
          })
        );

        const routeData: CompareRouteData[] = results.map((r) => ({
          id: r.id,
          name: r.name,
          distance_km: r.distance_km,
          activity_type: r.activity_type,
          start_time: r.start_time,
          segments: r.segments,
        }));

        const mapLayers = results.map((r, i) => {
          let allPoints: TrackPoint[] = [];
          try {
            allPoints = JSON.parse(r.all_points_json);
          } catch {
            // ignore
          }
          return {
            id: r.id,
            name: r.name,
            color: getRouteColor(i),
            allPoints,
            segments: r.segments,
          };
        });

        setRoutes(routeData);
        setMapRoutes(mapLayers);

        // Run comparison
        const compResults = compareRoutes(
          results.map((r) => ({
            id: r.id,
            name: r.name,
            segments: r.segments,
          }))
        );
        setScores(compResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载数据失败");
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-52px)] flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-3 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">正在加载对比数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-52px)] flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center space-y-4">
          <p className="text-red-500">{error}</p>
          <button
            onClick={() => navigate("/history")}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            返回历史记录
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
              onClick={() => navigate("/history")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="返回历史记录"
            >
              ←
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              🔍 路线天气对比
            </h1>
          </div>
          <span className="text-sm text-gray-400">
            {routes.length} 条路线
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Summary cards + table */}
        <CompareView routes={routes} scores={scores} />

        {/* Map */}
        {mapRoutes.length > 0 && (
          <div className="h-[500px] lg:h-[600px]">
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
              <CompareMap routes={mapRoutes} />
            </Suspense>
          </div>
        )}

        {/* Data source attribution */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
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

        {/* Weather legend */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2 text-sm">
            🎨 图例说明
          </h3>
          <div className="flex flex-wrap gap-4 text-xs">
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
      </main>
    </div>
  );
}
