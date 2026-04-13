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

-- equipment
CREATE TABLE IF NOT EXISTS equipment (
  player_id INTEGER PRIMARY KEY,
  name TEXT,
  acc_type TEXT,

  helm TEXT, helm_lvl INTEGER, helm_tal TEXT,
  chest TEXT, chest_lvl INTEGER, chest_tal TEXT,
  weapon TEXT, weapon_lvl INTEGER, weapon_tal TEXT,
  gloves TEXT, gloves_lvl INTEGER, gloves_tal TEXT,
  legs TEXT, legs_lvl INTEGER, legs_tal TEXT,
  accessory TEXT, accessory_lvl INTEGER, accessory_tal TEXT,
  accessory_sec TEXT, accessory_sec_lvl INTEGER, accessory_sec_tal TEXT,
  boots TEXT, boots_lvl INTEGER, boots_tal TEXT,
 
  helm_2 TEXT, helm_lvl_2 INTEGER, helm_tal_2 TEXT,
  chest_2 TEXT, chest_lvl_2 INTEGER, chest_tal_2 TEXT,
  weapon_2 TEXT, weapon_lvl_2 INTEGER, weapon_tal_2 TEXT,
  gloves_2 TEXT, gloves_lvl_2 INTEGER, gloves_tal_2 TEXT,
  legs_2 TEXT, legs_lvl_2 INTEGER, legs_tal_2 TEXT,
  accessory_2 TEXT, accessory_lvl_2 INTEGER, accessory_tal_2 TEXT,
  accessory_sec_2 TEXT, accessory_sec_lvl_2 INTEGER, accessory_sec_tal_2 TEXT,
  boots_2 TEXT, boots_lvl_2 INTEGER, boots_tal_2 TEXT,
 
  helm_3 TEXT, helm_lvl_3 INTEGER, helm_tal_3 TEXT,
  chest_3 TEXT, chest_lvl_3 INTEGER, chest_tal_3 TEXT,
  weapon_3 TEXT, weapon_lvl_3 INTEGER, weapon_tal_3 TEXT,
  gloves_3 TEXT, gloves_lvl_3 INTEGER, gloves_tal_3 TEXT,
  legs_3 TEXT, legs_lvl_3 INTEGER, legs_tal_3 TEXT,
  accessory_3 TEXT, accessory_lvl_3 INTEGER, accessory_tal_3 TEXT,
  accessory_sec_3 TEXT, accessory_sec_lvl_3 INTEGER, accessory_sec_tal_3 TEXT,
  boots_3 TEXT, boots_lvl_3 INTEGER, boots_tal_3 TEXT,
 
  helm_4 TEXT, helm_lvl_4 INTEGER, helm_tal_4 TEXT,
  chest_4 TEXT, chest_lvl_4 INTEGER, chest_tal_4 TEXT,
  weapon_4 TEXT, weapon_lvl_4 INTEGER, weapon_tal_4 TEXT,
  gloves_4 TEXT, gloves_lvl_4 INTEGER, gloves_tal_4 TEXT,
  legs_4 TEXT, legs_lvl_4 INTEGER, legs_tal_4 TEXT,
  accessory_4 TEXT, accessory_lvl_4 INTEGER, accessory_tal_4 TEXT,
  accessory_sec_4 TEXT, accessory_sec_lvl_4 INTEGER, accessory_sec_tal_4 TEXT,
  boots_4 TEXT, boots_lvl_4 INTEGER, boots_tal_4 TEXT,
 
  helm_5 TEXT, helm_lvl_5 INTEGER, helm_tal_5 TEXT,
  chest_5 TEXT, chest_lvl_5 INTEGER, chest_tal_5 TEXT,
  weapon_5 TEXT, weapon_lvl_5 INTEGER, weapon_tal_5 TEXT,
  gloves_5 TEXT, gloves_lvl_5 INTEGER, gloves_tal_5 TEXT,
  legs_5 TEXT, legs_lvl_5 INTEGER, legs_tal_5 TEXT,
  accessory_5 TEXT, accessory_lvl_5 INTEGER, accessory_tal_5 TEXT,
  accessory_sec_5 TEXT, accessory_sec_lvl_5 INTEGER, accessory_sec_tal_5 TEXT,
  boots_5 TEXT, boots_lvl_5 INTEGER, boots_tal_5 TEXT,
 
  helm_6 TEXT, helm_lvl_6 INTEGER, helm_tal_6 TEXT,
  chest_6 TEXT, chest_lvl_6 INTEGER, chest_tal_6 TEXT,
  weapon_6 TEXT, weapon_lvl_6 INTEGER, weapon_tal_6 TEXT,
  gloves_6 TEXT, gloves_lvl_6 INTEGER, gloves_tal_6 TEXT,
  legs_6 TEXT, legs_lvl_6 INTEGER, legs_tal_6 TEXT,
  accessory_6 TEXT, accessory_lvl_6 INTEGER, accessory_tal_6 TEXT,
  accessory_sec_6 TEXT, accessory_sec_lvl_6 INTEGER, accessory_sec_tal_6 TEXT,
  boots_6 TEXT, boots_lvl_6 INTEGER, boots_tal_6 TEXT,
 
  helm_7 TEXT, helm_lvl_7 INTEGER, helm_tal_7 TEXT,
  chest_7 TEXT, chest_lvl_7 INTEGER, chest_tal_7 TEXT,
  weapon_7 TEXT, weapon_lvl_7 INTEGER, weapon_tal_7 TEXT,
  gloves_7 TEXT, gloves_lvl_7 INTEGER, gloves_tal_7 TEXT,
  legs_7 TEXT, legs_lvl_7 INTEGER, legs_tal_7 TEXT,
  accessory_7 TEXT, accessory_lvl_7 INTEGER, accessory_tal_7 TEXT,
  accessory_sec_7 TEXT, accessory_sec_lvl_7 INTEGER, accessory_sec_tal_7 TEXT,
  boots_7 TEXT, boots_lvl_7 INTEGER, boots_tal_7 TEXT,

  pair1_comm1 TEXT, pair1_comm2 TEXT,
  pair2_comm1 TEXT, pair2_comm2 TEXT,
  pair3_comm1 TEXT, pair3_comm2 TEXT,
  pair4_comm1 TEXT, pair4_comm2 TEXT,
  pair5_comm1 TEXT, pair5_comm2 TEXT,
  pair6_comm1 TEXT, pair6_comm2 TEXT,
  pair7_comm1 TEXT, pair7_comm2 TEXT,
  pair8_comm1 TEXT, pair8_comm2 TEXT,
  pair9_comm1 TEXT, pair9_comm2 TEXT ,
  pair10_comm1 TEXT, pair10_comm2 TEXT,
  pair11_comm1 TEXT, pair11_comm2 TEXT,
  pair12_comm1 TEXT, pair12_comm2 TEXT
);

