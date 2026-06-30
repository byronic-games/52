const POWER_CHOICE_LOCK_MS = 500;
const ENABLE_GAME_OVER_EFFECTS = true;
const ENABLE_VICTORY_EFFECTS = true;
const RUN_DEBUG_LOG_LIMIT = 150;

function getYellowJokerPool({
  levelNumber = DEFAULT_LEVEL_NUMBER,
  includeLocked = false,
} = {}) {
  const normalizedLevel = normalizeLevelNumber(levelNumber);
  return YELLOW_JOKERS
    .filter((joker) => includeLocked || normalizedLevel >= normalizeLevelNumber(joker.unlockLevel))
    .map((joker) => ({
      ...joker,
      type: "joker",
      suit: "Joker",
      rank: joker.shortName || joker.name,
      value: null,
    }));
}

function chooseYellowJokersForLevel(levelNumber = DEFAULT_LEVEL_NUMBER, seedString = "") {
  const normalizedLevel = normalizeLevelNumber(levelNumber);
  const pool = getYellowJokerPool({ includeLocked: true });
  if (!pool.length) return [];

  const jokerCount = Math.min(pool.length, Math.max(1, normalizedLevel));
  const shuffledJokers = [...pool];
  seededShuffle(shuffledJokers, `${seedString}|yellow-joker-picks|L${normalizedLevel}`);
  return shuffledJokers.slice(0, jokerCount);
}

function getYellowJokersForLevel(levelNumber = DEFAULT_LEVEL_NUMBER, seedString = "") {
  return chooseYellowJokersForLevel(levelNumber, seedString);
}

function createYellowJokerCard(joker, idSuffix = "") {
  if (!joker) return null;
  const baseId = joker.jokerId || joker.id || "yellow_joker";
  return {
    ...joker,
    id: idSuffix ? `${baseId}_${idSuffix}` : baseId,
    jokerId: baseId,
    type: "joker",
    suit: "Joker",
    rank: joker.shortName || joker.name || "Joker",
    value: null,
  };
}

function isJokerCard(card) {
  return !!card && card.type === "joker";
}

function getJokerName(card) {
  return card?.displayName || card?.name || "Joker";
}

function getJokerEffectRng(label = "joker") {
  const seedBase = normalizeSeed(state.runSeed || "") || "NO-SEED";
  const jokerId = state.current?.jokerId || state.current?.id || "";
  return mulberry32(stringToSeedNumber(`${GAME_VERSION}|${seedBase}|${state.index}|${jokerId}|${label}`));
}

function buildYellowDeck(baseDeck, seedString, levelNumber = DEFAULT_LEVEL_NUMBER) {
  const jokers = getYellowJokersForLevel(levelNumber, seedString);
  if (!jokers.length) return baseDeck;

  const safeOpening = baseDeck.slice(0, 4);
  const hazardPool = [
    ...baseDeck.slice(4),
    ...jokers.map((joker, index) => createYellowJokerCard(joker, String(index + 1))),
  ];

  seededShuffle(hazardPool, `${seedString}|yellow-jokers|L${normalizeLevelNumber(levelNumber)}`);
  return [...safeOpening, ...hazardPool];
}

function buildRunDeck(seedString, deckKey = "blue", levelNumber = DEFAULT_LEVEL_NUMBER) {
  const normalizedDeckKey = normalizeDeckKey(deckKey);
  const normalizedLevelNumber = normalizeLevelNumber(levelNumber);
  const deck = createDeck(seedString);
  return isJokerDeckKey(normalizedDeckKey)
    ? buildYellowDeck(deck, seedString, normalizedLevelNumber)
    : deck;
}

function buildRunFromControls(forceRandom = false, deckKey = loadSelectedDeck(), levelNumber = loadSelectedLevel()) {
  const seedInput = document.getElementById("run-seed-input");
  let chosenSeed = "";

  if (forceRandom) {
    chosenSeed = randomSeedString();
    if (seedInput) seedInput.value = chosenSeed;
  } else {
    chosenSeed = normalizeSeed(seedInput?.value) || randomSeedString();
    if (seedInput) seedInput.value = chosenSeed;
  }

  const normalizedDeckKey = normalizeDeckKey(deckKey);
  const normalizedLevelNumber = normalizeLevelNumber(levelNumber);
  const deck = buildRunDeck(chosenSeed, normalizedDeckKey, normalizedLevelNumber);

  // Onboard new players: always start with a protected card (A,2,3,4,9,10,J,Q,K)
  const metaProgression = loadMetaProgression();
  if ((metaProgression ?? 0) <= 20 && normalizedDeckKey !== "yellow") {
    // Find first protected card in the deck (by value)
    const protectedValues = [1, 2, 3, 4, 9, 10, 11, 12, 13];
    let foundIdx = deck.findIndex(card => protectedValues.includes(card.value));
    if (foundIdx > 0) {
      // Swap it to the top, preserving the rest of the deck order
      const firstCard = deck[0];
      deck[0] = deck[foundIdx];
      deck[foundIdx] = firstCard;
    }
  }
  return { chosenSeed, deck };
}

function buildDailyRun(dateKey, variant = "normal") {
  const chosenDateKey = String(dateKey || "").trim() || getCurrentDailyDateKey();
  const dailyConfig = typeof getDailyVariantConfig === "function"
    ? getDailyVariantConfig(variant)
    : { id: "normal", deckKey: "blue", levelNumber: DEFAULT_LEVEL_NUMBER };
  const chosenVariant = dailyConfig.id || "normal";
  const chosenSeed = getDailySeedForDate(chosenDateKey, chosenVariant);
  const dailyDeckKey = normalizeDeckKey(dailyConfig.deckKey || "blue");
  const dailyLevelNumber = normalizeLevelNumber(dailyConfig.levelNumber || DEFAULT_LEVEL_NUMBER);
  const deck = buildRunDeck(chosenSeed, dailyDeckKey, dailyLevelNumber);
  return { chosenDateKey, chosenVariant, chosenSeed, dailyDeckKey, dailyLevelNumber, deck };
}

let currentCardFeedbackTimer = null;
let currentCardNudgeAnimationTimer = null;
let gameShellFlashTimer = null;
let recentlySeenCardTimer = null;
let victoryEffectTimer = null;
let victoryConfettiWaveTimer = null;
let victoryConfettiClearTimer = null;
let gameOverMessageTimer = null;
let cardRevealAnimationToken = null;
const revealEffectRules = [];
const GAME_OVER_MESSAGE_REVEAL_DELAY_MS = 520;
const VICTORY_CONFETTI_FADE_MS = 420;

function isDevModeRun() {
  return !!(window.devModeEnabled || state?.devMode);
}

function setTemporaryMessage(message, durationMs = 2000) {
  state.message = String(message || "");
  state.temporaryMessageText = state.message;
  state.temporaryMessageUntil = Date.now() + Math.max(0, Number(durationMs) || 0);
}

function getComparisonDirection(currentValue, nextValue) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(nextValue)) return "unknown";
  if (nextValue === currentValue) return "match";
  return nextValue > currentValue ? "higher" : "lower";
}

function getEffectiveGuessType(type) {
  if (!state.rongActive) return type;
  if (type === "higher") return "lower";
  if (type === "lower") return "higher";
  return type;
}

function getForcedGuessMessage(direction) {
  const label = direction === "higher" ? "Higher" : "Lower";
  if (!state.rongActive) {
    return direction === "higher"
      ? "The Higher The Better is active - you must guess Higher."
      : "The Lower The Better is active - you must guess Lower.";
  }

  const buttonLabel = direction === "higher" ? "Lower" : "Higher";
  return `RONG is active - press ${buttonLabel} to make a ${label} guess.`;
}

function buildRevealEffectContext({
  outcome = "correct",
  guessType = "higher",
  currentComparisonValue = null,
  nextComparisonValue = null,
  revealCard = null,
  match = false,
  aceAutoWin = false,
  cheatSpecial = false,
} = {}) {
  return {
    outcome: outcome === "wrong" ? "wrong" : "correct",
    guessType,
    currentComparisonValue,
    nextComparisonValue,
    comparisonDirection: getComparisonDirection(currentComparisonValue, nextComparisonValue),
    revealCard,
    revealRank: revealCard?.rank || "",
    revealSuit: revealCard?.suit || "",
    revealActualValue: revealCard?.value ?? null,
    revealEffectiveValue: nextComparisonValue,
    isMatch: !!match,
    aceAutoWin: !!aceAutoWin,
    cheatSpecial: !!cheatSpecial,
  };
}

function registerRevealEffectRule(effectId, matcher) {
  if (!effectId || typeof matcher !== "function") return;
  revealEffectRules.push({ effectId: String(effectId), matcher });
}

function resolveRevealEffectId(context) {
  for (const rule of revealEffectRules) {
    try {
      if (rule.matcher(context)) return rule.effectId;
    } catch (_) {
      // Ignore bad custom rule and continue.
    }
  }
  return "";
}

window.registerRevealEffectRule = registerRevealEffectRule;

function queueCardRevealAnimation(options = {}) {
  cardRevealAnimationToken = (cardRevealAnimationToken || 0) + 1;
  const normalizedOutcome = options.outcome === "wrong" ? "wrong" : "correct";
  const revealCard = options.revealCard || null;
  const revealEffectiveValue = Number.isFinite(options.revealEffectiveValue)
    ? options.revealEffectiveValue
    : revealCard?.value ?? null;
  const revealStoredTemp = Number.isFinite(getTemporaryCardValue(revealCard));
  const revealIsTemp = !!revealCard && (
    revealStoredTemp ||
    (Number.isFinite(revealEffectiveValue) && revealEffectiveValue !== revealCard.value)
  );
  const fromCard = options.fromCard || null;
  const fromEffectiveValue = Number.isFinite(options.fromEffectiveValue)
    ? options.fromEffectiveValue
    : fromCard?.value ?? null;
  const fromStoredTemp = Number.isFinite(getTemporaryCardValue(fromCard));
  const fromIsTemp = !!fromCard && (
    fromStoredTemp ||
    (Number.isFinite(fromEffectiveValue) && fromEffectiveValue !== fromCard.value)
  );
  if (options.triggerGameOver) {
    state.gameOverMessageReady = false;
    state.gameOverMessageJustReleased = false;
  }

  state.pendingRevealAnimation = {
    id: cardRevealAnimationToken,
    outcome: normalizedOutcome,
    phase: "revealing",
    revealSwapDone: false,
    revealCard,
    revealEffectiveValue,
    revealIsTemp,
    fromCard,
    fromEffectiveValue,
    fromIsTemp,
    messageReleased: false,
    messageJustReleased: false,
    effectId: String(options.effectId || ""),
    feedbackEffect: String(options.feedbackEffect || normalizedOutcome),
    triggerGameOver: !!options.triggerGameOver,
    gameOverDetail: String(options.gameOverDetail || ""),
    initialDeal: !!options.initialDeal,
    clearSuitedAndBootedOnFinalize: !!options.clearSuitedAndBootedOnFinalize,
  };
}

function queueOpeningDealAnimation(deck) {
  const openingCard = Array.isArray(deck) ? deck[0] : null;
  if (!openingCard) return;
  queueCardRevealAnimation({
    outcome: "correct",
    revealCard: openingCard,
    revealEffectiveValue: openingCard.value ?? null,
    initialDeal: true,
  });
}

function revealPowerChoiceAfterOpeningDeal() {
  state.powerChoiceRevealPending = false;
  state.pendingOpeningCardRevealed = true;
  state.powerChoiceLockedUntil = Date.now() + POWER_CHOICE_LOCK_MS;
  state.powerChoiceIntroToken = (state.powerChoiceIntroToken || 0) + 1;
  if (typeof window.maybeStartPowerChoiceTutorial === "function" && state.pendingRunMode !== "daily") {
    window.setTimeout(() => window.maybeStartPowerChoiceTutorial(), 0);
  }
}

function clearGameOverEffects(options = {}) {
  const settleExperience = !!options.settleExperience;
  const gameEl = document.getElementById("game");
  const detailEl = document.getElementById("game-over-detail");
  if (gameOverMessageTimer) {
    clearTimeout(gameOverMessageTimer);
    gameOverMessageTimer = null;
  }
  if (
    settleExperience &&
    state.gameOver &&
    !state.openingPreview &&
    !state.victoryMessageActive &&
    !state.experienceAwardedForRun &&
    typeof awardExperienceForCurrentRun === "function"
  ) {
    awardExperienceForCurrentRun({ animate: false, pulse: false });
  }
  if (typeof completeExperienceBankingAnimation === "function") {
    completeExperienceBankingAnimation({ fade: true });
  }
  if (gameEl) {
    gameEl.classList.remove("game-over-effect");
  }
  if (detailEl) {
    detailEl.innerText = "";
  }
}

function clearVictoryEffects(options = {}) {
  const fade = !!options.fade;
  const gameEl = document.getElementById("game");
  const bannerEl = document.getElementById("victory-banner");
  const confettiEl = document.getElementById("victory-confetti");

  if (gameEl) {
    gameEl.classList.remove("victory-effect-active");
  }
  state.victoryMessageActive = false;
  state.victoryMessageJustReleased = false;
  if (bannerEl) {
    bannerEl.innerText = "";
  }
  if (victoryConfettiWaveTimer) {
    clearInterval(victoryConfettiWaveTimer);
    victoryConfettiWaveTimer = null;
  }
  if (victoryConfettiClearTimer) {
    clearTimeout(victoryConfettiClearTimer);
    victoryConfettiClearTimer = null;
  }
  if (confettiEl) {
    if (fade && confettiEl.childElementCount > 0) {
      confettiEl.classList.add("is-fading");
      victoryConfettiClearTimer = setTimeout(() => {
        confettiEl.innerHTML = "";
        confettiEl.classList.remove("is-fading");
        victoryConfettiClearTimer = null;
      }, VICTORY_CONFETTI_FADE_MS);
    } else {
      confettiEl.innerHTML = "";
      confettiEl.classList.remove("is-fading");
    }
  }
  if (victoryEffectTimer) {
    clearTimeout(victoryEffectTimer);
    victoryEffectTimer = null;
  }
}

function spawnVictoryConfetti() {
  const confettiEl = document.getElementById("victory-confetti");
  if (!confettiEl) return;

  const colors = ["#9ff0ff", "#5bdbfb", "#c7ff54", "#f5ebff", "#ffcf72", "#f77df6"];
  const piecesPerWave = 34;
  let waveIndex = 0;

  confettiEl.innerHTML = "";
  confettiEl.classList.remove("is-fading");

  const spawnWave = (waveOffset = 0) => {
    for (let i = 0; i < piecesPerWave; i += 1) {
      const piece = document.createElement("span");
      const driftX = Math.round((Math.random() - 0.5) * 140);
      const swayAmplitude = 14 + Math.round(Math.random() * 34);
      const swayDirection = Math.random() < 0.5 ? -1 : 1;
      const swayTiming = 0.72 + Math.random() * 0.56;
      const swayPhase = Math.random() * Math.PI * 2;
      const spinDirection = Math.random() < 0.5 ? -1 : 1;
      const spinAmount = spinDirection * (160 + Math.round(Math.random() * 380));
      const fallDuration = 3300 + Math.round(Math.random() * 1900);
      const setWavePoint = (progress) => {
        const wave = Math.sin((progress * Math.PI * 2 * 2.35 * swayTiming) + swayPhase);
        return `${Math.round((driftX * progress) + (wave * swayAmplitude * swayDirection))}px`;
      };
      piece.className = "confetti-piece";
      piece.style.setProperty("--x", `${Math.random() * 100}%`);
      piece.style.setProperty("--x-12", setWavePoint(0.12));
      piece.style.setProperty("--x-24", setWavePoint(0.24));
      piece.style.setProperty("--x-36", setWavePoint(0.36));
      piece.style.setProperty("--x-48", setWavePoint(0.48));
      piece.style.setProperty("--x-60", setWavePoint(0.6));
      piece.style.setProperty("--x-72", setWavePoint(0.72));
      piece.style.setProperty("--x-84", setWavePoint(0.84));
      piece.style.setProperty("--drift-x", `${driftX}px`);
      piece.style.setProperty("--fall-distance", `${105 + Math.round(Math.random() * 30)}vh`);
      piece.style.setProperty("--spin-12", `${Math.round(spinAmount * 0.12)}deg`);
      piece.style.setProperty("--spin-24", `${Math.round(spinAmount * 0.24)}deg`);
      piece.style.setProperty("--spin-36", `${Math.round(spinAmount * 0.36)}deg`);
      piece.style.setProperty("--spin-48", `${Math.round(spinAmount * 0.48)}deg`);
      piece.style.setProperty("--spin-60", `${Math.round(spinAmount * 0.6)}deg`);
      piece.style.setProperty("--spin-72", `${Math.round(spinAmount * 0.72)}deg`);
      piece.style.setProperty("--spin-84", `${Math.round(spinAmount * 0.84)}deg`);
      piece.style.setProperty("--spin-amount", `${spinAmount}deg`);
      piece.style.setProperty("--fall-duration", `${fallDuration}ms`);
      piece.style.setProperty("--fall-delay", `${waveOffset + Math.round(Math.random() * 320)}ms`);
      piece.style.setProperty("--confetti-color", colors[(waveIndex * piecesPerWave + i) % colors.length]);
      confettiEl.appendChild(piece);
      window.setTimeout(() => {
        piece.remove();
      }, waveOffset + fallDuration + 700);
    }
    waveIndex += 1;
  };

  spawnWave(0);
  spawnWave(320);
  spawnWave(640);
  victoryConfettiWaveTimer = setInterval(() => {
    spawnWave(0);
  }, 900);
}

function triggerVictoryEffect(titleText = "CONGRATULATIONS!") {
  if (!ENABLE_VICTORY_EFFECTS) return;

  const gameEl = document.getElementById("game");
  if (!gameEl) return;

  clearGameOverEffects();
  clearVictoryEffects();
  state.victoryMessageActive = true;
  state.victoryMessageJustReleased = true;
  state.message = titleText;
  state.temporaryMessageText = "";
  state.temporaryMessageUntil = 0;
  if (typeof awardExperienceForCurrentRun === "function") {
    awardExperienceForCurrentRun({
      animate: false,
      animateCompletionBonus: true,
      allowDevPreview: isDevModeRun(),
      persist: !isDevModeRun(),
      pulse: true,
    });
  }
  spawnVictoryConfetti();
  void gameEl.offsetWidth;
  gameEl.classList.add("victory-effect-active");
  if (typeof renderMessage === "function") renderMessage();
}

function triggerGameOverEffect(detailText = "") {
  if (!ENABLE_GAME_OVER_EFFECTS) {
    state.gameOverMessageReady = true;
    state.gameOverMessageJustReleased = true;
    if (typeof scheduleExperienceBankingAfterGameOver === "function") {
      scheduleExperienceBankingAfterGameOver();
    }
    return;
  }

  const gameEl = document.getElementById("game");
  const detailEl = document.getElementById("game-over-detail");
  if (!gameEl) return;

  clearGameOverEffects();
  state.gameOverMessageReady = false;
  state.gameOverMessageJustReleased = false;
  void gameEl.offsetWidth;
  gameEl.classList.add("game-over-effect");
  if (detailEl) {
    detailEl.innerText = detailText || "";
  }
  gameOverMessageTimer = setTimeout(() => {
    state.gameOverMessageReady = true;
    state.gameOverMessageJustReleased = true;
    gameOverMessageTimer = null;
    if (state.gameOver && typeof render === "function") render();
    if (typeof scheduleExperienceBankingAfterGameOver === "function") {
      scheduleExperienceBankingAfterGameOver();
    }
  }, GAME_OVER_MESSAGE_REVEAL_DELAY_MS);
}

function flashGameShell(effect) {
  const gameEl = document.getElementById("game");
  if (!gameEl) return;

  gameEl.classList.remove("flash-correct", "flash-wrong");
  if (gameShellFlashTimer) {
    clearTimeout(gameShellFlashTimer);
    gameShellFlashTimer = null;
  }

  if (!effect) return;

  gameEl.classList.add(`flash-${effect}`);
  gameShellFlashTimer = setTimeout(() => {
    gameEl.classList.remove("flash-correct", "flash-wrong");
    gameShellFlashTimer = null;
  }, 220);
}

function setRecentlySeenCard(cardId) {
  state.recentlySeenCardId = cardId || "";

  if (recentlySeenCardTimer) {
    clearTimeout(recentlySeenCardTimer);
    recentlySeenCardTimer = null;
  }

  if (!cardId) return;

  recentlySeenCardTimer = setTimeout(() => {
    state.recentlySeenCardId = "";
    recentlySeenCardTimer = null;
    renderSeenGrid();
  }, 468);
}

