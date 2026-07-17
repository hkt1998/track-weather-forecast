import { HourlyWeather } from "@/lib/weather-service";

interface HourlyChartProps {
  hourly: HourlyWeather;
  arrivalHour?: number | null;
}

export default function HourlyChart({ hourly, arrivalHour }: HourlyChartProps) {
  if (!hourly || hourly.temperature.length === 0) return null;

  const width = 280;
  const height = 130;
  const padding = { top: 10, right: 10, bottom: 25, left: 30 };
  const chartW = width - padding.left - padding.right;
  const chartH = (height - padding.top - padding.bottom) / 2;

  // Temperature range
  const temps = hourly.temperature;
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const tempRange = maxTemp - minTemp || 1;

  // Build temperature path
  const tempPoints = temps.map((t, i) => {
    const x = padding.left + (i / 23) * chartW;
    const y = padding.top + chartH - ((t - minTemp) / tempRange) * chartH;
    return { x, y, t };
  });
  const tempPath = tempPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  // Precipitation bars
  const precipTop = padding.top + chartH + 8;
  const precipH = chartH - 8;
  const barWidth = chartW / 24 * 0.6;

  // Hour labels (every 3 hours)
  const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21];

  return (
    <div className="mt-2 pt-2 border-t">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">📊 24小时天气趋势</div>
      <svg width={width} height={height} className="overflow-visible">
        {/* Temperature line */}
        <path d={tempPath} fill="none" stroke="#ef4444" strokeWidth="1.5" />
        {/* Temperature labels */}
        <text x={padding.left - 2} y={padding.top + 4} fontSize="8" fill="#ef4444" textAnchor="end">{maxTemp}°</text>
        <text x={padding.left - 2} y={padding.top + chartH} fontSize="8" fill="#3b82f6" textAnchor="end">{minTemp}°</text>

        {/* Precipitation bars */}
        {hourly.precipitationProbability.map((p, i) => {
          const x = padding.left + (i / 23) * chartW - barWidth / 2;
          const h = (p / 100) * precipH;
          return (
            <rect
              key={i}
              x={x}
              y={precipTop + precipH - h}
              width={barWidth}
              height={h}
              fill="#3b82f6"
              opacity="0.3"
              rx="1"
            />
          );
        })}

        {/* Arrival hour marker */}
        {arrivalHour != null && arrivalHour >= 0 && arrivalHour < 24 && (
          <>
            <line
              x1={padding.left + (arrivalHour / 23) * chartW}
              y1={padding.top}
              x2={padding.left + (arrivalHour / 23) * chartW}
              y2={precipTop + precipH}
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="3,2"
            />
            <text
              x={padding.left + (arrivalHour / 23) * chartW}
              y={padding.top - 2}
              fontSize="7"
              fill="#f59e0b"
              textAnchor="middle"
            >
              到达
            </text>
          </>
        )}

        {/* Hour labels */}
        {hourLabels.map(h => (
          <text
            key={h}
            x={padding.left + (h / 23) * chartW}
            y={height - 2}
            fontSize="7"
            fill="currentColor"
            className="text-gray-400 dark:text-gray-500"
            textAnchor="middle"
          >
            {h}:00
          </text>
        ))}

        {/* Y-axis label for precipitation */}
        <text x={padding.left - 2} y={precipTop + 4} fontSize="7" fill="#3b82f6" textAnchor="end">💧</text>
        <text x={padding.left - 2} y={precipTop + precipH} fontSize="7" fill="#3b82f6" textAnchor="end">0%</text>
      </svg>
    </div>
  );
}
