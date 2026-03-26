import sqlite3
from pathlib import Path

import pandas as pd

DB_PATH = "kvk.db"


schema_sql = """
PRAGMA foreign_keys = ON;

-- kvks
CREATE TABLE IF NOT EXISTS kvks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kingdom TEXT,
  kvk_number INTEGER,
  name TEXT,
  is_latest INTEGER DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kvks_unique
ON kvks (kingdom, kvk_number);

-- snapshots (worksheets)
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kvk_id INTEGER,
  snapshot_date TEXT,
  is_last INTEGER DEFAULT 0,
  UNIQUE (kvk_id, snapshot_date),
  FOREIGN KEY (kvk_id) REFERENCES kvks(id)
);

-- governors
CREATE TABLE IF NOT EXISTS governors (
  governor_id TEXT,
  kingdom TEXT,
  name TEXT,
  PRIMARY KEY (governor_id, kingdom)
);

-- stats (core table)
CREATE TABLE IF NOT EXISTS stats (
  snapshot_id INTEGER,
  governor_id TEXT,

  power INTEGER,
  kill_points INTEGER,
  t4 INTEGER,
  t5 INTEGER,
  deads INTEGER,

  power_diff INTEGER,
  kp_diff INTEGER,
  t4_diff INTEGER,
  t5_diff INTEGER,
  deads_diff INTEGER,
  min_dkp INTEGER,
  dkp INTEGER,
  dkp_percent REAL,
  vacation TEXT,
  status TEXT,
  acclaim INTEGER,

  PRIMARY KEY (snapshot_id, governor_id),
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id)
);

-- farm accounts
CREATE TABLE IF NOT EXISTS farm_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  player_id INTEGER,
  power INTEGER,
  killpoints INTEGER,
  deads INTEGER,
  ch INTEGER,
  acc_type TEXT,
  main_id INTEGER
);
"""
conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA foreign_keys = ON")
conn.executescript(schema_sql)
conn.commit()
conn.close()

FILES = []

FARM_FILES = [
    {
        "path": "F:/2247-farms.xlsx",
    },
]


def to_int(v):
    if pd.isna(v) or v == "":
        return 0
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def to_float(v):
    if pd.isna(v) or v == "":
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def to_text(v, default):
    if pd.isna(v) or str(v).strip() == "":
        return default
    return str(v).strip()


def normalize_date(sheet_name: str | int) -> str:
    sheet_name = str(sheet_name)
    if "_" in sheet_name and len(sheet_name) == 10:
        d, m, y = sheet_name.split("_")
        return f"{y}-{m}-{d}"
    return sheet_name


# KvK import

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

for cfg in FILES:
    path = Path(cfg["path"])
    if not path.exists():
        print(f"❌ Missing file: {path}")
        continue

    print(f"📥 Importing {path.name}")

    cur.execute(
        """
        SELECT id FROM kvks
        WHERE kingdom = ? AND kvk_number = ?
    """,
        (cfg["kingdom"], cfg["kvk_number"]),
    )

    row = cur.fetchone()

    if row:
        kvk_id = row[0]
    else:
        cur.execute(
            """
            INSERT INTO kvks (kingdom, kvk_number, name, is_latest)
            VALUES (?, ?, ?, 0)
        """,
            (cfg["kingdom"], cfg["kvk_number"], cfg["name"]),
        )
        kvk_id = cur.lastrowid

    cur.execute("UPDATE kvks SET is_latest = 0 WHERE kingdom = ?", (cfg["kingdom"],))
    cur.execute("UPDATE snapshots SET is_last = 0 WHERE kvk_id = ?", (kvk_id,))
    conn.commit()

    xls = pd.ExcelFile(path)
    last_snapshot_id = None

    for sheet_name in xls.sheet_names:
        df = xls.parse(sheet_name)
        snapshot_date = normalize_date(sheet_name)

        cur.execute(
            """
            INSERT OR IGNORE INTO snapshots (kvk_id, snapshot_date)
            VALUES (?, ?)
        """,
            (kvk_id, snapshot_date),
        )

        cur.execute(
            """
            SELECT id FROM snapshots
            WHERE kvk_id = ? AND snapshot_date = ?
        """,
            (kvk_id, snapshot_date),
        )

        snapshot_id = cur.fetchone()[0]
        last_snapshot_id = snapshot_id

        for _, r in df.iterrows():
            governor_id = to_int(r.iloc[0])
            name = to_text(r.iloc[1], "")

            if not governor_id:
                continue

            cur.execute(
                """
                INSERT OR IGNORE INTO governors (governor_id, kingdom, name)
                VALUES (?, ?, ?)
            """,
                (governor_id, cfg["kingdom"], name),
            )

            cur.execute(
                """
                INSERT OR REPLACE INTO stats VALUES (
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            """,
                (
                    snapshot_id,
                    governor_id,
                    to_int(r.iloc[2]),  # power
                    to_int(r.iloc[14]),  # kill_points
                    to_int(r.iloc[12]),  # t4
                    to_int(r.iloc[13]),  # t5
                    to_int(r.iloc[15]),  # deads
                    to_int(r.iloc[16]),  # power_diff
                    to_int(r.iloc[3]),  # kp_diff
                    to_int(r.iloc[4]),  # t4_diff
                    to_int(r.iloc[5]),  # t5_diff
                    to_int(r.iloc[6]),  # deads_diff
                    to_int(r.iloc[7]),  # min DKP
                    to_int(r.iloc[8]),  # dkp
                    to_float(r.iloc[9]),  # dkp_percent
                    to_text(r.iloc[10], "NO"),  # Vacation
                    to_text(r.iloc[11], "OK"),  # status
                    to_int(r.iloc[17]),  # acclaim
                ),
            )

    if last_snapshot_id:
        cur.execute(
            "UPDATE snapshots SET is_last = 1 WHERE id = ?", (last_snapshot_id,)
        )

    cur.execute("UPDATE kvks SET is_latest = 1 WHERE id = ?", (kvk_id,))

    conn.commit()

conn.close()
print("✅ KvK import completed successfully")

# Farm accounts import

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

for cfg in FARM_FILES:
    path = Path(cfg["path"])
    if not path.exists():
        print(f"❌ Missing file: {path}")
        continue

    print(f"📥 Importing farm accounts from {path.name}")

    xls = pd.ExcelFile(path)

    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name)
        df.columns = [col.strip().lower() for col in df.columns]

        for _, r in df.iterrows():
            cur.execute(
                """
                INSERT INTO farm_accounts (name, player_id, power, killpoints, deads, ch, acc_type, main_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    to_text(r.get("name"), ""),
                    to_int(r.get("id")),
                    to_int(r.get("power")),
                    to_int(r.get("killpoints")),
                    to_int(r.get("deads")),
                    to_int(r.get("ch")),
                    to_text(r.get("acc_type"), ""),
                    to_int(r.get("main_id")),
                ),
            )

    conn.commit()

conn.close()
print("✅ Farm accounts import completed successfully")
