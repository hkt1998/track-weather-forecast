import { useState, useRef, useEffect, useCallback } from "react";

interface SavedTime {
  time: string; // "HH:mm"
  label: string;
}

export interface SavedDateTime {
  id: string;
  name: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:mm"
  createdAt: string;
}

interface DateTimePickerProps {
  value: string; // ISO format "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
}

const SAVED_TIMES_KEY = "saved-departure-times";
const SAVED_DATETIMES_KEY = "saved-datetime-history";

function parseDateTime(value: string): { date: string; hour: string; minute: string } {
  if (!value) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return { date: `${y}-${m}-${d}`, hour: h, minute: min };
  }
  const [datePart, timePart] = value.split("T");
  const [h, min] = (timePart || "08:00").split(":");
  return { date: datePart, hour: h, minute: min };
}

function buildISO(date: string, hour: string, minute: string): string {
  return `${date}T${hour}:${minute}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/* ── Dropdown selector component ── */
function TimeDropdown({
  label,
  value,
  options,
  suffix,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  suffix: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      const active = listRef.current.querySelector("[data-active]");
      active?.scrollIntoView({ block: "nearest" });
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-all duration-150 outline-none min-w-[88px] justify-between
          ${
            open
              ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-950/40"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500"
          }`}
      >
        <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
        <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
          {value}
          <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-0.5">{suffix}</span>
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[120px] animate-fade-in">
          <div
            ref={listRef}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg dark:shadow-gray-950/50 py-1 max-h-52 overflow-y-auto scrollbar-thin"
          >
            {options.map((opt) => {
              const selected = opt === value;
              return (
                <button
                  key={opt}
                  type="button"
                  data-active={selected || undefined}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-sm text-left transition-colors flex items-center justify-between
                    ${
                      selected
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-medium"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                    }`}
                >
                  <span className="tabular-nums">{opt}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{suffix}</span>
                  {selected && (
                    <svg className="w-4 h-4 text-blue-500 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatChineseDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m)}月${parseInt(d)}日`;
}

export default function DateTimePicker({
  value,
  onChange,
}: DateTimePickerProps) {
  const { date, hour, minute } = parseDateTime(value);
  const [showSaveFullInput, setShowSaveFullInput] = useState(false);
  const [saveFullName, setSaveFullName] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  /* ── Saved times (HH:mm) — self-managed via localStorage ── */
  const [savedTimes, setSavedTimes] = useState<SavedTime[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_TIMES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem(SAVED_TIMES_KEY, JSON.stringify(savedTimes));
  }, [savedTimes]);

  // Keep latest values in refs for auto-save effect
  const hourRef = useRef(hour);
  const minuteRef = useRef(minute);
  const savedTimesRef = useRef(savedTimes);
  hourRef.current = hour;
  minuteRef.current = minute;
  savedTimesRef.current = savedTimes;

  const internalSaveTime = useCallback(() => {
    const time = `${hourRef.current}:${minuteRef.current}`;
    setSavedTimes((prev) => {
      const exists = prev.some((s) => s.time === time);
      if (exists) return prev;
      return [...prev, { time, label: time }];
    });
  }, []);

  // Auto-save current time on change
  useEffect(() => {
    internalSaveTime();
  }, [hour, minute, internalSaveTime]);

  const handleDeleteSavedTime = (time: string) => {
    setSavedTimes((prev) => prev.filter((s) => s.time !== time));
  };

  const handleSelectSavedTime = (time: string) => {
    const [h, m] = time.split(":");
    onChange(buildISO(date, h, m));
  };

  /* ── Saved full datetimes — self-managed via localStorage ── */
  const [savedDateTimes, setSavedDateTimes] = useState<SavedDateTime[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_DATETIMES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem(SAVED_DATETIMES_KEY, JSON.stringify(savedDateTimes));
  }, [savedDateTimes]);

  const handleSaveDateTime = () => {
    if (!showSaveFullInput) {
      setShowSaveFullInput(true);
      setSaveFullName("");
      return;
    }
    const name = saveFullName.trim() || `${date} ${hour}:${minute}`;
    const entry: SavedDateTime = {
      id: String(Date.now()),
      name,
      date,
      time: `${hour}:${minute}`,
      createdAt: new Date().toISOString(),
    };
    setSavedDateTimes((prev) => {
      const exists = prev.some(
        (e) => e.name === entry.name && e.date === entry.date && e.time === entry.time
      );
      if (exists) return prev;
      return [...prev, entry];
    });
    setShowSaveFullInput(false);
    setSaveFullName("");
  };

  const handleSelectSavedDateTime = (entry: SavedDateTime) => {
    onChange(`${entry.date}T${entry.time}`);
  };

  const handleDeleteSavedDateTime = (id: string) => {
    setSavedDateTimes((prev) => prev.filter((e) => e.id !== id));
  };

  /* ── Handlers ── */
  const handleDateChange = (newDate: string) => {
    onChange(buildISO(newDate, hour, minute));
  };

  const handleHourChange = (newHour: string) => {
    onChange(buildISO(date, newHour, minute));
  };

  const handleMinuteChange = (newMinute: string) => {
    onChange(buildISO(date, hour, newMinute));
  };

  const hasSavedEntries = savedTimes.length > 0 || savedDateTimes.length > 0;

  return (
    <div className="space-y-3">
      {/* Date + Time controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Date input */}
          <div className="relative flex-1 min-w-[150px]">
            <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-150"
            />
          </div>

          {/* Time selectors */}
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">时</label>
              <TimeDropdown
                label=""
                value={hour}
                options={HOURS}
                suffix="时"
                onChange={handleHourChange}
              />
            </div>
            <span className="text-lg font-light text-gray-300 dark:text-gray-600 pb-2">:</span>
            <div>
              <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">分</label>
              <TimeDropdown
                label=""
                value={minute}
                options={MINUTES}
                suffix="分"
                onChange={handleMinuteChange}
              />
            </div>
          </div>
        </div>

        {/* Minute quick select — 12 rainbow buttons */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: "整", min: "00", color: "bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700", selectedRing: "ring-red-500 ring-offset-gray-100 dark:ring-white dark:ring-offset-gray-800" },
            { label: "05分", min: "05", color: "bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700", selectedRing: "ring-orange-500 ring-offset-gray-100 dark:ring-white dark:ring-offset-gray-800" },
            { label: "10分", min: "10", color: "bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700", selectedRing: "ring-amber-500 ring-offset-gray-100 dark:ring-white dark:ring-offset-gray-800" },
            { label: "一刻", min: "15", color: "bg-yellow-500 text-gray-900 hover:bg-yellow-600 dark:bg-yellow-500 dark:hover:bg-yellow-600", selectedRing: "ring-yellow-500 ring-offset-gray-100 dark:ring-white dark:ring-offset-gray-800" },
            { label: "20分", min: "20", color: "bg-lime-500 text-white hover:bg-lime-600 dark:bg-lime-600 dark:hover:bg-lime-700", selectedRing: "ring-lime-500 ring-offset-gray-100 dark:ring-white dark:ring-offset-gray-800" },
            { label: "25分", min: "25", color: "bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700", selectedRing: "ring-green-500 ring-offset-gray-100 dark:ring-white dark:ring-offset-gray-800" },
            { label: "半", min: "30", color: "bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700", selectedRing: "ring-emerald-500 ring-offset-gray-100 dark:ring-white dark:ring-offset-gray-800" },
            { label: "35分", min: "35", color: "bg-teal-500 text-white hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-700", selectedRing: "ring-teal-500 ring-offset-gray-100 dark:ring-white dark:ring-offset-gray-800" },
            { label: "40分", min: "40", color: "bg-cyan-500 text-white hover:bg-cyan-600 dark:bg-cyan-600 dark:hover:bg-cyan-700", selectedRing: "ring-cyan-500 ring-offset-gray-100 dark:ring-white dark:ring-offset-gray-800" },
            { label: "三刻", min: "45", color: "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700", selectedRing: "ring-blue-500 ring-offset-gray-100 dark:ring-white dark:ring-offset-gray-800" },
            { label: "50分", min: "50", color: "bg-indigo-500 text-white hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700", selectedRing: "ring-indigo-500 ring-offset-gray-100 dark:ring-white dark:ring-offset-gray-800" },
            { label: "55分", min: "55", color: "bg-purple-500 text-white hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700", selectedRing: "ring-purple-500 ring-offset-gray-100 dark:ring-white dark:ring-offset-gray-800" },
          ].map((btn) => (
            <button
              key={btn.min}
              type="button"
              onClick={() => handleMinuteChange(btn.min)}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${btn.color}${
                minute === btn.min ? ` ring-2 ring-offset-2 ${btn.selectedRing} font-bold` : ""
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Utility buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const y = now.getFullYear();
              const m = String(now.getMonth() + 1).padStart(2, "0");
              const d = String(now.getDate()).padStart(2, "0");
              handleDateChange(`${y}-${m}-${d}`);
            }}
            className="px-2 py-1 text-xs rounded-md bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-700 transition-colors"
          >
            今日
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(buildISO(date, "00", "00"));
            }}
            className="px-2 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 transition-colors"
          >
            清除
          </button>
        </div>
      </div>

      {/* Save + Saved entries section */}
      <div className="flex items-end gap-1.5 flex-wrap">
        {/* Save full datetime button */}
        {showSaveFullInput ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={saveFullName}
              onChange={(e) => setSaveFullName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveDateTime();
                if (e.key === "Escape") setShowSaveFullInput(false);
              }}
              placeholder="记录名称..."
              className="w-28 px-2.5 py-2 text-xs rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-150"
              autoFocus
            />
            <button
              onClick={handleSaveDateTime}
              className="px-3 py-2 text-xs rounded-lg bg-purple-500 text-white hover:bg-purple-600 active:bg-purple-700 transition-colors font-medium shadow-sm"
            >
              保存
            </button>
            <button
              onClick={() => setShowSaveFullInput(false)}
              className="px-1.5 py-2 text-xs rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={handleSaveDateTime}
            className="px-3 py-2 text-xs rounded-lg text-purple-500 hover:text-purple-600 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-all duration-150 border border-dashed border-purple-300 dark:border-purple-700 whitespace-nowrap hover:border-purple-400 dark:hover:border-purple-600"
          >
            ★ 保存完整时间
          </button>
        )}

        {/* Saved entries dropdown toggle */}
        {hasSavedEntries && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="px-3 py-2 text-xs rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-150 border border-gray-200 dark:border-gray-700 whitespace-nowrap"
          >
            已保存时间 {showHistory ? "▲" : "▼"}
          </button>
        )}
      </div>

      {/* Saved entries history dropdown */}
      {showHistory && hasSavedEntries && (
        <div className="space-y-2">
          {/* Saved full datetimes */}
          {savedDateTimes.length > 0 && (
            <div>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 block mb-1">完整记录</span>
              <div className="max-h-28 overflow-y-auto scrollbar-thin space-y-1">
                {savedDateTimes.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => handleSelectSavedDateTime(entry)}
                    className="group w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-800/50 hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-150 text-left"
                  >
                    <span className="font-medium text-purple-600 dark:text-purple-400 truncate max-w-[100px]" title={entry.name}>
                      {entry.name}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
                      {formatChineseDate(entry.date)}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300 tabular-nums font-medium shrink-0">
                      {entry.time}
                    </span>
                    <span
                      onClick={(e) => { e.stopPropagation(); handleDeleteSavedDateTime(entry.id); }}
                      className="ml-auto w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900/60 hover:text-red-500 text-purple-300 dark:text-purple-600 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                      title="删除"
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Saved time presets */}
          {savedTimes.length > 0 && (
            <div>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 block mb-1">时间预设</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {savedTimes.map((st) => (
                  <button
                    key={st.time + st.label}
                    onClick={() => handleSelectSavedTime(st.time)}
                    className="group inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-150"
                  >
                    <span className="font-medium tabular-nums">{st.time}</span>
                    <span className="text-blue-400 dark:text-blue-500">{st.label}</span>
                    <span
                      onClick={(e) => { e.stopPropagation(); handleDeleteSavedTime(st.time); }}
                      className="ml-0.5 w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900/60 hover:text-red-500 text-blue-300 dark:text-blue-600 transition-colors cursor-pointer"
                      title="删除"
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