function setCurrentCardFeedback(effect) {
  state.currentCardFeedback = effect || "";

  if (currentCardFeedbackTimer) {
    clearTimeout(currentCardFeedbackTimer);
    currentCardFeedbackTimer = null;
  }

  if (!effect) return;

  currentCardFeedbackTimer = setTimeout(() => {
    state.currentCardFeedback = "";
    currentCardFeedbackTimer = null;
    render();
  }, 520);
}

function setCurrentCardNudgeAnimation(direction, fromValue, toValue) {
  if (!state.current || !Number.isFinite(fromValue) || !Number.isFinite(toValue) || fromValue === toValue) {
    state.currentNudgeAnimation = null;
    return;
  }

  const animation = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    cardId: state.current.id,
    direction: direction === "down" ? "down" : "up",
    fromValue,
    toValue,
  };

  state.currentNudgeAnimation = animation;

  if (currentCardNudgeAnimationTimer) {
    clearTimeout(currentCardNudgeAnimationTimer);
    currentCardNudgeAnimationTimer = null;
  }

  currentCardNudgeAnimationTimer = setTimeout(() => {
    if (state.currentNudgeAnimation?.id === animation.id) {
      state.currentNudgeAnimation = null;
      render();
    }
    currentCardNudgeAnimationTimer = null;
  }, 324);
}

function describeCardForDebug(card) {
  if (!card) return null;

  return {
    id: card.id,
    rank: card.rank,
    suit: card.suit,
    value: card.value,
  };
}

function getNextComparisonValueForGuess(nextCard = peekNext()) {
  if (isJokerCard(nextCard)) return null;
  if (!nextCard) return null;
  if (isBlankSpaceActiveForNextCard(nextCard)) {
    return getBlankSpaceDisplayValue();
  }
  const temporaryValue = getTemporaryCardValue(nextCard);
  if (Number.isFinite(temporaryValue)) {
    return clampCardValue(temporaryValue + (state.nextCardValueModifier || 0));
  }
  return clampCardValue(nextCard.value + (state.nextCardValueModifier || 0));
}

function isBlankSpaceActiveForNextCard(card = peekNext()) {
  if (!state.blankSpaceActive || !card || isJokerCard(card)) return false;
  const liveNextCard = peekNext();
  return !!liveNextCard && liveNextCard.id === card.id;
}

function getBlankSpaceDisplayValue() {
  if (!state.blankSpaceActive) return null;
  const baseValue = Number.isFinite(state.blankSpaceValue)
    ? state.blankSpaceValue
    : getCurrentEffectiveValue();
  if (!Number.isFinite(baseValue)) return null;
  return clampCardValue(baseValue + (state.nextCardValueModifier || 0));
}

function appendRunDebugLog(type, details = {}) {
  const nextCard = peekNext();
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    turn: Number(state.index) || 0,
    runSeed: state.runSeed || "",
    runMode: state.runMode || "standard",
    deck: normalizeDeckKey(state.currentDeckKey || state.selectedDeckKey || "blue"),
    level: normalizeLevelNumber(state.currentLevelNumber || state.selectedLevelNumber || DEFAULT_LEVEL_NUMBER),
    currentCard: describeCardForDebug(state.current),
    nextCard: describeCardForDebug(nextCard),
    currentValueModifier: state.currentValueModifier || 0,
    nextCardValueModifier: state.nextCardValueModifier || 0,
    currentEffectiveValue: state.current ? getCurrentEffectiveValue() : null,
    nextCheatValue: nextCard ? getUpcomingCheatValue(1) : null,
    nextGuessValue: getNextComparisonValueForGuess(nextCard),
    powers: Array.isArray(state.powers) ? [...state.powers] : [],
    ...details,
  };

  const nextLog = [...(Array.isArray(state.runDebugLog) ? state.runDebugLog : []), entry].slice(-RUN_DEBUG_LOG_LIMIT);
  state.runDebugLog = nextLog;
  if (!isDevModeRun()) {
    saveRunDebugLog(nextLog);
  }
  return entry;
}

function exportRunDebugLog() {
  return JSON.stringify(Array.isArray(state.runDebugLog) ? state.runDebugLog : [], null, 2);
}

window.getRunDebugLog = () => Array.isArray(state.runDebugLog) ? [...state.runDebugLog] : [];
window.exportRunDebugLog = exportRunDebugLog;

function queueCheatAward(reason = "streak") {
  if (!Array.isArray(state.pendingCheatAwardQueue)) {
    state.pendingCheatAwardQueue = [];
  }
  state.pendingCheatAwardQueue.push(String(reason || "streak"));
}

function queuePowerAward(reason = "bonus") {
  if (!Array.isArray(state.pendingPowerAwardQueue)) {
    state.pendingPowerAwardQueue = [];
  }
  state.pendingPowerAwardQueue.push(String(reason || "bonus"));
}

function advanceCheatRewardStreak() {
  state.streak = (state.streak || 0) + 1;
  if (state.streak < getCheatRewardThreshold()) return false;
  state.streak = 0;
  return true;
}

