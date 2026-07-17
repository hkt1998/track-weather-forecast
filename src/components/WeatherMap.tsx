import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TrackPoint } from "@/lib/gpx-parser";
import {
  getWeatherDescription,
  getWeatherIcon,
  getWindDirectionLabel,
  getWindDirectionArrow,
  getBeaufortScale,
  getBeaufortLabel,
} from "@/lib/weather-service";
import { SegmentAdvice } from "@/lib/advice-engine";
import HourlyChart from "@/components/HourlyChart";

type ColorDimension = "composite" | "precipitation" | "wind" | "temperature";

const DIMENSION_LABELS: Record<ColorDimension, string> = {
  composite: "综合",
  precipitation: "降水",
  wind: "风力",
  temperature: "温度",
};

function getSegmentColor(
  seg: SegmentAdvice,
  dimension: ColorDimension
): string {
  if (dimension === "composite") {
    const hasDanger = seg.advices.some((a) => a.level === "danger");
    const hasWarning = seg.advices.some((a) => a.level === "warning");
    return hasDanger ? "#ef4444" : hasWarning ? "#f59e0b" : "#22c55e";
  }
  if (!seg.weather) return "#22c55e";
  const w = seg.weather;
  if (dimension === "precipitation") {
    if (w.precipitationProbability > 70) return "#ef4444";
    if (w.precipitationProbability > 40) return "#f59e0b";
    return "#22c55e";
  }
  if (dimension === "wind") {
    const beaufort = getBeaufortScale(w.windSpeedMax);
    if (beaufort >= 7) return "#ef4444";
    if (beaufort >= 4) return "#f59e0b";
    return "#22c55e";
  }
  if (dimension === "temperature") {
    if (w.tempMax >= 35 || w.tempMin <= 0) return "#ef4444";
    if (w.tempMax >= 30 || w.tempMin <= 5) return "#f59e0b";
    return "#22c55e";
  }
  return "#22c55e";
}

interface WeatherMapProps {
  allPoints: TrackPoint[];
  segments: SegmentAdvice[];
}

