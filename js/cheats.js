const RANGE_CHEAT_DELTA = 3;
const CHEAT_CHOICE_LOCK_MS = 500;

function getNextCardAt(offset = 1) {
  return state.deck[state.index + offset] || null;
}

function isPictureCardValue(value) {
  return value >= 11;
}

function getParityLabel(value) {
  if (value === 0) return "JOKER";
  if (isPictureCardValue(value)) return "PICTURE CARD";
  return value % 2 === 0 ? "EVEN" : "ODD";
}

function getUpcomingCheatValue(offset = 1) {
  const card = getNextCardAt(offset);
  if (!card) return null;
  if (isJokerCard(card)) return 0;
  if (offset === 1 && state.blankSpaceActive && Number.isFinite(getBlankSpaceDisplayValue?.())) {
    return getBlankSpaceDisplayValue();
  }
  const temporaryValue = typeof getTemporaryCardValue === "function"
    ? getTemporaryCardValue(card)
    : null;
  if (Number.isFinite(temporaryValue)) {
    return clampCardValue(temporaryValue);
  }
  const modifier = offset === 1 ? (state.nextCardValueModifier || 0) : 0;
  return clampCardValue(card.value + modifier);
}
function clampCardValue(value) {
  return clamp(value, 1, 13);
}

function scheduleBonusCheatChoices(count, reason, message) {
  const normalizedCount = Math.max(0, Number(count) || 0);
  if (!normalizedCount) return;
  for (let i = 0; i < normalizedCount; i += 1) {
    queueCheatAward(reason);
  }
  state.pauseForCheat = true;
  state.message = message;
  window.setTimeout(() => {
    state.pauseForCheat = false;
    const nextReason = state.pendingCheatAwardQueue.shift() || reason;
    offerCheatChoice(nextReason);
    render();
  }, 900);
}

function pullRemainingRankToTop(rank, label) {
  if (!Array.isArray(state.deck) || !state.current) return "No active deck.";
  const faceDownStart = state.index + 1;
  if (faceDownStart >= state.deck.length) return "No face-down cards left.";

  const faceUp = state.deck.slice(0, faceDownStart);
  const faceDown = state.deck.slice(faceDownStart);
  const pulled = faceDown.filter((card) => !isJokerCard(card) && card.rank === rank);
  if (!pulled.length) return `No face-down ${label}s remain.`;

  const remaining = faceDown.filter((card) => isJokerCard(card) || card.rank !== rank);
  state.deck = [...faceUp, ...pulled, ...remaining];
  return `${pulled.length} face-down ${label}${pulled.length === 1 ? "" : "s"} pulled to the top.`;
}

function dispatchEmergencyServices() {
  if (!Array.isArray(state.deck) || !state.current) return "Emergency Services needs an active deck.";
  const faceDownStart = state.index + 1;
  if (faceDownStart >= state.deck.length) return "Emergency Services found no face-down cards.";

  const faceUp = state.deck.slice(0, faceDownStart);
  const faceDown = state.deck.slice(faceDownStart);
  const pulled = faceDown.filter((card) => !isJokerCard(card) && card.rank === "9");
  if (!pulled.length) return "Emergency Services found no face-down 9s.";

  const remaining = faceDown.filter((card) => isJokerCard(card) || card.rank !== "9");
  state.deck = [...faceUp, ...pulled, ...remaining];
  return `Emergency Services dispatched - ${pulled.length} face-down 9${pulled.length === 1 ? "" : "s"} pulled to the top.`;
}

function enchantBottomFaceDownCard() {
  if (!Array.isArray(state.deck) || !state.current) return "Enchant needs an active deck.";
  const dailyVariantConfig = state.runMode === "daily" && typeof getDailyVariantConfig === "function"
    ? getDailyVariantConfig(state.dailyVariant)
    : null;
  if (dailyVariantConfig?.ignorePermanentCardEffects === true) {
    return "Enchant has no effect in Hard Daily.";
  }
  const faceDownStart = state.index + 1;
  if (faceDownStart >= state.deck.length) return "Enchant found no face-down cards.";

  for (let i = state.deck.length - 1; i >= faceDownStart; i -= 1) {
    const card = state.deck[i];
    if (!card || isJokerCard(card) || getCardBackStatus(card.id).enchanted) continue;
    setCardBackStatus(card.id, { enchanted: true });
    return "Enchant marked the bottom face-down card.";
  }

  return "Enchant found no unenchanted normal face-down cards.";
}

function burnNextFaceDownCard() {
  if (!Array.isArray(state.deck) || !state.current) return "No active deck.";
  const nextIndex = state.index + 1;
  if (nextIndex >= state.deck.length) return "No face-down card to burn.";

  const burnedCard = state.deck.splice(nextIndex, 1)[0];
  state.nextCardValueModifier = 0;
  if (burnedCard?.id && state.temporaryCardValues && typeof state.temporaryCardValues === "object") {
    delete state.temporaryCardValues[burnedCard.id];
  }
  if (state.index >= state.deck.length - 1 && typeof completeRunAfterDeckExhausted === "function") {
    completeRunAfterDeckExhausted("burn_the_next_one");
    return "Burned the final face-down card. Reduced deck cleared.";
  }
  return `Burned the next face-down card. It is gone from this run.`;
}

function findNextFaceDownSuitCard(suit) {
  if (!Array.isArray(state.deck)) return null;
  return state.deck
    .slice(state.index + 1)
    .find((card) => !isJokerCard(card) && card.suit === suit) || null;
}

function getWrongColourLabel(card) {
  if (!card || isJokerCard(card)) return "red or black";
  return getSuitColourLabel(card.suit) === "red" ? "black" : "red";
}

function getWrongParityLabel(card, offset) {
  if (!card || isJokerCard(card)) return "odd or even";
  const value = getUpcomingCheatValue(offset);
  if (!Number.isFinite(value) || value === 0) return "odd or even";
  return value % 2 === 0 ? "odd" : "even";
}

function swapCurrentWithLowestFaceDownSuit(suit, label) {
  if (!Array.isArray(state.deck) || !state.current) return "No active deck.";
  const currentIndex = state.index;
  const targetIndex = state.deck
    .map((card, index) => ({ card, index }))
    .filter(({ card, index }) => index > currentIndex && !isJokerCard(card) && card.suit === suit)
    .sort((a, b) => {
      const valueDelta = (a.card.value || 0) - (b.card.value || 0);
      return valueDelta || a.index - b.index;
    })[0]?.index;

  if (!Number.isFinite(targetIndex)) return `No face-down ${label} remains.`;

  const oldCurrent = state.deck[currentIndex];
  const newCurrent = state.deck[targetIndex];
  state.deck[currentIndex] = newCurrent;
  state.deck[targetIndex] = oldCurrent;
  state.current = newCurrent;
  state.currentValueModifier = 0;
  state.nextCardValueModifier = 0;
  if (typeof resetCurrentTurnNudgeTracking === "function") {
    resetCurrentTurnNudgeTracking();
  }
  unmarkCardSeen(oldCurrent);
  markCardSeen(newCurrent);

  return `Grave Digger swapped current card with the lowest face-down ${label}: ${describeCard(newCurrent)}.`;
}

function isPrimeCardValue(value) {
  return value === 2 || value === 3 || value === 5 || value === 7 || value === 11 || value === 13;
}

function formatAverageValue(total, count) {
  if (!count) return "0";
  const average = total / count;
  if (Number.isInteger(average)) return String(average);
  return average.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
function formatCheatValue(value) {
  if (value === 0) return "0";
  if (!Number.isFinite(value)) return "Joker";
  return valueToRank(value);
}

function formatPeekValue(value) {
  if (value === 0) return "Joker";
  return formatCheatValue(value);
}

function getNextNormalComparisonValues(count) {
  return Array.from({ length: count }, (_, index) => {
    const offset = index + 1;
    const card = getNextCardAt(offset);
    if (!card) return null;
    if (isJokerCard(card)) return 0;
    return getUpcomingCheatValue(offset);
  }).filter((value) => Number.isFinite(value));
}

function isUpcomingCheatJoker(offset = 1) {
  return isJokerCard(getNextCardAt(offset));
}

function hasUpcomingCheatJoker(offsets = []) {
  return offsets.some((offset) => isUpcomingCheatJoker(offset));
}

function getUpcomingCheatRank(offset = 1) {
  const card = getNextCardAt(offset);
  if (!card) return "";
  if (isJokerCard(card)) return "Joker";
  if (offset === 1 && state.blankSpaceActive) {
    return valueToRank(getUpcomingCheatValue(offset));
  }
  return card.rank || "";
}

function getUpcomingCheatSuit(offset = 1) {
  const card = getNextCardAt(offset);
  if (!card) return "";
  if (isJokerCard(card)) return "Joker";
  if (offset === 1 && state.blankSpaceActive) return "";
  return card.suit || "";
}

function formatCardIdentityForCheat(card, offset = 0) {
  if (!card) return "Unknown card";
  if (isJokerCard(card)) return "Joker";
  const value = offset > 0 ? getUpcomingCheatValue(offset) : card.value;
  const suit = offset > 0 ? getUpcomingCheatSuit(offset) : (card.suit || "");
  return `${valueToRank(value)}${suit}`;
}

function getSuitColourLabel(suit = "") {
  return suit === SUITS[1] || suit === SUITS[2] ? "red" : "black";
}

function shuffleCheatFacts(facts, label) {
  const shuffled = [...facts];
  const rng = getCheatDeterministicRng(label);
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[i]];
  }
  return shuffled;
}

function buildLuckyDipFacts(card) {
  if (!card) return [];
  if (isJokerCard(card)) {
    return [
      "The next card is a Joker.",
      "It has no normal suit.",
      "It is neither higher nor lower than 7.",
    ];
  }

  const value = getUpcomingCheatValue(1);
  const rank = getUpcomingCheatRank(1);
  const suit = getUpcomingCheatSuit(1);
  const suitName = SUIT_NAMES[suit] || "unknown suit";
  const currentValue = getCurrentEffectiveValue();
  const remainingRankCount = countUnseenCardsOfRank(rank);
  const relationToCurrent = Number.isFinite(currentValue)
    ? value > currentValue
      ? "higher than the current card"
      : value < currentValue
        ? "lower than the current card"
        : "equal to the current card"
    : "";

  return [
    `Its suit colour is ${getSuitColourLabel(suit)}.`,
    `Its suit is ${suitName}.`,
    value > 7 ? "It is higher than 7." : value < 7 ? "It is lower than 7." : "It is exactly 7.",
    value >= 11 ? "It is a face card." : "It is not a face card.",
    `There ${remainingRankCount === 1 ? "is" : "are"} ${remainingRankCount} ${rank}${remainingRankCount === 1 ? "" : "s"} left face down, including it.`,
    value % 2 === 0 ? "Its value is even." : "Its value is odd.",
    value >= 8 ? "It sits in the top half of the deck values." : "It sits in the bottom half of the deck values.",
    relationToCurrent ? `It is ${relationToCurrent}.` : "",
  ].filter(Boolean);
}

function getCheatDeterministicRng(label) {
  const seedBase = normalizeSeed(state.runSeed || "") || "NO-SEED";
  return mulberry32(stringToSeedNumber(`${GAME_VERSION}|${seedBase}|${state.index}|${label}`));
}

function getNudgeNudgeDelta(baseDelta) {
  if (typeof getActiveNudgeDelta === "function") {
    return getActiveNudgeDelta(baseDelta);
  }
  const nudgeNudgeStacks = Math.max(0, Math.floor(Number(state.nudgeNudgeStacks) || 0));
  const legacyCheatStacks = nudgeNudgeStacks > 0 ? nudgeNudgeStacks : (state.nudgeNudgeArmed ? 1 : 0);
  return baseDelta * (2 ** legacyCheatStacks);
}

