function runSelfTests() {
      const a = [1, 2, 3, 4, 5];
      const b = [1, 2, 3, 4, 5];
      seededShuffle(a, "ABC123");
      seededShuffle(b, "ABC123");
      console.assert(JSON.stringify(a) === JSON.stringify(b), "Seeded shuffle should be deterministic for same seed.");
      console.assert(normalizeSeed(" ab-c1 ") === "AB-C1", "normalizeSeed should trim and uppercase.");
      console.assert(clamp(20, 1, 13) === 13, "clamp should cap high end.");
      console.assert(clamp(-1, 1, 13) === 1, "clamp should cap low end.");
      const empty = createEmptyState();
      console.assert(empty.streak === 0, "New state should start with streak 0.");
      console.assert(Array.isArray(empty.pendingCheatOptions) && empty.pendingCheatOptions.length === 0, "New state should start with no pending cheat options.");
      const options = getRandomCheatOptions(3);
      console.assert(options.length <= 3, "Should produce up to 3 cheat options.");
      const normalizedStats = normalizeCardStatsEntry({ correct: 2, attempts: 5 });
      console.assert(normalizedStats.endedRun === 0, "Legacy stat entries should gain endedRun field.");
      console.assert(normalizedStats.survivedRun === 0, "Legacy stat entries should gain survivedRun field.");
      console.assert(normalizedStats.guessStats.base.higher === 0, "Legacy stat entries should gain base guess stats.");
      console.assert(normalizedStats.guessStats.nudgedUp.lower === 0, "Legacy stat entries should gain nudged-up guess stats.");
      console.assert(normalizedStats.guessStats.nudgedDown.higher === 0, "Legacy stat entries should gain nudged-down guess stats.");
      console.assert(normalizedStats.endedRunFaceUpBase === 0, "Legacy stat entries should gain endedRunFaceUpBase field.");
      const priorState = state;
      state = { ...(state || createEmptyState()), powers: ["aces_wild"] };
      console.assert(getEffectiveValueForModifier({ value: 1 }, -1) === 13, "Aces Wild should let an Ace nudge down to King.");
      console.assert(getEffectiveValueForModifier({ value: 13 }, 1) === 1, "Aces Wild should let a King nudge up to Ace.");
      console.assert(isAceWildAutoCorrect(1, { value: 9 }) === true, "Aces Wild should auto-correct guesses from an Ace.");
      console.assert(isAceWildAutoCorrect(7, { value: 1 }) === true, "Aces Wild should auto-correct guesses when the next card is an Ace.");
      console.assert(isAceWildAutoCorrect(7, { value: 9 }) === false, "Aces Wild should not auto-correct non-Ace comparisons.");
      state = { ...(state || createEmptyState()), metaProgression: 999 };
      const powerSeedA = getRandomPowerOptions(2, "ABC123").map((power) => power.id).join("|");
      const powerSeedB = getRandomPowerOptions(2, "ABC123").map((power) => power.id).join("|");
      console.assert(powerSeedA === powerSeedB, "Seeded power offers should be deterministic for the same seed.");
      const powerOfferSeed = getStartPowerOfferSeed("ABC123");
      console.assert(powerOfferSeed.includes(GAME_VERSION), "Seeded power offers should be version-aware.");
      state = priorState;
    }

function getTestModeFlags() {
  const params = new URLSearchParams(window.location.search);
  const has = (key) => params.has(key);

  return {
    enabled: has("test") || has("debug"),
    dev: params.get("dev") === "true",
    addCheats: has("addcheats"),
    clearCheats: has("clearcheats"),
    resetStats: has("resetstats"),
    fullReset: has("fullreset"),
  };
}

function applyDebugActionsFromUrl() {
  const flags = getTestModeFlags();
  window.testModeEnabled = flags.enabled;
  window.devModeEnabled = flags.dev;

  if (!flags.enabled) return;

  // Precedence: destructive reset first, then narrower actions.
  if (flags.fullReset) {
    fullResetAllStateForDebug();
    return;
  }

  if (flags.resetStats) {
    resetAllStatsForDebug();
  }

  if (flags.clearCheats) {
    clearCheatsForDebug();
  }

  if (flags.addCheats) {
    addMissingCheatsForDebug();
  }

  if (!flags.resetStats && !flags.clearCheats && !flags.addCheats) {
    state.message = "Test mode enabled.";
  }
}

