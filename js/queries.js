const kvkContext = {
  kd: null,
  kvkId: null,
  kvkNumber: null,
  kvkName: null,
  lastSnapshotId: null,
  snapshotDates: [],
};

function listKvks(kingdomId) {
  return supabaseRpc("kvk_list", { p_kd: String(kingdomId) });
}

async function loadKvkContext() {
  const kingdomId = '2247';
  if (!kingdomId) throw new Error("Invalid or missing kingdom ID");

  const kvkNumber = getKvkNumberFromURL();
  const context = await supabaseRpc("kvk_context", {
    p_kd: kingdomId,
    p_kvk: kvkNumber ? Number(kvkNumber) : null,
  });
  if (!context) throw new Error("No KvK found in DB for this kingdom/KvK selection");

  const last = context.snapshots.find((snapshot) => snapshot.isLast === true);
  if (!last) throw new Error("This KvK has no final snapshot yet");

  Object.assign(kvkContext, {
    kd: kingdomId,
    kvkId: context.kvk.id,
    kvkNumber: context.kvk.kvkNumber,
    kvkName: context.kvk.name,
    lastSnapshotId: last.id,
    snapshotDates: context.snapshots.map((snapshot) => snapshot.date),
  });
  return kvkContext;
}

function loadDashboardRows() {
  return supabaseRpc("dashboard_rows", {
    p_kd: kvkContext.kd,
    p_snapshot_id: kvkContext.lastSnapshotId,
  });
}

function loadGovernorSeries(governorId) {
  return supabaseRpc("governor_series", {
    p_gov: Number(governorId),
    p_kvk_id: kvkContext.kvkId,
  });
}

const playerBundles = new Map();

async function loadPlayerBundle(governorId, kingdomId = null) {
  const id = normalizeNumericId(governorId);
  if (!id) return null;
  const bundle = await supabaseRpc("player_card", {
    p_gov: Number(id),
    p_kd: kingdomId,
    p_first_sums: FIRST_KVK_WITH_SUMS,
  });
  playerBundles.set(id, bundle);
  return bundle;
}

function getPlayerBundle(governorId) {
  return playerBundles.get(String(normalizeNumericId(governorId))) ?? null;
}

function detectKingdom(governorId) {
  return getPlayerBundle(governorId)?.kd ?? null;
}
function loadGovernorInfo(governorId) {
  return getPlayerBundle(governorId)?.info ?? null;
}
function getAccountType(governorId) {
  return getPlayerBundle(governorId)?.accType ?? null;
}
function loadCityHallLevel(governorId) {
  return getPlayerBundle(governorId)?.ch ?? null;
}
function resolveFarmMainId(governorId) {
  const bundle = getPlayerBundle(governorId);
  return bundle ? String(bundle.mainId) : null;
}
function loadGovernorFarms(governorId) {
  return getPlayerBundle(governorId)?.farms ?? [];
}
function getGovernorFarmIds(governorId) {
  return loadGovernorFarms(governorId).map((farm) => farm.id);
}
function loadFarmOwner(governorId) {
  return getPlayerBundle(governorId)?.owner ?? null;
}
function loadGovernorHistory(governorId) {
  return getPlayerBundle(governorId)?.history ?? [];
}
function loadFarmKvKStats(governorId) {
  return getPlayerBundle(governorId)?.farmKvK ?? [];
}
function loadGovernorEquipment(governorId) {
  return getPlayerBundle(governorId)?.equipment ?? null;
}
function loadGovernorArmaments(governorId) {
  return getPlayerBundle(governorId)?.armaments ?? null;
}
function loadGovernorSkins(governorId) {
  return getPlayerBundle(governorId)?.skins ?? null;
}
function loadPlayerProfile(governorId) {
  return getPlayerBundle(governorId)?.profile ?? null;
}
function loadScanStats(governorId) {
  return getPlayerBundle(governorId)?.scan ?? null;
}
