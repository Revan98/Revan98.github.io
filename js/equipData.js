function edInit() {
  return sbRpc("editor_init");
}

function edAddSlot(kind) {
  return sbRpc("editor_add_slot", { p_kind: kind });
}

function edLoadGovernor(govId) {
  return sbRpc("editor_load", { p_gov: Number(govId) });
}

function edSaveGovernor({ govId, name, equipment, armaments, skins, vip }) {
  return sbRpc("editor_save_governor", {
    p_gov: Number(govId),
    p_name: name,
    p_equipment: equipment,
    p_armaments: armaments,
    p_skins: skins,
    p_vip: vip,
  });
}

function edListFarms() {
  return sbSelectAll(
    "farm_accounts",
    "select=id,name,player_id,power,killpoints,deads,ch,acc_type,main_id&order=name.asc",
  );
}

function edSaveFarm({ id = null, name, player, power, killpoints, deads, ch, accType, main }) {
  return sbRpc("editor_farm_save", {
    p_id: id,
    p_name: name,
    p_player: player,
    p_power: power,
    p_kp: killpoints,
    p_deads: deads,
    p_ch: ch,
    p_acc_type: accType,
    p_main: main,
  });
}

function edDeleteFarm(id) {
  return sbRpc("editor_farm_delete", { p_id: id });
}

function edEquipmentRows() {
  return sbSelectAll("equipment", "select=*");
}
