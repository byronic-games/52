function getDeckBackColor(deckKey) {
  const normalizedDeck = normalizeDeckKey(deckKey || "blue");
  if (normalizedDeck === "red") return "pink";
  if (normalizedDeck === "orange") return "orange";
  if (normalizedDeck === "green") return "green";
  if (normalizedDeck === "yellow") return "yellow";
  if (normalizedDeck === "black") return "black";
  return "blue";
}

let revealAnimationResetTimer = null;
let revealGameOverTimer = null;
let messageExpiryTimer = null;
let messageFadeTimer = null;
let cheatChoiceAnimationTimer = null;
let powerChoiceAnimationTimer = null;
let powerChoiceAnimationFrame = 0;
let preservePowerChoiceFlyoutUntilShellSync = false;
let powerChoiceFlyoutHomeParent = null;
let powerChoiceFlyoutHomeNextSibling = null;
let experienceBankingStartTimer = null;
let experienceBankingAnimationFrame = null;
let experiencePreviewResetTimer = null;
let suppressNextCheatEntryIntroId = "";
let lastRenderedCheatCounts = new Map();
let cheatChoiceConfirmIndex = -1;
let cheatChoiceConfirmAfter = 0;
let cheatUseLockedUntil = 0;
const CHEAT_CHOICE_CLOSE_MS = 126;
const CHEAT_CHOICE_FLY_MS = 270;
const POWER_CHOICE_CLOSE_MS = 162;
const POWER_CHOICE_FLY_MS = 288;
const CHEAT_CHOICE_CONFIRM_BUFFER_MS = 405;
const CHEAT_USE_BUFFER_MS = 378;
const REVEAL_FLIP_MS = 378;
const REVEAL_HOLD_MS = 144;
const REVEAL_SLIDE_MS = 360;
const REVEAL_FAILURE_HOLD_MS = 162;
const EXPERIENCE_BANKING_BEAT_MS = 430;
const EXPERIENCE_CARD_STAGGER_MS = 82;
const EXPERIENCE_CARD_FLIGHT_MS = 560;
const EXPERIENCE_DECK_CLEAR_BONUS = 100;
const EXPERIENCE_UNUSED_CHEAT_BONUS = 20;
const EXPERIENCE_UNUSED_CHEAT_STAGGER_MS = 250;
const EXPERIENCE_CARD_MILESTONES = Object.freeze([
  { count: 13, bonus: 10 },
  { count: 26, bonus: 25 },
  { count: 39, bonus: 50 },
]);
const POWER_SHIELD_SVG = `
  <svg class="power-shield-svg" viewBox="0 0 100 128" aria-hidden="true" focusable="false">
    <path class="power-shield-fill" d="M50 121 C24 110 10 82 9 41 L9 18 C31 13 69 13 91 18 L91 41 C90 82 76 110 50 121 Z"></path>
  </svg>
`;

function clearPendingRevealTimers() {
  if (revealAnimationResetTimer) {
    clearTimeout(revealAnimationResetTimer);
    revealAnimationResetTimer = null;
  }
  if (revealGameOverTimer) {
    clearTimeout(revealGameOverTimer);
    revealGameOverTimer = null;
  }
}

function clearPendingCheatChoiceTimer() {
  if (cheatChoiceAnimationTimer) {
    clearTimeout(cheatChoiceAnimationTimer);
    cheatChoiceAnimationTimer = null;
  }
}

function clearPendingPowerChoiceTimer() {
  if (powerChoiceAnimationTimer) {
    clearTimeout(powerChoiceAnimationTimer);
    powerChoiceAnimationTimer = null;
  }
  if (powerChoiceAnimationFrame) {
    cancelAnimationFrame(powerChoiceAnimationFrame);
    powerChoiceAnimationFrame = 0;
  }
}

function canUseHoverTooltips() {
  return window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches === true;
}

