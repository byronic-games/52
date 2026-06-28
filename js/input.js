function ensureTutorialGuessWillResolveAsCorrect(type) {
  if (!state.current || state.gameOver) return;
  const nextIndex = (Number(state.index) || 0) + 1;
  if (!Array.isArray(state.deck) || nextIndex >= state.deck.length) return;

  const currentComparisonValue = getCurrentEffectiveValue();
  if (!Number.isFinite(currentComparisonValue)) return;

  const isSafeOutcome = (card) => {
    const nextValue = getNextComparisonValueForGuess(card);
    if (!Number.isFinite(nextValue)) return false;
    return type === "higher" ? nextValue >= currentComparisonValue : nextValue <= currentComparisonValue;
  };

  if (isSafeOutcome(state.deck[nextIndex])) return;

  let candidateIndex = -1;
  for (let i = nextIndex + 1; i < state.deck.length; i += 1) {
    if (isSafeOutcome(state.deck[i])) {
      candidateIndex = i;
      break;
    }
  }

  if (candidateIndex > 0) {
    [state.deck[nextIndex], state.deck[candidateIndex]] = [state.deck[candidateIndex], state.deck[nextIndex]];
    return;
  }

  const nextComparisonValue = getNextComparisonValueForGuess(state.deck[nextIndex]);
  if (Number.isFinite(nextComparisonValue)) {
    state.nextCardValueModifier = (state.nextCardValueModifier || 0) + (currentComparisonValue - nextComparisonValue);
  }
}

function handleGuessButtonPress(type) {
  if (window.tutorialController?.isBlockingGuess?.(type) === true) return;
  if (window.tutorialController?.shouldForceCorrectGuess?.() === true) {
    ensureTutorialGuessWillResolveAsCorrect(type);
  }

  const before = {
    index: Number(state.index) || 0,
    correctAnswers: Number(state.correctAnswers) || 0,
    gameOver: !!state.gameOver,
  };

  makeGuess(type);

  const after = {
    index: Number(state.index) || 0,
    correctAnswers: Number(state.correctAnswers) || 0,
    gameOver: !!state.gameOver,
  };

  if (typeof window.handleTutorialGuessResolved === "function") {
    window.handleTutorialGuessResolved(type, before, after);
  }
}

document.getElementById("higher-btn").onclick = () => handleGuessButtonPress("higher");
document.getElementById("lower-btn").onclick = () => handleGuessButtonPress("lower");