function getDailyScoredBonusCount(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function getAvailableDailyPowerPickCredit(requestedCount) {
  const requested = getDailyScoredBonusCount(requestedCount);
  if (requested <= 0) return 0;
  if (typeof getUnlockedPowerPool !== "function") return requested;

  const currentPowerIds = new Set(getExcludedRunPowerIds());
  const alreadyCredited = getDailyScoredBonusCount(state.dailyScoredBonusPowerPicks);
  const availablePowerCount = getUnlockedPowerPool(true)
    .filter((power) => power?.id && !currentPowerIds.has(power.id))
    .length;

  return Math.min(requested, Math.max(0, availablePowerCount - alreadyCredited));
}

function creditDailyEndgameBonusPicks({ cheatPicks = 0, powerPicks = 0, reason = "final_card" } = {}) {
  if (state.runMode !== "daily") {
    return { cheatPicks: 0, powerPicks: 0 };
  }

  const scoredCheatPicks = getDailyScoredBonusCount(cheatPicks);
  const scoredPowerPicks = getAvailableDailyPowerPickCredit(powerPicks);

  if (scoredCheatPicks > 0) {
    state.dailyScoredBonusCheatPicks =
      getDailyScoredBonusCount(state.dailyScoredBonusCheatPicks) + scoredCheatPicks;
  }

  if (scoredPowerPicks > 0) {
    state.dailyScoredBonusPowerPicks =
      getDailyScoredBonusCount(state.dailyScoredBonusPowerPicks) + scoredPowerPicks;
  }

  if (scoredCheatPicks > 0 || scoredPowerPicks > 0) {
    appendRunDebugLog("daily_endgame_bonus_scored", {
      reason,
      cheatPicks: scoredCheatPicks,
      powerPicks: scoredPowerPicks,
      totalScoredCheatPicks: state.dailyScoredBonusCheatPicks || 0,
      totalScoredPowerPicks: state.dailyScoredBonusPowerPicks || 0,
    });
  }

  return { cheatPicks: scoredCheatPicks, powerPicks: scoredPowerPicks };
}

function creditDailyFinalCardBonusPicks({
  blankSpacePowerTriggered = false,
  brucieBonusTriggered = false,
  catch22Hit = false,
  blackjackHit = false,
  diamondGeezerHit = false,
  cheatACheaterWillTrigger = false,
  equals11Hit = false,
  higherHigherHigherCompleted = false,
  newSuitsResult = null,
  psychoCompleted = false,
  sixSevenWasArmed = false,
  wlCompleted = false,
} = {}) {
  if (state.runMode !== "daily") {
    return { cheatPicks: 0, powerPicks: 0 };
  }

  let cheatPicks = 0;
  let powerPicks = 0;

  if (sixSevenWasArmed) cheatPicks += 3;
  if (wlCompleted) cheatPicks += 3;
  if (equals11Hit) cheatPicks += 3;
  if (cheatACheaterWillTrigger) cheatPicks += 2;
  if (newSuitsResult?.completed) {
    cheatPicks += getDailyScoredBonusCount(newSuitsResult.awardCount);
  }

  if (blankSpacePowerTriggered) powerPicks += 1;
  if (brucieBonusTriggered) powerPicks += 1;
  if (higherHigherHigherCompleted) powerPicks += 1;
  if (catch22Hit) powerPicks += 1;
  if (blackjackHit) powerPicks += 1;
  if (psychoCompleted) powerPicks += 1;
  if (diamondGeezerHit) cheatPicks += 2;

  const wouldPauseBeforeStreak =
    blankSpacePowerTriggered ||
    sixSevenWasArmed ||
    wlCompleted ||
    higherHigherHigherCompleted ||
    catch22Hit ||
    psychoCompleted;
  const streakWouldAward =
    state.streak >= getCheatRewardThreshold() &&
    (!wouldPauseBeforeStreak || equals11Hit);

  if (streakWouldAward) cheatPicks += 1;

  return creditDailyEndgameBonusPicks({
    cheatPicks,
    powerPicks,
    reason: "final_card",
  });
}

function getDailyPowerOfferSeed(offerIndex) {
  return `${state.runSeed}|daily-power-offer-v1|${offerIndex}`;
}

function getExcludedRunPowerIds() {
  return Array.from(new Set((state.powers || []).filter((powerId) => powerId && powerId !== "nudge_engine")));
}

function grantPowerToCurrentRun(powerId, source = "bonus") {
  const power = getPowerById(powerId);
  if (!power) return false;
  if (!Array.isArray(state.powers)) {
    state.powers = [];
  }
  if (state.powers.includes(power.id)) {
    return false;
  }
  if (typeof recordDiscoveredPowers === "function") {
    recordDiscoveredPowers(power.id);
  }
  state.powers.push(power.id);
  applyRunPowerSetup(power.id);
  appendRunDebugLog("power_selected", {
    awardReason: source,
    powerId: power.id,
    powerName: power.name,
    powersAfterPick: [...state.powers],
    message: `Power gained: ${power.name}.`,
  });
  return true;
}

function getLockySevenCarryModifier(card, nextComparisonValue, nextCardModifier) {
  if (!state.lockySevensActive || !card) return 0;
  if (isJokerCard(card) || !Number.isFinite(card.value)) return 0;
  if (nextComparisonValue !== 7) return 0;
  if ((nextCardModifier || 0) === 0 && card.value !== 7) return 0;
  return 7 - card.value;
}

function offerRewardPowerChoice(reason = "bonus") {
  const isDailyRun = state.runMode === "daily";
  const excludeIds = getExcludedRunPowerIds();
  const seededOfferIndex = (state.dailyPowerOfferCount || 0) + 1;
  const seedString = isDailyRun ? getDailyPowerOfferSeed(seededOfferIndex) : "";
  const powerOptions = getRandomPowerOptions(2, seedString, isDailyRun, excludeIds);

  if (!powerOptions.length) {
    state.activePowerAwardReason = "";
    return false;
  }

  if (isDailyRun) {
    state.dailyPowerOfferCount = seededOfferIndex;
  }

  state.pendingPowerOptions = powerOptions;
  state.powerChoiceLockedUntil = Date.now() + POWER_CHOICE_LOCK_MS;
  state.powerChoiceIntroToken = (state.powerChoiceIntroToken || 0) + 1;
  state.activePowerAwardReason = String(reason || "bonus");
  state.message = "";
  state.temporaryMessageText = "";
  state.temporaryMessageUntil = 0;

  appendRunDebugLog("power_offer_presented", {
    awardReason: state.activePowerAwardReason,
    optionCount: state.pendingPowerOptions.length,
    options: state.pendingPowerOptions.map((option) => ({
      id: option.id,
      name: option.name,
      rarity: option.rarity || "common",
    })),
    message: state.message,
  });

  render();
  return true;
}

function resolvePendingRewardQueues() {
  if ((state.sixSevenRewardChoicesRemaining || 0) > 0) {
    offerCheatChoice();
    return true;
  }
  if ((state.pendingCheatAwardQueue || []).length > 0) {
    const nextReason = state.pendingCheatAwardQueue.shift();
    offerCheatChoice(nextReason);
    return true;
  }
  if ((state.pendingPowerAwardQueue || []).length > 0) {
    const nextReason = state.pendingPowerAwardQueue.shift();
    return offerRewardPowerChoice(nextReason);
  }
  return false;
}

function previewPendingRunBehindPowerChoice(deck, runMode = "standard", deckKey = "blue", levelNumber = DEFAULT_LEVEL_NUMBER) {
  if (!Array.isArray(deck) || deck.length === 0) return;

  const normalizedDeckKey = normalizeDeckKey(deckKey);
  const normalizedLevelNumber = normalizeLevelNumber(levelNumber);

  state.deck = [...deck];
  state.index = -1;
  state.current = null;
  state.gameOver = false;
  state.openingPreview = false;
  state.handCard = null;
  state.currentValueModifier = 0;
  state.nextCardValueModifier = 0;
  state.correctAnswers = 0;
  state.streak = 0;
  state.seenCardIds = new Set();
  state.gridCardIds = new Set();
  state.cheats = [];
  state.nudgeUpCharges = 0;
  state.nudgeDownCharges = 0;
  state.nudgeNudgeArmed = false;
  state.nudgeNudgeStacks = 0;
  state.fiveAliveNudgeLocked = false;
  state.temporaryCardBackRepairs = {};
  state.temporaryCardBackMarks = {};
  state.temporaryCardValues = {};
  state.bingoCornersAwarded = false;
  state.bingoLineAwardCount = 0;
  state.oneLifeLeftLives = 0;
  state.killerQueenLives = 0;
  state.cursedShieldArmed = false;
  state.cursedShieldCharges = 0;
  state.redDeadRedemptionArmed = false;
  state.lucky13Armed = false;
  state.blackjackArmed = false;
  state.diamondGeezerArmed = false;
  state.newSuitsRemaining = 0;
  state.newSuitsSeen = {};
  state.allInRemaining = 0;
  state.allInNudgeUpStake = 0;
  state.allInNudgeDownStake = 0;
  state.energy = 0;
  state.lastJokerMessage = "";
  state.currentDeckKey = normalizedDeckKey;
  state.currentLevelNumber = normalizedLevelNumber;
  state.bestScore = loadBestScore(normalizedDeckKey, normalizedLevelNumber);
  state.selectedStartPowerId = null;
  state.powers = [];
  state.gameOverDisplayCards = null;
  state.gameOverMessageReady = false;
  state.gameOverMessageJustReleased = false;
  state.victoryMessageActive = false;
  state.victoryMessageJustReleased = false;
  state.experience = loadExperience();
  state.displayExperience = null;
  state.experienceAwardedForRun = false;
  state.experienceBanking = null;
  state.experienceBankedCardIds = new Set();
  state.experiencePreviewUntil = 0;
  state.experienceMilestonesAwarded = new Set();
  state.pendingExperienceBonuses = [];
  state.unusedCheatExperienceAwarded = false;
  state.currentCardFeedback = "";
  state.currentNudgeAnimation = null;
  state.pendingRevealAnimation = null;
  state.powerChoiceRevealPending = false;
  state.pendingOpeningCardRevealed = false;
  state.message = "";
  state.temporaryMessageText = "";
  state.temporaryMessageUntil = 0;
}

function previewOpeningRunFromControls() {
  if (state.current || !state.gameOver) return;

  const selectedDeckKey = normalizeDeckKey(state.selectedDeckKey || loadSelectedDeck());
  const selectedLevelNumber = normalizeLevelNumber(state.selectedLevelNumber || loadSelectedLevel());
  const { chosenSeed, deck } = buildRunFromControls(false, selectedDeckKey, selectedLevelNumber);
  if (!Array.isArray(deck) || !deck.length) return;

  previewPendingRunBehindPowerChoice(deck, "standard", selectedDeckKey, selectedLevelNumber);
  state.gameOver = true;
  state.openingPreview = true;
  state.pendingRunSeed = chosenSeed;
  state.pendingRunDeck = [...deck];
  state.pendingRunMode = "standard";
  state.pendingDailyDateKey = "";
  state.pendingDailyVariant = "normal";
  state.pendingDeckKey = selectedDeckKey;
  state.pendingLevelNumber = selectedLevelNumber;
  state.pendingCheatOptions = [];
  state.pendingPowerOptions = [];
  state.pendingCheatAwardQueue = [];
  state.pendingPowerAwardQueue = [];
  state.cheatChoiceLockedUntil = 0;
  state.powerChoiceLockedUntil = 0;
  state.restartConfirmArmed = false;
}

const TUTORIAL_RUN_SEED = "TUTOR1AL";

function openPowerChoice(forceRandom = false) {
  clearGameOverEffects({ settleExperience: true });
  clearVictoryEffects({ fade: state.victoryMessageActive || state.gameOver });
  const selectedDeckKey = normalizeDeckKey(state.selectedDeckKey || loadSelectedDeck());
  const selectedLevelNumber = normalizeLevelNumber(state.selectedLevelNumber || loadSelectedLevel());
  const tutorialAssistActive = selectedDeckKey !== "black" && shouldApplyTutorialAssistForStandardRun("standard");
  const { chosenSeed, deck } = tutorialAssistActive
    ? {
        chosenSeed: TUTORIAL_RUN_SEED,
        deck: buildRunDeck(TUTORIAL_RUN_SEED, selectedDeckKey, selectedLevelNumber),
      }
    : buildRunFromControls(forceRandom, selectedDeckKey, selectedLevelNumber);

  if (selectedDeckKey === "black") {
    state.pendingRunSeed = chosenSeed;
    state.pendingRunDeck = deck;
    state.pendingRunMode = "standard";
    state.pendingDailyDateKey = "";
    state.pendingDailyVariant = "normal";
    state.pendingDeckKey = "black";
    state.pendingLevelNumber = 1;
    state.pendingCheatOptions = [];
    state.pendingPowerOptions = [];
    state.pendingCheatAwardQueue = [];
    state.pendingPowerAwardQueue = [];
    state.cheatChoiceLockedUntil = 0;
    state.cheatChoicePreviewIndex = -1;
    state.cheatChoiceAnimating = null;
    state.powerChoiceAnimating = null;
    state.powerChoiceLockedUntil = 0;
    state.activePowerAwardReason = "";
    state.pauseForCheat = false;
    state.restartConfirmArmed = false;
    state.deckStatsTooltipOpen = false;
    startRunWithPower(null);
    return;
  }

  state.pendingRunSeed = chosenSeed;
  state.pendingRunDeck = deck;
  if (tutorialAssistActive) {
    makeTutorialFriendlyOpeningCard(deck);
  }
  state.pendingPowerOptions = tutorialAssistActive
    ? getTutorialNudgePowerOptions(2, chosenSeed)
    : getRandomPowerOptions(2, chosenSeed);
  state.pendingRunMode = "standard";
  state.pendingDailyDateKey = "";
  state.pendingDailyVariant = "normal";
  state.pendingDeckKey = selectedDeckKey;
  state.pendingLevelNumber = selectedLevelNumber;
  state.pendingCheatOptions = [];
  state.pendingPowerAwardQueue = [];
  state.cheatChoiceLockedUntil = 0;
  state.cheatChoicePreviewIndex = -1;
  state.cheatChoiceAnimating = null;
  state.powerChoiceAnimating = null;
  state.powerChoiceRevealPending = true;
  state.pendingOpeningCardRevealed = false;
  state.powerChoiceLockedUntil = 0;
  state.activePowerAwardReason = "";
  state.pauseForCheat = false;
  state.restartConfirmArmed = false;
  state.deckStatsTooltipOpen = false;
  previewPendingRunBehindPowerChoice(deck, "standard", state.pendingDeckKey, state.pendingLevelNumber);
  queueOpeningDealAnimation(deck);
  state.message = "";
  state.temporaryMessageText = "";
  state.temporaryMessageUntil = 0;
  render();
}

function openDailyPowerChoice(dateKey = "", variant = "normal") {
  clearGameOverEffects({ settleExperience: true });
  clearVictoryEffects({ fade: state.victoryMessageActive || state.gameOver });
  const { chosenDateKey, chosenVariant, chosenSeed, dailyDeckKey, dailyLevelNumber, deck } = buildDailyRun(dateKey, variant);

  state.pendingRunSeed = chosenSeed;
  state.pendingRunDeck = deck;
  state.pendingPowerOptions = getRandomPowerOptions(2, chosenSeed, true);
  state.pendingRunMode = "daily";
  state.pendingDailyDateKey = chosenDateKey;
  state.pendingDailyVariant = chosenVariant;
  state.pendingDeckKey = dailyDeckKey;
  state.pendingLevelNumber = dailyLevelNumber;
  state.pendingCheatOptions = [];
  state.pendingPowerAwardQueue = [];
  state.cheatChoiceLockedUntil = 0;
  state.cheatChoicePreviewIndex = -1;
  state.cheatChoiceAnimating = null;
  state.powerChoiceAnimating = null;
  state.powerChoiceRevealPending = true;
  state.pendingOpeningCardRevealed = false;
  state.powerChoiceLockedUntil = 0;
  state.activePowerAwardReason = "";
  state.pauseForCheat = false;
  state.restartConfirmArmed = false;
  state.deckStatsTooltipOpen = false;
  previewPendingRunBehindPowerChoice(deck, "daily", dailyDeckKey, dailyLevelNumber);
  queueOpeningDealAnimation(deck);
  state.message = "";
  state.temporaryMessageText = "";
  state.temporaryMessageUntil = 0;
  render();
}

function addCheatCopiesToHand(cheatId, count) {
  const cheat = CHEATS.find((entry) => entry.id === cheatId);
  if (!cheat || count <= 0) return;

  for (let i = 0; i < count; i += 1) {
    state.cheats.push({ ...cheat });
  }
}

function applyRunPowerSetup(powerId) {
  switch (powerId) {
    case "balanced_nudges":
      state.nudgeUpCharges = (state.nudgeUpCharges || 0) + 5;
      state.nudgeDownCharges = (state.nudgeDownCharges || 0) + 5;
      break;
    case "updraft":
      state.nudgeUpCharges = (state.nudgeUpCharges || 0) + 10;
      break;
    case "downforce":
      state.nudgeDownCharges = (state.nudgeDownCharges || 0) + 10;
      break;
    case "swap_stack":
      addCheatCopiesToHand("swap", 4);
      break;
    case "lucky_opening":
      addCheatCopiesToHand("lucky_7", 4);
      break;
    case "tears_before_playtime":
      addCheatCopiesToHand("tear_corner", 2);
      break;
    case "bingo":
      initializeBingoProgressFromCurrentGrid();
      break;
    case "locky_7s":
      state.lockySevensActive = true;
      state.nudgeUpCharges = (state.nudgeUpCharges || 0) + 10;
      state.nudgeDownCharges = (state.nudgeDownCharges || 0) + 10;

      if (getCurrentEffectiveValue() === 7 && state.current) {
        state.currentValueModifier = 7 - state.current.value;
      }

      {
        const nextValue = getUpcomingCheatValue(1);
        if (nextValue === 7) {
          const next = peekNext();
          if (next) {
            state.nextCardValueModifier = 7 - next.value;
          }
        }
      }
      break;
    default:
      break;
  }
}

function shouldApplyTutorialAssistForStandardRun(runMode = "standard") {
  if (runMode === "daily") return false;

  const tutorialCompletedKey = typeof TUTORIAL_COMPLETED_KEY === "string"
    ? TUTORIAL_COMPLETED_KEY
    : "hl_prototype_tutorial_completed_v1";
  const tutorialForceReplayKey = typeof TUTORIAL_FORCE_REPLAY_KEY === "string"
    ? TUTORIAL_FORCE_REPLAY_KEY
    : "hl_prototype_tutorial_force_replay_v1";

  const forcedReplay = sessionStorage.getItem(tutorialForceReplayKey) === "1";
  if (forcedReplay) return true;

  const completed = localStorage.getItem(tutorialCompletedKey) === "1";
  if (completed) return false;

  const runsStarted = Number(loadProfileStats()?.runsStarted || 0);
  return runsStarted <= 1;
}

function makeTutorialFriendlyOpeningCard(deck) {
  if (!Array.isArray(deck) || deck.length < 2) return;
  const threeIndex = deck.findIndex((card, idx) => idx >= 0 && card && card.value === 3);
  if (threeIndex > 0) {
    [deck[0], deck[threeIndex]] = [deck[threeIndex], deck[0]];
    return;
  }

  const first = deck[0];
  if (!first || (first.value !== 1 && first.value !== 13)) return;

  const replacementIndex = deck.findIndex((card, idx) =>
    idx > 0 && card && card.value !== 1 && card.value !== 13
  );

  if (replacementIndex <= 0) return;
  [deck[0], deck[replacementIndex]] = [deck[replacementIndex], deck[0]];
}

function startRunWithPower(powerId) {
  document.body?.classList.remove("choice-modal-open", "power-choice-open", "cheat-choice-open");
  clearGameOverEffects();
  clearVictoryEffects();
  const chosenSeed =
    state.pendingRunSeed ||
    normalizeSeed(document.getElementById("run-seed-input")?.value) ||
    randomSeedString();
  const deck = state.pendingRunDeck?.length
    ? [...state.pendingRunDeck]
    : buildRunFromControls(false).deck;
  const runMode = state.pendingRunMode || "standard";
  const dailyDateKey = runMode === "daily" ? state.pendingDailyDateKey || getCurrentDailyDateKey() : "";
  const dailyVariant = runMode === "daily" && typeof normalizeDailyVariant === "function"
    ? normalizeDailyVariant(state.pendingDailyVariant)
    : "normal";
  const dailyConfig = runMode === "daily" && typeof getDailyVariantConfig === "function"
    ? getDailyVariantConfig(dailyVariant)
    : null;
  const selectedDeckKey = normalizeDeckKey(state.selectedDeckKey || loadSelectedDeck());
  const selectedLevelNumber = normalizeLevelNumber(state.selectedLevelNumber || loadSelectedLevel());
  const currentDeckKey = runMode === "daily"
    ? normalizeDeckKey(dailyConfig?.deckKey || state.pendingDeckKey || "blue")
    : normalizeDeckKey(state.pendingDeckKey || selectedDeckKey);
  const blackRun = runMode !== "daily" && currentDeckKey === "black";
  const selectedPower = blackRun ? null : getPowerById(powerId);
  const greenRun = runMode !== "daily" && isEnergyDeckKey(currentDeckKey);
  const currentLevelNumber = runMode === "daily"
    ? normalizeLevelNumber(dailyConfig?.levelNumber || state.pendingLevelNumber || DEFAULT_LEVEL_NUMBER)
    : normalizeLevelNumber(state.pendingLevelNumber || selectedLevelNumber);
  const selectedPowerId = blackRun ? null : (selectedPower?.id || POWERS[0]?.id || null);
  const activePowers = blackRun
    ? []
    : selectedPowerId
    ? Array.from(new Set([selectedPowerId, "nudge_engine"]))
    : ["nudge_engine"];
  if (selectedPowerId && typeof recordDiscoveredPowers === "function") {
    recordDiscoveredPowers(selectedPowerId);
  }
  const openingDealAlreadyStarted =
    !blackRun &&
    deck[0]?.id &&
    (
      !!state.pendingOpeningCardRevealed ||
      state.current?.id === deck[0].id ||
      (
        !!state.pendingRevealAnimation?.initialDeal &&
        state.pendingRevealAnimation?.revealCard?.id === deck[0].id
      )
    );

  if (!blackRun && !openingDealAlreadyStarted && shouldApplyTutorialAssistForStandardRun(runMode)) {
    makeTutorialFriendlyOpeningCard(deck);
  }

  state = {
    deck,
    index: 0,
    current: deck[0],
    cheats: [],
    pendingCheatOptions: [],
    pendingCheatAwardQueue: [],
    pendingPowerAwardQueue: [],
    message:
      activePowers.length > 0
        ? `Run started with seed ${chosenSeed} and power: ${activePowers
            .map(getPowerName)
            .join(", ")}.`
        : `Run started with seed ${chosenSeed}.`,
    temporaryMessageText: "",
    temporaryMessageUntil: 0,
    playerLog: [],
    lastPlayerLogMessage: "",
    gameOver: false,
    openingPreview: false,
    gameOverMessageReady: false,
    gameOverMessageJustReleased: false,
    victoryMessageActive: false,
    victoryMessageJustReleased: false,
    experience: loadExperience(),
    displayExperience: null,
    experienceAwardedForRun: false,
    experienceBanking: null,
    experienceBankedCardIds: new Set(),
    experiencePreviewUntil: 0,
    experienceMilestonesAwarded: new Set(),
    pendingExperienceBonuses: [],
    unusedCheatExperienceAwarded: false,
    handCard: null,
    currentValueModifier: 0,
    currentNudgeUpUsed: 0,
    currentNudgeDownUsed: 0,
    currentNudgeValueModifier: 0,
    currentNudgeLogFlushed: false,
    correctAnswers: 0,
    streak: 0,
    bestScore: runMode === "daily" ? 0 : loadBestScore(currentDeckKey, currentLevelNumber),
    seenCardIds: new Set([deck[0].id]),
    gridCardIds: new Set([deck[0].id]),
    powers: activePowers,
    selectedStartPowerId: selectedPowerId,
    selectedDeckKey,
    currentDeckKey,
    selectedLevelNumber,
    currentLevelNumber,
    runDebugLog: [],
    metaProgression: loadMetaProgression(),
    cardStats: loadCardStats(),
    cardBackStatuses: loadCardBackStatuses(),
    temporaryCardBackRepairs: {},
    temporaryCardBackMarks: {},
    temporaryCardValues: {},
    deckWins: loadDeckWins(),
    deckLevelClears: loadDeckLevelClears(),
    cheatUnlocks: loadCheatUnlocks(),
    runMode,
    devMode: !!window.devModeEnabled,
    dailyDateKey,
    dailyVariant,
    dailyCheatOfferCount: 0,
    dailyPowerOfferCount: 0,
    dailyScoredBonusCheatPicks: 0,
    dailyScoredBonusPowerPicks: 0,
    justUnlockedCheatIds: [],
    cheatChoiceLockedUntil: 0,
    activeCheatAwardReason: "",
    activePowerAwardReason: "",
    powerChoiceLockedUntil: 0,
    pauseForCheat: false,
    pendingPowerOptions: [],
    powerChoiceRevealPending: false,
    pendingOpeningCardRevealed: false,
    pendingRunSeed: "",
    pendingRunDeck: [],
    pendingRunMode: "standard",
    pendingDailyDateKey: "",
    pendingDailyVariant: "normal",
    pendingDeckKey: selectedDeckKey,
    pendingLevelNumber: selectedLevelNumber,
    runSeed: chosenSeed,
    restartConfirmArmed: false,
    deckStatsTooltipOpen: false,
    victoryPromptShown: false,
    currentCardFeedback: "",
    currentNudgeAnimation: null,
    gameOverDisplayCards: null,
    cheatChoiceIntroToken: 0,
    powerChoiceIntroToken: 0,
    cheatChoicePreviewIndex: -1,
    cheatChoiceAnimating: null,
    recentlySeenCardId: "",
    nudgeUpCharges: 0,
    nudgeDownCharges: 0,
    nudgeNudgeArmed: false,
    nudgeNudgeStacks: 0,
    fiveAliveNudgeLocked: false,
    bingoCornersAwarded: false,
    bingoLineAwardCount: 0,
    energy: greenRun
      ? (currentLevelNumber >= 4 ? 5 : (currentLevelNumber >= 3 ? 6 : (currentLevelNumber === 2 ? 8 : 10)))
      : 0,
    lastJokerMessage: "",
    rongActive: false,
    lucky7Armed: false,
    fiveAliveArmed: false,
    fiveAliveNudgeLocked: false,
    marginForErrorArmed: false,
    hotOrColdArmed: false,
    stitchInTimeArmed: false,
    sellYourSoulArmed: false,
    higherHigherHigherRemaining: 0,
    psychoRemaining: 0,
    godSaveKingArmed: false,
    lucky13Armed: false,
    alwaysBetBlackArmed: false,
    redDeadRedemptionArmed: false,
    suitsYouSirArmed: false,
    suitsYouSirSuit: "",
    newSuitsRemaining: 0,
    newSuitsSeen: {},
    nineDartRemaining: 0,
    nineDartAutoCorrect: false,
    konamiPatternRemaining: [],
    konamiAutoCorrectRemaining: 0,
    findLadyArmed: false,
    saveScumArmed: false,
    saveScumPendingContinue: false,
    cryogenRemaining: 0,
    cryogenFrozenEnergy: 0,
    lockySevensActive: false,
    oddOneOutArmed: false,
    cursedShieldArmed: false,
    cursedShieldCharges: 0,
    nudgeNudgeArmed: false,
    nudgeNudgeStacks: 0,
    oneLifeLeftLives: 0,
    killerQueenLives: 0,
    suitedAndBootedArmed: false,
    suitedAndBootedSuit: "",
    blankSpaceActive: false,
    blankSpaceValue: null,
    forcedNextGuess: "",
    lockCurrentCardForForcedGuess: false,
    refundArmed: false,
    legendaryCheatOfferArmed: false,
    cheatACheaterRemaining: 0,
    allInRemaining: 0,
    allInNudgeUpStake: 0,
    allInNudgeDownStake: 0,
    equals11Armed: false,
    catch22Armed: false,
    blackjackArmed: false,
    diamondGeezerArmed: false,
    wlStage: "",
  };

  if (!openingDealAlreadyStarted) {
    queueOpeningDealAnimation(deck);
  }

  applyRunPowerSetup(selectedPowerId);
  clearRunDebugLog();
  appendRunDebugLog("run_started", {
    selectedPowerId,
    selectedPowerName: getPowerName(selectedPowerId),
    activePowers,
    dailyDateKey,
    dailyVariant,
  });

  if (runMode === "daily" && !isDevModeRun()) {
    lockDailyAttempt(dailyDateKey, chosenSeed, loadPreferredPlayerName(), dailyVariant);
  }

  if (!isDevModeRun()) {
    recordRunStarted(currentDeckKey, runMode);
  }

  if (runMode !== "daily" && !isDevModeRun()) {
    saveSelectedDeck(currentDeckKey);
    saveSelectedLevel(currentLevelNumber);
    saveLastRunSeed(chosenSeed);
  }
  render();
  if (typeof window.maybeStartFirstRunTutorial === "function") {
    window.maybeStartFirstRunTutorial();
  }
}

function handleRunFinished(finalScore) {
  if (isDevModeRun()) return;
  if (state.runMode !== "daily" && normalizeDeckKey(state.currentDeckKey) === "black") {
    const playerName = typeof loadPreferredHeroName === "function"
      ? loadPreferredHeroName()
      : loadPreferredPlayerName();
    const blackScore = getRunScoreFromCorrectAnswers(finalScore);
    if (typeof submitBlackDeckScore === "function") {
      submitBlackDeckScore(playerName || "Unknown", blackScore, state.runSeed);
    }
    return;
  }
  if (state.runMode !== "daily") return;

  const dateKey = state.dailyDateKey || getCurrentDailyDateKey();
  const dailyVariant = typeof normalizeDailyVariant === "function"
    ? normalizeDailyVariant(state.dailyVariant)
    : "normal";
  const dailyConfig = typeof getDailyVariantConfig === "function"
    ? getDailyVariantConfig(dailyVariant)
    : null;
  const playerName = loadPreferredPlayerName();
  const dailyCardsCleared = getRunScoreFromCorrectAnswers(finalScore);
  const scoredBonusCheatPicks = getDailyScoredBonusCount(state.dailyScoredBonusCheatPicks);
  const scoredBonusPowerPicks = getDailyScoredBonusCount(state.dailyScoredBonusPowerPicks);
  const baseRemainingCheats = Array.isArray(state.cheats)
    ? state.cheats.filter((cheat) => cheat?.id && cheat.id !== "nudge_up" && cheat.id !== "nudge_down").length
    : 0;
  const remainingCheats = baseRemainingCheats + scoredBonusCheatPicks;
  const remainingNudges = Math.max(0, Number(state.nudgeUpCharges) || 0) + Math.max(0, Number(state.nudgeDownCharges) || 0);
  const basePowerCount = typeof getExcludedRunPowerIds === "function"
    ? getExcludedRunPowerIds().length
    : Array.isArray(state.powers)
      ? state.powers.filter((powerId) => powerId && powerId !== "nudge_engine").length
      : 0;
  const powerCount = basePowerCount + scoredBonusPowerPicks;
  const seenCardIds = state.seenCardIds instanceof Set ? state.seenCardIds : new Set();
  const suitCounts = {};
  for (const suit of SUITS) {
    suitCounts[suit] = 0;
  }
  if (Array.isArray(state.deck)) {
    for (const card of state.deck) {
      if (card?.id && card.suit && !isJokerCard(card) && seenCardIds.has(card.id)) {
        suitCounts[card.suit] = Math.min(13, (suitCounts[card.suit] || 0) + 1);
      }
    }
  }
  const tearCount = dailyConfig?.scoreTornCards === false
    ? 0
    : Array.isArray(state.deck)
    ? state.deck.filter((card) =>
      card?.id &&
      !isJokerCard(card) &&
      seenCardIds.has(card.id) &&
      getCardBackStatus(card.id).tornCorner
    ).length
    : 0;
  const dailyBreakdown = typeof buildDailyScoreBreakdown === "function"
    ? buildDailyScoreBreakdown({
      cardsCleared: dailyCardsCleared,
      remainingCheats,
      remainingNudges,
      powerCount,
      tearCount,
    })
    : {
      cardsCleared: dailyCardsCleared,
      cardScore: dailyCardsCleared * 100,
      bonusScore: 0,
      totalScore: dailyCardsCleared,
      remainingCheats,
      remainingNudges,
      powerCount,
      tearCount,
      cheatBonus: 0,
      nudgeBonus: 0,
      powerBonus: 0,
      tearPenalty: 0,
    };
  const entry = buildDailyEntry({
    dateKey,
    variant: dailyVariant,
    seed: state.runSeed,
    playerName: playerName || "Unknown",
    playerId: getOrCreateDailyPlayerId(),
    score: dailyBreakdown.totalScore,
    cardsCleared: dailyBreakdown.cardsCleared,
    cardScore: dailyBreakdown.cardScore,
    bonusScore: dailyBreakdown.bonusScore,
    remainingCheats: dailyBreakdown.remainingCheats,
    remainingNudges: dailyBreakdown.remainingNudges,
    powerCount: dailyBreakdown.powerCount,
    tearCount: dailyBreakdown.tearCount,
    cheatBonus: dailyBreakdown.cheatBonus,
    nudgeBonus: dailyBreakdown.nudgeBonus,
    powerBonus: dailyBreakdown.powerBonus,
    tearPenalty: dailyBreakdown.tearPenalty,
    totalScore: dailyBreakdown.totalScore,
    suitCounts,
  });

  submitDailyResult(entry).finally(() => {
    window.setTimeout(() => {
      const params = new URLSearchParams({ date: dateKey });
      if (dailyVariant !== "normal") {
        params.set("variant", dailyVariant);
      }
      window.location.href = `daily.html?${params.toString()}`;
    }, 900);
  });
}

function startRun(forceRandom = false) {
  openPowerChoice(forceRandom);
}

function pickPowerFromChoice(index) {
  if (Date.now() < (state.powerChoiceLockedUntil || 0)) return;
  if (typeof window.isTutorialBlockingPowerPick === "function" && window.isTutorialBlockingPowerPick()) {
    state.message = "Pick a Power.";
    render();
    return;
  }

  const power = state.pendingPowerOptions[index];
  if (!power) return;

  const isRewardChoice = !!state.activePowerAwardReason;
  if (typeof window.handleTutorialPowerPicked === "function") {
    window.handleTutorialPowerPicked(power, isRewardChoice);
  }

  if (isRewardChoice && !state.gameOver && state.current) {
    const gained = grantPowerToCurrentRun(power.id, state.activePowerAwardReason);
    state.pendingPowerOptions = [];
    state.powerChoiceLockedUntil = 0;
    const rewardReason = state.activePowerAwardReason;
    state.activePowerAwardReason = "";
    setTemporaryMessage(gained ? `${power.name} selected!` : `${power.name} is already active.`);
    if (resolvePendingRewardQueues()) {
      return;
    }
    render();
    return;
  }

  startRunWithPower(power.id);
  state.activePowerAwardReason = "";
  setTemporaryMessage(`${power.name} selected!`);
  render();
}

function updateBestScoreIfNeeded() {
  if (isDevModeRun()) return;
  const runScore = getRunScoreFromCorrectAnswers(state.correctAnswers);
  if (runScore > state.bestScore) {
    state.bestScore = runScore;
    if (state.runMode === "daily") return;
    saveBestScore(state.bestScore, state.currentDeckKey, state.currentLevelNumber);
  }
}

function getRunScoreFromCorrectAnswers(correctAnswers) {
  return Math.max(0, Number(correctAnswers) || 0) + 1;
}

function getDisplayedRunScore() {
  return state.current ? getRunScoreFromCorrectAnswers(state.correctAnswers) : 0;
}

function grantNextDevPower() {
  if (!isDevModeRun()) return false;
  if (!state.current || state.gameOver) {
    state.message = "Dev: start a run before adding a power.";
    render();
    return false;
  }

  const ownedPowerIds = new Set(
    (Array.isArray(state.powers) ? state.powers : [])
      .filter((powerId) => powerId && powerId !== "nudge_engine")
  );
  const nextPower = getUnlockedPowerPool(true).find((power) => power?.id && !ownedPowerIds.has(power.id));

  if (!nextPower) {
    state.message = "Dev: all powers are already active.";
    render();
    return false;
  }

  grantPowerToCurrentRun(nextPower.id, "dev_hotkey");
  state.message = `Dev: added power ${nextPower.name}.`;
  render();
  return true;
}

function winCurrentRunForDev() {
  if (!isDevModeRun()) return false;
  if (!state.current || !Array.isArray(state.deck) || !state.deck.length) {
    state.message = "Dev: start a run before forcing a win.";
    render();
    return false;
  }

  state.index = Math.max(0, state.deck.length - 1);
  state.current = state.deck[state.index] || state.current;
  state.correctAnswers = Math.max(Number(state.correctAnswers) || 0, Math.max(0, state.deck.length - 1));
  state.seenCardIds = new Set(state.deck.map((card) => card?.id).filter(Boolean));
  state.gridCardIds = new Set(state.seenCardIds);
  state.pendingCheatOptions = [];
  state.pendingPowerOptions = [];
  state.pendingCheatAwardQueue = [];
  state.pendingPowerAwardQueue = [];
  state.gameOver = true;
  state.victoryPromptShown = true;
  state.message = "Dev: deck cleared. Records disabled.";
  render();
  triggerVictoryEffect();
  return true;
}

function nearlyCompleteRunForDev() {
  if (!isDevModeRun()) return false;

  if (!Array.isArray(state.deck) || state.deck.length < 2) {
    const selectedDeckKey = normalizeDeckKey(state.selectedDeckKey || loadSelectedDeck());
    const selectedLevelNumber = normalizeLevelNumber(state.selectedLevelNumber || loadSelectedLevel());
    const { chosenSeed, deck } = buildRunFromControls(false, selectedDeckKey, selectedLevelNumber);
    state.deck = deck;
    state.runSeed = chosenSeed;
    state.currentDeckKey = selectedDeckKey;
    state.currentLevelNumber = selectedLevelNumber;
    state.bestScore = loadBestScore(selectedDeckKey, selectedLevelNumber);
  }

  if (!Array.isArray(state.deck) || state.deck.length < 2) {
    state.message = "Dev: no deck available.";
    render();
    return false;
  }

  clearGameOverEffects({ settleExperience: true });
  clearVictoryEffects({ fade: true });

  const targetIndex = Math.max(0, state.deck.length - 2);
  state.index = targetIndex;
  state.current = state.deck[targetIndex] || state.deck[0] || null;
  state.correctAnswers = targetIndex;
  state.seenCardIds = new Set(
    state.deck
      .slice(0, targetIndex + 1)
      .map((card) => card?.id)
      .filter(Boolean)
  );
  state.gridCardIds = new Set(state.seenCardIds);
  state.gameOver = false;
  state.openingPreview = false;
  state.gameOverDisplayCards = null;
  state.gameOverMessageReady = false;
  state.gameOverMessageJustReleased = false;
  state.victoryMessageActive = false;
  state.victoryMessageJustReleased = false;
  state.victoryPromptShown = false;
  state.pendingRevealAnimation = null;
  state.pendingCheatOptions = [];
  state.pendingPowerOptions = [];
  state.pendingCheatAwardQueue = [];
  state.pendingPowerAwardQueue = [];
  state.activeCheatAwardReason = "";
  state.activePowerAwardReason = "";
  state.pauseForCheat = false;
  state.cheatChoiceLockedUntil = 0;
  state.powerChoiceLockedUntil = 0;
  state.currentValueModifier = 0;
  state.nextCardValueModifier = 0;
  state.streak = 0;
  state.currentCardFeedback = "";
  state.currentNudgeAnimation = null;
  state.experienceBanking = null;
  state.pendingExperienceBonuses = [];
  state.message = "Dev: one card remains. Records disabled.";
  state.temporaryMessageText = "";
  state.temporaryMessageUntil = 0;
  render();
  return true;
}

function peekNext() {
  if (!state.deck || state.deck.length === 0) return null;
  return state.deck[state.index + 1] || null;
}

function isRed(card) {
  if (isJokerCard(card)) return false;
  return card && (card.suit === "♥" || card.suit === "♦");
}

function isPictureCard(card) {
  return !!card && (card.rank === "J" || card.rank === "Q" || card.rank === "K");
}

function getBingoCornerCardIds() {
  return [
    getCardId(SUITS[0], "A"),
    getCardId(SUITS[0], "K"),
    getCardId(SUITS[3], "A"),
    getCardId(SUITS[3], "K"),
  ];
}

function getCompletedBingoRowCount() {
  if (!(state.seenCardIds instanceof Set)) return 0;
  return SUITS.reduce((count, suit) => {
    const rowComplete = RANKS.every((rank) => state.seenCardIds.has(getCardId(suit, rank.r)));
    return rowComplete ? count + 1 : count;
  }, 0);
}

function initializeBingoProgressFromCurrentGrid() {
  if (!(state.seenCardIds instanceof Set)) {
    state.seenCardIds = new Set();
  }
  state.bingoCornersAwarded = false;
  state.bingoLineAwardCount = 0;
  maybeAwardBingoMilestones();
}

function maybeAwardBingoMilestones() {
  if (!runHasPower("bingo") || !(state.seenCardIds instanceof Set)) return [];

  const awards = [];
  if (!state.bingoCornersAwarded && getBingoCornerCardIds().every((cardId) => state.seenCardIds.has(cardId))) {
    state.bingoCornersAwarded = true;
    awards.push("four corners");
  }

  const completedRows = Math.min(2, getCompletedBingoRowCount());
  while ((state.bingoLineAwardCount || 0) < completedRows) {
    state.bingoLineAwardCount = (state.bingoLineAwardCount || 0) + 1;
    awards.push(state.bingoLineAwardCount === 1 ? "first row" : "second row");
  }

  if (awards.length > 0) {
    const bonus = awards.length * 5;
    state.nudgeUpCharges = (state.nudgeUpCharges || 0) + bonus;
    state.nudgeDownCharges = (state.nudgeDownCharges || 0) + bonus;
    appendRunDebugLog("bingo_awarded", {
      awards,
      nudgeUpBonus: bonus,
      nudgeDownBonus: bonus,
      seenCount: state.seenCardIds.size,
      completedRows: getCompletedBingoRowCount(),
    });
  }

  return awards;
}

function formatBingoAwardText(awards) {
  if (!Array.isArray(awards) || awards.length === 0) return "";
  const bonus = awards.length * 5;
  return ` Bingo: ${awards.join(" + ")} complete, gained ${bonus} Nudge +1 and ${bonus} Nudge -1.`;
}

function markCardSeen(card, options = {}) {
  if (!card || isJokerCard(card)) return [];
  if (!(state.seenCardIds instanceof Set)) {
    state.seenCardIds = new Set();
  }
  if (!(state.gridCardIds instanceof Set)) {
    state.gridCardIds = new Set(state.seenCardIds);
  }
  const wasSeen = state.seenCardIds.has(card.id);
  state.seenCardIds.add(card.id);
  state.gridCardIds.add(card.id);
  setRecentlySeenCard(card.id);
  return !wasSeen && options.awardBingo ? maybeAwardBingoMilestones() : [];
}

function unmarkCardSeen(card) {
  if (!card || isJokerCard(card)) return;
  state.seenCardIds.delete(card.id);
  if (state.gridCardIds instanceof Set) {
    state.gridCardIds.delete(card.id);
  }
}

function resolveSellYourSoulAfterReveal(wasArmed, naturallySafe) {
  if (!wasArmed) {
    return { savedWrongGuess: false, penaltyText: "", savedText: "" };
  }

  state.sellYourSoulArmed = false;
  if (naturallySafe) {
    const removedCheats = Array.isArray(state.cheats) ? state.cheats.length : 0;
    const removedNudges = (Number(state.nudgeUpCharges) || 0) + (Number(state.nudgeDownCharges) || 0);
    state.cheats = [];
    state.nudgeUpCharges = 0;
    state.nudgeDownCharges = 0;
    return {
      savedWrongGuess: false,
      penaltyText: ` Sell Your Soul collected: lost ${removedCheats} held Cheat${removedCheats === 1 ? "" : "s"} and ${removedNudges} Nudge${removedNudges === 1 ? "" : "s"}.`,
      savedText: "",
    };
  }

  return {
    savedWrongGuess: true,
    penaltyText: "",
    savedText: " Sell Your Soul saved the wrong guess.",
  };
}

function getCurrentDeckTargetCount() {
  return Array.isArray(state.deck) && state.deck.length > 0 ? state.deck.length : 52;
}

function completeRunAfterDeckExhausted(reason = "deck_exhausted") {
  if (!state.current || state.gameOver) return false;
  state.correctAnswers = Math.max(Number(state.correctAnswers) || 0, Math.max(0, getCurrentDeckTargetCount() - 1));
  updateBestScoreIfNeeded();
  appendRunDebugLog("guess_resolved", {
    outcome: "deck_cleared",
    reason,
    cardsCleared: getDisplayedRunScore(),
    deckSize: getCurrentDeckTargetCount(),
    message: "Reduced deck cleared.",
  });
  if (!isDevModeRun()) {
    if (state.runMode !== "daily") {
      state.deckWins = recordDeckWin(state.currentDeckKey);
      state.deckLevelClears = recordDeckLevelClear(state.currentDeckKey, state.currentLevelNumber);
      recordDeckClearProgress(state.currentDeckKey);
    } else {
      recordDailyClearProgress();
    }
  }
  state.message = "YOU CLEARED THE DECK!";
  state.gameOver = true;
  triggerVictoryEffect();
  handleRunFinished(state.correctAnswers);
  return true;
}

function advanceToCard(card, options = {}) {
  state.current = card;
  state.index += 1;
  clearTemporaryCardValue(card);
  state.cheatUsesOnCurrentCard = 0;
  resetCurrentTurnNudgeTracking();
  return markCardSeen(card, options);
}

function resetCurrentTurnNudgeTracking() {
  state.currentNudgeUpUsed = 0;
  state.currentNudgeDownUsed = 0;
  state.currentNudgeValueModifier = 0;
  state.currentNudgeLogFlushed = false;
}

function removeCheatAt(index) {
  state.cheats.splice(index, 1);
}

function describeCard(card) {
  if (!card) return "?";
  if (isJokerCard(card)) return getJokerName(card);
  return `${card.rank}${card.suit}`;
}

function formatCurrentJudgedValueForMessage(card, effectiveValue) {
  const judgedRank = valueToRank(effectiveValue);
  if (!card) return `'${judgedRank}'`;
  return effectiveValue !== card.value ? `'${judgedRank}'` : `${judgedRank}`;
}

function formatNextValueForMessage(card, effectiveValue = card?.value) {
  if (!card) return "?";
  const judgedRank = valueToRank(effectiveValue);
  return effectiveValue !== card.value ? `'${judgedRank}'` : `${judgedRank}`;
}

function buildComparisonSnippet(currentCard, effectiveValue, nextCard, nextEffectiveValue = nextCard?.value) {
  if (!currentCard || !nextCard) return "";
  if (isJokerCard(nextCard)) return getJokerName(nextCard);
  if (nextEffectiveValue === effectiveValue) {
    return `${formatNextValueForMessage(nextCard, nextEffectiveValue)} equals ${formatCurrentJudgedValueForMessage(currentCard, effectiveValue)}`;
  }
  const relation = nextEffectiveValue > effectiveValue ? "higher" : "lower";
  return `${formatNextValueForMessage(nextCard, nextEffectiveValue)} is ${relation} than ${formatCurrentJudgedValueForMessage(currentCard, effectiveValue)}`;
}

function formatCurrentCardForLossMessage(card, effectiveValue) {
  if (!card) return "?";
  if (effectiveValue !== card.value) {
    return `${describeCard(card)} (treated as ${valueToRank(effectiveValue)})`;
  }
  return describeCard(card);
}

function formatNextCardForLossMessage(card, effectiveValue = card?.value) {
  if (!card) return "?";
  if (effectiveValue !== card.value) {
    return `${describeCard(card)} (treated as ${valueToRank(effectiveValue)})`;
  }
  return describeCard(card);
}

function buildWrongGuessMessage(type, currentCard, currentEffectiveValue, nextCard, nextEffectiveValue, prefix = "") {
  const currentLabel = formatCurrentCardForLossMessage(currentCard, currentEffectiveValue);
  const nextLabel = formatNextCardForLossMessage(nextCard, nextEffectiveValue);

  if (type === "higher") {
    return `${prefix}${nextLabel} was lower than ${currentLabel}.`;
  }

  return `${prefix}${nextLabel} was higher than ${currentLabel}.`;
}

function flushCurrentNudgeLogEntry() {
  if (state.currentNudgeLogFlushed) return;
  const upUsed = Math.max(0, Number(state.currentNudgeUpUsed) || 0);
  const downUsed = Math.max(0, Number(state.currentNudgeDownUsed) || 0);
  const parts = [];
  if (upUsed > 0) parts.push(`+${upUsed}`);
  if (downUsed > 0) parts.push(`-${downUsed}`);
  if (!parts.length) return;
  state.currentNudgeLogFlushed = true;
  if (typeof addPlayerLogEntry === "function") {
    addPlayerLogEntry(`Player used ${parts.join(" and ")} nudge charge${upUsed + downUsed === 1 ? "" : "s"}.`, {
      summary: "Nudges used",
    });
  }
}

function getEffectiveValueForModifier(card, modifier = 0) {
  if (!card) return null;
  if (isJokerCard(card)) return null;

  const baseValue = Number.isFinite(getTemporaryCardValue(card))
    ? getTemporaryCardValue(card)
    : card.value;

  if (runHasPower("aces_wild")) {
    const zeroIndexed = baseValue - 1;
    const wrapped = ((zeroIndexed + modifier) % 13 + 13) % 13;
    return wrapped + 1;
  }

  return clamp(baseValue + modifier, 1, 13);
}

function getCurrentEffectiveValue() {
  if (!state.current) return null;
  return getEffectiveValueForModifier(state.current, state.currentValueModifier || 0);
}

function getTemporaryCardValue(card) {
  if (!card || isJokerCard(card)) return null;
  const value = state.temporaryCardValues?.[card.id];
  return Number.isFinite(value) ? value : null;
}

function clearTemporaryCardValue(card) {
  if (!card?.id || !state.temporaryCardValues || typeof state.temporaryCardValues !== "object") return;
  delete state.temporaryCardValues[card.id];
}

function setTemporaryCardValue(card, value) {
  if (!card || isJokerCard(card) || !Number.isFinite(value)) return false;
  if (!state.temporaryCardValues || typeof state.temporaryCardValues !== "object") {
    state.temporaryCardValues = {};
  }
  state.temporaryCardValues[card.id] = clampCardValue(value);
  return true;
}

function wouldGuessBeCorrect(type, currentValue, nextValue) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(nextValue)) return false;
  if (nextValue === currentValue) return true;
  if (type === "higher") return nextValue > currentValue;
  if (type === "lower") return nextValue < currentValue;
  return false;
}

