export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return Response.json({ error: "请输入至少两个字的城市、区域或邮编。" }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({ name: query.slice(0, 80), count: "3", language: "zh", format: "json" });
    const upstream = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
      headers: { accept: "application/json" },
    });
    if (!upstream.ok) throw new Error("upstream unavailable");
    const payload = (await upstream.json()) as {
      results?: Array<{
        id: number;
        name: string;
        admin1?: string;
        country?: string;
        latitude: number;
        longitude: number;
      }>;
    };
    const locations = (payload.results ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      admin1: item.admin1,
      country: item.country,
      latitude: item.latitude,
      longitude: item.longitude,
    }));
    return Response.json({ locations }, { headers: { "cache-control": "public, max-age=300" } });
  } catch {
    return Response.json({ error: "地点服务暂时忙，请稍后再试。" }, { status: 503 });
  }
}
