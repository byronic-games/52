const ITEM_STATS_KEY = "hl_prototype_item_usage_stats_v1";

function normalizeItemStatEntry(entry = {}) {
  return {
    discovered: Math.max(0, Math.floor(Number(entry.discovered) || 0)),
    offered: Math.max(0, Math.floor(Number(entry.offered) || 0)),
    picked: Math.max(0, Math.floor(Number(entry.picked) || 0)),
    used: Math.max(0, Math.floor(Number(entry.used) || 0)),
    success: Math.max(0, Math.floor(Number(entry.success) || 0)),
  };
}

function normalizeItemStats(stats = {}) {
  const normalized = { cheat: {}, power: {}, joker: {} };
  ["cheat", "power", "joker"].forEach((type) => {
    Object.entries(stats?.[type] || {}).forEach(([id, entry]) => {
      if (!id) return;
      normalized[type][id] = normalizeItemStatEntry(entry);
    });
  });
  return normalized;
}

function loadItemUsageStats() {
  try {
    return normalizeItemStats(JSON.parse(localStorage.getItem(ITEM_STATS_KEY) || "{}"));
  } catch {
    return normalizeItemStats();
  }
}

function saveItemUsageStats(stats) {
  const normalized = normalizeItemStats(stats);
  localStorage.setItem(ITEM_STATS_KEY, JSON.stringify(normalized));
  return normalized;
}

function recordItemUsageStat(type, id, field, amount = 1) {
  const normalizedType = String(type || "").toLowerCase();
  const normalizedField = String(field || "").toLowerCase();
  const normalizedId = String(id || "").trim();
  if (!["cheat", "power", "joker"].includes(normalizedType) || !normalizedId) return loadItemUsageStats();
  if (!["discovered", "offered", "picked", "used", "success"].includes(normalizedField)) return loadItemUsageStats();

  const stats = loadItemUsageStats();
  const entry = normalizeItemStatEntry(stats[normalizedType][normalizedId]);
  entry[normalizedField] = Math.max(0, entry[normalizedField] + Math.max(1, Math.floor(Number(amount) || 1)));
  stats[normalizedType][normalizedId] = entry;
  return saveItemUsageStats(stats);
}

function recordItemsOffered(type, entries) {
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    recordItemUsageStat(type, entry?.id || entry?.jokerId, "offered");
  });
}

function recordItemDiscovered(type, ids) {
  (Array.isArray(ids) ? ids : [ids]).forEach((id) => {
    recordItemUsageStat(type, id, "discovered");
  });
}

function getItemUsageStat(type, id) {
  const stats = loadItemUsageStats();
  return normalizeItemStatEntry(stats[String(type || "").toLowerCase()]?.[String(id || "").trim()]);
}
