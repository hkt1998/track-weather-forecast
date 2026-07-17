import { SegmentAdvice } from "@/lib/advice-engine";
import { getBeaufortScale } from "@/lib/weather-service";

export interface GearItem {
  name: string;
  icon: string;
  category: "clothing" | "gear" | "safety" | "nutrition";
  reason: string;
  priority: "essential" | "recommended" | "optional";
}

const PRIORITY_ORDER: Record<string, number> = {
  essential: 0,
  recommended: 1,
  optional: 2,
};

export function recommendEquipment(
  segments: SegmentAdvice[],
  activityType: string
): GearItem[] {
  const weathers = segments
    .map((s) => s.weather)
    .filter((w): w is NonNullable<typeof w> => w != null);

  if (weathers.length === 0) return [];

  const maxTemp = Math.max(...weathers.map((w) => w.tempMax));
  const minTemp = Math.min(...weathers.map((w) => w.tempMin));
  const maxPrecipProb = Math.max(
    ...weathers.map((w) => w.precipitationProbability)
  );
  const maxWind = Math.max(...weathers.map((w) => w.windSpeedMax));
  const maxBeaufort = getBeaufortScale(maxWind);
  const hasLightning = weathers.some((w) => w.weatherCode >= 95);

  const itemMap = new Map<string, GearItem>();

  function add(item: GearItem) {
    const existing = itemMap.get(item.name);
    if (!existing) {
      itemMap.set(item.name, item);
    } else if (
      PRIORITY_ORDER[item.priority] < PRIORITY_ORDER[existing.priority]
    ) {
      itemMap.set(item.name, item);
    }
  }

  // Precipitation rules
  if (maxPrecipProb > 50) {
    add({
      name: "雨衣",
      icon: "🌧️",
      category: "gear",
      reason: `降水概率高达 ${maxPrecipProb}%`,
      priority: "essential",
    });
    add({
      name: "防水鞋套",
      icon: "🥾",
      category: "gear",
      reason: `降水概率 ${maxPrecipProb}%，保持双脚干爽`,
      priority: "recommended",
    });
  }

  // High temperature rules
  if (maxTemp > 30) {
    add({
      name: "防晒帽",
      icon: "🧢",
      category: "clothing",
      reason: `气温高达 ${maxTemp}°C，注意防晒`,
      priority: "essential",
    });
    add({
      name: "防晒霜",
      icon: "🧴",
      category: "safety",
      reason: `高温 ${maxTemp}°C，防止紫外线伤害`,
      priority: "essential",
    });
    add({
      name: "充足饮水",
      icon: "💧",
      category: "nutrition",
      reason: `高温天气需补充水分`,
      priority: "essential",
    });
  }

  // Low temperature rules
  if (minTemp < 5) {
    add({
      name: "保暖衣物",
      icon: "🧥",
      category: "clothing",
      reason: `气温低至 ${minTemp}°C，注意保暖`,
      priority: "essential",
    });
    add({
      name: "手套",
      icon: "🧤",
      category: "clothing",
      reason: `低温 ${minTemp}°C，保护手部`,
      priority: "recommended",
    });
  }

  if (minTemp <= 0) {
    add({
      name: "防滑冰爪",
      icon: "⛸️",
      category: "gear",
      reason: `气温 ≤ 0°C，路面可能结冰`,
      priority: "essential",
    });
  }

  // Wind rules
  if (maxBeaufort >= 6) {
    add({
      name: "防风外套",
      icon: "🧥",
      category: "clothing",
      reason: `最大风力 ${maxBeaufort} 级（${maxWind}km/h）`,
      priority: "essential",
    });
  }

  // Lightning / thunderstorm rules
  if (hasLightning) {
    add({
      name: "绝缘雨衣",
      icon: "⚡",
      category: "safety",
      reason: "存在雷暴风险，需绝缘防护",
      priority: "essential",
    });
  }

  // Activity type specific items
  if (activityType === "cycling") {
    add({
      name: "反光背心",
      icon: "🦺",
      category: "safety",
      reason: "骑行活动提高可见性",
      priority: "recommended",
    });
    add({
      name: "骑行手套",
      icon: "🧤",
      category: "gear",
      reason: "骑行活动防滑减震",
      priority: "recommended",
    });
    add({
      name: "车灯",
      icon: "🔦",
      category: "gear",
      reason: "骑行活动照明与警示",
      priority: "essential",
    });
  } else if (activityType === "running") {
    add({
      name: "透气速干衣",
      icon: "👕",
      category: "clothing",
      reason: "跑步活动快速排汗透气",
      priority: "recommended",
    });
    add({
      name: "运动太阳镜",
      icon: "🕶️",
      category: "gear",
      reason: "跑步活动防紫外线与风沙",
      priority: "optional",
    });
  } else if (activityType === "hiking") {
    add({
      name: "登山杖",
      icon: "🏔️",
      category: "gear",
      reason: "徒步活动辅助行走",
      priority: "optional",
    });
    add({
      name: "护膝",
      icon: "🦵",
      category: "gear",
      reason: "徒步活动保护膝关节",
      priority: "recommended",
    });
  }

  return Array.from(itemMap.values());
}
