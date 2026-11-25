function loadEditorInitialData() {
  return supabaseRpc("editor_init");
}

function addEditorSlot(kind) {
  return supabaseRpc("editor_add_slot", { p_kind: kind });
}

function loadEditorGovernor(governorId) {
  return supabaseRpc("editor_load", { p_gov: Number(governorId) });
}

function saveEditorGovernor({ govId: governorId, name, equipment, armaments, skins, vip: vipLevel }) {
  return supabaseRpc("editor_save_governor", {
    p_gov: Number(governorId),
    p_name: name,
    p_equipment: equipment,
    p_armaments: armaments,
    p_skins: skins,
    p_vip: vipLevel,
  });
}

function listEditorFarms() {
  return supabaseSelectAll(
    "farm_accounts",
    "select=id,name,player_id,power,killpoints,deads,ch,acc_type,main_id&order=name.asc,id.asc",
  );
}

function saveEditorFarm({ id = null, name, player, power, killpoints, deads, ch: cityHallLevel, accType: accountType, main }) {
  return supabaseRpc("editor_farm_save", {
    p_id: id,
    p_name: name,
    p_player: player,
    p_power: power,
    p_kp: killpoints,
    p_deads: deads,
    p_ch: cityHallLevel,
    p_acc_type: accountType,
    p_main: main,
  });
}

function deleteEditorFarm(id) {
  return supabaseRpc("editor_farm_delete", { p_id: id });
}

function loadAllEquipmentRows() {
  return supabaseSelectAll("equipment", "select=*");
}