function createTutorialController() {
  const overlay = document.getElementById("tutorial-overlay");
  const title = document.getElementById("tutorial-title");
  const copy = document.getElementById("tutorial-copy");
  const progress = document.getElementById("tutorial-progress");
  const nextBtn = document.getElementById("tutorial-next-btn");
  const skipBtn = document.getElementById("tutorial-skip-btn");

  const tutorialCompletedKey = typeof TUTORIAL_COMPLETED_KEY === "string"
    ? TUTORIAL_COMPLETED_KEY
    : "hl_prototype_tutorial_completed_v1";
  const tutorialForceReplayKey = typeof TUTORIAL_FORCE_REPLAY_KEY === "string"
    ? TUTORIAL_FORCE_REPLAY_KEY
    : "hl_prototype_tutorial_force_replay_v1";

  const profileStats = loadProfileStats();
  const shouldRunByProgress = Number(profileStats.runsStarted || 0) <= 1;
  const completedAtLoad = localStorage.getItem(tutorialCompletedKey) === "1";
  let forcedReplay = sessionStorage.getItem(tutorialForceReplayKey) === "1";
  let tutorialEnabled = forcedReplay || (!completedAtLoad && shouldRunByProgress);

  const runSteps = [
    {
      target: "#current-card",
      title: "Current Card",
      copy: "This is your live card. Hold it for active-effect details. Aces are low, Jacks are 11, Queens are 12, and Kings are 13.",
      placement: "lower",
    },
    {
      target: "#face-down-deck",
      title: "Next Card",
      copy: "This is the unknown card. Your Higher or Lower guess is about this card, not the rest of the deck.",
      placement: "lower",
    },
    {
      target: "#run-message-row",
      title: "Run Messages",
      copy: "Important effects appear here: correct guesses, saves, Joker effects, and anything the game needs you to know right now.",
      placement: "lower",
    },
    {
      target: "#controls",
      title: "Simple Rule",
      copy: "Guess Higher if you think the next card is above the current value. Guess Lower if it is below. Equal values are safe and keep the run alive.",
      placement: "lower",
    },
    {
      target: "#controls",
      title: "Make A Guess",
      copy: "Tap Higher or Lower now. Tutorial guesses are protected so you can learn the reveal flow safely.",
      requireGuess: true,
      clearView: true,
      compact: true,
      placement: "lower",
    },
    {
      target: "#cheats-panel",
      title: "Nudges",
      copy: "Nudges tweak the current card value. Blue runs award them from correct guesses, and some Powers make them stronger.",
      placement: "lower",
    },
    {
      target: "#controls",
      title: "Build Your Streak",
      copy: "Keep guessing safely. At the reward threshold, you earn a special card choice.",
      requireGuess: true,
      untilCorrectAnswers: 3,
      waitForCheatOffer: true,
      clearView: true,
      compact: true,
      placement: "lower",
    },
    {
      target: "#cheat-choice-container .choice-modal",
      title: "Choose Your First Cheat",
      copy: "Cheats are one-use cards. They can reveal information, move cards, save guesses, change values, or set up rewards. Pick one.",
      requireCheatPick: true,
      showHighlight: false,
      clearView: true,
      compact: true,
      placement: "upper",
    },
    {
      target: "#cheats-panel .cheat-scroll-window",
      title: "Held Cheats",
      copy: "Chosen Cheats live here. Tap one to use it, or hold it for details. Some work now; some wait for reveal.",
      clearView: true,
      placement: "lower",
    },
    {
      target: "#memory-panel",
      title: "The Grid",
      copy: "The grid records found cards. Use it to judge what values may still be face down. Some effects can change what you know.",
      focusBox: true,
      clearView: true,
      placement: "upper",
    },
    {
      target: "#header-power-chip",
      title: "Powers",
      copy: "Your shield shows your starting Power. Hold Powers for details. Extra Power choices can appear during a run.",
      clearView: true,
      placement: "lower",
    },
    {
      target: "#run-log-btn",
      title: "Run Log",
      copy: "Open the log whenever you want to check what happened. Settings also let you download or share a run log for debugging.",
      clearView: true,
      placement: "lower",
    },
    {
      target: "#menu-btn",
      title: "More Modes",
      copy: "From the main menu you will unlock Green Energy runs, Yellow Joker runs, Orange hybrid runs, Daily challenges, the Collection, Profiles, Heroes, and the final Black Deck.",
      clearView: true,
      placement: "lower",
    },
    {
      target: "#cheats-panel",
      title: "You're Ready",
      copy: "Clear all 52 cards to win the run. Start simple: read the message, use the grid, spend Nudges carefully, and hold Cheats before playing them.",
      nextLabel: "Let's go.",
      clearView: true,
      placement: "lower",
    },
  ];

  const powerSteps = [
    {
      target: "#power-choice-container .choice-modal",
      title: "Starting Power",
      copy: "Before each run, pick a starting Power. Powers offer Nudges or other benefits. Choose the one that helps most.",
      showHighlight: false,
      clearView: true,
      compact: true,
      placement: "upper",
    },
    {
      target: "#power-choice-current-card",
      title: "Starting Card",
      copy: "This is the card your run will begin on. Use it to choose a Power that fits the opening position.",
      clearView: true,
      placement: "upper",
    },
    {
      target: "#power-choice-list",
      title: "Power Options",
      copy: "Read both options, or hold either Power for details. Some give Nudges, protect mistakes, change values, or reward specific reveals.",
      clearView: true,
      placement: "upper",
    },
    {
      target: "#power-choice-list .choice-card",
      title: "Choose To Continue",
      copy: "Pick a Power now to begin the run.",
      requirePowerPick: true,
      showHighlight: false,
      clearView: true,
      compact: true,
      placement: "upper",
    },
  ];

  if (!overlay || !title || !copy || !progress || !nextBtn || !skipBtn || !tutorialEnabled) {
    return {
      maybeStartRun() {},
      maybeStartPowerChoice() {},
      isBlockingGuess() { return false; },
      isGuessButtonsDisabled() { return false; },
      isBlockingPowerPick() { return false; },
      isTutorialCheatOfferActive() { return false; },
      isBlockingCheatChoice() { return false; },
      isBlockingCheatUse() { return false; },
      handleGuessResolved() {},
      handlePowerPicked() {},
      handleCheatPicked() {},
      handleCheatUsed() {},
      closeAndComplete() {},
    };
  }

  let active = false;
  let phase = "run";
  let stepIndex = 0;
  let focusedTarget = null;
  let focusBox = null;
  let focusBoxMode = false;
  let cheatOfferPollTimer = null;
  let revealAdvancePollTimer = null;
  let tutorialCheatOfferHandled = false;

  function getActiveSteps() {
    return phase === "power" ? powerSteps : runSteps;
  }

  function getTutorialProgress() {
    const totalSteps = powerSteps.length + runSteps.length;
    const currentStep = phase === "power"
      ? stepIndex + 1
      : powerSteps.length + stepIndex + 1;
    return { currentStep, totalSteps };
  }

  function consumeForcedReplay() {
    if (!forcedReplay) return;
    forcedReplay = false;
    sessionStorage.removeItem(tutorialForceReplayKey);
  }

  function clearFocusTarget() {
    if (focusedTarget) {
      focusedTarget.classList.remove("tutorial-focus-target");
    }
    if (focusBox) {
      focusBox.remove();
      focusBox = null;
    }
    focusedTarget = null;
    focusBoxMode = false;
  }

  function updateFocusBox() {
    if (!focusBox || !focusedTarget) return;
    const rect = focusedTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      focusBox.classList.add("hidden");
      return;
    }
    const inset = 3;
    const left = Math.max(8, rect.left - inset);
    const top = Math.max(8, rect.top - inset);
    const right = Math.min(window.innerWidth - 8, rect.right + inset);
    const bottom = Math.min(window.innerHeight - 8, rect.bottom + inset);
    focusBox.style.left = `${left}px`;
    focusBox.style.top = `${top}px`;
    focusBox.style.width = `${Math.max(0, right - left)}px`;
    focusBox.style.height = `${Math.max(0, bottom - top)}px`;
    focusBox.classList.remove("hidden");
  }

  function ensureFocusBox() {
    if (focusBox) return;
    focusBox = document.createElement("div");
    focusBox.className = "tutorial-focus-box hidden";
    document.body.appendChild(focusBox);
  }

  function clearCheatOfferPoll() {
    if (cheatOfferPollTimer) {
      clearTimeout(cheatOfferPollTimer);
      cheatOfferPollTimer = null;
    }
  }

  function clearRevealAdvancePoll() {
    if (revealAdvancePollTimer) {
      clearTimeout(revealAdvancePollTimer);
      revealAdvancePollTimer = null;
    }
  }

  function setFocusTarget(step) {
    if (step?.showHighlight === false) {
      clearFocusTarget();
      return;
    }
    const target = step?.target ? document.querySelector(step.target) : null;
    if (!target) {
      clearFocusTarget();
      return;
    }
    const useFocusBox = !!step?.focusBox;
    if (focusedTarget !== target || focusBoxMode !== useFocusBox) {
      clearFocusTarget();
      focusedTarget = target;
      focusBoxMode = useFocusBox;
      if (useFocusBox) {
        ensureFocusBox();
      } else {
        target.classList.add("tutorial-focus-target");
      }
    }
    if (useFocusBox) {
      updateFocusBox();
    }
  }

  function setTutorialCompleted() {
    localStorage.setItem(tutorialCompletedKey, "1");
    tutorialEnabled = false;
  }

  function closeOverlay({ complete = false } = {}) {
    if (!active) return;
    active = false;
    clearFocusTarget();
    clearCheatOfferPoll();
    clearRevealAdvancePoll();
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    overlay.classList.remove("tutorial-clear-view");
    overlay.classList.remove("tutorial-dialog-upper");
    overlay.classList.remove("tutorial-dialog-compact");
    syncTutorialLockedControls();
    if (complete) {
      setTutorialCompleted();
    }
  }

  function renderStep() {
    if (!active) return;
    const steps = getActiveSteps();
    const step = steps[stepIndex];
    if (!step) {
      closeOverlay({ complete: phase === "run" });
      return;
    }
    const { currentStep, totalSteps } = getTutorialProgress();
    progress.innerText = `Step ${currentStep} / ${totalSteps}`;
    title.innerText = step.title;
    copy.innerText = step.copy;
    nextBtn.innerText = step.requireGuess || step.requirePowerPick || step.requireCheatPick || step.requireCheatUse
      ? "Waiting..."
      : (step.nextLabel || (stepIndex === steps.length - 1 ? "Finish" : "Next"));
    nextBtn.disabled = !!step.requireGuess || !!step.requirePowerPick || !!step.requireCheatPick || !!step.requireCheatUse;
    overlay.classList.toggle("tutorial-clear-view", !!step.clearView);
    overlay.classList.toggle("tutorial-dialog-compact", !!step.compact);
    overlay.classList.toggle("tutorial-dialog-upper", resolveDialogPlacement(step) === "upper");
    setFocusTarget(step);
    syncTutorialLockedControls();
  }

  function resolveDialogPlacement(step) {
    if (step?.placement === "upper" || step?.placement === "lower") {
      return step.placement;
    }
    return "lower";
  }

  function syncTutorialLockedControls() {
    if (typeof renderButtons === "function") {
      renderButtons();
    }
    if (typeof renderNudgeControls === "function") {
      renderNudgeControls();
    }
    if (typeof renderPowerChoice === "function") {
      renderPowerChoice();
    }
    if (typeof renderCheatChoice === "function") {
      renderCheatChoice();
    }
    if (typeof renderCheats === "function") {
      renderCheats();
    }
  }

  function nextStep() {
    if (!active) return;
    const steps = getActiveSteps();
    stepIndex += 1;
    if (stepIndex >= steps.length) {
      closeOverlay({ complete: phase === "run" });
      return;
    }
    renderStep();
    syncTutorialLockedControls();
  }

  function openPhase(nextPhase) {
    if (!tutorialEnabled || active) return;
    consumeForcedReplay();
    phase = nextPhase;
    active = true;
    stepIndex = 0;
    if (nextPhase === "run") {
      tutorialCheatOfferHandled = false;
    }
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    renderStep();
    syncTutorialLockedControls();
  }

  function maybeStartRun() {
    if (!tutorialEnabled) return;
    if (active || state.runMode === "daily" || state.gameOver || !state.current) return;
    openPhase("run");
  }

  function maybeStartPowerChoice() {
    if (!tutorialEnabled) return;
    if (active) return;
    if (state.runMode === "daily") return;
    if (state.activePowerAwardReason) return;
    if (!Array.isArray(state.pendingPowerOptions) || state.pendingPowerOptions.length === 0) return;
    openPhase("power");
  }

  function isBlockingGuess(type) {
    if (!active) return false;
    if (phase !== "run") return false;
    const steps = getActiveSteps();
    const step = steps[stepIndex];
    if (!step?.requireGuess) return true;
    return type !== "higher" && type !== "lower";
  }

  function isGuessButtonsDisabled() {
    if (!active) return false;
    if (phase !== "run") return true;
    const steps = getActiveSteps();
    const step = steps[stepIndex];
    return !step?.requireGuess;
  }

  function isGuidedGuessStep() {
    if (!active || phase !== "run") return false;
    const steps = getActiveSteps();
    const step = steps[stepIndex];
    return !!step?.requireGuess;
  }

  function shouldForceCorrectGuess() {
    if (!active || phase !== "run") return false;
    return true;
  }

  function isBlockingNudge() {
    if (!active) return false;
    return phase === "run";
  }

  function isBlockingPowerPick() {
    if (!active) return false;
    if (phase !== "power") return false;
    const steps = getActiveSteps();
    const step = steps[stepIndex];
    return !step?.requirePowerPick;
  }

  function isTutorialCheatOfferActive() {
    if (!active || phase !== "run" || tutorialCheatOfferHandled) return false;
    const steps = getActiveSteps();
    const step = steps[stepIndex];
    return !!(step?.waitForCheatOffer || step?.requireCheatPick);
  }

  function isBlockingCheatChoice() {
    if (!active || phase !== "run") return false;
    const steps = getActiveSteps();
    const step = steps[stepIndex];
    return !step?.requireCheatPick;
  }

  function isBlockingCheatUse() {
    if (!active || phase !== "run") return false;
    const steps = getActiveSteps();
    const step = steps[stepIndex];
    return !step?.requireCheatUse;
  }

  function waitForCheatOfferThenAdvance() {
    clearCheatOfferPoll();
    const poll = () => {
      if (!active || phase !== "run") return;
      const steps = getActiveSteps();
      const step = steps[stepIndex];
      if (!step?.waitForCheatOffer && !step?.requireCheatPick) return;

      if (Array.isArray(state.pendingCheatOptions) && state.pendingCheatOptions.length > 0) {
        if (step?.requireCheatPick) {
          state.message = "Choose a Cheat.";
          render();
          return;
        }
        state.message = "Cheat ready.";
        nextStep();
        render();
        return;
      }

      cheatOfferPollTimer = setTimeout(poll, 120);
    };

    cheatOfferPollTimer = setTimeout(poll, 120);
  }

  function advanceAfterRevealSettles(onAdvance) {
    clearRevealAdvancePoll();
    const poll = () => {
      if (!active || phase !== "run") return;
      if (state.pendingRevealAnimation) {
        revealAdvancePollTimer = setTimeout(poll, 60);
        return;
      }
      revealAdvancePollTimer = null;
      onAdvance();
    };
    revealAdvancePollTimer = setTimeout(poll, 60);
  }

  function handleGuessResolved(type, before, after) {
    if (!active) return;
    if (phase !== "run") return;
    if (!before.gameOver && after.gameOver) {
      closeOverlay({ complete: false });
      return;
    }
    const steps = getActiveSteps();
    const step = steps[stepIndex];
    if (!step?.requireGuess) return;
    const resolved =
      after.index !== before.index ||
      after.correctAnswers !== before.correctAnswers ||
      after.gameOver !== before.gameOver;
    if (!resolved) return;

    const requiredCorrectAnswers = Number(step.untilCorrectAnswers) || 0;
    if (requiredCorrectAnswers > 0 && after.correctAnswers < requiredCorrectAnswers) {
      const guessesLeft = requiredCorrectAnswers - after.correctAnswers;
      state.message = `Keep going: ${guessesLeft} left.`;
      render();
      return;
    }

    if (step.waitForCheatOffer || step.requireCheatPick) {
      if (!Array.isArray(state.pendingCheatOptions) || state.pendingCheatOptions.length === 0) {
        state.message = step.requireCheatPick
          ? "Cheat next."
          : "Reward soon.";
        render();
        waitForCheatOfferThenAdvance();
        return;
      }

      if (step.requireCheatPick) {
        state.message = "Choose a Cheat.";
        render();
        return;
      }
    }

    clearCheatOfferPoll();
    state.message = "Revealed.";
    advanceAfterRevealSettles(() => {
      nextStep();
      render();
    });
  }

  function handlePowerPicked(power, isRewardChoice = false) {
    if (!active) return;
    if (phase !== "power") return;
    if (isRewardChoice) return;
    const powerName = power?.name || "that power";
    state.message = "Power picked.";
    closeOverlay({ complete: false });
  }

  function handleCheatPicked(cheat) {
    if (!active || phase !== "run") return;
    const steps = getActiveSteps();
    const step = steps[stepIndex];
    const choiceAvailable = Array.isArray(state.pendingCheatOptions) && state.pendingCheatOptions.length > 0;
    if (!step?.requireCheatPick && !choiceAvailable) return;
    tutorialCheatOfferHandled = true;
    state.message = "Cheat added.";
    nextStep();
    render();
  }

  function handleCheatUsed() {
    if (!active || phase !== "run") return;
    const steps = getActiveSteps();
    const step = steps[stepIndex];
    if (!step?.requireCheatUse) return;
    state.message = "Good luck.";
    closeOverlay({ complete: true });
    render();
  }

  nextBtn.addEventListener("click", () => {
    if (!active) return;
    const steps = getActiveSteps();
    const step = steps[stepIndex];
    if (step?.requireGuess || step?.requirePowerPick || step?.requireCheatPick || step?.requireCheatUse) return;
    if (phase === "run" && stepIndex === steps.length - 1) {
      state.message = "Good luck.";
    }
    nextStep();
    render();
  });

  skipBtn.addEventListener("click", () => closeOverlay({ complete: true }));

  window.addEventListener("resize", updateFocusBox, { passive: true });
  window.addEventListener("scroll", updateFocusBox, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateFocusBox, { passive: true });
    window.visualViewport.addEventListener("scroll", updateFocusBox, { passive: true });
  }

  return {
    maybeStartRun,
    maybeStartPowerChoice,
    isBlockingGuess,
    isGuessButtonsDisabled,
    isGuidedGuessStep,
    shouldForceCorrectGuess,
    isBlockingNudge,
    isBlockingPowerPick,
    isTutorialCheatOfferActive,
    isBlockingCheatChoice,
    isBlockingCheatUse,
    handleGuessResolved,
    handlePowerPicked,
    handleCheatPicked,
    handleCheatUsed,
    closeAndComplete: () => closeOverlay({ complete: true }),
  };
}

