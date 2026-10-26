import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { CREATE_LUNCH_ENTRIES_SQL, ADD_LUNCH_OWNER_KEY_SQL, CREATE_LUNCH_OWNER_DATE_INDEX_SQL, CREATE_LUNCH_USER_DATE_INDEX_SQL } from "./schema";
let database: DatabaseSync | undefined;
export async function getDb() {
  if (!database) {
    const filename = resolve(process.env.LUNCH_DB_PATH || "data/lunch.sqlite");
    mkdirSync(dirname(filename), { recursive: true });
    database = new DatabaseSync(filename);
    database.exec("PRAGMA journal_mode=WAL");
    database.exec(CREATE_LUNCH_ENTRIES_SQL);
    const columns = database.prepare("PRAGMA table_info(lunch_entries)").all();
    if (!columns.some((column) => column.name === "owner_key")) database.exec(ADD_LUNCH_OWNER_KEY_SQL);
    database.exec(CREATE_LUNCH_USER_DATE_INDEX_SQL);
    database.exec(CREATE_LUNCH_OWNER_DATE_INDEX_SQL);
  }
  const db = database;
  return { prepare(query: string) {
    let values: SQLInputValue[] = [];
    const statement = {
      bind(...input: SQLInputValue[]) { values = input; return statement; },
      async all() { return { results: db.prepare(query).all(...values), success: true }; },
      async first() { return db.prepare(query).get(...values) ?? null; },
    };
    return statement;
  }};
}