function getWeightedRandomIndex(items, getWeight, rng = Math.random) {
  const totalWeight = items.reduce((sum, item) => sum + Math.max(0, getWeight(item)), 0);
  if (totalWeight <= 0) return -1;

  let roll = rng() * totalWeight;
  for (let i = 0; i < items.length; i += 1) {
    roll -= Math.max(0, getWeight(items[i]));
    if (roll <= 0) return i;
  }
  return items.length - 1;
}

function getCheatWeight(cheat) {
  const rarityWeight = CHEAT_RARITY[cheat.rarity] ?? 1;
  const explicitWeight = Number.isFinite(cheat.weight) ? cheat.weight : 1;
  return rarityWeight * explicitWeight;
}

function hasCheatBeenDiscovered(cheatId) {
  return !!state.cheatUnlocks?.[cheatId]?.discovered;
}

function markCheatDiscovered(cheat, source = "random") {
  if (!cheat) return false;
  if (hasCheatBeenDiscovered(cheat.id)) return false;
  if (typeof isDevModeRun === "function" && isDevModeRun()) return false;

  state.cheatUnlocks[cheat.id] = {
    discovered: true,
    discoveredAtMeta: state.metaProgression ?? 0,
    discoverySource: source,
  };

  saveCheatUnlocks(state.cheatUnlocks);

  if (!state.justUnlockedCheatIds.includes(cheat.id)) {
    state.justUnlockedCheatIds.push(cheat.id);
  }

  return true;
}

function markMetaUnlockedCheats() {
  const newlyUnlocked = CHEATS.filter((cheat) => {
    if (!cheat.included) return false;
    if ((state.metaProgression ?? 0) < (cheat.unlockAt ?? 0)) return false;
    if ((cheat.unlockAt ?? 0) <= 0) return false;
    return !hasCheatBeenDiscovered(cheat.id);
  });

  newlyUnlocked.forEach((cheat) => {
    markCheatDiscovered(cheat, "meta");
  });

  return newlyUnlocked;
}

const CHEAT_DESCRIPTIONS = {
  "Above 9?": "Is the next face down card above 9?",
  "5 or Under?": "Is the next face down card 5 or under?",
  "Between 5 and 9?": "Is the value of the next face down card a 5, 6, 7, 8 or 9?",
  "Is it an Ace?": "Reveals whether the very next face down card is an Ace.",
  "Is it a King?": "Reveals whether the next face down card is a King.",
  "Ace ahead?": "Reveals whether at least one Ace appears in the next three face down cards.",
  "King ahead?": "Reveals whether at least one King appears in the next three face down cards.",
  "Number Remaining?": "Reveals how many copies of the next face down card's rank are still left in the deck, including that next card.",
  "Total of Next Two": "Reveals the total of the next two face down cards.",
  "Total of Next Three": "Reveals the total of the next three face down cards.",
  "Total Above 12?": "Reveals whether the next two face down cards total more than 12.",
  "Total Above 20?": "Reveals whether the next two face down cards total more than 20.",
  "Total Under 10?": "Reveals whether the next two face down cards total less than 10.",
  "Total Under 15?": "Reveals whether the next two face down cards total less than 15.",
  "Prime Ahead?": "Reveals whether the next face down card is prime-valued: 2, 3, 5, 7, J = 11, or K = 13.",
  "Product of Next Two": "Reveals the product of the next two face down cards.",
  "Top Half / Bottom Half": "Is the next card below 7 or is it 7 and above?",
  "Face Card Ahead?": "Reveals whether at least one face card (J, Q, or K) appears in the next three face down cards.",
  "What is it Not?": "Reveals two remaining cards that the next face-down card is not.",
  [`Within ±${RANGE_CHEAT_DELTA}?`]: `Is the next card within ${RANGE_CHEAT_DELTA} above or below the current face card?`,
  "One of Next 2 Higher?": "Reveals if at least one of the next two cards is higher than the current card.",
  "One of Next 2 Lower?": "Reveals if at least one of the next two cards is lower than the current card.",
  "Higher of Next Two": "Reveals the highest value of the next two face down cards.",
  "Lower of Next Two": "Reveals the lowest value of the next two face down cards.",
  "Next Card Parity": "Reveals if the next card is odd, even, a face card, or a Joker.",
  "Power Parity": "Reveals the parity of the next three face-down cards in order: odd, even, face, or Joker.",
  "Emergency Services": "Pull all remaining face-down 9s to the top of the face-down deck without changing any other face-down card order.",
  "Chance Higher": "Calculates the probability that one of the remaining cards is higher than the current card.",
  "Chance Lower": "Calculates the probability that one of the remaining cards is lower than the current card.",
  "Nudge +1": "Increases the value of the current face card by one for the next guess.",
  "Nudge -1": "Decreases the value of the current face card by one for the next guess.",
  "Nudge +2": "Increases the value of the current face card by two, stopping at King.",
  "Nudge -2": "Decreases the value of the current face card by two, stopping at Ace.",
  "Need The Nudge": "Swap your stored Nudge +1 and Nudge -1 charge totals.",
  "Nudge, Nudge": "For this turn only, each play doubles Nudge strength while still costing one charge.",
  "+5 Energy": "Energy decks only. Gain 5 Energy instantly.",
  "Next Card Nudge Up": "Temporarily nudges the next face-down card up by 3 for the next guess, stopping at King.",
  "Next Card Nudge Down": "Temporarily nudges the next face-down card down by 3 for the next guess, stopping at Ace.",
  "Halve It": "Can only be used on an even card. Treat the current card as half its value for the next guess.",
  "Double Trouble": "Treat the current card as double its value for the next guess, up to King.",
  "Odd One Out": "For the next card only: if it is odd, you lose. Aces count as odd even under Aces Wild. Otherwise you survive.",
  "Lucky 7": "Can only be used on a 7. Your next wrong guess still counts as correct.",
  "Five Alive": "Can only be used on a 5. Locks the 5 against nudges, and if your next guess is wrong, the run still continues.",
  "Psycho": "For the next three guesses, you cannot use Cheats or Nudges. Survive all three to choose a new Power.",
  "Higher, Higher, Higher": "Choose a new Power if your next three successful guesses are Higher.",
  "Back To Square One": "Treat the current face-up card as an Ace for the next guess.",
  "Flip That Frown": "Can only be used on a 6 or 9. Treat a 6 as a 9, or a 9 as a 6, for the next guess.",
  "King For A Day": "Treat the current face-up card as a King for the next guess.",
  "Reroll": "Immediately choose another Cheat using this run's normal offer size.",
  "9 to 5": "Can only be used on a 9. Treat the current card as a 5 for the next guess.",
  "A Stitch In Time Saves...": "Can only be used on a 9. If your next guess is wrong, the run continues.",
  "Catch-22": "Can only be used on a 2. If the next card is also a 2, choose a new Power.",
  "Sixth Sense": "Can only be used on a 6. Reveals whether the next card is higher, lower, or neither.",
  "6/7": "Use only on an un-nudged 6 or 7, and it must be the first and only cheat played on that card. Nudges then lock. Guess correctly to pick 3 cheats in a row. Guess wrong and you lose.",
  "Twin Peek": "Checks the next five cards and reveals whether any of them match the face-up card's current value.",
  "Run Stopper": "Checks the next five cards and reveals whether at least one Ace or King appears.",
  "Bang Average": "Reveals the exact average value of the next three face down cards.",
  "God Save The King": "Play on any face card. If the next card is a King, the run survives even if your guess is wrong.",
  "Swap": "Swap the current face-up card with the next face-down card.",
  "Banish It": "Send the current face-up card to the back of the deck and turn over the next card without increasing the found count.",
  "Jack Of All Trades": "Can only be used on a Jack. Swap the current Jack with the next face-down card and reveal that new current card.",
  "Fortune Teller": "Reveals the values of the next three face-down cards in a random order.",
  "Lucky Dip": "Reveals one random true fact about the next face-down card.",
  "Split the Difference": "Reveals the value difference between the current card and the next face-down card.",
  "False Shuffle": "Rearranges the next three face-down cards into ascending value order.",
  "The River": "Reveals the values of the next five face-down cards in a random order.",
  "Ladies Night": "Pull all remaining face-down Queens to the top of the face-down deck without changing any other face-down card order.",
  "Blackjack": "Arm this card. If it and the next revealed card total 21, choose a Power.",
  "Roll the Dice": "Seeded roll: gain 1-6 Nudge +1 and the same number of Nudge -1.",
  "Club Sandwich": "Reveal the value of the next face-down Club in the deck.",
  "Diamond Geezer": "Arm this card. If the next revealed card is a Diamond, choose two extra Cheats.",
  "Red Herring": "Play on a Heart or Diamond. Shows false colour and parity facts for the next three cards.",
  "Grave Digger": "Swap the current face-up card with the lowest face-down Spade.",
  "Equals 11": "Arm this card. If it and the next revealed card total 11, choose 3 extra cheats.",
  "WL": "Win your next guess, then lose the one after. If you do, the run survives and you choose 3 extra cheats.",
  "You Can Cheat A Cheater": "After your next three correct guesses, choose two extra Cheats in addition to any normal rewards.",
  "Suits You, Sir": "If the next card is the same suit as the current card, gain 5 Nudge +1 and 5 Nudge -1 charges.",
  "New Suits": "Watch the next four reveals. After the fourth, choose one bonus Cheat for each different suit found.",
  "All In": "Stake all current Nudges. Get the next three guesses correct to win double the staked Nudges back.",
  "Lucky 13": "Arm this card. If the next revealed card is a King, gain 5 Nudge +1 and 5 Nudge -1 charges.",
  "Cursed Shield": "Lose all currently stored nudges now. Gain one shield. Each shield survives one wrong guess.",
  "One Life Left": "Adds one stored life. Each life survives one wrong guess, and multiple lives can be stacked.",
  "Killer Queen": "Adds one stored save. It continues the run when you guess Lower from a Queen value and reveal a King.",
  "The Higher The Better": "Locks this card's value. You must choose Higher on your next guess and gain Nudge +1 charges equal to the card-value difference.",
  "The Lower The Better": "Locks this card's value. You must choose Lower on your next guess and gain Nudge -1 charges equal to the card-value difference.",
  "Suited and Booted": "Survive your next guess regardless of outcome unless the revealed next card matches the current card's suit.",
  "Always Bet On The Black": "For the next card only: if it is a Club or a Spade, the run survives even on a wrong guess.",
  "Red? Dead? Redemption": "For the next guess, a losing guess is saved if the revealed card is a Heart or Diamond.",
  "Margin Of Error": "If your next guess is wrong by 3 or less, the run continues.",
  "Corporate Icebreaker": "Hear two true value-and-suit facts and one believable lie about the next three cards.",
  "Legends Ahead": "Your next Cheat pick offers Legendary Cheats only.",
  "Royal Flush": "Reveals whether the next face-down card is a royal card: 10, J, Q, K, or A.",
  "Sell Your Soul": "Arm this card for the next reveal. Wrong guesses survive; naturally safe guesses discard all held Cheats and Nudges.",
  "Coming Soon": "Reveals whether card 2 is higher, lower, or equal to card 1 in the face-down deck.",
  "Burn The Next One": "Destroy the top face-down card. It leaves the deck without being marked on the grid.",
  "Assemble": "Pull all remaining face-down cards matching the current value to the top of the face-down deck without changing any other face-down card order.",
  "Enchant": "Permanently enchant the bottom face-down card. Later, it jumps to the top and is consumed if it is the only way to save a wrong guess.",
  "The Number Of The Beast": "Pull all remaining face-down 6s to the top of the face-down deck without changing any other face-down card order.",
  "Jackpot": "Pull all remaining face-down 7s to the top of the face-down deck without changing any other face-down card order.",
  "Emergency Cord": "Gain 10 Nudge +1 and 10 Nudge -1, then shuffle two random Yellow Jokers into the face-down deck.",
  "Two's Company": "Mark the next face-down 2 in the deck with a temporary 2 on its back.",
  "Refund": "Arm this card. After your next guess, unnecessary current-card nudges used this turn are returned.",
  "Tear Corner": "Tear off the top left corner of the current face card so it can be recognised in future runs.",
};

