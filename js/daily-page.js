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
  const cards = Math.max(0, Number(entry?.cardsCleared ?? entry?.score ?? 0));
  const isToday = activeDateKey === todayKey;
  if (isToday) {
    return `I cleared ${cards} cards and scored ${score} in today's 52! Daily Challenge. Can you do better?`;
  }
  return `I cleared ${cards} cards and scored ${score} in the 52! Daily Challenge for ${formatDailyDateLabel(activeDateKey)}. Can you do better?`;
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

function escapeDailyHtml(value) {
  if (typeof escapeHtml === "function") return escapeHtml(value);
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDailyBonus(value) {
  const numeric = Math.max(-999, Math.min(999, Math.floor(Number(value) || 0)));
  return numeric > 0 ? `+${numeric}` : String(numeric);
}

function formatDailyColumnNumber(value, maxValue) {
  return String(Math.max(0, Math.min(maxValue, Math.floor(Number(value) || 0))));
}

function getDailyRankedEntries(entries) {
  const ranked = Array.isArray(entries) ? [...entries] : [];
  ranked.sort(typeof compareDailyEntries === "function"
    ? compareDailyEntries
    : (a, b) => ((b.score || 0) - (a.score || 0)) || String(a.createdAt).localeCompare(String(b.createdAt)));

  let previousScore = null;
  let displayRank = 0;
  ranked.forEach((entry, index) => {
    if (entry.score !== previousScore) {
      displayRank = index + 1;
      previousScore = entry.score;
    }
    entry.dailyDisplayRank = displayRank;
  });
  return ranked;
}

function getDailyPlayerRank(entries, currentPlayerId) {
  if (!currentPlayerId) return null;
  const match = (Array.isArray(entries) ? entries : []).find((entry) => entry.playerId === currentPlayerId);
  return match?.dailyDisplayRank || null;
}

function getDailyDeckClearHtml(entry) {
  if (typeof getCrownBadgesHtml === "function") {
    const badges = getCrownBadgesHtml(entry);
    if (badges) return badges;
  }
  return '<span class="daily-popover-muted">None yet</span>';
}

function hideDailyEntryPopover() {
  const popover = document.getElementById("daily-entry-popover");
  if (!popover) return;
  popover.classList.add("hidden");
  popover.setAttribute("aria-hidden", "true");
  popover.innerHTML = "";
}

function showDailyEntryPopover(entry, anchorEl) {
  const popover = document.getElementById("daily-entry-popover");
  if (!popover || !entry || !anchorEl) return;
  const cardsCleared = formatDailyColumnNumber(entry.cardsCleared ?? entry.score, 52);
  const cardScore = formatDailyColumnNumber(entry.cardScore ?? ((entry.cardsCleared || 0) * 100), 9999);
  const bonusScore = formatDailyBonus(entry.bonusScore);
  const totalScore = formatDailyColumnNumber(entry.score, 9999);
  const remainingCheats = formatDailyColumnNumber(entry.remainingCheats, 999);
  const remainingNudges = formatDailyColumnNumber(entry.remainingNudges, 999);
  const tearCount = formatDailyColumnNumber(entry.tearCount, 999);
  const cheatBonus = formatDailyColumnNumber(entry.cheatBonus, 999);
  const nudgeBonus = formatDailyColumnNumber(entry.nudgeBonus, 999);
  const tearPenalty = formatDailyColumnNumber(entry.tearPenalty, 999);

  popover.innerHTML = `
    <div class="daily-popover-name">${escapeDailyHtml(entry.playerName || "Unknown")}</div>
    <div class="daily-popover-section">
      <div class="daily-popover-title">Daily Score</div>
      <div class="daily-score-breakdown-row"><span>Cards cleared</span><strong>${cardsCleared} = ${cardScore}</strong></div>
      <div class="daily-score-breakdown-row"><span>Cheats left</span><strong>${remainingCheats} = +${cheatBonus}</strong></div>
      <div class="daily-score-breakdown-row"><span>Nudges left</span><strong>${remainingNudges} = +${nudgeBonus}</strong></div>
      <div class="daily-score-breakdown-row"><span>Tears</span><strong>${tearCount} = -${tearPenalty}</strong></div>
      <div class="daily-score-breakdown-row daily-score-breakdown-total"><span>Bonus</span><strong>${bonusScore}</strong></div>
      <div class="daily-score-breakdown-row daily-score-breakdown-total"><span>Total</span><strong>${totalScore}</strong></div>
    </div>
    <div class="daily-popover-section">
      <div class="daily-popover-title">Deck Clears</div>
      <div class="daily-popover-crowns">${getDailyDeckClearHtml(entry)}</div>
    </div>
  `;

  popover.classList.remove("hidden");
  popover.setAttribute("aria-hidden", "false");

  const anchorRect = anchorEl.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const margin = 8;
  const left = Math.max(margin, Math.min(window.innerWidth - popoverRect.width - margin, anchorRect.left));
  const top = Math.max(margin, Math.min(window.innerHeight - popoverRect.height - margin, anchorRect.bottom + margin));
  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
}

function addDailyNameHoldHandlers(button, entry) {
  let holdTimer = null;
  let openedByHold = false;

  const clearHold = () => {
    if (holdTimer) {
      window.clearTimeout(holdTimer);
      holdTimer = null;
    }
  };

  button.addEventListener("pointerdown", () => {
    openedByHold = false;
    clearHold();
    holdTimer = window.setTimeout(() => {
      openedByHold = true;
      showDailyEntryPopover(entry, button);
    }, 420);
  });
  button.addEventListener("pointerup", clearHold);
  button.addEventListener("pointercancel", clearHold);
  button.addEventListener("pointerleave", clearHold);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (openedByHold) return;
    showDailyEntryPopover(entry, button);
  });
}