export default function WeatherMap({
  allPoints,
  segments,
}: WeatherMapProps) {
  const [dimension, setDimension] = useState<ColorDimension>("composite");

  const positions: [number, number][] = allPoints.map((p) => [
    p.lat,
    p.lon,
  ]);

  // Calculate center and bounds
  const center: [number, number] =
    positions.length > 0
      ? [
          allPoints.reduce((s, p) => s + p.lat, 0) / allPoints.length,
          allPoints.reduce((s, p) => s + p.lon, 0) / allPoints.length,
        ]
      : [39.9, 116.4];

  const latLngs = positions.map(([lat, lon]) => L.latLng(lat, lon));
  const bounds =
    latLngs.length > 0
      ? L.latLngBounds(latLngs)
      : L.latLngBounds([L.latLng(39.9, 116.4)]);

  return (
    <div className="relative w-full h-full">
      {/* Dimension switcher */}
      {segments.length > 0 && (
        <div className="absolute top-2 left-2 z-[1000] flex gap-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur rounded-lg shadow px-1.5 py-1">
          {(
            ["composite", "precipitation", "wind", "temperature"] as ColorDimension[]
          ).map((d) => (
            <button
              key={d}
              onClick={() => setDimension(d)}
              className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                dimension === d
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {DIMENSION_LABELS[d]}
            </button>
          ))}
        </div>
      )}

      <MapContainer
        bounds={bounds}
        center={center}
        zoom={10}
        className="w-full h-full rounded-xl z-0"
        style={{ minHeight: "400px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CartoDB</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Track line — segmented coloring or fallback */}
        {segments.length > 0
          ? segments.map((seg, idx) => {
              const startIdx = seg.pointIndex;
              const endIdx =
                idx + 1 < segments.length
                  ? segments[idx + 1].pointIndex
                  : allPoints.length - 1;
              const segPositions: [number, number][] = [];
              for (let i = startIdx; i <= endIdx; i++) {
                segPositions.push([allPoints[i].lat, allPoints[i].lon]);
              }
              return (
                <Polyline
                  key={`seg-${idx}`}
                  positions={segPositions}
                  pathOptions={{
                    color: getSegmentColor(seg, dimension),
                    weight: 4,
                    opacity: 0.85,
                  }}
                />
              );
            })
          : (
              <Polyline
                positions={positions}
                pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.8 }}
              />
            )}

      {/* Sample point markers */}
      {segments.map((seg, idx) => {
        const w = seg.weather;
        const hasDanger = seg.advices.some((a) => a.level === "danger");
        const hasWarning = seg.advices.some((a) => a.level === "warning");
        const fillColor = hasDanger
          ? "#ef4444"
          : hasWarning
          ? "#f59e0b"
          : "#22c55e";

        return (
          <CircleMarker
            key={idx}
            center={[seg.lat, seg.lon]}
            radius={8}
            pathOptions={{
              color: "#fff",
              weight: 2,
              fillColor,
              fillOpacity: 0.9,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <span className="text-xs">
                {seg.arrivalTime && `⏰${seg.arrivalTime} `}
                {w
                  ? `${getWeatherIcon(w.weatherCode)} ${w.tempMax}°C`
                  : "暂无天气数据"}
              </span>
            </Tooltip>
            <Popup>
              <div className="min-w-[200px] text-sm">
                <div className="font-bold text-base border-b pb-1 mb-2">
                  📍 采样点 {idx + 1}
                  <span className="text-xs font-normal text-gray-500 ml-1">
                    ({seg.distanceKm} km)
                  </span>
                </div>

                {/* Arrival time */}
                {seg.arrivalDate && (
                  <div className="text-xs text-gray-500 mb-2">
                    🕐 预计到达：{seg.arrivalDate} {seg.arrivalTime}
                  </div>
                )}

                {w ? (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">
                        {getWeatherIcon(w.weatherCode)}
                      </span>
                      <div>
                        <div className="font-medium">
                          {getWeatherDescription(w.weatherCode)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {w.date}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                      <div>🌡️ 最高 {w.tempMax}°C</div>
                      <div>🌡️ 最低 {w.tempMin}°C</div>
                      <div>🌧️ 概率 {w.precipitationProbability}%</div>
                      <div>💧 降水量 {w.precipitationSum.toFixed(1)}mm</div>
                      <div>💨 {getBeaufortScale(w.windSpeedMax)}级 {getBeaufortLabel(getBeaufortScale(w.windSpeedMax))}</div>
                      {w.windDirection != null && (
                        <div>🧭 {getWindDirectionLabel(w.windDirection)}{getWindDirectionArrow(w.windDirection)}</div>
                      )}
                      {w.lightningRisk !== "none" && (
                        <div className={
                          w.lightningRisk === "high"
                            ? "text-red-600 font-bold"
                            : w.lightningRisk === "moderate"
                              ? "text-orange-600"
                              : "text-yellow-600"
                        }>
                          ⚡ 雷击 {w.lightningRisk === "high" ? "高" : w.lightningRisk === "moderate" ? "中" : "低"}
                        </div>
                      )}
                    </div>

                    {seg.hourly && seg.hourly.temperature.length > 0 && (
                      <HourlyChart
                        hourly={seg.hourly}
                        arrivalHour={seg.arrivalTime ? parseInt(seg.arrivalTime.split(":")[0], 10) : null}
                      />
                    )}

                    {seg.advices.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        {seg.advices.map((a, ai) => (
                          <div
                            key={ai}
                            className={`text-xs py-0.5 ${
                              a.level === "danger"
                                ? "text-red-600 font-medium"
                                : a.level === "warning"
                                ? "text-amber-600"
                                : "text-gray-600"
                            }`}
                          >
                            {a.icon} {a.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500">暂无天气数据</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
      </MapContainer>
    </div>
  );
}
