"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Coordinates = { latitude: number; longitude: number };
type MealMode = "auto" | "dine" | "delivery";
type LocationState = "idle" | "loading" | "ready" | "error";
type WeatherState = "idle" | "loading" | "ready" | "error";

type Weather = {
  temperature: number;
  apparentTemperature: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
  label: string;
  icon: string;
  recommendedMode: Exclude<MealMode, "auto">;
  reason: string;
};

type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  distance: number;
  delivery: boolean;
  latitude: number | null;
  longitude: number | null;
};

type Suggestion = {
  restaurant: Restaurant;
  dish: string;
  mode: Exclude<MealMode, "auto">;
  needsDeliveryCheck: boolean;
};

type LunchEntry = {
  id: number;
  eatenOn: string;
  restaurant: string;
  dish: string;
  mealMode: string;
  location: string;
  note: string;
  createdAt: string;
};

const fallbackRestaurants: Restaurant[] = [
  { id: "sample-1", name: "巷口米饭铺", cuisine: "中式快餐", distance: 360, delivery: true, latitude: null, longitude: null },
  { id: "sample-2", name: "今日面馆", cuisine: "面食", distance: 520, delivery: true, latitude: null, longitude: null },
  { id: "sample-3", name: "绿碗轻食", cuisine: "轻食", distance: 680, delivery: true, latitude: null, longitude: null },
  { id: "sample-4", name: "小熊咖喱", cuisine: "咖喱", distance: 740, delivery: false, latitude: null, longitude: null },
  { id: "sample-5", name: "云朵馄饨", cuisine: "馄饨", distance: 890, delivery: false, latitude: null, longitude: null },
  { id: "sample-6", name: "滚烫麻辣烫", cuisine: "麻辣烫", distance: 1060, delivery: true, latitude: null, longitude: null },
];

const dishMap: Array<{ keys: string[]; dishes: string[] }> = [
  { keys: ["noodle", "ramen", "面", "馄饨"], dishes: ["招牌牛肉面", "番茄鸡蛋面", "红油馄饨"] },
  { keys: ["cafe", "coffee", "轻食", "salad"], dishes: ["鸡肉谷物碗", "牛油果三明治", "时蔬能量沙拉"] },
  { keys: ["korean", "韩国"], dishes: ["石锅拌饭", "泡菜肥牛饭", "部队锅"] },
  { keys: ["japanese", "sushi", "日本"], dishes: ["照烧鸡肉饭", "咖喱猪排饭", "寿喜烧牛肉饭"] },
  { keys: ["pizza", "italian", "意式"], dishes: ["玛格丽特披萨", "番茄肉酱意面", "奶油蘑菇意面"] },
  { keys: ["burger", "western", "西式"], dishes: ["经典牛肉汉堡", "烤鸡腿堡", "薯角套餐"] },
  { keys: ["hot_pot", "麻辣烫", "火锅"], dishes: ["自选麻辣烫", "番茄冒菜", "麻酱拌菜"] },
  { keys: ["curry", "咖喱"], dishes: ["咖喱鸡肉饭", "咖喱牛腩饭", "蔬菜咖喱饭"] },
  { keys: ["chinese", "中式", "rice", "快餐"], dishes: ["招牌双拼饭", "番茄炒蛋饭", "小炒肉盖饭"] },
];

const defaultDishes = ["本店招牌饭", "今日限定套餐", "老板推荐单品"];

function todayString() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function weatherDescription(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "晴朗", icon: "☀️" };
  if ([1, 2].includes(code)) return { label: "晴间多云", icon: "🌤️" };
  if (code === 3) return { label: "阴天", icon: "☁️" };
  if ([45, 48].includes(code)) return { label: "有雾", icon: "🌫️" };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { label: "有雨", icon: "🌧️" };
  if ((code >= 71 && code <= 77) || [85, 86].includes(code)) return { label: "有雪", icon: "🌨️" };
  if (code >= 95) return { label: "雷雨", icon: "⛈️" };
  return { label: "天气多变", icon: "🌥️" };
}

function modeFromWeather(current: Omit<Weather, "label" | "icon" | "recommendedMode" | "reason">) {
  if (current.precipitation >= 0.3 || current.weatherCode >= 51) {
    return { recommendedMode: "delivery" as const, reason: "外面有降水，今天少走几步更舒服" };
  }
  if (current.windSpeed >= 30) {
    return { recommendedMode: "delivery" as const, reason: "风有点大，适合让午餐来找你" };
  }
  if (current.apparentTemperature <= 3 || current.apparentTemperature >= 35) {
    return { recommendedMode: "delivery" as const, reason: "体感温度不太友好，推荐外卖" };
  }
  return { recommendedMode: "dine" as const, reason: "天气适合出门，顺便活动十几分钟" };
}

