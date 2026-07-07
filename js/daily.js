const DAILY_PLAYER_ID_KEY = "hl_prototype_daily_player_id";
const DAILY_LOCAL_KEY = "hl_prototype_daily_attempts_local";
const DAILY_NAME_KEY = "hl_prototype_hero_name";
const DAILY_TABLE = "daily_52";
const DAILY_RULESET_VERSION = "daily-v1";
const DAILY_VARIANT_NORMAL = "normal";
const DAILY_VARIANT_HARD = "hard";
const DAILY_VARIANTS = {
  normal: {
    id: DAILY_VARIANT_NORMAL,
    label: "Normal",
    seedSuffix: "",
    deckKey: "blue",
    levelNumber: 1,
    hideTornCards: false,
    ignorePermanentCardEffects: false,
    scoreTornCards: true,
  },
  hard: {
    id: DAILY_VARIANT_HARD,
    label: "Hard",
    seedSuffix: "hard-v1",
    deckKey: "blue",
    levelNumber: 1,
    hideTornCards: true,
    ignorePermanentCardEffects: true,
    scoreTornCards: false,
  },
};
const DAILY_REQUEST_TIMEOUT_MS = 8000;
const DAILY_CARD_SCORE_VALUE = 100;
const DAILY_UNUSED_CHEAT_BONUS = 10;
const DAILY_UNUSED_NUDGE_BONUS = 5;
const DAILY_POWER_BONUS = 25;
const DAILY_TEAR_PENALTY = 10;

async function fetchWithTimeout(url, options = {}, timeoutMs = DAILY_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || DAILY_REQUEST_TIMEOUT_MS));
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function buildDailyLeaderboardResult(entries, remoteAvailable, status) {
  const list = Array.isArray(entries) ? entries : [];
  // Keep backward compatibility with older daily-page.js that expects an Array.
  list._remoteAvailable = !!remoteAvailable;
  list._status = String(status || (remoteAvailable ? "online" : "offline_network"));
  return list;
}

function getDailyLeaderboardConfig() {
  if (typeof LEADERBOARD_CONFIG !== "undefined") {
    return {
      supabaseUrl: LEADERBOARD_CONFIG.supabaseUrl,
      supabaseAnonKey: LEADERBOARD_CONFIG.supabaseAnonKey,
      table: DAILY_TABLE,
    };
  }

  return {
    supabaseUrl: "",
    supabaseAnonKey: "",
    table: DAILY_TABLE,
  };
}

function dailyRemoteEnabled() {
  const config = getDailyLeaderboardConfig();
  return !!config.supabaseUrl && !!config.supabaseAnonKey;
}

