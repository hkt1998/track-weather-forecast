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
import { getWeatherIcon } from "@/lib/weather-service";
import { SegmentRecord } from "@/lib/database";

interface RouteLayer {
  id: number;
  name: string;
  color: string;
  allPoints: TrackPoint[];
  segments: SegmentRecord[];
}

interface CompareMapProps {
  routes: RouteLayer[];
}

export default function CompareMap({ routes }: CompareMapProps) {
  // Gather all positions for bounds
  const allLatLngs: L.LatLng[] = [];
  for (const route of routes) {
    for (const p of route.allPoints) {
      allLatLngs.push(L.latLng(p.lat, p.lon));
    }
  }

  const bounds =
    allLatLngs.length > 0
      ? L.latLngBounds(allLatLngs)
      : L.latLngBounds([L.latLng(39.9, 116.4)]);

  const center: [number, number] =
    allLatLngs.length > 0
      ? [
          allLatLngs.reduce((s, ll) => s + ll.lat, 0) / allLatLngs.length,
          allLatLngs.reduce((s, ll) => s + ll.lng, 0) / allLatLngs.length,
        ]
      : [39.9, 116.4];

  return (
    <MapContainer
      bounds={bounds}
      center={center}
      zoom={10}
      className="w-full h-full rounded-xl z-0"
      style={{ minHeight: "400px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {routes.map((route) => {
        const positions: [number, number][] = route.allPoints.map((p) => [
          p.lat,
          p.lon,
        ]);

        return (
          <>
            {/* Track line */}
            <Polyline
              key={`line-${route.id}`}
              positions={positions}
              pathOptions={{
                color: route.color,
                weight: 3,
                opacity: 0.8,
              }}
            />

            {/* Segment markers */}
            {route.segments.map((seg, idx) => {
              const hasDanger = seg.advice_level === "danger";
              const hasWarning = seg.advice_level === "warning";
              const fillColor = hasDanger
                ? "#ef4444"
                : hasWarning
                ? "#f59e0b"
                : "#22c55e";

              return (
                <CircleMarker
                  key={`marker-${route.id}-${idx}`}
                  center={[seg.lat, seg.lon]}
                  radius={7}
                  pathOptions={{
                    color: route.color,
                    weight: 2,
                    fillColor,
                    fillOpacity: 0.9,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>
                    <span className="text-xs">
                      <span className="font-medium">{route.name}</span>
                      {seg.arrival_time && ` ⏰${seg.arrival_time}`}
                      {seg.wmo_code != null
                        ? ` ${getWeatherIcon(seg.wmo_code)} ${seg.temp_max ?? "-"}°C`
                        : " 暂无天气"}
                    </span>
                  </Tooltip>
                  <Popup>
                    <div className="min-w-[180px] text-sm">
                      <div
                        className="font-bold text-base border-b pb-1 mb-2"
                        style={{ borderColor: route.color }}
                      >
                        <span
                          className="inline-block w-3 h-3 rounded-full mr-1"
                          style={{ backgroundColor: route.color }}
                        />
                        {route.name}
                      </div>
                      <div className="text-xs text-gray-500 mb-1">
                        📍 采样点 {idx + 1} ({seg.distance_km} km)
                      </div>
                      {seg.arrival_date && (
                        <div className="text-xs text-gray-500 mb-2">
                          🕐 {seg.arrival_date} {seg.arrival_time}
                        </div>
                      )}
                      {seg.wmo_code != null ? (
                        <div className="grid grid-cols-2 gap-1 text-xs mt-1">
                          <div>
                            {getWeatherIcon(seg.wmo_code)}{" "}
                            {seg.temp_max ?? "-"}°C /{" "}
                            {seg.temp_min ?? "-"}°C
                          </div>
                          <div>🌧️ {seg.precip_prob ?? 0}%</div>
                          <div>💨 {seg.wind_speed_max ?? 0}km/h</div>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-xs">暂无天气数据</p>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </>
        );
      })}

      {/* Legend */}
      <div className="leaflet-bottom leaflet-left">
        <div className="leaflet-control bg-white/90 dark:bg-gray-900/90 backdrop-blur rounded-lg p-2 text-xs space-y-1 shadow">
          {routes.map((route) => (
            <div key={route.id} className="flex items-center gap-1.5">
              <span
                className="w-4 h-1 rounded inline-block"
                style={{ backgroundColor: route.color }}
              />
              <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                {route.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </MapContainer>
  );
}
