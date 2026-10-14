const kvkCtx = {
  kd: null,
  kvkId: null,
  kvkNumber: null,
  kvkName: null,
  lastSnapshotId: null,
  snapshotDates: [],
};

function listKvks(kd) {
  return sbRpc("kvk_list", { p_kd: String(kd) });
}

async function loadKvkContext() {
  const kd = getKDFromURL();
  if (!kd) throw new Error("Invalid or missing kingdom ID");

  const kvkNumber = getKvkNumberFromURL();
  const ctx = await sbRpc("kvk_context", {
    p_kd: kd,
    p_kvk: kvkNumber ? Number(kvkNumber) : null,
  });
  if (!ctx) throw new Error("No KvK found in DB for this kingdom/KvK selection");

  const last = ctx.snapshots.find((s) => s.isLast === true);
  if (!last) throw new Error("This KvK has no final snapshot yet");

  Object.assign(kvkCtx, {
    kd,
    kvkId: ctx.kvk.id,
    kvkNumber: ctx.kvk.kvkNumber,
    kvkName: ctx.kvk.name,
    lastSnapshotId: last.id,
    snapshotDates: ctx.snapshots.map((s) => s.date),
  });
  return kvkCtx;
}

function loadDashboardRows() {
  return sbRpc("dashboard_rows", {
    p_kd: kvkCtx.kd,
    p_snapshot_id: kvkCtx.lastSnapshotId,
  });
}

function loadGovernorSeries(govId) {
  return sbRpc("governor_series", {
    p_gov: Number(govId),
    p_kvk_id: kvkCtx.kvkId,
  });
}

const playerBundles = new Map();

async function loadPlayerBundle(govId, kd = null) {
  const id = normalizeNumericId(govId);
  if (!id) return null;
  const bundle = await sbRpc("player_card", {
    p_gov: Number(id),
    p_kd: kd,
    p_first_sums: FIRST_KVK_WITH_SUMS,
  });
  playerBundles.set(id, bundle);
  return bundle;
}

function bundleOf(govId) {
  return playerBundles.get(String(normalizeNumericId(govId))) ?? null;
}

function detectKingdom(govId) {
  return bundleOf(govId)?.kd ?? null;
}
function loadGovernorInfo(govId) {
  return bundleOf(govId)?.info ?? null;
}
function getAccType(govId) {
  return bundleOf(govId)?.accType ?? null;
}
function loadCH(govId) {
  return bundleOf(govId)?.ch ?? null;
}
function resolveFarmMainId(govId) {
  const b = bundleOf(govId);
  return b ? String(b.mainId) : null;
}
function loadGovernorFarms(govId) {
  return bundleOf(govId)?.farms ?? [];
}
function getGovernorFarmIds(govId) {
  return loadGovernorFarms(govId).map((farm) => farm.id);
}
function loadFarmOwner(govId) {
  return bundleOf(govId)?.owner ?? null;
}
function loadGovHistory(govId) {
  return bundleOf(govId)?.history ?? [];
}
function loadFarmKvKStats(govId) {
  return bundleOf(govId)?.farmKvK ?? [];
}
function loadGovernorEquipment(govId) {
  return bundleOf(govId)?.equipment ?? null;
}
function loadGovernorArmaments(govId) {
  return bundleOf(govId)?.armaments ?? null;
}
function loadGovernorSkins(govId) {
  return bundleOf(govId)?.skins ?? null;
}
function loadPlayerProfile(govId) {
  return bundleOf(govId)?.profile ?? null;
}