function renderDailyRows(entries, currentPlayerId, showScores = false) {
  const bodyEl = document.getElementById("daily-table-body");
  const countEl = document.getElementById("daily-board-count");
  const scoreHeading = document.getElementById("daily-score-heading");
  if (!bodyEl || !countEl) return;

  bodyEl.innerHTML = "";
  if (scoreHeading) {
    scoreHeading.innerText = showScores ? "Cards" : "Result";
  }

  if (!entries.length) {
    bodyEl.innerHTML = "<tr><td colspan='3'>No daily scores yet. Set the pace.</td></tr>";
    countEl.innerText = "0 entries";
    return;
  }

  countEl.innerText = entries.length > 99 ? "Top 99" : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  const rows = entries.slice(0, 99);

  rows.forEach((entry) => {
    const tr = document.createElement("tr");
    if (entry.playerId && entry.playerId === currentPlayerId) {
      tr.classList.add("current-player");
    }

    const rankTd = document.createElement("td");
    rankTd.dataset.label = "Rank";
    rankTd.innerText = String(Math.min(99, Number(entry.dailyDisplayRank) || 0));

    const nameTd = document.createElement("td");
    nameTd.dataset.label = "Name";
    const nameButton = document.createElement("button");
    nameButton.className = "daily-name-button";
    nameButton.type = "button";
    nameButton.innerText = entry.playerName || "Unknown";
    nameButton.setAttribute("aria-label", `Show score details for ${entry.playerName || "Unknown"}`);
    addDailyNameHoldHandlers(nameButton, entry);
    nameTd.appendChild(nameButton);

    const cardsTd = document.createElement("td");
    cardsTd.dataset.label = "Cards";
    cardsTd.className = "score score-cards";
    cardsTd.innerText = showScores ? formatDailyColumnNumber(entry.cardsCleared ?? entry.score, 52) : "--";

    tr.appendChild(rankTd);
    tr.appendChild(nameTd);
    tr.appendChild(cardsTd);
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
  const scoreMetaEl = document.getElementById("daily-score-meta");
  const rankEl = document.getElementById("daily-rank-label");
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
      if (scoreEl) scoreEl.innerText = formatDailyColumnNumber(currentAttempt.cardsCleared ?? currentAttempt.score, 52);
      if (scoreMetaEl) {
        scoreMetaEl.innerText = `Bonus ${formatDailyBonus(currentAttempt.bonusScore)} · Total ${formatDailyColumnNumber(currentAttempt.score, 9999)}`;
      }
      if (rankEl) {
        rankEl.hidden = false;
        rankEl.innerText = "Rank pending";
      }
      if (statusEl) {
        statusEl.innerText = activeDateKey === todayKey
          ? "You have already played today's Daily."
          : "You already played this Daily.";
      }
    } else {
      resultPanel?.classList.add("hidden");
      if (rankEl) rankEl.hidden = true;
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
      if (rankEl) rankEl.hidden = true;
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
  const leaderboardResponse = await fetchDailyLeaderboard(activeDateKey, 5000);
  const leaderboard = Array.isArray(leaderboardResponse)
    ? leaderboardResponse
    : (leaderboardResponse?.entries || []);
  const rankedLeaderboard = getDailyRankedEntries(leaderboard);
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

  if (rankEl && hasCompletedAttempt) {
    const playerRank = getDailyPlayerRank(rankedLeaderboard, currentPlayerId);
    rankEl.hidden = false;
    rankEl.innerText = playerRank ? `Rank #${playerRank}` : "Rank pending";
  }

  renderDailyRows(rankedLeaderboard, currentPlayerId, showScores);
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

document.addEventListener("pointerdown", (event) => {
  const popover = document.getElementById("daily-entry-popover");
  if (!popover || popover.classList.contains("hidden")) return;
  if (popover.contains(event.target) || event.target.closest?.(".daily-name-button")) return;
  hideDailyEntryPopover();
});
