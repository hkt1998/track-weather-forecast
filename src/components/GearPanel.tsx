import { useState } from "react";
import { GearItem } from "@/lib/gear-recommender";

const CATEGORY_LABELS: Record<string, string> = {
  clothing: "🧥 衣物",
  gear: "🎒 装备",
  safety: "🛡️ 安全",
  nutrition: "🍎 补给",
};

const PRIORITY_STYLES: Record<string, string> = {
  essential:
    "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  recommended:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  optional:
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const PRIORITY_LABELS: Record<string, string> = {
  essential: "必备",
  recommended: "推荐",
  optional: "可选",
};

interface GearPanelProps {
  items: GearItem[];
  activityType: string;
}

export default function GearPanel({ items }: GearPanelProps) {
  const [copied, setCopied] = useState(false);

  if (items.length === 0) {
    return (
      <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">
        <span className="text-2xl block mb-2">✅</span>
        当前天气无需额外装备
      </div>
    );
  }

  const grouped = items.reduce<Record<string, GearItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const categoryOrder = ["clothing", "gear", "safety", "nutrition"];

  async function handleCopy() {
    const lines = items.map(
      (item) => `${item.icon} ${item.name}（${PRIORITY_LABELS[item.priority]}）— ${item.reason}`
    );
    const text = `装备清单\n${lines.join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">
          🎒 装备推荐
        </h3>
        <button
          onClick={handleCopy}
          disabled={copied}
          className="px-2.5 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-60"
        >
          {copied ? "✓ 已复制" : "📋 复制清单"}
        </button>
      </div>

      {categoryOrder
        .filter((cat) => grouped[cat] && grouped[cat].length > 0)
        .map((cat) => (
          <div key={cat}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              {CATEGORY_LABELS[cat] || cat}
            </p>
            <div className="space-y-1.5">
              {grouped[cat].map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                >
                  <span className="text-base flex-shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        {item.name}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[item.priority]}`}
                      >
                        {PRIORITY_LABELS[item.priority]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {item.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