function getRefundNudgeResult(refundWasArmed, type, nextComparisonValue) {
  const nudgeUpUsed = Math.max(0, Number(state.currentNudgeUpUsed) || 0);
  const nudgeDownUsed = Math.max(0, Number(state.currentNudgeDownUsed) || 0);
  const nudgeModifier = Number(state.currentNudgeValueModifier) || 0;
  const total = nudgeUpUsed + nudgeDownUsed;
  if (!refundWasArmed || !state.current || !total) return null;

  const withoutNudgeModifier = (state.currentValueModifier || 0) - nudgeModifier;
  const withoutNudgeValue = getEffectiveValueForModifier(state.current, withoutNudgeModifier);
  if (!wouldGuessBeCorrect(type, withoutNudgeValue, nextComparisonValue)) return null;

  return { nudgeUpUsed, nudgeDownUsed, total };
}

function applyRefundNudgeResult(refundResult) {
  if (!refundResult) return "";
  if (refundResult.nudgeUpUsed > 0) {
    state.nudgeUpCharges = (state.nudgeUpCharges || 0) + refundResult.nudgeUpUsed;
  }
  if (refundResult.nudgeDownUsed > 0) {
    state.nudgeDownCharges = (state.nudgeDownCharges || 0) + refundResult.nudgeDownUsed;
  }
  return ` Refund returned ${refundResult.total} unnecessary Nudge${refundResult.total === 1 ? "" : "s"}.`;
}

function resolveSuitsYouSirOnReveal(suitsYouSirWasArmed, armedSuit, revealedCard) {
  if (!suitsYouSirWasArmed || !armedSuit || !revealedCard) return "";
  if (isJokerCard(revealedCard) || !revealedCard.suit || revealedCard.suit !== armedSuit) return " Suits You, Sir missed.";
  state.nudgeUpCharges = (state.nudgeUpCharges || 0) + 5;
  state.nudgeDownCharges = (state.nudgeDownCharges || 0) + 5;
  return " Suits You, Sir matched: +5 Nudge Up and +5 Nudge Down.";
}

function resolveLucky13OnReveal(lucky13WasArmed, revealedCard) {
  if (!lucky13WasArmed || !revealedCard) return "";
  if (isJokerCard(revealedCard) || getNextComparisonValueForGuess(revealedCard) !== 13) return " Lucky 13 missed.";
  state.nudgeUpCharges = (state.nudgeUpCharges || 0) + 5;
  state.nudgeDownCharges = (state.nudgeDownCharges || 0) + 5;
  return " Lucky 13 hit: +5 Nudge Up and +5 Nudge Down.";
}

function resolveNewSuitsOnReveal(revealedCard) {
  if ((Number(state.newSuitsRemaining) || 0) <= 0) return { text: "", completed: false, awardCount: 0 };
  if (!state.newSuitsSeen || typeof state.newSuitsSeen !== "object") {
    state.newSuitsSeen = {};
  }

  state.newSuitsRemaining = Math.max(0, (Number(state.newSuitsRemaining) || 0) - 1);
  if (revealedCard && !isJokerCard(revealedCard) && revealedCard.suit) {
    state.newSuitsSeen[revealedCard.suit] = true;
  }

  const suitsSeen = SUITS.filter((suit) => !!state.newSuitsSeen[suit]);
  if (state.newSuitsRemaining > 0) {
    return {
      text: ` New Suits: ${suitsSeen.length}/4 suits found, ${state.newSuitsRemaining} reveal${state.newSuitsRemaining === 1 ? "" : "s"} left.`,
      completed: false,
      awardCount: 0,
    };
  }

  const awardCount = suitsSeen.length;
  state.newSuitsSeen = {};

  return {
    text: awardCount > 0
      ? ` New Suits complete: ${awardCount} suit${awardCount === 1 ? "" : "s"} found, ${awardCount} bonus Cheat${awardCount === 1 ? "" : "s"} queued.`
      : " New Suits complete: no suited cards found.",
    completed: true,
    awardCount,
  };
}

function queueNewSuitsAwards(newSuitsResult) {
  const awardCount = Math.max(0, Number(newSuitsResult?.awardCount) || 0);
  for (let index = 0; index < awardCount; index += 1) {
    queueCheatAward("new_suits");
  }
}

function clearAllInStake() {
  state.allInRemaining = 0;
  state.allInNudgeUpStake = 0;
  state.allInNudgeDownStake = 0;
}

function resolveAllInOnReveal(guessWasCorrect) {
  if ((Number(state.allInRemaining) || 0) <= 0) return "";
  if (!guessWasCorrect) {
    clearAllInStake();
    return " All In failed.";
  }

  state.allInRemaining = Math.max(0, (Number(state.allInRemaining) || 0) - 1);
  if (state.allInRemaining > 0) {
    return ` All In: ${state.allInRemaining} correct ${state.allInRemaining === 1 ? "guess" : "guesses"} left.`;
  }

  const upReward = Math.max(0, Number(state.allInNudgeUpStake) || 0) * 2;
  const downReward = Math.max(0, Number(state.allInNudgeDownStake) || 0) * 2;
  state.nudgeUpCharges = (state.nudgeUpCharges || 0) + upReward;
  state.nudgeDownCharges = (state.nudgeDownCharges || 0) + downReward;
  clearAllInStake();
  return ` All In paid out: +${upReward} Nudge Up and +${downReward} Nudge Down.`;
}