function initializeDailyModeFromUrl() {
  const requestedDailyDate = getRequestedDailyDateKeyFromUrl();
  if (!requestedDailyDate) return;
  const requestedDailyVariant = typeof getRequestedDailyVariantFromUrl === "function"
    ? getRequestedDailyVariantFromUrl()
    : "normal";

  if (hasPlayedDaily(requestedDailyDate, requestedDailyVariant)) {
    const params = new URLSearchParams({ date: requestedDailyDate });
    if (requestedDailyVariant !== "normal") {
      params.set("variant", requestedDailyVariant);
    }
    if (typeof window.appShellNavigate === "function") {
      window.appShellNavigate("daily", Object.fromEntries(params.entries()), { replace: true });
    } else {
      window.location.replace(`daily.html?${params.toString()}`);
    }
    return;
  }

  openDailyPowerChoice(requestedDailyDate, requestedDailyVariant);
}

function applyDeckLevelSelectionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const requestedDeck = params.get("deck");
  const requestedLevel = params.get("level");

  if (!requestedDeck && !requestedLevel) return;

  const selectedDeckKey = requestedDeck ? normalizeDeckKey(requestedDeck) : normalizeDeckKey(state.selectedDeckKey || loadSelectedDeck());
  const selectedLevelNumber = requestedLevel ? normalizeLevelNumber(requestedLevel) : normalizeLevelNumber(state.selectedLevelNumber || loadSelectedLevel());

  state.selectedDeckKey = selectedDeckKey;
  state.currentDeckKey = state.gameOver ? selectedDeckKey : state.currentDeckKey;
  state.pendingDeckKey = selectedDeckKey;
  state.selectedLevelNumber = selectedLevelNumber;
  state.currentLevelNumber = state.gameOver ? selectedLevelNumber : state.currentLevelNumber;
  state.pendingLevelNumber = selectedLevelNumber;
  state.bestScore = loadBestScore(selectedDeckKey, selectedLevelNumber);

  if (!window.devModeEnabled) {
    saveSelectedDeck(selectedDeckKey);
    saveSelectedLevel(selectedLevelNumber);
  }
}

function restoreGameStateFromUrlIfNeeded() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("resume") && !sessionStorage.getItem(GAME_STATE_SNAPSHOT_KEY)) return false;

  const snapshot = loadGameStateSnapshot();
  if (!snapshot) return false;
  const requestedDailyDate = getRequestedDailyDateKeyFromUrl();
  if (!params.has("resume") && requestedDailyDate) {
    const requestedDailyVariant = typeof getRequestedDailyVariantFromUrl === "function"
      ? getRequestedDailyVariantFromUrl()
      : "normal";
    const snapshotDailyVariant = typeof normalizeDailyVariant === "function"
      ? normalizeDailyVariant(snapshot.dailyVariant || snapshot.pendingDailyVariant || "normal")
      : snapshot.dailyVariant || snapshot.pendingDailyVariant || "normal";
    const snapshotMatchesDailyLaunch = snapshot.runMode === "daily" &&
      (snapshot.dailyDateKey || snapshot.pendingDailyDateKey) === requestedDailyDate &&
      snapshotDailyVariant === requestedDailyVariant &&
      !snapshot.gameOver;
    if (!snapshotMatchesDailyLaunch) {
      clearGameStateSnapshot();
      return false;
    }
  }

  state = snapshot;
  if (!state.current && Array.isArray(state.deck) && state.deck.length) {
    state.current = state.deck[state.index] || state.deck[0] || null;
  }

  if (params.has("resume")) {
    clearGameStateSnapshot();
  }

  return true;
}

runSelfTests();
applyDebugActionsFromUrl();
const restoredFromSnapshot = restoreGameStateFromUrlIfNeeded();
if (!restoredFromSnapshot) {
  applyDeckLevelSelectionFromUrl();
  if (!getRequestedDailyDateKeyFromUrl()) {
    previewOpeningRunFromControls();
  }
}
render();
if (!restoredFromSnapshot) {
  initializeDailyModeFromUrl();
}

window.appPrepareStandardRun = (deckKey = loadSelectedDeck(), levelNumber = loadSelectedLevel()) => {
  const selectedDeckKey = normalizeDeckKey(deckKey);
  const selectedLevelNumber = normalizeLevelNumber(levelNumber);
  clearGameStateSnapshot();
  state = createEmptyState();
  state.selectedDeckKey = selectedDeckKey;
  state.currentDeckKey = selectedDeckKey;
  state.pendingDeckKey = selectedDeckKey;
  state.selectedLevelNumber = selectedLevelNumber;
  state.currentLevelNumber = selectedLevelNumber;
  state.pendingLevelNumber = selectedLevelNumber;
  state.bestScore = loadBestScore(selectedDeckKey, selectedLevelNumber);
  saveSelectedDeck(selectedDeckKey);
  saveSelectedLevel(selectedLevelNumber);
  previewOpeningRunFromControls();
  render();
};

window.appStartDailyRun = (dateKey = getCurrentDailyDateKey(), variant = "normal") => {
  clearGameStateSnapshot();
  state = createEmptyState();
  render();
  openDailyPowerChoice(dateKey, variant);
};
