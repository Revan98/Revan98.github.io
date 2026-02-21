import sqlite3
from pathlib import Path

import pandas as pd

DB_PATH = "kvk.db"

DB_PATH = "kvk_stats.db"

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
"""
conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA foreign_keys = ON")
conn.executescript(schema_sql)
conn.commit()
conn.close()
FILES = [
    {
        "path": "C:/Users/revan/Downloads/Kopia DKP_KvK_Invictus_2247(KvK1) (1).xlsx",
        "kingdom": "2247",
        "kvk_number": 1,
        "name": "KvK1 AI",
    },
    {
        "path": "C:/Users/revan/Downloads/Kopia dkp_KoB_2024-10-30_02-58.xlsx",
        "kingdom": "2247",
        "kvk_number": 2,
        "name": "KvK2 KoB",
    },
    {
        "path": "C:/Users/revan/Downloads/Kopia DKP_KvK3_TOW.xlsx",
        "kingdom": "2247",
        "kvk_number": 3,
        "name": "KvK3 ToW",
    },
    {
        "path": "C:/Users/revan/Downloads/Kopia 2247_KvK4_HA.xlsx",
        "kingdom": "2247",
        "kvk_number": 4,
        "name": "KvK4 HA",
    },
    {
        "path": "C:/Users/revan/Downloads/Kopia KvK5_ToW_dkp_2025-09-01_13-17.xlsx",
        "kingdom": "2247",
        "kvk_number": 5,
        "name": "KvK5 ToW",
    },
    {
        "path": "C:/Users/revan/Downloads/Kopia 2247_KvK6_DKP.xlsx",
        "kingdom": "2247",
        "kvk_number": 6,
        "name": "KvK6 ToW",
    },
]


# =========================
# SAFE CASTING
# =========================
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


# def normalize_date(sheet_name: str) -> str:
#     if "_" in sheet_name and len(sheet_name) == 10:
#         d, m, y = sheet_name.split("_")
#         return f"{y}-{m}-{d}"
#     return sheet_name


def normalize_date(sheet_name: str | int) -> str:
    sheet_name = str(sheet_name)
    if "_" in sheet_name and len(sheet_name) == 10:
        d, m, y = sheet_name.split("_")
        return f"{y}-{m}-{d}"
    return sheet_name


# =========================
# IMPORT
# =========================
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("UPDATE kvks SET is_latest = 0")
cur.execute("UPDATE snapshots SET is_last = 0")
conn.commit()

for cfg in FILES:
    path = Path(cfg["path"])
    if not path.exists():
        print(f"❌ Missing file: {path}")
        continue

    print(f"📥 Importing {path.name}")

    # cur.execute("""
    #     INSERT INTO kvks (kingdom, kvk_number, name, is_latest)
    #     VALUES (?, ?, ?, 0)
    # """, (cfg["kingdom"], cfg["kvk_number"], cfg["name"]))

    # kvk_id = cur.lastrowid
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
            governor_id = to_text(r[0], "")
            name = to_text(r[1], "")

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
                    to_int(r[2]),  # power
                    to_int(r[14]),  # kill_points
                    to_int(r[12]),  # t4
                    to_int(r[13]),  # t5
                    to_int(r[15]),  # deads
                    to_int(r[16]),  # power_diff
                    to_int(r[3]),  # kp_diff
                    to_int(r[4]),  # t4_diff
                    to_int(r[5]),  # t5_diff
                    to_int(r[6]),  # deads_diff
                    to_int(r[7]),  # min DKP
                    to_int(r[8]),  # dkp
                    to_float(r[9]),  # dkp_percent
                    to_text(r[10], "NO"),  # Vacation
                    to_text(r[11], "OK"),  # status
                    to_int(r[17]),  # acclaim
                ),
            )

    if last_snapshot_id:
        cur.execute(
            "UPDATE snapshots SET is_last = 1 WHERE id = ?", (last_snapshot_id,)
        )

    cur.execute("UPDATE kvks SET is_latest = 1 WHERE id = ?", (kvk_id,))

    conn.commit()

conn.close()
print("✅ Import completed successfully")
