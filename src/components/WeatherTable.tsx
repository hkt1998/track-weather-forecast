import { SegmentAdvice } from "@/lib/advice-engine";
import { getWeatherDescription, getWeatherIcon } from "@/lib/weather-service";

interface WeatherTableProps {
  segments: SegmentAdvice[];
}

export default function WeatherTable({ segments }: WeatherTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">距离</th>
            <th className="px-3 py-2">到达时间</th>
            <th className="px-3 py-2">天气</th>
            <th className="px-3 py-2">温度</th>
            <th className="px-3 py-2">降水</th>
            <th className="px-3 py-2">风速</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {segments.map((seg, idx) => {
            const w = seg.weather;
            return (
              <tr
                key={idx}
                className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <td className="px-3 py-2 font-medium">{idx + 1}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                  {seg.distanceKm} km
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                  {seg.arrivalDate ? (
                    <div className="text-xs">
                      <div>{seg.arrivalDate}</div>
                      <div className="text-gray-400">{seg.arrivalTime}</div>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {w ? (
                    <span>
                      {getWeatherIcon(w.weatherCode)}{" "}
                      {getWeatherDescription(w.weatherCode)}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {w ? (
                    <span>
                      {w.tempMin}° ~ {w.tempMax}°C
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {w ? (
                    <span
                      className={
                        w.precipitationProbability > 50
                          ? "text-blue-600 font-medium"
                          : ""
                      }
                    >
                      {w.precipitationProbability}%
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {w ? (
                    <span
                      className={
                        w.windSpeedMax > 30
                          ? "text-amber-600 font-medium"
                          : ""
                      }
                    >
                      {w.windSpeedMax} km/h
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
