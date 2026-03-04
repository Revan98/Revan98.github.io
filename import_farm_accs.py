import pandas as pd
import sqlite3

# Path to your Excel file
excel_file = "Kopia 2247-farms.xlsx"

# Output SQLite database
db_file = "farms.db"

# Connect to SQLite
conn = sqlite3.connect(db_file)
cursor = conn.cursor()

# Create schema
cursor.execute("""
CREATE TABLE IF NOT EXISTS players (
    name TEXT,
    id INTEGER,
    power INTEGER,
    killpoints INTEGER,
    deads INTEGER,
    ch INTEGER,
    acc_type TEXT,
    main_id INTEGER
);
""")

conn.commit()

# Load Excel file
xls = pd.ExcelFile(excel_file)

# Process each worksheet
for sheet_name in xls.sheet_names:
    df = pd.read_excel(xls, sheet_name=sheet_name)

    # Normalize column names (important!)
    df.columns = [col.strip().lower() for col in df.columns]

    # Optional: rename columns to match DB schema exactly
    df = df.rename(columns={
        "name": "name",
        "id": "id",
        "power": "power",
        "killpoints": "killpoints",
        "deads": "deads",
        "ch": "ch",
        "acc_type": "acc_type",
        "main_id": "main_id"
    })

    # Insert into SQLite
    df.to_sql("players", conn, if_exists="append", index=False)

conn.close()

print("All worksheets successfully converted into output.db")