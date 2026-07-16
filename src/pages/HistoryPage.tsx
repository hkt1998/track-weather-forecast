import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import HistoryList, { HistoryRoute } from "@/components/HistoryList";
import { getAllRoutes, deleteRoute } from "@/lib/database";

export default function HistoryPage() {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<HistoryRoute[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllRoutes();
      setRoutes(
        data.map((r) => ({
          id: r.id,
          name: r.name,
          distance_km: r.distance_km,
          points_count: r.points_count,
          activity_type: r.activity_type,
          start_time: r.start_time,
          created_at: r.created_at,
        }))
      );
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const handleDelete = async (id: number) => {
    try {
      await deleteRoute(id);
      setRoutes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleCompare = (ids: number[]) => {
    navigate(`/compare?ids=${ids.join(",")}`);
  };

  const handleViewDetail = (id: number) => {
    navigate(`/result?id=${id}`);
  };

  return (
    <div className="min-h-[calc(100vh-52px)] bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="返回首页"
            >
              ←
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              📋 历史记录
            </h1>
          </div>
          <span className="text-sm text-gray-400">
            共 {routes.length} 条记录
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-4 pb-24">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 mx-auto mb-3 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : (
          <HistoryList
            routes={routes}
            onDelete={handleDelete}
            onCompare={handleCompare}
            onViewDetail={handleViewDetail}
          />
        )}
      </main>
    </div>
  );
}
