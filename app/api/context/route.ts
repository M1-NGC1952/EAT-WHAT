export const dynamic = "force-dynamic";

type Coordinates = { latitude: number; longitude: number };

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function haversineDistance(origin: Coordinates, target: Coordinates) {
  const radius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRadians(target.latitude - origin.latitude);
  const lonDelta = toRadians(target.longitude - origin.longitude);
  const firstLat = toRadians(origin.latitude);
  const secondLat = toRadians(target.latitude);
  const value =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(lonDelta / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
}

async function loadWeather(point: Coordinates) {
  const params = new URLSearchParams({
    latitude: String(point.latitude),
    longitude: String(point.longitude),
    current: "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    timezone: "auto",
    forecast_days: "1",
  });
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const upstream = await fetchWithTimeout(
        `https://api.open-meteo.com/v1/forecast?${params}`,
        {
          headers: { accept: "application/json" },
          cache: "no-store",
        },
        4_500,
      );
      if (!upstream.ok) throw new Error("weather unavailable");
      const payload = (await upstream.json()) as {
        current?: {
          temperature_2m?: number;
          apparent_temperature?: number;
          precipitation?: number;
          weather_code?: number;
          wind_speed_10m?: number;
        };
      };
      if (!payload.current || typeof payload.current.temperature_2m !== "number") {
        throw new Error("weather response incomplete");
      }
      return payload.current;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("weather unavailable");
}

async function loadRestaurants(point: Coordinates) {
  const query = `[out:json][timeout:12];(
    node["amenity"~"^(restaurant|fast_food|cafe|food_court)$"](around:1200,${point.latitude},${point.longitude});
    way["amenity"~"^(restaurant|fast_food|cafe|food_court)$"](around:1200,${point.latitude},${point.longitude});
    relation["amenity"~"^(restaurant|fast_food|cafe|food_court)$"](around:1200,${point.latitude},${point.longitude});
  );out center tags 60;`;
  const upstream = await fetchWithTimeout(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    {
      headers: { accept: "application/json", "user-agent": "shifanfou.com-lunch-selector" },
    },
    9_000,
  );
  if (!upstream.ok) throw new Error("places unavailable");
  const payload = (await upstream.json()) as {
    elements?: Array<{
      id: number;
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat?: number; lon?: number };
      tags?: Record<string, string>;
    }>;
  };

  return (payload.elements ?? [])
    .map((item) => {
      const name = item.tags?.name?.trim();
      const latitude = item.lat ?? item.center?.lat;
      const longitude = item.lon ?? item.center?.lon;
      if (!name || latitude === undefined || longitude === undefined) return null;
      return {
        id: `${item.type}-${item.id}`,
        name,
        cuisine: item.tags?.cuisine?.replaceAll(";", " · ") || (item.tags?.amenity === "cafe" ? "咖啡轻食" : "附近餐饮"),
        distance: haversineDistance(point, { latitude, longitude }),
        delivery: item.tags?.delivery === "yes" || item.tags?.takeaway === "yes",
        latitude,
        longitude,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => item.distance <= 1_250)
    .sort((first, second) => first.distance - second.distance)
    .slice(0, 30);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return Response.json({ error: "定位坐标无效。" }, { status: 400 });
  }

  const point = { latitude, longitude };
  const [weatherResult, restaurantsResult] = await Promise.allSettled([
    loadWeather(point),
    loadRestaurants(point),
  ]);
  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  const restaurants = restaurantsResult.status === "fulfilled" ? restaurantsResult.value : [];
  const complete = Boolean(weather) && restaurants.length > 0;

  return Response.json(
    {
      weather,
      restaurants,
    },
    { headers: { "cache-control": complete ? "public, max-age=120" : "no-store" } },
  );
}
