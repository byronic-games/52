const DAILY_SHARE_BASE_URL = "https://byronicman.com/52/daily.html";
const DAILY_SHARE_ENABLED = false; // Set true to enable the Daily Share button.

function formatDailyDateLabel(dateKey) {
  if (!dateKey) return "-";
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function getDailyUnlockRunsStarted() {
  if (typeof loadProfileStats === "function") {
    const stats = loadProfileStats();
    return Number(stats?.runsStarted || 0);
  }

  const profileStatsKey = typeof PROFILE_STATS_KEY === "string"
    ? PROFILE_STATS_KEY
    : "hl_prototype_profile_stats";

  try {
    const parsed = JSON.parse(localStorage.getItem(profileStatsKey) || "{}");
    return Number(parsed?.runsStarted || 0);
  } catch {
    return 0;
  }
}

function buildDailyShareUrl(dateKey) {
  const url = new URL(DAILY_SHARE_BASE_URL);
  url.searchParams.set("date", dateKey);
  return url.toString();
}

function buildDailyShareText(entry, activeDateKey, todayKey) {
  const score = Math.max(0, Number(entry?.score ?? 0));
  const isToday = activeDateKey === todayKey;
  if (isToday) {
    return `I scored ${score} in today's 52! Daily Challenge. Can you do better?`;
  }
  return `I scored ${score} in the 52! Daily Challenge for ${formatDailyDateLabel(activeDateKey)}. Can you do better?`;
}

async function shareDailyResult(entry, activeDateKey, todayKey, statusEl) {
  if (!entry) return;

  const text = buildDailyShareText(entry, activeDateKey, todayKey);
  const url = buildDailyShareUrl(activeDateKey);
  const title = "52! Daily";

  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title, text, url });
      if (statusEl) statusEl.innerText = "Daily score shared.";
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      if (statusEl) statusEl.innerText = "Share cancelled.";
      return;
    }
  }

  const payload = `${text} ${url}`.trim();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
      if (statusEl) statusEl.innerText = "Daily score copied to clipboard.";
      return;
    }
  } catch {
    // Fall through to an inline status message.
  }

  if (statusEl) {
    statusEl.innerText = payload;
  }
}

function renderDailyRows(entries, currentPlayerId, showScores = false) {
  const bodyEl = document.getElementById("daily-table-body");
  const countEl = document.getElementById("daily-board-count");
  const scoreHeading = document.getElementById("daily-score-heading");
  if (!bodyEl || !countEl) return;

  bodyEl.innerHTML = "";
  if (scoreHeading) {
    scoreHeading.innerText = showScores ? "Cards Cleared" : "Result";
  }

  if (!entries.length) {
    bodyEl.innerHTML = "<tr><td colspan='3'>No daily scores yet. Set the pace.</td></tr>";
    countEl.innerText = "0 entries";
    return;
  }

  countEl.innerText = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;

  let previousScore = null;
  let displayRank = 0;

  entries.forEach((entry, index) => {
    if (entry.score !== previousScore) {
      displayRank = index + 1;
      previousScore = entry.score;
    }

    const tr = document.createElement("tr");
    if (entry.playerId && entry.playerId === currentPlayerId) {
      tr.classList.add("current-player");
    }

    const rankTd = document.createElement("td");
    rankTd.dataset.label = "Rank";
    rankTd.innerText = String(displayRank);

    const nameTd = document.createElement("td");
    nameTd.dataset.label = "Name";
    if (typeof formatNameWithCrownsHtml === "function") {
      nameTd.innerHTML = formatNameWithCrownsHtml(entry.playerName || "Unknown", entry);
    } else {
      nameTd.innerText = entry.playerName || "Unknown";
    }

    const scoreTd = document.createElement("td");
    scoreTd.dataset.label = showScores ? "Cards Cleared" : "Result";
    scoreTd.className = "score";
    scoreTd.innerText = showScores ? String(entry.score ?? 0) : "Hidden";

    tr.appendChild(rankTd);
    tr.appendChild(nameTd);
    tr.appendChild(scoreTd);
    bodyEl.appendChild(tr);
  });
}

function navigateToDailyDate(dateKey) {
  // Update URL without full page reload
  window.history.replaceState({ date: dateKey }, "", `daily.html?date=${encodeURIComponent(dateKey)}`);
  // Re-render with new date
  refreshDailyPageForDate(dateKey);
}

