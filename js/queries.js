/* ==========================================================================
   queries.js — every SQL query the pages run. All queries use bound
   parameters and return plain objects (no positional column indexes).
   Depends on: common.js, db.js. Call `await openDb()` first.
   ========================================================================== */

const kvkCtx = {
  kd: null,
  kvkId: null,
  kvkNumber: null,
  kvkName: null,
  lastSnapshotId: null,
  snapshotDates: [],
};

const NOT_ON_VACATION = "upper(coalesce(s.vacation, 'NO')) != 'YES'";

function listKvks(kd) {
  return dbAll(
    db,
    `SELECT
       k.kvk_number AS kvkNumber,
       k.name,
       k.is_latest AS isLatest,
       COALESCE(SUM(st.kp_diff), 0)    AS kp,
       COALESCE(SUM(st.t4_diff), 0)    AS t4,
       COALESCE(SUM(st.t5_diff), 0)    AS t5,
       COALESCE(SUM(st.deads_diff), 0) AS deads,
       COALESCE(SUM(st.acclaim), 0)    AS acclaim
     FROM kvks k
     LEFT JOIN snapshots s ON s.kvk_id = k.id AND s.is_last = 1
     LEFT JOIN stats st    ON st.snapshot_id = s.id
     WHERE k.kingdom = ?
     GROUP BY k.id
     ORDER BY k.kvk_number DESC`,
    [kd],
  );
}

function loadKvkContext() {
  const kd = getKDFromURL();
  if (!kd) throw new Error("Invalid or missing kingdom ID");

  const kvkNumber = getKvkNumberFromURL();
  const kvk = kvkNumber
    ? dbGet(
        db,
        `SELECT id, kvk_number AS kvkNumber, name FROM kvks
         WHERE kingdom=? AND kvk_number=? LIMIT 1`,
        [kd, Number(kvkNumber)],
      )
    : dbGet(
        db,
        `SELECT id, kvk_number AS kvkNumber, name FROM kvks
         WHERE kingdom=? ORDER BY kvk_number DESC LIMIT 1`,
        [kd],
      );
  if (!kvk) throw new Error("No KvK found in DB for this kingdom/KvK selection");

  const snaps = dbAll(
    db,
    `SELECT id, snapshot_date AS date, is_last AS isLast
     FROM snapshots WHERE kvk_id=? ORDER BY snapshot_date`,
    [kvk.id],
  );
  const last = snaps.find((s) => Number(s.isLast) === 1);
  if (!last) throw new Error("This KvK has no final snapshot yet");

  Object.assign(kvkCtx, {
    kd,
    kvkId: kvk.id,
    kvkNumber: kvk.kvkNumber,
    kvkName: kvk.name,
    lastSnapshotId: last.id,
    snapshotDates: snaps.map((s) => s.date),
  });
  return kvkCtx;
}

function loadDashboardRows() {
  return dbAll(
    db,
    `SELECT
       s.governor_id AS id,
       g.name        AS name,
       s.power       AS power,
       s.power_diff  AS powerDiff,
       s.kill_points AS killPoints,
       s.kp_diff     AS killPointsDiff,
       s.t4          AS t4,
       s.t4_diff     AS t4Diff,
       s.t5          AS t5,
       s.t5_diff     AS t5Diff,
       s.deads       AS deads,
       s.deads_diff  AS deadsDiff,
       s.min_dkp     AS minDkp,
       s.dkp         AS dkp,
       s.dkp_percent AS dkpPercent,
       coalesce(s.sum_min_dkp, s.min_dkp)         AS sumMinDkp,
       coalesce(s.sum_dkp, s.dkp)                 AS sumDkp,
       coalesce(s.sum_dkp_percent, s.dkp_percent) AS sumDkpPercent,
       coalesce(s.vacation, 'NO') AS vacation,
       coalesce(s.status, 'OK')   AS status,
       s.acclaim     AS acclaim
     FROM stats s
     JOIN governors g ON g.governor_id = s.governor_id AND g.kingdom = ?
     WHERE s.snapshot_id = ? AND ${NOT_ON_VACATION}`,
    [kvkCtx.kd, kvkCtx.lastSnapshotId],
  );
}

