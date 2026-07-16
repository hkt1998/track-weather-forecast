import { Routes, Route, Link } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ResultPage from "./pages/ResultPage";
import HistoryPage from "./pages/HistoryPage";
import ComparePage from "./pages/ComparePage";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="font-bold text-gray-900 dark:text-white hover:text-blue-500 transition-colors"
          >
            🗺️ GPX 天气助手
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              to="/"
              className="text-gray-600 dark:text-gray-400 hover:text-blue-500 transition-colors"
            >
              首页
            </Link>
            <Link
              to="/history"
              className="text-gray-600 dark:text-gray-400 hover:text-blue-500 transition-colors"
            >
              📋 历史记录
            </Link>
          </div>
        </div>
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/compare" element={<ComparePage />} />
      </Routes>
    </Layout>
  );
}
