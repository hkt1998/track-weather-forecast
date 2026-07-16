import { useCallback, useState, DragEvent, ChangeEvent } from "react";

interface FileUploadProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
  loadingText?: string;
}

export default function FileUpload({
  onFileSelected,
  isLoading,
  loadingText = "处理中...",
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.toLowerCase().endsWith(".gpx")) {
        onFileSelected(file);
      }
    },
    [onFileSelected]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelected(file);
      }
    },
    [onFileSelected]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-2xl p-12 text-center
        transition-all duration-200 cursor-pointer
        ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
            : "border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        }
        ${isLoading ? "pointer-events-none opacity-60" : ""}
      `}
    >
      <input
        type="file"
        accept=".gpx"
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isLoading}
      />

      {isLoading ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {loadingText}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl">📍</div>
          <div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
              拖拽 GPX 文件到此处，或点击选择文件
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              支持 .gpx 格式的轨迹文件
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
