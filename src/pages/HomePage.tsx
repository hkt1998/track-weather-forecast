import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import FileUpload from "@/components/FileUpload";
import TripSettings from "@/components/TripSettings";
import {
  TrackPoint,
  SamplePoint,
  parseGpx,
} from "@/lib/gpx-parser";
import { queryWeather } from "@/lib/weather-query";

type AppState =
  | { status: "idle" }
  | { status: "parsing"; loadingText: string }
  | { status: "settings"; parsedData: ParsedData }
  | { status: "weather"; loadingText: string }
  | { status: "error"; message: string };

interface ParsedData {
  name: string;
  totalDistance: number;
  pointCount: number;
  allPoints: TrackPoint[];
  samplePoints: SamplePoint[];
}

export default function HomePage() {
  const navigate = useNavigate();
  const [state, setState] = useState<AppState>({ status: "idle" });

  // Step 1: Parse GPX file in browser
  const handleFileSelected = useCallback(async (file: File) => {
    try {
      setState({ status: "parsing", loadingText: "正在解析 GPX 文件..." });

      if (!file.name.toLowerCase().endsWith(".gpx")) {
        throw new Error("请上传 .gpx 格式的文件");
      }

      const xmlString = await file.text();
      const result = parseGpx(xmlString);

      // Limit allPoints to 2000 for rendering performance
      const limitedPoints =
        result.allPoints.length > 2000
          ? result.allPoints.filter(
              (_, i) =>
                i % Math.ceil(result.allPoints.length / 2000) === 0
            )
          : result.allPoints;

      setState({
        status: "settings",
        parsedData: {
          name: result.name,
          totalDistance: result.totalDistance,
          pointCount: result.allPoints.length,
          allPoints: limitedPoints,
          samplePoints: result.samplePoints,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "解析失败，请重试";
      setState({ status: "error", message });
    }
  }, []);

  // Step 2: User confirms settings -> fetch weather
  const handleConfirmSettings = useCallback(
    async (startTime: string, activityType: string) => {
      if (state.status !== "settings") return;
      const { parsedData } = state;

      try {
        setState({ status: "weather", loadingText: "正在获取沿途天气..." });

        const weatherData = await queryWeather({
          name: parsedData.name,
          samplePoints: parsedData.samplePoints,
          allPoints: parsedData.allPoints,
          startTime,
          activityType,
        });

        // Store results in sessionStorage and navigate
        sessionStorage.setItem(
          "gpx-result",
          JSON.stringify({
            name: parsedData.name,
            totalDistance: parsedData.totalDistance,
            pointCount: parsedData.pointCount,
            allPoints: parsedData.allPoints,
            samplePoints: parsedData.samplePoints,
            startTime,
            activityType,
            weather: weatherData.weather,
            advice: weatherData.advice,
            routeId: weatherData.routeId,
          })
        );

        navigate("/result");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "处理失败，请重试";
        setState({ status: "error", message });
        // Restore settings state after error
        setTimeout(() => {
          setState({ status: "settings", parsedData: state.parsedData });
        }, 0);
      }
    },
    [state, navigate]
  );

  const handleBack = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return (
    <div className="min-h-[calc(100vh-52px)] flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 px-4 py-8">
      <div className="w-full max-w-xl space-y-8">
        {/* Header - always visible */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            🗺️ GPX 天气助手
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            上传你的出行轨迹，预测沿途天气
          </p>
        </div>

        {/* Step 1: Upload */}
        {(state.status === "idle" || state.status === "parsing") && (
          <>
            <FileUpload
              onFileSelected={handleFileSelected}
              isLoading={state.status === "parsing"}
              loadingText="正在解析 GPX 文件..."
            />
            <div className="text-center text-sm text-gray-400 dark:text-gray-500 space-y-1">
              <p>支持从 Strava、佳明、两步路等导出的 GPX 文件</p>
              <p>轨迹越长，采样点越多，分析越准确</p>
            </div>
            {/* Entry card for history/compare */}
            <Link
              to="/history"
              className="block mt-4 p-4 bg-white/60 dark:bg-gray-800/60 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors text-center group"
            >
              <p className="text-gray-600 dark:text-gray-400 group-hover:text-blue-500 transition-colors">
                📋 查看历史记录 / 多路线天气对比
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                选择多条历史轨迹，对比各路线天气情况
              </p>
            </Link>
          </>
        )}

        {/* Step 2: Settings */}
        {state.status === "settings" && (
          <TripSettings
            trackSummary={{
              name: state.parsedData.name,
              totalDistance: state.parsedData.totalDistance,
              pointCount: state.parsedData.pointCount,
              sampleCount: state.parsedData.samplePoints.length,
            }}
            onConfirm={handleConfirmSettings}
            onBack={handleBack}
            isLoading={false}
          />
        )}

        {/* Loading weather */}
        {state.status === "weather" && (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              正在获取沿途天气...
            </p>
            <p className="text-sm text-gray-500 mt-1">这可能需要几秒钟</p>
          </div>
        )}

        {/* Error */}
        {state.status === "error" && (
          <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-center">
            <p className="text-red-600 dark:text-red-400 text-sm">
              ❌ {state.message}
            </p>
            <button
              onClick={() => setState({ status: "idle" })}
              className="mt-2 text-sm text-red-500 underline"
            >
              重新开始
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
