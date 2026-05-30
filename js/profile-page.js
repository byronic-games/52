const PROFILE_NAME_KEY = "hl_prototype_hero_name";
const PROFILE_RESTORE_HOLD_DURATION_MS = 5000;

function getProfileAchievements(stats, deckWins) {
  return [
    {
      label: "First Deck Cleared",
      unlocked: (stats.totalDecksCleared || 0) >= 1,
    },
    {
      label: "Blue Deck Cleared",
      unlocked: (deckWins.blue || 0) >= 1,
    },
    {
      label: "Red Deck Cleared",
      unlocked: (deckWins.red || 0) >= 1,
    },
    {
      label: "Green Deck Cleared",
      unlocked: (deckWins.green || 0) >= 1,
    },
    {
      label: "Yellow Deck Cleared",
      unlocked: (deckWins.yellow || 0) >= 1,
    },
    {
      label: "100 Correct Guesses",
      unlocked: (stats.totalCorrectGuesses || 0) >= 100,
    },
    {
      label: "10 Decks Beaten",
      unlocked: (stats.totalDecksCleared || 0) >= 10,
    },
    {
      label: "Daily Starter",
      unlocked: (stats.dailyAttempts || 0) >= 1,
    },
    {
      label: "Daily Completed",
      unlocked: (stats.dailyClears || 0) >= 1,
    },
  ];
}

function getProfileStampLabel(achievements) {
  const unlockedCount = achievements.filter((entry) => entry.unlocked).length;
  if (unlockedCount >= 4) return "Deck Veteran";
  if (unlockedCount >= 2) return "Run Survivor";
  if (unlockedCount >= 1) return "First Stamp";
  return "New Challenger";
}

function syncProfileSnapshotCardBackStatus(cardId, status) {
  if (!cardId || typeof sessionStorage === "undefined" || typeof GAME_STATE_SNAPSHOT_KEY === "undefined") return;
  const raw = sessionStorage.getItem(GAME_STATE_SNAPSHOT_KEY);
  if (!raw) return;

  try {
    const snapshot = JSON.parse(raw);
    if (!snapshot || typeof snapshot !== "object") return;
    const statuses = snapshot.cardBackStatuses && typeof snapshot.cardBackStatuses === "object"
      ? snapshot.cardBackStatuses
      : {};
    if (status) {
      statuses[cardId] = status;
    } else {
      delete statuses[cardId];
    }
    snapshot.cardBackStatuses = statuses;
    sessionStorage.setItem(GAME_STATE_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Persistent storage has already been updated, so malformed snapshots can be ignored.
  }
}

function restoreProfileTornCard(cardId) {
  if (!cardId || typeof loadCardBackStatuses !== "function" || typeof saveCardBackStatuses !== "function") return false;

  const statuses = loadCardBackStatuses();
  const current = statuses?.[cardId];
  if (!current?.tornCorner) return false;

  const nextStatus = { ...current, tornCorner: false };
  const isDefaultStatus = !nextStatus.tornCorner && (!nextStatus.backColor || nextStatus.backColor === "blue");
  if (isDefaultStatus) {
    delete statuses[cardId];
    syncProfileSnapshotCardBackStatus(cardId, null);
  } else {
    statuses[cardId] = nextStatus;
    syncProfileSnapshotCardBackStatus(cardId, nextStatus);
  }
  saveCardBackStatuses(statuses);
  return true;
}

function renderProfileCardStateGrid(gridEl, summaryEl) {
  if (!gridEl || !summaryEl || !Array.isArray(SUITS) || !Array.isArray(RANKS)) return;

  const statuses = typeof loadCardBackStatuses === "function" ? loadCardBackStatuses() : {};
  const tornIds = new Set(
    Object.entries(statuses || {})
      .filter(([, status]) => !!status?.tornCorner)
      .map(([cardId]) => cardId)
  );

  gridEl.innerHTML = "";
  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      const cardId = getCardId(suit, rank.r);
      const isTorn = tornIds.has(cardId);
      const cell = document.createElement("div");
      cell.dataset.cardId = cardId;
      cell.dataset.cardLabel = `${rank.r}${suit}`;
      cell.dataset.torn = isTorn ? "true" : "false";
      cell.className = `profile-card-state-cell ${suit === "♥" || suit === "♦" ? "red" : "black"} ${isTorn ? "torn" : ""}`;
      cell.setAttribute("aria-label", `${rank.r}${suit}${isTorn ? " has a torn corner" : " has no tear"}`);

      const rankEl = document.createElement("span");
      rankEl.className = "profile-card-state-rank";
      rankEl.textContent = rank.r;

      const suitEl = document.createElement("span");
      suitEl.className = "profile-card-state-suit";
      suitEl.textContent = suit;

      cell.append(rankEl, suitEl);
      gridEl.appendChild(cell);
    });
  });

  const tornCount = tornIds.size;
  summaryEl.textContent = tornCount > 0
    ? `${tornCount} torn ${tornCount === 1 ? "card" : "cards"} currently marked.`
    : "No torn cards currently marked.";
}

