import { useState } from "react";
import { Advice, SegmentAdvice } from "@/lib/advice-engine";

interface DangerBannerProps {
  advices: Advice[];
  segments: SegmentAdvice[];
}

export default function DangerBanner({ advices, segments }: DangerBannerProps) {
  const [visible, setVisible] = useState(true);

  const dangerAdvices = advices.filter((a) => a.level === "danger");

  if (dangerAdvices.length === 0 || !visible) return null;

  // Find segments with danger-level weather
  const dangerSegments = segments.filter(
    (s) => s.advices.some((a) => a.level === "danger")
  );
  const dangerKmList = dangerSegments.map((s) => `${s.distanceKm}km`);

  return (
    <div className="bg-red-600 dark:bg-red-800 text-white px-4 py-3 animate-pulse">
      <div className="max-w-7xl mx-auto flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 mt-0.5">⚠️</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-bold text-base">极端天气预警</h2>
            {dangerKmList.length > 0 && (
              <span className="text-xs bg-red-700 dark:bg-red-900 px-2 py-0.5 rounded-full">
                涉及路段：{dangerKmList.slice(0, 5).join("、")}
                {dangerKmList.length > 5 && ` 等${dangerKmList.length}处`}
              </span>
            )}
          </div>
          <ul className="space-y-0.5 text-sm">
            {dangerAdvices.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="flex-shrink-0">{a.icon}</span>
                <span>{a.text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-red-100 dark:text-red-200">
            <span>🛡️ 建议推迟出行或寻找安全庇护所</span>
            <span>📞 紧急求助：110 / 119 / 120</span>
          </div>
        </div>
        <button
          onClick={() => setVisible(false)}
          className="flex-shrink-0 p-1 hover:bg-red-700 dark:hover:bg-red-900 rounded-lg transition-colors"
          title="关闭预警"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