window.tutorialController = createTutorialController();
window.maybeStartFirstRunTutorial = () => window.tutorialController?.maybeStartRun?.();
window.maybeStartPowerChoiceTutorial = () => window.tutorialController?.maybeStartPowerChoice?.();
window.handleTutorialGuessResolved = (type, before, after) =>
  window.tutorialController?.handleGuessResolved?.(type, before, after);
window.handleTutorialPowerPicked = (power, isRewardChoice) =>
  window.tutorialController?.handlePowerPicked?.(power, isRewardChoice);
window.isTutorialBlockingNudge = () =>
  window.tutorialController?.isBlockingNudge?.() || false;
window.isTutorialGuessButtonsDisabled = () =>
  window.tutorialController?.isGuessButtonsDisabled?.() || false;
window.shouldTutorialForceCorrectGuess = () =>
  window.tutorialController?.shouldForceCorrectGuess?.() || false;
window.isTutorialBlockingPowerPick = () =>
  window.tutorialController?.isBlockingPowerPick?.() || false;
window.isTutorialCheatOfferActive = () =>
  window.tutorialController?.isTutorialCheatOfferActive?.() || false;
window.isTutorialBlockingCheatChoice = () =>
  window.tutorialController?.isBlockingCheatChoice?.() || false;
window.isTutorialBlockingCheatUse = () =>
  window.tutorialController?.isBlockingCheatUse?.() || false;