function loadGovernorSeries(govId) {
  return dbAll(
    db,
    `SELECT
       sn.snapshot_date AS date,
       st.kp_diff AS kpDiff,
       st.power_diff AS powerDiff,
       st.t4_diff AS t4Diff,
       st.t5_diff AS t5Diff,
       st.deads_diff AS deadsDiff
     FROM snapshots sn
     LEFT JOIN stats st ON st.snapshot_id = sn.id AND st.governor_id = ?
     WHERE sn.kvk_id = ?
     ORDER BY sn.snapshot_date`,
    [String(govId), kvkCtx.kvkId],
  );
}

function resolveFarmMainId(govId) {
  const safe = normalizeNumericId(govId);
  if (!safe) return null;
  const r = dbGet(
    db,
    "SELECT main_id AS mainId, acc_type AS accType FROM farm_accounts WHERE player_id=? LIMIT 1",
    [Number(safe)],
  );
  if (!r) return safe;
  const mainId = normalizeNumericId(r.mainId);
  return String(r.accType || "").toLowerCase() === "farm" && mainId ? mainId : safe;
}

function toAccount(r) {
  return {
    id: r.id ?? "",
    name: r.name ?? "",
    power: Number(r.power ?? 0),
    killpoints: Number(r.killpoints ?? 0),
    deads: Number(r.deads ?? 0),
    ch: r.ch ?? "",
  };
}

function loadGovernorFarms(govId) {
  const mainId = resolveFarmMainId(govId);
  if (!mainId) return [];
  return dbAll(
    db,
    `SELECT player_id AS id, name, power, killpoints, deads, ch
     FROM farm_accounts
     WHERE main_id=? AND acc_type='farm'
     ORDER BY power DESC`,
    [Number(mainId)],
  ).map(toAccount);
}

function loadFarmOwner(govId) {
  const safe = normalizeNumericId(govId);
  if (!safe) return null;
  const r = dbGet(
    db,
    `SELECT main.player_id AS id, main.name, main.power, main.killpoints, main.deads, main.ch
     FROM farm_accounts farm
     JOIN farm_accounts main ON main.player_id = farm.main_id AND main.acc_type = 'main'
     WHERE farm.player_id=? AND farm.acc_type='farm'
     LIMIT 1`,
    [Number(safe)],
  );
  return r ? toAccount(r) : null;
}

function getGovernorFarmIds(govId) {
  return loadGovernorFarms(govId).map((farm) => farm.id);
}

const HISTORY_SUM_FIELDS = [
  "powerDiff",
  "kpDiff",
  "t4Diff",
  "t5Diff",
  "deadsDiff",
  "minDkp",
  "dkp",
  "dkpPercent",
  "acclaim",
];