-- armaments
CREATE TABLE IF NOT EXISTS armaments (
  player_id INTEGER PRIMARY KEY,
  name TEXT,
  arm1 TEXT,
  arm1_ins TEXT, arm1_ins2 TEXT, arm1_ins3 TEXT, arm1_ins4 TEXT,
  arm1_ins5 TEXT, arm1_ins6 TEXT, arm1_ins7 TEXT, arm1_ins8 TEXT,
  arm1_stat_name TEXT, arm1_stat REAL,
  arm1_stat2_name2 TEXT, arm1_stat2 REAL,
  arm1_stat3_name3 TEXT, arm1_stat3 REAL,
  arm1_stat4_name4 TEXT, arm1_stat4 REAL,
  arm2 TEXT,
  arm2_ins TEXT, arm2_ins2 TEXT, arm2_ins3 TEXT, arm2_ins4 TEXT,
  arm2_ins5 TEXT, arm2_ins6 TEXT, arm2_ins7 TEXT, arm2_ins8 TEXT,
  arm2_stat_name TEXT, arm2_stat REAL,
  arm2_stat2_name2 TEXT, arm2_stat2 REAL,
  arm2_stat3_name3 TEXT, arm2_stat3 REAL,
  arm2_stat4_name4 TEXT, arm2_stat4 REAL,
  arm3 TEXT,
  arm3_ins TEXT, arm3_ins2 TEXT, arm3_ins3 TEXT, arm3_ins4 TEXT,
  arm3_ins5 TEXT, arm3_ins6 TEXT, arm3_ins7 TEXT, arm3_ins8 TEXT,
  arm3_stat_name TEXT, arm3_stat REAL,
  arm3_stat2_name2 TEXT, arm3_stat2 REAL,
  arm3_stat3_name3 TEXT, arm3_stat3 REAL,
  arm3_stat4_name4 TEXT, arm3_stat4 REAL,
  arm4 TEXT,
  arm4_ins TEXT, arm4_ins2 TEXT, arm4_ins3 TEXT, arm4_ins4 TEXT,
  arm4_ins5 TEXT, arm4_ins6 TEXT, arm4_ins7 TEXT, arm4_ins8 TEXT,
  arm4_stat_name TEXT, arm4_stat REAL,
  arm4_stat2_name2 TEXT, arm4_stat2 REAL,
  arm4_stat3_name3 TEXT, arm4_stat3 REAL,
  arm4_stat4_name4 TEXT, arm4_stat4 REAL,
  arm5 TEXT,
  arm5_ins TEXT, arm5_ins2 TEXT, arm5_ins3 TEXT, arm5_ins4 TEXT,
  arm5_ins5 TEXT, arm5_ins6 TEXT, arm5_ins7 TEXT, arm5_ins8 TEXT,
  arm5_stat_name TEXT, arm5_stat REAL,
  arm5_stat2_name2 TEXT, arm5_stat2 REAL,
  arm5_stat3_name3 TEXT, arm5_stat3 REAL,
  arm5_stat4_name4 TEXT, arm5_stat4 REAL,
  arm6 TEXT,
  arm6_ins TEXT, arm6_ins2 TEXT, arm6_ins3 TEXT, arm6_ins4 TEXT,
  arm6_ins5 TEXT, arm6_ins6 TEXT, arm6_ins7 TEXT, arm6_ins8 TEXT,
  arm6_stat_name TEXT, arm6_stat REAL,
  arm6_stat2_name2 TEXT, arm6_stat2 REAL,
  arm6_stat3_name3 TEXT, arm6_stat3 REAL,
  arm6_stat4_name4 TEXT, arm6_stat4 REAL,
  arm7 TEXT,
  arm7_ins TEXT, arm7_ins2 TEXT, arm7_ins3 TEXT, arm7_ins4 TEXT,
  arm7_ins5 TEXT, arm7_ins6 TEXT, arm7_ins7 TEXT, arm7_ins8 TEXT,
  arm7_stat_name TEXT, arm7_stat REAL,
  arm7_stat2_name2 TEXT, arm7_stat2 REAL,
  arm7_stat3_name3 TEXT, arm7_stat3 REAL,
  arm7_stat4_name4 TEXT, arm7_stat4 REAL,
  arm8 TEXT,
  arm8_ins TEXT, arm8_ins2 TEXT, arm8_ins3 TEXT, arm8_ins4 TEXT,
  arm8_ins5 TEXT, arm8_ins6 TEXT, arm8_ins7 TEXT, arm8_ins8 TEXT,
  arm8_stat_name TEXT, arm8_stat REAL,
  arm8_stat2_name2 TEXT, arm8_stat2 REAL,
  arm8_stat3_name3 TEXT, arm8_stat3 REAL,
  arm8_stat4_name4 TEXT, arm8_stat4 REAL
);