async function refreshDailyPageForDate(activeDateKey) {
  const todayKey = getCurrentDailyDateKey();
  const currentPlayerId = getOrCreateDailyPlayerId();
  const dailyUnlocked = getDailyUnlockRunsStarted() >= 1;
  const currentAttempt = getLocalDailyAttempt(activeDateKey);
  const hasCompletedAttempt =
    !!currentAttempt &&
    currentAttempt.dateKey === activeDateKey &&
    currentAttempt.playerId === currentPlayerId &&
    currentAttempt.completed === true;
  // Show scores for past dailies, or if player has completed today's
  const showScores = activeDateKey !== todayKey || hasCompletedAttempt;

  // Update date label
  const dateEl = document.getElementById("daily-date-label");
  if (dateEl) dateEl.innerText = formatDailyDateLabel(activeDateKey);
  
  // Update navigation buttons
  const prevNavBtn = document.getElementById("daily-nav-prev");
  const nextNavBtn = document.getElementById("daily-nav-next");
  
  const canGoPrev = canNavigatePrevious(activeDateKey);
  const canGoNext = canNavigateNext(activeDateKey);
  
  if (prevNavBtn) {
    prevNavBtn.disabled = !canGoPrev;
    prevNavBtn.onclick = (e) => {
      e.preventDefault();
      if (canGoPrev) navigateToDailyDate(decrementDateKey(activeDateKey));
    };
  }
  
  if (nextNavBtn) {
    nextNavBtn.disabled = !canGoNext;
    nextNavBtn.onclick = (e) => {
      e.preventDefault();
      if (canGoNext) navigateToDailyDate(incrementDateKey(activeDateKey));
    };
  }

  // Update status and button states
  const statusEl = document.getElementById("daily-status");
  const boardStatusEl = document.getElementById("daily-board-status");
  const scoreEl = document.getElementById("daily-score-label");
  const resultPanel = document.getElementById("daily-result-panel");
  const startBtn = document.getElementById("daily-start-btn");
  const shareBtn = document.getElementById("daily-share-btn");
  const nameInput = document.getElementById("daily-name-input");

  if (!dailyUnlocked) {
    resultPanel?.classList.add("hidden");
    if (statusEl) {
      statusEl.innerText = "Unlocks after your first run.";
    }
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.innerText = "Locked";
    }
  } else if (currentAttempt) {
    if (hasCompletedAttempt) {
      resultPanel?.classList.remove("hidden");
      if (scoreEl) scoreEl.innerText = String(currentAttempt.score ?? 0);
      if (statusEl) {
        statusEl.innerText = activeDateKey === todayKey
          ? "You have already played today's Daily."
          : "You already played this Daily.";
      }
    } else {
      resultPanel?.classList.add("hidden");
      if (statusEl) {
        statusEl.innerText = "Daily in progress. Resume to finish.";
      }
    }
    if (shareBtn) {
      shareBtn.disabled = !hasCompletedAttempt;
      shareBtn.style.display = hasCompletedAttempt ? "" : "none";
    }
    if (startBtn) {
      startBtn.disabled = hasCompletedAttempt ? true : (activeDateKey !== todayKey);
      startBtn.innerText = hasCompletedAttempt ? "Daily Complete" : (activeDateKey === todayKey ? "Resume Daily" : "Archive");
    }
  } else {
      resultPanel?.classList.add("hidden");
      if (statusEl) {
        statusEl.innerText = activeDateKey === todayKey
          ? "One attempt. Scores reveal after your run."
          : "Archived Daily.";
      }
    if (startBtn) {
      startBtn.disabled = activeDateKey !== todayKey;
      startBtn.innerText = activeDateKey === todayKey ? "Play Daily" : "Archive";
    }
    if (shareBtn) {
      shareBtn.disabled = true;
      shareBtn.style.display = "none";
    }
  }

  if (startBtn) {
    startBtn.onclick = () => {
      const playerName = savePreferredPlayerName(nameInput?.value || "");
      if (!playerName) {
        if (statusEl) statusEl.innerText = "Enter a player name before starting the Daily.";
        nameInput?.focus();
        return;
      }

      if (hasPlayedDaily(activeDateKey)) {
        // Already played, just stay here (don't allow replay)
        return;
      }

      window.location.href = buildDailyGameUrl(activeDateKey);
    };
  }

  if (shareBtn) {
    shareBtn.onclick = () => {
      const entry = hasCompletedAttempt ? currentAttempt : null;
      if (!entry) return;
      if (!DAILY_SHARE_ENABLED) {
        if (statusEl) statusEl.innerText = "Coming soon.";
        return;
      }
      shareDailyResult(entry, activeDateKey, todayKey, statusEl);
    };
  }

  // Fetch and render leaderboard
  const leaderboardResponse = await fetchDailyLeaderboard(activeDateKey, 100);
  const leaderboard = Array.isArray(leaderboardResponse)
    ? leaderboardResponse
    : (leaderboardResponse?.entries || []);
  const remoteAvailable = Array.isArray(leaderboardResponse)
    ? (leaderboardResponse._remoteAvailable !== undefined ? !!leaderboardResponse._remoteAvailable : true)
    : !!leaderboardResponse?.remoteAvailable;
  const boardStatus = Array.isArray(leaderboardResponse)
    ? String(leaderboardResponse._status || "online")
    : (leaderboardResponse?.status || "online");

  if (boardStatusEl) {
    if (remoteAvailable) {
      boardStatusEl.innerText = "Online leaderboard connected.";
    } else if (boardStatus === "offline_config") {
      boardStatusEl.innerText = "Online leaderboard unavailable. Showing local results only.";
    } else {
      boardStatusEl.innerText = "Could not reach online leaderboard. Showing local fallback results.";
    }
  }

  renderDailyRows(leaderboard, currentPlayerId, showScores);
}

async function renderDailyPage() {
  const params = new URLSearchParams(window.location.search);
  const todayKey = getCurrentDailyDateKey();
  const activeDateKey = String(params.get("date") || todayKey).trim() || todayKey;
  const nameInput = document.getElementById("daily-name-input");
  const closeBtn = document.getElementById("daily-close-btn");

  if (nameInput) {
    nameInput.value = loadPreferredPlayerName();
    nameInput.addEventListener("input", () => {
      savePreferredPlayerName(nameInput.value);
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  await refreshDailyPageForDate(activeDateKey);
}

renderDailyPage();