window.handleTutorialCheatPicked = (cheat) =>
  window.tutorialController?.handleCheatPicked?.(cheat);
window.handleTutorialCheatUsed = (cheat, result) =>
  window.tutorialController?.handleCheatUsed?.(cheat, result);

document.getElementById("restart-btn").onclick = () => {
  const runIsActive = !state.gameOver && !!state.current;
  const runWasCompletelyCleared =
    state.gameOver &&
    typeof getRunScoreFromCorrectAnswers === "function" &&
    getRunScoreFromCorrectAnswers(state.correctAnswers) >= 52;

  if (state.saveScumPendingContinue && typeof continueSaveScumRun === "function") {
    continueSaveScumRun();
    return;
  }

  if (state.runMode === "daily") {
    const variantLabel = typeof getDailyVariantConfig === "function"
      ? getDailyVariantConfig(state.dailyVariant).label || "Daily"
      : "Daily";
    state.message = state.gameOver
      ? `${variantLabel} Daily is complete. View the daily board for your result.`
      : `${variantLabel} Daily runs cannot be restarted.`;
    render();
    return;
  }

  if (!runIsActive) {
    if (runWasCompletelyCleared) {
      window.location.href = "index.html";
      return;
    }
    startRun(!state.openingPreview);
    return;
  }

  if (!state.restartConfirmArmed) {
    state.restartConfirmArmed = true;
    state.message = "Click Restart Run again to confirm restart.";
    render();
    return;
  }

  startRun(true);
};

document.getElementById("run-seed-input")?.addEventListener("blur", (e) => {
  e.target.value = normalizeSeed(e.target.value);
});

document.getElementById("random-seed-btn")?.addEventListener("click", () => {
  startRun(false);
});

document.getElementById("copy-seed-btn")?.addEventListener("click", async () => {
  const seedToCopy = state.runSeed ? `${GAME_VERSION}-${state.runSeed}` : "";
  if (!seedToCopy) return;

  try {
    await navigator.clipboard.writeText(seedToCopy);
    state.message = `Copied ${seedToCopy}`;
  } catch {
    state.message = `Seed: ${seedToCopy}`;
  }

  renderMessage();
});