function getCurrentDailyDateKey(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDailyVariant(variant) {
  const normalized = String(variant || "").trim().toLowerCase();
  return DAILY_VARIANTS[normalized] ? normalized : DAILY_VARIANT_NORMAL;
}

function getDailyVariantConfig(variant) {
  return DAILY_VARIANTS[normalizeDailyVariant(variant)] || DAILY_VARIANTS.normal;
}

function getDailyAttemptStorageKey(dateKey, variant = DAILY_VARIANT_NORMAL) {
  const normalizedDateKey = String(dateKey || "").trim();
  const normalizedVariant = normalizeDailyVariant(variant);
  return normalizedVariant === DAILY_VARIANT_NORMAL
    ? normalizedDateKey
    : `${normalizedVariant}|${normalizedDateKey}`;
}

function getDailySeedForDate(dateKey, variant = DAILY_VARIANT_NORMAL) {
  const normalizedDateKey = String(dateKey || "").trim();
  const config = getDailyVariantConfig(variant);
  return config.seedSuffix
    ? `DAILY|${GAME_VERSION}|${DAILY_RULESET_VERSION}|${config.seedSuffix}|${normalizedDateKey}`
    : `DAILY|${GAME_VERSION}|${DAILY_RULESET_VERSION}|${normalizedDateKey}`;
}

function getOrCreateDailyPlayerId() {
  let existing = String(localStorage.getItem(DAILY_PLAYER_ID_KEY) || "").trim();
  if (existing) return existing;

  existing = `${randomSeedString(8)}-${Date.now().toString(36).toUpperCase()}`;
  localStorage.setItem(DAILY_PLAYER_ID_KEY, existing);
  return existing;
}

function loadPreferredPlayerName() {
  return String(localStorage.getItem(DAILY_NAME_KEY) || "").trim().replace(/\s+/g, " ").slice(0, 24);
}

function savePreferredPlayerName(name) {
  const normalized = String(name || "").trim().replace(/\s+/g, " ").slice(0, 24);
  localStorage.setItem(DAILY_NAME_KEY, normalized);
  return normalized;
}

function getLocalDailyAttempts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAILY_LOCAL_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalDailyAttempts(attempts) {
  localStorage.setItem(DAILY_LOCAL_KEY, JSON.stringify(attempts));
}

function clampDailyBonus(value) {
  const numeric = Math.floor(Number(value) || 0);
  return Math.max(0, numeric);
}

function normalizeDailyCardsCleared(value) {
  return Math.max(0, Math.min(52, Math.floor(Number(value) || 0)));
}

function normalizeDailySuitCounts(value) {
  if (!value || typeof value !== "object") return null;
  const source = value;
  const counts = {};
  for (const suit of SUITS) {
    counts[suit] = Math.max(0, Math.min(13, Math.floor(Number(source[suit]) || 0)));
  }
  return counts;
}

function buildDailyScoreBreakdown({
  cardsCleared = 0,
  remainingCheats = 0,
  remainingNudges = 0,
  powerCount = 0,
  tearCount = 0,
} = {}) {
  const normalizedCards = normalizeDailyCardsCleared(cardsCleared);
  const normalizedCheats = Math.max(0, Math.floor(Number(remainingCheats) || 0));
  const normalizedNudges = Math.max(0, Math.floor(Number(remainingNudges) || 0));
  const normalizedPowers = Math.max(0, Math.floor(Number(powerCount) || 0));
  const normalizedTears = Math.max(0, Math.floor(Number(tearCount) || 0));
  const cardScore = normalizedCards * DAILY_CARD_SCORE_VALUE;
  const cheatBonus = normalizedCheats * DAILY_UNUSED_CHEAT_BONUS;
  const nudgeBonus = normalizedNudges * DAILY_UNUSED_NUDGE_BONUS;
  const powerBonus = normalizedPowers * DAILY_POWER_BONUS;
  const tearPenalty = normalizedTears * DAILY_TEAR_PENALTY;
  const rawBonusScore = cheatBonus + nudgeBonus + powerBonus - tearPenalty;
  const bonusScore = clampDailyBonus(rawBonusScore);

  return {
    cardsCleared: normalizedCards,
    cardScore,
    remainingCheats: normalizedCheats,
    remainingNudges: normalizedNudges,
    powerCount: normalizedPowers,
    tearCount: normalizedTears,
    cheatBonus,
    nudgeBonus,
    powerBonus,
    tearPenalty,
    rawBonusScore,
    bonusScore,
    totalScore: Math.max(0, cardScore + bonusScore),
  };
}

function normalizeDailyEntry(entry) {
  const crownSnapshot = typeof getEntryCrownSnapshot === "function"
    ? getEntryCrownSnapshot(entry || {})
    : {
      blueCleared: false,
      greenCleared: false,
      redCleared: false,
      dailyCleared: false,
      dailyClears: 0,
      summary: "",
    };
  const rawScore = Math.max(0, Math.floor(Number(entry?.score ?? entry?.totalScore ?? entry?.total_score ?? 0) || 0));
  const explicitTotalScore = entry?.totalScore ?? entry?.total_score;
  const explicitCardsCleared = entry?.cardsCleared ?? entry?.cards_cleared;
  const cardsCleared = explicitCardsCleared !== undefined
    ? normalizeDailyCardsCleared(explicitCardsCleared)
    : normalizeDailyCardsCleared(rawScore <= 52 ? rawScore : Math.floor(rawScore / DAILY_CARD_SCORE_VALUE));
  const inferredBonus = rawScore > 99 ? rawScore - (cardsCleared * DAILY_CARD_SCORE_VALUE) : 0;
  const scoreBreakdown = buildDailyScoreBreakdown({
    cardsCleared,
    remainingCheats: entry?.remainingCheats ?? entry?.remaining_cheats ?? 0,
    remainingNudges: entry?.remainingNudges ?? entry?.remaining_nudges ?? 0,
    powerCount: entry?.powerCount ?? entry?.power_count ?? 0,
    tearCount: entry?.tearCount ?? entry?.tear_count ?? 0,
  });
  const bonusScore = clampDailyBonus(entry?.bonusScore ?? entry?.bonus_score ?? inferredBonus);
  const explicitTotalNumeric = Math.max(0, Math.floor(Number(explicitTotalScore) || 0));
  const totalScore = explicitTotalScore !== undefined && explicitTotalScore !== null && explicitTotalScore !== "" && explicitTotalNumeric > 52
    ? explicitTotalNumeric
    : rawScore <= 52
      ? Math.max(0, scoreBreakdown.cardScore + bonusScore)
      : rawScore;

  return {
    dateKey: String(entry?.dateKey || ""),
    variant: normalizeDailyVariant(entry?.variant),
    seed: String(entry?.seed || ""),
    playerName: String(entry?.playerName || "Unknown"),
    playerId: String(entry?.playerId || ""),
    score: totalScore,
    cardsCleared,
    cardScore: Math.max(0, Math.floor(Number(entry?.cardScore ?? entry?.card_score ?? scoreBreakdown.cardScore) || 0)),
    bonusScore,
    remainingCheats: Math.max(0, Math.floor(Number(entry?.remainingCheats ?? entry?.remaining_cheats ?? scoreBreakdown.remainingCheats) || 0)),
    remainingNudges: Math.max(0, Math.floor(Number(entry?.remainingNudges ?? entry?.remaining_nudges ?? scoreBreakdown.remainingNudges) || 0)),
    powerCount: Math.max(0, Math.floor(Number(entry?.powerCount ?? entry?.power_count ?? scoreBreakdown.powerCount) || 0)),
    tearCount: Math.max(0, Math.floor(Number(entry?.tearCount ?? entry?.tear_count ?? scoreBreakdown.tearCount) || 0)),
    cheatBonus: Math.max(0, Math.floor(Number(entry?.cheatBonus ?? entry?.cheat_bonus ?? scoreBreakdown.cheatBonus) || 0)),
    nudgeBonus: Math.max(0, Math.floor(Number(entry?.nudgeBonus ?? entry?.nudge_bonus ?? scoreBreakdown.nudgeBonus) || 0)),
    powerBonus: Math.max(0, Math.floor(Number(entry?.powerBonus ?? entry?.power_bonus ?? scoreBreakdown.powerBonus) || 0)),
    tearPenalty: Math.max(0, Math.floor(Number(entry?.tearPenalty ?? entry?.tear_penalty ?? scoreBreakdown.tearPenalty) || 0)),
    completed: entry?.completed !== false,
    createdAt: String(entry?.createdAt || new Date().toISOString()),
    source: String(entry?.source || "local"),
    blueCleared: crownSnapshot.blueCleared,
    greenCleared: crownSnapshot.greenCleared,
    redCleared: crownSnapshot.redCleared,
    dailyCleared: crownSnapshot.dailyCleared,
    dailyClears: crownSnapshot.dailyClears,
    crownSummary: crownSnapshot.summary,
    suitCounts: normalizeDailySuitCounts(entry?.suitCounts ?? entry?.suit_counts),
  };
}

function getLocalDailyAttempt(dateKey, variant = DAILY_VARIANT_NORMAL) {
  const attempts = getLocalDailyAttempts();
  const storageKey = getDailyAttemptStorageKey(dateKey, variant);
  const fallbackKey = normalizeDailyVariant(variant) === DAILY_VARIANT_NORMAL
    ? String(dateKey || "").trim()
    : "";
  const attempt = attempts[storageKey] || (fallbackKey ? attempts[fallbackKey] : null);
  if (!attempt) return null;
  return normalizeDailyEntry({
    ...attempt,
    variant: attempt.variant || variant,
  });
}

function saveLocalDailyAttempt(entry) {
  const attempts = getLocalDailyAttempts();
  const normalized = normalizeDailyEntry(entry);
  attempts[getDailyAttemptStorageKey(normalized.dateKey, normalized.variant)] = normalized;
  saveLocalDailyAttempts(attempts);
  return normalized;
}

function getDailyRequestHeaders(config, includeJson = false, prefer = "") {
  const headers = {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
  };
  if (includeJson) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  return headers;
}

function buildDailyRemotePayload(entry, includeCrownFields = true, includeScoreFields = includeCrownFields) {
  const payload = {
    date_key: entry.dateKey,
    variant: normalizeDailyVariant(entry.variant),
    seed: entry.seed,
    player_name: entry.playerName,
    player_id: entry.playerId,
    score: entry.score,
    game_version: GAME_VERSION,
  };

  if (includeScoreFields) {
    payload.cards_cleared = entry.cardsCleared;
    payload.bonus_score = entry.bonusScore;
    payload.remaining_cheats = entry.remainingCheats;
    payload.remaining_nudges = entry.remainingNudges;
    payload.power_count = entry.powerCount;
    payload.tear_count = entry.tearCount;
    payload.cheat_bonus = entry.cheatBonus;
    payload.nudge_bonus = entry.nudgeBonus;
    payload.power_bonus = entry.powerBonus;
    payload.tear_penalty = entry.tearPenalty;
    payload.total_score = entry.score;
  }

  if (includeCrownFields) {
    payload.blue_cleared = entry.blueCleared;
    payload.green_cleared = entry.greenCleared;
    payload.red_cleared = entry.redCleared;
    payload.daily_clears = entry.dailyClears;
    payload.crown_summary = entry.crownSummary;
  }

  return payload;
}

function buildDailyRemoteIdentityQuery(entry) {
  const dateKey = encodeURIComponent(entry.dateKey);
  const variant = normalizeDailyVariant(entry.variant);
  const variantQuery = `variant=eq.${encodeURIComponent(variant)}`;
  if (entry.playerId) {
    return `date_key=eq.${dateKey}&${variantQuery}&player_id=eq.${encodeURIComponent(entry.playerId)}`;
  }

  return [
    `date_key=eq.${dateKey}`,
    variantQuery,
    `seed=eq.${encodeURIComponent(entry.seed)}`,
    `player_name=eq.${encodeURIComponent(entry.playerName)}`,
    `score=eq.${encodeURIComponent(entry.score)}`,
  ].join("&");
}

async function remoteDailyEntryExists(entry, config = getDailyLeaderboardConfig()) {
  if (!entry?.completed || !dailyRemoteEnabled()) return false;

  const query =
    `select=date_key,player_id,score` +
    `&${buildDailyRemoteIdentityQuery(entry)}` +
    `&limit=1`;
  const url = `${config.supabaseUrl}/rest/v1/${config.table}?${query}`;
  const response = await fetchWithTimeout(url, {
    headers: getDailyRequestHeaders(config),
  });

  if (!response.ok) return false;

  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function submitDailyResultToRemote(entry, config = getDailyLeaderboardConfig()) {
  const variant = normalizeDailyVariant(entry.variant);
  let response = await fetchWithTimeout(`${config.supabaseUrl}/rest/v1/${config.table}`, {
    method: "POST",
    headers: getDailyRequestHeaders(config, true, "return=minimal"),
    body: JSON.stringify(buildDailyRemotePayload(entry, true, true)),
  });

  if (!response.ok && response.status !== 409) {
    response = await fetchWithTimeout(`${config.supabaseUrl}/rest/v1/${config.table}`, {
      method: "POST",
      headers: getDailyRequestHeaders(config, true, "return=minimal"),
      body: JSON.stringify(buildDailyRemotePayload(entry, true, false)),
    });
  }

  if (!response.ok && response.status !== 409) {
    response = await fetchWithTimeout(`${config.supabaseUrl}/rest/v1/${config.table}`, {
      method: "POST",
      headers: getDailyRequestHeaders(config, true, "return=minimal"),
      body: JSON.stringify(buildDailyRemotePayload(entry, false, false)),
    });
  }

  if (response.status === 409 && variant !== DAILY_VARIANT_NORMAL) {
    return { ok: false, status: response.status, conflict: true };
  }

  if (response.ok || response.status === 409) {
    return { ok: true, alreadyExists: response.status === 409 };
  }

  return { ok: false, status: response.status };
}

async function syncLocalDailyAttemptToRemote(dateKey, variant = DAILY_VARIANT_NORMAL) {
  const localAttempt = getLocalDailyAttempt(dateKey, variant);
  if (!localAttempt?.completed || !dailyRemoteEnabled()) {
    return { ok: false, synced: false, reason: "not_ready" };
  }

  const config = getDailyLeaderboardConfig();
  try {
    if (await remoteDailyEntryExists(localAttempt, config)) {
      saveLocalDailyAttempt({ ...localAttempt, source: "remote", completed: true });
      return { ok: true, synced: false, alreadyOnline: true };
    }

    const result = await submitDailyResultToRemote(localAttempt, config);
    if (result.ok) {
      saveLocalDailyAttempt({ ...localAttempt, source: "remote", completed: true });
      return { ok: true, synced: true, alreadyOnline: !!result.alreadyExists };
    }

    return { ok: false, synced: false, reason: "remote_save_failed" };
  } catch {
    return { ok: false, synced: false, reason: "network" };
  }
}

function normalizeDailyNameKey(name) {
  return String(name || "").trim().toLowerCase();
}

async function fetchDailyClearedNameSet(config, limit = 5000) {
  const clearedNames = new Set();
  const safeLimit = Math.max(1, Number(limit) || 5000);
  const headers = {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
  };

  const collectNames = (rows) => {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => {
      const key = normalizeDailyNameKey(row?.player_name);
      if (key) {
        clearedNames.add(key);
      }
    });
  };

  try {
    const byDailyClearsQuery =
      `select=player_name` +
      `&daily_clears=gt.0` +
      `&limit=${safeLimit}`;
    const byDailyClearsUrl = `${config.supabaseUrl}/rest/v1/${config.table}?${byDailyClearsQuery}`;
    let response = await fetchWithTimeout(byDailyClearsUrl, { headers });

    if (response.ok) {
      collectNames(await response.json());
    } else {
      response = null;
    }

    const byScoreQuery =
      `select=player_name` +
      `&score=gte.52` +
      `&limit=${safeLimit}`;
    const byScoreUrl = `${config.supabaseUrl}/rest/v1/${config.table}?${byScoreQuery}`;
    const scoreResponse = await fetchWithTimeout(byScoreUrl, { headers });
    if (scoreResponse.ok) {
      collectNames(await scoreResponse.json());
    } else if (!response) {
      return clearedNames;
    }
  } catch {
    return clearedNames;
  }

  return clearedNames;
}

function hasPlayedDaily(dateKey, variant = DAILY_VARIANT_NORMAL) {
  const attempt = getLocalDailyAttempt(dateKey, variant);
  return !!attempt && attempt.completed === true;
}

function buildDailyEntry({
  dateKey,
  variant = DAILY_VARIANT_NORMAL,
  seed,
  playerName,
  playerId,
  score,
  cardsCleared,
  cardScore,
  bonusScore,
  remainingCheats,
  remainingNudges,
  powerCount,
  tearCount,
  cheatBonus,
  nudgeBonus,
  powerBonus,
  tearPenalty,
  totalScore,
  completed = true,
  createdAt,
  source = "local",
  blueCleared,
  greenCleared,
  redCleared,
  dailyCleared,
  dailyClears,
  crownSummary,
  suitCounts,
}) {
  const normalizedSource = String(source || "local").toLowerCase();
  const shouldUseLocalCrowns =
    normalizedSource !== "remote" &&
    blueCleared === undefined &&
    greenCleared === undefined &&
    redCleared === undefined &&
    dailyCleared === undefined &&
    dailyClears === undefined &&
    crownSummary === undefined;

  const localCrowns = shouldUseLocalCrowns && typeof getLocalCrownSnapshot === "function"
    ? getLocalCrownSnapshot()
    : {
      blueCleared: false,
      greenCleared: false,
      redCleared: false,
      dailyCleared: false,
      dailyClears: 0,
      summary: "",
    };

  return normalizeDailyEntry({
    dateKey,
    variant,
    seed,
    playerName,
    playerId,
    score,
    cardsCleared,
    cardScore,
    bonusScore,
    remainingCheats,
    remainingNudges,
    powerCount,
    tearCount,
    cheatBonus,
    nudgeBonus,
    powerBonus,
    tearPenalty,
    totalScore,
    completed,
    createdAt: createdAt || new Date().toISOString(),
    source: normalizedSource,
    blueCleared: blueCleared ?? localCrowns.blueCleared,
    greenCleared: greenCleared ?? localCrowns.greenCleared,
    redCleared: redCleared ?? localCrowns.redCleared,
    dailyClears: dailyClears ?? localCrowns.dailyClears,
    dailyCleared: dailyCleared ?? localCrowns.dailyCleared,
    crownSummary: crownSummary ?? localCrowns.summary,
    suitCounts,
  });
}

function lockDailyAttempt(dateKey, seed, playerName, variant = DAILY_VARIANT_NORMAL) {
  return saveLocalDailyAttempt(
    buildDailyEntry({
      dateKey,
      variant,
      seed,
      playerName: playerName || "Unknown",
      playerId: getOrCreateDailyPlayerId(),
      score: 0,
      completed: false,
    })
  );
}

async function submitDailyResult(entry) {
  const normalized = buildDailyEntry(entry);
  saveLocalDailyAttempt({ ...normalized, completed: true });

  if (!dailyRemoteEnabled()) {
    return { ok: true, message: "Daily result saved locally.", entry: { ...normalized, completed: true } };
  }

  try {
    const result = await submitDailyResultToRemote(normalized);
    if (result.ok) {
      saveLocalDailyAttempt({ ...normalized, source: "remote", completed: true });
      return { ok: true, message: "Daily result saved.", entry: { ...normalized, completed: true } };
    }

    return { ok: true, message: "Daily result saved locally.", entry: { ...normalized, completed: true } };
  } catch {
    return { ok: true, message: "Daily result saved locally.", entry: { ...normalized, completed: true } };
  }
}

function compareDailyEntries(a, b) {
  if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
  if ((b.cardsCleared || 0) !== (a.cardsCleared || 0)) return (b.cardsCleared || 0) - (a.cardsCleared || 0);
  if ((a.tearCount || 0) !== (b.tearCount || 0)) return (a.tearCount || 0) - (b.tearCount || 0);
  if ((b.remainingCheats || 0) !== (a.remainingCheats || 0)) return (b.remainingCheats || 0) - (a.remainingCheats || 0);
  if ((b.remainingNudges || 0) !== (a.remainingNudges || 0)) return (b.remainingNudges || 0) - (a.remainingNudges || 0);
  return String(a.createdAt).localeCompare(String(b.createdAt));
}

async function fetchDailyLeaderboard(dateKey, limit = 100, variant = DAILY_VARIANT_NORMAL) {
  const normalizedVariant = normalizeDailyVariant(variant);
  let localAttempt = getLocalDailyAttempt(dateKey, normalizedVariant);

  if (!dailyRemoteEnabled()) {
    return buildDailyLeaderboardResult(localAttempt?.completed ? [localAttempt] : [], false, "offline_config");
  }

  const config = getDailyLeaderboardConfig();

  try {
    if (localAttempt?.completed) {
      const syncResult = await syncLocalDailyAttemptToRemote(dateKey, normalizedVariant);
      if (syncResult.ok) {
        localAttempt = getLocalDailyAttempt(dateKey, normalizedVariant);
      }
    }

    let activeSelect =
      "date_key,variant,seed,player_name,player_id,score,cards_cleared,bonus_score,remaining_cheats,remaining_nudges,power_count,tear_count,cheat_bonus,nudge_bonus,power_bonus,tear_penalty,total_score,blue_cleared,green_cleared,red_cleared,daily_clears,crown_summary,created_at";
    const queryPrimary =
      `select=${activeSelect}` +
      `&date_key=eq.${encodeURIComponent(dateKey)}` +
      `&variant=eq.${encodeURIComponent(normalizedVariant)}` +
      `&order=score.desc,created_at.asc&limit=${Math.max(1, limit)}`;
    const primaryUrl = `${config.supabaseUrl}/rest/v1/${config.table}?${queryPrimary}`;
    let response = await fetchWithTimeout(primaryUrl, {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
    });

    if (!response.ok) {
      if (normalizedVariant !== DAILY_VARIANT_NORMAL) {
        return buildDailyLeaderboardResult(localAttempt?.completed ? [localAttempt] : [], false, "offline_schema");
      }
      activeSelect = "date_key,variant,seed,player_name,player_id,score,blue_cleared,green_cleared,red_cleared,daily_clears,crown_summary,created_at";
      const queryCrownFallback =
        `select=${activeSelect}` +
        `&date_key=eq.${encodeURIComponent(dateKey)}` +
        `&variant=eq.${encodeURIComponent(normalizedVariant)}` +
        `&order=score.desc,created_at.asc&limit=${Math.max(1, limit)}`;
      const crownFallbackUrl = `${config.supabaseUrl}/rest/v1/${config.table}?${queryCrownFallback}`;
      response = await fetchWithTimeout(crownFallbackUrl, {
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
        },
      });
    }

    if (!response.ok) {
      if (normalizedVariant !== DAILY_VARIANT_NORMAL) {
        return buildDailyLeaderboardResult(localAttempt?.completed ? [localAttempt] : [], false, "offline_schema");
      }
      activeSelect = "date_key,variant,seed,player_name,player_id,score,created_at";
      const queryFallback =
        `select=${activeSelect}` +
        `&date_key=eq.${encodeURIComponent(dateKey)}` +
        `&variant=eq.${encodeURIComponent(normalizedVariant)}` +
        `&order=score.desc,created_at.asc&limit=${Math.max(1, limit)}`;
      const fallbackUrl = `${config.supabaseUrl}/rest/v1/${config.table}?${queryFallback}`;
      response = await fetchWithTimeout(fallbackUrl, {
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
        },
      });
    }

    if (!response.ok) {
      return buildDailyLeaderboardResult(localAttempt?.completed ? [localAttempt] : [], false, "offline_http");
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
      return buildDailyLeaderboardResult(localAttempt?.completed ? [localAttempt] : [], false, "offline_payload");
    }

    const dailySeed = getDailySeedForDate(dateKey, normalizedVariant);
    if (dailySeed) {
      try {
        const seedQuery =
          `select=${activeSelect}` +
          `&seed=eq.${encodeURIComponent(dailySeed)}` +
          `&variant=eq.${encodeURIComponent(normalizedVariant)}` +
          `&order=score.desc,created_at.asc&limit=${Math.max(1, limit)}`;
        const seedUrl = `${config.supabaseUrl}/rest/v1/${config.table}?${seedQuery}`;
        const seedResponse = await fetchWithTimeout(seedUrl, {
          headers: {
            apikey: config.supabaseAnonKey,
            Authorization: `Bearer ${config.supabaseAnonKey}`,
          },
        });
        if (seedResponse.ok) {
          const seedRows = await seedResponse.json();
          if (Array.isArray(seedRows)) {
            const rowKeys = new Set(rows.map((row) =>
              `${row.player_id || ""}::${row.player_name || ""}::${row.created_at || ""}::${row.score || ""}`
            ));
            seedRows.forEach((row) => {
              const key = `${row.player_id || ""}::${row.player_name || ""}::${row.created_at || ""}::${row.score || ""}`;
              if (!rowKeys.has(key)) {
                rowKeys.add(key);
                rows.push(row);
              }
            });
          }
        }
      } catch {
        // The date-key query already succeeded, so seed fallback is optional.
      }
    }

    try {
      const nextDateKey = incrementDateKey(dateKey);
      const createdAtQuery =
        `select=${activeSelect}` +
        `&created_at=gte.${encodeURIComponent(`${dateKey}T00:00:00.000Z`)}` +
        `&created_at=lt.${encodeURIComponent(`${nextDateKey}T00:00:00.000Z`)}` +
        `&variant=eq.${encodeURIComponent(normalizedVariant)}` +
        `&order=score.desc,created_at.asc&limit=${Math.max(1, limit)}`;
      const createdAtUrl = `${config.supabaseUrl}/rest/v1/${config.table}?${createdAtQuery}`;
      const createdAtResponse = await fetchWithTimeout(createdAtUrl, {
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
        },
      });
      if (createdAtResponse.ok) {
        const createdAtRows = await createdAtResponse.json();
        if (Array.isArray(createdAtRows)) {
          const rowKeys = new Set(rows.map((row) =>
            `${row.player_id || ""}::${row.player_name || ""}::${row.created_at || ""}::${row.score || ""}`
          ));
          createdAtRows.forEach((row) => {
            const rowDateKey = String(row.date_key || "").trim();
            const rowVariant = normalizeDailyVariant(row.variant);
            const rowSeed = String(row.seed || "").trim();
            const rowCreatedAt = String(row.created_at || "");
            const belongsToDaily =
              (rowVariant === normalizedVariant && rowDateKey === dateKey) ||
              (rowVariant === normalizedVariant && rowSeed === dailySeed) ||
              (
                normalizedVariant === DAILY_VARIANT_NORMAL &&
                rowVariant === DAILY_VARIANT_NORMAL &&
                rowSeed.endsWith(`|${dateKey}`)
              ) ||
              (
                normalizedVariant === DAILY_VARIANT_NORMAL &&
                rowVariant === DAILY_VARIANT_NORMAL &&
                rowCreatedAt.startsWith(dateKey)
              );
            if (!belongsToDaily) return;
            const key = `${row.player_id || ""}::${row.player_name || ""}::${row.created_at || ""}::${row.score || ""}`;
            if (!rowKeys.has(key)) {
              rowKeys.add(key);
              rows.push(row);
            }
          });
        }
      }
    } catch {
      // Recent-row fallback is only to rescue malformed current-day metadata.
    }

    const mapped = rows.map((row) =>
      buildDailyEntry({
        dateKey: row.date_key,
        variant: row.variant || normalizedVariant,
        seed: row.seed,
        playerName: row.player_name,
        playerId: row.player_id,
        score: row.score,
        cardsCleared: row.cards_cleared,
        bonusScore: row.bonus_score,
        remainingCheats: row.remaining_cheats,
        remainingNudges: row.remaining_nudges,
        powerCount: row.power_count,
        tearCount: row.tear_count,
        cheatBonus: row.cheat_bonus,
        nudgeBonus: row.nudge_bonus,
        powerBonus: row.power_bonus,
        tearPenalty: row.tear_penalty,
        totalScore: row.total_score,
        createdAt: row.created_at,
        source: "remote",
        blueCleared: row.blue_cleared,
        greenCleared: row.green_cleared,
        redCleared: row.red_cleared,
        dailyClears: row.daily_clears,
        crownSummary: row.crown_summary,
      })
    );

    if (localAttempt?.completed) {
      const matchingIndex = mapped.findIndex((entry) =>
        entry.playerId &&
        localAttempt.playerId &&
        entry.playerId === localAttempt.playerId &&
        entry.dateKey === localAttempt.dateKey &&
        entry.variant === localAttempt.variant
      );
      if (matchingIndex >= 0) {
        mapped[matchingIndex] = normalizeDailyEntry({
          ...mapped[matchingIndex],
          cardsCleared: localAttempt.cardsCleared,
          cardScore: localAttempt.cardScore,
          bonusScore: localAttempt.bonusScore,
          remainingCheats: localAttempt.remainingCheats,
          remainingNudges: localAttempt.remainingNudges,
          powerCount: localAttempt.powerCount,
          tearCount: localAttempt.tearCount,
          cheatBonus: localAttempt.cheatBonus,
          nudgeBonus: localAttempt.nudgeBonus,
          powerBonus: localAttempt.powerBonus,
          tearPenalty: localAttempt.tearPenalty,
          totalScore: localAttempt.score,
          score: localAttempt.score,
        });
      } else {
        mapped.push(localAttempt);
      }
    }

    const clearedNameSet = await fetchDailyClearedNameSet(config);
    if (clearedNameSet.size) {
      mapped.forEach((entry) => {
        const nameKey = normalizeDailyNameKey(entry.playerName);
        if (!nameKey || !clearedNameSet.has(nameKey)) return;
        entry.dailyCleared = true;
        entry.dailyClears = Math.max(1, Number(entry.dailyClears || 0));
        if (typeof buildCrownSummary === "function") {
          entry.crownSummary = buildCrownSummary({
            blueCleared: !!entry.blueCleared,
            greenCleared: !!entry.greenCleared,
            redCleared: !!entry.redCleared,
            dailyCleared: true,
          });
        }
      });
    }

    mapped.sort(compareDailyEntries);

    return buildDailyLeaderboardResult(mapped.slice(0, limit), true, "online");
  } catch {
    return buildDailyLeaderboardResult(localAttempt?.completed ? [localAttempt] : [], false, "offline_network");
  }
}

