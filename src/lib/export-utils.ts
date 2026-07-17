import { toPng } from "html-to-image";

export async function exportToImage(elementId: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) return;
  const dataUrl = await toPng(element, { quality: 0.95, pixelRatio: 2 });
  const link = document.createElement("a");
  link.download = `weather-report-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
}

export function exportToPDF(): void {
  window.print();
}

export function generateOfflineSummary(data: {
  name: string;
  totalDistance: number;
  summary: string;
  segments: Array<{
    distanceKm: number;
    arrivalDate: string | null;
    arrivalTime: string | null;
    weather: {
      tempMax: number;
      tempMin: number;
      precipitationProbability: number;
      weatherCode: number;
    } | null;
  }>;
  overallAdvices: Array<{ level: string; icon: string; text: string }>;
}): string {
  let text = `路线天气报告\n`;
  text += `路线：${data.name}\n`;
  text += `距离：${data.totalDistance} km\n`;
  text += `概况：${data.summary}\n\n`;
  text += `沿途天气：\n`;
  for (const seg of data.segments) {
    if (seg.weather) {
      text += `  ${seg.distanceKm}km (${seg.arrivalDate || ""} ${seg.arrivalTime || ""}): `;
      text += `${seg.weather.tempMin}~${seg.weather.tempMax}°C, 降水${seg.weather.precipitationProbability}%\n`;
    }
  }
  text += `\n建议：\n`;
  for (const a of data.overallAdvices) {
    text += `  ${a.icon} [${a.level}] ${a.text}\n`;
  }
  return text;
}