-- farm accounts
CREATE TABLE IF NOT EXISTS farm_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  player_id INTEGER UNIQUE,
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

FILES = [
      # {
          # "path": "D:/RoK Tracker AIO/data/DKP.xlsx",
          # "kingdom": "2247",
          # "kvk_number": 8,
          # "name": "HA",
      # },
      {
          "path": "D:/RoK Tracker AIO/data/DKP.xlsx",
          "kingdom": "2552",
          "kvk_number": 1,
          "name": "KvK",
      },
]

FARM_FILES = [
    #{"path": "2247-farms.xlsx"},
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
            player_id = to_int(r.get("id"))
            if not player_id:
                continue
            cur.execute(
                """
                INSERT OR REPLACE INTO farm_accounts (name, player_id, power, killpoints, deads, ch, acc_type, main_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    to_text(r.get("name"), ""),
                    player_id,
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

# Equipment import

EQUIPMENT_FILES = [
    #{"path": "gear_template_with_arms.xlsx"},
]

_GEAR_SLOTS     = ["helm", "chest", "weapon", "gloves", "legs", "accessory", "accessory_sec", "boots"]
_MARCH_SUFFIXES = ["", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]   # "" = march 1

EQUIPMENT_COLS = []
for _sfx in _MARCH_SUFFIXES:
    for _slot in _GEAR_SLOTS:
        _base = f"{_slot}_{_sfx}" if _sfx else _slot
        EQUIPMENT_COLS += [
            _base,
            f"{_slot}_lvl_{_sfx}" if _sfx else f"{_slot}_lvl",
            f"{_slot}_tal_{_sfx}" if _sfx else f"{_slot}_tal",
        ]
for _n in range(1, 13):
    EQUIPMENT_COLS += [f"pair{_n}_comm1", f"pair{_n}_comm2"]

_INT_EQUIPMENT_COLS = {c for c in EQUIPMENT_COLS if "_lvl" in c}

conn = sqlite3.connect(DB_PATH)
cur  = conn.cursor()

for cfg in EQUIPMENT_FILES:
    path = Path(cfg["path"])
    if not path.exists():
        print(f"\u274c Missing file: {path}")
        continue
    print(f"\U0001f4e5 Importing equipment from {path.name}")
    xls = pd.ExcelFile(path)
    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name)
        df.columns = [col.strip() for col in df.columns]
        for _, r in df.iterrows():
            player_id = to_int(r.get("ID"))
            if not player_id:
                continue
            values = [player_id, to_text(r.get("Name"), "none"), to_text(r.get("acc_type"), "none")]
            for col in EQUIPMENT_COLS:
                raw = r.get(col)
                if col in _INT_EQUIPMENT_COLS:
                    values.append(to_int(raw))
                else:
                    values.append(to_text(raw, "none"))
            placeholders = ", ".join(["?"] * len(values))
            col_names    = "player_id, name, acc_type, " + ", ".join(EQUIPMENT_COLS)
            cur.execute(f"INSERT OR REPLACE INTO equipment ({col_names}) VALUES ({placeholders})", values)
    conn.commit()

conn.close()
print("\u2705 Equipment import completed successfully")

# Armaments import

ARMAMENTS_FILES = [
    #{"path": "armaments.xlsx"},
]

# Irregular pandas column names that appear when the Excel has merged/duplicate headers
# Map them to the canonical DB names (stat4_name4 / stat4)
_ARM_RENAMES = {
    "arm4_stat4_name":    "arm4_stat4_name4",
    "arm5_stat3_name3.1": "arm5_stat4_name4",
    "arm5_stat3.1":       "arm5_stat4",
    "arm6_stat3_name3.1": "arm6_stat4_name4",
    "arm6_stat3.1":       "arm6_stat4",
    "arm6_stat4_name":    "arm6_stat4_name4",
}

# Canonical DB columns (must match schema exactly, no duplicates)
_ARM_DB_COLS = []
_seen_arm = set()
for _n in range(1, 9):
    p = f"arm{_n}"
    for _c in [
        p,
        f"{p}_ins",  f"{p}_ins2", f"{p}_ins3", f"{p}_ins4",
        f"{p}_ins5", f"{p}_ins6", f"{p}_ins7", f"{p}_ins8",
        f"{p}_stat_name",   f"{p}_stat",
        f"{p}_stat2_name2", f"{p}_stat2",
        f"{p}_stat3_name3", f"{p}_stat3",
        f"{p}_stat4_name4", f"{p}_stat4",
    ]:
        if _c not in _seen_arm:
            _ARM_DB_COLS.append(_c)
            _seen_arm.add(_c)

_FLOAT_ARM_COLS = {c for c in _ARM_DB_COLS
                   if c.endswith("_stat") or (c.split("_")[-1].isdigit() and "stat" in c)}

conn = sqlite3.connect(DB_PATH)
cur  = conn.cursor()

for cfg in ARMAMENTS_FILES:
    path = Path(cfg["path"])
    if not path.exists():
        print(f"\u274c Missing file: {path}")
        continue
    print(f"\U0001f4e5 Importing armaments from {path.name}")
    xls = pd.ExcelFile(path)
    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name)
        df.columns = [col.strip() for col in df.columns]

        for _, r in df.iterrows():
            player_id = to_int(r.get("ID"))
            if not player_id:
                continue

            name     = to_text(r.get("Name"), "none")

            db_row = {c: None for c in _ARM_DB_COLS}
            for xl_col in df.columns:
                if xl_col in ("Name", "ID", "acc_type"):
                    continue
                db_col = _ARM_RENAMES.get(xl_col, xl_col)
                if db_col not in db_row:
                    continue  # unknown / already handled duplicate
                raw = r[xl_col]
                if db_col in _FLOAT_ARM_COLS:
                    v = to_float(raw)
                    # Don't overwrite a real value with 0 from a duplicate col
                    if db_row[db_col] is None or (v != 0.0 and db_row[db_col] == 0.0):
                        db_row[db_col] = v
                else:
                    v = to_text(raw, "none")
                    # Don't overwrite a real value with "none" from a duplicate col
                    if db_row[db_col] is None or (v != "none" and db_row[db_col] == "none"):
                        db_row[db_col] = v

            values       = [player_id, name] + [db_row[c] for c in _ARM_DB_COLS]
            placeholders = ", ".join(["?"] * len(values))
            col_names    = "player_id, name, " + ", ".join(_ARM_DB_COLS)
            cur.execute(f"INSERT OR REPLACE INTO armaments ({col_names}) VALUES ({placeholders})", values)

    conn.commit()

conn.close()
print("\u2705 Armaments import completed successfully")