const MENU_MODAL_CLOSE_MS = 198;
const menuModalCloseTimers = new Map();

function syncBodyModalOpenClass() {
  const visibleModalIds = [
    "game-howto-modal",
    "game-log-modal",
    "game-settings-modal",
    "victory-modal",
  ];
  const hasVisibleModal = visibleModalIds.some((id) => {
    const modal = document.getElementById(id);
    return modal && !modal.classList.contains("hidden");
  });
  document.body.classList.toggle("modal-open", hasVisibleModal);
}

function openMenuModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return null;
  const closeTimer = menuModalCloseTimers.get(modalId);
  if (closeTimer) {
    clearTimeout(closeTimer);
    menuModalCloseTimers.delete(modalId);
  }
  modal.classList.remove("hidden", "is-closing");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  return modal;
}

function closeMenuModal(modalId, onCloseStart) {
  const modal = document.getElementById(modalId);
  if (!modal || modal.classList.contains("hidden")) return;
  if (modal.classList.contains("is-closing")) return;

  onCloseStart?.();
  modal.classList.add("is-closing");
  modal.setAttribute("aria-hidden", "true");

  const closeTimer = setTimeout(() => {
    modal.classList.add("hidden");
    modal.classList.remove("is-closing");
    menuModalCloseTimers.delete(modalId);
    syncBodyModalOpenClass();
  }, MENU_MODAL_CLOSE_MS);
  menuModalCloseTimers.set(modalId, closeTimer);
}

function closeHowToModal() {
  closeMenuModal("game-howto-modal");
}

function openHowToModal() {
  openMenuModal("game-howto-modal");
}

function closeRunLogModal() {
  closeMenuModal("game-log-modal");
}

function openRunLogModal() {
  if (typeof renderRunLogList === "function") {
    renderRunLogList();
  }
  openMenuModal("game-log-modal");
}

const SETTINGS_RESET_HOLD_MS = 5000;
let settingsResetHoldTimer = null;
let settingsResetHoldRaf = 0;
let settingsResetHoldStartedAt = 0;
let settingsResetTriggered = false;

function getTutorialCompletedKey() {
  return typeof TUTORIAL_COMPLETED_KEY === "string"
    ? TUTORIAL_COMPLETED_KEY
    : "hl_prototype_tutorial_completed_v1";
}

function getTutorialForceReplayKey() {
  return typeof TUTORIAL_FORCE_REPLAY_KEY === "string"
    ? TUTORIAL_FORCE_REPLAY_KEY
    : "hl_prototype_tutorial_force_replay_v1";
}

function getLatestRunLogEntriesForModal() {
  const entries = loadRunDebugLog();
  return Array.isArray(entries) ? entries : [];
}

function buildRunLogDownloadPayloadForModal() {
  const entries = getLatestRunLogEntriesForModal();
  if (!entries.length) return null;

  const latestEntry = entries[entries.length - 1] || {};
  return {
    exportedAt: new Date().toISOString(),
    gameVersion: typeof GAME_VERSION === "string" ? GAME_VERSION : "",
    seed: latestEntry.runSeed || "",
    runMode: latestEntry.runMode || "standard",
    deck: latestEntry.deck || "blue",
    level: latestEntry.level || DEFAULT_LEVEL_NUMBER,
    eventCount: entries.length,
    userAgent: navigator.userAgent,
    entries,
  };
}

function buildRunLogFilenameForModal(payload) {
  const seedPart = String(payload.seed || "unknown").replace(/[^A-Z0-9_-]+/gi, "-");
  const deckPart = String(payload.deck || "blue");
  const levelPart = `L${Number(payload.level || DEFAULT_LEVEL_NUMBER)}`;
  return `52-run-log-${deckPart}-${levelPart}-${seedPart}.json`;
}

function buildRunLogFileForModal(payload) {
  return new File(
    [JSON.stringify(payload, null, 2)],
    buildRunLogFilenameForModal(payload),
    { type: "application/json" }
  );
}

function setSettingsModalStatus(message = "") {
  const status = document.getElementById("settings-modal-status");
  if (status) status.innerText = message;
}

function applyVisualTheme(theme) {
  document.body.dataset.visuals = theme === "new" ? "new" : "neon";
}

function refreshSettingsModalState() {
  const tutorialToggle = document.getElementById("settings-tutorial-toggle");
  const visualsSelect = document.getElementById("settings-visuals-select");
  const buttonOrderSelect = document.getElementById("settings-button-order-select");
  const nudgeOrderSelect = document.getElementById("settings-nudge-order-select");
  const experienceToggle = document.getElementById("settings-experience-toggle");
  const unlockDecksToggle = document.getElementById("settings-unlock-decks-toggle");
  const shareLogBtn = document.getElementById("settings-share-log-btn");
  const downloadLogBtn = document.getElementById("settings-download-log-btn");
  const hasLog = getLatestRunLogEntriesForModal().length > 0;

  if (tutorialToggle) {
    tutorialToggle.checked = localStorage.getItem(getTutorialCompletedKey()) !== "1";
  }
  if (visualsSelect) {
    visualsSelect.value = loadVisualTheme();
  }
  if (buttonOrderSelect) {
    buttonOrderSelect.value = loadGuessButtonOrder();
  }
  if (nudgeOrderSelect) {
    nudgeOrderSelect.value = loadNudgeButtonOrder();
  }
  if (experienceToggle) {
    experienceToggle.checked = loadExperienceDisplayEnabled();
  }
  if (unlockDecksToggle) {
    unlockDecksToggle.checked = loadUnlockDecks();
  }
  if (downloadLogBtn) {
    downloadLogBtn.disabled = !hasLog;
  }
  if (shareLogBtn) {
    shareLogBtn.disabled = !hasLog || typeof navigator.share !== "function";
  }
  setSettingsModalStatus(hasLog ? "" : "No run log found yet. Start a run first.");
}

function closeSettingsModal() {
  closeMenuModal("game-settings-modal", () => {
    stopSettingsResetHold();
    resetSettingsResetHoldVisuals();
  });
}

function openSettingsModal() {
  refreshSettingsModalState();
  openMenuModal("game-settings-modal");
}

