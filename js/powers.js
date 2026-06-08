const POWERS = [
  {
    id: "balanced_nudges",
    name: "Balanced Nudges",
    description: "Start each run with 4 Nudge +1 charges and 4 Nudge -1 charges.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "updraft",
    name: "Updraft",
    description: "Start each run with 8 Nudge +1 charges.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "downforce",
    name: "Downforce",
    description: "Start each run with 8 Nudge -1 charges.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "quick_fingers",
    name: "Quick Fingers",
    description: "Choose a new Cheat every 2 successful guesses instead of every 3.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "swap_stack",
    name: "Swap Stack",
    description: "Start each run with four Swap Cheats in hand.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "aces_wild",
    name: "Aces Wild",
    description: "Aces count as both high and low, and can be nudged down to King while Kings can be nudged up to Ace.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "lucky_opening",
    name: "Lucky Opening",
    description: "Start each run with four Lucky 7 Cheats in hand.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "tears_before_playtime",
    name: "Tears Before Playtime",
    description: "Start each run with two Tear Corner Cheats in hand.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "cheaters_prosper",
    name: "Cheaters Prosper",
    description: "Every time you play a Cheat, gain 2 Nudge +1 and 2 Nudge -1 charges.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "diamonds_are_forever",
    name: "Diamonds Are Forever",
    description: "Wrong guesses do not end the run while the face-up card is a Diamond.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "all_you_need_is_love",
    name: "All You Need Is Love",
    description: "Wrong guesses do not end the run while the face-up card is a Heart.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "dig_down",
    name: "Dig Down",
    description: "Wrong guesses do not end the run while the face-up card is a Spade.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "club_in_baby",
    name: "Club In Baby",
    description: "Wrong guesses do not end the run while the face-up card is a Club.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "brucie_bonus",
    name: "Brucie Bonus",
    description: "If the revealed next card matches the face-up card, immediately choose an extra Power.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "bingo",
    name: "Bingo",
    description: "Gain 5 Nudge +1 and 5 Nudge -1 when you complete the four corners, your first horizontal row, and your second horizontal row.",
    rarity: "common",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
  {
    id: "locky_7s",
    name: "Locky 7s",
    description: "Gain 10 Nudge +1 and 10 Nudge -1 charges. From then on, any card that is or becomes a 7 locks at 7 and cannot be nudged.",
    rarity: "rare",
    unlockAt: 0,
    weight: 1,
    included: true,
  },
];

const START_POWER_SEED_RULESET = "start-power-v1";

function getPowerName(powerId) {
  const power = POWERS.find((p) => p.id === powerId);
  return power ? power.name : powerId;
}

function getPowerDescription(powerOrId, options = {}) {
  const power = typeof powerOrId === "string" ? getPowerById(powerOrId) : powerOrId;
  if (!power) return "";

  if (power.id === "quick_fingers") {
    const deckKey = normalizeDeckKey(options.deckKey || state?.currentDeckKey || state?.selectedDeckKey || "blue");
    const levelNumber = normalizeLevelNumber(options.levelNumber || state?.currentLevelNumber || state?.selectedLevelNumber || loadSelectedLevel());
    const baseThreshold = getBaseCheatRewardThreshold(deckKey, levelNumber);
    const boostedThreshold = Math.max(1, baseThreshold - 1);
    return `Choose a new Cheat every ${boostedThreshold} successful guesses instead of every ${baseThreshold}.`;
  }

  return power.description || "";
}

function getPowerById(powerId) {
  return POWERS.find((p) => p.id === powerId) || null;
}

function runHasPower(powerId) {
  return state.powers.includes(powerId);
}


function getDeckName(deckKey = state?.currentDeckKey || state?.selectedDeckKey || "blue") {
  const normalizedDeck = normalizeDeckKey(deckKey);
  if (normalizedDeck === "red") return "Red";
  if (normalizedDeck === "green") return "Green";
  if (normalizedDeck === "yellow") return "Yellow";
  if (normalizedDeck === "black") return "Black";
  return "Blue";
}

function getPowerRarityLabel(power) {
  return (power?.rarity || "common").replace(/^\w/, (c) => c.toUpperCase());
}

function getPowerIcon(powerId) {
  switch (powerId) {
    case "balanced_nudges":
      return "±";
    case "updraft":
      return "↑";
    case "downforce":
      return "↓";
    case "quick_fingers":
      return "»";
    case "swap_stack":
      return "⇄";
    case "aces_wild":
      return "A";
    case "lucky_opening":
      return "7";
    case "tears_before_playtime":
      return "T";
    case "cheaters_prosper":
      return "C+";
    case "diamonds_are_forever":
      return "◇";
    case "all_you_need_is_love":
      return "♡";
    case "dig_down":
      return "♠";
    case "club_in_baby":
      return "♣";
    case "brucie_bonus":
      return "+";
    case "bingo":
      return "B";
    case "locky_7s":
      return "7L";
    default:
      return "•";
  }
}

function getPassiveSuitSavePower(card = state?.current) {
  if (!card?.suit) return null;

  if (card.suit === SUITS[2] && runHasPower("diamonds_are_forever")) {
    return getPowerById("diamonds_are_forever");
  }
  if (card.suit === SUITS[1] && runHasPower("all_you_need_is_love")) {
    return getPowerById("all_you_need_is_love");
  }
  if (card.suit === SUITS[0] && runHasPower("dig_down")) {
    return getPowerById("dig_down");
  }
  if (card.suit === SUITS[3] && runHasPower("club_in_baby")) {
    return getPowerById("club_in_baby");
  }

  return null;
}

function isNudgeChargePower(powerId) {
  return powerId === "balanced_nudges" || powerId === "updraft" || powerId === "downforce";
}

function getUnlockedPowerPool(includeAll = false) {
  return POWERS.filter((power) => {
    if (!power.included) return false;
    if (includeAll) return true;
    return (state.metaProgression ?? 0) >= (power.unlockAt ?? 0);
  }).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function getStartPowerOfferSeed(seedString) {
  const normalizedSeed = normalizeSeed(seedString) || "NO-SEED";
  return `${GAME_VERSION}|${START_POWER_SEED_RULESET}|${normalizedSeed}`;
}

function isNudgeStartingPower(power) {
  return ["balanced_nudges", "updraft", "downforce", "locky_7s"].includes(power?.id);
}

function pickPowerOptionFromPool(pool, seeded, rng) {
  if (!pool.length) return null;
  const idx = seeded
    ? Math.floor(rng() * pool.length)
    : Math.floor(Math.random() * pool.length);
  return pool.splice(idx, 1)[0] || null;
}

function getRandomPowerOptions(count = 2, seedString = "", includeAll = false, excludeIds = []) {
  const excluded = new Set((excludeIds || []).filter(Boolean));
  const pool = [...getUnlockedPowerPool(includeAll)].filter((power) => !excluded.has(power.id));
  const options = [];
  const seeded = !!normalizeSeed(seedString);
  const rng = seeded
    ? mulberry32(stringToSeedNumber(getStartPowerOfferSeed(seedString)))
    : null;

  if (count >= 2) {
    const nudgePool = pool.filter(isNudgeStartingPower);
    const nonNudgePool = pool.filter((power) => !isNudgeStartingPower(power));

    if (nudgePool.length > 0 && nonNudgePool.length > 0) {
      const nudgePick = pickPowerOptionFromPool(nudgePool, seeded, rng);
      const nonNudgePick = pickPowerOptionFromPool(nonNudgePool, seeded, rng);

      if (nudgePick) {
        options.push(nudgePick);
      }

      if (nonNudgePick) {
        options.push(nonNudgePick);
      }

      if (options.length > 1) {
        const shouldSwapOrder = seeded ? rng() >= 0.5 : Math.random() >= 0.5;
        if (shouldSwapOrder) {
          options.reverse();
        }
      }

      const pickedIds = new Set(options.map((power) => power.id));
      pool.splice(0, pool.length, ...pool.filter((power) => !pickedIds.has(power.id)));
    }
  }

  while (options.length < count && pool.length > 0) {
    const picked = pickPowerOptionFromPool(pool, seeded, rng);
    if (!picked) break;
    options.push(picked);
  }

  return options;
}

function getTutorialNudgePowerOptions(count = 2, seedString = "") {
  const pool = getUnlockedPowerPool(false).filter(isNudgeStartingPower);
  if (!pool.length) {
    return getRandomPowerOptions(count, seedString, false);
  }

  const options = [];
  const seeded = !!normalizeSeed(seedString);
  const rng = seeded
    ? mulberry32(stringToSeedNumber(getStartPowerOfferSeed(`${seedString}|tutorial-nudge-only`)))
    : null;
  const workingPool = [...pool];

  while (options.length < count && workingPool.length > 0) {
    const picked = pickPowerOptionFromPool(workingPool, seeded, rng);
    if (!picked) break;
    options.push(picked);
  }

  if (options.length < count) {
    const fallback = getRandomPowerOptions(count, seedString, false);
    for (const power of fallback) {
      if (options.length >= count) break;
      if (!options.some((opt) => opt.id === power.id)) {
        options.push(power);
      }
    }
  }

  return options;
}

function getCheatRewardThreshold() {
  const currentDeckKey = normalizeDeckKey(state.currentDeckKey);
  const currentLevelNumber = normalizeLevelNumber(state.currentLevelNumber || DEFAULT_LEVEL_NUMBER);
  const baseThreshold = getBaseCheatRewardThreshold(currentDeckKey, currentLevelNumber);
  return runHasPower("quick_fingers") ? Math.max(1, baseThreshold - 1) : baseThreshold;
}

function getBaseCheatRewardThreshold(deckKey = "blue", levelNumber = DEFAULT_LEVEL_NUMBER) {
  const normalizedDeck = normalizeDeckKey(deckKey);
  const normalizedLevel = normalizeLevelNumber(levelNumber);

  if (normalizedDeck === "blue") {
    if (normalizedLevel >= 4) return 5;
    if (normalizedLevel >= 2) return 4;
    return 3;
  }

  if (normalizedDeck === "black") {
    return 999;
  }

  if (normalizedDeck === "red") {
    return normalizedLevel >= 4 ? 4 : 3;
  }

  return 3;
}

function awardOnCorrectGuessPowers(guessType) {
  const awardedNames = [];

  const normalizedDeck = normalizeDeckKey(state.currentDeckKey);
  if (normalizedDeck === "red") {
    return awardedNames;
  }

  if (runHasPower("nudge_engine")) {
    if (guessType === "higher") {
      state.nudgeUpCharges = (state.nudgeUpCharges || 0) + 1;
      awardedNames.push("Nudge +1");
    }

    if (guessType === "lower") {
      state.nudgeDownCharges = (state.nudgeDownCharges || 0) + 1;
      awardedNames.push("Nudge -1");
    }
  }

  return awardedNames;
}

function awardCheatersProsperCheatUse(didConsume = true) {
  if (!didConsume || !runHasPower("cheaters_prosper")) return "";
  state.nudgeUpCharges = (state.nudgeUpCharges || 0) + 2;
  state.nudgeDownCharges = (state.nudgeDownCharges || 0) + 2;
  return " Cheaters Prosper: gained 2 Nudge +1 and 2 Nudge -1.";
}