function clearNineDartFinish() {
  state.nineDartRemaining = 0;
  state.nineDartAutoCorrect = false;
}

function resolveNineDartOnReveal(guessWasNaturallyCorrect) {
  const remainingBefore = Math.max(0, Number(state.nineDartRemaining) || 0);
  if (remainingBefore <= 0) return "";
  if (!guessWasNaturallyCorrect) {
    clearNineDartFinish();
    return " 9 Dart Finish failed.";
  }

  state.nineDartRemaining = Math.max(0, remainingBefore - 1);
  if (state.nineDartRemaining > 0) {
    return ` 9 Dart Finish: ${state.nineDartRemaining} correct ${state.nineDartRemaining === 1 ? "guess" : "guesses"} left.`;
  }

  state.nineDartAutoCorrect = true;
  return " 9 Dart Finish complete: the rest of the deck is safe.";
}

function resolveKonamiOnReveal(guessType) {
  const pattern = Array.isArray(state.konamiPatternRemaining)
    ? [...state.konamiPatternRemaining]
    : [];
  if (pattern.length <= 0) return "";
  const expected = pattern[0];
  if (guessType !== expected) {
    state.konamiPatternRemaining = [];
    return " Konami Code failed.";
  }

  pattern.shift();
  state.konamiPatternRemaining = pattern;
  if (pattern.length > 0) {
    return ` Konami Code: ${pattern.length} input${pattern.length === 1 ? "" : "s"} left.`;
  }

  state.konamiAutoCorrectRemaining = 4;
  return " Konami Code complete: next 4 guesses are safe.";
}

function resolveKonamiAutoCorrectOnReveal(wasActive) {
  if (!wasActive) return "";
  state.konamiAutoCorrectRemaining = Math.max(0, (Number(state.konamiAutoCorrectRemaining) || 0) - 1);
  return ` Konami safety used: ${state.konamiAutoCorrectRemaining} left.`;
}

function resolveCryogenAfterReveal() {
  const remainingBefore = Math.max(0, Number(state.cryogenRemaining) || 0);
  if (remainingBefore <= 0) return "";
  const frozenEnergy = Math.max(0, Number(state.cryogenFrozenEnergy) || 0);
  state.energy = frozenEnergy;
  state.cryogenRemaining = Math.max(0, remainingBefore - 1);
  if (state.cryogenRemaining > 0) {
    return ` Cryogen: Energy frozen at ${frozenEnergy} for ${state.cryogenRemaining} more turn${state.cryogenRemaining === 1 ? "" : "s"}.`;
  }
  state.cryogenFrozenEnergy = 0;
  return ` Cryogen thawed: Energy held at ${frozenEnergy}.`;
}

function continueSaveScumRun() {
  if (!state.saveScumPendingContinue) return false;
  state.gameOver = false;
  state.saveScumPendingContinue = false;
  state.saveScumArmed = false;
  state.pendingRevealAnimation = null;
  state.gameOverDisplayCards = null;
  state.gameOverMessageReady = false;
  state.gameOverMessageJustReleased = false;
  state.restartConfirmArmed = false;
  state.message = "Save Scum continued the run.";
  render();
  return true;
}

function isEnergyDeckRun() {
  return isEnergyDeckKey(state.currentDeckKey || state.selectedDeckKey || "blue");
}

function isGreenDeckRun() {
  return isEnergyDeckRun();
}

function adjustValueForLockySevens(currentValue, targetValue) {
  if (!state.lockySevensActive) return targetValue;
  if (!Number.isFinite(currentValue) || !Number.isFinite(targetValue)) return targetValue;
  if (currentValue === 7) return 7;
  if ((currentValue < 7 && targetValue >= 7) || (currentValue > 7 && targetValue <= 7)) {
    return 7;
  }
  return targetValue;
}

function getAdjustedCurrentNudgeTarget(modifierDelta) {
  const currentValue = getCurrentEffectiveValue();
  if (!Number.isFinite(currentValue)) return null;
  const targetValue = getEffectiveValueForModifier(state.current, (state.currentValueModifier || 0) + modifierDelta);
  return adjustValueForLockySevens(currentValue, targetValue);
}

function getAdjustedNextNudgeTarget(baseDelta) {
  const next = peekNext();
  if (!next) return null;
  const currentValue = getUpcomingCheatValue(1);
  if (!Number.isFinite(currentValue)) return null;
  const targetValue = clampCardValue(currentValue + baseDelta);
  return adjustValueForLockySevens(currentValue, targetValue);
}

function rollErraticNudgeAmount() {
  return Math.floor(Math.random() * 4);
}

function getActiveNudgeDelta(baseDelta, options = {}) {
  const direction = baseDelta < 0 ? -1 : 1;
  const baseAmount = runHasPower("erratic")
    ? Math.max(0, Math.min(3, Math.floor(Number(options.erraticAmount) || 0)))
    : Math.abs(baseDelta);
  const powerMultiplier = runHasPower("double_bubble") ? 2 : 1;
  const nudgeNudgeStacks = Math.max(0, Math.floor(Number(state.nudgeNudgeStacks) || 0));
  const legacyCheatStacks = nudgeNudgeStacks > 0 ? nudgeNudgeStacks : (state.nudgeNudgeArmed ? 1 : 0);
  const cheatMultiplier = 2 ** legacyCheatStacks;
  return direction * baseAmount * powerMultiplier * cheatMultiplier;
}

function getPotentialNudgeDelta(baseDelta) {
  return getActiveNudgeDelta(baseDelta, {
    erraticAmount: runHasPower("erratic") ? 3 : Math.abs(baseDelta),
  });
}

function isAceWildAutoCorrect(currentComparisonValue, nextCard) {
  if (!runHasPower("aces_wild")) return false;
  return currentComparisonValue === 1 || getNextComparisonValueForGuess(nextCard) === 1;
}

function valueToRank(value) {
  const found = RANKS.find((r) => r.v === value);
  return found ? found.r : value;
}

function countUnseenCardsOfRank(rank) {
  if (!rank) return 0;

  let count = 0;
  for (let i = state.index + 1; i < state.deck.length; i += 1) {
    if (!isJokerCard(state.deck[i]) && state.deck[i].rank === rank) count += 1;
  }
  return count;
}

function canUseNudge(direction) {
  const blankSpaceActive = !!state.blankSpaceActive && !!peekNext();
  const isBlocked =
    state.gameOver ||
    !state.current ||
    state.pendingCheatOptions.length > 0 ||
    state.pendingPowerOptions.length > 0 ||
    (state.psychoRemaining || 0) > 0 ||
    (state.nineDartRemaining || 0) > 0 ||
    !!state.sixSevenArmed ||
    !!state.fiveAliveNudgeLocked ||
    !!state.pauseForCheat;
  if (isBlocked) return false;
  if (!blankSpaceActive && !!state.lockCurrentCardForForcedGuess) return false;
  if (!blankSpaceActive && isGreenDeckRun() && (state.energy || 0) <= 0) return false;

  if (direction === "up") {
    if (blankSpaceActive) {
      const nextValue = getAdjustedNextNudgeTarget(getPotentialNudgeDelta(1));
      return nextValue !== getUpcomingCheatValue(1);
    }
    if ((state.nudgeUpCharges || 0) <= 0) return false;
    const nextValue = getAdjustedCurrentNudgeTarget(getPotentialNudgeDelta(1));
    return nextValue !== getCurrentEffectiveValue();
  }
  if (direction === "down") {
    if (blankSpaceActive) {
      const nextValue = getAdjustedNextNudgeTarget(getPotentialNudgeDelta(-1));
      return nextValue !== getUpcomingCheatValue(1);
    }
    if ((state.nudgeDownCharges || 0) <= 0) return false;
    const nextValue = getAdjustedCurrentNudgeTarget(getPotentialNudgeDelta(-1));
    return nextValue !== getCurrentEffectiveValue();
  }
  return false;
}

function useNudgeCharge(direction) {
  const blankSpaceActive = !!state.blankSpaceActive && !!peekNext();
  if ((state.psychoRemaining || 0) > 0) {
    state.message = `Psycho is active - no Cheats or Nudges for ${state.psychoRemaining} more turn${state.psychoRemaining === 1 ? "" : "s"}.`;
    render();
    return;
  }
  if ((state.nineDartRemaining || 0) > 0) {
    state.message = `9 Dart Finish is active - no Cheats or Nudges for ${state.nineDartRemaining} more card${state.nineDartRemaining === 1 ? "" : "s"}.`;
    render();
    return;
  }
  if (
    state.gameOver ||
    !state.current ||
    state.pendingCheatOptions.length > 0 ||
    state.pendingPowerOptions.length > 0 ||
    (state.psychoRemaining || 0) > 0 ||
    (state.nineDartRemaining || 0) > 0 ||
    (!blankSpaceActive && !!state.lockCurrentCardForForcedGuess) ||
    !!state.pauseForCheat
  ) {
    return;
  }

  if (!blankSpaceActive && isGreenDeckRun() && (state.energy || 0) <= 0) {
    state.message = "No energy left - nudges are disabled.";
    render();
    return;
  }

  if (!blankSpaceActive && state.fiveAliveNudgeLocked) {
    state.message = "Five Alive has locked this 5 - it cannot be nudged.";
    render();
    return;
  }

  if (direction === "up") {
    if (!blankSpaceActive && (state.nudgeUpCharges || 0) <= 0) return;
    if (!canUseNudge("up")) {
      const blankCurrentValue = getUpcomingCheatValue(1);
      state.message = blankSpaceActive
        ? state.lockySevensActive && blankCurrentValue === 7
          ? "Locky 7s active - blank cards lock at 7."
          : "Blank Space is already at King."
        : state.lockCurrentCardForForcedGuess
          ? "Card value is locked until your next forced guess."
          : state.lockySevensActive && getCurrentEffectiveValue() === 7
            ? "Locky 7s active - 7s cannot be nudged."
            : "Cannot use Nudge +1 on a King.";
      render();
      return;
    }
  }

  if (direction === "down") {
    if (!blankSpaceActive && (state.nudgeDownCharges || 0) <= 0) return;
    if (!canUseNudge("down")) {
      const blankCurrentValue = getUpcomingCheatValue(1);
      state.message = blankSpaceActive
        ? state.lockySevensActive && blankCurrentValue === 7
          ? "Locky 7s active - blank cards lock at 7."
          : "Blank Space is already at Ace."
        : state.lockCurrentCardForForcedGuess
          ? "Card value is locked until your next forced guess."
          : state.lockySevensActive && getCurrentEffectiveValue() === 7
            ? "Locky 7s active - 7s cannot be nudged."
            : "Cannot use Nudge -1 on an Ace.";
      render();
      return;
    }
  }

  const erraticActive = runHasPower("erratic");
  const erraticAmount = erraticActive ? rollErraticNudgeAmount() : 1;
  const appliedDelta = direction === "up"
    ? getActiveNudgeDelta(1, { erraticAmount })
    : getActiveNudgeDelta(-1, { erraticAmount });
  const currentValue = blankSpaceActive
    ? getUpcomingCheatValue(1)
    : getCurrentEffectiveValue();
  const targetValue = direction === "up"
    ? (blankSpaceActive ? getAdjustedNextNudgeTarget(appliedDelta) : getAdjustedCurrentNudgeTarget(appliedDelta))
    : (blankSpaceActive ? getAdjustedNextNudgeTarget(appliedDelta) : getAdjustedCurrentNudgeTarget(appliedDelta));
  if (!Number.isFinite(currentValue) || !Number.isFinite(targetValue)) {
    return;
  }

  if (blankSpaceActive) {
    const blankBaseValue = Number.isFinite(state.blankSpaceValue)
      ? state.blankSpaceValue
      : getCurrentEffectiveValue();
    state.blankSpaceValue = clampCardValue(blankBaseValue + (targetValue - currentValue));
  } else {
    if (direction === "up") {
      state.nudgeUpCharges = Math.max(0, (state.nudgeUpCharges || 0) - 1);
      const nudgeDelta = targetValue - currentValue;
      state.currentValueModifier += nudgeDelta;
      state.currentNudgeUpUsed = (state.currentNudgeUpUsed || 0) + 1;
      state.currentNudgeValueModifier = (state.currentNudgeValueModifier || 0) + nudgeDelta;
    } else if (direction === "down") {
      state.nudgeDownCharges = Math.max(0, (state.nudgeDownCharges || 0) - 1);
      const nudgeDelta = targetValue - currentValue;
      state.currentValueModifier += nudgeDelta;
      state.currentNudgeDownUsed = (state.currentNudgeDownUsed || 0) + 1;
      state.currentNudgeValueModifier = (state.currentNudgeValueModifier || 0) + nudgeDelta;
    } else {
      return;
    }
  }

  if (!blankSpaceActive) {
    recordCurrentCardNudge(state.current, direction);
    setCurrentCardNudgeAnimation(direction, currentValue, targetValue);
  }
  if (!blankSpaceActive && isGreenDeckRun() && (state.cryogenRemaining || 0) <= 0) {
    state.energy = Math.max(0, (state.energy || 0) - 1);
  }
  const effective = blankSpaceActive ? getUpcomingCheatValue(1) : getCurrentEffectiveValue();
  const label = blankSpaceActive
    ? `Blank Space ${direction === "up" ? "up" : "down"}`
    : (direction === "up" ? `Nudge +${Math.abs(appliedDelta)}` : `Nudge -${Math.abs(appliedDelta)}`);
  state.message = erraticActive
    ? label
    : blankSpaceActive
      ? `Blank Space adjusted. Next card is now treated as ${valueToRank(effective)}.`
      : isGreenDeckRun()
        && (state.cryogenRemaining || 0) > 0
          ? `${label} used. Current card treated as ${valueToRank(effective)}. Energy frozen at ${state.energy || 0}.`
          : isGreenDeckRun()
        ? `${label} used. Current card treated as ${valueToRank(effective)}. Energy left: ${state.energy || 0}.`
        : `${label} used. Current card treated as ${valueToRank(effective)}.`;
  appendRunDebugLog("nudge_used", {
    direction,
    label,
    erraticAmount: erraticActive ? erraticAmount : null,
    appliedDelta,
    blankSpaceActive,
    resultingEffectiveValue: effective,
    nudgeUpCharges: state.nudgeUpCharges || 0,
    nudgeDownCharges: state.nudgeDownCharges || 0,
    message: state.message,
  });
  render();
}

function getCardStatsEntry(cardId) {
  if (!state.cardStats[cardId]) {
    state.cardStats[cardId] = normalizeCardStatsEntry();
  } else {
    state.cardStats[cardId] = normalizeCardStatsEntry(state.cardStats[cardId]);
  }
  return state.cardStats[cardId];
}

function getGuessContextKey() {
  if (state.currentValueModifier > 0) return "nudgedUp";
  if (state.currentValueModifier < 0) return "nudgedDown";
  return "base";
}

function recordCurrentCardGuess(card, guessType, wasCorrectGuess) {
  if (isDevModeRun()) return;
  if (!card || isJokerCard(card)) return;
  const entry = getCardStatsEntry(card.id);
  const guessBucket = entry.guessStats[getGuessContextKey()];
  entry.attempts += 1;
  if (normalizeDeckKey(state.currentDeckKey) === "blue") {
    entry.nudgeStats.blueFaceUpUses += 1;
    if ((state.currentValueModifier || 0) !== 0) {
      entry.nudgeStats.blueNudgedUses += 1;
    }
    if (!wasCorrectGuess) {
      entry.nudgeStats.blueFaceUpEnded += 1;
    }
  }
  if (wasCorrectGuess) entry.correct += 1;
  if (guessType === "higher" || guessType === "lower") {
    guessBucket[guessType] += 1;
  }
  saveCardStats(state.cardStats);
}

function recordCurrentCardNudge(card, direction) {
  if (isDevModeRun()) return;
  if (!card || isJokerCard(card)) return;
  if (normalizeDeckKey(state.currentDeckKey) !== "blue") return;
  const entry = getCardStatsEntry(card.id);
  if (!entry.nudgeStats) {
    entry.nudgeStats = {
      up: 0,
      down: 0,
      blueFaceUpUses: 0,
      blueNudgedUses: 0,
      blueFaceUpEnded: 0,
      totalUpAmount: 0,
      totalDownAmount: 0,
    };
  }
  if (direction === "up") {
    entry.nudgeStats.up += 1;
    entry.nudgeStats.totalUpAmount += 1;
  }
  if (direction === "down") {
    entry.nudgeStats.down += 1;
    entry.nudgeStats.totalDownAmount += 1;
  }
  saveCardStats(state.cardStats);
}

function addMetaProgression(amount = 1) {
  state.metaProgression = (state.metaProgression ?? 0) + amount;
  if (isDevModeRun()) return;
  saveMetaProgression(state.metaProgression);
}

function recordFaceDownOutcome(card, endedRun, currentWasBase = true) {
  if (isDevModeRun()) return;
  if (!card || isJokerCard(card)) return;
  const entry = getCardStatsEntry(card.id);
  if (endedRun) {
    entry.endedRun += 1;
    if (currentWasBase) {
      entry.endedRunFaceUpBase += 1;
    }
  } else {
    entry.survivedRun += 1;
  }
  saveCardStats(state.cardStats);
}

function getCardCorrectPercentage(card) {
  if (!card) return null;
  const entry = state.cardStats[card.id];
  if (!entry || entry.attempts === 0) return null;
  return Math.round((entry.correct / entry.attempts) * 100);
}

function getCardBackStatus(cardId) {
  const status = state.cardBackStatuses[cardId] || {
    tornCorner: false,
    backColor: "blue",
  };
  const activeDailyVariant = state.runMode === "daily"
    ? state.dailyVariant
    : state.pendingRunMode === "daily"
      ? state.pendingDailyVariant
      : "normal";
  const shouldHideTornCards =
    (state.runMode === "daily" || state.pendingRunMode === "daily") &&
    typeof getDailyVariantConfig === "function" &&
    getDailyVariantConfig(activeDailyVariant)?.hideTornCards === true;
  if (shouldHideTornCards) {
    return { ...status, tornCorner: false };
  }
  return state.temporaryCardBackRepairs?.[cardId]
    ? { ...status, tornCorner: false }
    : status;
}

function setCardBackStatus(cardId, patch) {
  const current = state.cardBackStatuses[cardId] || {
    tornCorner: false,
    backColor: "blue",
  };
  state.cardBackStatuses[cardId] = { ...current, ...patch };
  if (state.temporaryCardBackRepairs?.[cardId]) {
    delete state.temporaryCardBackRepairs[cardId];
  }
  if (isDevModeRun()) return;
  saveCardBackStatuses(state.cardBackStatuses);
}

function getFaceDownCount() {
  return Math.max(0, state.deck.length - (state.index + 1));
}

function getRemainingJokerCount() {
  if (!Array.isArray(state.deck)) return 0;
  let count = 0;
  for (let i = (Number(state.index) || 0) + 1; i < state.deck.length; i += 1) {
    if (isJokerCard(state.deck[i])) count += 1;
  }
  return count;
}

function getTotalTornCardCount() {
  return Object.values(state.cardBackStatuses || {})
    .filter((status) => !!status?.tornCorner)
    .length;
}

function applyTearlessJoker() {
  const totalTorn = getTotalTornCardCount();
  const unseenTornCards = Array.isArray(state.deck)
    ? state.deck
        .slice((Number(state.index) || 0) + 1)
        .filter((card) => !isJokerCard(card) && getCardBackStatus(card.id).tornCorner)
    : [];

  if (!unseenTornCards.length) {
    return "A Yellow Joker searched for torn cards, but none were still hidden in this run.";
  }

  const unseenTornCard = unseenTornCards[Math.floor(Math.random() * unseenTornCards.length)];
  if (!state.temporaryCardBackRepairs || typeof state.temporaryCardBackRepairs !== "object") {
    state.temporaryCardBackRepairs = {};
  }
  state.temporaryCardBackRepairs[unseenTornCard.id] = true;
  return `A Yellow Joker hid one unseen tear for this run. Persistent torn corners remain: ${totalTorn}.`;
}