function sanitizeRevealEffectId(effectId) {
  return String(effectId || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function getRevealEffectClass(effectId) {
  const safeId = sanitizeRevealEffectId(effectId);
  return safeId ? `reveal-effect-${safeId}` : "";
}

function removeRevealStateClasses(el) {
  if (!el) return;
  const effectClasses = Array.from(el.classList).filter((name) => name.startsWith("reveal-effect-"));
  if (effectClasses.length) {
    el.classList.remove(...effectClasses);
  }
  el.classList.remove(
    "reveal-flip",
    "reveal-flip-out",
    "reveal-flip-in",
    "reveal-flip-180",
    "reveal-promote",
    "reveal-settle",
    "reveal-fail",
    "reveal-slide-over"
  );
  el.style.removeProperty("--reveal-slide-x");
  el.style.removeProperty("--reveal-slide-y");
}

function getPreservedTutorialFocusClass(el) {
  return el?.classList?.contains("tutorial-focus-target") ? " tutorial-focus-target" : "";
}

function setRevealOverlayHidden(hidden) {
  const overlayEl = document.getElementById("reveal-overlay");
  if (!overlayEl) return;
  overlayEl.classList.toggle("hidden", !!hidden);
  overlayEl.setAttribute("aria-hidden", hidden ? "true" : "false");
  if (hidden) {
    overlayEl.innerHTML = "";
  }
}

function renderRevealOverlayCard(pending, showFace) {
  const overlayEl = document.getElementById("reveal-overlay");
  if (!overlayEl || !pending?.revealCard) return null;

  const revealCard = pending.revealCard;
  const revealStatus = getCardBackStatus(revealCard.id);
  const storedTemporaryValue = typeof getTemporaryCardValue === "function"
    ? getTemporaryCardValue(revealCard)
    : null;
  const revealValue = Number.isFinite(pending.revealEffectiveValue)
    ? pending.revealEffectiveValue
    : Number.isFinite(storedTemporaryValue)
      ? storedTemporaryValue
      : revealCard.value;
  const revealIsTemp = !!pending.revealIsTemp || Number.isFinite(storedTemporaryValue);
  const revealIsEnchanted = !!revealStatus.enchanted || state.recentEnchantedRevealCardId === revealCard.id;
  const revealBackColor = getDeckBackColor(state.currentDeckKey || state.selectedDeckKey);

  overlayEl.innerHTML = "";
  if (showFace) {
    overlayEl.className = `reveal-overlay card-face ${isJokerCard(revealCard) ? "joker-card-face" : (isRed(revealCard) ? "red" : "black")} ${revealStatus.tornCorner ? "torn-corner-face" : ""} ${revealIsEnchanted ? "enchanted-card-face" : ""} ${revealIsTemp ? "temporary-value" : ""}`.trim();
    overlayEl.innerHTML = renderCardFaceMarkup(
      revealCard,
      revealValue,
      revealIsTemp,
      revealStatus.tornCorner,
      { isEnchanted: revealIsEnchanted }
    );
  } else {
    overlayEl.className = `reveal-overlay card-back card-back-${revealBackColor} ${revealStatus.tornCorner ? "torn-corner" : ""}`.trim();
    applyCardBackCosmeticToElement(overlayEl);
    overlayEl.innerHTML = `<div class="card-back-symbol">&#127136;</div>`;
    const temporaryMark = state.temporaryCardBackMarks?.[revealCard.id] || "";
    if (temporaryMark) {
      const mark = document.createElement("div");
      mark.className = "temporary-card-back-mark";
      mark.innerText = temporaryMark;
      overlayEl.appendChild(mark);
    }
    if (revealStatus.tornCorner) {
      const tear = document.createElement("div");
      tear.className = "tear-mark-back";
      overlayEl.appendChild(tear);
    }
  }

  overlayEl.classList.remove("hidden");
  overlayEl.setAttribute("aria-hidden", "false");
  return overlayEl;
}

function finalizePendingReveal(pending) {
  const currentCardEl = document.getElementById("current-card");
  const faceDownDeckEl = document.getElementById("face-down-deck");
  const overlayEl = document.getElementById("reveal-overlay");
  removeRevealStateClasses(currentCardEl);
  removeRevealStateClasses(faceDownDeckEl);
  removeRevealStateClasses(overlayEl);
  setRevealOverlayHidden(true);

  if (pending.outcome === "correct") {
    if (pending.initialDeal && pending.revealCard) {
      state.current = pending.revealCard;
      const dealtIndex = Array.isArray(state.deck)
        ? state.deck.findIndex((card) => card?.id === pending.revealCard?.id)
        : -1;
      state.index = dealtIndex >= 0 ? dealtIndex : 0;
    }
    markCardSeen(pending.revealCard);
    if (state.seenCardIds instanceof Set) {
      awardExperienceMilestonesForFoundCount(state.seenCardIds.size);
    }
  }

  if (pending.triggerGameOver && state.gameOver) {
    state.gameOverDisplayCards = {
      leftCard: pending.fromCard || null,
      leftEffectiveValue: Number.isFinite(pending.fromEffectiveValue) ? pending.fromEffectiveValue : pending.fromCard?.value ?? null,
      leftIsTemp: !!pending.fromIsTemp,
      rightCard: pending.revealCard || null,
      rightEffectiveValue: Number.isFinite(pending.revealEffectiveValue) ? pending.revealEffectiveValue : pending.revealCard?.value ?? null,
      rightIsTemp: !!pending.revealIsTemp,
    };
  } else {
    state.gameOverDisplayCards = null;
    const feedbackEffect = pending.feedbackEffect || pending.outcome;
    if (feedbackEffect === "correct" || feedbackEffect === "wrong") {
      if (typeof setCurrentCardFeedback === "function") setCurrentCardFeedback(feedbackEffect);
      if (feedbackEffect === "wrong" && typeof flashGameShell === "function") {
        flashGameShell(feedbackEffect);
      }
    }
  }

  if (pending.clearSuitedAndBootedOnFinalize) {
    state.suitedAndBootedArmed = false;
    state.suitedAndBootedSuit = "";
  }

  if (state.pendingRevealAnimation && state.pendingRevealAnimation.id === pending.id) {
    state.pendingRevealAnimation = null;
  }

  if (pending.initialDeal && state.powerChoiceRevealPending && typeof revealPowerChoiceAfterOpeningDeal === "function") {
    revealPowerChoiceAfterOpeningDeal();
  }

  if (pending.triggerGameOver && state.gameOver) {
    clearGameOverEffects();
    revealGameOverTimer = setTimeout(() => {
      triggerGameOverEffect(pending.gameOverDetail || "");
      revealGameOverTimer = null;
    }, 40);
  }

  render();
}

function setRevealSlideOffset(revealingDeckEl, currentCardEl) {
  if (!revealingDeckEl || !currentCardEl) return;

  const revealRect = revealingDeckEl.getBoundingClientRect();
  const currentRect = currentCardEl.getBoundingClientRect();
  const deltaX = currentRect.left - revealRect.left;
  const deltaY = currentRect.top - revealRect.top;

  revealingDeckEl.style.setProperty("--reveal-slide-x", `${Math.round(deltaX)}px`);
  revealingDeckEl.style.setProperty("--reveal-slide-y", `${Math.round(deltaY)}px`);
}

function playPendingCardRevealAnimation() {
  const pending = state.pendingRevealAnimation;
  if (!pending) return;

  const currentCardEl = document.getElementById("current-card");
  const faceDownDeckEl = document.getElementById("face-down-deck");
  const overlayEl = document.getElementById("reveal-overlay");
  if (!currentCardEl || !faceDownDeckEl || !overlayEl) return;
  const effectClass = getRevealEffectClass(pending.effectId);

  if (pending.phase === "revealing") {
    if (pending.started) return;

    pending.started = true;
    pending.revealSwapDone = false;
    clearPendingRevealTimers();
    clearGameOverEffects();
    removeRevealStateClasses(currentCardEl);
    removeRevealStateClasses(faceDownDeckEl);
    removeRevealStateClasses(overlayEl);
    const halfFlipMs = Math.max(1, Math.floor(REVEAL_FLIP_MS / 2));
    const revealingOverlayEl = renderRevealOverlayCard(pending, false);
    if (!revealingOverlayEl) return;
    revealingOverlayEl.style.animation = "none";
    void revealingOverlayEl.offsetWidth;
    revealingOverlayEl.style.animation = "";
    revealingOverlayEl.classList.add("reveal-flip-out");
    if (effectClass) revealingOverlayEl.classList.add(effectClass);

    revealAnimationResetTimer = setTimeout(() => {
      revealAnimationResetTimer = null;
      if (!state.pendingRevealAnimation || state.pendingRevealAnimation.id !== pending.id) return;
      state.pendingRevealAnimation.revealSwapDone = true;
      const flipInOverlayEl = renderRevealOverlayCard(pending, true);
      if (flipInOverlayEl) {
        removeRevealStateClasses(flipInOverlayEl);
        flipInOverlayEl.style.animation = "none";
        void flipInOverlayEl.offsetWidth;
        flipInOverlayEl.style.animation = "";
        flipInOverlayEl.classList.add("reveal-flip-in");
        if (effectClass) flipInOverlayEl.classList.add(effectClass);
      }

      revealAnimationResetTimer = setTimeout(() => {
        revealAnimationResetTimer = null;
        if (!state.pendingRevealAnimation || state.pendingRevealAnimation.id !== pending.id) return;
        state.pendingRevealAnimation.phase = pending.outcome === "correct" ? "sliding" : "finishing";
        state.pendingRevealAnimation.messageReleased = true;
        state.pendingRevealAnimation.messageJustReleased = true;
        state.pendingRevealAnimation.started = false;
        render();
      }, halfFlipMs + REVEAL_HOLD_MS);
    }, halfFlipMs);
    return;
  }

  if (pending.phase === "sliding") {
    if (pending.started) return;

    pending.started = true;
    clearPendingRevealTimers();
    removeRevealStateClasses(overlayEl);
    const slidingDeckEl = renderRevealOverlayCard(pending, true);
    const slidingCurrentEl = document.getElementById("current-card");
    if (!slidingDeckEl || !slidingCurrentEl) return;
    setRevealSlideOffset(slidingDeckEl, slidingCurrentEl);
    slidingDeckEl.style.animation = "none";
    void slidingDeckEl.offsetWidth;
    slidingDeckEl.style.animation = "";
    slidingDeckEl.classList.add("reveal-slide-over");
    if (effectClass) slidingDeckEl.classList.add(effectClass);

    revealAnimationResetTimer = setTimeout(() => {
      revealAnimationResetTimer = null;
      if (!state.pendingRevealAnimation || state.pendingRevealAnimation.id !== pending.id) return;
      finalizePendingReveal(pending);
    }, REVEAL_SLIDE_MS + 30);
    return;
  }

  if (pending.phase !== "finishing" || pending.started) return;

  pending.started = true;
  clearPendingRevealTimers();
  removeRevealStateClasses(overlayEl);
  const finishingOverlayEl = renderRevealOverlayCard(pending, true);
  if (effectClass) {
    finishingOverlayEl?.classList.add(effectClass);
  }

  revealAnimationResetTimer = setTimeout(() => {
    revealAnimationResetTimer = null;
    if (!state.pendingRevealAnimation || state.pendingRevealAnimation.id !== pending.id) return;
    finalizePendingReveal(pending);
  }, REVEAL_FAILURE_HOLD_MS);
}

function getStoredExperienceValue() {
  if (Number.isFinite(Number(state.experience))) {
    return Math.max(0, Math.floor(Number(state.experience)));
  }
  return typeof loadExperience === "function" ? loadExperience() : 0;
}

function getDisplayedExperienceValue() {
  if (state.experienceBanking && Number.isFinite(Number(state.displayExperience))) {
    return Math.max(0, Math.floor(Number(state.displayExperience)));
  }
  if (
    Number.isFinite(Number(state.experiencePreviewUntil)) &&
    Date.now() < Number(state.experiencePreviewUntil) &&
    Number.isFinite(Number(state.displayExperience))
  ) {
    return Math.max(0, Math.floor(Number(state.displayExperience)));
  }
  return getStoredExperienceValue();
}

function getExperienceCounterTarget() {
  const shellEl = document.getElementById("top-experience-value");
  if (shellEl) {
    return {
      el: shellEl,
      wrap: shellEl.closest(".app-xp") || shellEl,
      hideWhenDisabled: false,
    };
  }

  const xpEl = document.getElementById("experience-value");
  return {
    el: xpEl,
    wrap: document.getElementById("header-experience"),
    hideWhenDisabled: true,
  };
}

function renderExperienceCounter(pop = false) {
  const { el: xpEl, wrap: xpWrap, hideWhenDisabled } = getExperienceCounterTarget();
  if (!xpEl || !xpWrap) return;

  const enabled = typeof loadExperienceDisplayEnabled !== "function" || loadExperienceDisplayEnabled();
  if (hideWhenDisabled) {
    xpWrap.hidden = !enabled;
    xpWrap.setAttribute("aria-hidden", enabled ? "false" : "true");
  }
  state.experience = typeof loadExperience === "function" ? loadExperience() : getStoredExperienceValue();
  if (!enabled) {
    xpWrap.classList.remove("xp-pop");
    setAnimatedText(xpEl, state.experience);
    return;
  }

  setAnimatedText(xpEl, getDisplayedExperienceValue());
  if (pop) {
    xpWrap.classList.remove("xp-pop");
    void xpWrap.offsetWidth;
    xpWrap.classList.add("xp-pop");
  }
}

function clearExperienceBankingTimers() {
  if (experienceBankingStartTimer) {
    clearTimeout(experienceBankingStartTimer);
    experienceBankingStartTimer = null;
  }
  if (experienceBankingAnimationFrame) {
    cancelAnimationFrame(experienceBankingAnimationFrame);
    experienceBankingAnimationFrame = null;
  }
  if (experiencePreviewResetTimer) {
    clearTimeout(experiencePreviewResetTimer);
    experiencePreviewResetTimer = null;
  }
}

function getRunExperienceReward() {
  const foundCount = state.seenCardIds instanceof Set ? state.seenCardIds.size : 0;
  const scoreCount = typeof getRunScoreFromCorrectAnswers === "function"
    ? getRunScoreFromCorrectAnswers(state.correctAnswers)
    : 0;
  return Math.min(52, Math.max(foundCount, scoreCount));
}

function getDeckCompletionExperienceBonus() {
  const deckLength = Array.isArray(state.deck) ? state.deck.length : 0;
  if (!state.gameOver || deckLength <= 0) return 0;
  const requiredCorrectAnswers = Math.max(0, deckLength - 1);
  return (Number(state.correctAnswers) || 0) >= requiredCorrectAnswers
    ? EXPERIENCE_DECK_CLEAR_BONUS
    : 0;
}

function finishExperienceBanking(banking, pop = false) {
  const isPreview = !!banking?.preview;
  state.displayExperience = banking.finalValue;
  state.experience = isPreview ? getStoredExperienceValue() : banking.finalValue;
  state.experienceBanking = null;
  state.experienceBankedCardIds = new Set();

  if (isPreview) {
    state.experiencePreviewUntil = Date.now() + 1600;
    renderExperienceCounter(pop);
    window.setTimeout(flushPendingExperienceBonusesIfReady, 120);
    experiencePreviewResetTimer = setTimeout(() => {
      experiencePreviewResetTimer = null;
      if (Date.now() < Number(state.experiencePreviewUntil || 0)) return;
      state.displayExperience = null;
      state.experiencePreviewUntil = 0;
      renderExperienceCounter(false);
    }, 1620);
    return;
  }

  if (banking?.persistOnFinish && typeof saveExperience === "function") {
    state.displayExperience = saveExperience(banking.finalValue);
    state.experience = state.displayExperience;
  }

  state.experiencePreviewUntil = 0;
  renderExperienceCounter(pop);
  window.setTimeout(flushPendingExperienceBonusesIfReady, 120);
}

function getExperienceMilestoneSet() {
  if (state.experienceMilestonesAwarded instanceof Set) return state.experienceMilestonesAwarded;
  state.experienceMilestonesAwarded = new Set(Array.isArray(state.experienceMilestonesAwarded) ? state.experienceMilestonesAwarded : []);
  return state.experienceMilestonesAwarded;
}

function experienceBonusIsBlockedByChoiceFlow() {
  return !!(
    state.pauseForCheat ||
    state.cheatChoiceAnimating ||
    state.powerChoiceAnimating ||
    (Array.isArray(state.pendingCheatOptions) && state.pendingCheatOptions.length > 0) ||
    (Array.isArray(state.pendingPowerOptions) && state.pendingPowerOptions.length > 0)
  );
}

function queueExperienceBonus(amount, options = {}) {
  if (!Array.isArray(state.pendingExperienceBonuses)) {
    state.pendingExperienceBonuses = [];
  }
  state.pendingExperienceBonuses.push({
    amount: Math.max(0, Math.floor(Number(amount) || 0)),
    type: options.type || "milestone_bonus",
    animate: options.animate !== false,
    allowDevPreview: !!options.allowDevPreview,
    persist: options.persist !== false,
    sourceCheatIds: Array.isArray(options.sourceCheatIds) ? options.sourceCheatIds : [],
    unitValue: Math.max(1, Math.floor(Number(options.unitValue) || 1)),
  });
}

function flushPendingExperienceBonusesIfReady() {
  if (!Array.isArray(state.pendingExperienceBonuses) || state.pendingExperienceBonuses.length === 0) return false;
  if (experienceBonusIsBlockedByChoiceFlow() || state.experienceBanking) return false;

  const nextBonus = state.pendingExperienceBonuses.shift();
  awardExperienceBonus(nextBonus.amount, nextBonus);
  return true;
}

function awardOrQueueExperienceBonus(amount, options = {}) {
  if (experienceBonusIsBlockedByChoiceFlow() || state.experienceBanking) {
    queueExperienceBonus(amount, options);
    return true;
  }
  return awardExperienceBonus(amount, options);
}

function awardExperienceBonus(amount, options = {}) {
  const bonus = Math.max(0, Math.floor(Number(amount) || 0));
  if (bonus <= 0) return false;

  const devPreview = !!options.allowDevPreview && typeof isDevModeRun === "function" && isDevModeRun();
  if (typeof isDevModeRun === "function" && isDevModeRun() && !devPreview) return false;

  if (experiencePreviewResetTimer) {
    clearTimeout(experiencePreviewResetTimer);
    experiencePreviewResetTimer = null;
  }

  if (state.experienceBanking) {
    completeExperienceBankingAnimation({ fade: false });
  }

  const startValue = typeof loadExperience === "function" ? loadExperience() : getStoredExperienceValue();
  const finalValue = startValue + bonus;
  const displayEnabled = typeof loadExperienceDisplayEnabled !== "function" || loadExperienceDisplayEnabled();
  const shouldPersist = options.persist !== false && !devPreview;

  if (!displayEnabled || options.animate === false) {
    if (shouldPersist && typeof saveExperience === "function") {
      state.experience = saveExperience(finalValue);
    } else {
      state.experience = getStoredExperienceValue();
    }
    state.displayExperience = null;
    state.experienceBanking = null;
    state.experiencePreviewUntil = 0;
    renderExperienceCounter(false);
    window.setTimeout(flushPendingExperienceBonusesIfReady, 80);
    return true;
  }

  state.displayExperience = startValue;
  state.experienceBanking = {
    type: options.type || "milestone_bonus",
    active: true,
    gained: bonus,
    startValue,
    finalValue,
    delivered: 0,
    launched: 0,
    cards: [],
    startedAt: 0,
    preview: !shouldPersist,
    persistOnFinish: shouldPersist,
    sourceCheatIds: Array.isArray(options.sourceCheatIds) ? options.sourceCheatIds : [],
    unitValue: Math.max(1, Math.floor(Number(options.unitValue) || 1)),
  };
  renderExperienceCounter(false);
  startExperienceBankingAnimation();
  return true;
}

function awardUnusedCheatExperienceForRunEnd() {
  if (state.unusedCheatExperienceAwarded) return false;
  if (getDeckCompletionExperienceBonus() <= 0) return false;
  const cheatIds = Array.isArray(state.cheats)
    ? state.cheats
        .map((cheat) => cheat?.id)
        .filter((id) => id && id !== "nudge_up" && id !== "nudge_down")
    : [];
  if (!cheatIds.length) return false;

  state.unusedCheatExperienceAwarded = true;
  return awardOrQueueExperienceBonus(cheatIds.length * EXPERIENCE_UNUSED_CHEAT_BONUS, {
    type: "unused_cheats_bonus",
    animate: true,
    allowDevPreview: true,
    persist: !(typeof isDevModeRun === "function" && isDevModeRun()),
    sourceCheatIds: cheatIds,
    unitValue: EXPERIENCE_UNUSED_CHEAT_BONUS,
  });
}

function awardExperienceMilestonesForFoundCount(foundCount) {
  const count = Math.max(0, Math.floor(Number(foundCount) || 0));
  if (count <= 0) return;

  const awarded = getExperienceMilestoneSet();
  EXPERIENCE_CARD_MILESTONES.forEach((milestone) => {
    const milestoneKey = String(milestone.count);
    if (count < milestone.count || awarded.has(milestoneKey)) return;
    awarded.add(milestoneKey);
    awardOrQueueExperienceBonus(milestone.bonus, {
      type: "milestone_bonus",
      animate: true,
      allowDevPreview: true,
      persist: !(typeof isDevModeRun === "function" && isDevModeRun()),
    });
  });
}

function completeExperienceBankingAnimation(options = {}) {
  const banking = state.experienceBanking;
  const hadPendingStart = !!experienceBankingStartTimer;
  clearExperienceBankingTimers();
  if (!banking && hadPendingStart && state.gameOver && !state.experienceAwardedForRun) {
    awardExperienceForCurrentRun({ animate: false, pulse: false });
    return true;
  }
  if (!banking) return false;

  finishExperienceBanking(banking, false);

  const clones = Array.from(document.querySelectorAll(".xp-fly-card, .xp-bonus-fly, .xp-cheat-fly"));
  clones.forEach((clone) => {
    if (options.fade !== false) {
      clone.classList.add("is-fading");
      window.setTimeout(() => clone.remove(), 170);
    } else {
      clone.remove();
    }
  });
  return true;
}

function awardExperienceForCurrentRun(options = {}) {
  const devPreview = !!options.allowDevPreview && typeof isDevModeRun === "function" && isDevModeRun();
  if (state.experienceAwardedForRun || (typeof isDevModeRun === "function" && isDevModeRun() && !devPreview)) return false;

  const runReward = getRunExperienceReward();
  const completionBonus = getDeckCompletionExperienceBonus();
  const gained = runReward + completionBonus;
  if (gained <= 0) return false;

  const startValue = typeof loadExperience === "function" ? loadExperience() : getStoredExperienceValue();
  const shouldPersist = options.persist !== false && !devPreview;
  const finalValue = shouldPersist && typeof saveExperience === "function"
    ? saveExperience(startValue + gained)
    : startValue + gained;

  state.experienceAwardedForRun = true;
  state.experience = finalValue;

  const displayEnabled = typeof loadExperienceDisplayEnabled !== "function" || loadExperienceDisplayEnabled();
  if (displayEnabled && options.animateCompletionBonus && completionBonus > 0) {
    state.displayExperience = finalValue - completionBonus;
    state.experienceBanking = {
      type: "completion_bonus",
      active: true,
      gained: completionBonus,
      startValue: finalValue - completionBonus,
      finalValue,
      delivered: 0,
      launched: 0,
      cards: [],
      startedAt: 0,
      preview: !shouldPersist,
    };
    awardUnusedCheatExperienceForRunEnd();
    renderExperienceCounter(false);
    startExperienceBankingAnimation();
    return true;
  }

  if (!options.animate) {
    state.displayExperience = finalValue;
    state.experienceBanking = null;
    state.experienceBankedCardIds = new Set();
    renderExperienceCounter(!!options.pulse);
    awardUnusedCheatExperienceForRunEnd();
    return true;
  }

  state.displayExperience = startValue;
  state.experienceBanking = {
    active: true,
    gained,
    startValue,
    finalValue,
    delivered: 0,
    launched: 0,
    cards: [],
    startedAt: 0,
    preview: !shouldPersist,
  };
  awardUnusedCheatExperienceForRunEnd();
  renderExperienceCounter(false);
  if (options.delayStart) {
    experienceBankingStartTimer = setTimeout(() => {
      experienceBankingStartTimer = null;
      startExperienceBankingAnimation();
    }, EXPERIENCE_BANKING_BEAT_MS);
    return true;
  }
  startExperienceBankingAnimation();
  return true;
}

function scheduleExperienceBankingAfterGameOver() {
  if (state.experienceBanking) return;
  clearExperienceBankingTimers();
  if (state.experienceAwardedForRun || !state.gameOver) return;
  if (typeof loadExperienceDisplayEnabled === "function" && !loadExperienceDisplayEnabled()) {
    awardExperienceForCurrentRun({ animate: false, pulse: false });
    return;
  }
  awardExperienceForCurrentRun({ animate: true, delayStart: true });
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function startCompletionBonusExperienceAnimation(banking, targetX, targetY) {
  const statsEl = document.getElementById("seen-grid-stats");
  const sourceRect = statsEl?.getBoundingClientRect();
  if (!sourceRect?.width || !sourceRect?.height) {
    completeExperienceBankingAnimation({ fade: false });
    return;
  }

  const startX = sourceRect.left + sourceRect.width / 2;
  const startY = sourceRect.top + sourceRect.height / 2;
  const marker = document.createElement("div");
  marker.className = "xp-bonus-fly";
  marker.textContent = `+${banking.gained}`;
  marker.style.transform = `translate3d(${startX}px, ${startY}px, 0) translate(-50%, -50%) scale(0.72)`;
  marker.style.opacity = "0";
  document.body.appendChild(marker);

  banking.startedAt = performance.now();
  const duration = 760;
  const midpointX = (startX + targetX) / 2 + 28;
  const midpointY = (startY + targetY) / 2 - 76;

  const tick = (timestamp) => {
    const activeBanking = state.experienceBanking;
    if (!activeBanking || activeBanking !== banking) {
      marker.remove();
      experienceBankingAnimationFrame = null;
      return;
    }

    const progress = Math.min(1, (timestamp - banking.startedAt) / duration);
    const eased = easeInOutSine(progress);
    const inverse = 1 - eased;
    const centerX =
      (inverse * inverse * startX) +
      (2 * inverse * eased * midpointX) +
      (eased * eased * targetX);
    const centerY =
      (inverse * inverse * startY) +
      (2 * inverse * eased * midpointY) +
      (eased * eased * targetY);
    const scale = 0.72 + Math.sin(Math.PI * eased) * 0.22 - eased * 0.12;
    marker.style.opacity = String(progress < 0.08 ? progress / 0.08 : Math.max(0.18, 1 - eased * 0.08));
    marker.style.transform = `translate3d(${centerX}px, ${centerY}px, 0) translate(-50%, -50%) scale(${scale})`;

    if (progress >= 1) {
      marker.remove();
      banking.delivered = banking.gained;
      state.displayExperience = banking.finalValue;
      finishExperienceBanking(banking, true);
      experienceBankingAnimationFrame = null;
      return;
    }

    experienceBankingAnimationFrame = requestAnimationFrame(tick);
  };

  experienceBankingAnimationFrame = requestAnimationFrame(tick);
}

function getCheatBonusSourceRect(cheatId) {
  const escapedId = typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(String(cheatId || ""))
    : String(cheatId || "").replaceAll('"', '\\"');
  const sourceEl = document.querySelector(`#cheat-list [data-cheat-entry-id="${escapedId}"]`);
  const sourceRect = sourceEl?.getBoundingClientRect();
  if (sourceRect?.width && sourceRect?.height) {
    return { sourceEl, sourceRect };
  }

  const fallbackEl = document.getElementById("cheat-list") || document.getElementById("seen-grid-stats");
  const fallbackRect = fallbackEl?.getBoundingClientRect();
  if (fallbackRect?.width && fallbackRect?.height) {
    return { sourceEl: fallbackEl, sourceRect: fallbackRect };
  }

  return { sourceEl: null, sourceRect: null };
}

function startUnusedCheatExperienceAnimation(banking, targetX, targetY) {
  const cheatIds = Array.isArray(banking.sourceCheatIds) ? banking.sourceCheatIds.filter(Boolean) : [];
  const unitValue = Math.max(1, Number(banking.unitValue) || EXPERIENCE_UNUSED_CHEAT_BONUS);
  if (!cheatIds.length) {
    completeExperienceBankingAnimation({ fade: false });
    return;
  }

  const now = performance.now();
  const duration = 680;
  const items = cheatIds.map((cheatId, index) => {
    const { sourceEl, sourceRect } = getCheatBonusSourceRect(cheatId);
    if (!sourceRect) return null;

    const clone = sourceEl?.cloneNode(true) || document.createElement("div");
    clone.classList.add("xp-cheat-fly");
    clone.classList.remove("has-count-pulse", "is-click-pulsing", "is-consuming", "is-awarded-new");
    clone.removeAttribute("id");
    clone.setAttribute("aria-hidden", "true");
    clone.style.width = `${sourceRect.width}px`;
    clone.style.height = `${sourceRect.height}px`;
    clone.style.opacity = "0";
    clone.style.transform = `translate3d(${sourceRect.left}px, ${sourceRect.top}px, 0) scale(1)`;
    document.body.appendChild(clone);

    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const curveDirection = index % 2 === 0 ? 1 : -1;
    const midpointX = (startX + targetX) / 2 + curveDirection * (24 + Math.random() * 22);
    const midpointY = (startY + targetY) / 2 - (54 + Math.random() * 34);

    return {
      sourceEl,
      clone,
      startX,
      startY,
      targetX,
      targetY,
      midpointX,
      midpointY,
      width: sourceRect.width,
      height: sourceRect.height,
      startTime: now + index * EXPERIENCE_UNUSED_CHEAT_STAGGER_MS,
      delivered: false,
      launched: false,
    };
  }).filter(Boolean);

  if (!items.length) {
    completeExperienceBankingAnimation({ fade: false });
    return;
  }

  banking.cards = items;
  banking.startedAt = now;

  const tick = (timestamp) => {
    const activeBanking = state.experienceBanking;
    if (!activeBanking || activeBanking !== banking) {
      items.forEach((item) => item.clone.remove());
      experienceBankingAnimationFrame = null;
      return;
    }

    let allDelivered = true;
    items.forEach((item) => {
      if (item.delivered) return;
      allDelivered = false;
      const elapsed = timestamp - item.startTime;
      if (elapsed < 0) return;

      if (!item.launched) {
        item.launched = true;
        if (item.sourceEl?.classList) {
          item.sourceEl.classList.add("xp-cheat-source-hidden");
        }
        item.clone.style.opacity = "1";
      }

      const progress = Math.min(1, elapsed / duration);
      const eased = easeInOutSine(progress);
      const inverse = 1 - eased;
      const centerX =
        (inverse * inverse * item.startX) +
        (2 * inverse * eased * item.midpointX) +
        (eased * eased * item.targetX);
      const centerY =
        (inverse * inverse * item.startY) +
        (2 * inverse * eased * item.midpointY) +
        (eased * eased * item.targetY);
      const scale = 1 - eased * 0.76;
      const left = centerX - item.width / 2;
      const top = centerY - item.height / 2;
      item.clone.style.transform = `translate3d(${left}px, ${top}px, 0) scale(${scale})`;
      item.clone.style.opacity = String(Math.max(0.12, 1 - eased * 0.18));

      if (progress >= 1) {
        item.delivered = true;
        item.clone.remove();
        activeBanking.delivered += 1;
        state.displayExperience = Math.min(activeBanking.finalValue, activeBanking.startValue + activeBanking.delivered * unitValue);
        renderExperienceCounter(true);
      }
    });

    if (allDelivered || activeBanking.delivered >= items.length) {
      finishExperienceBanking(activeBanking, false);
      experienceBankingAnimationFrame = null;
      return;
    }

    experienceBankingAnimationFrame = requestAnimationFrame(tick);
  };

  experienceBankingAnimationFrame = requestAnimationFrame(tick);
}

function startExperienceBankingAnimation() {
  const banking = state.experienceBanking;
  const { el: targetEl } = getExperienceCounterTarget();
  if (!banking || !targetEl) {
    completeExperienceBankingAnimation({ fade: false });
    return;
  }

  const targetRect = targetEl.getBoundingClientRect();
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  if (banking.type === "completion_bonus" || banking.type === "milestone_bonus") {
    startCompletionBonusExperienceAnimation(banking, targetX, targetY);
    return;
  }

  if (banking.type === "unused_cheats_bonus") {
    startUnusedCheatExperienceAnimation(banking, targetX, targetY);
    return;
  }

  const sourceCells = Array.from(document.querySelectorAll("#seen-grid .grid-cell.seen"))
    .filter((cell) => cell.getBoundingClientRect().width > 0 && cell.getBoundingClientRect().height > 0);

  if (!sourceCells.length) {
    completeExperienceBankingAnimation({ fade: false });
    return;
  }

  const shuffled = sourceCells
    .map((cell) => ({ cell, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map((entry) => entry.cell)
    .slice(0, banking.gained);
  state.experienceBankedCardIds = new Set(shuffled.map((cell) => cell.dataset.cardId).filter(Boolean));
  const now = performance.now();

  banking.cards = shuffled.map((cell, index) => {
    const rect = cell.getBoundingClientRect();
    const clone = cell.cloneNode(true);
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const curveDirection = Math.random() < 0.5 ? -1 : 1;
    const curveAmount = curveDirection * (28 + Math.random() * 54);
    const midpointX = (startX + targetX) / 2 + curveAmount;
    const midpointY = (startY + targetY) / 2 - (32 + Math.random() * 42);

    clone.classList.add("xp-fly-card");
    clone.classList.remove("fresh");
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.opacity = "0";
    clone.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0) scale(1)`;
    document.body.appendChild(clone);

    return {
      cell,
      clone,
      startX,
      startY,
      targetX,
      targetY,
      midpointX,
      midpointY,
      width: rect.width,
      height: rect.height,
      startTime: now + index * EXPERIENCE_CARD_STAGGER_MS + Math.random() * 36,
      duration: EXPERIENCE_CARD_FLIGHT_MS + Math.random() * 160,
      launched: false,
      delivered: false,
    };
  });

  banking.startedAt = now;

  const tick = (timestamp) => {
    const activeBanking = state.experienceBanking;
    if (!activeBanking) {
      experienceBankingAnimationFrame = null;
      return;
    }

    let allDelivered = true;
    activeBanking.cards.forEach((card) => {
      if (card.delivered) return;
      allDelivered = false;
      const elapsed = timestamp - card.startTime;
      if (elapsed < 0) return;

      if (!card.launched) {
        card.launched = true;
        card.cell.classList.add("xp-banked-source");
        card.clone.style.opacity = "1";
      }

      const progress = Math.min(1, elapsed / card.duration);
      const eased = easeInOutSine(progress);
      const inverse = 1 - eased;
      const centerX =
        (inverse * inverse * card.startX) +
        (2 * inverse * eased * card.midpointX) +
        (eased * eased * card.targetX);
      const centerY =
        (inverse * inverse * card.startY) +
        (2 * inverse * eased * card.midpointY) +
        (eased * eased * card.targetY);
      const scale = 1 - eased * 0.56;
      const left = centerX - card.width / 2;
      const top = centerY - card.height / 2;
      card.clone.style.transform = `translate3d(${left}px, ${top}px, 0) scale(${scale})`;
      card.clone.style.opacity = String(Math.max(0.12, 1 - eased * 0.1));

      if (progress >= 1) {
        card.delivered = true;
        card.clone.remove();
        activeBanking.delivered += 1;
        state.displayExperience = Math.min(activeBanking.finalValue, activeBanking.startValue + activeBanking.delivered);
        renderExperienceCounter(true);
      }
    });

    if (allDelivered || activeBanking.delivered >= activeBanking.gained) {
      finishExperienceBanking(activeBanking, false);
      experienceBankingAnimationFrame = null;
      return;
    }

    experienceBankingAnimationFrame = requestAnimationFrame(tick);
  };

  experienceBankingAnimationFrame = requestAnimationFrame(tick);
}

function renderScores() {
  const scoreEl = document.getElementById("score");
  const bestScoreEl = document.getElementById("best-score");
  const jokerCountEl = document.getElementById("joker-count");
  const energyCardEl = document.getElementById("header-energy-metric");
  const energyValueEl = document.getElementById("energy-value");
  const isDailyRun = state.runMode === "daily";
  const hudDeckKey = state.gameOver && !isDailyRun
    ? normalizeDeckKey(state.selectedDeckKey || loadSelectedDeck())
    : normalizeDeckKey(state.currentDeckKey || state.selectedDeckKey || loadSelectedDeck());
  const bestDeckKey = state.gameOver && !isDailyRun
    ? normalizeDeckKey(state.selectedDeckKey || loadSelectedDeck())
    : normalizeDeckKey(state.currentDeckKey || state.selectedDeckKey || loadSelectedDeck());
  const bestLevelNumber = state.gameOver && !isDailyRun
    ? normalizeLevelNumber(state.selectedLevelNumber || loadSelectedLevel())
    : normalizeLevelNumber(state.currentLevelNumber || state.selectedLevelNumber || loadSelectedLevel());

  if (!isDailyRun) {
    state.bestScore = loadBestScore(bestDeckKey, bestLevelNumber);
  }
  if (scoreEl) setAnimatedText(scoreEl, getDisplayedRunScore());
  if (bestScoreEl) setAnimatedText(bestScoreEl, `BEST: ${state.bestScore}`);
  renderExperienceCounter(false);
  if (jokerCountEl) {
    const showJokerCount = isJokerDeckKey(hudDeckKey);
    const remainingJokers = showJokerCount && typeof getRemainingJokerCount === "function"
      ? getRemainingJokerCount()
      : 0;
    setAnimatedText(jokerCountEl, showJokerCount ? `JOKERS: ${remainingJokers}` : "");
    jokerCountEl.setAttribute("aria-hidden", showJokerCount ? "false" : "true");
  }
  {
    const showEnergy = !state.gameOver && !!state.current && isEnergyDeckKey(hudDeckKey);
    if (energyCardEl) {
      energyCardEl.hidden = !showEnergy;
    }
    if (energyValueEl) {
      const nextEnergyValue = Math.max(0, Number(state.energy) || 0);
      const previousEnergyValue = Number(energyValueEl.dataset.renderValue);
      const wasEnergyVisible = energyCardEl?.dataset.energyVisible === "true";
      setAnimatedText(energyValueEl, nextEnergyValue);
      if (showEnergy && wasEnergyVisible && Number.isFinite(previousEnergyValue) && nextEnergyValue > previousEnergyValue) {
        const popEl = energyCardEl || energyValueEl;
        popEl.classList.remove("energy-pop");
        void popEl.offsetWidth;
        popEl.classList.add("energy-pop");
      }
      if (energyCardEl) {
        energyCardEl.dataset.energyVisible = showEnergy ? "true" : "false";
      }
    }
  }

  const metaEl = document.getElementById("meta-progression");
  if (metaEl) {
    metaEl.innerText = state.metaProgression ?? 0;
  }
}

function setAnimatedText(el, value) {
  if (!el) return;

  const nextValue = String(value ?? "");
  const previousValue = el.dataset.renderValue;
  el.innerText = nextValue;

  if (previousValue !== undefined && previousValue !== nextValue) {
    el.classList.remove("hud-pop");
    void el.offsetWidth;
    el.classList.add("hud-pop");
  }

  el.dataset.renderValue = nextValue;
}

function cleanPlayerLogMessage(message = "") {
  return String(message || "")
    .replace(/[✅❌💀🏆🍀🖐️]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const SHORT_EFFECT_LABELS = Object.freeze({
  "Two Truths and One Lie": "TTOL",
  "Power Parity": "Parity",
  "Emergency Services": "999",
  "Higher of Next Two": "High 2",
  "Lower of Next Two": "Low 2",
  "Next Card Parity": "Parity",
  "Lucky Dip": "Dip",
  "Split the Difference": "Gap",
  "False Shuffle": "False Shuffle",
  "The River": "River",
  "Ladies Night": "Queens",
  "Blackjack": "Blackjack",
  "Roll the Dice": "Dice",
  "Club Sandwich": "Club",
  "Diamond Geezer": "Diamond",
  "Red Herring": "Herring",
  "Grave Digger": "Grave",
  "Royal Flush": "Royal",
  "Sixth Sense": "6?",
  "New Suits": "New Suits",
  "All In": "All In",
  "Lucky 13": "Lucky 13",
  "Suits You, Sir": "Suits",
  "Refund": "Refund",
  "Equals 11": "=11",
  "WL": "WL",
  "Higher, Higher, Higher": "HHH",
  "Catch-22": "Catch-22",
  "Psycho": "Psycho",
  "Brucie Bonus": "Brucie",
  "You Can Cheat A Cheater": "Cheater",
  "Enchant": "Enchant",
});

function truncateMessage(text, maxLength = 36) {
  const cleaned = cleanPlayerLogMessage(text);
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function escapeRegExp(text = "") {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getShortEffectLabel(effectName = "") {
  const name = cleanPlayerLogMessage(effectName);
  if (!name) return "";
  if (SHORT_EFFECT_LABELS[name]) return SHORT_EFFECT_LABELS[name];
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return truncateMessage(name, 14);
  return words
    .filter((word) => !/^(the|and|of|a|an|to|in|for)$/i.test(word))
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || truncateMessage(name, 14);
}

function normalizeComparisonValueForMessage(value = "") {
  return String(value || "").replace(/['".!()]/g, "").trim();
}

function getShortCorrectComparisonMessage(cleaned = "") {
  if (!/^Correct!/i.test(cleaned)) return "";
  const comparisonMatch = cleaned.match(/['"]?(10|[A2-9JQK])['"]?\s+is\s+(higher|lower)\s+than\s+['"]?(10|[A2-9JQK])['"]?/i);
  if (comparisonMatch) {
    const nextValue = normalizeComparisonValueForMessage(comparisonMatch[1]);
    const currentValue = normalizeComparisonValueForMessage(comparisonMatch[3]);
    const operator = comparisonMatch[2].toLowerCase() === "higher" ? ">" : "<";
    return `Correct! ${nextValue} ${operator} ${currentValue}`;
  }

  const equalsMatch = cleaned.match(/['"]?(10|[A2-9JQK])['"]?\s+equals\s+['"]?(10|[A2-9JQK])['"]?/i);
  if (equalsMatch) {
    const nextValue = normalizeComparisonValueForMessage(equalsMatch[1]);
    const currentValue = normalizeComparisonValueForMessage(equalsMatch[2]);
    return `Correct! ${nextValue} = ${currentValue}`;
  }

  return "";
}

function getKnownEffectNames() {
  const names = new Set(Object.keys(SHORT_EFFECT_LABELS));
  if (typeof CHEATS !== "undefined" && Array.isArray(CHEATS)) {
    CHEATS.forEach((cheat) => {
      if (cheat?.name) names.add(cleanPlayerLogMessage(cheat.name));
    });
  }
  if (typeof POWERS !== "undefined" && Array.isArray(POWERS)) {
    POWERS.forEach((power) => {
      if (power?.name) names.add(cleanPlayerLogMessage(power.name));
    });
  }
  return Array.from(names).filter(Boolean).sort((a, b) => b.length - a.length);
}

function stripRepeatedEffectName(effectName, payload) {
  const name = cleanPlayerLogMessage(effectName);
  let text = cleanPlayerLogMessage(payload).replace(/\.$/, "");
  if (!name || !text) return text;
  return text.replace(new RegExp(`^${escapeRegExp(name)}\\s*[:\\-]\\s*`, "i"), "");
}

function shortenEffectPayload(effectName, payload) {
  const name = cleanPlayerLogMessage(effectName);
  let text = stripRepeatedEffectName(name, payload)
    .replace(/^the next face-down card is\s+/i, "next is ")
    .replace(/^the next card is\s+/i, "next is ")
    .replace(/^the next three face-down cards are now\s+/i, "next 3 ")
    .replace(/\bface-down\b/gi, "deck")
    .replace(/\bNudge \+1\b/g, "+")
    .replace(/\bNudge -1\b/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (name !== "Cheaters Prosper") {
    text = text.replace(/\s+Cheaters Prosper:\s*gained.+$/i, "").trim();
  }

  if (!text) return getShortEffectLabel(name);

  if (name === "Lucky Dip") {
    if (/higher than the current/i.test(text)) return "Dip: Higher";
    if (/lower than the current/i.test(text)) return "Dip: Lower";
    if (/equal to the current/i.test(text)) return "Dip: Equal";
    return `Dip: ${truncateMessage(text, 18)}`;
  }
  if (name === "One of Next 2 Higher?") {
    if (/yes|at least one/i.test(text)) return "High 2: Yes";
    if (/no|neither/i.test(text)) return "High 2: No";
  }
  if (name === "One of Next 2 Lower?") {
    if (/yes|at least one/i.test(text)) return "Low 2: Yes";
    if (/no|neither/i.test(text)) return "Low 2: No";
  }
  if (name === "Power Parity") return `Parity: ${truncateMessage(text, 26)}`;
  if (name === "Next Card Parity") {
    if (/picture/i.test(text)) return "Parity: Picture";
    if (/joker/i.test(text)) return "Parity: Joker";
    if (/even/i.test(text)) return "Parity: Even";
    if (/odd/i.test(text)) return "Parity: Odd";
    return `Parity: ${truncateMessage(text, 14)}`;
  }
  if (name === "The River") return `River: ${truncateMessage(text, 28)}`;
  if (name === "Red Herring") return `Herring: ${truncateMessage(text, 27)}`;
  if (name === "Ace ahead?") {
    if (/no Ace/i.test(text)) return "No Ace in next 3";
    if (/Ace/i.test(text)) return "Ace in next 3";
  }
  if (name === "King ahead?") {
    if (/no King|not a King/i.test(text)) return "No King next";
    if (/King/i.test(text)) return "King next";
  }
  if (name === "Face Card Ahead?") {
    if (/no face card/i.test(text)) return "No face card in next 3";
    if (/face card/i.test(text)) return "Face card in next 3";
  }
  if (name === "Club Sandwich") return `Club: ${truncateMessage(text.replace(/^next Club is\s+/i, ""), 10)}`;
  if (name === "Split the Difference") {
    const gapMatch = text.match(/gap\s+is\s+(\d+)/i);
    if (gapMatch) return `Gap: ${gapMatch[1]}`;
  }
  if (name === "Roll the Dice") {
    const rollMatch = text.match(/rolled\s+(\d+)/i);
    if (rollMatch) return `Dice: +${rollMatch[1]}/-${rollMatch[1]}`;
  }
  if (name === "Enchant") {
    if (/marked/i.test(text)) return "Enchant set";
    if (/no effect/i.test(text)) return "Enchant: off";
    if (/found no|needs/i.test(text)) return "Enchant: none";
  }
  if (name === "Ladies Night") {
    const countMatch = text.match(/^(\d+)/);
    if (countMatch) return `Queens: ${countMatch[1]} pulled`;
  }
  if (name === "Grave Digger") {
    const cardMatch = text.match(/:\s*([^:]+)$/);
    if (cardMatch) return `Grave: ${truncateMessage(cardMatch[1], 16)}`;
  }
  if (/hit/i.test(text) && /power/i.test(text)) return `${getShortEffectLabel(name)}: Power`;
  if (/hit/i.test(text) && /2 .*cheats?/i.test(text)) return `${getShortEffectLabel(name)}: 2 Cheats`;
  if (/^yes\b/i.test(text)) return `${getShortEffectLabel(name)}: Yes`;
  if (/^no\b/i.test(text)) return `${getShortEffectLabel(name)}: No`;
  if (/complete/i.test(text) && /power/i.test(text)) return `${getShortEffectLabel(name)}: Power`;
  if (/complete/i.test(text) && /cheats?/i.test(text)) {
    const countMatch = text.match(/choose\s+(\d+)/i);
    return countMatch ? `${getShortEffectLabel(name)}: ${countMatch[1]} Cheats` : `${getShortEffectLabel(name)}: Cheats`;
  }
  if (/paid out|paid/i.test(text)) return `${getShortEffectLabel(name)} paid`;
  if (/failed/i.test(text)) return `${getShortEffectLabel(name)} failed`;
  if (/armed/i.test(text)) return `${getShortEffectLabel(name)} armed`;
  if (/can only|needs|not enough|no .*card|found no/i.test(text)) return truncateMessage(text, 34);

  return truncateMessage(`${getShortEffectLabel(name)}: ${text}`, 36);
}

function getEffectMessageParts(cleaned = "") {
  const text = cleanPlayerLogMessage(cleaned);
  for (const name of getKnownEffectNames()) {
    const colonMatch = text.match(new RegExp(`^${escapeRegExp(name)}\\s*:\\s*(.+)$`, "i"));
    if (colonMatch) return { name, payload: colonMatch[1] };

    const sentenceMatch = text.match(new RegExp(`^(${escapeRegExp(name)}\\b.+)$`, "i"));
    if (sentenceMatch && /armed|can only|needs|found|swapped|rolled|pulled|complete|paid|failed|hit/i.test(sentenceMatch[1])) {
      return { name, payload: sentenceMatch[1] };
    }
  }
  return null;
}

function getShortPlayerMessage(message = "") {
  const cleaned = cleanPlayerLogMessage(message);
  if (!cleaned) return "";
  const playedMatch = cleaned.match(/^Played\s+([^:]+):/i);
  if (playedMatch) {
    const resultText = cleaned.slice(playedMatch[0].length).trim();
    const shortResult = shortenEffectPayload(playedMatch[1].trim(), resultText) || getShortPlayerMessage(resultText);
    return shortResult || truncateMessage(`Played ${playedMatch[1].trim()}`, 32);
  }
  const effectParts = getEffectMessageParts(cleaned);
  if (effectParts) return shortenEffectPayload(effectParts.name, effectParts.payload);
  const matchingMatch = cleaned.match(/^(\d+)\s+matching\s+cards?\s+remain/i);
  if (matchingMatch) return `${matchingMatch[1]} matches left`;
  if (/^Royal Flush:\s*yes/i.test(cleaned)) return "RF: Yes";
  if (/^Royal Flush:\s*no/i.test(cleaned)) return "RF: No";
  if (/^Sell Your Soul/i.test(cleaned)) return cleaned.includes("saved") ? "Soul saved" : "Soul armed";
  if (/^Coming Soon/i.test(cleaned)) {
    if (/higher/i.test(cleaned)) return "Soon: Higher";
    if (/lower/i.test(cleaned)) return "Soon: Lower";
    if (/equal|equals/i.test(cleaned)) return "Soon: Equal";
    if (/Joker/i.test(cleaned)) return "Soon: Joker";
    return "Coming Soon";
  }
  if (/^Burned the next/i.test(cleaned)) return "Card burned";
  if (/^Enchant marked/i.test(cleaned)) return "Enchant set";
  if (/^Enchant has no effect/i.test(cleaned)) return "Enchant: off";
  if (/^Enchant saved/i.test(cleaned)) return "Enchant saved";
  const splitMatch = cleaned.match(/^Split the Difference:\s*(?:the\s+)?gap\s+is\s+(\d+)/i);
  if (splitMatch) return `Gap: ${splitMatch[1]}`;
  if (/^Split the Difference:.*Joker/i.test(cleaned)) return "Gap: Joker";
  if (/^Split the Difference/i.test(cleaned)) return "Gap shown";
  if (/^No\s*(?:[\u2014-]|\u00e2\u20ac\u201d)\s*no face card in the next three/i.test(cleaned)) return "No face card in next 3";
  if (/^Yes\s*(?:[\u2014-]|\u00e2\u20ac\u201d)\s*a face card is in the next three/i.test(cleaned)) return "Face card in next 3";
  if (/^No\s*(?:[\u2014-]|\u00e2\u20ac\u201d)\s*no Ace in the next three/i.test(cleaned)) return "No Ace in next 3";
  if (/^Yes\s*(?:[\u2014-]|\u00e2\u20ac\u201d)\s*an Ace is in the next three/i.test(cleaned)) return "Ace in next 3";
  if (/^No\s*(?:[\u2014-]|\u00e2\u20ac\u201d)\s*(?:no|not a) King/i.test(cleaned)) return "No King next";
  if (/^Yes\s*(?:[\u2014-]|\u00e2\u20ac\u201d)\s*(?:a King is in the next three|it is a King)/i.test(cleaned)) return "King next";
  const sixthMatch = cleaned.match(/^Sixth Sense:\s*(higher|lower)/i);
  if (sixthMatch) return `6? ${sixthMatch[1].toUpperCase()}`;
  if (/^Sixth Sense sees neither/i.test(cleaned)) return "6? NEITHER";
  if (/^Sixth Sense can only/i.test(cleaned)) return "6? Needs a 6";
  if (/^6\/7 must be/i.test(cleaned)) return "6/7 first only";
  if (/^6\/7 can only be used on an un-nudged/i.test(cleaned)) return "6/7 needs raw 6/7";
  if (/^6\/7 can only/i.test(cleaned)) return "6/7 needs 6 or 7";
  if (/^6\/7 armed/i.test(cleaned)) return "6/7 armed";
  if (/^Lucky Dip:/i.test(cleaned)) return "Lucky Dip";
  if (/^The River:/i.test(cleaned)) return "River shown";
  if (/^False Shuffle:/i.test(cleaned)) return "False Shuffle";
  if (/^Power Parity:/i.test(cleaned)) return "Parity shown";
  if (/^New Suits/i.test(cleaned)) return cleaned.includes("complete") ? "New Suits paid" : "New Suits";
  if (/^All In/i.test(cleaned)) return cleaned.includes("paid out") ? "All In paid" : cleaned.includes("failed") ? "All In failed" : "All In";
  if (/^Suits You, Sir/i.test(cleaned)) return "Suits You";
  if (/^Lucky 13/i.test(cleaned)) return "Lucky 13";
  if (/^Refund/i.test(cleaned)) return "Refund";
  if (/^Equals 11/i.test(cleaned)) return "Equals 11";
  if (/^WL/i.test(cleaned)) return "WL";
  if (/^Higher, Higher, Higher/i.test(cleaned)) return "HHH";
  if (/^Catch-22/i.test(cleaned)) return "Catch-22";
  if (/^Psycho/i.test(cleaned)) return "Psycho";
  if (/^Brucie Bonus/i.test(cleaned)) return "Brucie Bonus";
  if (/^You Can Cheat A Cheater/i.test(cleaned)) return "Cheater paid";
  if (/^Emergency Services/i.test(cleaned) && /9/i.test(cleaned)) return "9s pulled";
  if (/^Power gained:/i.test(cleaned)) return "Power gained";
  if (/^Unlocked:/i.test(cleaned)) return "Unlocked";
  if (/^Choose/i.test(cleaned) && /cheat/i.test(cleaned)) return "Choose Cheat";
  if (/^Choose/i.test(cleaned) && /power/i.test(cleaned)) return "Choose Power";
  if (/tutorial/i.test(cleaned) && /lock/i.test(cleaned)) return "Tutorial locked";
  if (/unlock/i.test(cleaned) && /tutorial/i.test(cleaned)) return "Tutorial locked";
  if (/next tutorial step/i.test(cleaned)) return "Tutorial locked";
  {
    const nudgeMatch = cleaned.match(/^Nudge\s*([+-])\s*(\d+)/i);
    if (nudgeMatch) {
      const kept = /charge kept/i.test(cleaned) ? " kept" : "";
      return `Nudge ${nudgeMatch[1]}${nudgeMatch[2]}${kept}`;
    }
  }
  if (/^Guessed higher/i.test(cleaned)) return "Guessed higher";
  if (/^Guessed lower/i.test(cleaned)) return "Guessed lower";
  if (/YOU CLEARED THE DECK/i.test(cleaned)) return "Deck cleared";
  if (/GAME OVER/i.test(cleaned)) return "Game over";
  const correctComparison = getShortCorrectComparisonMessage(cleaned);
  if (correctComparison) return correctComparison;
  if (/Correct! Cards match/i.test(cleaned)) return "Match";
  if (/Correct!/i.test(cleaned)) return "Correct";
  if (/Yellow Joker:/i.test(cleaned)) {
    const jokerPart = cleaned.replace(/^Yellow Joker:\s*/i, "");
    return jokerPart.split(/[.!-]/)[0].slice(0, 28) || "Joker";
  }
  if (/saved the run/i.test(cleaned)) return "Saved";
  if (/choose/i.test(cleaned) && /cheat/i.test(cleaned)) return "Choose a Cheat";
  if (/choose/i.test(cleaned) && /power/i.test(cleaned)) return "Choose a Power";
  if (/nudge/i.test(cleaned)) return cleaned.length > 38 ? "Nudge used" : cleaned;
  if (/Run started/i.test(cleaned)) return "Run started";
  return truncateMessage(cleaned, 34);
}

function getMessageBarText(message = "") {
  return truncateMessage(getShortPlayerMessage(message), 22);
}

function addPlayerLogEntry(message = "", options = {}) {
  const detail = cleanPlayerLogMessage(message);
  if (!detail) return;
  if (detail === "Press Start Run.") return;
  if (/^(Nudge [+-]\d+ used\. Current card treated|Blank Space adjusted\.)/i.test(detail)) return;
  if (state.lastPlayerLogMessage === detail) return;

  const summaryOverride = cleanPlayerLogMessage(options.summary || "");
  const entry = {
    detail,
    summary: summaryOverride || getShortPlayerMessage(detail),
    cardsCleared: getDisplayedRunScore(),
    deckSize: typeof getCurrentDeckTargetCount === "function" ? getCurrentDeckTargetCount() : 52,
    createdAt: Date.now(),
  };

  state.playerLog = [entry, ...(Array.isArray(state.playerLog) ? state.playerLog : [])].slice(0, 120);
  state.lastPlayerLogMessage = detail;
  renderRunLogList();
}

function renderRunLogList() {
  const listEl = document.getElementById("run-log-list");
  if (!listEl) return;

  const entries = Array.isArray(state.playerLog) ? state.playerLog : [];
  if (!entries.length) {
    listEl.innerHTML = `<p class="run-log-empty">No run events yet.</p>`;
    return;
  }

  listEl.innerHTML = entries.map((entry) => {
    const deckSize = Math.max(1, Number(entry.deckSize) || (typeof getCurrentDeckTargetCount === "function" ? getCurrentDeckTargetCount() : 52));
    const cardText = Number.isFinite(Number(entry.cardsCleared))
      ? `${Math.max(0, Number(entry.cardsCleared))}/${deckSize}`
      : "--/52";
    return `
      <article class="run-log-entry">
        <div class="run-log-entry-head">
          <span>${escapeHtml(entry.summary || "Event")}</span>
          <strong>${escapeHtml(cardText)}</strong>
        </div>
        <p>${escapeHtml(entry.detail || "")}</p>
      </article>
    `;
  }).join("");
}

function getVisibleHeaderPowerIds(fallbackPowerId = "") {
  const ids = Array.isArray(state.powers)
    ? state.powers
    : [];
  const visibleIds = ids.filter((powerId) => powerId && powerId !== "nudge_engine" && getPowerById(powerId));

  if (!visibleIds.length && fallbackPowerId && getPowerById(fallbackPowerId)) {
    visibleIds.push(fallbackPowerId);
  }

  return Array.from(new Set(visibleIds));
}

function buildHeaderPowerStackMarkup(powerIds) {
  const visibleIds = Array.isArray(powerIds) ? powerIds.filter((powerId) => getPowerById(powerId)) : [];

  if (!visibleIds.length) {
    return `
      ${POWER_SHIELD_SVG}
      <span id="header-power-glyph">·</span>
    `;
  }

  const center = (visibleIds.length - 1) / 2;
  const spacing = visibleIds.length <= 3 ? 8 : 6;

  return `
    <span class="header-power-stack" aria-hidden="true">
      ${visibleIds.map((powerId, index) => {
        const power = getPowerById(powerId);
        const offset = Math.round((index - center) * spacing);
        const scale = Math.max(0.84, 1 - Math.max(0, visibleIds.length - 3) * 0.035);
        return `
          <span class="header-power-stack-item ${power?.rarity || "common"}" style="--power-offset: ${offset}px; --power-scale: ${scale}; z-index: ${index + 1};">
            ${POWER_SHIELD_SVG}
            <span class="header-power-stack-glyph">${getPowerIcon(powerId)}</span>
          </span>
        `;
      }).join("")}
    </span>
  `;
}

function buildHeaderPowerTooltipBody(deckKey, levelNumber) {
  const visiblePowerIds = getVisibleHeaderPowerIds(state.selectedStartPowerId);
  const activePowerLines = visiblePowerIds.map((powerId) => {
    const powerName = getPowerName(powerId);
    const description = getPowerDescription(powerId, { deckKey, levelNumber });
    return description
      ? `- ${powerName}: ${description}`
      : `- ${powerName}`;
  });

  const bodyLines = [];
  if (activePowerLines.length) {
    bodyLines.push(`Current Powers (${activePowerLines.length}):`);
    bodyLines.push(...activePowerLines);
  } else {
    bodyLines.push("Current Powers In Play: none");
  }

  return bodyLines.join("\n");
}

function renderHeaderStatus() {
  const gameEl = document.getElementById("game");
  const brandTitleEl = document.getElementById("brand-title");
  const powerChipEl = document.getElementById("header-power-chip");
  const runLevelNumber = normalizeLevelNumber(state.currentLevelNumber || state.selectedLevelNumber || loadSelectedLevel());
  const runPowerId = state.selectedStartPowerId || "";
  const runDeckKey = normalizeDeckKey(state.currentDeckKey || state.selectedDeckKey || "blue");
  const runDeckName = getDeckName(runDeckKey);
  const runPowerTooltipBody = buildHeaderPowerTooltipBody(runDeckKey, runLevelNumber);

  if (gameEl) {
    gameEl.dataset.deck = runDeckKey;
  }
  document.body.classList.toggle("black-deck-active", runDeckKey === "black");

  if (brandTitleEl) {
    brandTitleEl.dataset.deck = runDeckKey;
  }

  if (powerChipEl) {
    const visiblePowerIds = getVisibleHeaderPowerIds(runPowerId);
    const hasPower = visiblePowerIds.length > 0;
    const leadPower = hasPower ? getPowerById(visiblePowerIds[visiblePowerIds.length - 1]) : null;
    powerChipEl.classList.remove("common", "normal", "uncommon", "rare", "legendary");
    if (hasPower) {
      powerChipEl.classList.add(leadPower?.rarity || "common");
    }
    powerChipEl.innerHTML = buildHeaderPowerStackMarkup(visiblePowerIds);
    powerChipEl.classList.toggle("has-power", hasPower);
    powerChipEl.setAttribute("aria-label", hasPower ? `${visiblePowerIds.length} current power${visiblePowerIds.length === 1 ? "" : "s"} details` : "No starting power selected");
    setupHeaderPowerTooltip(powerChipEl, {
      enabled: hasPower && !!runPowerTooltipBody,
      title: runDeckKey === "black" ? "Black Deck" : `${runDeckName} Deck - Level ${runLevelNumber} Powers`,
      description: runPowerTooltipBody,
    });
  }
}

function getCheatDescription(cheat) {
  return CHEAT_DESCRIPTIONS?.[cheat.name] || "No description yet.";
}

function showTooltip(titleText, bodyText, el) {
  const tooltip = document.getElementById("cheat-tooltip");
  const title = document.getElementById("cheat-tooltip-title");
  const body = document.getElementById("cheat-tooltip-body");

  if (!tooltip || !title || !body || !el) return;

  title.innerText = titleText || "";
  body.innerText = bodyText || "";

  tooltip.classList.remove("hidden");

  const rect = el.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const edgePadding = 12;
  const tooltipWidth = Math.min(tooltipRect.width || 260, Math.max(160, viewportWidth - (edgePadding * 2)));
  const tooltipHeight = tooltipRect.height || 72;
  const targetCenterX = rect.left + rect.width / 2;
  const preferredLeft =
    rect.left > viewportWidth * 0.58
      ? rect.left - tooltipWidth - 14
      : targetCenterX - (tooltipWidth / 2);
  const maxLeft = Math.max(edgePadding, viewportWidth - tooltipWidth - edgePadding);
  const safeLeft = Math.min(Math.max(preferredLeft, edgePadding), maxLeft);

  const prefersBelow = rect.top < tooltipHeight + 28;
  const preferredTop = prefersBelow ? rect.bottom + 10 : rect.top - tooltipHeight - 14;
  const maxTop = Math.max(edgePadding, viewportHeight - tooltipHeight - edgePadding);
  const safeTop = Math.min(Math.max(preferredTop, edgePadding), maxTop);

  tooltip.style.left = safeLeft + "px";
  tooltip.style.top = safeTop + "px";
  tooltip.style.transform = "none";
  tooltip.dataset.sourceId = el.id || "";
  tooltip.dataset.sourceRole = el.dataset.tooltipRole || "";
}

function setupHeaderPowerTooltip(el, payload) {
  if (!el || el.dataset.tooltipInit === "1") {
    if (el) {
      el.dataset.tooltipEnabled = payload?.enabled ? "1" : "0";
      el.dataset.tooltipTitle = payload?.title || "";
      el.dataset.tooltipBody = payload?.description || "";
    }
    return;
  }

  let holdTimer = null;
  let pointerHoldActive = false;

  const clearHold = () => {
    clearTimeout(holdTimer);
    holdTimer = null;
    hideCheatTooltip();
  };

  const beginHold = (event) => {
    if (el.dataset.tooltipEnabled !== "1") return;
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    clearTimeout(holdTimer);
    if (event.pointerType === "mouse" || event.type === "mousedown") {
      showTooltip(el.dataset.tooltipTitle, el.dataset.tooltipBody, el);
      return;
    }
    holdTimer = setTimeout(() => {
      showTooltip(el.dataset.tooltipTitle, el.dataset.tooltipBody, el);
      const tooltip = document.getElementById("cheat-tooltip");
      if (tooltip) tooltip.dataset.keepOpenOnce = "1";
    }, 300);
  };

  el.addEventListener("pointerdown", (event) => {
    pointerHoldActive = true;
    beginHold(event);
  });
  el.addEventListener("mousedown", (event) => {
    if (pointerHoldActive) return;
    beginHold(event);
  });

  const clearPointerHold = () => {
    clearHold();
    window.setTimeout(() => {
      pointerHoldActive = false;
    }, 0);
  };

  el.addEventListener("pointerup", clearPointerHold);
  el.addEventListener("pointercancel", clearPointerHold);
  el.addEventListener("pointerleave", clearPointerHold);
  el.addEventListener("mouseup", () => {
    if (pointerHoldActive) return;
    clearHold();
  });
  el.addEventListener("mouseenter", () => {
    if (!canUseHoverTooltips()) return;
    if (el.dataset.tooltipEnabled !== "1") return;
    showTooltip(el.dataset.tooltipTitle, el.dataset.tooltipBody, el);
  });
  el.addEventListener("mouseleave", clearHold);
  el.addEventListener("contextmenu", (event) => {
    if (el.dataset.tooltipEnabled !== "1") return;
    event.preventDefault();
  });

  el.dataset.tooltipInit = "1";
  el.dataset.tooltipRole = "header-power";
  el.dataset.tooltipEnabled = payload?.enabled ? "1" : "0";
  el.dataset.tooltipTitle = payload?.title || "";
  el.dataset.tooltipBody = payload?.description || "";
}

function getActiveEffectsTooltipPayload() {
  const waiting = [];

  if (state.lucky7Armed) waiting.push("Lucky 7: next guess is protected.");
  if (state.fiveAliveArmed) waiting.push("Five Alive: 5 locked, next wrong guess survives.");
  if (state.marginForErrorArmed) waiting.push("Margin For Error: wrong by 2 or less survives.");
  if (state.hotOrColdArmed) waiting.push("Margin Of Error: wrong by 3 or less survives.");
  if (state.stitchInTimeArmed) waiting.push("A Stitch In Time: next wrong guess survives.");
  if (state.sellYourSoulArmed) waiting.push("Sell Your Soul: wrong survives; safe guess loses held Cheats and Nudges.");
  if (state.godSaveKingArmed) waiting.push("God Save The King: King reveal saves a wrong guess.");
  if (state.lucky13Armed) waiting.push("Lucky 13: King reveal gives +5 Nudge Up and +5 Nudge Down.");
  if (state.alwaysBetBlackArmed) waiting.push("Always Bet On The Black: Club or Spade reveal saves a wrong guess.");
  if (state.redDeadRedemptionArmed) waiting.push("Red? Dead? Redemption: Heart or Diamond reveal saves a wrong guess.");
  if (state.suitsYouSirArmed) waiting.push("Suits You, Sir: resolves when the next card is revealed.");
  if ((state.newSuitsRemaining || 0) > 0) {
    const seen = state.newSuitsSeen && typeof state.newSuitsSeen === "object"
      ? Object.keys(state.newSuitsSeen).filter((suit) => !!state.newSuitsSeen[suit]).length
      : 0;
    waiting.push(`New Suits: ${seen}/4 suits found, ${state.newSuitsRemaining} reveal${state.newSuitsRemaining === 1 ? "" : "s"} left.`);
  }
  if ((state.nineDartRemaining || 0) > 0) {
    waiting.push(`9 Dart Finish: ${state.nineDartRemaining} no-Cheat, no-Nudge card${state.nineDartRemaining === 1 ? "" : "s"} left.`);
  }
  if (state.nineDartAutoCorrect) waiting.push("9 Dart Finish: every remaining guess is safe.");
  if (Array.isArray(state.konamiPatternRemaining) && state.konamiPatternRemaining.length > 0) {
    const pattern = state.konamiPatternRemaining.map((guess) => guess === "higher" ? "Up" : "Down").join(", ");
    waiting.push(`Konami Code: ${pattern} left.`);
  }
  if ((state.konamiAutoCorrectRemaining || 0) > 0) {
    waiting.push(`Konami Code: ${state.konamiAutoCorrectRemaining} safe guess${state.konamiAutoCorrectRemaining === 1 ? "" : "es"} left.`);
  }
  if (state.findLadyArmed) waiting.push("Find The Lady: Queen reveal gives a Power pick.");
  if (state.saveScumArmed && state.saveScumSnapshot) waiting.push("Save Scum: next Game Over rewinds to its checkpoint.");
  if ((state.cryogenRemaining || 0) > 0) {
    waiting.push(`Cryogen: Energy frozen at ${state.cryogenFrozenEnergy || state.energy || 0} for ${state.cryogenRemaining} turn${state.cryogenRemaining === 1 ? "" : "s"}.`);
  }
  if (state.oddOneOutArmed) waiting.push("Odd One Out: next odd card loses, otherwise survives.");
  const cursedShieldCharges = Math.max(0, Number(state.cursedShieldCharges) || 0);
  if (cursedShieldCharges > 0 || state.cursedShieldArmed) {
    waiting.push(`Cursed Shield: ${Math.max(1, cursedShieldCharges)} wrong guess${Math.max(1, cursedShieldCharges) === 1 ? "" : "es"} survive.`);
  }
  if ((state.insuranceLives || 0) > 0) waiting.push(`Insurance: ${state.insuranceLives} wrong guess save${state.insuranceLives === 1 ? "" : "s"} left.`);
  if ((state.oneLifeLeftLives || 0) > 0) waiting.push(`One Life Left: ${state.oneLifeLeftLives} ${state.oneLifeLeftLives === 1 ? "life" : "lives"} stored.`);
  if ((state.killerQueenLives || 0) > 0) waiting.push(`Killer Queen: ${state.killerQueenLives} save${state.killerQueenLives === 1 ? "" : "s"} for Lower on Queen into King.`);
  if (state.suitedAndBootedArmed) {
    waiting.push(`Suited and Booted: survives unless next card is ${state.suitedAndBootedSuit || "the chosen suit"}.`);
  }
  if (state.equals11Armed) waiting.push("Equals 11: current + next totaling 11 gives 3 Cheats.");
  if (state.refundArmed) waiting.push("Refund: unnecessary nudges this turn will be returned.");
  if (state.legendaryCheatOfferArmed) waiting.push("Legends Ahead: next Cheat pick is Legendary only.");
  if (state.sixSevenArmed) waiting.push("6/7: correct guess gives 3 Cheat picks; wrong guess loses.");
  if (state.catch22Armed) waiting.push("Catch-22: next 2 gives a Power pick.");
  if (state.blackjackArmed) waiting.push("Blackjack: current + next totaling 21 gives a Power pick.");
  if (state.diamondGeezerArmed) waiting.push("Diamond Geezer: Diamond reveal gives 2 Cheat picks.");
  if (state.forcedNextGuess) {
    waiting.push(`${state.forcedNextGuess === "higher" ? "The Higher The Better" : "The Lower The Better"}: next guess must be ${state.forcedNextGuess}.`);
  }
  if (state.rongActive) waiting.push("RONG: Higher and Lower are swapped.");
  if (state.blankSpaceActive) {
    const blankValue = getBlankSpaceDisplayValue();
    waiting.push(`Blank Space: next card treated as ${Number.isFinite(blankValue) ? valueToRank(blankValue) : "the current value"}.`);
  }
  if ((state.higherHigherHigherRemaining || 0) > 0) {
    waiting.push(`Higher, Higher, Higher: ${state.higherHigherHigherRemaining} Higher ${state.higherHigherHigherRemaining === 1 ? "guess" : "guesses"} left.`);
  }
  if ((state.psychoRemaining || 0) > 0) {
    waiting.push(`Psycho: ${state.psychoRemaining} no-Cheat ${state.psychoRemaining === 1 ? "guess" : "guesses"} left.`);
  }
  if ((state.cheatACheaterRemaining || 0) > 0) {
    waiting.push(`You Can Cheat A Cheater: ${state.cheatACheaterRemaining} correct ${state.cheatACheaterRemaining === 1 ? "guess" : "guesses"} left.`);
  }
  if ((state.allInRemaining || 0) > 0) {
    waiting.push(`All In: ${state.allInRemaining} correct ${state.allInRemaining === 1 ? "guess" : "guesses"} left for +${(state.allInNudgeUpStake || 0) * 2}/+${(state.allInNudgeDownStake || 0) * 2} Nudges.`);
  }
  if (state.wlStage === "need_win") waiting.push("WL: win this guess, then lose the next.");
  if (state.wlStage === "need_loss") waiting.push("WL: lose this guess to claim 3 Cheats.");

  const powerNames = Array.isArray(state.powers)
    ? state.powers
        .filter((powerId) => !(typeof isNudgeChargePower === "function" && isNudgeChargePower(powerId)))
        .map((powerId) => getPowerById(powerId)?.name)
        .filter(Boolean)
    : [];

  const sections = [];
  if (waiting.length) {
    sections.push(`Waiting:\n${waiting.map((item) => `- ${item}`).join("\n")}`);
  }
  if (powerNames.length) {
    sections.push(`Powers active:\n${powerNames.join(", ")}`);
  }

  return {
    enabled: !!state.current && !state.openingPreview,
    title: "Active Effects",
    description: sections.length
      ? sections.join("\n\n")
      : "No Cheats or Powers are currently waiting to trigger.",
  };
}

function getCurrentCardTooltipPayload(card) {
  const activeEffectsPayload = getActiveEffectsTooltipPayload();
  if (!isJokerCard(card)) {
    return activeEffectsPayload;
  }

  const jokerName = getJokerName(card);
  const jokerDescription = card.description || "Yellow Jokers trigger their effect when revealed, then the run continues.";
  const sections = [
    jokerDescription,
    activeEffectsPayload.description,
  ].filter(Boolean);

  return {
    enabled: true,
    title: jokerName,
    description: sections.join("\n\n"),
  };
}

function setupCurrentCardEffectsTooltip(el, payload) {
  if (!el || el.dataset.currentEffectsTooltipInit === "1") {
    if (el) {
      el.dataset.tooltipEnabled = payload?.enabled ? "1" : "0";
      el.dataset.tooltipTitle = payload?.title || "";
      el.dataset.tooltipBody = payload?.description || "";
    }
    return;
  }

  let holdTimer = null;

  const clearHold = () => {
    clearTimeout(holdTimer);
    holdTimer = null;
    hideCheatTooltip();
  };

  el.addEventListener("pointerdown", (event) => {
    if (el.dataset.tooltipEnabled !== "1") return;
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    clearTimeout(holdTimer);
    if (event.pointerType === "mouse") {
      showTooltip(el.dataset.tooltipTitle, el.dataset.tooltipBody, el);
      return;
    }
    holdTimer = setTimeout(() => {
      showTooltip(el.dataset.tooltipTitle, el.dataset.tooltipBody, el);
    }, 300);
  });

  el.addEventListener("pointerup", clearHold);
  el.addEventListener("pointercancel", clearHold);
  el.addEventListener("pointerleave", clearHold);
  el.addEventListener("mouseenter", () => {
    if (!canUseHoverTooltips()) return;
    if (el.dataset.tooltipEnabled !== "1") return;
    showTooltip(el.dataset.tooltipTitle, el.dataset.tooltipBody, el);
  });
  el.addEventListener("mouseleave", clearHold);
  el.addEventListener("contextmenu", (event) => {
    if (el.dataset.tooltipEnabled !== "1") return;
    event.preventDefault();
  });

  el.dataset.currentEffectsTooltipInit = "1";
  el.dataset.tooltipRole = "current-effects";
  el.dataset.tooltipEnabled = payload?.enabled ? "1" : "0";
  el.dataset.tooltipTitle = payload?.title || "";
  el.dataset.tooltipBody = payload?.description || "";
}

const CHEAT_ICON_BY_NAME = Object.freeze({
  "Power Parity": "P3",
  "Emergency Services": "999",
  "Above 9?": "9↑",
  "Below 5?": "5↓",
  "5 or Under?": "5↓",
  "Between 5 and 9?": "5–9",
  "Is it an Ace?": "A?",
  "Is it a King?": "K?",
  "Ace ahead?": "A⋯",
  "King ahead?": "K⋯",
  "Number Remaining?": "#",
  "Total of Next Two": "Σ2",
  "Total of Next Three": "Σ3",
  "Total Above 12?": "12↑",
  "Total Above 20?": "20↑",
  "Total Under 10?": "10↓",
  "Total Under 15?": "15↓",
  "Prime Ahead?": "ℙ",
  "Product of Next Two": "∏2",
  "Top Half / Bottom Half": "◐",
  "Face Card Ahead?": "JQK",
  "What is it Not?": "NOT",
  "One of Next 2 Higher?": "2↑",
  "One of Next 2 Lower?": "2↓",
  "Higher of Next Two": "⇈",
  "Lower of Next Two": "⇊",
  "Next Card Parity": "⊕",
  "Chance Higher": "%↑",
  "Chance Lower": "%↓",
  "Nudge +1": "⇧1",
  "Nudge -1": "⇩1",
  "Nudge +2": "⇧2",
  "Nudge -2": "⇩2",
  "Next Card Nudge Up": "↥",
  "Next Card Nudge Down": "↧",
  "Halve It": "½",
  "Double Trouble": "2×",
  "Odd One Out": "O!",
  "Lucky 7": "7★",
  "Five Alive": "5♥",
  "6/7": "6⁄7",
  "Twin Peek": "◉◉",
  "Run Stopper": "⛔",
  "Bang Average": "AVG",
  "God Save The King": "♔",
  "Banish It": "BAN",
  "Jack Of All Trades": "J✦",
  "Fortune Teller": "🔮",
  "You Can Cheat A Cheater": "C²",
  "Suits You, Sir": "♣♦",
  "Cursed Shield": "⛨",
  "The Higher The Better": "⇈!",
  "The Lower The Better": "⇊!",
  "Suited and Booted": "♠B",
  "Always Bet On The Black": "♠♣",
  "Red? Dead? Redemption": "♥♦",
  "Margin Of Error": "±3",
  "Corporate Icebreaker": "💬",
  "Legends Ahead": "LA",
  "Emergency Cord": "EC",
  "Two's Company": "2C",
  "Refund": "RF",
  "Tear Corner": "◰",
  "Swap": "⇄",
  "+5 Energy": "⚡5",
});

function getCheatIcon(name) {
  if (name === "Lucky Dip") return "LD";
  if (name === "Split the Difference") return "DIFF";
  if (name === "False Shuffle") return "FS";
  if (name === "The River") return "RVR";
  if (name === "Lucky 13") return "13";
  if (name === "New Suits") return "NS";
  if (name === "All In") return "ALL";
  if (name === "Need The Nudge") return "N±";
  if (name === "Nudge, Nudge") return "N2";
  if (name === "Equals 11") return "=11";
  if (name === "WL") return "W/L";
  if (name === "Psycho") return "PSY";
  if (name === "Royal Flush") return "RF";
  if (name === "The Number Of The Beast") return "666";
  if (name === "Jackpot") return "777";
  if (name === "Higher, Higher, Higher") return "^^^";
  if (name === "Back To Square One") return "A1";
  if (name === "Flip That Frown") return "6/9";
  if (name === "King For A Day") return "K";
  if (name === "Reroll") return "RR";
  if (name === "9 to 5") return "9-5";
  if (name === "A Stitch In Time Saves...") return "9+";
  if (name === "Catch-22") return "22";
  if (name === "Sixth Sense") return "6?";
  if (name === "One Life Left") return "♥1";
  if (name === "Killer Queen") return "KQ";
  if (name === "Enchant") return "EN";
  return CHEAT_ICON_BY_NAME[name] || "✦";
}

function renderRestartButton() {
  const btn = document.getElementById("restart-btn");
  if (!btn) return;

  const runIsActive = !state.gameOver && !!state.current;
  const hasStartedRun = !state.openingPreview && Array.isArray(state.deck) && state.deck.length > 0;
  const runWasCompletelyCleared =
    state.gameOver &&
    typeof getRunScoreFromCorrectAnswers === "function" &&
    getRunScoreFromCorrectAnswers(state.correctAnswers) >= 52;
  if (state.saveScumPendingContinue && state.saveScumSnapshot) {
    btn.innerText = "RELOAD SAVE";
    btn.disabled = false;
    return;
  }
  if (state.runMode === "daily" && state.gameOver) {
    const variantLabel = typeof getDailyVariantConfig === "function"
      ? getDailyVariantConfig(state.dailyVariant).label || "Daily"
      : "Daily";
    btn.innerText = `${variantLabel} Complete`;
    btn.disabled = true;
    return;
  }

  btn.disabled = false;
  if (runIsActive) {
    btn.innerText = state.restartConfirmArmed ? "Confirm Restart" : "Restart Run";
    return;
  }

  btn.innerText = hasStartedRun
    ? (runWasCompletelyCleared ? "Main Menu" : "Restart Run")
    : "Start Run";
}

function renderStartPowerSelector() {
  const selectEl = document.getElementById("start-power-select");
  if (!selectEl) return;

  selectEl.innerHTML = "";

  const noneOption = document.createElement("option");
  noneOption.value = "none";
  noneOption.innerText = "No Power";
  selectEl.appendChild(noneOption);

  POWERS.forEach((power) => {
    const option = document.createElement("option");
    option.value = power.id;
    option.innerText = power.name;
    selectEl.appendChild(option);
  });

  const validPowerIds = POWERS.map((power) => power.id);

  let selected = state.selectedStartPowerId;

  if (!selected || selected === "none" || !validPowerIds.includes(selected)) {
    const nudgePower = POWERS.find((power) => power.name === "Nudge");
    selected = nudgePower ? nudgePower.id : (POWERS[0]?.id || "none");
    state.selectedStartPowerId = selected;
  }

  selectEl.value = selected;

  selectEl.onchange = () => {
    state.selectedStartPowerId = selectEl.value;
  };
}

function renderCheatGuide() {
  const listEl = document.getElementById("cheat-guide-list");
  if (!listEl) return;

  listEl.innerHTML = "";

  const cheatsToShow = [];
  const seenIds = new Set();

  state.cheats.forEach((cheat) => {
    if (!seenIds.has(cheat.id)) {
      cheatsToShow.push(cheat);
      seenIds.add(cheat.id);
    }
  });

  state.pendingCheatOptions.forEach((cheat) => {
    if (!seenIds.has(cheat.id)) {
      cheatsToShow.push(cheat);
      seenIds.add(cheat.id);
    }
  });

  if (!cheatsToShow.length) {
    const empty = document.createElement("div");
    empty.className = "cheat-guide-desc";
    empty.innerText =
      "Cheat descriptions will appear here for cheats in hand and current cheat choices.";
    listEl.appendChild(empty);
    return;
  }

  cheatsToShow.forEach((cheat) => {
    const item = document.createElement("div");
    item.className = "cheat-guide-item";

    const name = document.createElement("div");
    name.className = "cheat-guide-name";
    name.innerText = cheat.name;

    const desc = document.createElement("div");
    desc.className = "cheat-guide-desc";
    desc.innerText = CHEAT_DESCRIPTIONS[cheat.name] || "No description yet.";

    item.appendChild(name);
    item.appendChild(desc);
    listEl.appendChild(item);
  });
}

function renderActivePowers() {
  const activePowersEl = document.getElementById("active-powers");
  if (!activePowersEl) return;

  const ownedPower = getPowerById(state.selectedStartPowerId);

  if (!ownedPower) {
    activePowersEl.innerText = "Power chosen when the run starts.";
    return;
  }

  activePowersEl.innerHTML = `
    <div class="power-summary">
      <div class="power-summary-name">${ownedPower.name}</div>
      <div class="power-summary-desc">${getPowerDescription(ownedPower)}</div>
    </div>
  `;
}

function renderCardFaceMarkup(card, displayValue, isTemporarilyModified, includeTornCorner, options = {}) {
  if (isJokerCard(card)) {
    return `
      <div class="joker-card-corner">JOKER</div>
      <div class="joker-card-icon">${card.icon || "!"}</div>
      <div class="joker-card-name">${getJokerName(card)}</div>
      <div class="joker-card-copy">${card.description || "Yellow hazard"}</div>
    `;
  }
  const showShieldBadge = !!options.showShieldBadge;
  const lifeBadgeCount = Math.max(0, Number(options.lifeBadgeCount) || 0);
  const insuranceBadgeCount = Math.max(0, Number(options.insuranceBadgeCount) || 0);
  const shownRank = isTemporarilyModified ? valueToRank(displayValue) : card.rank;
  const nudgeFromRank = Number.isFinite(options.nudgeFromValue)
    ? valueToRank(options.nudgeFromValue)
    : "";
  const nudgeValueActive = !!nudgeFromRank && nudgeFromRank !== shownRank;
  const isNewTheme = document.body.dataset.visuals === "new";
  const minimalFacePreview = isNewTheme && !!options.minimalFacePreview && isFaceRank(shownRank);
  const pipLayout = isNewTheme && !options.suppressPips ? getCardPipLayout(shownRank) : null;
  const faceCardArt = isNewTheme ? getFaceCardImagePath(card, shownRank) : "";
  const labelHtml = isNewTheme
    ? `<div class="card-corner card-corner-tl"><span class="card-rank ${nudgeValueActive ? "card-nudge-new-rank" : ""}">${shownRank}</span>${minimalFacePreview ? "" : `<span class="card-suit" data-suit="${card.suit}" aria-hidden="true"></span>`}</div>${faceCardArt ? renderFaceCardArtMarkup(faceCardArt, shownRank, card.suit) : (minimalFacePreview ? "" : (pipLayout ? renderPipGridMarkup(card.suit, shownRank, pipLayout) : `<div class="card-center-suit" data-suit="${card.suit}" aria-hidden="true"></div>`))}<div class="card-corner card-corner-br" aria-hidden="true"><span class="card-rank ${nudgeValueActive ? "card-nudge-new-rank" : ""}">${shownRank}</span>${minimalFacePreview ? "" : `<span class="card-suit" data-suit="${card.suit}"></span>`}</div>`
    : `<span class="card-face-label ${nudgeValueActive ? "card-nudge-new-label" : ""}">${shownRank}${card.suit}</span>`;
  const nudgeOldRankHtml = nudgeValueActive
    ? isNewTheme
      ? `<span class="card-nudge-old-rank card-nudge-old-rank-tl">${nudgeFromRank}</span><span class="card-nudge-old-rank card-nudge-old-rank-br" aria-hidden="true">${nudgeFromRank}</span>`
      : `<span class="card-nudge-old-label">${nudgeFromRank}${card.suit}</span>`
    : "";
  const enchantHtml = options.isEnchanted
    ? '<span class="card-enchant-sparkles" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></span>'
    : "";
  return `
    ${labelHtml}
    ${nudgeOldRankHtml}
    ${enchantHtml}
    ${isTemporarilyModified ? '<span class="card-temp-chip">TEMP</span>' : ""}
    ${showShieldBadge ? '<span class="card-shield-badge" aria-label="Cursed Shield active" title="Cursed Shield active">🛡️</span>' : ""}
    ${lifeBadgeCount > 0 ? `<span class="card-life-badge" aria-label="${lifeBadgeCount} ${lifeBadgeCount === 1 ? "life" : "lives"} left" title="${lifeBadgeCount} ${lifeBadgeCount === 1 ? "life" : "lives"} left"><span aria-hidden="true">♥</span>${lifeBadgeCount > 1 ? `<span class="card-life-count">${lifeBadgeCount}</span>` : ""}</span>` : ""}
    ${insuranceBadgeCount > 0 ? `<span class="card-insurance-badge" aria-label="${insuranceBadgeCount} insurance ${insuranceBadgeCount === 1 ? "save" : "saves"} left" title="${insuranceBadgeCount} insurance ${insuranceBadgeCount === 1 ? "save" : "saves"} left"><span aria-hidden="true">!</span>${insuranceBadgeCount > 1 ? `<span class="card-life-count">${insuranceBadgeCount}</span>` : ""}</span>` : ""}
    ${includeTornCorner ? '<span class="tear-mark-face"></span>' : ""}
  `;
}

function applyCardBackCosmeticToElement(cardBackEl) {
  if (!cardBackEl || typeof getSelectedCardBackCosmetic !== "function") return;
  const cosmetic = getSelectedCardBackCosmetic();
  cardBackEl.classList.remove(
    "has-card-back-cosmetic",
    "card-back-cosmetic-classic",
    "card-back-cosmetic-midnight-stars",
    "card-back-cosmetic-neon-table",
    "card-back-cosmetic-royal-felt",
    "card-back-cosmetic-oll-logo",
    "card-back-cosmetic-muse-logo",
  );
  if (!cosmetic || cosmetic.id === "classic") {
    cardBackEl.style.removeProperty("--card-back-cosmetic-image");
    return;
  }
  cardBackEl.classList.add("has-card-back-cosmetic", cosmetic.previewClass || "");
  if (cosmetic.image) {
    cardBackEl.style.setProperty("--card-back-cosmetic-image", `url("${cosmetic.image}")`);
  } else {
    cardBackEl.style.removeProperty("--card-back-cosmetic-image");
  }
}

function isFaceRank(rank) {
  return rank === "J" || rank === "Q" || rank === "K";
}

function getFaceCardImagePath(card, shownRank) {
  const rankName = {
    J: "jack",
    Q: "queen",
    K: "king",
  }[String(shownRank || "").toUpperCase()];
  const suitName = {
    "♣": "clubs",
    "♦": "diamonds",
    "♥": "hearts",
    "♠": "spades",
  }[card?.suit || ""];
  return rankName && suitName ? `images/face_cards/${rankName}_${suitName}.png` : "";
}

function renderFaceCardArtMarkup(src, rank, suit) {
  return `<img class="card-court-art" src="${src}" alt="" data-rank="${rank}" data-suit="${suit}" aria-hidden="true" draggable="false">`;
}

function getCardPipLayout(rank) {
  const layouts = {
    A: [{ pos: "c", large: true }],
    "2": [{ pos: "tc" }, { pos: "bc", invert: true }],
    "3": [{ pos: "tc" }, { pos: "c" }, { pos: "bc", invert: true }],
    "4": [{ pos: "tl" }, { pos: "tr" }, { pos: "bl", invert: true }, { pos: "br", invert: true }],
    "5": [{ pos: "tl" }, { pos: "tr" }, { pos: "c" }, { pos: "bl", invert: true }, { pos: "br", invert: true }],
    "6": [{ pos: "tl" }, { pos: "ml" }, { pos: "bl", invert: true }, { pos: "tr" }, { pos: "mr" }, { pos: "br", invert: true }],
    "7": [{ pos: "tl" }, { pos: "tr" }, { pos: "uc" }, { pos: "ml" }, { pos: "mr" }, { pos: "bl", invert: true }, { pos: "br", invert: true }],
    "8": [{ pos: "tl" }, { pos: "uml" }, { pos: "lml", invert: true }, { pos: "bl", invert: true }, { pos: "tr" }, { pos: "umr" }, { pos: "lmr", invert: true }, { pos: "br", invert: true }],
    "9": [{ pos: "tl" }, { pos: "uml" }, { pos: "lml", invert: true }, { pos: "bl", invert: true }, { pos: "tr" }, { pos: "umr" }, { pos: "lmr", invert: true }, { pos: "br", invert: true }, { pos: "c" }],
    "10": [{ pos: "tl" }, { pos: "tr" }, { pos: "uc" }, { pos: "uml" }, { pos: "umr" }, { pos: "lml", invert: true }, { pos: "lmr", invert: true }, { pos: "lc", invert: true }, { pos: "bl", invert: true }, { pos: "br", invert: true }],
  };
  return layouts[String(rank || "").toUpperCase()] || null;
}

function renderPipGridMarkup(suit, rank, layout) {
  const pips = layout.map((pip) => {
    const classes = [
      "card-pip",
      `card-pip-${pip.pos}`,
      pip.invert ? "card-pip-invert" : "",
      pip.large ? "card-pip-large" : "",
    ].filter(Boolean).join(" ");
    return `<span class="${classes}" data-suit="${suit}" aria-hidden="true"></span>`;
  }).join("");
  return `<div class="card-pip-grid card-pip-grid-${String(rank || "").toLowerCase()}" aria-hidden="true">${pips}</div>`;
}

function renderBlankSpaceFaceMarkup(displayValue) {
  const shownValue = Number.isFinite(displayValue) ? valueToRank(displayValue) : "?";
  return `
    <div class="blank-space-chip">BLANK CARD</div>
    <div class="blank-space-icon">[]</div>
    <div class="blank-space-copy">Next card treated as</div>
    <div class="blank-space-value">${shownValue}</div>
  `;
}

function renderCurrentCard() {
  const currentCardEl = document.getElementById("current-card");
  const currentValueEl = document.getElementById("current-effective-value");

  if (!currentCardEl || !currentValueEl) return;

  const pendingReveal = state.pendingRevealAnimation;
  const gameOverCards = state.gameOver ? state.gameOverDisplayCards : null;
  const showPinnedCurrentCard = !!pendingReveal && !!pendingReveal.fromCard;
  const cardToRender = pendingReveal?.initialDeal
    ? null
    : showPinnedCurrentCard
      ? pendingReveal.fromCard
      : gameOverCards?.leftCard || state.current;

  if (!cardToRender) {
    currentCardEl.className = `card-empty-slot${getPreservedTutorialFocusClass(currentCardEl)}`.trim();
    currentCardEl.innerHTML = "";
    setupCurrentCardEffectsTooltip(currentCardEl, { enabled: false });
    currentValueEl.innerText = "";
    return;
  }

  const backStatus = getCardBackStatus(cardToRender.id);
  const isEnchantedCard = !!backStatus.enchanted || state.recentEnchantedRevealCardId === cardToRender.id;
  const effectiveValue = showPinnedCurrentCard
    ? pendingReveal.fromEffectiveValue
    : gameOverCards?.leftCard && cardToRender.id === gameOverCards.leftCard.id
      ? gameOverCards.leftEffectiveValue
      : getCurrentEffectiveValue();
  const isTemporarilyModified = showPinnedCurrentCard
    ? !!pendingReveal.fromIsTemp
    : gameOverCards?.leftCard && cardToRender.id === gameOverCards.leftCard.id
      ? !!gameOverCards.leftIsTemp
      : effectiveValue !== cardToRender.value || Number.isFinite(typeof getTemporaryCardValue === "function" ? getTemporaryCardValue(cardToRender) : null);
  const feedbackClass = state.currentCardFeedback
    ? `feedback-${state.currentCardFeedback}`
    : "";
  const nudgeAnimation = state.currentNudgeAnimation?.cardId === cardToRender.id
    ? state.currentNudgeAnimation
    : null;
  const nudgeClass = nudgeAnimation
    ? `nudge-animate nudge-${nudgeAnimation.direction === "down" ? "down" : "up"}`
    : "";

  currentCardEl.className = `card-face ${isJokerCard(cardToRender) ? "joker-card-face" : (isRed(cardToRender) ? "red" : "black")} ${backStatus.tornCorner ? "torn-corner-face" : ""} ${isEnchantedCard ? "enchanted-card-face" : ""} ${isTemporarilyModified ? "temporary-value" : ""} ${feedbackClass} ${nudgeClass}${getPreservedTutorialFocusClass(currentCardEl)}`.trim();
  currentCardEl.innerHTML = renderCardFaceMarkup(
    cardToRender,
    effectiveValue,
    isTemporarilyModified,
    backStatus.tornCorner,
    {
      showShieldBadge: (Number(state.cursedShieldCharges) || 0) > 0 || !!state.cursedShieldArmed,
      lifeBadgeCount: state.oneLifeLeftLives || 0,
      insuranceBadgeCount: state.insuranceLives || 0,
      nudgeFromValue: nudgeAnimation?.fromValue,
      isEnchanted: isEnchantedCard,
    }
  );
  const currentCardTooltipPayload = getCurrentCardTooltipPayload(cardToRender);
  setupCurrentCardEffectsTooltip(currentCardEl, currentCardTooltipPayload);
  currentCardEl.classList.toggle("has-active-effects-tooltip", currentCardTooltipPayload.enabled);
  currentCardEl.setAttribute(
    "aria-label",
    isJokerCard(cardToRender)
      ? `${describeCard(cardToRender)}. Hold to view Joker effect.`
      : `${describeCard(cardToRender)}. Hold to view active effects.`
  );

  currentValueEl.innerText = "";
}

function formatNudgedPercentage(nudgedUses, totalUses) {
  if (!totalUses) return "0%";
  return `${Math.round((nudgedUses / totalUses) * 100)}%`;
}

function formatRiskPercentage(endedRuns, totalUses) {
  if (!totalUses) return "0%";
  return `${Math.round((endedRuns / totalUses) * 100)}%`;
}

function getRedDeckStatsSummary(entry) {
  const blueFaceUpUses = entry.nudgeStats?.blueFaceUpUses || 0;
  const blueNudgedUses = entry.nudgeStats?.blueNudgedUses || 0;
  const totalUpAmount = entry.nudgeStats?.totalUpAmount || 0;
  const totalDownAmount = entry.nudgeStats?.totalDownAmount || 0;

  return {
    seenCount: blueFaceUpUses,
    nudgedCount: blueNudgedUses,
    nudgedPercent: formatNudgedPercentage(blueNudgedUses, blueFaceUpUses),
    upTotal: totalUpAmount,
    downTotal: totalDownAmount,
  };
}

function getRedDeckStatsTooltipBody(entry) {
  const summary = getRedDeckStatsSummary(entry);
  return [
    "Seen: times this card has been face up in Blue runs.",
    `Nudged: percentage of those face-up turns where players nudged it at least once (${summary.nudgedCount}/${summary.seenCount}).`,
    "Up / Down: total upward vs downward nudge amount applied while this card was face up.",
    `Up / Down totals: ${summary.upTotal} up, ${summary.downTotal} down.`,
  ].join("\n");
}

function setupDeckStatsTooltip(el, payload) {
  if (!el || el.dataset.deckStatsTooltipInit === "1") {
    if (el) {
      el.dataset.tooltipEnabled = payload?.enabled ? "1" : "0";
      el.dataset.tooltipTitle = payload?.title || "";
      el.dataset.tooltipBody = payload?.description || "";
    }
    return;
  }

  let holdTimer = null;

  const clearHold = () => {
    clearTimeout(holdTimer);
    holdTimer = null;
    hideCheatTooltip();
  };

  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    if (el.dataset.tooltipEnabled !== "1") return;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      showTooltip(el.dataset.tooltipTitle, el.dataset.tooltipBody, el);
    }, 300);
  });

  el.addEventListener("pointerup", clearHold);
  el.addEventListener("pointercancel", clearHold);
  el.addEventListener("pointerleave", clearHold);
  el.addEventListener("mouseenter", () => {
    if (!canUseHoverTooltips()) return;
    if (el.dataset.tooltipEnabled !== "1") return;
    showTooltip(el.dataset.tooltipTitle, el.dataset.tooltipBody, el);
  });
  el.addEventListener("mouseleave", clearHold);

  el.dataset.deckStatsTooltipInit = "1";
  el.dataset.tooltipRole = "deck-stats";
  el.dataset.tooltipEnabled = payload?.enabled ? "1" : "0";
  el.dataset.tooltipTitle = payload?.title || "";
  el.dataset.tooltipBody = payload?.description || "";
}

function renderNudgeControls() {
  const upBtn = document.getElementById("nudge-up-btn");
  const downBtn = document.getElementById("nudge-down-btn");
  const upCountEl = document.getElementById("nudge-up-count");
  const downCountEl = document.getElementById("nudge-down-count");
  const cheatsPanel = document.getElementById("cheats-panel");

  if (!upBtn || !downBtn || !upCountEl || !downCountEl) return;

  const upCount = state.nudgeUpCharges || 0;
  const downCount = state.nudgeDownCharges || 0;

  upCountEl.innerText = String(upCount);
  downCountEl.innerText = String(downCount);
  upBtn.setAttribute("aria-label", `Nudge Up, ${upCount} charge${upCount === 1 ? "" : "s"} available`);
  downBtn.setAttribute("aria-label", `Nudge Down, ${downCount} charge${downCount === 1 ? "" : "s"} available`);

  const isBlocked =
    state.gameOver ||
    !state.current ||
    !!state.pendingRevealAnimation ||
    state.pendingCheatOptions.length > 0 ||
    state.pendingPowerOptions.length > 0 ||
    (state.psychoRemaining || 0) > 0 ||
    (state.nineDartRemaining || 0) > 0 ||
    !!state.pauseForCheat;

  const revealLocked = !!state.pendingRevealAnimation;
  upBtn.classList.toggle("keep-bright", revealLocked);
  downBtn.classList.toggle("keep-bright", revealLocked);
  if (cheatsPanel) {
    cheatsPanel.classList.toggle("nudge-order-up-down", loadNudgeButtonOrder() === "up-down");
  }

  upBtn.disabled = isBlocked || !canUseNudge("up");
  downBtn.disabled = isBlocked || !canUseNudge("down");
}

function renderFaceDownDeck() {
  const deckEl = document.getElementById("face-down-deck");
  const remainingValueEl = document.getElementById("cards-remaining-value");

  if (!deckEl) return;

  if (!state.pendingRevealAnimation) {
    setRevealOverlayHidden(true);
  }

  if (!state.current) {
    deckEl.innerHTML = "";
    const idleDeckBackColor = getDeckBackColor(state.currentDeckKey || state.selectedDeckKey);
    deckEl.className = `card-back card-back-${idleDeckBackColor}${getPreservedTutorialFocusClass(deckEl)}`;
    applyCardBackCosmeticToElement(deckEl);
    deckEl.removeAttribute("data-back-color");
    if (remainingValueEl) {
      const openingCount = Array.isArray(state.deck) ? state.deck.length : 0;
      setAnimatedText(remainingValueEl, String(openingCount).padStart(2, "0"));
    }
    return;
  }

  const gameOverCards = state.gameOver ? state.gameOverDisplayCards : null;
  if (gameOverCards?.rightCard && !state.pendingRevealAnimation) {
    const revealCard = gameOverCards.rightCard;
    const revealStatus = getCardBackStatus(revealCard.id);
    const storedTemporaryValue = typeof getTemporaryCardValue === "function"
      ? getTemporaryCardValue(revealCard)
      : null;
    const revealValue = Number.isFinite(gameOverCards.rightEffectiveValue)
      ? gameOverCards.rightEffectiveValue
      : Number.isFinite(storedTemporaryValue)
        ? storedTemporaryValue
        : revealCard.value;
    const revealIsTemp = !!gameOverCards.rightIsTemp || Number.isFinite(storedTemporaryValue);
    const revealIsEnchanted = !!revealStatus.enchanted || state.recentEnchantedRevealCardId === revealCard.id;

    deckEl.className = `card-face ${isJokerCard(revealCard) ? "joker-card-face" : (isRed(revealCard) ? "red" : "black")} ${revealStatus.tornCorner ? "torn-corner-face" : ""} ${revealIsEnchanted ? "enchanted-card-face" : ""} ${revealIsTemp ? "temporary-value" : ""}${getPreservedTutorialFocusClass(deckEl)}`.trim();
    deckEl.innerHTML = renderCardFaceMarkup(
      revealCard,
      revealValue,
      revealIsTemp,
      revealStatus.tornCorner,
      { isEnchanted: revealIsEnchanted }
    );
    deckEl.removeAttribute("data-back-color");
    deckEl.classList.remove("has-deck-stats-tooltip");
    setupDeckStatsTooltip(deckEl, {
      enabled: false,
      title: "",
      description: "",
    });

    const remainingCount = getFaceDownCount();
    if (remainingValueEl) {
      setAnimatedText(remainingValueEl, String(remainingCount).padStart(2, "0"));
    }
    return;
  }

  const next = peekNext();
  if (!next) {
    deckEl.className = `card-empty-slot${getPreservedTutorialFocusClass(deckEl)}`.trim();
    deckEl.innerHTML = "";
    deckEl.removeAttribute("data-back-color");
    deckEl.classList.remove("has-deck-stats-tooltip");
    setupDeckStatsTooltip(deckEl, {
      enabled: false,
      title: "",
      description: "",
    });
    if (remainingValueEl) {
      setAnimatedText(remainingValueEl, "00");
    }
    return;
  }

  const backStatus = next
    ? getCardBackStatus(next.id)
    : { tornCorner: false, enchanted: false, backColor: "blue" };
  const blankSpaceActive = !!next && typeof isBlankSpaceActiveForNextCard === "function" && isBlankSpaceActiveForNextCard(next);

  const backColor = getDeckBackColor(state.currentDeckKey);
  const shouldShowDeckStatsInline = !!next && !blankSpaceActive && normalizeDeckKey(state.currentDeckKey) === "red";

  const tutorialFocusClass = getPreservedTutorialFocusClass(deckEl);
  deckEl.className = blankSpaceActive
    ? `card-face blank-space-face ${backStatus.tornCorner ? "torn-corner-face" : ""}${tutorialFocusClass}`.trim()
    : shouldShowDeckStatsInline
      ? `card-face red card-stats-face ${backStatus.tornCorner ? "torn-corner-back" : ""}${tutorialFocusClass}`.trim()
      : `card-back card-back-${backColor} ${backStatus.tornCorner ? "torn-corner" : ""}${tutorialFocusClass}`.trim();
  if (!blankSpaceActive && !shouldShowDeckStatsInline) {
    applyCardBackCosmeticToElement(deckEl);
  }
  if (blankSpaceActive) {
    deckEl.removeAttribute("data-back-color");
  } else {
    deckEl.setAttribute("data-back-color", backColor);
  }
  deckEl.innerHTML = "";

  if (blankSpaceActive) {
    deckEl.innerHTML = renderBlankSpaceFaceMarkup(getUpcomingCheatValue(1));
  } else if (!shouldShowDeckStatsInline) {
    const symbol = document.createElement("div");
    symbol.className = "card-back-symbol";
    symbol.innerText = "🂠";
    deckEl.appendChild(symbol);
    const temporaryMark = state.temporaryCardBackMarks?.[next.id] || "";
    if (temporaryMark) {
      const mark = document.createElement("div");
      mark.className = "temporary-card-back-mark";
      mark.innerText = temporaryMark;
      deckEl.appendChild(mark);
    }
  }

  if (backStatus.tornCorner && !blankSpaceActive) {
    const tear = document.createElement("div");
    tear.className = "tear-mark-back";
    deckEl.appendChild(tear);
  }

  if (blankSpaceActive) {
    deckEl.classList.remove("has-deck-stats-tooltip");
    setupDeckStatsTooltip(deckEl, {
      enabled: false,
      title: "",
      description: "",
    });
  } else if (shouldShowDeckStatsInline) {
    const entry = getCardStatsEntry(next.id);
    const statsSummary = getRedDeckStatsSummary(entry);
    const tooltipTitle = `${describeCard(next)} Red Stats`;
    const tooltipBody = getRedDeckStatsTooltipBody(entry);

    const statsBox = document.createElement("div");
    statsBox.className = "card-back-stats";
    statsBox.innerHTML = `
      <div class="card-back-stats-top">
        <div class="card-back-stats-kicker">Nudged</div>
        <div class="card-back-stats-primary">${statsSummary.nudgedPercent}</div>
        <div class="card-back-stats-sub">${statsSummary.nudgedCount} of ${statsSummary.seenCount} seen</div>
      </div>
      <div class="card-back-stats-split">
        <div class="card-back-stats-metric card-back-stats-up">
          <div class="card-back-stats-metric-label">Up</div>
          <div class="card-back-stats-metric-value">${statsSummary.upTotal}</div>
        </div>
        <div class="card-back-stats-metric card-back-stats-down">
          <div class="card-back-stats-metric-label">Down</div>
          <div class="card-back-stats-metric-value">${statsSummary.downTotal}</div>
        </div>
      </div>
    `;
    deckEl.appendChild(statsBox);
    deckEl.classList.add("has-deck-stats-tooltip");
    setupDeckStatsTooltip(deckEl, {
      enabled: true,
      title: tooltipTitle,
      description: tooltipBody,
    });
  } else {
    deckEl.classList.remove("has-deck-stats-tooltip");
    setupDeckStatsTooltip(deckEl, {
      enabled: false,
      title: "",
      description: "",
    });
  }

  const remainingCount = getFaceDownCount();
  if (remainingValueEl) {
    setAnimatedText(remainingValueEl, String(remainingCount).padStart(2, "0"));
  }
}

function renderButtons() {
  const controls = document.getElementById("controls");
  const restartBtn = document.getElementById("restart-btn");
  const higherBtn = document.getElementById("higher-btn");
  const lowerBtn = document.getElementById("lower-btn");
  if (!controls || !restartBtn || !higherBtn || !lowerBtn) return;

  const showingChoiceModal = state.pendingPowerOptions.length > 0 || state.pendingCheatOptions.length > 0;
  const revealInFlight = !!state.pendingRevealAnimation;
  const runIsActive = !!state.current && (!state.gameOver || revealInFlight);
  const showRestartButton = !runIsActive;
  const hideControls = showingChoiceModal;

  controls.hidden = false;
  controls.setAttribute("aria-hidden", hideControls ? "true" : "false");
  controls.style.display = "";
  controls.classList.toggle("is-modal-hidden", hideControls);
  controls.classList.toggle("controls-single", showRestartButton);
  controls.classList.toggle("button-order-higher-lower", loadGuessButtonOrder() === "higher-lower");

  restartBtn.hidden = !showRestartButton;
  higherBtn.hidden = showRestartButton;
  lowerBtn.hidden = showRestartButton;

  if (hideControls) {
    restartBtn.disabled = true;
    higherBtn.disabled = true;
    lowerBtn.disabled = true;
    return;
  }

  if (showRestartButton) {
    higherBtn.disabled = true;
    lowerBtn.disabled = true;
    return;
  }

  const tutorialBlocked = typeof window.isTutorialGuessButtonsDisabled === "function"
    ? window.isTutorialGuessButtonsDisabled()
    : false;
  const tutorialGuidedGuessActive = typeof window.tutorialController?.isGuidedGuessStep === "function"
    ? window.tutorialController.isGuidedGuessStep()
    : false;
  const isPause = !!state.pauseForCheat;

  if (tutorialGuidedGuessActive) {
    const forceDisabled =
      state.gameOver ||
      !state.current ||
      revealInFlight ||
      state.pendingCheatOptions.length > 0 ||
      state.pendingPowerOptions.length > 0 ||
      isPause;
    higherBtn.disabled = forceDisabled;
    lowerBtn.disabled = forceDisabled;
    return;
  }

  // Block input if pausing before cheat selection
  const disableGuessing =
    state.gameOver ||
    !state.current ||
    revealInFlight ||
    state.pendingCheatOptions.length > 0 ||
    state.pendingPowerOptions.length > 0 ||
    isPause ||
    tutorialBlocked;

  higherBtn.disabled = disableGuessing;
  lowerBtn.disabled = disableGuessing;
}

function renderHandCard() {
  const handEl = document.getElementById("swap-card");
  if (!handEl) return;

  if (!state.handCard) {
    handEl.innerText = "Empty";
    handEl.className = "";
    return;
  }

  handEl.innerText = describeCard(state.handCard);
  handEl.className = isRed(state.handCard) ? "red" : "black";
}

function buildCheatButtonMarkup(title, iconGlyph, count = 0, countLabel = "") {
  return `
    <div class="cheat-icon">${iconGlyph}</div>
    <div class="cheat-name">${title}</div>
    <div class="cheat-count-label" ${countLabel ? "" : "hidden"}>${countLabel}</div>
    <div class="cheat-stack-count" ${count > 1 && !countLabel ? "" : "hidden"}>x${count}</div>
  `;
}

function shouldConsumeCheatAfterUse(cheat, result) {
  if (!cheat) return false;
  if (typeof cheat.shouldConsumeResult === "function") {
    return !!cheat.shouldConsumeResult(result);
  }
  return !!cheat.consumeOnUse;
}

function updateCheatOverflowIndicators() {
  const cheatList = document.getElementById("cheat-list");
  const cheatsPanel = document.getElementById("cheats-panel");
  if (!cheatList || !cheatsPanel) return;

  const maxScrollLeft = Math.max(0, cheatList.scrollWidth - cheatList.clientWidth);
  const scrollLeft = Math.max(0, cheatList.scrollLeft);
  const hasOverflow = maxScrollLeft > 6;
  const showLeft = hasOverflow && scrollLeft > 6;
  const showRight = hasOverflow && scrollLeft < maxScrollLeft - 6;

  cheatsPanel.dataset.overflowLeft = showLeft ? "true" : "false";
  cheatsPanel.dataset.overflowRight = showRight ? "true" : "false";
  cheatsPanel.dataset.hasOverflow = hasOverflow ? "true" : "false";
}

function getCheatChoiceRarityLabel(cheat) {
  return (cheat?.rarity || "common").replace(/^\w/, (c) => c.toUpperCase());
}

function hideCheatChoiceFlyout() {
  const flyoutEl = document.getElementById("cheat-choice-flyout");
  if (!flyoutEl) return;
  flyoutEl.className = "hidden";
  flyoutEl.setAttribute("aria-hidden", "true");
  flyoutEl.innerHTML = "";
  flyoutEl.removeAttribute("style");
}

function hidePowerChoiceFlyout() {
  const flyoutEl = document.getElementById("power-choice-flyout");
  if (!flyoutEl) return;
  flyoutEl.className = "hidden";
  flyoutEl.setAttribute("aria-hidden", "true");
  flyoutEl.innerHTML = "";
  flyoutEl.removeAttribute("style");
  if (powerChoiceFlyoutHomeParent && flyoutEl.parentNode !== powerChoiceFlyoutHomeParent) {
    powerChoiceFlyoutHomeParent.insertBefore(flyoutEl, powerChoiceFlyoutHomeNextSibling);
  }
}

function buildPowerChoiceShieldMarkup(power) {
  return `
    ${POWER_SHIELD_SVG}
    <div class="choice-top">
      <div class="choice-name">${power.name}</div>
      <div class="choice-rarity">${getPowerRarityLabel(power)}</div>
    </div>
    <div class="choice-bottom">
      <div class="choice-icon">${getPowerIcon(power.id)}</div>
    </div>
  `;
}

function renderCheatChoiceInfo(infoEl, cheat, promptText = "") {
  if (!infoEl) return;

  if (!cheat) {
    infoEl.innerHTML = `<div class="cheat-choice-info-copy">${promptText || "Tap a cheat to read the description."}</div>`;
    return;
  }

  const rarityLabel = getCheatChoiceRarityLabel(cheat);
  const rarityClass = `rarity-${cheat?.rarity || "common"}`;
  infoEl.innerHTML = `
    <div class="cheat-choice-info-title">${cheat.name}</div>
    <div class="cheat-choice-info-rarity ${rarityClass}">${rarityLabel}</div>
    <div class="cheat-choice-info-copy">${getCheatDescription(cheat)}</div>
    <div class="cheat-choice-info-hint">Tap again to select</div>
  `;
}

function completeCheatChoiceSelectionAnimation(followup) {
  if (state.cheatChoiceAnimating?.targetEntryId) {
    suppressNextCheatEntryIntroId = state.cheatChoiceAnimating.targetEntryId;
  }
  hideCheatChoiceFlyout();
  clearPendingCheatChoiceTimer();
  state.cheatChoiceAnimating = null;
  if (typeof runDeferredCheatChoiceFollowup === "function") {
    runDeferredCheatChoiceFollowup(followup);
    window.setTimeout(flushPendingExperienceBonusesIfReady, 80);
    return;
  }
  render();
  window.setTimeout(flushPendingExperienceBonusesIfReady, 80);
}

function beginCheatChoiceSelection(index, buttonEl) {
  const cheat = state.pendingCheatOptions[index];
  if (!cheat || !buttonEl || state.cheatChoiceAnimating) return;

  const choiceCards = Array.from(document.querySelectorAll("#cheat-choice-list .cheat-choice-card"));
  choiceCards.forEach((el) => {
    el.style.animation = "none";
    el.style.transition = "none";
    el.style.transform = "none";
    el.style.opacity = "1";
    el.classList.remove("choice-intro");
  });
  void buttonEl.offsetWidth;

  const optionsSnapshot = state.pendingCheatOptions.map((option) => ({ ...option }));
  const sourceRect = buttonEl.getBoundingClientRect();
  const selectionResult = pickCheatFromChoice(index, { deferFollowup: true, suppressRender: true });

  if (cheat.id === "green_energy_boost") {
    hideCheatChoiceFlyout();
    clearPendingCheatChoiceTimer();
    state.cheatChoiceAnimating = null;
    state.cheatChoicePreviewIndex = -1;
    cheatChoiceConfirmIndex = -1;
    cheatChoiceConfirmAfter = 0;
    if (typeof runDeferredCheatChoiceFollowup === "function") {
      runDeferredCheatChoiceFollowup(selectionResult?.followup || { type: "render" });
      window.setTimeout(flushPendingExperienceBonusesIfReady, 80);
      return;
    }
    render();
    window.setTimeout(flushPendingExperienceBonusesIfReady, 80);
    return;
  }

  state.cheatChoiceAnimating = {
    stage: "closing",
    started: false,
    selectedIndex: index,
    cheat: selectionResult?.cheat || { ...cheat },
    optionsSnapshot,
    sourceRect: {
      left: sourceRect.left,
      top: sourceRect.top,
      width: sourceRect.width,
      height: sourceRect.height,
    },
    targetEntryId: selectionResult?.targetEntryId || cheat.id,
    followup: selectionResult?.followup || { type: "render" },
  };
  state.cheatChoicePreviewIndex = -1;
  cheatChoiceConfirmIndex = -1;
  cheatChoiceConfirmAfter = 0;
  render();
}

function getCheatChoiceFlyTargetRect(targetEntryId, fallbackEl) {
  if (targetEntryId === "nudge_up" || targetEntryId === "nudge_down") {
    const nudgeTargetEl = document.getElementById(targetEntryId === "nudge_up" ? "nudge-up-btn" : "nudge-down-btn");
    const nudgeTargetRect = nudgeTargetEl?.getBoundingClientRect();
    if (nudgeTargetRect?.width && nudgeTargetRect?.height) {
      return nudgeTargetRect;
    }
  }

  const targetEl = document.querySelector(`#cheat-list [data-cheat-entry-id="${CSS.escape(targetEntryId || "")}"]`);
  const targetRect = (targetEl || fallbackEl)?.getBoundingClientRect();
  return targetRect;
}

function beginPowerChoiceSelection(index, buttonEl) {
  const power = state.pendingPowerOptions[index];
  if (!power || !buttonEl || state.powerChoiceAnimating) return;

  const optionEls = Array.from(document.querySelectorAll("#power-choice-list .power-choice-option"));
  optionEls.forEach((el) => {
    el.style.animation = "none";
    el.style.transition = "none";
    el.style.transform = "none";
    el.style.opacity = "1";
    el.classList.remove("choice-intro");
  });
  void buttonEl.offsetWidth;

  const sourceRect = buttonEl.getBoundingClientRect();
  state.powerChoiceAnimating = {
    stage: "closing",
    started: false,
    selectedIndex: index,
    power: { ...power },
    optionsSnapshot: state.pendingPowerOptions.map((option) => ({ ...option })),
    sourceRect: {
      left: sourceRect.left,
      top: sourceRect.top,
      width: sourceRect.width,
      height: sourceRect.height,
    },
  };
  render();
}

function getChoiceFlyoutHostRect(flyoutEl) {
  const hostEl = flyoutEl.closest("#game");
  if (!hostEl) {
    return { left: 0, top: 0 };
  }
  const rect = hostEl.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
  };
}

function completePowerChoiceSelectionAnimation() {
  const selectedIndex = state.powerChoiceAnimating?.selectedIndex;
  clearPendingPowerChoiceTimer();
  const shouldHandOffToShellShield = Number.isInteger(selectedIndex) &&
    document.getElementById("top-crowns")?.classList.contains("is-power-stack");
  preservePowerChoiceFlyoutUntilShellSync = shouldHandOffToShellShield;
  state.powerChoiceAnimating = null;
  if (Number.isInteger(selectedIndex)) {
    pickPowerFromChoice(selectedIndex);
    if (typeof window.appShellRefreshTopBar === "function") {
      window.appShellRefreshTopBar();
    }
    if (shouldHandOffToShellShield) {
      requestAnimationFrame(() => {
        if (typeof window.appShellRefreshTopBar === "function") {
          window.appShellRefreshTopBar();
        }
        requestAnimationFrame(() => {
          preservePowerChoiceFlyoutUntilShellSync = false;
          hidePowerChoiceFlyout();
        });
      });
    } else {
      hidePowerChoiceFlyout();
    }
    window.setTimeout(flushPendingExperienceBonusesIfReady, 80);
    return;
  }
  preservePowerChoiceFlyoutUntilShellSync = false;
  hidePowerChoiceFlyout();
  render();
  window.setTimeout(flushPendingExperienceBonusesIfReady, 80);
}

function getPowerChoiceFlightTargetRect(targetEl, targetShieldEl) {
  const shellSlotEl = document.getElementById("top-crowns");
  if (shellSlotEl && shellSlotEl.classList.contains("is-power-stack")) {
    const wasHidden = shellSlotEl.hidden;
    if (wasHidden) shellSlotEl.hidden = false;
    const shellTargetEl =
      shellSlotEl.querySelector(".top-power-stack-item.pending-power-target") ||
      shellSlotEl.querySelector(".top-power-stack-item:last-child") ||
      shellSlotEl.querySelector(".top-power-stack");
    const shellRect = shellTargetEl?.getBoundingClientRect();
    if (wasHidden) shellSlotEl.hidden = true;
    if (shellRect?.width > 0 && shellRect?.height > 0) {
      return shellRect;
    }
  }

  return (targetShieldEl || targetEl)?.getBoundingClientRect() || null;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function lerp(start, end, t) {
  return start + ((end - start) * t);
}

function animatePowerChoiceFlyoutToTarget(flyoutEl, animation, sourceRect, targetRect) {
  const startCenterX = sourceRect.left + (sourceRect.width / 2);
  const startCenterY = sourceRect.top + (sourceRect.height / 2);
  const endCenterX = targetRect.left + (targetRect.width / 2);
  const endCenterY = targetRect.top + (targetRect.height / 2);
  const startWidth = Math.max(1, sourceRect.width);
  const startHeight = Math.max(1, sourceRect.height);
  const endWidth = Math.max(1, targetRect.width);
  const endHeight = Math.max(1, targetRect.height);
  const startedAt = performance.now();

  function applyFrame(progress) {
    const eased = easeOutCubic(Math.max(0, Math.min(1, progress)));
    const width = lerp(startWidth, endWidth, eased);
    const height = lerp(startHeight, endHeight, eased);
    const centerX = lerp(startCenterX, endCenterX, eased);
    const centerY = lerp(startCenterY, endCenterY, eased);
    flyoutEl.style.left = `${centerX - (width / 2)}px`;
    flyoutEl.style.top = `${centerY - (height / 2)}px`;
    flyoutEl.style.setProperty("--flyout-width", `${width}px`);
    flyoutEl.style.setProperty("--flyout-height", `${height}px`);
    flyoutEl.style.setProperty("--flight-glyph-size", `${Math.max(10, height * 0.26)}px`);
  }

  applyFrame(0);
  function step(now) {
    if (!state.powerChoiceAnimating || state.powerChoiceAnimating !== animation) return;
    const progress = (now - startedAt) / POWER_CHOICE_FLY_MS;
    applyFrame(progress);
    if (progress >= 1) {
      powerChoiceAnimationFrame = 0;
      completePowerChoiceSelectionAnimation();
      return;
    }
    powerChoiceAnimationFrame = requestAnimationFrame(step);
  }

  powerChoiceAnimationFrame = requestAnimationFrame(step);
}

function playPendingPowerChoiceAnimation() {
  const animation = state.powerChoiceAnimating;
  if (!animation) {
    if (!preservePowerChoiceFlyoutUntilShellSync) hidePowerChoiceFlyout();
    return;
  }

  if (animation.stage === "closing") {
    if (animation.started) return;
    animation.started = true;
    clearPendingPowerChoiceTimer();
    powerChoiceAnimationTimer = setTimeout(() => {
      powerChoiceAnimationTimer = null;
      if (!state.powerChoiceAnimating || state.powerChoiceAnimating !== animation) return;
      state.powerChoiceAnimating.stage = "flying";
      state.powerChoiceAnimating.started = false;
      render();
    }, POWER_CHOICE_CLOSE_MS);
    return;
  }

  if (animation.stage !== "flying" || animation.started) return;

  const flyoutEl = document.getElementById("power-choice-flyout");
  const targetEl = document.getElementById("header-power-chip");
  const targetShieldEl = targetEl?.querySelector(".header-power-stack") || targetEl?.querySelector(".power-shield-svg");
  if (typeof window.appShellRefreshTopBar === "function") {
    window.appShellRefreshTopBar();
  }
  const targetRect = getPowerChoiceFlightTargetRect(targetEl, targetShieldEl);
  if (!flyoutEl || !targetRect || !animation.power) return;

  animation.started = true;
  clearPendingPowerChoiceTimer();

  if (flyoutEl.parentNode && flyoutEl.parentNode !== document.body) {
    powerChoiceFlyoutHomeParent = flyoutEl.parentNode;
    powerChoiceFlyoutHomeNextSibling = flyoutEl.nextSibling;
    document.body.appendChild(flyoutEl);
  }

  const rarity = animation.power.rarity || "common";
  flyoutEl.className = `power-choice-flyout power-shield-flight ${rarity}`;
  flyoutEl.innerHTML = `
    ${POWER_SHIELD_SVG}
    <span class="header-power-stack-glyph">${getPowerIcon(animation.power.id)}</span>
  `;
  flyoutEl.setAttribute("aria-hidden", "true");

  const source = animation.sourceRect;
  flyoutEl.style.left = `${source.left}px`;
  flyoutEl.style.top = `${source.top}px`;
  flyoutEl.style.setProperty("--flyout-width", `${source.width}px`);
  flyoutEl.style.setProperty("--flyout-height", `${source.height}px`);
  flyoutEl.style.setProperty("--flight-glyph-size", `${Math.max(10, source.height * 0.26)}px`);
  flyoutEl.style.opacity = "1";
  flyoutEl.style.transform = "none";
  flyoutEl.classList.remove("is-moving");
  void flyoutEl.offsetWidth;
  animatePowerChoiceFlyoutToTarget(flyoutEl, animation, source, targetRect);
}

function playPendingCheatChoiceAnimation() {
  const animation = state.cheatChoiceAnimating;
  if (!animation) {
    hideCheatChoiceFlyout();
    return;
  }

  if (animation.stage === "closing") {
    if (animation.started) return;
    animation.started = true;
    clearPendingCheatChoiceTimer();
    cheatChoiceAnimationTimer = setTimeout(() => {
      cheatChoiceAnimationTimer = null;
      if (!state.cheatChoiceAnimating || state.cheatChoiceAnimating !== animation) return;
      state.cheatChoiceAnimating.stage = "flying";
      state.cheatChoiceAnimating.started = false;
      render();
    }, CHEAT_CHOICE_CLOSE_MS);
    return;
  }

  if (animation.stage !== "flying" || animation.started) return;

  const flyoutEl = document.getElementById("cheat-choice-flyout");
  const cheatListEl = document.getElementById("cheat-list");
  if (!flyoutEl || !cheatListEl) return;

  animation.started = true;
  clearPendingCheatChoiceTimer();

  const rarity = animation.cheat?.rarity || "common";
  const title = animation.cheat?.name || "Cheat";
  const iconGlyph = getCheatIcon(title);
  const extraClass = animation.cheat?.id === "nudge_up" || animation.cheat?.id === "nudge_down"
    ? " nudge-cheat-button"
    : "";

  flyoutEl.className = `cheat-choice-flyout cheat-button ${rarity}${extraClass}`;
  flyoutEl.innerHTML = buildCheatButtonMarkup(title, iconGlyph, 0);
  flyoutEl.setAttribute("aria-hidden", "true");

  const source = animation.sourceRect;
  const hostRect = getChoiceFlyoutHostRect(flyoutEl);
  flyoutEl.style.left = `${source.left - hostRect.left}px`;
  flyoutEl.style.top = `${source.top - hostRect.top}px`;
  flyoutEl.style.removeProperty("width");
  flyoutEl.style.removeProperty("height");
  flyoutEl.style.setProperty("--flyout-width", `${source.width}px`);
  flyoutEl.style.setProperty("--flyout-height", `${source.height}px`);
  flyoutEl.style.opacity = "1";
  flyoutEl.style.transform = "none";
  flyoutEl.classList.remove("is-moving");
  void flyoutEl.offsetWidth;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!state.cheatChoiceAnimating || state.cheatChoiceAnimating !== animation) return;
      const targetRect = getCheatChoiceFlyTargetRect(animation.targetEntryId, cheatListEl);
      if (!targetRect) {
        completeCheatChoiceSelectionAnimation(animation.followup);
        return;
      }
      const targetScale = Math.min(
        targetRect.width / Math.max(1, source.width),
        targetRect.height / Math.max(1, source.height)
      );
      const targetLeft = targetRect.left + (targetRect.width / 2) - (source.width / 2);
      const targetTop = targetRect.top + (targetRect.height / 2) - (source.height / 2);
      flyoutEl.classList.add("is-moving");
      flyoutEl.style.opacity = "0.92";
      flyoutEl.style.left = `${targetLeft - hostRect.left}px`;
      flyoutEl.style.top = `${targetTop - hostRect.top}px`;
      flyoutEl.style.transform = `scale(${targetScale})`;

      cheatChoiceAnimationTimer = setTimeout(() => {
        completeCheatChoiceSelectionAnimation(animation.followup);
      }, CHEAT_CHOICE_FLY_MS + 20);
    });
  });
}

function renderCheats() {
  const cheatList = document.getElementById("cheat-list");
  if (!cheatList) return;
  const previousScrollLeft = cheatList.scrollLeft;

  if (cheatList.dataset.overflowInit !== "1") {
    cheatList.dataset.overflowInit = "1";
    cheatList.addEventListener("scroll", updateCheatOverflowIndicators, { passive: true });
    window.addEventListener("resize", updateCheatOverflowIndicators, { passive: true });
  }

  const previousCoinRects = new Map(
    Array.from(cheatList.querySelectorAll(".cheat-button[data-cheat-entry-id]"))
      .map((el) => [el.dataset.cheatEntryId, el.getBoundingClientRect()])
  );

  cheatList.innerHTML = "";

  const groupedEntries = [];
  const groupedCheats = new Map();

  const nudgeUpCount = Math.max(0, Number(state.nudgeUpCharges) || 0);
  const nudgeDownCount = Math.max(0, Number(state.nudgeDownCharges) || 0);

  if (false && nudgeDownCount > 0) {
    groupedEntries.push({
      kind: "nudge",
      id: "nudge_down",
      count: nudgeDownCount,
      direction: "down",
      icon: "↓",
      name: "Nudge -1",
      rarity: "common",
      description: isGreenDeckRun()
        ? "Shift the current card down by 1. Costs 1 energy."
        : "Shift the current card down by 1."
    });
  }

  if (false && nudgeUpCount > 0) {
    groupedEntries.push({
      kind: "nudge",
      id: "nudge_up",
      count: nudgeUpCount,
      direction: "up",
      icon: "↑",
      name: "Nudge +1",
      rarity: "common",
      description: isGreenDeckRun()
        ? "Shift the current card up by 1. Costs 1 energy."
        : "Shift the current card up by 1."
    });
  }

  state.cheats
    .filter((cheat) => cheat.id !== "nudge_up" && cheat.id !== "nudge_down")
    .forEach((cheat) => {
      const existing = groupedCheats.get(cheat.id);
      if (existing) {
        existing.count += 1;
        return;
      }

      groupedCheats.set(cheat.id, {
        kind: "cheat",
        id: cheat.id,
        count: 1,
        cheat,
      });
    });

  groupedEntries.push(...groupedCheats.values());
  const currentCheatCounts = new Map(groupedEntries.map((entry) => [entry.id, entry.count]));

  if (!groupedEntries.length) {
    appendCheatSlots(cheatList, 0);
    if (!state.cheatChoiceAnimating) {
      lastRenderedCheatCounts = currentCheatCounts;
      suppressNextCheatEntryIntroId = "";
    }
    return;
  }

  groupedEntries.forEach((entry) => {
    const btn = document.createElement("button");
    const rarity = entry.kind === "cheat" ? (entry.cheat.rarity || "common") : entry.rarity;
    const title = entry.kind === "cheat" ? entry.cheat.name : entry.name;
    const iconGlyph = entry.kind === "cheat" ? getCheatIcon(entry.cheat.name) : entry.icon;
    const tooltipBody = entry.kind === "cheat" ? getCheatDescription(entry.cheat) : entry.description;
    const tutorialCheatUseBlocked = typeof window.isTutorialBlockingCheatUse === "function"
      ? window.isTutorialBlockingCheatUse()
      : false;
    btn.className = `cheat-button ${rarity}${entry.kind === "nudge" ? " nudge-cheat-button" : ""}`;
    btn.dataset.cheatEntryId = entry.id;
    btn.disabled = tutorialCheatUseBlocked;
    const previousCount = lastRenderedCheatCounts.get(entry.id) || 0;
    const isFreshAward = previousCount <= 0 && entry.kind === "nudge" && suppressNextCheatEntryIntroId !== entry.id;
    const shouldPulseCount = previousCount > 0 && entry.count > previousCount && entry.count > 1;
    if (!state.cheatChoiceAnimating && isFreshAward) {
      btn.classList.add("is-awarded-new");
    }
    if (!state.cheatChoiceAnimating && shouldPulseCount) {
      btn.classList.add("has-count-pulse");
    }
    if (state.cheatChoiceAnimating?.stage === "flying" && state.cheatChoiceAnimating.targetEntryId === entry.id) {
      btn.classList.add("is-receive-target-hidden");
    }

    const countLabel = entry.kind === "nudge"
      ? `${entry.count} ${entry.count === 1 ? "charge" : "charges"}`
      : "";
    btn.innerHTML = buildCheatButtonMarkup(title, iconGlyph, entry.count, countLabel);

    let holdTimer = null;
    let held = false;

    btn.oncontextmenu = (e) => e.preventDefault();

    btn.onpointerdown = () => {
      held = false;
      holdTimer = setTimeout(() => {
        held = true;
        showTooltip(title, tooltipBody, btn);
        const tooltip = document.getElementById("cheat-tooltip");
        if (tooltip) tooltip.dataset.keepOpenOnce = "1";
      }, 300);
    };

    btn.onpointerup = () => {
      clearTimeout(holdTimer);
      if (!held) {
        setTimeout(hideCheatTooltip, 50);
      }
    };

    btn.onpointercancel = () => {
      clearTimeout(holdTimer);
      hideCheatTooltip(true);
    };

    btn.onpointerleave = () => {
      clearTimeout(holdTimer);
      if (!held) {
        hideCheatTooltip(true);
      }
    };

    btn.onclick = () => {
      if (held) return;
      hideCheatTooltip(true);
      if (typeof window.isTutorialBlockingCheatUse === "function" && window.isTutorialBlockingCheatUse()) {
        state.message = "Tutorial locked";
        renderMessage();
        return;
      }
      if (state.gameOver || state.pendingRevealAnimation || state.pendingCheatOptions.length || state.pendingPowerOptions.length) return;
      if (state.sixSevenArmed) {
        state.message = "6/7 is armed — no other cheats or nudges can be used on this card.";
        render();
        return;
      }
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
      const now = Date.now();
      if (now < cheatUseLockedUntil) return;
      cheatUseLockedUntil = now + CHEAT_USE_BUFFER_MS;

      const useAfterOptionalDismiss = (action, shouldDiminish, shouldPulse = true) => {
        if (!shouldPulse) {
          action();
          return;
        }
        btn.classList.add(shouldDiminish ? "is-consuming" : "is-click-pulsing");
        btn.disabled = true;
        setTimeout(action, shouldDiminish ? 280 : 180);
      };

      if (entry.kind === "nudge") {
        const canAnimateNudge = typeof canUseNudge === "function" && canUseNudge(entry.direction);
        useAfterOptionalDismiss(() => useNudgeCharge(entry.direction), entry.count <= 1 && canAnimateNudge, canAnimateNudge);
        return;
      }

      const useCheat = () => {
        const result = entry.cheat.use();
        if (typeof recordItemUsageStat === "function") {
          recordItemUsageStat("cheat", entry.cheat.id, "used");
          if (result && !/^No effect/i.test(String(result))) {
            recordItemUsageStat("cheat", entry.cheat.id, "success");
          }
        }
        const didConsume = shouldConsumeCheatAfterUse(entry.cheat, result);
        const cheatersProsperText = typeof awardCheatersProsperCheatUse === "function"
          ? awardCheatersProsperCheatUse(didConsume)
          : "";
        state.message = `${result}${cheatersProsperText}`;
        const cheatName = cleanPlayerLogMessage(entry.cheat && entry.cheat.name ? entry.cheat.name : "Cheat");
        const cheatOutput = cleanPlayerLogMessage(state.message);
        addPlayerLogEntry(
          cheatOutput ? `Played ${cheatName}: ${cheatOutput}` : `Played ${cheatName}.`,
          { summary: getShortPlayerMessage(cheatOutput) || "Cheat played" },
        );
        state.lastPlayerLogMessage = cleanPlayerLogMessage(state.message);
        appendRunDebugLog("cheat_used", {
          cheatId: entry.cheat.id,
          cheatName: entry.cheat.name,
          result,
          cheatersProsperTriggered: !!cheatersProsperText,
          cheatsInHandBeforeConsume: state.cheats.map((heldCheat) => heldCheat.id),
          consumeOnUse: !!entry.cheat.consumeOnUse,
          didConsume,
          armedStatesAfterUse: {
            lucky7: !!state.lucky7Armed,
            fiveAlive: !!state.fiveAliveArmed,
            marginForError: !!state.marginForErrorArmed,
            stitchInTime: !!state.stitchInTimeArmed,
            sellYourSoul: !!state.sellYourSoulArmed,
            higherHigherHigherRemaining: Number(state.higherHigherHigherRemaining) || 0,
            godSaveKing: !!state.godSaveKingArmed,
            alwaysBetBlack: !!state.alwaysBetBlackArmed,
            redDeadRedemption: !!state.redDeadRedemptionArmed,
            suitsYouSir: !!state.suitsYouSirArmed,
            suitsYouSirSuit: state.suitsYouSirSuit || "",
            oddOneOut: !!state.oddOneOutArmed,
            cursedShield: (Number(state.cursedShieldCharges) || 0) > 0 || !!state.cursedShieldArmed,
            insuranceLives: Number(state.insuranceLives) || 0,
            oneLifeLeftLives: Number(state.oneLifeLeftLives) || 0,
            killerQueenLives: Number(state.killerQueenLives) || 0,
            suitedAndBooted: !!state.suitedAndBootedArmed,
            suitedAndBootedSuit: state.suitedAndBootedSuit || "",
            blankSpaceActive: !!state.blankSpaceActive,
            blankSpaceValue: Number.isFinite(state.blankSpaceValue) ? state.blankSpaceValue : null,
            forcedNextGuess: state.forcedNextGuess || "",
            lockCurrentCardForForcedGuess: !!state.lockCurrentCardForForcedGuess,
            legendaryCheatOfferArmed: !!state.legendaryCheatOfferArmed,
            sixSeven: !!state.sixSevenArmed,
            catch22: !!state.catch22Armed,
            blackjack: !!state.blackjackArmed,
            diamondGeezer: !!state.diamondGeezerArmed,
            cheatACheaterRemaining: Number(state.cheatACheaterRemaining) || 0,
            wlStage: state.wlStage || "",
          },
        });
        if (didConsume) {
          const originalIndex = state.cheats.findIndex((c) => c.id === entry.cheat.id);
          if (originalIndex >= 0) removeCheatAt(originalIndex);
          state.cheatUsesOnCurrentCard = (state.cheatUsesOnCurrentCard || 0) + 1;
          if (entry.cheat.id === "save_scum" && typeof activateSaveScumCheckpoint === "function") {
            activateSaveScumCheckpoint();
          }
        }
        if (typeof window.handleTutorialCheatUsed === "function") {
          window.handleTutorialCheatUsed(entry.cheat, result);
        }
        render();
      };

      useAfterOptionalDismiss(useCheat, entry.cheat.consumeOnUse && entry.count <= 1, true);
    };

    cheatList.appendChild(btn);
  });

  appendCheatSlots(cheatList, groupedEntries.length);
  animateCheatCoinLayout(cheatList, previousCoinRects);
  window.requestAnimationFrame(() => {
    const maxScrollLeft = Math.max(0, cheatList.scrollWidth - cheatList.clientWidth);
    cheatList.scrollLeft = Math.max(0, Math.min(previousScrollLeft, maxScrollLeft));
    updateCheatOverflowIndicators();
  });
  if (!state.cheatChoiceAnimating) {
    lastRenderedCheatCounts = currentCheatCounts;
    suppressNextCheatEntryIntroId = "";
  }
}

function appendCheatSlots(cheatList, occupiedCount = 0) {
  if ((Number(occupiedCount) || 0) > 0) return;
  const slot = document.createElement("div");
  slot.className = "cheat-slot";
  slot.setAttribute("aria-hidden", "true");
  cheatList.appendChild(slot);
}

function animateCheatCoinLayout(cheatList, previousCoinRects) {
  if (!previousCoinRects?.size || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

  requestAnimationFrame(() => {
    cheatList.querySelectorAll(".cheat-button[data-cheat-entry-id]").forEach((coin) => {
      const previousRect = previousCoinRects.get(coin.dataset.cheatEntryId);
      if (!previousRect) return;

      const nextRect = coin.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

      coin.animate(
        [
          { transform: `translate3d(${Math.round(deltaX)}px, ${Math.round(deltaY)}px, 0)` },
          { transform: "translate3d(0, 0, 0)" },
        ],
        {
          duration: 260,
          easing: "ease-in-out",
        }
      );
    });
  });
}

function showCheatTooltip(cheat, el) {
  showTooltip(cheat.name, getCheatDescription(cheat), el);
}

function hideCheatTooltip(force = false) {
  const tooltip = document.getElementById("cheat-tooltip");
  if (!tooltip) return;
  if (!force && tooltip.dataset.keepOpenOnce === "1") {
    delete tooltip.dataset.keepOpenOnce;
    return;
  }
  delete tooltip.dataset.keepOpenOnce;
  tooltip.classList.add("hidden");
}

window.hideCheatTooltip = hideCheatTooltip;

function getChoiceCurrentCard(mode = "cheat") {
  if (mode === "power" && Array.isArray(state.pendingRunDeck) && state.pendingRunDeck.length > 0) {
    return state.pendingRunDeck[0];
  }
  if (state.current) return state.current;
  return null;
}

function renderChoiceCurrentCard(el, mode = "cheat", label = "Current card") {
  if (!el) return;
  const card = getChoiceCurrentCard(mode);
  if (!card) {
    el.innerHTML = "";
    el.classList.add("hidden");
    return;
  }

  const cardFaceClass = isJokerCard(card)
    ? "joker-card-face"
    : isRed(card)
      ? "red"
      : "black";
  const cardValue = Number.isFinite(card.value) ? card.value : getCurrentEffectiveValue();
  const cardMarkup = renderCardFaceMarkup(card, cardValue, false, false, {
    suppressPips: true,
    minimalFacePreview: true,
  });
  el.innerHTML = `
    <div class="choice-current-card-label">${label}:</div>
    <div class="choice-current-card-visual card-face ${cardFaceClass}" aria-label="${label}: ${describeCard(card)}">
      ${cardMarkup}
    </div>
  `;
  el.classList.remove("hidden");
}

function renderCheatChoice() {
  const container = document.getElementById("cheat-choice-container");
  const list = document.getElementById("cheat-choice-list");
  const infoEl = document.getElementById("cheat-choice-info");
  const currentCardEl = document.getElementById("cheat-choice-current-card");

  if (!container || !list || !infoEl) return;

  list.innerHTML = "";
  container.classList.remove("is-closing", "is-flying");

  const animation = state.cheatChoiceAnimating;
  const choiceOptions = state.pendingCheatOptions.length
    ? state.pendingCheatOptions
    : Array.isArray(animation?.optionsSnapshot)
      ? animation.optionsSnapshot
      : [];

  if (!choiceOptions.length) {
    document.body.classList.remove("choice-modal-open", "cheat-choice-open");
    container.classList.add("hidden");
    container.setAttribute("aria-hidden", "true");
    if (currentCardEl) {
      currentCardEl.innerHTML = "";
      currentCardEl.classList.add("hidden");
    }
    renderCheatChoiceInfo(infoEl, null, "");
    return;
  }

  document.body.classList.remove("power-choice-open");
  document.body.classList.add("choice-modal-open", "cheat-choice-open");
  container.classList.remove("hidden");
  container.setAttribute("aria-hidden", "false");
  renderChoiceCurrentCard(currentCardEl, "cheat", "Current card");

  if (animation?.stage === "closing") {
    container.classList.add("is-closing");
  } else if (animation?.stage === "flying") {
    container.classList.add("is-flying");
  }

  const tutorialChoiceLocked = typeof window.isTutorialBlockingCheatChoice === "function"
    ? window.isTutorialBlockingCheatChoice()
    : false;
  const choiceLocked = Date.now() < (state.cheatChoiceLockedUntil || 0) || tutorialChoiceLocked;
  const introToken = String(state.cheatChoiceIntroToken || 0);
  const introFresh = list.dataset.introToken !== introToken;
  list.dataset.introToken = introToken;
  const previewIndex = animation ? animation.selectedIndex : state.cheatChoicePreviewIndex;

  choiceOptions.forEach((cheat, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `choice-card cheat-choice-card cheat-button ${cheat.rarity || "common"} ${introFresh && !animation ? "choice-intro" : ""}`.trim();
    btn.disabled = choiceLocked || !!animation;
    btn.style.setProperty("--choice-index", String(i));
    btn.dataset.choiceIndex = String(i);
    btn.innerHTML = buildCheatButtonMarkup(cheat.name, getCheatIcon(cheat.name), 0);

    if (previewIndex === i) {
      btn.classList.add("is-previewed");
    }
    if (animation) {
      if (animation.selectedIndex === i) {
        btn.classList.add("is-selected-ghost");
      } else {
        btn.classList.add("is-dismissing");
      }
    }

    btn.onmouseenter = () => {
      if (!canUseHoverTooltips()) return;
      if (choiceLocked || state.cheatChoiceAnimating) return;
      state.cheatChoicePreviewIndex = i;
      cheatChoiceConfirmIndex = -1;
      cheatChoiceConfirmAfter = 0;
      list.querySelectorAll(".cheat-choice-card.is-previewed").forEach((el) => {
        el.classList.remove("is-previewed");
      });
      btn.classList.add("is-previewed");
      renderCheatChoiceInfo(infoEl, cheat, "");
    };

    btn.onclick = () => {
      if (choiceLocked || state.cheatChoiceAnimating) return;
      if (state.cheatChoicePreviewIndex !== i) {
        state.cheatChoicePreviewIndex = i;
        cheatChoiceConfirmIndex = i;
        cheatChoiceConfirmAfter = Date.now() + CHEAT_CHOICE_CONFIRM_BUFFER_MS;
        render();
        return;
      }
      if (cheatChoiceConfirmIndex === i && Date.now() < cheatChoiceConfirmAfter) return;
      beginCheatChoiceSelection(i, btn);
    };

    list.appendChild(btn);
  });

  renderCheatChoiceInfo(
    infoEl,
    Number.isInteger(previewIndex) && previewIndex >= 0 ? choiceOptions[previewIndex] : null,
    "Tap a cheat to read the description."
  );

  if (animation) {
    infoEl.classList.add("is-dismissing");
  } else {
    infoEl.classList.remove("is-dismissing");
  }

  if (choiceLocked) {
    window.setTimeout(render, Math.max(0, (state.cheatChoiceLockedUntil || 0) - Date.now()));
  }
}

function renderPowerChoice() {
  const container = document.getElementById("power-choice-container");
  const list = document.getElementById("power-choice-list");
  const titleEl = document.getElementById("power-choice-title");
  const currentCardEl = document.getElementById("power-choice-current-card");
  const footerEl = document.getElementById("power-choice-footer");

  if (!container || !list) return;

  list.innerHTML = "";
  container.classList.remove("is-closing", "is-flying");
  const animation = state.powerChoiceAnimating;
  const choiceOptions = state.pendingPowerOptions.length
    ? state.pendingPowerOptions
    : Array.isArray(animation?.optionsSnapshot)
      ? animation.optionsSnapshot
      : [];
  list.dataset.count = String(choiceOptions.length || 0);

  if (state.powerChoiceRevealPending && !animation) {
    document.body.classList.remove("choice-modal-open", "power-choice-open");
    container.classList.add("hidden");
    container.setAttribute("aria-hidden", "true");
    if (currentCardEl) {
      currentCardEl.innerText = "";
      currentCardEl.classList.add("hidden");
    }
    return;
  }

  if (!choiceOptions.length) {
    document.body.classList.remove("choice-modal-open", "power-choice-open");
    container.classList.add("hidden");
    container.setAttribute("aria-hidden", "true");
    if (currentCardEl) {
      currentCardEl.innerText = "";
      currentCardEl.classList.add("hidden");
    }
    return;
  }

  document.body.classList.remove("cheat-choice-open");
  document.body.classList.add("choice-modal-open", "power-choice-open");
  container.classList.remove("hidden");
  container.setAttribute("aria-hidden", "false");

  if (animation?.stage === "closing") {
    container.classList.add("is-closing");
  } else if (animation?.stage === "flying") {
    container.classList.add("is-flying");
  }

  if (titleEl) {
    titleEl.innerText = state.activePowerAwardReason ? "Choose Your Bonus Power" : "Choose Your Power";
  }
  if (footerEl) {
    footerEl.innerText = "";
    footerEl.hidden = true;
  }
  const powerCardLabel = state.activePowerAwardReason ? "Current card" : "Starting card";
  renderChoiceCurrentCard(currentCardEl, "power", powerCardLabel);

  const tutorialChoiceLocked = typeof window.isTutorialBlockingPowerPick === "function"
    ? window.isTutorialBlockingPowerPick()
    : false;
  const choiceLocked = Date.now() < (state.powerChoiceLockedUntil || 0) || tutorialChoiceLocked;
  const introToken = String(state.powerChoiceIntroToken || 0);
  const introFresh = list.dataset.introToken !== introToken;
  list.dataset.introToken = introToken;

  choiceOptions.forEach((power, i) => {
    const option = document.createElement("div");
    option.className = `power-choice-option ${power.rarity || "common"} ${introFresh ? "choice-intro" : ""}`.trim();
    option.style.setProperty("--choice-index", String(i));

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `choice-card power-choice-card ${power.rarity || "common"}`.trim();
    btn.disabled = choiceLocked || !!animation;
    btn.setAttribute("aria-describedby", `power-choice-desc-${i}`);
    btn.innerHTML = buildPowerChoiceShieldMarkup(power);

    const desc = document.createElement("div");
    desc.className = "choice-desc";
    desc.id = `power-choice-desc-${i}`;
    const powerDescription = getPowerDescription(power, {
      deckKey: state.pendingDeckKey || state.selectedDeckKey || loadSelectedDeck(),
      levelNumber: state.pendingLevelNumber || state.selectedLevelNumber || loadSelectedLevel(),
    });
    desc.innerText = powerDescription;

    if (animation) {
      if (animation.selectedIndex === i) {
        option.classList.add("is-selected-ghost");
      } else if (animation.stage === "flying") {
        option.classList.add("is-dismissed");
      } else {
        option.classList.add("is-dismissing");
      }
    }

    let powerHoldTimer = null;
    let powerHeld = false;

    const showPowerTooltip = () => {
      showTooltip(power.name, powerDescription, btn);
    };

    btn.oncontextmenu = (e) => e.preventDefault();

    btn.onpointerdown = () => {
      powerHeld = false;
      powerHoldTimer = setTimeout(() => {
        powerHeld = true;
        showPowerTooltip();
        const tooltip = document.getElementById("cheat-tooltip");
        if (tooltip) tooltip.dataset.keepOpenOnce = "1";
      }, 300);
    };

    btn.onpointerup = () => {
      clearTimeout(powerHoldTimer);
      if (!powerHeld) {
        setTimeout(hideCheatTooltip, 50);
      }
    };

    btn.onpointercancel = () => {
      clearTimeout(powerHoldTimer);
      hideCheatTooltip(true);
    };

    btn.onpointerleave = () => {
      clearTimeout(powerHoldTimer);
      if (!powerHeld) {
        hideCheatTooltip(true);
      }
    };

    btn.onclick = () => {
      if (powerHeld) return;
      if (choiceLocked || state.powerChoiceAnimating) return;
      hideCheatTooltip(true);
      beginPowerChoiceSelection(i, btn);
    };

    option.appendChild(btn);
    option.appendChild(desc);
    list.appendChild(option);
  });

  if (choiceLocked) {
    window.setTimeout(render, Math.max(0, (state.powerChoiceLockedUntil || 0) - Date.now()));
  }
  if (!state.activePowerAwardReason && state.pendingRunMode !== "daily" && typeof window.maybeStartPowerChoiceTutorial === "function") {
    window.setTimeout(() => window.maybeStartPowerChoiceTutorial(), 0);
  }
}

function renderSeenGrid() {
  const gridWrapEl = document.getElementById("seen-grid-wrap");
  const grid = document.getElementById("seen-grid");
  const labelEl = document.getElementById("seen-grid-label");
  if (!grid || !gridWrapEl) return;

  gridWrapEl.hidden = false;

  grid.innerHTML = "";
  const foundCount = state.seenCardIds instanceof Set ? state.seenCardIds.size : 0;
  const gridCardIds = state.gridCardIds instanceof Set ? state.gridCardIds : state.seenCardIds;

  if (labelEl) {
    const deckSize = typeof getCurrentDeckTargetCount === "function" ? getCurrentDeckTargetCount() : 52;
    setAnimatedText(labelEl, `FOUND: ${foundCount}/${deckSize}`);
  }

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const card = {
        id: getCardId(suit, rank.r),
        suit,
        rank: rank.r,
        value: rank.v,
      };
      const cardId = getCardId(suit, rank.r);
      const seen = gridCardIds.has(cardId);
      const isFresh = state.recentlySeenCardId === cardId;
      const isBanked = state.experienceBankedCardIds instanceof Set && state.experienceBankedCardIds.has(cardId);
      const cell = document.createElement("div");
      cell.className = `grid-cell ${seen ? "seen" : ""} ${isFresh ? "fresh" : ""} ${isBanked ? "xp-banked-source" : ""} ${isRed(card) ? "red" : "black"}`.trim();
      cell.dataset.cardId = cardId;
      cell.dataset.seen = seen ? "true" : "false";
      cell.setAttribute("aria-label", `${describeCard(card)} ${seen ? "found" : "not found"}`);
      if (seen) {
        if (document.body.dataset.visuals === "new") {
          const rank = document.createElement("span");
          rank.className = "memory-card-rank";
          rank.innerText = card.rank;
          const suit = document.createElement("span");
          suit.className = "memory-card-suit";
          suit.dataset.suit = card.suit;
          suit.setAttribute("aria-hidden", "true");
          cell.appendChild(rank);
          cell.appendChild(suit);
        } else {
          const label = document.createElement("span");
          label.className = "memory-card-label";
          label.innerText = `${card.rank}${card.suit}`;
          cell.appendChild(label);
        }
      }
      grid.appendChild(cell);
    }
  }

  let note = document.getElementById("seen-grid-note");
  if (!note) {
    note = document.createElement("div");
    note.id = "seen-grid-note";
    grid.insertAdjacentElement("afterend", note);
  }

  note.className = "seen-grid-note";
  note.hidden = true;
  note.innerText = "";
}

function renderMessage() {
  const el = document.getElementById("message-bar");
  if (!el) return;

  clearTimeout(messageExpiryTimer);
  messageExpiryTimer = null;
  el.classList.remove("is-game-over", "is-victory", "is-awaiting-reveal", "is-expiring", "message-pop");
  el.dataset.messageDensity = "normal";
  const pendingReveal = state.pendingRevealAnimation;
  const temporaryText = state.temporaryMessageText || "";

  if (temporaryText && state.message !== temporaryText) {
    state.temporaryMessageText = "";
    state.temporaryMessageUntil = 0;
  }

  if (pendingReveal && !pendingReveal.messageReleased) {
    el.classList.add("has-message", "is-awaiting-reveal");
    return;
  }

  if (state.victoryMessageActive) {
    addPlayerLogEntry(state.message || "Congratulations!");
    el.innerText = getMessageBarText(state.message || "Congratulations!");
    state.victoryMessageJustReleased = false;
    el.classList.add("has-message", "is-victory");
    return;
  }

  if (state.gameOver && state.gameOverMessageReady === false) {
    el.innerText = "";
    el.classList.remove("has-message");
    return;
  }

  if (pendingReveal?.messageReleased && state.message && !state.gameOver && !state.temporaryMessageText) {
    state.temporaryMessageText = state.message;
    state.temporaryMessageUntil = Date.now() + 2000;
  }

  if (state.temporaryMessageText && state.temporaryMessageUntil > 0) {
    const remainingMs = state.temporaryMessageUntil - Date.now();
    if (remainingMs <= 0) {
      el.classList.add("has-message", "is-expiring");
      const expiringText = state.temporaryMessageText;
      clearTimeout(messageFadeTimer);
      messageFadeTimer = setTimeout(() => {
        if (state.message === expiringText && state.temporaryMessageText === expiringText) {
          state.message = "";
        }
        if (state.temporaryMessageText === expiringText) {
          state.temporaryMessageText = "";
          state.temporaryMessageUntil = 0;
        }
        messageFadeTimer = null;
        renderMessage();
      }, 170);
      return;
    }

    messageExpiryTimer = setTimeout(renderMessage, remainingMs);
  }

  if (state.gameOver) {
    addPlayerLogEntry(state.message || "Game over.");
    el.innerText = "GAME OVER";
    el.classList.add("is-game-over");
    if (pendingReveal) pendingReveal.messageJustReleased = false;
    state.gameOverMessageJustReleased = false;
    el.classList.add("has-message");
    return;
  }

  if (!state.message) {
    el.innerText = "";
    el.classList.remove("has-message");
    return;
  }

  addPlayerLogEntry(state.message);
  el.innerText = getMessageBarText(state.message);
  if (pendingReveal) pendingReveal.messageJustReleased = false;
  el.classList.add("has-message");
  const densitySteps = ["normal", "compact", "tight"];
  for (const density of densitySteps) {
    el.dataset.messageDensity = density;
    if (el.scrollHeight <= el.clientHeight + 2) {
      return;
    }
  }
  el.dataset.messageDensity = "scroll";
}

function renderNextInfo() {
  const el = document.getElementById("next-info");
  if (!el) return;
  el.innerText = "";
}

function render() {
  if (!state.gameOver && state.gameOverDisplayCards) {
    state.gameOverDisplayCards = null;
  }

  renderScores();
  renderHeaderStatus();
  renderStartPowerSelector();
  renderCheatGuide();
  renderActivePowers();
  renderCurrentCard();
  renderNudgeControls();
  renderFaceDownDeck();
  renderButtons();
  renderHandCard();
  renderCheats();
  renderCheatChoice();
  renderPowerChoice();
  renderSeenGrid();
  renderRestartButton();
  renderMessage();
  renderNextInfo();
  playPendingCardRevealAnimation();
  playPendingCheatChoiceAnimation();
  playPendingPowerChoiceAnimation();
}
