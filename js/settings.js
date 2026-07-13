const exportLogBtn = document.getElementById("export-log-btn");
const shareLogBtn = document.getElementById("share-log-btn");
const logExportStatus = document.getElementById("log-export-status");
const replayTutorialBtn = document.getElementById("replay-tutorial-btn");
const tutorialReplayStatus = document.getElementById("tutorial-replay-status");
const unlockDecksToggle = document.getElementById("unlock-decks-toggle");
const unlockDecksStatus = document.getElementById("unlock-decks-status");
const buttonOrderSelect = document.getElementById("button-order-select");
const nudgeOrderSelect = document.getElementById("nudge-order-select");
const closeSettingsBtn = document.getElementById("settings-close-btn");

function getLatestRunLogEntries() {
  const entries = loadRunDebugLog();
  return Array.isArray(entries) ? entries : [];
}

function buildRunLogDownloadPayload() {
  const entries = getLatestRunLogEntries();
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

function buildRunLogFilename(payload) {
  const seedPart = String(payload.seed || "unknown").replace(/[^A-Z0-9_-]+/gi, "-");
  const deckPart = String(payload.deck || "blue");
  const levelPart = `L${Number(payload.level || DEFAULT_LEVEL_NUMBER)}`;
  return `52-run-log-${deckPart}-${levelPart}-${seedPart}.json`;
}

function buildRunLogFile(payload) {
  return new File(
    [JSON.stringify(payload, null, 2)],
    buildRunLogFilename(payload),
    { type: "application/json" }
  );
}

function refreshRunLogExportState() {
  const hasLog = getLatestRunLogEntries().length > 0;
  if (exportLogBtn) {
    exportLogBtn.disabled = !hasLog;
  }
  if (shareLogBtn) {
    shareLogBtn.disabled = !hasLog || typeof navigator.share !== "function";
  }
  if (logExportStatus) {
    logExportStatus.innerText = hasLog
      ? "Share or download the latest run log for support or bug reports."
      : "No run log found yet. Start a run first.";
  }
}

function refreshUnlockDecksState() {
  const enabled = loadUnlockDecks();
  if (unlockDecksToggle) {
    unlockDecksToggle.checked = enabled;
  }
  if (unlockDecksStatus) {
    unlockDecksStatus.innerText = enabled
      ? "Level 1 is unlocked for every deck on this device."
      : "Normal deck progression is active.";
  }
}

function refreshButtonOrderState() {
  if (buttonOrderSelect) {
    buttonOrderSelect.value = loadGuessButtonOrder();
  }
}

function refreshNudgeOrderState() {
  if (nudgeOrderSelect) {
    nudgeOrderSelect.value = loadNudgeButtonOrder();
  }
}

function downloadLatestRunLog() {
  const payload = buildRunLogDownloadPayload();
  if (!payload) {
    if (logExportStatus) {
      logExportStatus.innerText = "No run log found yet. Start a run first.";
    }
    return;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildRunLogFilename(payload);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  if (logExportStatus) {
    logExportStatus.innerText = "Run log downloaded. You can attach it to an email.";
  }
}

async function shareLatestRunLog() {
  const payload = buildRunLogDownloadPayload();
  if (!payload) {
    if (logExportStatus) {
      logExportStatus.innerText = "No run log found yet. Start a run first.";
    }
    return;
  }

  if (typeof navigator.share !== "function") {
    downloadLatestRunLog();
    return;
  }

  const file = buildRunLogFile(payload);
  const shareData = {
    title: "52! Run Log",
    text: `52! run log for ${payload.deck} Level ${payload.level}, seed ${payload.seed || "unknown"}.`,
    files: [file],
  };

  try {
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share(shareData);
      if (logExportStatus) {
        logExportStatus.innerText = "Run log shared.";
      }
      return;
    }

    await navigator.share({
      title: shareData.title,
      text: `${shareData.text} Downloading the log file instead.`,
    });
    downloadLatestRunLog();
  } catch (error) {
    if (error?.name === "AbortError") {
      if (logExportStatus) {
        logExportStatus.innerText = "Share cancelled.";
      }
      return;
    }

    downloadLatestRunLog();
    if (logExportStatus) {
      logExportStatus.innerText = "Share was unavailable, so the run log was downloaded instead.";
    }
  }
}

function closeSettings() {
  const returnUrl = loadSettingsReturnUrl();
  clearSettingsReturnUrl();
  if (returnUrl) {
    window.location.href = returnUrl;
    return;
  }
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.href = "index.html?view=play";
}

function replayTutorialFromSettings() {
  const tutorialForceReplayKey = typeof TUTORIAL_FORCE_REPLAY_KEY === "string"
    ? TUTORIAL_FORCE_REPLAY_KEY
    : "hl_prototype_tutorial_force_replay_v1";
  sessionStorage.setItem(tutorialForceReplayKey, "1");
  if (tutorialReplayStatus) {
    tutorialReplayStatus.innerText = "Tutorial queued. Returning to game...";
  }
  window.setTimeout(() => {
    closeSettings();
  }, 220);
}

exportLogBtn?.addEventListener("click", downloadLatestRunLog);
shareLogBtn?.addEventListener("click", shareLatestRunLog);

closeSettingsBtn?.addEventListener("click", closeSettings);
replayTutorialBtn?.addEventListener("click", replayTutorialFromSettings);

unlockDecksToggle?.addEventListener("change", (event) => {
  saveUnlockDecks(!!event.target.checked);
  refreshUnlockDecksState();
});

buttonOrderSelect?.addEventListener("change", (event) => {
  saveGuessButtonOrder(event.target.value);
});

nudgeOrderSelect?.addEventListener("change", (event) => {
  saveNudgeButtonOrder(event.target.value);
});

refreshRunLogExportState();
refreshUnlockDecksState();
refreshButtonOrderState();
refreshNudgeOrderState();