function applyTimelessJoker() {
  if (!Array.isArray(state.deck) || !(state.seenCardIds instanceof Set)) {
    return "Timeless found no revealed cards to rewind.";
  }

  const currentIndex = Math.max(0, Number(state.index) || 0);
  const revealedPlayingCards = state.deck
    .slice(0, currentIndex)
    .filter((card) => card && !isJokerCard(card));
  const cardsToReturn = revealedPlayingCards.slice(-10);

  if (!cardsToReturn.length) {
    return "Timeless found no revealed playing cards to rewind.";
  }

  const returnIds = new Set(cardsToReturn.map((card) => card.id));
  const nextDeck = state.deck.filter((card, index) => index >= currentIndex || !returnIds.has(card?.id));
  state.deck = nextDeck;
  const newCurrentIndex = state.deck.findIndex((card) => card?.id === state.current?.id);
  state.index = newCurrentIndex >= 0
    ? newCurrentIndex
    : Math.min(currentIndex, Math.max(0, state.deck.length - 1));
  state.current = state.deck[state.index] || state.current;

  cardsToReturn.forEach((card) => {
    state.seenCardIds.delete(card.id);
    if (state.gridCardIds instanceof Set) {
      state.gridCardIds.delete(card.id);
    }
  });
  if (returnIds.has(state.recentlySeenCardId)) {
    state.recentlySeenCardId = "";
  }

  const rng = getJokerEffectRng("timeless");
  const shuffledCards = [...cardsToReturn];
  for (let i = shuffledCards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledCards[i], shuffledCards[j]] = [shuffledCards[j], shuffledCards[i]];
  }
  shuffledCards.forEach((card) => {
    const faceDownCount = Math.max(1, state.deck.length - state.index);
    const insertAt = state.index + 1 + Math.floor(rng() * faceDownCount);
    state.deck.splice(insertAt, 0, card);
  });

  appendRunDebugLog("yellow_joker_timeless_rewind", {
    returnedCount: cardsToReturn.length,
    returnedCards: cardsToReturn.map(describeCardForDebug),
    seenCountAfter: state.seenCardIds.size,
  });

  return `Timeless shuffled ${cardsToReturn.length} revealed playing ${cardsToReturn.length === 1 ? "card" : "cards"} back into the deck.`;
}

function applyGridlessJoker() {
  const visibleCount = state.gridCardIds instanceof Set
    ? state.gridCardIds.size
    : state.seenCardIds instanceof Set
      ? state.seenCardIds.size
      : 0;
  state.gridCardIds = new Set();
  return visibleCount > 0
    ? `Gridless wiped ${visibleCount} card${visibleCount === 1 ? "" : "s"} from the visible grid.`
    : "Gridless found no visible grid cards to wipe.";
}

function clearArmedPowerEffects() {
  state.lucky7Armed = false;
  state.fiveAliveArmed = false;
  state.fiveAliveNudgeLocked = false;
  state.marginForErrorArmed = false;
  state.hotOrColdArmed = false;
  state.stitchInTimeArmed = false;
  state.sellYourSoulArmed = false;
  state.higherHigherHigherRemaining = 0;
  state.godSaveKingArmed = false;
  state.lucky13Armed = false;
  state.alwaysBetBlackArmed = false;
  state.redDeadRedemptionArmed = false;
  state.suitsYouSirArmed = false;
  state.suitsYouSirSuit = "";
  state.newSuitsRemaining = 0;
  state.newSuitsSeen = {};
  state.nineDartRemaining = 0;
  state.nineDartAutoCorrect = false;
  state.konamiPatternRemaining = [];
  state.konamiAutoCorrectRemaining = 0;
  state.findLadyArmed = false;
  state.saveScumArmed = false;
  state.saveScumPendingContinue = false;
  state.cryogenRemaining = 0;
  state.cryogenFrozenEnergy = 0;
  state.lockySevensActive = false;
  state.oddOneOutArmed = false;
  state.cursedShieldArmed = false;
  state.cursedShieldCharges = 0;
  state.nudgeNudgeArmed = false;
  state.nudgeNudgeStacks = 0;
  state.oneLifeLeftLives = 0;
  state.killerQueenLives = 0;
  state.suitedAndBootedArmed = false;
  state.suitedAndBootedSuit = "";
  state.forcedNextGuess = "";
  state.lockCurrentCardForForcedGuess = false;
  state.cheatACheaterRemaining = 0;
  state.allInRemaining = 0;
  state.allInNudgeUpStake = 0;
  state.allInNudgeDownStake = 0;
  state.sixSevenArmed = false;
  state.catch22Armed = false;
  state.sixSevenRewardChoicesRemaining = 0;
  state.equals11Armed = false;
  state.blackjackArmed = false;
  state.diamondGeezerArmed = false;
}

function applyYellowJokerEffect(jokerCard) {
  const jokerId = jokerCard?.jokerId || jokerCard?.id || "";
  if (jokerId.includes("tearless")) {
    return applyTearlessJoker();
  }
  if (jokerId.includes("timeless")) {
    return applyTimelessJoker();
  }
  if (jokerId.includes("gridless")) {
    return applyGridlessJoker();
  }
  if (jokerId.includes("rong")) {
    state.rongActive = true;
    return "RONG swapped Higher and Lower for the rest of this run.";
  }
  if (jokerId.includes("nudgeless")) {
    const removed = (Number(state.nudgeUpCharges) || 0) + (Number(state.nudgeDownCharges) || 0);
    state.nudgeUpCharges = 0;
    state.nudgeDownCharges = 0;
    return removed > 0
      ? `A Yellow Joker removed ${removed} banked Nudge${removed === 1 ? "" : "s"}.`
      : "A Yellow Joker found no banked Nudges.";
  }
  if (jokerId.includes("cheatless")) {
    const removed = Array.isArray(state.cheats) ? state.cheats.length : 0;
    state.cheats = [];
    return removed > 0
      ? `A Yellow Joker discarded ${removed} banked Cheat${removed === 1 ? "" : "s"}.`
      : "A Yellow Joker found no banked Cheats.";
  }
  if (jokerId.includes("powerless")) {
    const removedPowers = Array.isArray(state.powers)
      ? state.powers.filter((powerId) => powerId && powerId !== "nudge_engine").length
      : 0;
    state.powers = ["nudge_engine"];
    state.selectedStartPowerId = null;
    state.currentValueModifier = 0;
    state.nextCardValueModifier = 0;
    clearArmedPowerEffects();
    return removedPowers > 0
      ? `A Yellow Joker stripped ${removedPowers} persistent Power${removedPowers === 1 ? "" : "s"}.`
      : "A Yellow Joker cleared active effects, but no persistent Power was left.";
  }
  return `${getJokerName(jokerCard)} did nothing.`;
}

function addMissingCheatsForDebug() {
  if (!state.current || state.gameOver) return;

  const added = [];
  for (const cheat of CHEATS) {
    const alreadyHeld =
      cheat.stacking !== "stackable" &&
      cheat.stacking !== "repeatable" &&
      state.cheats.some((c) => c.id === cheat.id);

    if (!cheat.included || alreadyHeld) continue;

    state.cheats.push({ ...cheat });
    added.push(cheat.name);
  }

  state.message =
    added.length > 0
      ? ` Debug: added ${added.join(", ")}.`
      : " Debug: no missing Cheats to add.";
  render();
}

function addBulkNudgesForDebug(count = 10) {
  if (!state.current || state.gameOver) {
    state.message = " Debug: start a run before adding bulk nudges.";
    render();
    return;
  }

  state.nudgeUpCharges = (state.nudgeUpCharges || 0) + count;
  state.nudgeDownCharges = (state.nudgeDownCharges || 0) + count;
  state.message = ` Debug: added ${count} Nudge +1 and ${count} Nudge -1 charges.`;
  render();
}

function clearCheatsForDebug() {
  state.cheats = [];
  state.pendingCheatOptions = [];
  state.cheatChoiceLockedUntil = 0;
  state.message = " Debug: cleared all cheats.";
  render();
}

function resetAllStatsForDebug() {
  localStorage.removeItem(CARD_STATS_KEY);
  localStorage.removeItem(CARD_BACK_STATUS_KEY);
  state.cardStats = {};
  state.cardBackStatuses = {};
  state.message = " Debug: cleared progression stats (best score preserved).";
  render();
}

function fullResetAllStateForDebug() {
  localStorage.removeItem(CARD_STATS_KEY);
  localStorage.removeItem(CARD_BACK_STATUS_KEY);
  localStorage.removeItem(RUN_SEED_KEY);
  localStorage.removeItem(BEST_SCORE_KEY);
  localStorage.removeItem(BEST_SCORES_BY_MODE_KEY);
  localStorage.removeItem(SELECTED_LEVEL_KEY);
  localStorage.removeItem(META_PROGRESSION_KEY);
  localStorage.removeItem(EXPERIENCE_KEY);
  localStorage.removeItem(EXPERIENCE_DISPLAY_KEY);
  localStorage.removeItem(CHEAT_UNLOCKS_KEY);
  localStorage.removeItem(PROFILE_STATS_KEY);
  localStorage.removeItem(SELECTED_DECK_KEY);
  localStorage.removeItem(DECK_WINS_KEY);
  localStorage.removeItem(DECK_LEVEL_CLEARS_KEY);
  localStorage.removeItem(UNLOCK_DECKS_KEY);
  localStorage.removeItem(UNLOCK_ALL_KEY);
  localStorage.removeItem(GUESS_BUTTON_ORDER_KEY);
  localStorage.removeItem(RUN_DEBUG_LOG_KEY);
  sessionStorage.removeItem(RED_DECK_DEBUG_UNLOCK_KEY);

  state = createEmptyState();
  state.message = " Debug: FULL RESET (everything cleared).";
  render();
}

/*
  Beginner-friendly onboarding helper.

  For players with meta progression 20 or below:
  - On 8 / 9 / 10 / J / Q / K, avoid a HIGHER next card
  - On A / 2 / 3 / 4 / 5, avoid a LOWER next card
  - 6 and 7 remain fully random

  This does NOT force a win.
  It simply swaps a safer valid card into the next position in the deck,
  while preserving randomness from the remaining unseen cards.
*/
function maybeBiasUpcomingCardForNewPlayers() {
  if (!state.current || state.gameOver) return;
  if ((state.metaProgression ?? 0) > 20) return;
  if ((state.cheatUsesOnCurrentCard || 0) > 0) return;

  const nextIndex = state.index + 1;
  if (nextIndex >= state.deck.length) return;

  const currentValue = state.current.value;
  const currentNext = state.deck[nextIndex];

  // Only bias obvious-feels-bad edge cards
  if (currentValue < 1 || currentValue > 13) return;

  let nextCardAlreadySafe = true;
  let candidateIndexes = [];

  if (currentValue >= 8) {
    // 8 / 9 / 10 / J / Q / K : next card should not be higher
    nextCardAlreadySafe = currentNext.value <= currentValue;

    for (let i = nextIndex + 1; i < state.deck.length; i += 1) {
      if (state.deck[i].value <= currentValue) {
        candidateIndexes.push(i);
      }
    }
  } else if (currentValue <= 5) {
    // A / 2 / 3 / 4 / 5 : next card should not be lower
    nextCardAlreadySafe = currentNext.value >= currentValue;

    for (let i = nextIndex + 1; i < state.deck.length; i += 1) {
      if (state.deck[i].value >= currentValue) {
        candidateIndexes.push(i);
      }
    }
  } else {
    return;
  }

  // If the next card is already "safe enough", leave the deck alone
  if (nextCardAlreadySafe) return;

  // If no safe replacement exists later in the deck, leave it alone
  if (candidateIndexes.length === 0) return;

  // Pick a random valid candidate and swap it into the next slot
  const chosenIndex =
    candidateIndexes[Math.floor(Math.random() * candidateIndexes.length)];

  const temp = state.deck[nextIndex];
  state.deck[nextIndex] = state.deck[chosenIndex];
  state.deck[chosenIndex] = temp;
}

function isTutorialGuessProtectionActive() {
  if (typeof window === "undefined") return false;
  if (typeof window.shouldTutorialForceCorrectGuess === "function") {
    return window.shouldTutorialForceCorrectGuess() === true;
  }
  if (typeof window.shouldForceTutorialCorrectGuess === "function") {
    return window.shouldForceTutorialCorrectGuess() === true;
  }
  return false;
}

function forceTutorialGuessToResolveAsCorrect(type) {
  if (!isTutorialGuessProtectionActive()) return;
  if (typeof ensureTutorialGuessWillResolveAsCorrect === "function") {
    ensureTutorialGuessWillResolveAsCorrect(type);
  }
}

