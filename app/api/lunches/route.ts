import { getDb } from "../../../db";

export const dynamic = "force-dynamic";

type LunchPayload = {
  eatenOn?: string;
  restaurant?: string;
  dish?: string;
  mealMode?: string;
  location?: string;
  note?: string;
};

const DEVICE_COOKIE = "shifanfou_device";

function getDeviceIdentity(request: Request) {
  const rawCookie = request.headers.get("cookie") ?? "";
  const cookieValue = rawCookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${DEVICE_COOKIE}=`))
    ?.slice(DEVICE_COOKIE.length + 1);
  const existing = cookieValue && /^[a-f0-9-]{36}$/i.test(cookieValue) ? cookieValue : null;
  const deviceId = existing ?? crypto.randomUUID();
  return {
    ownerKey: `device:${deviceId}`,
    setCookie: existing
      ? null
      : `${DEVICE_COOKIE}=${deviceId}; Path=/; Max-Age=31536000; HttpOnly;${new URL(request.url).protocol === "https:" ? " Secure;" : ""} SameSite=Lax`,
  };
}

function jsonWithDeviceCookie(body: unknown, init: ResponseInit, setCookie: string | null) {
  const headers = new Headers(init.headers);
  if (setCookie) headers.set("set-cookie", setCookie);
  return Response.json(body, { ...init, headers });
}

function clean(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function GET(request: Request) {
  const identity = getDeviceIdentity(request);

  try {
    const db = await getDb();
    const result = await db
      .prepare(
        `SELECT id, eaten_on AS eatenOn, restaurant, dish, meal_mode AS mealMode,
                location, note, created_at AS createdAt
         FROM lunch_entries
         WHERE owner_key = ?
         ORDER BY eaten_on DESC, id DESC
         LIMIT 60`,
      )
      .bind(identity.ownerKey)
      .all();

    return jsonWithDeviceCookie({ entries: result.results }, { status: 200 }, identity.setCookie);
  } catch {
    return jsonWithDeviceCookie({ error: "午餐手账暂时不可用，请稍后再试。" }, { status: 503 }, identity.setCookie);
  }
}

export async function POST(request: Request) {
  const identity = getDeviceIdentity(request);

  try {
    const payload = (await request.json()) as LunchPayload;
    const eatenOn = clean(payload.eatenOn, 10);
    const restaurant = clean(payload.restaurant, 80);
    const dish = clean(payload.dish, 80);
    const mealMode = clean(payload.mealMode, 12) || "堂食";
    const location = clean(payload.location, 120);
    const note = clean(payload.note, 300);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(eatenOn) || !restaurant || !dish) {
      return Response.json({ error: "请填写日期、餐厅和餐品。" }, { status: 400 });
    }

    const db = await getDb();
    const result = await db
      .prepare(
        `INSERT INTO lunch_entries
          (user_email, owner_key, eaten_on, restaurant, dish, meal_mode, location, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id, eaten_on AS eatenOn, restaurant, dish, meal_mode AS mealMode,
                   location, note, created_at AS createdAt`,
      )
      .bind("", identity.ownerKey, eatenOn, restaurant, dish, mealMode, location, note)
      .first();

    return jsonWithDeviceCookie({ entry: result }, { status: 201 }, identity.setCookie);
  } catch {
    return jsonWithDeviceCookie({ error: "这条午餐记录没有保存成功，请稍后再试。" }, { status: 503 }, identity.setCookie);
  }
}