function addDaysToDateKey(dateKey, daysToAdd) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return getCurrentDailyDateKey(date);
}

function incrementDateKey(dateKey) {
  return addDaysToDateKey(dateKey, 1);
}

function decrementDateKey(dateKey) {
  return addDaysToDateKey(dateKey, -1);
}

const DAILY_LAUNCH_DATE = "2026-04-03";

function canNavigateToDate(dateKey) {
  const today = getCurrentDailyDateKey();
  // Can't go to future
  if (dateKey > today) return false;
  // Can't go before launch date
  if (dateKey < DAILY_LAUNCH_DATE) return false;
  return true;
}

function canNavigatePrevious(currentDateKey) {
  const prevDate = decrementDateKey(currentDateKey);
  return canNavigateToDate(prevDate);
}

function canNavigateNext(currentDateKey) {
  const nextDate = incrementDateKey(currentDateKey);
  return canNavigateToDate(nextDate);
}

function buildDailyGameUrl(dateKey, variant = DAILY_VARIANT_NORMAL) {
  const params = new URLSearchParams({
    mode: "daily",
    date: dateKey,
  });
  const normalizedVariant = normalizeDailyVariant(variant);
  if (normalizedVariant !== DAILY_VARIANT_NORMAL) {
    params.set("variant", normalizedVariant);
  }
  return `game.html?${params.toString()}`;
}

function getRequestedDailyDateKeyFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("date")) return "";
  return String(params.get("date") || "").trim();
}

function getRequestedDailyVariantFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return normalizeDailyVariant(params.get("variant"));
}
