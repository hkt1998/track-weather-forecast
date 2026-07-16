import { useState } from "react";
import { ACTIVITY_TYPES, ActivityType } from "@/lib/gpx-parser";

interface TrackSummary {
  name: string;
  totalDistance: number;
  pointCount: number;
  sampleCount: number;
}

interface TripSettingsProps {
  trackSummary: TrackSummary;
  onConfirm: (startTime: string, activityType: string) => void;
  onBack: () => void;
  isLoading: boolean;
  loadingText?: string;
}

export default function TripSettings({
  trackSummary,
  onConfirm,
  onBack,
  isLoading,
  loadingText,
}: TripSettingsProps) {
  // Default to tomorrow 8:00 AM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  const defaultDateTime = tomorrow.toISOString().slice(0, 16);

  const [dateTime, setDateTime] = useState(defaultDateTime);
  const [selectedActivity, setSelectedActivity] = useState("walking");

  const handleConfirm = () => {
    if (!dateTime) return;
    onConfirm(dateTime, selectedActivity);
  };

  const selectedActivityData = ACTIVITY_TYPES.find(
    (a) => a.id === selectedActivity
  );

  // Estimate total duration
  const estimatedHours = selectedActivityData
    ? trackSummary.totalDistance / selectedActivityData.avgSpeedKmh
    : 0;
  const durationStr =
    estimatedHours >= 24
      ? `${Math.floor(estimatedHours / 24)}天${Math.round(estimatedHours % 24)}小时`
      : `${Math.round(estimatedHours * 10) / 10}小时`;

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {/* Track summary card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-white text-lg">
            📍 轨迹解析完成
          </h2>
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            重新上传
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">轨迹名称</div>
            <div className="font-medium text-sm truncate" title={trackSummary.name}>
              {trackSummary.name}
            </div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">总距离</div>
            <div className="font-medium text-sm">{trackSummary.totalDistance} km</div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">采样点</div>
            <div className="font-medium text-sm">{trackSummary.sampleCount} 个</div>
          </div>
        </div>
      </div>

      {/* Settings form */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-5">
        <h2 className="font-semibold text-gray-900 dark:text-white text-lg">
          ⏰ 出发设置
        </h2>

        {/* Start date/time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            出发时间
          </label>
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            选择你计划的出发日期和时间
          </p>
        </div>

        {/* Activity type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            出行方式
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ACTIVITY_TYPES.map((activity: ActivityType) => (
              <button
                key={activity.id}
                onClick={() => setSelectedActivity(activity.id)}
                className={`flex items-center gap-2 p-3 rounded-lg border text-left transition ${
                  selectedActivity === activity.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950 ring-1 ring-blue-500"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
              >
                <span className="text-xl">{activity.icon}</span>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {activity.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    约 {activity.avgSpeedKmh} km/h
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Estimated duration */}
        {estimatedHours > 0 && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              预计全程用时：
              <span className="font-medium text-gray-900 dark:text-white">
                {durationStr}
              </span>
            </p>
          </div>
        )}

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={isLoading || !dateTime}
          className={`w-full py-3 rounded-lg font-medium text-white transition ${
            isLoading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {loadingText || "获取天气中..."}
            </span>
          ) : (
            "🌤️ 查询沿途天气"
          )}
        </button>
      </div>
    </div>
  );
}
