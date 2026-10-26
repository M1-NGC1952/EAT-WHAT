ALTER TABLE lunch_entries ADD COLUMN owner_key TEXT NOT NULL DEFAULT '';

UPDATE lunch_entries
SET owner_key = CASE
  WHEN user_email = '' THEN 'legacy:anonymous'
  ELSE 'chatgpt:' || user_email
END
WHERE owner_key = '';

CREATE INDEX IF NOT EXISTS lunch_entries_owner_date_idx
ON lunch_entries (owner_key, eaten_on DESC, id DESC);
