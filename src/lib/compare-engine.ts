import { SegmentRecord } from "./database";

export interface RouteScore {
  routeId: number;
  routeName: string;
  totalScore: number;
  avgScore: number;
  rank: number;
  isRecommended: boolean;
  highlights: string[];
}

interface RouteData {
  id: number;
  name: string;
  segments: SegmentRecord[];
}

function scoreSegment(seg: SegmentRecord): number {
  let score = 100;

  // Precipitation: 0mm = full marks, -10 per mm, >=10mm = 0
  if (seg.precip_prob != null) {
    const precipPenalty = Math.min(seg.precip_prob, 100) * 0.5;
    score -= precipPenalty;
  }

  // Wind: <10km/h = full, -5 per 5km/h above 10
  if (seg.wind_speed_max != null) {
    if (seg.wind_speed_max > 10) {
      score -= Math.min(((seg.wind_speed_max - 10) / 5) * 5, 30);
    }
  }

  // WMO weather code
  if (seg.wmo_code != null) {
    if (seg.wmo_code >= 95) score -= 40; // Thunderstorm
    else if (seg.wmo_code >= 80) score -= 25; // Showers
    else if (seg.wmo_code >= 61) score -= 20; // Rain
    else if (seg.wmo_code >= 51) score -= 10; // Drizzle
    else if (seg.wmo_code >= 45) score -= 5; // Fog
    // 0-3: clear/partly cloudy - no penalty
  }

  // Temperature: 15-25 ideal
  if (seg.temp_max != null) {
    if (seg.temp_max > 35) score -= 20;
    else if (seg.temp_max > 30) score -= 10;
    else if (seg.temp_max < 0) score -= 20;
    else if (seg.temp_max < 5) score -= 10;
  }

  return Math.max(0, Math.round(score));
}

function generateHighlights(segments: SegmentRecord[]): string[] {
  const highlights: string[] = [];

  const maxTemp = Math.max(
    ...segments.map((s) => s.temp_max ?? 0).filter((t) => t != null)
  );
  const minTemp = Math.min(
    ...segments.map((s) => s.temp_min ?? 99).filter((t) => t != null)
  );
  const maxPrecip = Math.max(
    ...segments.map((s) => s.precip_prob ?? 0).filter((t) => t != null)
  );
  const maxWind = Math.max(
    ...segments.map((s) => s.wind_speed_max ?? 0).filter((t) => t != null)
  );

  if (maxPrecip <= 20) highlights.push("全程降水概率低");
  if (maxPrecip > 60) highlights.push("部分路段降水概率较高");
  if (maxWind < 20) highlights.push("风力较小");
  if (maxWind > 40) highlights.push("注意大风路段");
  if (maxTemp <= 28 && minTemp >= 10) highlights.push("气温适宜");
  if (maxTemp > 35) highlights.push("注意高温防暑");
  if (minTemp < 0) highlights.push("注意低温结冰");

  return highlights;
}

export function compareRoutes(routes: RouteData[]): RouteScore[] {
  if (routes.length === 0) return [];

  const scores: RouteScore[] = routes.map((route) => {
    const segScores = route.segments.map(scoreSegment);
    const totalScore = segScores.reduce((a, b) => a + b, 0);
    const avgScore =
      segScores.length > 0
        ? Math.round(totalScore / segScores.length)
        : 0;

    return {
      routeId: route.id,
      routeName: route.name,
      totalScore,
      avgScore,
      rank: 0,
      isRecommended: false,
      highlights: generateHighlights(route.segments),
    };
  });

  // Sort by average score descending
  scores.sort((a, b) => b.avgScore - a.avgScore);

  // Assign ranks
  scores.forEach((s, i) => {
    s.rank = i + 1;
    s.isRecommended = i === 0;
  });

  return scores;
}
