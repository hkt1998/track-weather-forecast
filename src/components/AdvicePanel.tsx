import { Advice } from "@/lib/advice-engine";

interface AdvicePanelProps {
  summary: string;
  advices: Advice[];
}

export default function AdvicePanel({ summary, advices }: AdvicePanelProps) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
          📊 天气概况
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
          {summary}
        </p>
      </div>

      {/* Advice list */}
      {advices.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">
            💡 出行建议
          </h3>
          {advices.map((advice, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                advice.level === "danger"
                  ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                  : advice.level === "warning"
                  ? "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
                  : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              }`}
            >
              <span className="text-xl flex-shrink-0 mt-0.5">
                {advice.icon}
              </span>
              <span
                className={`text-sm leading-relaxed ${
                  advice.level === "danger"
                    ? "text-red-700 dark:text-red-300 font-medium"
                    : advice.level === "warning"
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-gray-600 dark:text-gray-300"
                }`}
              >
                {advice.text}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 bg-green-50 dark:bg-green-950 rounded-xl border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-700 dark:text-green-300">
            ✅ 整体天气良好，适合出行！
          </p>
        </div>
      )}
    </div>
  );
}