function dishForCuisine(cuisine: string, seed: number) {
  const normalized = cuisine.toLowerCase();
  const group = dishMap.find(({ keys }) => keys.some((key) => normalized.includes(key.toLowerCase())));
  const dishes = group?.dishes ?? defaultDishes;
  return dishes[seed % dishes.length];
}

function prettyDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", weekday: "short" }).format(date);
}

export default function LunchApp() {
  const [activeTab, setActiveTab] = useState<"choose" | "journal">("choose");
  const [locationInput, setLocationInput] = useState("");
  const [locationLabel, setLocationLabel] = useState("还没有设置午餐起点");
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState("先定位，我们只看步行 15 分钟左右的选择");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherState, setWeatherState] = useState<WeatherState>("idle");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [dataSource, setDataSource] = useState<"osm" | "fallback" | null>(null);
  const [mealMode, setMealMode] = useState<MealMode>("auto");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [journalEntries, setJournalEntries] = useState<LunchEntry[]>([]);
  const [journalStatus, setJournalStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [journalMessage, setJournalMessage] = useState("");
  const [form, setForm] = useState({
    eatenOn: todayString(),
    restaurant: "",
    dish: "",
    mealMode: "堂食",
    note: "",
  });

  const effectiveMode = mealMode === "auto" ? weather?.recommendedMode ?? "dine" : mealMode;
  const dineCount = restaurants.length;
  const deliveryCount = restaurants.filter((restaurant) => restaurant.delivery).length;

  const visibleRestaurants = useMemo(() => restaurants.slice(0, 8), [restaurants]);

  useEffect(() => {
    if (activeTab !== "journal") return;

    let cancelled = false;
    setJournalStatus("loading");
    fetch("/api/lunches")
      .then(async (response) => {
        const payload = (await response.json()) as { entries?: LunchEntry[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "读取失败");
        if (!cancelled) setJournalEntries(payload.entries ?? []);
      })
      .catch((error: unknown) => {
        if (!cancelled) setJournalMessage(error instanceof Error ? error.message : "手账读取失败");
      })
      .finally(() => {
        if (!cancelled) setJournalStatus("idle");
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  async function hydrateLocation(point: Coordinates, label: string) {
    setLocationState("loading");
    setCoordinates(point);
    setLocationInput(label);
    setLocationLabel(label);
    setLocationMessage("正在看看附近有什么，也顺便问问天气");
    setWeather(null);
    setWeatherState("loading");
    setSuggestion(null);
    let didLoadWeather = false;

    try {
      const params = new URLSearchParams({ lat: String(point.latitude), lon: String(point.longitude) });
      const response = await fetch(`/api/context?${params}`);
      if (!response.ok) throw new Error("附近信息暂时忙");
      const payload = (await response.json()) as {
        weather?: {
          temperature_2m?: number;
          apparent_temperature?: number;
          precipitation?: number;
          weather_code?: number;
          wind_speed_10m?: number;
        } | null;
        restaurants?: Restaurant[];
      };
      if (payload.weather) {
        const base = {
          temperature: payload.weather.temperature_2m ?? 22,
          apparentTemperature: payload.weather.apparent_temperature ?? payload.weather.temperature_2m ?? 22,
          precipitation: payload.weather.precipitation ?? 0,
          windSpeed: payload.weather.wind_speed_10m ?? 0,
          weatherCode: payload.weather.weather_code ?? 0,
        };
        const currentWeather = { ...base, ...weatherDescription(base.weatherCode), ...modeFromWeather(base) };
        setWeather(currentWeather);
        setWeatherState("ready");
        didLoadWeather = true;
        setForm((current) => ({ ...current, mealMode: currentWeather.recommendedMode === "dine" ? "堂食" : "外卖" }));
      } else {
        setWeather(null);
        setWeatherState("error");
      }
      if ((payload.restaurants?.length ?? 0) >= 3) {
        setRestaurants(payload.restaurants ?? []);
        setDataSource("osm");
      } else {
        setRestaurants(fallbackRestaurants);
        setDataSource("fallback");
      }
    } catch {
      setWeather(null);
      setWeatherState("error");
      setRestaurants(fallbackRestaurants);
      setDataSource("fallback");
    }

    setLocationState("ready");
    setLocationMessage(
      didLoadWeather
        ? "午餐圈已准备好，现在只差按下那个按钮"
        : "附近候选已准备好；天气暂时没取到，可以点天气卡重试",
    );
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocationState("error");
      setLocationMessage("浏览器不支持定位，请输入城市或区域名称");
      return;
    }

    setLocationState("loading");
    setLocationMessage("正在获取你的位置…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          latitude: Number(position.coords.latitude.toFixed(5)),
          longitude: Number(position.coords.longitude.toFixed(5)),
        };
        const label = `当前位置 · ${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}`;
        void hydrateLocation(point, label);
      },
      () => {
        setLocationState("error");
        setLocationMessage("没有取得定位权限，也可以输入城市、商圈或邮编");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  async function searchLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = locationInput.trim();
    if (query.length < 2) {
      setLocationState("error");
      setLocationMessage("请输入至少两个字的城市、区域或邮编");
      return;
    }

    setLocationState("loading");
    setLocationMessage("正在寻找这个午餐起点…");
    try {
      const params = new URLSearchParams({ q: query });
      const response = await fetch(`/api/locations?${params}`);
      if (!response.ok) throw new Error("地点搜索失败");
      const payload = (await response.json()) as {
        locations?: Array<{ name: string; admin1?: string; country?: string; latitude: number; longitude: number }>;
      };
      const result = payload.locations?.[0];
      if (!result) throw new Error("没有找到这个地点");
      const label = [result.name, result.admin1, result.country].filter(Boolean).join(" · ");
      await hydrateLocation({ latitude: result.latitude, longitude: result.longitude }, label);
    } catch (error) {
      setLocationState("error");
      setLocationMessage(error instanceof Error ? error.message : "地点搜索失败");
    }
  }

  function chooseLunch() {
    if (locationState !== "ready" || restaurants.length === 0 || isRolling) return;
    setIsRolling(true);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      const mode = effectiveMode;
      const deliveryOptions = restaurants.filter((restaurant) => restaurant.delivery);
      const options = mode === "delivery" && deliveryOptions.length >= 2 ? deliveryOptions : restaurants;
      const seed = Date.now();
      const restaurant = options[seed % options.length];
      setSuggestion({
        restaurant,
        dish: dishForCuisine(restaurant.cuisine, seed),
        mode,
        needsDeliveryCheck: mode === "delivery" && !restaurant.delivery,
      });
      setIsRolling(false);
    }, reduceMotion ? 0 : 620);
  }

  function putSuggestionInJournal() {
    if (!suggestion) return;
    setForm((current) => ({
      ...current,
      restaurant: suggestion.restaurant.name,
      dish: suggestion.dish,
      mealMode: suggestion.mode === "dine" ? "堂食" : "外卖",
    }));
    setActiveTab("journal");
    setJournalMessage("");
  }

  async function saveJournal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJournalStatus("saving");
    setJournalMessage("");
    try {
      const response = await fetch("/api/lunches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          location: coordinates ? locationLabel : "",
        }),
      });
      const payload = (await response.json()) as { entry?: LunchEntry; error?: string };
      if (!response.ok || !payload.entry) throw new Error(payload.error ?? "保存失败");
      setJournalEntries((current) => [payload.entry as LunchEntry, ...current]);
      setJournalMessage("记好了。未来的你会感谢这顿没有被忘掉的午餐。");
      setForm((current) => ({ ...current, restaurant: "", dish: "", note: "" }));
    } catch (error) {
      setJournalMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setJournalStatus("idle");
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="今天吃什么首页">
          <span className="brand-stamp" aria-hidden="true">吃</span>
          <span>今天吃什么</span>
        </a>
        <nav className="tabs" aria-label="主要导航">
          <button className={activeTab === "choose" ? "active" : ""} onClick={() => setActiveTab("choose")}>帮我选</button>
          <button className={activeTab === "journal" ? "active" : ""} onClick={() => setActiveTab("journal")}>午餐手账</button>
        </nav>
        <div className="account-pill" title="无需登录，午餐手账保存在当前设备">
          <span aria-hidden="true">✓</span>
          <strong>微信内直接用</strong>
          <small>免登录</small>
        </div>
      </header>

      {activeTab === "choose" ? (
        <section className="chooser-page" id="top">
          <div className="hero-copy">
            <p className="eyebrow"><span>午休时间有限</span><span>选择困难无限</span></p>
            <h1>把今天的午餐，<br /><em>交给一点运气。</em></h1>
            <p className="hero-lead">定位附近、看看天气、随机一家。少纠结十分钟，多好好吃一顿。</p>

            <div className="steps" aria-label="使用步骤">
              <span><b>01</b> 找到你</span>
              <span><b>02</b> 看看天</span>
              <span><b>03</b> 替你选</span>
            </div>

            <form className="location-form" onSubmit={searchLocation}>
              <label htmlFor="location">午餐从哪里出发？</label>
              <div className="location-controls">
                <input
                  id="location"
                  value={locationInput}
                  onChange={(event) => setLocationInput(event.target.value)}
                  placeholder="输入城市、商圈或邮编"
                  autoComplete="street-address"
                />
                <button type="submit" disabled={locationState === "loading"}>查找</button>
              </div>
              <button className="locate-link" type="button" onClick={useMyLocation} disabled={locationState === "loading"}>
                <span aria-hidden="true">⌖</span> 使用我的当前位置
              </button>
            </form>

            <div className={`location-note ${locationState}`} role="status">
              <span className="status-dot" aria-hidden="true" />
              <div><strong>{locationLabel}</strong><small>{locationMessage}</small></div>
            </div>
          </div>

          <div className="lunchbox" aria-label="午餐选择器">
            <div className="weather-card lunchbox-cell">
              <div className="cell-label">今日天气</div>
              {weather ? (
                <>
                  <div className="weather-main"><span aria-hidden="true">{weather.icon}</span><strong>{Math.round(weather.temperature)}°</strong></div>
                  <p>{weather.label} · 体感 {Math.round(weather.apparentTemperature)}°</p>
                  <div className="weather-advice">
                    <b>{weather.recommendedMode === "dine" ? "适合堂食" : "推荐外卖"}</b>
                    <span>{weather.reason}</span>
                  </div>
                </>
              ) : weatherState === "loading" ? (
                <div className="empty-weather loading" role="status">
                  <span aria-hidden="true">⛅</span>
                  <p>正在读取<br />当地天气…</p>
                </div>
              ) : weatherState === "error" ? (
                <div className="empty-weather error" role="status">
                  <span aria-hidden="true">🌥️</span>
                  <div>
                    <p>天气暂时没取到<br />不影响帮你选午餐</p>
                    <button
                      className="weather-retry"
                      type="button"
                      onClick={() => {
                        if (coordinates) void hydrateLocation(coordinates, locationLabel);
                      }}
                      disabled={!coordinates}
                    >
                      重试天气
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-weather"><span aria-hidden="true">🌤️</span><p>设置地点后<br />查看午餐天气</p></div>
              )}
            </div>

            <div className="mode-card lunchbox-cell">
              <div className="cell-label">今天怎么吃</div>
              <div className="mode-toggle" role="group" aria-label="用餐方式">
                <button className={mealMode === "auto" ? "selected" : ""} onClick={() => setMealMode("auto")}><span>✨</span>智能</button>
                <button className={mealMode === "dine" ? "selected" : ""} onClick={() => setMealMode("dine")}><span>🚶</span>堂食</button>
                <button className={mealMode === "delivery" ? "selected" : ""} onClick={() => setMealMode("delivery")}><span>🛵</span>外卖</button>
              </div>
              <p className="mode-summary">当前：<strong>{effectiveMode === "dine" ? "出去走走" : "送到手边"}</strong></p>
              <div className="mode-counts"><span>{dineCount}<small>附近候选</small></span><span>{deliveryCount}<small>标记可外带/配送</small></span></div>
            </div>

            <div className="result-card lunchbox-cell">
              <div className="cell-label">命运的午餐</div>
              {suggestion ? (
                <div className="result-content">
                  <div className="result-emoji" aria-hidden="true">🍚</div>
                  <div>
                    <p className="result-kicker">今天就吃</p>
                    <h2>{suggestion.restaurant.name}</h2>
                    <p className="dish-name">{suggestion.dish}</p>
                    <p className="result-meta">约 {Math.max(4, Math.round(suggestion.restaurant.distance / 80))} 分钟 · {suggestion.mode === "dine" ? "堂食" : "外卖"}</p>
                    {suggestion.needsDeliveryCheck && <small className="delivery-note">请在常用外卖平台确认配送范围</small>}
                  </div>
                </div>
              ) : (
                <div className={`result-empty ${isRolling ? "rolling" : ""}`}>
                  <span aria-hidden="true">{isRolling ? "🍜" : "?"}</span>
                  <p>{isRolling ? "正在认真乱选…" : "点击按钮，看看今天和谁有缘"}</p>
                </div>
              )}
              <button className="journal-shortcut" onClick={putSuggestionInJournal} disabled={!suggestion}>把结果写进手账 <span aria-hidden="true">→</span></button>
            </div>

            <div className="map-card lunchbox-cell">
              <div className="map-heading"><div><span>步行 15 分钟餐食圈</span><strong>{locationState === "ready" ? `${restaurants.length} 个候选` : "等待定位"}</strong></div>{coordinates && <a href={`https://uri.amap.com/marker?position=${coordinates.longitude},${coordinates.latitude}&name=${encodeURIComponent("午餐起点")}&callnative=0`} target="_blank" rel="noreferrer">高德地图 ↗</a>}</div>
              <div className="mini-map" aria-label="附近餐饮位置示意图">
                <div className="map-origin" aria-label="你的位置">我</div>
                {visibleRestaurants.map((restaurant, index) => (
                  <span
                    className="map-pin"
                    key={restaurant.id}
                    style={{ left: `${16 + ((index * 29) % 69)}%`, top: `${14 + ((index * 37) % 70)}%` }}
                    title={`${restaurant.name} · ${restaurant.distance}米`}
                  />
                ))}
              </div>
              <p className="map-attribution">{dataSource === "osm" ? "附近餐饮数据 © OpenStreetMap contributors" : dataSource === "fallback" ? "附近数据忙碌中，当前使用演示候选" : "定位后生成附近餐饮候选"}</p>
            </div>

            <button className="choose-button" onClick={chooseLunch} disabled={locationState !== "ready" || isRolling}>
              <span>{isRolling ? "正在选择" : "帮我选择吧"}</span><b aria-hidden="true">→</b>
            </button>
          </div>
        </section>
      ) : (
        <section className="journal-page">
          <div className="journal-intro">
            <p className="eyebrow"><span>午餐手账</span><span>一点点生活证据</span></p>
            <h1>原来日子，<br />也可以按<em>午餐</em>翻阅。</h1>
            <p>不要求打卡，也不评价热量。只记住今天真实吃了什么，以及那顿饭有没有让你开心一点。</p>
            <div className="signin-note">
              <span aria-hidden="true">📱</span>
              <div><strong>无需登录，打开就能记</strong><p>手账与当前微信或浏览器设备绑定，请不要清理网站数据。</p></div>
            </div>
          </div>

          <div className="journal-workspace">
            <form className="journal-form" onSubmit={saveJournal}>
              <div className="form-heading"><span>记录一顿午餐</span><small>不必是刚刚随机到的那顿</small></div>
              <div className="form-row">
                <label>日期<input type="date" value={form.eatenOn} onChange={(event) => setForm({ ...form, eatenOn: event.target.value })} required /></label>
                <label>方式<select value={form.mealMode} onChange={(event) => setForm({ ...form, mealMode: event.target.value })}><option>堂食</option><option>外卖</option><option>自带</option></select></label>
              </div>
              <label>餐厅<input value={form.restaurant} onChange={(event) => setForm({ ...form, restaurant: event.target.value })} placeholder="今天在哪儿吃的？" maxLength={80} required /></label>
              <label>餐品<input value={form.dish} onChange={(event) => setForm({ ...form, dish: event.target.value })} placeholder="具体吃了什么？" maxLength={80} required /></label>
              <label>随手记<textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="比如：窗口位晒得到太阳，汤有一点咸。" maxLength={300} rows={3} /></label>
              <button className="save-button" type="submit" disabled={journalStatus === "saving"}>{journalStatus === "saving" ? "正在记下…" : "记下这顿午餐"}<span aria-hidden="true">＋</span></button>
              {journalMessage && <p className="journal-message" role="status">{journalMessage}</p>}
            </form>

            <div className="journal-list">
              <div className="list-heading"><span>最近的午餐</span><strong>{`${journalEntries.length} 条`}</strong></div>
              {journalStatus === "loading" ? (
                <div className="list-empty">正在翻开你的午餐手账…</div>
              ) : journalEntries.length > 0 ? (
                journalEntries.map((entry) => (
                  <article key={entry.id}>
                    <time dateTime={entry.eatenOn}>{prettyDate(entry.eatenOn)}</time>
                    <div><h3>{entry.dish}</h3><p>{entry.restaurant}{entry.location ? ` · ${entry.location}` : ""}</p>{entry.note && <blockquote>{entry.note}</blockquote>}</div>
                    <span>{entry.mealMode}</span>
                  </article>
                ))
              ) : (
                <div className="list-empty"><span aria-hidden="true">🥣</span><strong>手账还是空的</strong><p>第一条不必特别。普通午餐也值得被记住。</p></div>
              )}
            </div>
          </div>
        </section>
      )}

      <footer>
        <span>今天吃什么 · 午餐选择器 MVP</span>
        <span>本站中转天气与餐饮查询 · 地图入口：高德地图</span>
      </footer>
    </main>
  );
}
