CREATE TABLE IF NOT EXISTS lunch_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  eaten_on TEXT NOT NULL,
  restaurant TEXT NOT NULL,
  dish TEXT NOT NULL,
  meal_mode TEXT NOT NULL DEFAULT '堂食',
  location TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS lunch_entries_user_date_idx
ON lunch_entries (user_email, eaten_on DESC, id DESC);
