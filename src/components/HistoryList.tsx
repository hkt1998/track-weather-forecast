import { useState } from "react";
import { ACTIVITY_TYPES } from "@/lib/gpx-parser";

export interface HistoryRoute {
  id: number;
  name: string;
  distance_km: number;
  points_count: number;
  activity_type: string | null;
  start_time: string | null;
  created_at: string;
}

interface HistoryListProps {
  routes: HistoryRoute[];
  onDelete: (id: number) => void;
  onCompare: (ids: number[]) => void;
  onViewDetail: (id: number) => void;
}

export default function HistoryList({
  routes,
  onDelete,
  onCompare,
  onViewDetail,
}: HistoryListProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState<number | null>(null);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = async (id: number) => {
    if (deleting === id) {
      // Second click confirms
      onDelete(id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDeleting(null);
    } else {
      setDeleting(id);
      setTimeout(() => setDeleting(null), 3000);
    }
  };

  if (routes.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">📭</div>
        <p className="text-gray-500 dark:text-gray-400 text-lg">暂无历史记录</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          上传 GPX 文件并查询天气后，记录会自动保存在这里
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Route cards */}
      {routes.map((route) => {
        const isSelected = selected.has(route.id);
        const activity = route.activity_type
          ? ACTIVITY_TYPES.find((a) => a.id === route.activity_type)
          : null;

        return (
          <div
            key={route.id}
            className={`relative bg-white dark:bg-gray-900 rounded-xl border transition-all cursor-pointer ${
              isSelected
                ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
            }`}
            onClick={() => toggleSelect(route.id)}
          >
            <div className="p-4 flex items-start gap-3">
              {/* Checkbox */}
              <div
                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  isSelected
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              >
                {isSelected && (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {route.name}
                </h3>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span>📏 {route.distance_km} km</span>
                  {activity && (
                    <span>
                      {activity.icon} {activity.label}
                    </span>
                  )}
                  {route.start_time && (
                    <span>
                      🕐{" "}
                      {new Date(route.start_time).toLocaleString("zh-CN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  <span className="text-gray-400 dark:text-gray-500">
                    查询于{" "}
                    {new Date(route.created_at).toLocaleString("zh-CN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {/* View detail button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetail(route.id);
                }}
                className="flex-shrink-0 px-2 py-1 rounded text-xs text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                title="查看详细分析"
              >
                👁️ 详情
              </button>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(route.id);
                }}
                className={`flex-shrink-0 px-2 py-1 rounded text-xs transition-colors ${
                  deleting === route.id
                    ? "bg-red-500 text-white"
                    : "text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                }`}
                title={
                  deleting === route.id
                    ? "再次点击确认删除"
                    : "删除此记录"
                }
              >
                {deleting === route.id ? "确认删除" : "🗑️"}
              </button>
            </div>

            {/* Selection limit warning */}
            {!isSelected && selected.size >= 4 && (
              <div className="px-4 pb-2">
                <span className="text-xs text-amber-500">
                  最多选择 4 条路线进行对比
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Floating compare bar */}
      {selected.size >= 2 && (
        <div className="sticky bottom-4 z-10">
          <div className="max-w-xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-3 flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              已选{" "}
              <span className="font-bold text-blue-500">{selected.size}</span>{" "}
              条路线
            </span>
            <button
              onClick={() => onCompare(Array.from(selected))}
              className="px-5 py-2 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
            >
              开始对比 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
