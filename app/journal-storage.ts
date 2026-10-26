export type LunchEntry = {
  id: number;
  eatenOn: string;
  restaurant: string;
  dish: string;
  mealMode: string;
  location: string;
  note: string;
  createdAt: string;
};

const STORAGE_KEY = "shifanfou.journal.v1";

export function readJournal(storage: Pick<Storage, "getItem">): LunchEntry[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries) || !entries.every((entry) =>
    entry && typeof entry === "object" && Number.isSafeInteger(entry.id) &&
    ["eatenOn", "restaurant", "dish", "mealMode", "location", "note", "createdAt"].every(
      (field) => typeof entry[field] === "string",
    ))) {
    throw new Error("手账数据无法读取，请保留当前网站数据后重试。");
  }
  return entries.sort((a, b) => b.eatenOn.localeCompare(a.eatenOn) || b.id - a.id);
}

export function saveJournalEntry(
  storage: Pick<Storage, "getItem" | "setItem">,
  input: Omit<LunchEntry, "id" | "createdAt">,
): LunchEntry[] {
  const entries = readJournal(storage);
  const clean = (value: string, limit: number) => value.trim().slice(0, limit);
  const entry: LunchEntry = {
    id: Math.max(Date.now(), ...entries.map((item) => item.id + 1)),
    createdAt: new Date().toISOString(),
    eatenOn: clean(input.eatenOn, 10),
    restaurant: clean(input.restaurant, 80),
    dish: clean(input.dish, 80),
    mealMode: clean(input.mealMode, 12),
    location: clean(input.location, 120),
    note: clean(input.note, 300),
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.eatenOn) || !entry.restaurant || !entry.dish) {
    throw new Error("请填写日期、餐厅和餐品。");
  }
  const next = [entry, ...entries].sort((a, b) => b.eatenOn.localeCompare(a.eatenOn) || b.id - a.id);
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