function makeGuess(type) {
  state.restartConfirmArmed = false;
  state.deckStatsTooltipOpen = false;

  if (
    state.gameOver ||
    !state.current ||
    !!state.pendingRevealAnimation ||
    state.pendingCheatOptions.length > 0 ||
    state.pendingPowerOptions.length > 0
  ) {
    return;
  }

  type = getEffectiveGuessType(type);

  let next = peekNext();
  if (!next) return;
  const currentIsJoker = isJokerCard(state.current);
  const nineDartAutoCorrectWasActive = !!state.nineDartAutoCorrect;
  const konamiAutoCorrectWasActive = (Number(state.konamiAutoCorrectRemaining) || 0) > 0;
  const saveScumText = state.saveScumArmed
    ? " Save Scum is ready: tap Continue to carry on."
    : "";

  if (state.forcedNextGuess && type !== state.forcedNextGuess && !isJokerCard(next) && !currentIsJoker) {
    state.message = getForcedGuessMessage(state.forcedNextGuess);
    render();
    return;
  }

  if (isTutorialGuessProtectionActive()) {
    forceTutorialGuessToResolveAsCorrect(type);
  } else {
    maybeBiasUpcomingCardForNewPlayers();
  }
  if (!isJokerCard(next)) {
    next = peekNext();
    if (!next) return;
  }

  const currentComparisonValue = getCurrentEffectiveValue();
  const nextComparisonValue = getNextComparisonValueForGuess(next);
  flushCurrentNudgeLogEntry();
  const equals11WasArmed = !!state.equals11Armed;
  const revealDistance = Number.isFinite(nextComparisonValue) && Number.isFinite(currentComparisonValue)
    ? Math.abs(nextComparisonValue - currentComparisonValue)
    : 0;
  const formatEnergyFeedback = (delta) => {
    return "";
  };
  const appendEnergyFeedback = (message, delta) => {
    const feedback = formatEnergyFeedback(delta);
    return feedback ? `${message} (${feedback})` : message;
  };

  const nextModifierBeforeGuess = state.nextCardValueModifier || 0;
  const lockySevenCarryModifier = getLockySevenCarryModifier(next, nextComparisonValue, nextModifierBeforeGuess);
  const currentWasBase = state.currentValueModifier === 0;
  const el = document.getElementById("next-info");
  if (el) el.innerText = "";
  state.nextCardValueModifier = 0;
  const suitedAndBootedShouldResolveOnReveal = !!state.suitedAndBootedArmed;

  if (isJokerCard(next)) {
    const prevCard = state.current;
    state.equals11Armed = false;
    state.blackjackArmed = false;
    state.diamondGeezerArmed = false;
    state.findLadyArmed = false;
    advanceToCard(next);
    state.currentValueModifier = 0;
    if (typeof recordDiscoveredJokers === "function") {
      recordDiscoveredJokers(next.jokerId || next.id);
    }
    const jokerMessage = applyYellowJokerEffect(next);
    const jokerTriggeredCheatAward = advanceCheatRewardStreak();
    const nineDartText = resolveNineDartOnReveal(true);
    const konamiText = resolveKonamiOnReveal(type);
    const konamiAutoText = resolveKonamiAutoCorrectOnReveal(konamiAutoCorrectWasActive);
    const cryogenText = resolveCryogenAfterReveal();
    state.lastJokerMessage = jokerMessage;
    queueCardRevealAnimation({
      outcome: "correct",
      fromCard: prevCard,
      fromEffectiveValue: currentComparisonValue,
      revealCard: next,
      revealEffectiveValue: null,
      effectId: "joker",
      feedbackEffect: "correct",
      clearSuitedAndBootedOnFinalize: suitedAndBootedShouldResolveOnReveal,
    });
    appendRunDebugLog("yellow_joker_resolved", {
      guess: type,
      jokerId: next.jokerId || next.id,
      jokerName: getJokerName(next),
      outcome: "hazard_resolved",
      message: jokerMessage,
      remainingJokers: getRemainingJokerCount(),
      nudgeUpCharges: state.nudgeUpCharges || 0,
      nudgeDownCharges: state.nudgeDownCharges || 0,
      cheatsHeld: Array.isArray(state.cheats) ? state.cheats.length : 0,
      powers: Array.isArray(state.powers) ? [...state.powers] : [],
      streakTriggeredCheatAward: jokerTriggeredCheatAward,
    });

    if (state.index >= state.deck.length - 1) {
      if (jokerTriggeredCheatAward) {
        creditDailyEndgameBonusPicks({
          cheatPicks: 1,
          reason: "final_joker_streak",
        });
      }
      if (!isDevModeRun()) {
        if (state.runMode !== "daily") {
          state.deckWins = recordDeckWin(state.currentDeckKey);
          state.deckLevelClears = recordDeckLevelClear(state.currentDeckKey, state.currentLevelNumber);
          recordDeckClearProgress(state.currentDeckKey);
        } else {
          recordDailyClearProgress();
        }
      }
      state.message = `Yellow Joker: ${jokerMessage}${nineDartText}${konamiText}${konamiAutoText}${cryogenText} YOU CLEARED THE DECK!`;
      state.gameOver = true;
      render();
      triggerVictoryEffect();
      handleRunFinished(state.correctAnswers);
      if (!isDevModeRun() && normalizeDeckKey(state.currentDeckKey) !== "black" && !state.victoryPromptShown && typeof window.promptHeroNameForVictory === "function") {
        if (state.runMode === "daily") return;
        state.victoryPromptShown = true;
        window.setTimeout(() => {
          window.promptHeroNameForVictory();
        }, 900);
      }
      return;
    }

    if (jokerTriggeredCheatAward) {
      state.pauseForCheat = true;
      state.message = `Yellow Joker: ${jokerMessage}${nineDartText}${konamiText}${konamiAutoText}${cryogenText} Cheat ready.`;
      updateBestScoreIfNeeded();
      render();
      setTimeout(() => {
        state.pauseForCheat = false;
        offerCheatChoice("streak");
        render();
      }, 1000);
      return;
    }

    state.message = `Yellow Joker: ${jokerMessage}${nineDartText}${konamiText}${konamiAutoText}${cryogenText}`;
    updateBestScoreIfNeeded();
    render();
    return;
  }

  const lucky7WasArmed = !!state.lucky7Armed;
  const fiveAliveWasArmed = !!state.fiveAliveArmed;
  const marginForErrorWasArmed = !!state.marginForErrorArmed;
  const hotOrColdWasArmed = !!state.hotOrColdArmed;
  const stitchInTimeWasArmed = !!state.stitchInTimeArmed;
  const sellYourSoulWasArmed = !!state.sellYourSoulArmed;
  const higherHigherHigherRemainingBeforeGuess = Number(state.higherHigherHigherRemaining || 0);
  const psychoRemainingBeforeGuess = Number(state.psychoRemaining || 0);
  const catch22WasArmed = !!state.catch22Armed;
  const blackjackWasArmed = !!state.blackjackArmed;
  const diamondGeezerWasArmed = !!state.diamondGeezerArmed;
  const findLadyWasArmed = !!state.findLadyArmed;
  const godSaveKingWasArmed = !!state.godSaveKingArmed;
  const lucky13WasArmed = !!state.lucky13Armed;
  const alwaysBetBlackWasArmed = !!state.alwaysBetBlackArmed;
  const redDeadRedemptionWasArmed = !!state.redDeadRedemptionArmed;
  const suitsYouSirWasArmed = !!state.suitsYouSirArmed;
  const suitsYouSirSuit = state.suitsYouSirSuit || "";
  const oddOneOutWasArmed = !!state.oddOneOutArmed;
  const sixSevenWasArmed = !!state.sixSevenArmed;
  const cursedShieldChargesBeforeGuess = Math.max(0, Number(state.cursedShieldCharges) || 0);
  const cursedShieldWasArmed = cursedShieldChargesBeforeGuess > 0 || !!state.cursedShieldArmed;
  const refundWasArmed = !!state.refundArmed;
  const oneLifeLeftLivesBeforeGuess = Math.max(0, Number(state.oneLifeLeftLives) || 0);
  const killerQueenLivesBeforeGuess = Math.max(0, Number(state.killerQueenLives) || 0);
  const suitedAndBootedWasArmed = !!state.suitedAndBootedArmed;
  const suitedAndBootedSuit = state.suitedAndBootedSuit || "";
  const blankSpaceWasActive = !!state.blankSpaceActive;
  const nudgeNudgeWasArmed = !!state.nudgeNudgeArmed;
  const wlStageBeforeGuess = state.wlStage || "";
  const forcedNextGuessDirection = state.forcedNextGuess || "";
  const passiveSuitSavePower = getPassiveSuitSavePower(state.current);
  const nextSuitForResolution = blankSpaceWasActive ? "" : (next.suit || "");

  state.lucky7Armed = false;
  state.fiveAliveArmed = false;
  state.fiveAliveNudgeLocked = false;
  state.marginForErrorArmed = false;
  state.hotOrColdArmed = false;
  state.stitchInTimeArmed = false;
  state.sellYourSoulArmed = false;
  state.catch22Armed = false;
  state.blackjackArmed = false;
  state.diamondGeezerArmed = false;
  state.findLadyArmed = false;
  state.godSaveKingArmed = false;
  state.lucky13Armed = false;
  state.alwaysBetBlackArmed = false;
  state.redDeadRedemptionArmed = false;
  state.suitsYouSirArmed = false;
  state.suitsYouSirSuit = "";
  state.oddOneOutArmed = false;
  state.sixSevenArmed = false;
  state.refundArmed = false;
  state.equals11Armed = false;
  state.blankSpaceActive = false;
  state.blankSpaceValue = null;
  state.nudgeNudgeArmed = false;
  state.nudgeNudgeStacks = 0;
  state.forcedNextGuess = "";
  state.lockCurrentCardForForcedGuess = false;
  state.wlStage = "";

  let correct = false;
  let match = false;
  let cheatSpecial = false;
  const jokerAutoCorrect = currentIsJoker;
  let rescuedBySuitSave = false;
  let rescuedByAlwaysBetBlack = false;
  let rescuedByRedDeadRedemption = false;
  let rescuedByCursedShield = false;
  let rescuedByOneLifeLeft = false;
  let rescuedByKillerQueen = false;
  let rescuedBySuitedAndBooted = false;
  let rescuedByMarginForError = false;
  let rescuedByHotOrCold = false;
  let rescuedByStitchInTime = false;
  let rescuedBySellYourSoul = false;
  let comparisonCorrect = false;
  let wlLossSatisfied = false;
  let wlAdvancedToLoss = false;
  let wlCompleted = false;
  let higherHigherHigherCompleted = false;
  let higherHigherHigherBroken = false;
  let catch22Hit = false;
  let blackjackHit = false;
  let diamondGeezerHit = false;
  let findLadyHit = false;
  let psychoCompleted = false;

  const forcedNudgeDirection =
    forcedNextGuessDirection === "higher"
      ? "up"
      : forcedNextGuessDirection === "lower"
        ? "down"
        : "";
  const forcedNudgeReward = forcedNudgeDirection && Number.isFinite(nextComparisonValue) && Number.isFinite(currentComparisonValue)
    ? Math.abs(nextComparisonValue - currentComparisonValue)
    : 0;

  const nextIsOddForOddOneOut = nextComparisonValue === 1 || (nextComparisonValue <= 10 && nextComparisonValue % 2 === 1);
  if (oddOneOutWasArmed) {
    if (nextIsOddForOddOneOut) {
      const lossCurrentCard = state.current;
      recordCurrentCardGuess(state.current, type, false);
      recordFaceDownOutcome(next, true, currentWasBase);
      advanceToCard(next);
      queueCardRevealAnimation({
        outcome: "wrong",
        fromCard: lossCurrentCard,
        fromEffectiveValue: currentComparisonValue,
        revealCard: next,
        revealEffectiveValue: nextComparisonValue,
        effectId: resolveRevealEffectId(buildRevealEffectContext({
          outcome: "wrong",
          guessType: type,
          currentComparisonValue,
          nextComparisonValue,
          revealCard: next,
          match: false,
          aceAutoWin: false,
          cheatSpecial: true,
        })),
        triggerGameOver: true,
        clearSuitedAndBootedOnFinalize: suitedAndBootedWasArmed,
      });
      state.currentValueModifier = 0;
      state.streak = 0;
      const suitsYouSirText = resolveSuitsYouSirOnReveal(suitsYouSirWasArmed, suitsYouSirSuit, next);
      const newSuitsResult = resolveNewSuitsOnReveal(next);
      const lossMessage = appendEnergyFeedback(
        `Odd One Out triggered - next card was ${formatNextCardForLossMessage(next)}.${suitsYouSirText}${newSuitsResult.text}`,
        -revealDistance
      );
      appendRunDebugLog("guess_resolved", {
        guess: type,
        outcome: "loss",
        reason: "odd_one_out",
        currentComparisonValue,
        nextComparisonValue,
        revealDistance,
        lucky7WasArmed,
        fiveAliveWasArmed,
        godSaveKingWasArmed,
        alwaysBetBlackWasArmed,
        oddOneOutWasArmed,
        sixSevenWasArmed,
        message: lossMessage,
      });
      if (state.pendingRevealAnimation) {
        state.pendingRevealAnimation.gameOverDetail = state.saveScumArmed
          ? `${lossMessage} Save Scum is ready: tap Continue to carry on.`
          : lossMessage;
      }
      state.message = `💀 ${lossMessage}`;
      if (state.saveScumArmed) {
        state.message = `${state.message} Save Scum is ready: tap Continue to carry on.`;
        state.saveScumArmed = false;
        state.saveScumPendingContinue = true;
      }
      state.gameOver = true;
      updateBestScoreIfNeeded();
      render();
      return;
    }
    cheatSpecial = true;
    correct = true;
  }

  if (!cheatSpecial && nextComparisonValue === currentComparisonValue) {
    match = true;
    correct = true;
  }

  const aceAutoWin =
    !cheatSpecial &&
    !match &&
    isAceWildAutoCorrect(currentComparisonValue, next);

  if (aceAutoWin) {
    cheatSpecial = true;
    correct = true;
  }

  if (jokerAutoCorrect) {
    cheatSpecial = true;
    correct = true;
  }

  if (nineDartAutoCorrectWasActive || konamiAutoCorrectWasActive) {
    cheatSpecial = true;
    correct = true;
  }

  if (!cheatSpecial && !match) {
    comparisonCorrect =
      (type === "higher" && nextComparisonValue > currentComparisonValue) ||
      (type === "lower" && nextComparisonValue < currentComparisonValue);
    const tutorialAutoCorrect = !comparisonCorrect && isTutorialGuessProtectionActive();
    const rescuedByLucky7 = !comparisonCorrect && lucky7WasArmed;
    const rescuedByFiveAlive = !comparisonCorrect && fiveAliveWasArmed;
    rescuedByMarginForError = !comparisonCorrect && marginForErrorWasArmed && revealDistance <= 2;
    rescuedByHotOrCold = !comparisonCorrect && hotOrColdWasArmed && revealDistance <= 3;
    rescuedByStitchInTime = !comparisonCorrect && stitchInTimeWasArmed;
    const rescuedByGodSaveKing = !comparisonCorrect && godSaveKingWasArmed && getNextComparisonValueForGuess(next) === 13;
    rescuedByAlwaysBetBlack = !comparisonCorrect && alwaysBetBlackWasArmed && (nextSuitForResolution === SUITS[0] || nextSuitForResolution === SUITS[3]);
    rescuedByRedDeadRedemption = !comparisonCorrect && redDeadRedemptionWasArmed && (nextSuitForResolution === SUITS[1] || nextSuitForResolution === SUITS[2]);
    rescuedByKillerQueen =
      !comparisonCorrect &&
      type === "lower" &&
      state.current?.rank === "Q" &&
      Number.isFinite(nextComparisonValue) &&
      nextComparisonValue === 13 &&
      killerQueenLivesBeforeGuess > 0;
    rescuedBySuitedAndBooted = !comparisonCorrect && suitedAndBootedWasArmed && !!suitedAndBootedSuit && nextSuitForResolution !== suitedAndBootedSuit;
    rescuedBySuitSave = !comparisonCorrect && !!passiveSuitSavePower;
    rescuedBySellYourSoul = !comparisonCorrect && sellYourSoulWasArmed;
    const rescuedBySpecificSave =
      rescuedByLucky7 ||
      rescuedByFiveAlive ||
      rescuedByMarginForError ||
      rescuedByHotOrCold ||
      rescuedByStitchInTime ||
      rescuedByGodSaveKing ||
      rescuedByAlwaysBetBlack ||
      rescuedByRedDeadRedemption ||
      rescuedByKillerQueen ||
      rescuedBySuitedAndBooted ||
      rescuedBySuitSave ||
      rescuedBySellYourSoul;
    rescuedByCursedShield = !comparisonCorrect && !rescuedBySpecificSave && cursedShieldWasArmed;
    rescuedByOneLifeLeft =
      !comparisonCorrect &&
      !rescuedBySpecificSave &&
      !rescuedByCursedShield &&
      oneLifeLeftLivesBeforeGuess > 0;
    correct =
      comparisonCorrect ||
      tutorialAutoCorrect ||
      rescuedByLucky7 ||
      rescuedByFiveAlive ||
      rescuedByMarginForError ||
      rescuedByHotOrCold ||
      rescuedByStitchInTime ||
      rescuedByGodSaveKing ||
      rescuedByAlwaysBetBlack ||
      rescuedByRedDeadRedemption ||
      rescuedByCursedShield ||
      rescuedByKillerQueen ||
      rescuedByOneLifeLeft ||
      rescuedBySuitedAndBooted ||
      rescuedBySuitSave ||
      rescuedBySellYourSoul;
    if (rescuedByCursedShield) {
      state.cursedShieldCharges = Math.max(0, cursedShieldChargesBeforeGuess - 1);
      state.cursedShieldArmed = state.cursedShieldCharges > 0;
    }
    if (rescuedByOneLifeLeft) {
      state.oneLifeLeftLives = Math.max(0, oneLifeLeftLivesBeforeGuess - 1);
    }
    if (rescuedByKillerQueen) {
      state.killerQueenLives = Math.max(0, killerQueenLivesBeforeGuess - 1);
    }
    wlLossSatisfied = wlStageBeforeGuess === "need_loss" && !comparisonCorrect;
    if (wlLossSatisfied) {
      correct = true;
      wlCompleted = true;
    }
  }

  const naturallyCorrectGuess = comparisonCorrect || match || aceAutoWin || jokerAutoCorrect || nineDartAutoCorrectWasActive || konamiAutoCorrectWasActive;
  const allInGuessWasCorrect = naturallyCorrectGuess;
  const sellYourSoulResult = resolveSellYourSoulAfterReveal(sellYourSoulWasArmed, naturallyCorrectGuess);

  const lucky13Text = resolveLucky13OnReveal(lucky13WasArmed, next);
  const refundResult = correct ? getRefundNudgeResult(refundWasArmed, type, nextComparisonValue) : null;
  const suitsYouSirText = resolveSuitsYouSirOnReveal(suitsYouSirWasArmed, suitsYouSirSuit, next);
  const newSuitsResult = resolveNewSuitsOnReveal(next);
  const nineDartText = resolveNineDartOnReveal(naturallyCorrectGuess);
  const konamiText = resolveKonamiOnReveal(type);
  const konamiAutoText = resolveKonamiAutoCorrectOnReveal(konamiAutoCorrectWasActive);
  const cryogenText = resolveCryogenAfterReveal();
  const refundNudgeText = applyRefundNudgeResult(refundResult);
  const revealBonusText = `${suitsYouSirText}${lucky13Text}${refundNudgeText}`;
  const refundText = `${revealBonusText}${newSuitsResult.text}`;
  const timedEffectText = `${nineDartText}${konamiText}${konamiAutoText}${cryogenText}`;
  const allInText = resolveAllInOnReveal(allInGuessWasCorrect);

  if (!correct) {
    const lossCurrentCard = state.current;
    recordCurrentCardGuess(state.current, type, false);
    recordFaceDownOutcome(next, true, currentWasBase);
    advanceToCard(next);
    state.currentValueModifier = lockySevenCarryModifier;
    state.streak = 0;
    const lossDetail = sixSevenWasArmed
      ? `6/7 failed - ${buildWrongGuessMessage(type, lossCurrentCard, currentComparisonValue, next, nextComparisonValue)}${suitsYouSirText}`
      : `${buildWrongGuessMessage(type, lossCurrentCard, currentComparisonValue, next, nextComparisonValue)}${suitsYouSirText}`;
    const gameOverMessage = `❌ ${lossDetail}`;
    queueCardRevealAnimation({
      outcome: "wrong",
      fromCard: lossCurrentCard,
      fromEffectiveValue: currentComparisonValue,
      revealCard: next,
      revealEffectiveValue: nextComparisonValue,
      effectId: resolveRevealEffectId(buildRevealEffectContext({
        outcome: "wrong",
        guessType: type,
        currentComparisonValue,
        nextComparisonValue,
        revealCard: next,
        match: false,
        aceAutoWin,
        cheatSpecial,
      })),
      triggerGameOver: true,
      gameOverDetail: `${gameOverMessage}${allInText}${timedEffectText}${saveScumText}`,
      clearSuitedAndBootedOnFinalize: suitedAndBootedWasArmed,
    });

    appendRunDebugLog("guess_resolved", {
      guess: type,
      outcome: "loss",
      reason: sixSevenWasArmed ? "six_seven_failed" : "comparison_failed",
      currentComparisonValue,
      nextComparisonValue,
      revealDistance,
      aceAutoWin,
      match,
      lucky7WasArmed,
      fiveAliveWasArmed,
      godSaveKingWasArmed,
      lucky13WasArmed,
      alwaysBetBlackWasArmed,
      redDeadRedemptionWasArmed,
      oddOneOutWasArmed,
      sixSevenWasArmed,
      cursedShieldWasArmed,
      killerQueenLivesBeforeGuess,
      killerQueenLivesAfterGuess: state.killerQueenLives || 0,
      suitedAndBootedWasArmed,
      suitedAndBootedSuit,
      forcedNextGuessDirection,
      passiveSuitSavePowerId: passiveSuitSavePower?.id || "",
      rescuedBySuitSave,
      rescuedByAlwaysBetBlack,
      rescuedByRedDeadRedemption,
      rescuedByCursedShield,
      rescuedByKillerQueen,
      rescuedBySuitedAndBooted,
      rescuedByMarginForError,
      rescuedByHotOrCold,
      rescuedByStitchInTime,
      energyAfter: state.energy || 0,
      message: lossDetail,
    });

    state.message = `${gameOverMessage}${allInText}${timedEffectText}${saveScumText}`;
    if (state.saveScumArmed) {
      state.saveScumArmed = false;
      state.saveScumPendingContinue = true;
    }
    state.gameOver = true;
    updateBestScoreIfNeeded();
    render();
    if (!state.saveScumPendingContinue) {
      handleRunFinished(state.correctAnswers);
    }
    return;
  }

  const prevCard = state.current;
  recordCurrentCardGuess(state.current, type, true);
  recordFaceDownOutcome(next, false, currentWasBase);
  const bingoAwards = advanceToCard(next, { awardBingo: true });
  queueCardRevealAnimation({
    outcome: "correct",
    fromCard: prevCard,
    fromEffectiveValue: currentComparisonValue,
    revealCard: next,
    revealEffectiveValue: nextComparisonValue,
    effectId: resolveRevealEffectId(buildRevealEffectContext({
      outcome: "correct",
      guessType: type,
      currentComparisonValue,
      nextComparisonValue,
      revealCard: next,
      match,
      aceAutoWin,
      cheatSpecial,
    })),
    clearSuitedAndBootedOnFinalize: suitedAndBootedWasArmed,
  });
  state.correctAnswers += 1;
  if (!isDevModeRun()) {
    recordCorrectGuessProgress(1);
  }
  state.currentValueModifier = lockySevenCarryModifier;
  state.streak = (state.streak || 0) + 1;
  addMetaProgression(1);
  if (catch22WasArmed && Number.isFinite(nextComparisonValue) && nextComparisonValue === 2) {
    catch22Hit = true;
    queuePowerAward("catch_22");
  }
  if (
    blackjackWasArmed &&
    Number.isFinite(currentComparisonValue) &&
    Number.isFinite(nextComparisonValue) &&
    currentComparisonValue + nextComparisonValue === 21
  ) {
    blackjackHit = true;
    queuePowerAward("blackjack");
  }
  if (diamondGeezerWasArmed && nextSuitForResolution === "♦") {
    diamondGeezerHit = true;
    queueCheatAward("diamond_geezer");
    queueCheatAward("diamond_geezer");
  }
  if (findLadyWasArmed && next.rank === "Q") {
    findLadyHit = true;
    queuePowerAward("find_the_lady");
  }
  if (higherHigherHigherRemainingBeforeGuess > 0) {
    if (type === "higher") {
      state.higherHigherHigherRemaining = Math.max(0, higherHigherHigherRemainingBeforeGuess - 1);
      higherHigherHigherCompleted = state.higherHigherHigherRemaining === 0;
      if (higherHigherHigherCompleted) {
        queuePowerAward("higher_higher_higher");
      }
    } else {
      state.higherHigherHigherRemaining = 0;
      higherHigherHigherBroken = true;
    }
  }
  if (wlStageBeforeGuess === "need_win" && !wlCompleted) {
    state.wlStage = "need_loss";
    wlAdvancedToLoss = true;
  }
  if (forcedNudgeDirection === "up" && forcedNudgeReward > 0) {
    state.nudgeUpCharges = (state.nudgeUpCharges || 0) + forcedNudgeReward;
  } else if (forcedNudgeDirection === "down" && forcedNudgeReward > 0) {
    state.nudgeDownCharges = (state.nudgeDownCharges || 0) + forcedNudgeReward;
  }
  updateBestScoreIfNeeded();
  const equals11Resolved = equals11WasArmed && Number.isFinite(currentComparisonValue) && Number.isFinite(nextComparisonValue);
  const equals11Total = equals11Resolved ? currentComparisonValue + nextComparisonValue : null;
  const equals11Hit = equals11Resolved && equals11Total === 11;
  if (equals11Hit && state.index < state.deck.length - 1) {
    queueCheatAward("equals_11");
    queueCheatAward("equals_11");
    queueCheatAward("equals_11");
  }
  if (state.index >= state.deck.length - 1) {
    const dailyFinalBonus = creditDailyFinalCardBonusPicks({
      blankSpacePowerTriggered: blankSpaceWasActive,
      brucieBonusTriggered: runHasPower("brucie_bonus") && match,
      catch22Hit,
      blackjackHit,
      diamondGeezerHit,
      cheatACheaterWillTrigger: (state.cheatACheaterRemaining || 0) === 1,
      equals11Hit,
      higherHigherHigherCompleted,
      newSuitsResult,
      psychoCompleted:
        psychoCompleted ||
        (psychoRemainingBeforeGuess > 0 && Math.max(0, psychoRemainingBeforeGuess - 1) === 0),
      sixSevenWasArmed,
      wlCompleted,
    });
    appendRunDebugLog("guess_resolved", {
      guess: type,
      outcome: "deck_cleared",
      reason: "final_card",
      currentComparisonValue,
      nextComparisonValue,
      revealDistance,
      aceAutoWin,
      match,
      lucky7WasArmed,
      fiveAliveWasArmed,
      godSaveKingWasArmed,
      alwaysBetBlackWasArmed,
      redDeadRedemptionWasArmed,
      oddOneOutWasArmed,
      sixSevenWasArmed,
      cursedShieldWasArmed,
      suitedAndBootedWasArmed,
      suitedAndBootedSuit,
      forcedNextGuessDirection,
      forcedNudgeDirection,
      forcedNudgeReward,
      rescuedByCursedShield,
      rescuedByKillerQueen,
      rescuedBySuitedAndBooted,
      dailyFinalBonus,
      energyAfter: state.energy || 0,
    });
    if (!isDevModeRun()) {
      if (state.runMode !== "daily") {
        state.deckWins = recordDeckWin(state.currentDeckKey);
        state.deckLevelClears = recordDeckLevelClear(state.currentDeckKey, state.currentLevelNumber);
        recordDeckClearProgress(state.currentDeckKey);
      } else {
        recordDailyClearProgress();
      }
    }
    state.message = appendEnergyFeedback(` YOU CLEARED THE DECK!${refundText}${allInText}${timedEffectText}`, revealDistance);
    state.gameOver = true;
    render();
    triggerVictoryEffect();
    handleRunFinished(state.correctAnswers);
    if (!isDevModeRun() && normalizeDeckKey(state.currentDeckKey) !== "black" && !state.victoryPromptShown && typeof window.promptHeroNameForVictory === "function") {
      if (state.runMode === "daily") return;
      state.victoryPromptShown = true;
      window.setTimeout(() => {
        window.promptHeroNameForVictory();
      }, 900);
    }
    return;
  }

  const powerAwards = awardOnCorrectGuessPowers(type);
  const bingoAwardText = `${formatBingoAwardText(bingoAwards)}${allInText}`;
  const blankSpacePowerTriggered = blankSpaceWasActive;
  const brucieBonusTriggered = runHasPower("brucie_bonus") && match;
  let cheatACheaterTriggered = false;

  if (blankSpacePowerTriggered) {
    if (!Array.isArray(state.pendingPowerAwardQueue)) {
      state.pendingPowerAwardQueue = [];
    }
    state.pendingPowerAwardQueue.unshift("blank_space");
  }

  if (brucieBonusTriggered) {
    queuePowerAward("brucie_bonus");
  }

  if ((state.cheatACheaterRemaining || 0) > 0) {
    state.cheatACheaterRemaining = Math.max(0, (state.cheatACheaterRemaining || 0) - 1);
    if (state.cheatACheaterRemaining === 0) {
      cheatACheaterTriggered = true;
      queueCheatAward("cheat_a_cheater");
      queueCheatAward("cheat_a_cheater");
    }
  }

  if (psychoRemainingBeforeGuess > 0) {
    state.psychoRemaining = Math.max(0, psychoRemainingBeforeGuess - 1);
    psychoCompleted = state.psychoRemaining === 0;
    if (psychoCompleted) {
      queuePowerAward("psycho");
    }
  }

  if (wlCompleted) {
    queueCheatAward("wl");
    queueCheatAward("wl");
    queueCheatAward("wl");
  }

  queueNewSuitsAwards(newSuitsResult);

  appendRunDebugLog("guess_resolved", {
    guess: type,
    outcome: "correct",
    reason: aceAutoWin
      ? "ace_auto_win"
      : match
        ? "match"
        : rescuedByCursedShield
          ? "cursed_shield"
          : rescuedByAlwaysBetBlack
            ? "always_bet_on_the_black"
            : rescuedByRedDeadRedemption
              ? "red_dead_redemption"
              : rescuedByKillerQueen
                ? "killer_queen"
                : rescuedBySuitedAndBooted
                  ? "suited_and_booted"
                  : rescuedByMarginForError
                    ? "margin_for_error"
                    : rescuedByHotOrCold
                      ? "margin_of_error"
                      : rescuedByStitchInTime
                        ? "stitch_in_time_saves"
        : lucky7WasArmed
          ? "lucky_7"
          : fiveAliveWasArmed
            ? "five_alive"
            : godSaveKingWasArmed
              ? "god_save_the_king"
              : oddOneOutWasArmed
                ? "odd_one_out_safe"
                : "comparison_correct",
    currentComparisonValue,
    nextComparisonValue,
    revealDistance,
    aceAutoWin,
    match,
    lucky7WasArmed,
    fiveAliveWasArmed,
    marginForErrorWasArmed,
    hotOrColdWasArmed,
    stitchInTimeWasArmed,
    higherHigherHigherRemainingBeforeGuess,
    higherHigherHigherCompleted,
    higherHigherHigherBroken,
    psychoRemainingBeforeGuess,
    psychoRemainingAfterGuess: state.psychoRemaining || 0,
    catch22WasArmed,
    catch22Hit,
    blackjackWasArmed,
    blackjackHit,
    diamondGeezerWasArmed,
    diamondGeezerHit,
    findLadyWasArmed,
    findLadyHit,
    godSaveKingWasArmed,
    alwaysBetBlackWasArmed,
    redDeadRedemptionWasArmed,
    oddOneOutWasArmed,
    sixSevenWasArmed,
    cursedShieldWasArmed,
    oneLifeLeftLivesBeforeGuess,
    oneLifeLeftLivesAfterGuess: state.oneLifeLeftLives || 0,
    killerQueenLivesBeforeGuess,
    killerQueenLivesAfterGuess: state.killerQueenLives || 0,
    suitedAndBootedWasArmed,
    suitedAndBootedSuit,
    forcedNextGuessDirection,
    forcedNudgeDirection,
    forcedNudgeReward,
    passiveSuitSavePowerId: passiveSuitSavePower?.id || "",
    rescuedBySuitSave,
    rescuedByAlwaysBetBlack,
    rescuedByRedDeadRedemption,
    rescuedByCursedShield,
    rescuedByOneLifeLeft,
    rescuedByKillerQueen,
    rescuedBySuitedAndBooted,
    rescuedByMarginForError,
    rescuedByHotOrCold,
    rescuedByStitchInTime,
    blankSpaceWasActive,
    nudgeNudgeWasArmed,
    wlStageBeforeGuess,
    wlAdvancedToLoss,
    wlCompleted,
    blankSpacePowerTriggered,
    brucieBonusTriggered,
    cheatACheaterTriggered,
    newSuitsCompleted: !!newSuitsResult.completed,
    newSuitsAwardCount: newSuitsResult.awardCount || 0,
    cheatACheaterRemaining: state.cheatACheaterRemaining || 0,
    energyAfter: state.energy || 0,
  });

  if (sixSevenWasArmed) {
    state.streak = 0;
    state.sixSevenRewardChoicesRemaining = 3;
  }

  if (blankSpacePowerTriggered) {
    state.pauseForCheat = true;
    state.message = appendEnergyFeedback(
      wlCompleted
        ? `Blank Space hit! Choose 1 power now. WL also landed - 3 bonus cheats queued.${refundText}${bingoAwardText}`
        : sixSevenWasArmed
          ? `Blank Space hit! Choose 1 power now. 6/7 bonus cheats are queued next.${refundText}${bingoAwardText}`
          : `Blank Space hit! Choose 1 power now.${refundText}${bingoAwardText}`,
      revealDistance
    );
    render();
    setTimeout(() => {
      state.pauseForCheat = false;
      const nextReason = state.pendingPowerAwardQueue.shift() || "blank_space";
      offerRewardPowerChoice(nextReason);
      render();
    }, 1000);
    return;
  }

  if (findLadyHit) {
    if (state.streak >= getCheatRewardThreshold()) {
      state.streak = 0;
      queueCheatAward("streak");
    }
    state.pauseForCheat = true;
    state.message = appendEnergyFeedback(`Find The Lady hit! Queen revealed - choose a new Power.${refundText}${bingoAwardText}`, revealDistance);
    render();
    setTimeout(() => {
      state.pauseForCheat = false;
      const nextReason = state.pendingPowerAwardQueue.shift() || "find_the_lady";
      offerRewardPowerChoice(nextReason);
      render();
    }, 1000);
    return;
  }

  if (sixSevenWasArmed) {
    state.streak = 0;
    state.sixSevenRewardChoicesRemaining = 3;
    state.pauseForCheat = true;
    state.message = powerAwards.length > 0
      ? `✅ 6/7 hit! Choose 3 cheats - power gained: ${powerAwards.join(", ")}.`
      : "✅ 6/7 hit! Choose 3 cheats.";
    state.message = appendEnergyFeedback(`${state.message}${refundText}${bingoAwardText}`, revealDistance);
    render();
    setTimeout(() => {
      state.pauseForCheat = false;
      offerCheatChoice();
      render();
    }, 1000);
    return;
  }

  if (wlCompleted) {
    state.pauseForCheat = true;
    state.message = appendEnergyFeedback(`WL complete! Wrong guess survived - choose 3 bonus cheats.${refundText}${bingoAwardText}`, revealDistance);
    render();
    setTimeout(() => {
      state.pauseForCheat = false;
      const nextReason = state.pendingCheatAwardQueue.shift() || "wl";
      offerCheatChoice(nextReason);
      render();
    }, 1000);
    return;
  }

  if (higherHigherHigherCompleted) {
    state.pauseForCheat = true;
    state.message = appendEnergyFeedback(`Higher, Higher, Higher complete! Choose a new Power.${refundText}${bingoAwardText}`, revealDistance);
    render();
    setTimeout(() => {
      state.pauseForCheat = false;
      const nextReason = state.pendingPowerAwardQueue.shift() || "higher_higher_higher";
      offerRewardPowerChoice(nextReason);
      render();
    }, 1000);
    return;
  }

  if (catch22Hit) {
    state.pauseForCheat = true;
    state.message = appendEnergyFeedback(`Catch-22 hit! The next card was a 2 - choose a new Power.${refundText}${bingoAwardText}`, revealDistance);
    render();
    setTimeout(() => {
      state.pauseForCheat = false;
      const nextReason = state.pendingPowerAwardQueue.shift() || "catch_22";
      offerRewardPowerChoice(nextReason);
      render();
    }, 1000);
    return;
  }

  if (blackjackHit) {
    if (state.streak >= getCheatRewardThreshold()) {
      state.streak = 0;
      queueCheatAward("streak");
    }
    state.pauseForCheat = true;
    state.message = appendEnergyFeedback(`Blackjack hit! Current + next = 21 - choose a new Power.${refundText}${bingoAwardText}`, revealDistance);
    render();
    setTimeout(() => {
      state.pauseForCheat = false;
      const nextReason = state.pendingPowerAwardQueue.shift() || "blackjack";
      offerRewardPowerChoice(nextReason);
      render();
    }, 1000);
    return;
  }

  if (psychoCompleted) {
    state.pauseForCheat = true;
    state.message = appendEnergyFeedback(`Psycho complete! Choose a new Power.${refundText}${bingoAwardText}`, revealDistance);
    render();
    setTimeout(() => {
      state.pauseForCheat = false;
      const nextReason = state.pendingPowerAwardQueue.shift() || "psycho";
      offerRewardPowerChoice(nextReason);
      render();
    }, 1000);
    return;
  }

  if (diamondGeezerHit) {
    if (state.streak >= getCheatRewardThreshold()) {
      state.streak = 0;
      queueCheatAward("streak");
    }
    state.pauseForCheat = true;
    state.message = appendEnergyFeedback(`Diamond Geezer hit! Diamond revealed - choose 2 bonus Cheats.${refundText}${bingoAwardText}`, revealDistance);
    render();
    setTimeout(() => {
      state.pauseForCheat = false;
      const nextReason = state.pendingCheatAwardQueue.shift() || "diamond_geezer";
      offerCheatChoice(nextReason);
      render();
    }, 1000);
    return;
  }

  if (equals11Hit) {
    let equalsMessage = `Equals 11 hit! ${valueToRank(currentComparisonValue)} + ${valueToRank(nextComparisonValue)} = 11. Choose 3 bonus cheats.`;
    if (state.streak >= getCheatRewardThreshold()) {
      state.streak = 0;
      queueCheatAward("streak");
      equalsMessage += " Streak cheat queued next.";
    }
    if (powerAwards.length > 0) {
      equalsMessage += ` Power gained: ${powerAwards.join(", ")}.`;
    }
    equalsMessage += `${refundText}${bingoAwardText}`;
    state.pauseForCheat = true;
    state.message = appendEnergyFeedback(equalsMessage, revealDistance);
    render();
    setTimeout(() => {
      state.pauseForCheat = false;
      const nextReason = state.pendingCheatAwardQueue.shift() || "equals_11";
      offerCheatChoice(nextReason);
      render();
    }, 1000);
    return;
  }

  const forcedRewardText = forcedNudgeReward > 0
    ? forcedNudgeDirection === "up"
      ? ` Gained ${forcedNudgeReward} Nudge +1.`
      : ` Gained ${forcedNudgeReward} Nudge -1.`
    : "";
  const wlAdvanceText = wlAdvancedToLoss ? " WL advanced - now lose the next guess." : "";
  const equals11MissText = equals11WasArmed && !equals11Hit
    ? equals11Resolved
      ? ` Equals 11 missed: ${valueToRank(currentComparisonValue)} + ${valueToRank(nextComparisonValue)} = ${equals11Total}.`
      : " Equals 11 missed."
    : "";
  const higherHigherHigherText = higherHigherHigherBroken
    ? " Higher, Higher, Higher broke."
    : higherHigherHigherRemainingBeforeGuess > 0 && !higherHigherHigherCompleted
      ? ` Higher, Higher, Higher: ${state.higherHigherHigherRemaining} to go.`
      : "";
  const oneLifeLeftText = rescuedByOneLifeLeft
    ? ` One Life Left saved this guess. ${state.oneLifeLeftLives || 0} ${state.oneLifeLeftLives === 1 ? "life" : "lives"} left.`
    : "";
  const killerQueenText = rescuedByKillerQueen
    ? ` Killer Queen saved this guess. ${state.killerQueenLives || 0} ${state.killerQueenLives === 1 ? "save" : "saves"} left.`
    : "";
  const rescueBonusText = `${rescuedByCursedShield ? " Cursed Shield saved this guess." : ""}${rescuedByRedDeadRedemption ? " Red? Dead? Redemption saved this guess." : ""}${rescuedBySuitedAndBooted ? " Suited and Booted saved this guess." : ""}${rescuedByMarginForError ? " Margin For Error saved this guess." : ""}${rescuedByHotOrCold ? " Margin Of Error saved this guess." : ""}${rescuedByStitchInTime ? " A Stitch In Time saved this guess." : ""}${sellYourSoulResult.savedText}${sellYourSoulResult.penaltyText}${oneLifeLeftText}${killerQueenText}${forcedRewardText}${wlAdvanceText}${equals11MissText}${higherHigherHigherText}${refundText}${bingoAwardText}${timedEffectText}`;

  if (state.streak >= getCheatRewardThreshold()) {
    state.streak = 0;
    let pauseMsg = "✅ Correct!";
    if (jokerAutoCorrect) {
      pauseMsg = `✅ Correct! Joker keeps any guess safe - it was ${describeCard(next)}.`;
    } else if (match) {
      pauseMsg = `✅ Correct! Cards match! (${buildComparisonSnippet(prevCard, currentComparisonValue, next, nextComparisonValue)})`;
    } else {
      pauseMsg = `✅ Correct! ${buildComparisonSnippet(prevCard, currentComparisonValue, next, nextComparisonValue)}!`;
    }
    state.message = appendEnergyFeedback(`${pauseMsg}${rescueBonusText}`, revealDistance);
    state.pauseForCheat = true;
    render();
    setTimeout(() => {
      state.pauseForCheat = false;
      offerCheatChoice("streak");
      render();
    }, 1000);
    return;
  }

  if (brucieBonusTriggered) {
    state.pauseForCheat = true;
    state.message = appendEnergyFeedback(`Brucie Bonus! Match hit - choose 1 power.${refundText}${bingoAwardText}`, revealDistance);
    render();
    setTimeout(() => {
      state.pauseForCheat = false;
      const nextReason = state.pendingPowerAwardQueue.shift() || "brucie_bonus";
      offerRewardPowerChoice(nextReason);
      render();
    }, 1000);
    return;
  }

  if (cheatACheaterTriggered) {
    state.pauseForCheat = true;
    state.message = appendEnergyFeedback(`You Can Cheat A Cheater paid out - choose 2 bonus cheats.${refundText}${bingoAwardText}`, revealDistance);
    render();
    setTimeout(() => {
      state.pauseForCheat = false;
      const nextReason = state.pendingCheatAwardQueue.shift() || "cheat_a_cheater";
      offerCheatChoice(nextReason);
      render();
    }, 1000);
    return;
  }

  if (newSuitsResult.completed && newSuitsResult.awardCount > 0) {
    state.pauseForCheat = true;
    state.message = appendEnergyFeedback(`New Suits complete! Choose ${newSuitsResult.awardCount} bonus Cheat${newSuitsResult.awardCount === 1 ? "" : "s"}.${revealBonusText}${bingoAwardText}`, revealDistance);
    render();
    setTimeout(() => {
      state.pauseForCheat = false;
      const nextReason = state.pendingCheatAwardQueue.shift() || "new_suits";
      offerCheatChoice(nextReason);
      render();
    }, 1000);
    return;
  }

  if (jokerAutoCorrect && powerAwards.length > 0) {
    state.message = appendEnergyFeedback(`✅ Correct! Joker keeps any guess safe - it was ${describeCard(next)}. Power gained: ${powerAwards.join(", ")}.`, revealDistance);
    render();
    return;
  }
  if (jokerAutoCorrect) {
    state.message = appendEnergyFeedback(`✅ Correct! Joker keeps any guess safe - it was ${describeCard(next)}.`, revealDistance);
    render();
    return;
  }

  if (cheatSpecial && powerAwards.length > 0) {
    state.message = aceAutoWin
      ? `✅ Correct! Ace counts high and low - power gained: ${powerAwards.join(", ")}.`
      : `✅ Odd One Out! Safe card - power gained: ${powerAwards.join(", ")}.`;
    state.message = appendEnergyFeedback(state.message, revealDistance);
    render();
    return;
  }
  if (cheatSpecial) {
    state.message = aceAutoWin
      ? `✅ Correct! Ace counts high and low - it was ${describeCard(next)}.`
      : `✅ Odd One Out! Safe card - it was ${describeCard(next)}.`;
    state.message = appendEnergyFeedback(state.message, revealDistance);
    render();
    return;
  }
  if (match) {
    state.message = appendEnergyFeedback(`✅ Correct! Cards match! (${buildComparisonSnippet(prevCard, currentComparisonValue, next, nextComparisonValue)})${rescueBonusText}`, revealDistance);
    render();
    return;
  }
  if (lucky7WasArmed) {
    state.message = appendEnergyFeedback(`✅ Correct! Lucky 7 was spent. (${buildComparisonSnippet(prevCard, currentComparisonValue, next, nextComparisonValue)})`, revealDistance);
    render();
    return;
  }
  if (fiveAliveWasArmed) {
    state.message = appendEnergyFeedback(`✅ Correct! Five Alive was spent. (${buildComparisonSnippet(prevCard, currentComparisonValue, next, nextComparisonValue)})`, revealDistance);
    render();
    return;
  }
  if (rescuedBySuitSave && passiveSuitSavePower) {
    state.message = appendEnergyFeedback(`${passiveSuitSavePower.name} saved the run - it was ${describeCard(next)}.${rescueBonusText}`, revealDistance);
    render();
    return;
  }
  if (rescuedByCursedShield) {
    state.message = appendEnergyFeedback(`Cursed Shield saved the run - it was ${describeCard(next)}.${forcedRewardText}`, revealDistance);
    render();
    return;
  }
  if (rescuedByKillerQueen) {
    state.message = appendEnergyFeedback(`Killer Queen saved the run - Lower on Queen revealed ${describeCard(next)}. ${state.killerQueenLives || 0} ${state.killerQueenLives === 1 ? "save" : "saves"} left.${bingoAwardText}`, revealDistance);
    render();
    return;
  }
  if (rescuedByOneLifeLeft) {
    state.message = appendEnergyFeedback(`One Life Left saved the run - it was ${describeCard(next)}. ${state.oneLifeLeftLives || 0} ${state.oneLifeLeftLives === 1 ? "life" : "lives"} left.${bingoAwardText}`, revealDistance);
    render();
    return;
  }
  if (rescuedBySuitedAndBooted) {
    state.message = appendEnergyFeedback(`Suited and Booted saved the run - it was ${describeCard(next)}.${forcedRewardText}`, revealDistance);
    render();
    return;
  }
  if (rescuedByAlwaysBetBlack) {
    state.message = appendEnergyFeedback(`Always Bet On The Black saved the run - it was ${describeCard(next)}.${rescueBonusText}`, revealDistance);
    render();
    return;
  }
  if (rescuedByRedDeadRedemption) {
    state.message = appendEnergyFeedback(`Red? Dead? Redemption saved the run - it was ${describeCard(next)}.${rescueBonusText}`, revealDistance);
    render();
    return;
  }
  if (godSaveKingWasArmed) {
    state.message = appendEnergyFeedback(`✅ Correct! God Save The King was spent. (${buildComparisonSnippet(prevCard, currentComparisonValue, next, nextComparisonValue)})`, revealDistance);
    render();
    return;
  }

  state.message = appendEnergyFeedback(`✅ Correct! ${buildComparisonSnippet(prevCard, currentComparisonValue, next, nextComparisonValue)}!${rescueBonusText}`, revealDistance);
  render();
}