function downloadLatestRunLogFromModal() {
  const payload = buildRunLogDownloadPayloadForModal();
  if (!payload) {
    setSettingsModalStatus("No run log found yet. Start a run first.");
    return;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildRunLogFilenameForModal(payload);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setSettingsModalStatus("Run log downloaded.");
}

async function shareLatestRunLogFromModal() {
  const payload = buildRunLogDownloadPayloadForModal();
  if (!payload) {
    setSettingsModalStatus("No run log found yet. Start a run first.");
    return;
  }

  if (typeof navigator.share !== "function") {
    downloadLatestRunLogFromModal();
    return;
  }

  const file = buildRunLogFileForModal(payload);
  const shareData = {
    title: "52! Run Log",
    text: `52! run log for ${payload.deck} Level ${payload.level}, seed ${payload.seed || "unknown"}.`,
    files: [file],
  };

  try {
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share(shareData);
      setSettingsModalStatus("Run log shared.");
      return;
    }

    await navigator.share({
      title: shareData.title,
      text: `${shareData.text} Downloading the log file instead.`,
    });
    downloadLatestRunLogFromModal();
  } catch (error) {
    if (error?.name === "AbortError") {
      setSettingsModalStatus("Share cancelled.");
      return;
    }
    downloadLatestRunLogFromModal();
  }
}

function setSettingsResetHoldProgress(progress) {
  const fill = document.getElementById("settings-reset-deck-fill");
  if (fill) {
    fill.style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
  }
}

function resetSettingsResetHoldVisuals() {
  const label = document.getElementById("settings-reset-deck-label");
  setSettingsResetHoldProgress(0);
  if (label) {
    label.innerText = "Reset Deck";
  }
}

function stopSettingsResetHold() {
  if (settingsResetHoldTimer) {
    clearTimeout(settingsResetHoldTimer);
    settingsResetHoldTimer = null;
  }
  if (settingsResetHoldRaf) {
    cancelAnimationFrame(settingsResetHoldRaf);
    settingsResetHoldRaf = 0;
  }
}

function updateSettingsResetHoldProgress() {
  if (!settingsResetHoldStartedAt || settingsResetTriggered) return;
  const label = document.getElementById("settings-reset-deck-label");
  const elapsed = performance.now() - settingsResetHoldStartedAt;
  const progress = Math.min(1, elapsed / SETTINGS_RESET_HOLD_MS);
  setSettingsResetHoldProgress(progress);
  if (label) {
    label.innerText = progress >= 1
      ? "Deck Reset"
      : `Hold ${Math.max(0, Math.ceil((SETTINGS_RESET_HOLD_MS - elapsed) / 1000))}s`;
  }
  if (progress < 1) {
    settingsResetHoldRaf = requestAnimationFrame(updateSettingsResetHoldProgress);
  }
}

function triggerSettingsDeckReset() {
  settingsResetTriggered = true;
  stopSettingsResetHold();
  resetDeckAlterations();
  state.cardBackStatuses = {};
  setSettingsResetHoldProgress(1);
  const label = document.getElementById("settings-reset-deck-label");
  if (label) {
    label.innerText = "Deck Reset";
  }
  setSettingsModalStatus("Deck physical changes cleared.");
  render();
}

function beginSettingsResetHold(event) {
  if (event?.button !== undefined && event.button !== 0) return;
  stopSettingsResetHold();
  settingsResetTriggered = false;
  settingsResetHoldStartedAt = performance.now();
  setSettingsModalStatus("Keep holding to reset the deck.");
  settingsResetHoldTimer = setTimeout(triggerSettingsDeckReset, SETTINGS_RESET_HOLD_MS);
  settingsResetHoldRaf = requestAnimationFrame(updateSettingsResetHoldProgress);
}

function cancelSettingsResetHold() {
  if (settingsResetTriggered) return;
  stopSettingsResetHold();
  settingsResetHoldStartedAt = 0;
  resetSettingsResetHoldVisuals();
  refreshSettingsModalState();
}

const headerMenuEl = document.getElementById("header-menu");
const menuBtnEl = document.getElementById("menu-btn");
const menuWrapEl = document.querySelector(".header-menu-wrap");

function setHeaderMenuOpen(open) {
  if (!headerMenuEl || !menuBtnEl) return;
  headerMenuEl.classList.toggle("hidden", !open);
  headerMenuEl.setAttribute("aria-hidden", open ? "false" : "true");
  menuBtnEl.setAttribute("aria-expanded", open ? "true" : "false");
}

menuBtnEl?.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = menuBtnEl.getAttribute("aria-expanded") === "true";
  setHeaderMenuOpen(!isOpen);
});

document.addEventListener("click", (event) => {
  if (!menuWrapEl || !headerMenuEl || headerMenuEl.classList.contains("hidden")) return;
  if (!menuWrapEl.contains(event.target)) {
    setHeaderMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setHeaderMenuOpen(false);
    closeHowToModal();
    closeRunLogModal();
    closeSettingsModal();
  }
});

document.getElementById("howto-open-btn")?.addEventListener("click", () => {
  setHeaderMenuOpen(false);
  openHowToModal();
});
document.getElementById("howto-close-icon-btn")?.addEventListener("click", closeHowToModal);
document.getElementById("howto-close-backdrop")?.addEventListener("click", closeHowToModal);
document.getElementById("run-log-btn")?.addEventListener("click", openRunLogModal);
document.getElementById("log-close-icon-btn")?.addEventListener("click", closeRunLogModal);
document.getElementById("log-close-backdrop")?.addEventListener("click", closeRunLogModal);

document.getElementById("settings-menu-btn")?.addEventListener("click", () => {
  setHeaderMenuOpen(false);
  openSettingsModal();
});

document.getElementById("settings-close-icon-btn")?.addEventListener("click", closeSettingsModal);
document.getElementById("settings-close-backdrop")?.addEventListener("click", closeSettingsModal);
document.getElementById("settings-download-log-btn")?.addEventListener("click", downloadLatestRunLogFromModal);
document.getElementById("settings-share-log-btn")?.addEventListener("click", shareLatestRunLogFromModal);

document.getElementById("settings-visuals-select")?.addEventListener("change", (event) => {
  const theme = event.target.value === "new" ? "new" : "neon";
  saveVisualTheme(theme);
  applyVisualTheme(theme);
  render();
});

