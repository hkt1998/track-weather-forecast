import { openDB, DBSchema, IDBPDatabase } from "idb";

// --- Types ---

export interface RouteRecord {
  id: number;
  name: string;
  distance_km: number;
  points_count: number;
  activity_type: string | null;
  start_time: string | null;
  created_at: string;
  all_points_json: string;
}

export interface SegmentRecord {
  id: number;
  route_id: number;
  point_index: number;
  distance_km: number;
  lat: number;
  lon: number;
  arrival_date: string | null;
  arrival_time: string | null;
  wmo_code: number | null;
  temp_max: number | null;
  temp_min: number | null;
  precip_prob: number | null;
  precip_sum: number | null;
  wind_speed_max: number | null;
  wind_direction: number | null;
  lightning_risk: string | null;
  advice_level: string | null;
  advice_text: string | null;
}

// --- IndexedDB Schema ---

export interface WeatherCacheRecord {
  routeId: number;
  weatherJson: string;
  cachedAt: string;
}

interface GpxDB extends DBSchema {
  routes: {
    key: number;
    value: RouteRecord;
    indexes: { "by-created": string };
  };
  segments: {
    key: number;
    value: SegmentRecord;
    indexes: { "by-route": number };
  };
  weatherCache: {
    key: number;
    value: WeatherCacheRecord;
    indexes: {};
  };
}

const DB_NAME = "gpx-weather-db";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<GpxDB>> | null = null;

function getDb(): Promise<IDBPDatabase<GpxDB>> {
  if (!dbPromise) {
    dbPromise = openDB<GpxDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const routeStore = db.createObjectStore("routes", {
            keyPath: "id",
            autoIncrement: true,
          });
          routeStore.createIndex("by-created", "created_at");

          const segStore = db.createObjectStore("segments", {
            keyPath: "id",
            autoIncrement: true,
          });
          segStore.createIndex("by-route", "route_id");
        }
        if (oldVersion < 2) {
          db.createObjectStore("weatherCache", { keyPath: "routeId" });
        }
      },
    });
  }
  return dbPromise;
}

// --- CRUD ---

export async function insertRoute(data: {
  name: string;
  distanceKm: number;
  pointsCount: number;
  activityType?: string;
  startTime?: string;
  allPointsJson: string;
  segments: Array<{
    pointIndex: number;
    distanceKm: number;
    lat: number;
    lon: number;
    arrivalDate?: string | null;
    arrivalTime?: string | null;
    wmoCode?: number | null;
    tempMax?: number | null;
    tempMin?: number | null;
    precipProb?: number | null;
    precipSum?: number | null;
    windSpeedMax?: number | null;
    windDirection?: number | null;
    lightningRisk?: string | null;
    adviceLevel?: string;
    adviceText?: string;
  }>;
}): Promise<number> {
  const db = await getDb();
  const tx = db.transaction(["routes", "segments"], "readwrite");

  const routeId = await tx.objectStore("routes").add({
    id: 0,
    name: data.name,
    distance_km: data.distanceKm,
    points_count: data.pointsCount,
    activity_type: data.activityType || null,
    start_time: data.startTime || null,
    created_at: new Date().toISOString(),
    all_points_json: data.allPointsJson,
  });

  if (data.segments.length > 0) {
    const segStore = tx.objectStore("segments");
    for (const seg of data.segments) {
      await segStore.add({
        id: 0,
        route_id: routeId,
        point_index: seg.pointIndex,
        distance_km: seg.distanceKm,
        lat: seg.lat,
        lon: seg.lon,
        arrival_date: seg.arrivalDate || null,
        arrival_time: seg.arrivalTime || null,
        wmo_code: seg.wmoCode ?? null,
        temp_max: seg.tempMax ?? null,
        temp_min: seg.tempMin ?? null,
        precip_prob: seg.precipProb ?? null,
        precip_sum: seg.precipSum ?? null,
        wind_speed_max: seg.windSpeedMax ?? null,
        wind_direction: seg.windDirection ?? null,
        lightning_risk: seg.lightningRisk ?? null,
        advice_level: seg.adviceLevel || null,
        advice_text: seg.adviceText || null,
      });
    }
  }

  await tx.done;
  return routeId;
}

export async function getAllRoutes(): Promise<
  Omit<RouteRecord, "all_points_json">[]
> {
  const db = await getDb();
  const all = await db.getAll("routes");
  all.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return all.map(({ all_points_json, ...rest }) => rest);
}

export async function getRouteById(
  id: number
): Promise<(RouteRecord & { segments: SegmentRecord[] }) | null> {
  const db = await getDb();
  const route = await db.get("routes", id);
  if (!route) return null;

  const allSegs = await db.getAllFromIndex("segments", "by-route", id);
  allSegs.sort((a, b) => a.point_index - b.point_index);

  return { ...route, segments: allSegs };
}

export async function saveWeatherCache(routeId: number, weatherJson: string): Promise<void> {
  const db = await getDb();
  await db.put("weatherCache", { routeId, weatherJson, cachedAt: new Date().toISOString() });
}

export async function getWeatherCache(routeId: number): Promise<WeatherCacheRecord | null> {
  const db = await getDb();
  const record = await db.get("weatherCache", routeId);
  return record ?? null;
}

export async function deleteRoute(id: number): Promise<boolean> {
  const db = await getDb();
  const tx = db.transaction(["routes", "segments"], "readwrite");

  const segIndex = tx.objectStore("segments").index("by-route");
  let cursor = await segIndex.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.objectStore("routes").delete(id);
  await tx.done;
  return true;
}