function renderProfilePage() {
  const nameInput = document.getElementById("profile-name-input");
  const crownStripEl = document.getElementById("profile-crown-strip");
  const bestRunEl = document.getElementById("profile-best-run");
  const totalCorrectEl = document.getElementById("profile-total-correct");
  const decksBeatenEl = document.getElementById("profile-decks-beaten");
  const runsStartedEl = document.getElementById("profile-runs-started");
  const blueClearsEl = document.getElementById("profile-blue-clears");
  const redClearsEl = document.getElementById("profile-red-clears");
  const greenClearsEl = document.getElementById("profile-green-clears");
  const yellowClearsEl = document.getElementById("profile-yellow-clears");
  const blueRunsEl = document.getElementById("profile-blue-runs");
  const redRunsEl = document.getElementById("profile-red-runs");
  const greenRunsEl = document.getElementById("profile-green-runs");
  const yellowRunsEl = document.getElementById("profile-yellow-runs");
  const dailyAttemptsEl = document.getElementById("profile-daily-attempts");
  const dailyClearsEl = document.getElementById("profile-daily-clears");
  const stampEl = document.getElementById("profile-stamp");
  const achievementListEl = document.getElementById("profile-achievement-list");
  const cardStateSummaryEl = document.getElementById("profile-card-state-summary");
  const cardStateGridEl = document.getElementById("profile-card-state-grid");
  const resetDeckBtn = document.getElementById("profile-reset-deck-btn");
  const resetDeckFill = document.getElementById("profile-reset-deck-fill");
  const resetDeckLabel = document.getElementById("profile-reset-deck-label");
  const resetDeckStatus = document.getElementById("profile-reset-deck-status");
  const backBtn = document.getElementById("profile-back-btn");

  if (!nameInput || !crownStripEl || !bestRunEl || !totalCorrectEl || !decksBeatenEl || !runsStartedEl || !blueClearsEl || !redClearsEl || !greenClearsEl || !yellowClearsEl || !blueRunsEl || !redRunsEl || !greenRunsEl || !yellowRunsEl || !dailyAttemptsEl || !dailyClearsEl || !stampEl || !achievementListEl || !cardStateSummaryEl || !cardStateGridEl || !resetDeckBtn || !resetDeckFill || !resetDeckLabel || !resetDeckStatus || !backBtn) {
    return;
  }

  let holdStartedAt = 0;
  let holdTimer = null;
  let holdRaf = 0;
  let restoreTriggered = false;
  let activeRestoreCell = null;

  const setHoldProgress = (progress) => {
    resetDeckFill.style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
  };

  const stopHoldTracking = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (holdRaf) {
      cancelAnimationFrame(holdRaf);
      holdRaf = 0;
    }
  };

  const clearHoldVisuals = () => {
    resetDeckBtn.classList.remove("is-armed");
    activeRestoreCell?.classList.remove("restore-hold-active");
    activeRestoreCell = null;
    setHoldProgress(0);
    resetDeckLabel.innerText = "Hold Torn Card To Restore";
  };

  const render = () => {
    const deckWins = loadDeckWins();
    const stats = loadProfileStats();
    const bestRun = loadBestScore();
    const achievements = getProfileAchievements(stats, deckWins);
    const crowns = typeof getLocalCrownSnapshot === "function"
      ? getLocalCrownSnapshot()
      : { summary: "", blueCleared: false, greenCleared: false, redCleared: false, dailyCleared: false };

    nameInput.value = loadPreferredHeroName();
    if (typeof getCrownBadgesHtml === "function") {
      const badgesHtml = getCrownBadgesHtml(crowns);
      crownStripEl.innerHTML = badgesHtml || "No crowns yet. Clear Blue, Green, Red, and a Daily to earn all 4.";
    } else {
      crownStripEl.textContent = crowns.summary || "No crowns yet. Clear Blue, Green, Red, and a Daily to earn all 4.";
    }
    bestRunEl.textContent = String(bestRun || 0);
    totalCorrectEl.textContent = String(stats.totalCorrectGuesses || 0);
    decksBeatenEl.textContent = String(stats.totalDecksCleared || 0);
    runsStartedEl.textContent = String(stats.runsStarted || 0);
    blueClearsEl.textContent = String(deckWins.blue || 0);
    redClearsEl.textContent = String(deckWins.red || 0);
    greenClearsEl.textContent = String(deckWins.green || 0);
    yellowClearsEl.textContent = String(deckWins.yellow || 0);
    blueRunsEl.textContent = String(stats.blueRunsStarted || 0);
    redRunsEl.textContent = String(stats.redRunsStarted || 0);
    greenRunsEl.textContent = String(stats.greenRunsStarted || 0);
    yellowRunsEl.textContent = String(stats.yellowRunsStarted || 0);
    dailyAttemptsEl.textContent = String(stats.dailyAttempts || 0);
    dailyClearsEl.textContent = String(stats.dailyClears || 0);
    stampEl.textContent = getProfileStampLabel(achievements);

    achievementListEl.innerHTML = "";
    achievements.forEach((achievement) => {
      const item = document.createElement("div");
      item.className = `achievement-item ${achievement.unlocked ? "unlocked" : "locked"}`;
      item.textContent = achievement.unlocked ? `Stamped: ${achievement.label}` : "Locked achievement";
      achievementListEl.appendChild(item);
    });

    renderProfileCardStateGrid(cardStateGridEl, cardStateSummaryEl);
  };

  const triggerCardRestore = () => {
    const cardId = activeRestoreCell?.dataset.cardId || "";
    const cardLabel = activeRestoreCell?.dataset.cardLabel || "Card";
    restoreTriggered = true;
    stopHoldTracking();
    resetDeckBtn.classList.remove("is-armed");
    setHoldProgress(1);
    const restored = restoreProfileTornCard(cardId);
    resetDeckLabel.innerText = restored ? "Card Restored" : "Nothing To Restore";
    resetDeckStatus.innerText = restored
      ? `${cardLabel} restored. Card stats remain untouched.`
      : "That card no longer has a torn corner.";
    activeRestoreCell?.classList.remove("restore-hold-active");
    activeRestoreCell = null;
    renderProfileCardStateGrid(cardStateGridEl, cardStateSummaryEl);
  };

  const updateHoldProgress = () => {
    if (!holdStartedAt || restoreTriggered) return;
    const elapsed = performance.now() - holdStartedAt;
    const progress = Math.min(1, elapsed / PROFILE_RESTORE_HOLD_DURATION_MS);
    setHoldProgress(progress);
    resetDeckLabel.innerText = progress >= 1
      ? "Card Restored"
      : `Hold ${Math.max(0, Math.ceil((PROFILE_RESTORE_HOLD_DURATION_MS - elapsed) / 1000))}s To Restore`;

    if (progress < 1) {
      holdRaf = requestAnimationFrame(updateHoldProgress);
    }
  };

  const beginCardRestoreHold = (cell) => {
    if (!cell || cell.dataset.torn !== "true") return;
    stopHoldTracking();
    activeRestoreCell?.classList.remove("restore-hold-active");
    activeRestoreCell = cell;
    restoreTriggered = false;
    holdStartedAt = performance.now();
    resetDeckBtn.classList.add("is-armed");
    cell.classList.add("restore-hold-active");
    resetDeckStatus.innerText = `Keep holding ${cell.dataset.cardLabel || "this card"} to restore its torn corner.`;
    holdTimer = setTimeout(triggerCardRestore, PROFILE_RESTORE_HOLD_DURATION_MS);
    holdRaf = requestAnimationFrame(updateHoldProgress);
  };

  const cancelCardRestoreHold = () => {
    if (restoreTriggered) return;
    stopHoldTracking();
    holdStartedAt = 0;
    clearHoldVisuals();
    resetDeckStatus.innerText = "Hold a torn card in the grid for 5 seconds to permanently restore that corner.";
  };

  nameInput.addEventListener("input", () => {
    savePreferredHeroName(nameInput.value);
  });

  backBtn.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "index.html";
  });

  cardStateGridEl.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const cell = event.target.closest(".profile-card-state-cell.torn");
    if (!cell || !cardStateGridEl.contains(cell)) return;
    event.preventDefault();
    cell.setPointerCapture?.(event.pointerId);
    beginCardRestoreHold(cell);
  });
  cardStateGridEl.addEventListener("pointerup", cancelCardRestoreHold);
  cardStateGridEl.addEventListener("pointerleave", cancelCardRestoreHold);
  cardStateGridEl.addEventListener("pointercancel", cancelCardRestoreHold);
  cardStateGridEl.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".profile-card-state-cell.torn")) {
      event.preventDefault();
    }
  });

  render();
}

renderProfilePage();