const CHEATS = [
  {
    id: "above_9",
    name: "Above 9?",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = peekNext();
      if (!next) return "No next card.";
      const nextValue = getUpcomingCheatValue(1);
      return nextValue > 9 ? "Yes — above 9." : "No — 9 or below.";
    },
  },
  {
    id: "below_5",
    name: "5 or Under?",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = peekNext();
      if (!next) return "No next card.";
      const nextValue = getUpcomingCheatValue(1);
      return nextValue <= 5 ? "Yes - 5 or under." : "No - above 5.";
    },
  },
  {
    id: "mid_range",
    name: "Between 5 and 9?",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = peekNext();
      if (!next) return "No next card.";
      const nextValue = getUpcomingCheatValue(1);
      return nextValue >= 5 && nextValue <= 9 ? "Yes — between 5 and 9." : "No — outside 5–9.";
    },
  },
    {
    id: "is_it_an_ace",
    name: "Is it an Ace?",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      if (!next) return "No next card.";
      if (isJokerCard(next)) return "Joker.";
      return getUpcomingCheatRank(1) === "A" ? "Yes — the next card is an Ace." : "No — the next card is not an Ace.";
    },
  },
  {
    id: "is_it_a_king",
    name: "Is it a King?",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = peekNext();
      if (!next) return "No next card.";
      if (isJokerCard(next)) return "Joker.";
      return getUpcomingCheatRank(1) === "K" ? "Yes — it is a King." : "No — not a King.";
    },
  },
  {
    id: "ace_ahead",
    name: "Ace ahead?",
    rarity: "uncommon",
    weight: 1,
    included: true,
    unlockAt: 2,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const upcoming = [getNextCardAt(1), getNextCardAt(2), getNextCardAt(3)].filter(Boolean);
      if (upcoming.length === 0) return "No next card.";
      const found = upcoming.some((card, index) => getUpcomingCheatRank(index + 1) === "A");
      return found ? "Yes — an Ace is in the next three." : "No — no Ace in the next three.";
    },
  },
  {
    id: "king_ahead",
    name: "King ahead?",
    rarity: "uncommon",
    weight: 1,
    included: true,
    unlockAt: 2,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const upcoming = [getNextCardAt(1), getNextCardAt(2), getNextCardAt(3)].filter(Boolean);
      if (upcoming.length === 0) return "No next card.";
      const found = upcoming.some((card, index) => getUpcomingCheatRank(index + 1) === "K");
      return found ? "Yes — a King is in the next three." : "No — no King in the next three.";
    },
  },
  {
    id: "number_remaining",
    name: "Number Remaining?",
    rarity: "uncommon",
    weight: 1,
    included: false,
    unlockAt: 3,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = peekNext();
      if (!next) return "No next card.";
      if (isJokerCard(next)) return "Joker.";
      const remaining = countUnseenCardsOfRank(getUpcomingCheatRank(1));
      return `${remaining} matching ${remaining === 1 ? "card remains" : "cards remain"} in the deck.`;
    },
  },
  {
    id: "next_two_total",
    name: "Total of Next Two",
    rarity: "uncommon",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      const next2 = getNextCardAt(2);
      if (!next || !next2) return "Not enough cards remaining.";
      const nextValue = getUpcomingCheatValue(1);
      const next2Value = getUpcomingCheatValue(2);
      return `Total = ${nextValue + next2Value}`;
    },
  },
  {
    id: "next_three_total",
    name: "Total of Next Three",
    rarity: "rare",
    weight: 1,
    included: true,
    unlockAt: 6,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      const next2 = getNextCardAt(2);
      const next3 = getNextCardAt(3);
      if (!next || !next2 || !next3) return "Not enough cards remaining.";
      const nextValue = getUpcomingCheatValue(1);
      const next2Value = getUpcomingCheatValue(2);
      const next3Value = getUpcomingCheatValue(3);
      return `Total = ${nextValue + next2Value + next3Value}`;
    },
  },
  {
    id: "total_above_12",
    name: "Total Above 12?",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      const next2 = getNextCardAt(2);
      if (!next || !next2) return "Not enough cards remaining.";
      const nextValue = getUpcomingCheatValue(1);
      const next2Value = getUpcomingCheatValue(2);
      return nextValue + next2Value > 12 ? "Yes — total is above 12." : "No — total is 12 or below.";
    },
  },
  {
    id: "total_above_20",
    name: "Total Above 20?",
    rarity: "uncommon",
    weight: 1,
    included: true,
    unlockAt: 4,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      const next2 = getNextCardAt(2);
      if (!next || !next2) return "Not enough cards remaining.";
      const nextValue = getUpcomingCheatValue(1);
      const next2Value = getUpcomingCheatValue(2);
      return nextValue + next2Value > 20 ? "Yes — total is above 20." : "No — total is 20 or below.";
    },
  },
  {
    id: "total_under_10",
    name: "Total Under 10?",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      const next2 = getNextCardAt(2);
      if (!next || !next2) return "Not enough cards remaining.";
      const nextValue = getUpcomingCheatValue(1);
      const next2Value = getUpcomingCheatValue(2);
      return nextValue + next2Value < 10 ? "Yes — total is under 10." : "No — total is 10 or above.";
    },
  },
  {
    id: "total_under_15",
    name: "Total Under 15?",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 2,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      const next2 = getNextCardAt(2);
      if (!next || !next2) return "Not enough cards remaining.";
      const nextValue = getUpcomingCheatValue(1);
      const next2Value = getUpcomingCheatValue(2);
      return nextValue + next2Value < 15 ? "Yes — total is under 15." : "No — total is 15 or above.";
    },
  },
    {
    id: "prime_ahead",
    name: "Prime Ahead?",
    rarity: "uncommon",
    weight: 1,
    included: false,
    unlockAt: 3,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = peekNext();
      if (!next) return "No next card.";
      const nextValue = getUpcomingCheatValue(1);
      return isPrimeCardValue(nextValue)
        ? "Yes — the next card is prime-valued (2, 3, 5, 7, J = 11, or K = 13)."
        : "No — the next card is not prime-valued.";
    },
  },
  {
    id: "product_of_next_two",
    name: "Product of Next Two",
    rarity: "rare",
    weight: 1,
    included: true,
    unlockAt: 8,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      const next2 = getNextCardAt(2);
      if (!next || !next2) return "Not enough cards remaining.";
      const nextValue = getUpcomingCheatValue(1);
      const next2Value = getUpcomingCheatValue(2);
      return `Product = ${nextValue * next2Value}`;
    },
  },
  {
    id: "top_half_bottom_half",
    name: "Top Half / Bottom Half",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = peekNext();
      if (!next) return "No next card.";
      const nextValue = getUpcomingCheatValue(1);
      return nextValue >= 7 ? "Top half (7+)." : "Bottom half (6 or below).";
    },
  },
  {
    id: "face_card_ahead",
    name: "Face Card Ahead?",
    rarity: "uncommon",
    weight: 1,
    included: true,
    unlockAt: 4,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const upcoming = [getNextCardAt(1), getNextCardAt(2), getNextCardAt(3)].filter(Boolean);
      if (upcoming.length === 0) return "No next card.";
      const found = upcoming.some((card) => card.value >= 11);
      return found
        ? "Yes — a face card is in the next three."
        : "No — no face card in the next three.";
    },
  },
  {
    id: "what_is_it_not",
    name: "What is it Not?",
    rarity: "uncommon",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "stackable",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      if (!next) return "No next card.";
      const candidates = state.deck
        .slice(state.index + 2)
        .filter((card) => !isJokerCard(card));
      if (candidates.length < 2) return "Not enough remaining cards to rule out two.";

      const rng = getCheatDeterministicRng("what_is_it_not");
      const options = [...candidates];
      const ruledOut = [];
      while (ruledOut.length < 2 && options.length > 0) {
        const idx = Math.floor(rng() * options.length);
        ruledOut.push(options.splice(idx, 1)[0]);
      }

      return `The next card is not ${ruledOut.map((card) => formatCardIdentityForCheat(card)).join(" or ")}.`;
    },
  },
  {
    id: "one_of_next_two_higher",
    name: "One of Next 2 Higher?",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const currentVal = getCurrentEffectiveValue();
      const next = getNextCardAt(1);
      const next2 = getNextCardAt(2);
      if (!next || !next2) return "Not enough cards remaining.";
      const nextValue = getUpcomingCheatValue(1);
      const next2Value = getUpcomingCheatValue(2);
      return nextValue > currentVal || next2Value > currentVal
        ? "Yes — at least one is higher."
        : "No — neither is higher.";
    },
  },
  {
    id: "one_of_next_two_lower",
    name: "One of Next 2 Lower?",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const currentVal = getCurrentEffectiveValue();
      const next = getNextCardAt(1);
      const next2 = getNextCardAt(2);
      if (!next || !next2) return "Not enough cards remaining.";
      const nextValue = getUpcomingCheatValue(1);
      const next2Value = getUpcomingCheatValue(2);
      return nextValue < currentVal || next2Value < currentVal
        ? "Yes — at least one is lower."
        : "No — neither is lower.";
    },
  },
  {
    id: "higher_of_next_two",
    name: "Higher of Next Two",
    rarity: "uncommon",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      const next2 = getNextCardAt(2);
      if (!next || !next2) return "Not enough cards remaining.";
      const nextValue = getUpcomingCheatValue(1);
      const next2Value = getUpcomingCheatValue(2);
      return `Higher = ${formatCheatValue(Math.max(nextValue, next2Value))}`;
    },
  },
  {
    id: "lower_of_next_two",
    name: "Lower of Next Two",
    rarity: "uncommon",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      const next2 = getNextCardAt(2);
      if (!next || !next2) return "Not enough cards remaining.";
      const nextValue = getUpcomingCheatValue(1);
      const next2Value = getUpcomingCheatValue(2);
      return `Lower = ${formatCheatValue(Math.min(nextValue, next2Value))}`;
    },
  },
  {
    id: "next_card_parity",
    name: "Next Card Parity",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = peekNext();
      if (!next) return "No next card.";
      const nextValue = getUpcomingCheatValue(1);
      return `Next Card Parity: ${getParityLabel(nextValue)}.`;
    },
  },
  {
    id: "power_parity",
    name: "Power Parity",
    rarity: "rare",
    weight: 0.75,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const upcoming = [1, 2, 3].map((offset) => getNextCardAt(offset)).filter(Boolean);
      if (!upcoming.length) return "No next card.";
      const labels = upcoming.map((card, index) => {
        if (isJokerCard(card)) return "Joker";
        const value = getUpcomingCheatValue(index + 1);
        if (value === 0) return "Joker";
        if (isPictureCardValue(value)) return "face";
        return value % 2 === 0 ? "even" : "odd";
      });
      return `Power Parity: ${labels.join(", ")}.`;
    },
  },
  {
    id: "emergency_services",
    name: "Emergency Services",
    rarity: "rare",
    weight: 0.75,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => dispatchEmergencyServices(),
  },
  {
    id: "chance_higher",
    name: "Chance Higher",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const val = getCurrentEffectiveValue();
      const remaining = state.deck.slice(state.index + 1);
      if (!remaining.length) return "No next card.";
      const values = remaining
        .map((card, index) => getUpcomingCheatValue(index + 1))
        .filter((value) => Number.isFinite(value));
      if (!values.length) return "No next card.";
      const count = values.filter((value) => value > val).length;
      return `${Math.round((count / values.length) * 100)}% higher`;
    },
  },
  {
    id: "chance_lower",
    name: "Chance Lower",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const val = getCurrentEffectiveValue();
      const remaining = state.deck.slice(state.index + 1);
      if (!remaining.length) return "No next card.";
      const values = remaining
        .map((card, index) => getUpcomingCheatValue(index + 1))
        .filter((value) => Number.isFinite(value));
      if (!values.length) return "No next card.";
      const count = values.filter((value) => value < val).length;
      return `${Math.round((count / values.length) * 100)}% lower`;
    },
  },
  {
    id: "nudge_up",
    name: "Nudge +1",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "stackable",
    consumeOnUse: true,
    poolExcludedIfPowerOwned: "nudge_engine",
    use: () => {
      const current = getCurrentEffectiveValue();
      if (state.lockySevensActive && current === 7) {
        return "Locky 7s active - 7s cannot be nudged.";
      }
      if (state.fiveAliveNudgeLocked) {
        return "Five Alive has locked this 5 - it cannot be nudged.";
      }
      const targetValue = getAdjustedCurrentNudgeTarget(getNudgeNudgeDelta(1));
      if (!Number.isFinite(targetValue)) return "No current card.";
      state.currentValueModifier += targetValue - current;
      return `Current card is now treated as ${valueToRank(getCurrentEffectiveValue())} for the next guess.`;
    },
  },
  {
    id: "nudge_down",
    name: "Nudge -1",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "stackable",
    consumeOnUse: true,
    poolExcludedIfPowerOwned: "nudge_engine",
    use: () => {
      const current = getCurrentEffectiveValue();
      if (state.lockySevensActive && current === 7) {
        return "Locky 7s active - 7s cannot be nudged.";
      }
      if (state.fiveAliveNudgeLocked) {
        return "Five Alive has locked this 5 - it cannot be nudged.";
      }
      const targetValue = getAdjustedCurrentNudgeTarget(getNudgeNudgeDelta(-1));
      if (!Number.isFinite(targetValue)) return "No current card.";
      state.currentValueModifier += targetValue - current;
      return `Current card is now treated as ${valueToRank(getCurrentEffectiveValue())} for the next guess.`;
    },
  },
  {
    id: "nudge_up_2",
    name: "Nudge +2",
    rarity: "uncommon",
    weight: 1,
    included: true,
    unlockAt: 5,
    stacking: "stackable",
    consumeOnUse: true,
    poolExcludedIfPowerOwned: "nudge_engine",
    use: () => {
      const current = getCurrentEffectiveValue();
      if (state.lockySevensActive && current === 7) {
        return "Locky 7s active - 7s cannot be nudged.";
      }
      if (state.fiveAliveNudgeLocked) {
        return "Five Alive has locked this 5 - it cannot be nudged.";
      }
      const nextValue = getAdjustedCurrentNudgeTarget(getNudgeNudgeDelta(2));
      if (!Number.isFinite(nextValue)) return "No current card.";
      state.currentValueModifier += nextValue - current;
      return `Current card is now treated as ${valueToRank(getCurrentEffectiveValue())} for the next guess.`;
    },
  },
  {
    id: "nudge_down_2",
    name: "Nudge -2",
    rarity: "uncommon",
    weight: 1,
    included: true,
    unlockAt: 5,
    stacking: "stackable",
    consumeOnUse: true,
    poolExcludedIfPowerOwned: "nudge_engine",
    use: () => {
      const current = getCurrentEffectiveValue();
      if (state.lockySevensActive && current === 7) {
        return "Locky 7s active - 7s cannot be nudged.";
      }
      if (state.fiveAliveNudgeLocked) {
        return "Five Alive has locked this 5 - it cannot be nudged.";
      }
      const nextValue = getAdjustedCurrentNudgeTarget(getNudgeNudgeDelta(-2));
      if (!Number.isFinite(nextValue)) return "No current card.";
      state.currentValueModifier += nextValue - current;
      return `Current card is now treated as ${valueToRank(getCurrentEffectiveValue())} for the next guess.`;
    },
  },
  {
    id: "next_card_nudge_up",
    name: "Next Card Nudge Up",
    rarity: "uncommon",
    weight: 0.8,
    included: true,
    unlockAt: 22,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = peekNext();
      if (!next) return "No next card.";
      if (isJokerCard(next)) return "";
      const currentValue = getUpcomingCheatValue(1);
      const targetValue = getAdjustedNextNudgeTarget(3);
      if (!Number.isFinite(targetValue)) return "No next card.";
      state.nextCardValueModifier = targetValue - currentValue;

      return "Next face-down card nudged up for the next guess.";
    },
  },
  {
    id: "next_card_nudge_down",
    name: "Next Card Nudge Down",
    rarity: "uncommon",
    weight: 0.8,
    included: true,
    unlockAt: 22,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = peekNext();
      if (!next) return "No next card.";
      if (isJokerCard(next)) return "";
      const currentValue = getUpcomingCheatValue(1);
      const targetValue = getAdjustedNextNudgeTarget(-3);
      if (!Number.isFinite(targetValue)) return "No next card.";
      state.nextCardValueModifier = targetValue - currentValue;

      return "Next face-down card nudged down for the next guess.";
    },
  },
  {
    id: "need_the_nudge",
    name: "Need The Nudge",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const upCharges = Math.max(0, Number(state.nudgeUpCharges) || 0);
      const downCharges = Math.max(0, Number(state.nudgeDownCharges) || 0);
      state.nudgeUpCharges = downCharges;
      state.nudgeDownCharges = upCharges;
      return `Need The Nudge swapped stored nudges: +${upCharges}/-${downCharges} became +${downCharges}/-${upCharges}.`;
    },
  },
  {
    id: "nudge_nudge",
    name: "Nudge, Nudge",
    rarity: "uncommon",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "repeatable",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      state.nudgeNudgeStacks = Math.max(0, Math.floor(Number(state.nudgeNudgeStacks) || 0)) + 1;
      state.nudgeNudgeArmed = true;
      const multiplier = 2 ** state.nudgeNudgeStacks;
      return `Nudge, Nudge armed - Nudge strength is x${multiplier} until the next card is revealed.`;
    },
  },
  {
    id: "halve_it",
    name: "Halve It",
    rarity: "uncommon",
    weight: 1,
    included: false,
    unlockAt: 3,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const current = getCurrentEffectiveValue();
      if (current % 2 !== 0) {
        return "Halve It can only be used on an even card.";
      }
      const nextValue = clampCardValue(Math.floor(current / 2));
      state.currentValueModifier += nextValue - current;
      return `Current card is now treated as ${valueToRank(getCurrentEffectiveValue())} for the next guess.`;
    },
  },
  {
    id: "double_trouble",
    name: "Double Trouble",
    rarity: "rare",
    weight: 1,
    included: true,
    unlockAt: 7,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const current = getCurrentEffectiveValue();
      const nextValue = clampCardValue(current * 2);
      state.currentValueModifier += nextValue - current;
      return `Current card is now treated as ${valueToRank(getCurrentEffectiveValue())} for the next guess.`;
    },
  },
  {
    id: "odd_one_out",
    name: "Odd One Out",
    rarity: "rare",
    weight: 1,
    included: true,
    unlockAt: 6,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      state.oddOneOutArmed = true;
      return "Odd One Out armed — if the next face-up card is odd, you lose. Otherwise you survive.";
    },
  },
  {
    id: "lucky_7",
    name: "Lucky 7",
    rarity: "rare",
    weight: 1,
    included: true,
    unlockAt: 8,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const currentVal = getCurrentEffectiveValue();
      if (currentVal !== 7) return "Lucky 7 can only be used on a 7.";
      state.lucky7Armed = true;
      return "Lucky 7 armed — your next guess will count as correct.";
    },
  },
  {
    id: "five_alive",
    name: "Five Alive",
    rarity: "rare",
    weight: 1,
    included: true,
    unlockAt: 9,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const currentVal = getCurrentEffectiveValue();
      if (currentVal !== 5) return "Five Alive can only be used on a 5.";
      state.fiveAliveArmed = true;
      state.fiveAliveNudgeLocked = true;
      return "Five Alive armed - this 5 is locked against nudges, and a wrong next guess will still continue the run.";
      return "Five Alive armed — a wrong next guess will still continue the run.";
    },
  },
  {
    id: "six_seven",
    name: "6/7",
    rarity: "rare",
    weight: 0.8,
    included: true,
    unlockAt: 18,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("6/7 armed"),
    use: () => {
      if (!state.current) return "No current card.";
      if ((state.cheatUsesOnCurrentCard || 0) > 0) {
        return "6/7 must be the first cheat you play on this card.";
      }
      if ((state.currentValueModifier || 0) !== 0) {
        return "6/7 can only be used on an un-nudged 6 or 7.";
      }
      if (state.current.value !== 6 && state.current.value !== 7) {
        return "6/7 can only be used on a 6 or 7.";
      }
      state.sixSevenArmed = true;
      return "6/7 armed — no nudges or other cheats on this card. Guess correctly to choose 3 cheats.";
    },
  },
  {
    id: "higher_higher_higher",
    name: "Higher, Higher, Higher",
    rarity: "rare",
    weight: 0.75,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      state.higherHigherHigherRemaining = 3;
      return "Higher, Higher, Higher armed - make your next 3 successful guesses Higher to choose a Power.";
    },
  },
  {
    id: "psycho",
    name: "Psycho",
    rarity: "rare",
    weight: 0.75,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      if (state.psychoRemaining > 0) return "Psycho is already active.";
      state.psychoRemaining = 3;
      return "Psycho active - no Cheats or Nudges for 3 turns. Survive all 3 to choose a Power.";
    },
  },
  {
    id: "back_to_square_one",
    name: "Back To Square One",
    rarity: "uncommon",
    weight: 0.85,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const current = getCurrentEffectiveValue();
      if (!Number.isFinite(current)) return "Back To Square One needs a normal current card.";
      state.currentValueModifier += 1 - current;
      return "Back To Square One - current card is treated as A for the next guess.";
    },
  },
  {
    id: "flip_that_frown",
    name: "Flip That Frown",
    rarity: "uncommon",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const current = getCurrentEffectiveValue();
      if (current !== 6 && current !== 9) {
        return "Flip That Frown can only be used on a 6 or a 9.";
      }
      const nextValue = current === 6 ? 9 : 6;
      state.currentValueModifier += nextValue - current;
      return `Flip That Frown - current card is treated as ${valueToRank(nextValue)} for the next guess.`;
    },
  },
  {
    id: "king_for_a_day",
    name: "King For A Day",
    rarity: "rare",
    weight: 0.85,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const current = getCurrentEffectiveValue();
      if (!Number.isFinite(current)) return "King For A Day needs a normal current card.";
      state.currentValueModifier += 13 - current;
      return "King For A Day - current card is treated as K for the next guess.";
    },
  },
  {
    id: "reroll",
    name: "Reroll",
    rarity: "uncommon",
    weight: 0.9,
    included: true,
    unlockAt: 0,
    stacking: "repeatable",
    consumeOnUse: true,
    use: () => {
      if (state.pendingCheatOptions?.length || state.pendingPowerOptions?.length) {
        return "Finish the current choice first.";
      }
      state.pauseForCheat = true;
      window.setTimeout(() => {
        state.pauseForCheat = false;
        offerCheatChoice("reroll");
        render();
      }, 0);
      return "Reroll - choose another Cheat.";
    },
  },
  {
    id: "nine_to_five",
    name: "9 to 5",
    rarity: "uncommon",
    weight: 1,
    included: true,
    unlockAt: 40,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const current = getCurrentEffectiveValue();
      if (current !== 9) return "9 to 5 can only be used on a 9.";
      state.currentValueModifier += 5 - current;
      return "9 to 5 - current card is treated as 5 for the next guess.";
    },
  },
  {
    id: "stitch_in_time_saves",
    name: "A Stitch In Time Saves...",
    rarity: "rare",
    weight: 0.8,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("A Stitch In Time Saves... armed"),
    use: () => {
      if (!state.current) return "No current card.";
      const currentVal = getCurrentEffectiveValue();
      if (currentVal !== 9) return "A Stitch In Time Saves... can only be used on a 9.";
      state.stitchInTimeArmed = true;
      return "A Stitch In Time Saves... armed - a wrong next guess will still continue the run.";
    },
  },
  {
    id: "catch_22",
    name: "Catch-22",
    rarity: "rare",
    weight: 0.75,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("Catch-22 armed"),
    use: () => {
      if (!state.current) return "No current card.";
      const currentVal = getCurrentEffectiveValue();
      if (currentVal !== 2) return "Catch-22 can only be used on a 2.";
      const next = getNextCardAt(1);
      if (!next) return "No next card.";
      state.catch22Armed = true;
      return "Catch-22 armed - if the next revealed card is a 2, choose a new Power.";
    },
  },
  {
    id: "sixth_sense",
    name: "Sixth Sense",
    rarity: "uncommon",
    weight: 0.85,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && (result.startsWith("Sixth Sense:") || result === "Sixth Sense sees neither."),
    use: () => {
      if (!state.current) return "No current card.";
      const currentVal = getCurrentEffectiveValue();
      if (currentVal !== 6) return "Sixth Sense can only be used on a 6.";
      const next = getNextCardAt(1);
      if (!next) return "No next card.";
      const nextValue = getUpcomingCheatValue(1);
      if (nextValue > currentVal) return "Sixth Sense: higher.";
      if (nextValue < currentVal) return "Sixth Sense: lower.";
      return "Sixth Sense sees neither.";
    },
  },
  {
    id: "twin_peek",
    name: "Twin Peek",
    rarity: "uncommon",
    weight: 0.9,
    included: true,
    unlockAt: 14,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const currentVal = getCurrentEffectiveValue();
      const upcoming = [1, 2, 3, 4, 5].map((offset) => getNextCardAt(offset)).filter(Boolean);
      if (upcoming.length === 0) return "No next card.";
      const found = upcoming.some((card, index) => getUpcomingCheatValue(index + 1) === currentVal);
      return found ? "Yes — a match to the current value is in the next five." : "No — no match to the current value in the next five.";
    },
  },
  {
    id: "run_stopper",
    name: "Run Stopper",
    rarity: "uncommon",
    weight: 0.85,
    included: true,
    unlockAt: 16,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const upcoming = [1, 2, 3, 4, 5].map((offset) => getNextCardAt(offset)).filter(Boolean);
      if (upcoming.length === 0) return "No next card.";
      const found = upcoming.some((card, index) => {
        const rank = getUpcomingCheatRank(index + 1);
        return rank === "A" || rank === "K";
      });
      return found ? "Yes — an Ace or King is in the next five." : "No — no Ace or King in the next five.";
    },
  },
  {
    id: "bang_average",
    name: "Bang Average",
    rarity: "uncommon",
    weight: 0.8,
    included: false,
    unlockAt: 20,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      const next2 = getNextCardAt(2);
      const next3 = getNextCardAt(3);
      if (!next || !next2 || !next3) return "Not enough cards remaining.";
      const total = getUpcomingCheatValue(1) + getUpcomingCheatValue(2) + getUpcomingCheatValue(3);
      return `Average = ${formatAverageValue(total, 3)}`;
    },
  },
  {
    id: "god_save_the_king",
    name: "God Save The King",
    rarity: "rare",
    weight: 0.75,
    included: true,
    unlockAt: 24,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const currentVal = getCurrentEffectiveValue();
      if (currentVal < 11) return "God Save The King can only be used on a face card.";
      state.godSaveKingArmed = true;
      return "God Save The King armed — if the next card is a King, the run survives even on a wrong guess.";
    },
  },
  {
    id: "jack_of_all_trades",
    name: "Jack Of All Trades",
    rarity: "rare",
    weight: 0.8,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("Jack swapped forward"),
    use: () => {
      if (!state.current) return "No current card.";
      const currentVal = getCurrentEffectiveValue();
      if (currentVal !== 11) return "Jack Of All Trades can only be used on a Jack.";
      const currentIndex = state.index;
      const nextIndex = currentIndex + 1;
      if (nextIndex >= state.deck.length) return "No next card.";

      const oldCurrent = state.deck[currentIndex];
      const oldNext = state.deck[nextIndex];
      state.deck[currentIndex] = oldNext;
      state.deck[nextIndex] = oldCurrent;
      state.current = state.deck[currentIndex];
      state.currentValueModifier = 0;
      markCardSeen(state.current);

      return `Jack swapped forward - current card is now ${describeCard(state.current)}.`;
    },
  },
  {
    id: "fortune_teller",
    name: "Fortune Teller",
    rarity: "uncommon",
    weight: 0.9,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const upcoming = [1, 2, 3].map((offset) => getNextCardAt(offset)).filter(Boolean);
      if (upcoming.length === 0) return "No next card.";
      const values = upcoming.map((card, index) => isJokerCard(card) ? "Joker" : formatCheatValue(getUpcomingCheatValue(index + 1)));
      const rng = getCheatDeterministicRng("fortune_teller");
      for (let i = values.length - 1; i > 0; i -= 1) {
        const swapIndex = Math.floor(rng() * (i + 1));
        const temp = values[i];
        values[i] = values[swapIndex];
        values[swapIndex] = temp;
      }
      return `Fortunes: ${values.join(", ")}`;
    },
  },
  {
    id: "lucky_dip",
    name: "Lucky Dip",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      if (!next) return "No next card.";
      const facts = buildLuckyDipFacts(next);
      if (!facts.length) return "Lucky Dip found nothing useful.";
      return `Lucky Dip: ${shuffleCheatFacts(facts, "lucky_dip")[0]}`;
    },
  },
  {
    id: "split_the_difference",
    name: "Split the Difference",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const next = getNextCardAt(1);
      if (!next) return "No next card.";
      if (isJokerCard(next)) return "Split the Difference: next card is a Joker.";
      const currentValue = getCurrentEffectiveValue();
      const nextValue = getUpcomingCheatValue(1);
      if (!Number.isFinite(currentValue) || !Number.isFinite(nextValue)) return "Split the Difference needs normal card values.";
      const difference = Math.abs(nextValue - currentValue);
      return `Split the Difference: the gap is ${difference}.`;
    },
  },
  {
    id: "false_shuffle",
    name: "False Shuffle",
    rarity: "legendary",
    weight: 0.75,
    included: true,
    unlockAt: 30,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!Array.isArray(state.deck) || !state.current) return "No active deck.";
      const start = state.index + 1;
      const nextThree = state.deck.slice(start, start + 3);
      if (nextThree.length < 3) return "False Shuffle needs three face-down cards.";
      const sorted = [...nextThree].sort((a, b) => {
        const aValue = isJokerCard(a) ? 0 : clampCardValue(a.value);
        const bValue = isJokerCard(b) ? 0 : clampCardValue(b.value);
        return aValue - bValue;
      });
      state.deck.splice(start, 3, ...sorted);
      return "False Shuffle: the next three face-down cards are now in ascending order.";
    },
  },
  {
    id: "the_river",
    name: "The River",
    rarity: "legendary",
    weight: 0.75,
    included: true,
    unlockAt: 30,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const upcoming = [1, 2, 3, 4, 5].map((offset) => getNextCardAt(offset)).filter(Boolean);
      if (upcoming.length < 5) return "The River needs five face-down cards.";
      const values = upcoming.map((card, index) => isJokerCard(card) ? "Joker" : formatCheatValue(getUpcomingCheatValue(index + 1)));
      return `The River: ${shuffleCheatFacts(values, "the_river").join(", ")}`;
    },
  },
  {
    id: "ladies_night",
    name: "Ladies Night",
    rarity: "rare",
    weight: 0.75,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => pullRemainingRankToTop("Q", "Queen"),
  },
  {
    id: "blackjack",
    name: "Blackjack",
    rarity: "uncommon",
    weight: 0.85,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("Blackjack armed"),
    use: () => {
      if (!state.current) return "Blackjack needs a current card.";
      const currentValue = getCurrentEffectiveValue();
      if (!Number.isFinite(currentValue)) return "Blackjack needs a normal current card.";
      if (!getNextCardAt(1)) return "Blackjack needs a next card.";
      state.blackjackArmed = true;
      return "Blackjack armed - it will resolve when the next card is revealed.";
    },
  },
  {
    id: "roll_the_dice",
    name: "Roll the Dice",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "repeatable",
    consumeOnUse: true,
    use: () => {
      const rng = getCheatDeterministicRng("roll_the_dice");
      const roll = 1 + Math.floor(rng() * 6);
      state.nudgeUpCharges = (state.nudgeUpCharges || 0) + roll;
      state.nudgeDownCharges = (state.nudgeDownCharges || 0) + roll;
      return `Roll the Dice rolled ${roll}: gained ${roll} Nudge +1 and ${roll} Nudge -1.`;
    },
  },
  {
    id: "club_sandwich",
    name: "Club Sandwich",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const club = findNextFaceDownSuitCard("♣");
      if (!club) return "Club Sandwich found no face-down Clubs.";
      return `Club Sandwich: next Club is ${valueToRank(club.value)}.`;
    },
  },
  {
    id: "diamond_geezer",
    name: "Diamond Geezer",
    rarity: "uncommon",
    weight: 0.85,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("Diamond Geezer armed"),
    use: () => {
      if (!getNextCardAt(1)) return "Diamond Geezer needs a next card.";
      state.diamondGeezerArmed = true;
      return "Diamond Geezer armed - it will resolve when the next card is revealed.";
    },
  },
  {
    id: "red_herring",
    name: "Red Herring",
    rarity: "rare",
    weight: 0.75,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("Red Herring:"),
    use: () => {
      if (!state.current) return "Red Herring needs a current card.";
      if (state.current.suit !== "♥" && state.current.suit !== "♦") {
        return "Red Herring can only be played on a Heart or Diamond.";
      }
      const upcoming = [1, 2, 3].map((offset) => ({ card: getNextCardAt(offset), offset })).filter((entry) => entry.card);
      if (!upcoming.length) return "No face-down cards left.";
      const lies = upcoming.map(({ card, offset }) =>
        `#${offset}: ${getWrongColourLabel(card)}, ${getWrongParityLabel(card, offset)}`
      );
      return `Red Herring: ${lies.join(" / ")}`;
    },
  },
  {
    id: "grave_digger",
    name: "Grave Digger",
    rarity: "rare",
    weight: 0.75,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => swapCurrentWithLowestFaceDownSuit("♠", "Spade"),
  },
  {
    id: "both_lower",
    name: "Both lower?",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const currentValue = getCurrentEffectiveValue();
      const values = getNextNormalComparisonValues(2);
      if (!Number.isFinite(currentValue) || values.length < 2) return "Both lower needs two face-down cards.";
      const result = values.every((value) => value > 0 && value < currentValue);
      return `Both lower? ${result ? "Yes" : "No"}.`;
    },
  },
  {
    id: "both_higher",
    name: "Both higher",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const currentValue = getCurrentEffectiveValue();
      const values = getNextNormalComparisonValues(2);
      if (!Number.isFinite(currentValue) || values.length < 2) return "Both higher needs two face-down cards.";
      const result = values.every((value) => value > currentValue);
      return `Both higher? ${result ? "Yes" : "No"}.`;
    },
  },
  {
    id: "nine_dart_finish",
    name: "9 Dart Finish",
    rarity: "legendary",
    weight: 0.65,
    included: true,
    unlockAt: 30,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("9 Dart Finish armed"),
    use: () => {
      if (!state.current) return "No current card.";
      if ((Number(state.nineDartRemaining) || 0) > 0 || state.nineDartAutoCorrect) return "9 Dart Finish is already active.";
      if (!getNextCardAt(1)) return "9 Dart Finish needs cards left to reveal.";
      state.nineDartRemaining = 9;
      state.nineDartAutoCorrect = false;
      return "9 Dart Finish armed - no Cheats or Nudges for 9 cards. Get them right and the rest are safe.";
    },
  },
  {
    id: "local_high",
    name: "Local High",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const values = getNextNormalComparisonValues(3);
      if (!values.length) return "Local High needs face-down cards.";
      return `Local High: ${formatPeekValue(Math.max(...values))}.`;
    },
  },
  {
    id: "local_low",
    name: "Local low",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const values = getNextNormalComparisonValues(3);
      if (!values.length) return "Local Low needs face-down cards.";
      return `Local Low: ${formatPeekValue(Math.min(...values))}.`;
    },
  },
  {
    id: "find_the_lady",
    name: "Find The Lady",
    rarity: "uncommon",
    weight: 0.85,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("Find The Lady armed"),
    use: () => {
      if (!state.current) return "No current card.";
      if (!getNextCardAt(1)) return "Find The Lady needs a next card.";
      state.findLadyArmed = true;
      return "Find The Lady armed - if the next revealed card is a Queen, choose a Power.";
    },
  },
  {
    id: "konami_code",
    name: "Konami Code",
    rarity: "rare",
    weight: 0.75,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("Konami Code armed"),
    use: () => {
      if (!state.current) return "No current card.";
      if (!getNextCardAt(1)) return "Konami Code needs cards left to reveal.";
      if ((Number(state.konamiAutoCorrectRemaining) || 0) > 0 || (Array.isArray(state.konamiPatternRemaining) && state.konamiPatternRemaining.length > 0)) return "Konami Code is already active.";
      state.konamiPatternRemaining = ["higher", "higher", "lower", "lower"];
      state.konamiAutoCorrectRemaining = 0;
      return "Konami Code armed - next guesses must be Up, Up, Down, Down to make the following 4 safe.";
    },
  },
  {
    id: "save_scum",
    name: "Save Scum",
    rarity: "legendary",
    weight: 0.65,
    included: true,
    unlockAt: 30,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("Save Scum armed"),
    use: () => {
      if (!state.current) return "No current card.";
      if (state.saveScumArmed || state.saveScumSnapshot) return "Save Scum is already active.";
      state.saveScumArmed = true;
      return "Save Scum armed - your next Game Over rewinds to this point.";
    },
  },
  {
    id: "cryogen",
    name: "Cryogen",
    rarity: "rare",
    weight: 0.75,
    included: true,
    greenOnly: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("Cryogen armed"),
    use: () => {
      if (!isGreenDeckRun()) return "Cryogen only works in Energy deck runs.";
      if ((state.energy || 0) <= 0) return "Cryogen needs positive Energy to freeze.";
      if ((Number(state.cryogenRemaining) || 0) > 0) return "Cryogen is already active.";
      state.cryogenRemaining = 3;
      state.cryogenFrozenEnergy = Math.max(0, Number(state.energy) || 0);
      return `Cryogen armed - Energy frozen at ${state.cryogenFrozenEnergy} for 3 turns.`;
    },
  },
  {
    id: "equals_11",
    name: "Equals 11",
    rarity: "uncommon",
    weight: 0.85,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("Equals 11 armed"),
    use: () => {
      if (!state.current) return "Equals 11 needs a current card.";
      const currentValue = getCurrentEffectiveValue();
      if (!Number.isFinite(currentValue)) {
        return "Equals 11 needs a normal current card.";
      }
      if (!getNextCardAt(1)) {
        return "Equals 11 needs a next card.";
      }
      state.equals11Armed = true;
      return "Equals 11 armed - it will resolve when the next card is revealed.";
    },
  },
  {
    id: "wl",
    name: "WL",
    rarity: "uncommon",
    weight: 0.8,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("WL armed"),
    use: () => {
      if (!getNextCardAt(1)) return "WL needs a next card.";
      if (state.wlStage) return "WL is already active.";
      state.wlStage = "need_win";
      return "WL armed - win the next guess, then lose the one after to survive and choose 3 cheats.";
    },
  },
  {
    id: "you_can_cheat_a_cheater",
    name: "You Can Cheat A Cheater",
    rarity: "rare",
    weight: 0.8,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      state.cheatACheaterRemaining = 3;
      return "You Can Cheat A Cheater armed - choose 2 extra Cheats after your next 3 correct guesses.";
    },
  },
  {
    id: "suits_you_sir",
    name: "Suits You, Sir",
    rarity: "uncommon",
    weight: 0.85,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("Suits You, Sir armed"),
    use: () => {
      if (!state.current) return "No current card.";
      if (!state.current.suit) return "Suits You, Sir needs a suited current card.";
      if (!getNextCardAt(1)) return "Suits You, Sir needs a next card.";
      state.suitsYouSirArmed = true;
      state.suitsYouSirSuit = state.current.suit;
      return "Suits You, Sir armed - it will resolve when the next card is revealed.";
    },
  },
  {
    id: "new_suits",
    name: "New Suits",
    rarity: "uncommon",
    weight: 0.85,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("New Suits armed"),
    use: () => {
      if (!state.current) return "No current card.";
      if (!getNextCardAt(1)) return "New Suits needs at least one face-down card.";
      if ((Number(state.newSuitsRemaining) || 0) > 0) return "New Suits is already active.";
      state.newSuitsRemaining = 4;
      state.newSuitsSeen = {};
      return "New Suits armed - after the next 4 reveals, choose 1 bonus Cheat for each different suit found.";
    },
  },
  {
    id: "all_in",
    name: "All In",
    rarity: "rare",
    weight: 0.75,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("All In armed"),
    use: () => {
      if (!state.current) return "No current card.";
      if ((Number(state.allInRemaining) || 0) > 0) return "All In is already active.";
      const upStake = Math.max(0, Number(state.nudgeUpCharges) || 0);
      const downStake = Math.max(0, Number(state.nudgeDownCharges) || 0);
      if (upStake + downStake <= 0) return "All In needs at least one stored Nudge.";
      state.nudgeUpCharges = 0;
      state.nudgeDownCharges = 0;
      state.allInRemaining = 3;
      state.allInNudgeUpStake = upStake;
      state.allInNudgeDownStake = downStake;
      return `All In armed - staked ${upStake} Nudge Up and ${downStake} Nudge Down. Get 3 correct guesses to win +${upStake * 2}/+${downStake * 2}.`;
    },
  },
  {
    id: "lucky_13",
    name: "Lucky 13",
    rarity: "uncommon",
    weight: 0.85,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("Lucky 13 armed"),
    use: () => {
      if (!state.current) return "No current card.";
      const next = getNextCardAt(1);
      if (!next) return "Lucky 13 needs a next card.";
      state.lucky13Armed = true;
      return "Lucky 13 armed - if the next revealed card is a King, gain 5 Nudge +1 and 5 Nudge -1.";
    },
  },
  {
    id: "cursed_shield",
    name: "Cursed Shield",
    rarity: "rare",
    weight: 0.75,
    included: true,
    unlockAt: 0,
    stacking: "stackable",
    consumeOnUse: true,
    use: () => {
      state.nudgeUpCharges = 0;
      state.nudgeDownCharges = 0;
      state.cursedShieldCharges = Math.max(0, Number(state.cursedShieldCharges) || 0) + 1;
      state.cursedShieldArmed = state.cursedShieldCharges > 0;
      return `Cursed Shield added - ${state.cursedShieldCharges} shield${state.cursedShieldCharges === 1 ? "" : "s"} ready.`;
    },
  },
  {
    id: "one_life_left",
    name: "One Life Left",
    rarity: "rare",
    weight: 0.75,
    included: true,
    unlockAt: 0,
    stacking: "stackable",
    consumeOnUse: true,
    use: () => {
      state.oneLifeLeftLives = Math.max(0, Number(state.oneLifeLeftLives) || 0) + 1;
      return `One Life Left stored - ${state.oneLifeLeftLives} ${state.oneLifeLeftLives === 1 ? "life" : "lives"} left.`;
    },
  },
  {
    id: "killer_queen",
    name: "Killer Queen",
    rarity: "rare",
    weight: 0.8,
    included: true,
    unlockAt: 0,
    stacking: "stackable",
    consumeOnUse: true,
    use: () => {
      state.killerQueenLives = Math.max(0, Number(state.killerQueenLives) || 0) + 1;
      return `Killer Queen stored - ${state.killerQueenLives} ${state.killerQueenLives === 1 ? "save" : "saves"} ready.`;
    },
  },
  {
    id: "higher_the_better",
    name: "The Higher The Better",
    rarity: "rare",
    weight: 0.7,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("The Higher The Better armed"),
    use: () => {
      if (!state.current) return "No current card.";
      state.forcedNextGuess = "higher";
      state.lockCurrentCardForForcedGuess = true;
      return "The Higher The Better armed - card value locked and your next guess must be Higher.";
    },
  },
  {
    id: "lower_the_better",
    name: "The Lower The Better",
    rarity: "rare",
    weight: 0.7,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("The Lower The Better armed"),
    use: () => {
      if (!state.current) return "No current card.";
      state.forcedNextGuess = "lower";
      state.lockCurrentCardForForcedGuess = true;
      return "The Lower The Better armed - card value locked and your next guess must be Lower.";
    },
  },
  {
    id: "suited_and_booted",
    name: "Suited and Booted",
    rarity: "rare",
    weight: 0.75,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      state.suitedAndBootedArmed = true;
      state.suitedAndBootedSuit = state.current.suit || "";
      return `Suited and Booted armed - next guess survives unless the revealed card is ${state.suitedAndBootedSuit}.`;
    },
  },
  {
    id: "always_bet_on_the_black",
    name: "Always Bet On The Black",
    rarity: "rare",
    weight: 0.85,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      state.alwaysBetBlackArmed = true;
      return "Always Bet On The Black armed - if the next card is a Club or Spade, the run survives even on a wrong guess.";
    },
  },
  {
    id: "red_dead_redemption",
    name: "Red? Dead? Redemption",
    rarity: "rare",
    weight: 0.85,
    included: true,
    unlockAt: 30,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      state.redDeadRedemptionArmed = true;
      return "Red? Dead? Redemption armed - if the next card is a Heart or Diamond, a losing guess survives.";
    },
  },
  {
    id: "margin_of_error",
    name: "Margin Of Error",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: false,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("Margin Of Error armed"),
    use: () => {
      if (!state.current) return "No current card.";
      const next = getNextCardAt(1);
      if (!next) return "No next card.";
      if (isJokerCard(next)) return "Joker.";
      state.hotOrColdArmed = true;
      return "Margin Of Error armed - a wrong next guess survives if the values differ by 3 or less.";
    },
  },
  {
    id: "corporate_icebreaker",
    name: "Corporate Icebreaker",
    rarity: "rare",
    weight: 0.8,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const upcoming = [1, 2, 3].map((offset) => getNextCardAt(offset)).filter(Boolean);
      if (upcoming.length < 3) return "Need at least three upcoming cards.";

      const remainingPool = state.deck.slice(state.index + 4);
      if (!remainingPool.length) return "Not enough cards remaining for a believable lie.";

      const rng = getCheatDeterministicRng("corporate_icebreaker");
      const fakeCard = remainingPool[Math.floor(rng() * remainingPool.length)];
      const lieIndex = Math.floor(rng() * upcoming.length);
      const statements = upcoming.map((card, index) =>
        index === lieIndex
          ? formatCardIdentityForCheat(fakeCard)
          : formatCardIdentityForCheat(card, index + 1)
      );

      return `Two truths and one lie: ${statements.join(" / ")}`;
    },
  },
  {
    id: "legends_ahead",
    name: "Legends Ahead",
    rarity: "rare",
    weight: 0.65,
    included: true,
    unlockAt: 30,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      state.legendaryCheatOfferArmed = true;
      return "Legends Ahead armed - your next Cheat pick will offer Legendary Cheats only.";
    },
  },
  {
    id: "royal_flush",
    name: "Royal Flush",
    rarity: "uncommon",
    weight: 0.9,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      if (!next) return "No next card.";
      if (isJokerCard(next)) return "Royal Flush: no, the next card is a Joker.";
      const royalRanks = new Set(["10", "J", "Q", "K", "A"]);
      const rank = getUpcomingCheatRank(1);
      return royalRanks.has(rank)
        ? "Royal Flush: yes, the next card is 10, J, Q, K, or A."
        : "Royal Flush: no, the next card is not 10, J, Q, K, or A.";
    },
  },
  {
    id: "sell_your_soul",
    name: "Sell Your Soul",
    rarity: "legendary",
    weight: 0.75,
    included: true,
    unlockAt: 30,
    stacking: "unique",
    consumeOnUse: true,
    shouldConsumeResult: (result) => typeof result === "string" && result.startsWith("Sell Your Soul armed"),
    use: () => {
      state.sellYourSoulArmed = true;
      return "Sell Your Soul armed - next wrong guess survives, but a safe guess costs all held Cheats and Nudges.";
    },
  },
  {
    id: "coming_soon",
    name: "Coming Soon",
    rarity: "rare",
    weight: 0.8,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      const next = getNextCardAt(1);
      const afterNext = getNextCardAt(2);
      if (!next || !afterNext) return "Need at least two face-down cards.";
      if (isJokerCard(next) || isJokerCard(afterNext)) return "Coming Soon: a Joker is involved.";
      const nextValue = getUpcomingCheatValue(1);
      const afterNextValue = getUpcomingCheatValue(2);
      if (!Number.isFinite(nextValue) || !Number.isFinite(afterNextValue)) return "Coming Soon: unknown.";
      if (afterNextValue > nextValue) return "Coming Soon: card 2 is higher than card 1.";
      if (afterNextValue < nextValue) return "Coming Soon: card 2 is lower than card 1.";
      return "Coming Soon: card 2 equals card 1.";
    },
  },
  {
    id: "burn_the_next_one",
    name: "Burn The Next One",
    rarity: "legendary",
    weight: 0.75,
    included: true,
    unlockAt: 30,
    stacking: "repeatable",
    consumeOnUse: true,
    use: () => burnNextFaceDownCard(),
  },
  {
    id: "assemble",
    name: "Assemble",
    rarity: "legendary",
    weight: 0.75,
    included: true,
    unlockAt: 30,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current || isJokerCard(state.current)) return "Assemble needs a normal current card.";
      const currentValue = getCurrentEffectiveValue();
      if (!Number.isFinite(currentValue)) return "Assemble needs a normal current card value.";
      const rank = valueToRank(currentValue);
      const label = rank;
      return pullRemainingRankToTop(rank, label);
    },
  },
  {
    id: "enchant",
    name: "Enchant",
    rarity: "legendary",
    weight: 0.75,
    included: true,
    unlockAt: 30,
    stacking: "repeatable",
    consumeOnUse: true,
    use: () => enchantBottomFaceDownCard(),
  },
  {
    id: "number_of_the_beast",
    name: "The Number Of The Beast",
    rarity: "legendary",
    weight: 0.75,
    included: true,
    unlockAt: 30,
    stacking: "unique",
    consumeOnUse: true,
    use: () => pullRemainingRankToTop("6", "6"),
  },
  {
    id: "jackpot",
    name: "Jackpot",
    rarity: "legendary",
    weight: 0.75,
    included: true,
    unlockAt: 30,
    stacking: "unique",
    consumeOnUse: true,
    use: () => pullRemainingRankToTop("7", "7"),
  },
  {
    id: "emergency_cord",
    name: "Emergency Cord",
    rarity: "legendary",
    weight: 0.75,
    included: true,
    unlockAt: 30,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!Array.isArray(state.deck) || !state.current) return "No active deck.";
      if (state.index >= state.deck.length - 1) return "No face-down cards left.";

      state.nudgeUpCharges = (state.nudgeUpCharges || 0) + 10;
      state.nudgeDownCharges = (state.nudgeDownCharges || 0) + 10;

      const jokerPool = typeof getYellowJokerPool === "function"
        ? getYellowJokerPool({ includeLocked: true })
        : [];
      if (!jokerPool.length) return "No Yellow Jokers available.";

      const rng = getCheatDeterministicRng("emergency_cord");
      const jokerCount = 2;
      const availableJokers = [...jokerPool];
      for (let i = 0; i < jokerCount; i += 1) {
        if (!availableJokers.length) {
          availableJokers.push(...jokerPool);
        }
        const jokerIndex = Math.floor(rng() * availableJokers.length);
        const jokerTemplate = availableJokers.splice(jokerIndex, 1)[0];
        const jokerCard = typeof createYellowJokerCard === "function"
          ? createYellowJokerCard(
              jokerTemplate,
              `emergency_cord_${state.index}_${i + 1}_${Math.floor(rng() * 1000000)}`,
            )
          : null;
        if (!jokerCard) continue;
        const insertAt = state.index + 1 + Math.floor(rng() * Math.max(1, state.deck.length - state.index));
        state.deck.splice(insertAt, 0, jokerCard);
      }

      return "Emergency Cord pulled - gained 10 Nudge +1 and 10 Nudge -1, but 2 Yellow Jokers entered the face-down deck.";
    },
  },
  {
    id: "twos_company",
    name: "Two's Company",
    rarity: "uncommon",
    weight: 0.9,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!Array.isArray(state.deck) || !state.current) return "No active deck.";
      const target = state.deck
        .slice(state.index + 1)
        .find((card) => !isJokerCard(card) && card.rank === "2");
      if (!target) return "No face-down 2 left in the deck.";

      if (!state.temporaryCardBackMarks || typeof state.temporaryCardBackMarks !== "object") {
        state.temporaryCardBackMarks = {};
      }
      state.temporaryCardBackMarks[target.id] = "2";
      return "Two's Company marked the next face-down 2 for this run.";
    },
  },
  {
    id: "refund",
    name: "Refund",
    rarity: "rare",
    weight: 0.8,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const next = getNextCardAt(1);
      if (!next) return "No next card.";
      if (isJokerCard(next)) return "Joker.";
      state.refundArmed = true;
      return "Refund armed - after your next guess, unnecessary current-card nudges used this turn will be returned.";
    },
  },
  {
    id: "tear_corner",
    name: "Tear Corner",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      setCardBackStatus(state.current.id, { tornCorner: true });
      return `${describeCard(state.current)} now has a torn corner on its back.`;
    },
  },
  {
    id: "banish_it",
    name: "Banish It",
    rarity: "rare",
    weight: 0.8,
    included: true,
    unlockAt: 0,
    stacking: "unique",
    consumeOnUse: true,
    use: () => {
      if (!state.current || !Array.isArray(state.deck)) return "No current card.";
      const currentIndex = state.index;
      const nextIndex = currentIndex + 1;
      if (nextIndex >= state.deck.length) return "No next card.";

      const banishedCard = state.deck[currentIndex];
      const nextCard = state.deck[nextIndex];
      state.deck.splice(currentIndex, 2, nextCard);
      state.deck.push(banishedCard);
      state.current = nextCard;
      state.currentValueModifier = 0;
      state.nextCardValueModifier = 0;
      state.cheatUsesOnCurrentCard = 0;
      if (typeof resetCurrentTurnNudgeTracking === "function") {
        resetCurrentTurnNudgeTracking();
      }
      unmarkCardSeen(banishedCard);
      markCardSeen(nextCard);

      return `Banished ${describeCard(banishedCard)} to the back of the deck - current card is now ${describeCard(nextCard)}.`;
    },
  },
  {
    id: "swap",
    name: "Swap",
    rarity: "common",
    weight: 1,
    included: true,
    unlockAt: 0,
    stacking: "repeatable",
    consumeOnUse: true,
    use: () => {
      if (!state.current) return "No current card.";
      const currentIndex = state.index;
      const nextIndex = currentIndex + 1;

      if (nextIndex >= state.deck.length) {
        return "No next card.";
      }

      const oldCurrent = state.deck[currentIndex];
      const oldNext = state.deck[nextIndex];

      state.deck[currentIndex] = oldNext;
      state.deck[nextIndex] = oldCurrent;

      state.current = state.deck[currentIndex];
      state.currentValueModifier = 0;
      state.nextCardValueModifier = 0;
      if (typeof resetCurrentTurnNudgeTracking === "function") {
        resetCurrentTurnNudgeTracking();
      }
      markCardSeen(state.current);

      return `Swapped with next card - current card is now ${describeCard(state.current)}.`;
    },
  },
  {
    id: "green_energy_boost",
    name: "+5 Energy",
    rarity: "common",
    weight: 1,
    included: true,
    greenOnly: true,
    unlockAt: 0,
    stacking: "repeatable",
    consumeOnUse: true,
    use: () => {
      if (!isGreenDeckRun()) return "This cheat only works in Energy deck runs.";
      state.energy = Math.max(0, (state.energy || 0) + 5);
      return `+5 Energy applied. Energy is now ${state.energy}.`;
    },
  },
];

