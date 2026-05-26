const PROFILE_NAME_KEY = "hl_prototype_hero_name";
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
  const backBtn = document.getElementById("profile-back-btn");

  if (!nameInput || !crownStripEl || !bestRunEl || !totalCorrectEl || !decksBeatenEl || !runsStartedEl || !blueClearsEl || !redClearsEl || !greenClearsEl || !yellowClearsEl || !blueRunsEl || !redRunsEl || !greenRunsEl || !yellowRunsEl || !dailyAttemptsEl || !dailyClearsEl || !stampEl || !achievementListEl || !cardStateSummaryEl || !cardStateGridEl || !backBtn) {
    return;
  }

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

  render();
}

renderProfilePage();