document.getElementById("settings-tutorial-toggle")?.addEventListener("change", (event) => {
  if (event.target.checked) {
    localStorage.removeItem(getTutorialCompletedKey());
    sessionStorage.setItem(getTutorialForceReplayKey(), "1");
    window.tutorialController = createTutorialController();
    setSettingsModalStatus("Tutorial enabled for the next run.");
    return;
  }

  localStorage.setItem(getTutorialCompletedKey(), "1");
  sessionStorage.removeItem(getTutorialForceReplayKey());
  window.tutorialController?.closeAndComplete?.();
  setSettingsModalStatus("Tutorial disabled.");
});

document.getElementById("settings-button-order-select")?.addEventListener("change", (event) => {
  saveGuessButtonOrder(event.target.value);
  render();
  setSettingsModalStatus(event.target.value === "higher-lower"
    ? "Guess buttons set to Higher / Lower."
    : "Guess buttons set to Lower / Higher.");
});

document.getElementById("settings-nudge-order-select")?.addEventListener("change", (event) => {
  saveNudgeButtonOrder(event.target.value);
  render();
  setSettingsModalStatus(event.target.value === "up-down"
    ? "Nudges set to Up / Down."
    : "Nudges set to Down / Up.");
});

document.getElementById("settings-experience-toggle")?.addEventListener("change", (event) => {
  const enabled = saveExperienceDisplayEnabled(!!event.target.checked);
  if (!enabled && typeof completeExperienceBankingAnimation === "function") {
    completeExperienceBankingAnimation({ fade: true });
    state.experienceBankedCardIds = new Set();
  }
  render();
  setSettingsModalStatus(enabled
    ? "Experience display enabled."
    : "Experience is still tracked, but hidden.");
});

document.getElementById("settings-unlock-decks-toggle")?.addEventListener("change", (event) => {
  saveUnlockDecks(!!event.target.checked);
  setSettingsModalStatus(event.target.checked
    ? "All decks, including Black Deck, are unlocked on this device."
    : "Normal deck progression restored.");
});

const settingsResetDeckBtn = document.getElementById("settings-reset-deck-btn");
settingsResetDeckBtn?.addEventListener("pointerdown", beginSettingsResetHold);
settingsResetDeckBtn?.addEventListener("pointerup", cancelSettingsResetHold);
settingsResetDeckBtn?.addEventListener("pointercancel", cancelSettingsResetHold);
settingsResetDeckBtn?.addEventListener("pointerleave", cancelSettingsResetHold);

document.getElementById("exit-btn")?.addEventListener("click", () => {
  setHeaderMenuOpen(false);
  window.skipAutoSnapshot = true;
  clearGameStateSnapshot();
  window.location.href = "index.html?v=20260405d";
});

function handleNudgeControlPress(direction) {
  if (typeof window.isTutorialBlockingNudge === "function" && window.isTutorialBlockingNudge()) {
    state.message = "Tutorial locked.";
    renderMessage();
    return;
  }
  useNudgeCharge(direction);
}

function bindNudgeControl(buttonId, direction) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  let ignoreNextClick = false;
  let ignoreNextClickTimer = null;

  button.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (button.disabled) return;
    ignoreNextClick = true;
    if (ignoreNextClickTimer) clearTimeout(ignoreNextClickTimer);
    ignoreNextClickTimer = setTimeout(() => {
      ignoreNextClick = false;
      ignoreNextClickTimer = null;
    }, 450);
    event.preventDefault();
    handleNudgeControlPress(direction);
  });

  button.addEventListener("click", (event) => {
    if (ignoreNextClick) {
      ignoreNextClick = false;
      if (ignoreNextClickTimer) {
        clearTimeout(ignoreNextClickTimer);
        ignoreNextClickTimer = null;
      }
      event.preventDefault();
      return;
    }
    handleNudgeControlPress(direction);
  });
}

bindNudgeControl("nudge-up-btn", "up");
bindNudgeControl("nudge-down-btn", "down");

const scoreEl = document.getElementById("score");
const scoreDebugTapTarget = document.querySelector(".hud-card-score");
const remainingDebugTapTarget = document.querySelector(".hud-card-remaining");
let debugScoreTapCount = 0;
let debugScoreTapWindowTimer = null;
let debugRemainingTapCount = 0;
let debugRemainingTapWindowTimer = null;

function resetDebugScoreTapSequence() {
  debugScoreTapCount = 0;
  if (debugScoreTapWindowTimer) {
    clearTimeout(debugScoreTapWindowTimer);
    debugScoreTapWindowTimer = null;
  }
}

function resetDebugRemainingTapSequence() {
  debugRemainingTapCount = 0;
  if (debugRemainingTapWindowTimer) {
    clearTimeout(debugRemainingTapWindowTimer);
    debugRemainingTapWindowTimer = null;
  }
}

function handleDebugScoreTap() {
  if (!window.testModeEnabled) return;
  if (state.runMode === "daily") return;

  debugScoreTapCount += 1;

  if (debugScoreTapWindowTimer) {
    clearTimeout(debugScoreTapWindowTimer);
  }

  debugScoreTapWindowTimer = setTimeout(() => {
    resetDebugScoreTapSequence();
  }, 2200);

  if (debugScoreTapCount >= 10) {
    resetDebugScoreTapSequence();
    addMissingCheatsForDebug();
    return;
  }

  state.message = ` Debug: tap score ${debugScoreTapCount}/10 to add all cheats.`;
  renderMessage();
}

function handleDebugRemainingTap() {
  if (!window.testModeEnabled) return;

  debugRemainingTapCount += 1;

  if (debugRemainingTapWindowTimer) {
    clearTimeout(debugRemainingTapWindowTimer);
  }

  debugRemainingTapWindowTimer = setTimeout(() => {
    resetDebugRemainingTapSequence();
  }, 2200);

  if (debugRemainingTapCount >= 10) {
    resetDebugRemainingTapSequence();
    triggerVictoryEffect();
    state.message = " Debug: victory celebration triggered.";
    renderMessage();
    return;
  }

  state.message = ` Debug: tap cards remaining ${debugRemainingTapCount}/10 for victory celebration.`;
  renderMessage();
}

scoreDebugTapTarget?.addEventListener("pointerup", handleDebugScoreTap);
scoreEl?.addEventListener("click", (e) => {
  e.stopPropagation();
  handleDebugScoreTap();
});
remainingDebugTapTarget?.addEventListener("pointerup", handleDebugRemainingTap);