function canAddCheatToHand(cheatDef) {
  if (!cheatDef.included) return false;
  if (cheatDef.stacking === "stackable" || cheatDef.stacking === "repeatable") {
    return true;
  }
  return !state.cheats.some((c) => c.id === cheatDef.id);
}

function getEligibleCheatPool(includeAll = false) {
  const ownedStartPowerId = state.selectedStartPowerId;
  const greenRun = isGreenDeckRun();

  return CHEATS.filter((c) => {
    if (!c.included) return false;
    if (c.id === "green_energy_boost") return false; // injected separately for controlled Green frequency
    if (c.greenOnly && !greenRun) return false;
    if (!includeAll && (state.metaProgression ?? 0) < (c.unlockAt ?? 0)) return false;

    if (c.poolExcludedIfPowerOwned && c.poolExcludedIfPowerOwned === ownedStartPowerId) {
      return false;
    }

    if (
      c.stacking !== "stackable" &&
      c.stacking !== "repeatable" &&
      state.cheats.some((held) => held.id === c.id)
    ) {
      return false;
    }

    return true;
  }).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function maybeInjectGreenEnergyCheatOption(options, count, rngFn = Math.random) {
  if (!isGreenDeckRun()) return options;
  if ((rngFn?.() ?? Math.random()) > (2 / 3)) return options;

  const energyCheat = CHEATS.find((cheat) => cheat.id === "green_energy_boost");
  if (!energyCheat) return options;
  if (options.some((option) => option.id === energyCheat.id)) return options;

  const injected = { ...energyCheat };
  if (options.length < count) {
    options.push(injected);
    return options;
  }

  const replaceIndex = Math.max(0, Math.floor((rngFn?.() ?? Math.random()) * Math.max(1, options.length)));
  options[replaceIndex] = injected;
  return options;
}

function getDailyCheatOfferSeed(offerIndex) {
  return `${state.runSeed}|daily-cheat-offer-v1|${offerIndex}`;
}

function getCheatOfferOptionCount() {
  if (state.runMode === "daily") return 3;
  const currentDeckKey = normalizeDeckKey(state.currentDeckKey || state.selectedDeckKey || "blue");
  const currentLevelNumber = normalizeLevelNumber(state.currentLevelNumber || state.selectedLevelNumber || loadSelectedLevel());
  return (currentDeckKey === "blue" || currentDeckKey === "orange") && currentLevelNumber >= 3 ? 2 : 3;
}

function getRandomCheatOptions(count = 3, seedString = "", includeAll = false) {
  const pool = [...getEligibleCheatPool(includeAll)];
  const options = [];
  const seeded = !!normalizeSeed(seedString);
  const rng = seeded
    ? mulberry32(stringToSeedNumber(`${GAME_VERSION}|${seedString}`))
    : null;

  while (options.length < count && pool.length > 0) {
    const idx = getWeightedRandomIndex(pool, getCheatWeight, seeded ? rng : Math.random);
    if (idx < 0) break;
    options.push(pool.splice(idx, 1)[0]);
  }

  maybeInjectGreenEnergyCheatOption(options, count, seeded ? rng : Math.random);
  return options;
}

function getLegendaryCheatOptions(count = 3, seedString = "", includeAll = false) {
  const pool = [...getEligibleCheatPool(includeAll)].filter((cheat) => (cheat.rarity || "common") === "legendary");
  const options = [];
  const seeded = !!normalizeSeed(seedString);
  const rng = seeded
    ? mulberry32(stringToSeedNumber(`${GAME_VERSION}|legendary-only|${seedString}`))
    : null;

  const getLegendaryWeight = (cheat) => {
    const explicitWeight = Number.isFinite(cheat.weight) ? cheat.weight : 1;
    return Math.max(0.01, explicitWeight);
  };

  while (options.length < count && pool.length > 0) {
    const idx = getWeightedRandomIndex(pool, getLegendaryWeight, seeded ? rng : Math.random);
    if (idx < 0) break;
    options.push(pool.splice(idx, 1)[0]);
  }

  return options;
}

function getTutorialCheatOptions(count = 2, seedString = "", includeAll = false) {
  const disallowed = new Set(["nudge_up", "nudge_down", "green_energy_boost"]);
  const pool = [...getEligibleCheatPool(includeAll)].filter((cheat) => !disallowed.has(cheat.id));
  const options = [];
  const seeded = !!normalizeSeed(seedString);
  const rng = seeded
    ? mulberry32(stringToSeedNumber(`${GAME_VERSION}|${seedString}`))
    : null;

  while (options.length < count && pool.length > 0) {
    const idx = getWeightedRandomIndex(pool, getCheatWeight, seeded ? rng : Math.random);
    if (idx < 0) break;
    options.push(pool.splice(idx, 1)[0]);
  }

  return options;
}

function offerCheatChoice(reason = "") {
  const isDailyRun = state.runMode === "daily";
  const tutorialOfferActive = typeof window.isTutorialCheatOfferActive === "function" && window.isTutorialCheatOfferActive();
  const optionCount = tutorialOfferActive ? 2 : (isDailyRun ? 3 : getCheatOfferOptionCount());
  const newlyMetaUnlocked = isDailyRun ? [] : markMetaUnlockedCheats();
  const legendaryOfferArmed = !!state.legendaryCheatOfferArmed && !tutorialOfferActive;
  state.pauseForCheat = false; // Ensure pause is cleared before showing cheat selection
  state.activeCheatAwardReason = reason || "";

  if (legendaryOfferArmed) {
    const offerIndex = isDailyRun ? (state.dailyCheatOfferCount || 0) + 1 : 0;
    const seed = isDailyRun ? getDailyCheatOfferSeed(offerIndex) : `${state.runSeed}|legendary-cheat-offer|${state.correctAnswers || 0}|${state.index || 0}`;
    state.pendingCheatOptions = getLegendaryCheatOptions(optionCount, seed, isDailyRun);
    if (!state.pendingCheatOptions.length) {
      state.pendingCheatOptions = getRandomCheatOptions(optionCount, seed, isDailyRun);
    }
    state.legendaryCheatOfferArmed = false;
    if (isDailyRun) {
      state.dailyCheatOfferCount = offerIndex;
    }
  } else if (tutorialOfferActive) {
    const offerIndex = (state.dailyCheatOfferCount || 0) + 1;
    const tutorialSeed = isDailyRun ? getDailyCheatOfferSeed(offerIndex) : "";
    state.pendingCheatOptions = getTutorialCheatOptions(optionCount, tutorialSeed, isDailyRun);
    if (isDailyRun) {
      state.dailyCheatOfferCount = offerIndex;
    }
  } else if (isDailyRun) {
    const offerIndex = (state.dailyCheatOfferCount || 0) + 1;
    state.pendingCheatOptions = getRandomCheatOptions(optionCount, getDailyCheatOfferSeed(offerIndex), true);
    state.dailyCheatOfferCount = offerIndex;
  } else {
    state.pendingCheatOptions = getRandomCheatOptions(optionCount);
  }

  if (typeof recordItemsOffered === "function") {
    recordItemsOffered("cheat", state.pendingCheatOptions);
  }

  state.cheatChoiceLockedUntil = Date.now() + CHEAT_CHOICE_LOCK_MS;
  state.cheatChoiceIntroToken = (state.cheatChoiceIntroToken || 0) + 1;
  state.cheatChoicePreviewIndex = -1;
  state.cheatChoiceAnimating = null;

  if ((state.sixSevenRewardChoicesRemaining || 0) > 0) {
    state.message = "";
  } else if (state.activeCheatAwardReason === "brucie_bonus") {
    state.message = "";
  } else if (state.activeCheatAwardReason === "cheat_a_cheater") {
    state.message = "";
  } else if (state.activeCheatAwardReason === "equals_11") {
    state.message = "";
  } else if (state.activeCheatAwardReason === "wl") {
    state.message = "";
  } else if (newlyMetaUnlocked.length) {
    state.message = `Unlocked: ${newlyMetaUnlocked.map((c) => c.name).join(", ")}`;
  } else {
    state.message = "";
  }

  appendRunDebugLog("cheat_offer_presented", {
    awardReason: state.activeCheatAwardReason || ((state.sixSevenRewardChoicesRemaining || 0) > 0 ? "six_seven_bonus" : "streak"),
    optionCount,
    legendaryOnly: legendaryOfferArmed && state.pendingCheatOptions.every((option) => (option.rarity || "common") === "legendary"),
    options: state.pendingCheatOptions.map((option) => ({
      id: option.id,
      name: option.name,
      rarity: option.rarity || "common",
    })),
    newlyUnlockedCheatIds: newlyMetaUnlocked.map((cheat) => cheat.id),
    message: state.message,
  });

  render();
}

function runDeferredCheatChoiceFollowup(followup) {
  if (!followup || followup.type === "render") {
    render();
    return;
  }

  if (followup.type === "six_seven_next") {
    offerCheatChoice();
    return;
  }

  if (followup.type === "queued_cheat") {
    if ((state.pendingCheatAwardQueue || []).length > 0 && state.pendingCheatAwardQueue[0] === followup.reason) {
      state.pendingCheatAwardQueue.shift();
    }
    offerCheatChoice(followup.reason);
    return;
  }

  if (followup.type === "resolve_rewards") {
    if (typeof resolvePendingRewardQueues === "function" && resolvePendingRewardQueues()) {
      return;
    }
    render();
    return;
  }

  render();
}

function pickCheatFromChoice(index, options = {}) {
  if (Date.now() < (state.cheatChoiceLockedUntil || 0)) return;
  if (typeof window.isTutorialBlockingCheatChoice === "function" && window.isTutorialBlockingCheatChoice()) {
    state.message = "Choose a cheat when the tutorial asks you to.";
    render();
    return;
  }

  const deferFollowup = !!options.deferFollowup;
  const suppressRender = !!options.suppressRender;

  const cheat = state.pendingCheatOptions[index];
  if (!cheat) return;

  const shouldTrackDiscovery = !(typeof isDevModeRun === "function" && isDevModeRun());
  const wasNew = shouldTrackDiscovery && !hasCheatBeenDiscovered(cheat.id);

  if (wasNew) {
    markCheatDiscovered(cheat, "random");
  }

  let selectionOutcome = "already_in_hand";
  let addedToHand = false;
  let bankedNudgeDirection = "";
  let bankedEnergyAmount = 0;
  const setCheatSelectionMessage = (message) => {
    if (typeof setTemporaryMessage === "function") {
      setTemporaryMessage(message);
      return;
    }
    state.message = message;
  };

  if (cheat.id === "nudge_up") {
    state.nudgeUpCharges = (state.nudgeUpCharges || 0) + 1;
    setCheatSelectionMessage(`${cheat.name} added`);
    selectionOutcome = "banked_nudge";
    bankedNudgeDirection = "up";
  } else if (cheat.id === "nudge_down") {
    state.nudgeDownCharges = (state.nudgeDownCharges || 0) + 1;
    setCheatSelectionMessage(`${cheat.name} added`);
    selectionOutcome = "banked_nudge";
    bankedNudgeDirection = "down";
  } else if (cheat.id === "green_energy_boost") {
    state.energy = Math.max(0, (state.energy || 0) + 5);
    setCheatSelectionMessage(`${cheat.name} added`);
    selectionOutcome = "banked_energy";
    bankedEnergyAmount = 5;
  } else if (canAddCheatToHand(cheat)) {
    state.cheats.push({ ...cheat });

    setCheatSelectionMessage(`${cheat.name} added`);
    selectionOutcome = "added_to_hand";
    addedToHand = true;
  } else {
    setCheatSelectionMessage(`${cheat.name} already in hand.`);
  }

  appendRunDebugLog("cheat_selected", {
    awardReason: state.activeCheatAwardReason || ((state.sixSevenRewardChoicesRemaining || 0) > 0 ? "six_seven_bonus" : "streak"),
    selectedIndex: index,
    cheatId: cheat.id,
    cheatName: cheat.name,
    wasNew,
    selectionOutcome,
    addedToHand,
    bankedNudgeDirection,
    bankedEnergyAmount,
    pendingOptionsBeforePick: state.pendingCheatOptions.map((option) => ({
      id: option.id,
      name: option.name,
      rarity: option.rarity || "common",
    })),
    cheatsInHandAfterPick: state.cheats.map((heldCheat) => heldCheat.id),
    nudgeUpCharges: state.nudgeUpCharges || 0,
    nudgeDownCharges: state.nudgeDownCharges || 0,
    legendaryCheatOfferArmed: !!state.legendaryCheatOfferArmed,
    message: state.message,
  });

  if (typeof recordItemUsageStat === "function") {
    recordItemUsageStat("cheat", cheat.id, "picked");
  }

  state.pendingCheatOptions = [];
  state.justUnlockedCheatIds = [];
  state.cheatChoiceLockedUntil = 0;
  state.cheatChoicePreviewIndex = -1;
  state.activeCheatAwardReason = "";
  if (typeof window.handleTutorialCheatPicked === "function") {
    window.handleTutorialCheatPicked(cheat);
  }

  let followup = { type: "render" };
  if ((state.sixSevenRewardChoicesRemaining || 0) > 0) {
    state.sixSevenRewardChoicesRemaining -= 1;
    if (state.sixSevenRewardChoicesRemaining > 0) {
      followup = { type: "six_seven_next" };
      if (deferFollowup) {
        return { cheat, targetEntryId: cheat.id, followup };
      }
      runDeferredCheatChoiceFollowup(followup);
      return;
    }
  }
  if ((state.pendingCheatAwardQueue || []).length > 0) {
    const nextReason = state.pendingCheatAwardQueue[0];
    followup = { type: "queued_cheat", reason: nextReason };
    if (deferFollowup) {
      return { cheat, targetEntryId: cheat.id, followup };
    }
    runDeferredCheatChoiceFollowup(followup);
    return;
  }
  if (deferFollowup) {
    followup = { type: "resolve_rewards" };
    return { cheat, targetEntryId: cheat.id, followup };
  }
  if (typeof resolvePendingRewardQueues === "function" && resolvePendingRewardQueues()) {
    return;
  }
  if (!suppressRender) {
    render();
  }
}