function loadGovHistory(govId, kd = kvkCtx.kd) {
  const gid = normalizeNumericId(govId);
  if (!kd || !gid) return [];

  const isMain = resolveFarmMainId(gid) === gid;
  const farmIds = isMain ? toNumericIds(getGovernorFarmIds(gid)) : [];

  const own = dbAll(
    db,
    `SELECT k.kvk_number AS kvkNumber,
            s.power_diff AS powerDiff, s.kp_diff AS kpDiff, s.t4_diff AS t4Diff,
            s.t5_diff AS t5Diff, s.deads_diff AS deadsDiff, s.min_dkp AS minDkp,
            s.dkp AS dkp, s.dkp_percent AS dkpPercent, s.acclaim AS acclaim
     FROM kvks k
     JOIN snapshots sn ON sn.kvk_id = k.id AND sn.is_last = 1
     JOIN stats s ON s.snapshot_id = sn.id AND s.governor_id = ? AND ${NOT_ON_VACATION}
     WHERE k.kingdom = ?
     ORDER BY k.kvk_number`,
    [gid, kd],
  );

  const farmsByKvk = new Map();
  if (farmIds.length) {
    dbAll(
      db,
      `SELECT k.kvk_number AS kvkNumber,
              coalesce(sum(s.power_diff), 0) AS powerDiff,
              coalesce(sum(s.kp_diff), 0) AS kpDiff,
              coalesce(sum(s.t4_diff), 0) AS t4Diff,
              coalesce(sum(s.t5_diff), 0) AS t5Diff,
              coalesce(sum(s.deads_diff), 0) AS deadsDiff,
              coalesce(sum(s.min_dkp), 0) AS minDkp,
              coalesce(sum(s.dkp), 0) AS dkp,
              coalesce(sum(s.dkp_percent), 0) AS dkpPercent,
              coalesce(sum(s.acclaim), 0) AS acclaim
       FROM kvks k
       JOIN snapshots sn ON sn.kvk_id = k.id AND sn.is_last = 1
       JOIN stats s ON s.snapshot_id = sn.id
         AND CAST(s.governor_id AS INTEGER) IN (${sqlPlaceholders(farmIds.length)})
         AND ${NOT_ON_VACATION}
       WHERE k.kingdom = ?
       GROUP BY k.kvk_number`,
      [...farmIds, kd],
    ).forEach((r) => farmsByKvk.set(Number(r.kvkNumber), r));
  }

  return own.map((r) => {
    const rollsUp = farmIds.length > 0 && kvkHasSums(r.kvkNumber);
    const farm = rollsUp ? farmsByKvk.get(Number(r.kvkNumber)) : null;
    const withFarms = (key) => Number(r[key] || 0) + Number(farm?.[key] || 0);

    const row = { kvk: `KvK ${r.kvkNumber}`, hasFarmRollup: rollsUp };
    for (const key of HISTORY_SUM_FIELDS) {
      row[key] = r[key];
      row["sum" + key[0].toUpperCase() + key.slice(1)] = withFarms(key);
    }
    return row;
  });
}

function loadFarmKvKStats(farmIds, kd = kvkCtx.kd) {
  const ids = toNumericIds(farmIds);
  if (!ids.length || !kd) return [];

  return dbAll(
    db,
    `SELECT k.kvk_number AS kvkNumber, g.name AS name, s.governor_id AS id,
            s.power_diff AS powerDiff, s.kp_diff AS kpDiff, s.t4_diff AS t4Diff,
            s.t5_diff AS t5Diff, s.deads_diff AS deadsDiff, s.dkp AS dkp,
            s.dkp_percent AS dkpPercent, s.acclaim AS acclaim, s.min_dkp AS minDkp
     FROM kvks k
     JOIN snapshots sn ON sn.kvk_id = k.id AND sn.is_last = 1
     JOIN stats s ON s.snapshot_id = sn.id
     JOIN governors g ON g.governor_id = s.governor_id AND g.kingdom = ?
     WHERE k.kingdom = ?
       AND CAST(s.governor_id AS INTEGER) IN (${sqlPlaceholders(ids.length)})
       AND ${NOT_ON_VACATION}
     ORDER BY k.kvk_number, s.dkp DESC`,
    [kd, kd, ...ids],
  ).map((r) => ({ ...r, kvk: `KvK ${r.kvkNumber}` }));
}

const PLAYER_TABLES = new Set(["equipment", "armaments", "skins"]);

function loadPlayerRow(table, govId) {
  const safe = normalizeNumericId(govId);
  if (!safe || !PLAYER_TABLES.has(table)) return null;
  try {
    if (!dbHasTable(db, table)) return null;
    return dbGet(db, `SELECT * FROM ${table} WHERE player_id=? LIMIT 1`, [Number(safe)]);
  } catch (e) {
    console.error(`load ${table}:`, e);
    return null;
  }
}

function loadGovernorEquipment(govId) {
  return loadPlayerRow("equipment", govId);
}
function loadGovernorArmaments(govId) {
  return loadPlayerRow("armaments", govId);
}
function loadGovernorSkins(govId) {
  return loadPlayerRow("skins", govId);
}

function loadPlayerProfile(govId) {
  const safe = normalizeNumericId(govId);
  if (!safe) return null;
  try {
    if (!dbHasTable(db, "player_profile")) return null;
    return dbGet(
      db,
      "SELECT vip_level, city_skin FROM player_profile WHERE player_id=? LIMIT 1",
      [Number(safe)],
    );
  } catch (e) {
    console.error("loadPlayerProfile:", e);
    return null;
  }
}