function closeVictoryModal() {
  const modal = document.getElementById("victory-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

async function openVictoryModal() {
  const modal = document.getElementById("victory-modal");
  const seedEl = document.getElementById("victory-seed");
  const statusEl = document.getElementById("victory-status");
  const inputEl = document.getElementById("victory-name-input");

  if (!modal || !seedEl || !statusEl || !inputEl) return;

  const preferredName = loadPreferredHeroName();
  if (preferredName && state.runMode !== "daily") {
    const result = await submitHeroWin(
      preferredName,
      `${GAME_VERSION}-${state.runSeed || ""}`,
      getVictoryDeckLabel(),
      getVictoryStartingPowerName(),
      getVictoryDeckLevel()
    );
    state.message = `🏆 ${result.message}`;
    renderMessage();
    return;
  }

  seedEl.innerText = `Seed: ${GAME_VERSION}-${state.runSeed || ""}`;
  statusEl.innerText = "";
  inputEl.value = preferredName;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  setTimeout(() => inputEl.focus(), 0);
}

window.promptHeroNameForVictory = openVictoryModal;

function getVictoryDeckLabel() {
  return getDeckName(state.currentDeckKey);
}

function getVictoryStartingPowerName() {
  return state.selectedStartPowerId ? getPowerName(state.selectedStartPowerId) : "No Power";
}

function getVictoryDeckLevel() {
  return normalizeLevelNumber(state.currentLevelNumber || state.selectedLevelNumber || DEFAULT_LEVEL_NUMBER);
}

document.getElementById("victory-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const inputEl = document.getElementById("victory-name-input");
  const statusEl = document.getElementById("victory-status");
  const submitBtn = document.getElementById("victory-submit-btn");

  if (!inputEl || !statusEl || !submitBtn) return;

  if (window.devModeEnabled || state.devMode) {
    statusEl.innerText = "Dev mode: hero run not saved.";
    setTimeout(() => closeVictoryModal(), 700);
    return;
  }

  submitBtn.disabled = true;
  const result = await submitHeroWin(
    inputEl.value,
    `${GAME_VERSION}-${state.runSeed || ""}`,
    getVictoryDeckLabel(),
    getVictoryStartingPowerName(),
    getVictoryDeckLevel()
  );
  statusEl.innerText = result.message;

  if (result.ok) {
    state.message = `🏆 ${result.message}`;
    renderMessage();
    setTimeout(() => closeVictoryModal(), 700);
  }

  submitBtn.disabled = false;
});

document.getElementById("victory-skip-btn")?.addEventListener("click", () => {
  closeVictoryModal();
});

document.getElementById("victory-modal")?.addEventListener("click", (e) => {
  if (e.target && e.target.classList && e.target.classList.contains("victory-backdrop")) {
    closeVictoryModal();
  }
});

window.addEventListener("pagehide", () => {
  if (window.skipAutoSnapshot) return;
  if (window.devModeEnabled || state.devMode) return;
  saveGameStateSnapshot(state);
});

function closeAllTransientTooltips() {
  if (typeof window.hideCheatTooltip === "function") {
    window.hideCheatTooltip();
  }
}

window.addEventListener("pointerup", (e) => {
  if (e.pointerType !== "touch") return;
  closeAllTransientTooltips();
});

window.addEventListener("pointercancel", (e) => {
  if (e.pointerType !== "touch") return;
  closeAllTransientTooltips();
});

window.addEventListener("touchend", () => {
  closeAllTransientTooltips();
});

window.addEventListener("touchcancel", () => {
  closeAllTransientTooltips();
});

window.addEventListener("touchmove", () => {
  closeAllTransientTooltips();
}, { passive: true });

window.addEventListener("scroll", () => {
  closeAllTransientTooltips();
}, true);

window.addEventListener("wheel", () => {
  closeAllTransientTooltips();
}, { passive: true });

window.addEventListener("keydown", (e) => {
  const debugEnabled = !!window.testModeEnabled;
  const matchesKey = (key, code) => e.key === key || e.key === key.toUpperCase() || e.code === code;

  if (window.devModeEnabled && e.shiftKey && matchesKey("p", "KeyP")) {
    e.preventDefault();
    grantNextDevPower();
    return;
  }

  if (window.devModeEnabled && e.shiftKey && matchesKey("w", "KeyW")) {
    e.preventDefault();
    winCurrentRunForDev();
    return;
  }

  if (window.devModeEnabled && e.shiftKey && matchesKey("l", "KeyL")) {
    e.preventDefault();
    nearlyCompleteRunForDev();
    return;
  }

  if (debugEnabled) {
    if (matchesKey("c", "KeyC")) {
      clearCheatsForDebug();
      return;
    }

    if (matchesKey("f", "KeyF") && !e.shiftKey) {
      resetAllStatsForDebug();
      return;
    }

    if (matchesKey("f", "KeyF") && e.shiftKey) {
      fullResetAllStateForDebug();
      return;
    }

    if (matchesKey("d", "KeyD")) {
      if (state.pendingPowerOptions.length > 0) {
        state.pendingPowerOptions = getUnlockedPowerPool(true);
        state.powerChoiceLockedUntil = 0;
        state.message = " Debug: showing all power choices.";
        render();
        return;
      }
      addMissingCheatsForDebug();
      return;
    }

    if (matchesKey("n", "KeyN")) {
      addBulkNudgesForDebug();
      return;
    }

    if (matchesKey("w", "KeyW")) {
      triggerVictoryEffect();
      state.message = " Debug: victory celebration triggered.";
      renderMessage();
      return;
    }

    if (matchesKey("l", "KeyL")) {
      const exportedLog = typeof window.exportRunDebugLog === "function"
        ? window.exportRunDebugLog()
        : "[]";

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(exportedLog).then(() => {
          state.message = " Debug: run log copied to clipboard.";
          renderMessage();
        }).catch(() => {
          console.log(exportedLog);
          state.message = " Debug: run log written to console.";
          renderMessage();
        });
      } else {
        console.log(exportedLog);
        state.message = " Debug: run log written to console.";
        renderMessage();
      }
      return;
    }
  }

  if (e.key === "Escape") {
    closeHowToModal();
  }

  if (state.gameOver || state.pendingCheatOptions.length > 0 || state.pendingPowerOptions.length > 0) return;

  if (e.key === "ArrowUp") makeGuess("higher");
  if (e.key === "ArrowDown") makeGuess("lower");
});

applyVisualTheme(loadVisualTheme());
