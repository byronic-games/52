(function () {
  const ASSET_VERSION = "20260713f";
  const VIEW_TITLES = {
    home: APP_STRINGS.nav.home,
    setup: APP_STRINGS.nav.play,
    play: APP_STRINGS.nav.play,
    daily: APP_STRINGS.nav.daily,
    collection: APP_STRINGS.nav.collection,
    shop: APP_STRINGS.nav.shop,
    profile: APP_STRINGS.nav.profile,
    settings: APP_STRINGS.nav.settings,
    deck: APP_STRINGS.nav.deckState,
    help: APP_STRINGS.nav.help,
  };
  const GAME_SCRIPT_SOURCES = [
    `js/state.js?v=${ASSET_VERSION}`,
    `js/logic.js?v=${ASSET_VERSION}`,
    `js/render.js?v=${ASSET_VERSION}`,
    `js/input.js?v=${ASSET_VERSION}`,
    `js/main.js?v=${ASSET_VERSION}`,
  ];
  const PAGE_SIZE = 10;
  const DAILY_BOARD_PAGE_SIZE = 5;
  const COLLECTION_FALLBACK_PAGE_SIZE = 20;
  const SHELL_POWER_SHIELD_SVG = `
    <svg class="top-power-shield-svg" viewBox="0 0 100 128" aria-hidden="true" focusable="false">
      <path class="top-power-shield-fill" d="M50 121 C24 110 10 82 9 41 L9 18 C31 13 69 13 91 18 L91 41 C90 82 76 110 50 121 Z"></path>
    </svg>
  `;
  const DAILY_WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
  const DAILY_MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const app = {
    view: "home",
    collectionType: "cheat",
    collectionFilter: "all",
    collectionPage: 0,
    selectedCollectionId: "",
    shopIndex: 0,
    profileTab: "stats",
    boardPage: 0,
    scoresTab: "daily",
    scoresPage: 0,
    selectedHeroKey: "",
    dailyDate: "",
    dailyVariant: "normal",
    dailyPage: 0,
    selectedDeck: normalizeDeckKey(loadSelectedDeck()),
    selectedLevel: normalizeLevelNumber(loadSelectedLevel()),
    gameLoaded: false,
    gameLoading: null,
    settingsResetTimer: null,
    settingsResetRaf: 0,
    settingsResetStartedAt: 0,
    settingsResetTriggered: false,
    deckCardResetTimer: null,
    deckCardResetCell: null,
    routeReady: false,
    routeToken: 0,
  };

  const root = document.getElementById("app-root");
  const appViewsEl = document.querySelector(".app-views");
  const homeBtn = document.getElementById("top-home-btn");
  const topCrownsEl = document.getElementById("top-crowns");
  const xpEl = document.getElementById("top-experience-value");
  const menuBtn = document.getElementById("top-menu-btn");
  const shellMenu = document.getElementById("shell-menu");
  const shellMenuBackdrop = document.getElementById("shell-menu-backdrop");
  const modal = document.getElementById("shell-modal");
  const modalTitle = document.getElementById("shell-modal-title");
  const modalBody = document.getElementById("shell-modal-body");
  const views = new Map(Array.from(document.querySelectorAll(".app-view")).map((el) => [el.dataset.view, el]));
  let overlayReturnFocus = null;

  function getTodayKey() {
    return typeof getCurrentDailyDateKey === "function" ? getCurrentDailyDateKey() : new Date().toISOString().slice(0, 10);
  }

  function buildUrl(view, options = {}) {
    const params = new URLSearchParams();
    if (view && view !== "home") params.set("view", view);
    Object.entries(options).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      params.set(key, String(value));
    });
    const query = params.toString();
    return query ? `index.html?${query}` : "index.html";
  }

  function getShellPendingPowerId() {
    try {
      if (app.view !== "play" || typeof state === "undefined") return "";
      const pendingPowerId = state.powerChoiceAnimating?.power?.id || "";
      if (pendingPowerId && typeof getPowerById === "function" && getPowerById(pendingPowerId)) {
        return pendingPowerId;
      }
    } catch {
      return "";
    }
    return "";
  }

  function getShellVisiblePowerIds() {
    try {
      if (app.view !== "play" || typeof state === "undefined") return [];
      const ids = Array.isArray(state.powers) ? state.powers : [];
      const visible = ids.filter((powerId) => (
        powerId &&
        powerId !== "nudge_engine" &&
        typeof getPowerById === "function" &&
        getPowerById(powerId)
      ));
      const pendingPowerId = getShellPendingPowerId();
      if (pendingPowerId && !visible.includes(pendingPowerId)) {
        visible.push(pendingPowerId);
      }
      if (!visible.length && state.selectedStartPowerId && typeof getPowerById === "function" && getPowerById(state.selectedStartPowerId)) {
        visible.push(state.selectedStartPowerId);
      }
      return Array.from(new Set(visible));
    } catch {
      return [];
    }
  }

  function buildShellPowerStackMarkup(powerIds, pendingPowerId = "") {
    const ids = Array.isArray(powerIds) ? powerIds : [];
    const center = (ids.length - 1) / 2;
    const spacing = ids.length <= 3 ? 8 : 6;
    return `
      <span class="top-power-stack" aria-hidden="true">
        ${ids.map((powerId, index) => {
          const power = getPowerById(powerId);
          const offset = Math.round((index - center) * spacing);
          const scale = Math.max(0.84, 1 - Math.max(0, ids.length - 3) * 0.035);
          const pendingClass = pendingPowerId && powerId === pendingPowerId ? " pending-power-target" : "";
          return `
            <span class="top-power-stack-item ${power?.rarity || "common"}${pendingClass}" style="--power-offset: ${offset}px; --power-scale: ${scale}; z-index: ${index + 1};">
              ${SHELL_POWER_SHIELD_SVG}
              <span class="top-power-stack-glyph">${escapeHtml(getPowerIcon(powerId))}</span>
            </span>`;
        }).join("")}
      </span>`;
  }

  function refreshTopBar() {
    if (xpEl && typeof loadExperience === "function") {
      let value = loadExperience();
      try {
        if (
          typeof state !== "undefined" &&
          state?.experienceBanking &&
          Number.isFinite(Number(state.displayExperience))
        ) {
          value = Math.max(0, Math.floor(Number(state.displayExperience)));
        }
      } catch {
        value = loadExperience();
      }
      xpEl.textContent = String(value);
    }
    if (topCrownsEl) {
      const powerIds = getShellVisiblePowerIds();
      if (app.view === "play") {
        const pendingPowerId = getShellPendingPowerId();
        const powers = powerIds.map((powerId) => getPowerById(powerId)?.name).filter(Boolean).join(", ");
        topCrownsEl.classList.add("is-power-stack");
        topCrownsEl.setAttribute("aria-label", powers ? `Active powers: ${powers}` : "No active powers");
        topCrownsEl.innerHTML = powerIds.length ? buildShellPowerStackMarkup(powerIds, pendingPowerId) : "";
        topCrownsEl.hidden = !powerIds.length;
      } else {
        const crowns = typeof getCrownBadgesHtml === "function" && typeof getLocalCrownSnapshot === "function"
          ? getCrownBadgesHtml(getLocalCrownSnapshot())
          : "";
        topCrownsEl.classList.remove("is-power-stack");
        topCrownsEl.setAttribute("aria-label", "Collected crowns");
        topCrownsEl.innerHTML = crowns || "";
        topCrownsEl.hidden = !crowns;
      }
    }
  }

  window.appShellRefreshTopBar = refreshTopBar;

  function updateHomeButton() {
    if (!homeBtn) return;
    const isHome = app.view === "home";
    homeBtn.classList.toggle("is-home-glyph", !isHome);
    homeBtn.setAttribute("aria-label", isHome ? "Home" : "Return home");
    homeBtn.setAttribute("title", isHome ? "52!" : "Home");
    if (isHome) {
      homeBtn.textContent = "52!";
      return;
    }
    homeBtn.innerHTML = `
      <svg class="home-glyph" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
        <path d="M5.7 12.35 12.95 6c.6-.52 1.5-.52 2.1 0l7.25 6.35c.48.42.54 1.15.12 1.64-.42.48-1.15.54-1.64.12l-.58-.51v7.08c0 1.18-.78 1.96-1.96 1.96H16.1v-5.2c0-.54-.36-.9-.9-.9h-2.4c-.54 0-.9.36-.9.9v5.2H9.76c-1.18 0-1.96-.78-1.96-1.96V13.6l-.58.51c-.49.42-1.22.36-1.64-.12-.42-.49-.36-1.22.12-1.64Z" />
      </svg>`;
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function waitForFrame() {
    return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  function activateView(view) {
    views.forEach((el, key) => {
      el.classList.toggle("active", key === view);
      el.setAttribute("aria-hidden", key === view ? "false" : "true");
    });
    document.body.dataset.appView = view;
    app.view = view;
    document.getElementById("menu-exit-btn")?.toggleAttribute("hidden", view !== "play");
    updateHomeButton();
    refreshTopBar();
  }

  function navigate(view, options = {}, { replace = false } = {}) {
    const cleanView = VIEW_TITLES[view] ? view : "home";
    const url = buildUrl(cleanView, options);
    if (replace) {
      history.replaceState({ view: cleanView, options }, "", url);
    } else {
      history.pushState({ view: cleanView, options }, "", url);
    }
    renderRoute(cleanView, options);
  }

  window.appShellNavigate = navigate;

  function routeFromLocation() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view") || (params.has("date") ? "daily" : "home");
    const options = Object.fromEntries(params.entries());
    delete options.view;
    return { view: VIEW_TITLES[view] ? view : "home", options };
  }

  async function renderViewContents(view, options = {}) {
    if (view === "home") renderHome();
    if (view === "setup") renderSetup(options);
    if (view === "play") await renderPlay(options);
    if (view === "daily") renderDaily(options);
    if (view === "collection") renderCollection(options);
  }

  async function renderRoute(view, options = {}) {
    const routeToken = app.routeToken + 1;
    app.routeToken = routeToken;
    const overlayRoutes = new Set(["shop", "profile", "settings", "deck", "help"]);
    const targetView = overlayRoutes.has(view) ? "home" : view;
    const shouldTransition = app.routeReady && app.view !== targetView && !!appViewsEl;
    if (shouldTransition) {
      appViewsEl.classList.add("is-fading-out");
      await wait(70);
      if (routeToken !== app.routeToken) return;
    }

    if (overlayRoutes.has(view)) {
      await renderViewContents("home", options);
      if (routeToken !== app.routeToken) return;
      activateView("home");
      if (view === "deck") openOverlay("profile", { tab: "deck" }, { useHistory: false });
      else openOverlay(view, options, { useHistory: false });
      app.routeReady = true;
      if (shouldTransition) {
        await waitForFrame();
        appViewsEl.classList.remove("is-fading-out");
      }
      return;
    }
    closeOverlay(false, { useHistory: false });
    await renderViewContents(view, options);
    if (routeToken !== app.routeToken) return;
    activateView(view);
    if (view === "collection") renderCollection(options);
    app.routeReady = true;
    if (shouldTransition) {
      await waitForFrame();
      appViewsEl.classList.remove("is-fading-out");
    }
  }

  function isTutorialComplete() {
    return localStorage.getItem(getTutorialCompletedKey()) === "1";
  }

  function renderHome() {
    const dailyBtn = document.getElementById("home-daily-btn");
    const dailyLocked = !isTutorialComplete();
    if (dailyBtn) {
      dailyBtn.disabled = dailyLocked;
      dailyBtn.setAttribute("aria-disabled", dailyLocked ? "true" : "false");
      dailyBtn.querySelector(".tile-title").textContent = APP_STRINGS.home.daily;
    }
  }

  function getSetupDeckMeta(deck) {
    const normalized = normalizeDeckKey(deck);
    const meta = {
      blue: {
        name: "Blue",
        short: "B",
        description: "Classic 52 with nudge rewards.",
      },
      green: {
        name: "Green",
        short: "G",
        description: "Energy run: nudges spend Energy.",
      },
      yellow: {
        name: "Yellow",
        short: "Y",
        description: "Joker run: hazards hide in the deck.",
      },
      orange: {
        name: "Orange",
        short: "O",
        description: "Hybrid run: Energy and Jokers collide.",
      },
      black: {
        name: "Black",
        short: "K",
        description: "Pure score run.",
      },
    };
    return meta[normalized] || meta.blue;
  }

  function getSetupDeckUnlockText(deck) {
    const normalized = normalizeDeckKey(deck);
    if (normalized === "green") return "Unlock: clear Blue 1.";
    if (normalized === "yellow") return "Unlock: clear Green 1.";
    if (normalized === "orange") return "Unlock: clear Yellow 1.";
    if (normalized === "black") return "Unlock: clear every level.";
    return "";
  }

  function getSetupLevelDescription(deck, level) {
    const normalized = normalizeDeckKey(deck);
    const safeLevel = normalizeLevelNumber(level);
    const energy = safeLevel >= 4 ? 5 : safeLevel >= 3 ? 6 : safeLevel === 2 ? 8 : 10;
    const cheatEvery = (normalized === "blue" || normalized === "orange")
      ? safeLevel >= 4 ? 5 : safeLevel >= 2 ? 4 : 3
      : 3;
    const cheatChoices = (normalized === "blue" || normalized === "orange") && safeLevel >= 3 ? 2 : 3;
    if (normalized === "black") return "No Powers, Cheats, Nudges, Energy, or Jokers.";
    if (normalized === "blue") {
      return `Cheat every ${cheatEvery} correct; ${cheatChoices} choices.`;
    }
    if (normalized === "green") {
      return `Start with ${energy} Energy.`;
    }
    if (normalized === "yellow") return `${safeLevel} Joker${safeLevel === 1 ? "" : "s"} after the first four cards.`;
    if (normalized === "orange") return `${energy} Energy; ${safeLevel} Joker${safeLevel === 1 ? "" : "s"}; cheat every ${cheatEvery} correct with ${cheatChoices} choices.`;
    return "";
  }

  function getSetupSelectionTitle(deck, level) {
    const meta = getSetupDeckMeta(deck);
    const safeLevel = normalizeDeckKey(deck) === "black" ? 1 : normalizeLevelNumber(level);
    return `${meta.name} Deck: Level ${safeLevel}`;
  }

  function getSetupSelectionSummary(deck, level) {
    const normalized = normalizeDeckKey(deck);
    const safeLevel = normalized === "black" ? 1 : normalizeLevelNumber(level);
    if (!isDeckUnlocked(normalized)) return getSetupDeckUnlockText(normalized);
    const meta = getSetupDeckMeta(normalized);
    return `${meta.description} Level ${safeLevel}: ${getSetupLevelDescription(normalized, safeLevel)}`;
  }

  function getSetupBestScore(deck, level) {
    if (typeof loadBestScore !== "function") return 0;
    return Math.max(0, Math.min(52, Number(loadBestScore(deck, level)) || 0));
  }

  function unlockSetupForDebug() {
    if (typeof saveUnlockAll === "function") saveUnlockAll(true);
    if (typeof saveUnlockDecks === "function") saveUnlockDecks(true);
    renderHome();
    if (app.view === "setup") renderSetup();
  }

  function resetSetupProgressForDebug() {
    const keys = [
      typeof UNLOCK_ALL_KEY === "string" ? UNLOCK_ALL_KEY : "hl_prototype_unlock_all",
      typeof UNLOCK_DECKS_KEY === "string" ? UNLOCK_DECKS_KEY : "hl_prototype_unlock_decks",
      typeof DECK_LEVEL_CLEARS_KEY === "string" ? DECK_LEVEL_CLEARS_KEY : "hl_prototype_deck_level_clears",
      typeof DECK_WINS_KEY === "string" ? DECK_WINS_KEY : "hl_prototype_deck_wins",
      typeof DAILY_LOCAL_KEY === "string" ? DAILY_LOCAL_KEY : "hl_prototype_daily_attempts_local",
    ];
    keys.forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem(typeof RED_DECK_DEBUG_UNLOCK_KEY === "string" ? RED_DECK_DEBUG_UNLOCK_KEY : "hl_prototype_red_deck_debug_unlock");
    saveSelectedDeck("blue");
    saveSelectedLevel(1);
    app.selectedDeck = "blue";
    app.selectedLevel = 1;
    app.dailyPage = 0;
    renderHome();
    if (app.view === "setup") renderSetup();
    if (app.view === "daily") renderDaily({ date: app.dailyDate || getTodayKey(), variant: app.dailyVariant });
  }

  function renderSetup() {
    const host = document.getElementById("setup-body");
    if (!host) return;
    const topDecks = ["blue", "green", "yellow"];
    const bottomDecks = ["orange", "black"];
    app.selectedDeck = normalizeDeckKey(app.selectedDeck || loadSelectedDeck());
    if (!isDeckUnlocked(app.selectedDeck)) app.selectedDeck = "blue";
    app.selectedLevel = normalizeLevelNumber(app.selectedLevel || loadSelectedLevel());
    if (app.selectedDeck === "black") app.selectedLevel = 1;
    if (!isDeckLevelUnlocked(app.selectedDeck, app.selectedLevel)) app.selectedLevel = 1;
    const selectedDeckUnlocked = isDeckUnlocked(app.selectedDeck);
    const maxLevel = app.selectedDeck === "black" ? 1 : 4;
    const selectedLevel = app.selectedDeck === "black" ? 1 : app.selectedLevel;
    const selectedTitle = getSetupSelectionTitle(app.selectedDeck, selectedLevel);
    const selectedSummary = getSetupSelectionSummary(app.selectedDeck, selectedLevel);
    const selectedBest = getSetupBestScore(app.selectedDeck, selectedLevel);

    host.innerHTML = `
      <div class="setup-layout">
        <div class="setup-deck-picker" aria-label="Choose deck">
          <div class="setup-deck-row setup-deck-row-top" id="setup-deck-row-top"></div>
          <div class="setup-deck-row setup-deck-row-bottom" id="setup-deck-row-bottom"></div>
        </div>
        <div class="fixed-card setup-info">
          <div class="setup-info-copy">
            <p class="info-title">${selectedTitle}</p>
            <p class="info-desc setup-selection-summary">${selectedSummary}</p>
            <p class="setup-best-row"><span>Best</span><strong>${selectedBest}/52</strong></p>
          </div>
          <div class="setup-level-cards" id="setup-level-grid" aria-label="Choose level"></div>
        </div>
        <button class="primary-btn setup-play-btn" id="setup-start-btn" type="button" ${selectedDeckUnlocked ? "" : "disabled"}>${APP_STRINGS.home.play}</button>
      </div>
    `;

    function renderDeckCard(deck, hostEl) {
      const meta = getSetupDeckMeta(deck);
      const unlocked = isDeckUnlocked(deck);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "setup-card setup-deck-card";
      button.dataset.deck = deck;
      button.dataset.deckColor = deck;
      button.innerHTML = `<span class="setup-card-mark">${unlocked ? meta.short : "?"}</span>`;
      button.disabled = !unlocked;
      button.setAttribute("aria-label", `${meta.name} deck${unlocked ? "" : ` locked. ${getSetupDeckUnlockText(deck)}`}`);
      button.classList.toggle("active", app.selectedDeck === deck);
      button.classList.toggle("locked", !unlocked);
      button.addEventListener("click", () => {
        if (!unlocked) return;
        app.selectedDeck = deck;
        app.selectedLevel = deck === "black" ? 1 : Math.min(app.selectedLevel || 1, 4);
        if (!isDeckLevelUnlocked(app.selectedDeck, app.selectedLevel)) app.selectedLevel = 1;
        renderSetup();
      });
      hostEl.appendChild(button);
    }

    const topRow = document.getElementById("setup-deck-row-top");
    const bottomRow = document.getElementById("setup-deck-row-bottom");
    topDecks.forEach((deck) => renderDeckCard(deck, topRow));
    if (bottomRow) {
      bottomDecks.forEach((deck) => renderDeckCard(deck, bottomRow));
    }

    const levelGrid = document.getElementById("setup-level-grid");
    for (let level = 1; level <= 4; level += 1) {
      const unlocked = level <= maxLevel && isDeckLevelUnlocked(app.selectedDeck, level);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "setup-card setup-level-card";
      button.dataset.level = String(level);
      button.innerHTML = `<span class="setup-card-mark">${unlocked ? level : "?"}</span>`;
      button.disabled = !unlocked;
      button.classList.toggle("active", app.selectedLevel === level);
      button.classList.toggle("locked", !unlocked);
      button.setAttribute("aria-label", unlocked
        ? `Level ${level}. ${getSetupLevelDescription(app.selectedDeck, level)}`
        : `Level ${level} locked`);
      button.addEventListener("click", () => {
        if (!unlocked) return;
        app.selectedLevel = level;
        renderSetup();
      });
      levelGrid.appendChild(button);
    }

    document.getElementById("setup-start-btn")?.addEventListener("click", () => {
      saveSelectedDeck(app.selectedDeck);
      saveSelectedLevel(app.selectedDeck === "black" ? 1 : app.selectedLevel);
      navigate("play", { deck: app.selectedDeck, level: app.selectedDeck === "black" ? 1 : app.selectedLevel });
    });
  }

  function ensureStylesheet(id, href) {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === "true") resolve();
        else existing.addEventListener("load", resolve, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.dataset.dynamicSrc = src;
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  async function loadGame() {
    if (app.gameLoaded) return;
    if (app.gameLoading) return app.gameLoading;
    app.gameLoading = (async () => {
      ensureStylesheet("game-stylesheet", `styles.css?v=${ASSET_VERSION}`);
      const host = document.getElementById("app-play-host");
      if (!host) return;
      host.innerHTML = '<div class="app-loading">Loading...</div>';
      const response = await fetch(`game.html?v=${ASSET_VERSION}`, { cache: "no-store" });
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const orientation = doc.getElementById("orientation-overlay");
      const shell = doc.getElementById("game-shell");
      host.innerHTML = `${orientation ? orientation.outerHTML : ""}${shell ? shell.outerHTML : ""}`;
      for (const src of GAME_SCRIPT_SOURCES) {
        await loadScriptOnce(src);
      }
      app.gameLoaded = true;
    })();
    return app.gameLoading;
  }

  async function renderPlay(options = {}) {
    await loadGame();
    const deck = normalizeDeckKey(options.deck || loadSelectedDeck());
    const level = normalizeLevelNumber(options.level || loadSelectedLevel());
    const date = String(options.date || "").trim();
    const variant = typeof normalizeDailyVariant === "function" ? normalizeDailyVariant(options.variant) : "normal";

    if (date && typeof window.appStartDailyRun === "function") {
      window.appStartDailyRun(date, variant);
      return;
    }

    if (options.deck && typeof window.appPrepareStandardRun === "function") {
      window.appPrepareStandardRun(deck, level);
    }
  }

  function formatDateLabel(dateKey) {
    if (typeof formatDailyDateLabel === "function") return formatDailyDateLabel(dateKey);
    return dateKey;
  }

  function rankEntries(entries) {
    const ranked = Array.isArray(entries) ? [...entries] : [];
    ranked.sort(typeof compareDailyEntries === "function" ? compareDailyEntries : (a, b) => (b.score || 0) - (a.score || 0));
    let previousScore = null;
    let rank = 0;
    ranked.forEach((entry, index) => {
      if (entry.score !== previousScore) {
        rank = index + 1;
        previousScore = entry.score;
      }
      entry.dailyDisplayRank = rank;
    });
    return ranked;
  }

  function parseDailyDateKey(dateKey) {
    const parsed = new Date(`${String(dateKey || getTodayKey()).trim()}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return new Date(`${getTodayKey()}T00:00:00Z`);
  }

  function dateToDailyKey(date) {
    return typeof getCurrentDailyDateKey === "function"
      ? getCurrentDailyDateKey(date)
      : date.toISOString().slice(0, 10);
  }

  function getDailyMonthLabel(dateKey) {
    const date = parseDailyDateKey(dateKey);
    return `${DAILY_MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  function shiftDailyMonth(dateKey, delta) {
    const source = parseDailyDateKey(dateKey);
    const target = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + delta, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(source.getUTCDate(), lastDay));
    return dateToDailyKey(target);
  }

  function isNavigableDailyDate(dateKey) {
    return typeof canNavigateToDate === "function" ? canNavigateToDate(dateKey) : dateKey <= getTodayKey();
  }

  function getCompletedDailyAttempt(dateKey, variant) {
    if (typeof getLocalDailyAttempt !== "function") return null;
    const attempt = getLocalDailyAttempt(dateKey, variant);
    return attempt?.completed ? attempt : null;
  }

  function getDailyCardsCleared(attempt) {
    return Math.max(0, Math.min(52, Math.floor(Number(attempt?.cardsCleared ?? attempt?.score) || 0)));
  }

  function getDailyGradeClass(attempt) {
    const cards = getDailyCardsCleared(attempt);
    if (cards >= 52) return "grade-gold";
    if (cards >= 39) return "grade-silver";
    if (cards >= 27) return "grade-bronze";
    return "grade-white";
  }

  function countDailyStreak(variant, anchorDateKey) {
    let cursor = anchorDateKey;
    if (!getCompletedDailyAttempt(cursor, variant) && typeof decrementDateKey === "function") {
      cursor = decrementDateKey(cursor);
    }
    let count = 0;
    while (count < 730 && isNavigableDailyDate(cursor) && getCompletedDailyAttempt(cursor, variant)) {
      count += 1;
      if (typeof decrementDateKey !== "function") break;
      cursor = decrementDateKey(cursor);
    }
    return count;
  }

  function getDailyCalendarDateKeys(dateKey) {
    const activeDate = parseDailyDateKey(dateKey);
    const monthStart = new Date(Date.UTC(activeDate.getUTCFullYear(), activeDate.getUTCMonth(), 1));
    const startOffset = (monthStart.getUTCDay() + 6) % 7;
    const gridStart = new Date(monthStart);
    gridStart.setUTCDate(monthStart.getUTCDate() - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const cellDate = new Date(gridStart);
      cellDate.setUTCDate(gridStart.getUTCDate() + index);
      return dateToDailyKey(cellDate);
    });
  }

  function buildDebugDailyAttempt(dateKey, cardsCleared, variant) {
    const normalizedCards = Math.max(1, Math.min(52, Math.floor(Number(cardsCleared) || 1)));
    const scoreBreakdown = typeof buildDailyScoreBreakdown === "function"
      ? buildDailyScoreBreakdown({ cardsCleared: normalizedCards })
      : { cardScore: normalizedCards * 100, totalScore: normalizedCards * 100 };
    return {
      dateKey,
      variant,
      seed: `DEV|CALENDAR|${variant}|${dateKey}`,
      playerName: "Calendar Test",
      playerId: typeof getOrCreateDailyPlayerId === "function" ? getOrCreateDailyPlayerId() : "calendar-test",
      score: scoreBreakdown.totalScore || scoreBreakdown.cardScore || normalizedCards * 100,
      cardsCleared: normalizedCards,
      cardScore: scoreBreakdown.cardScore || normalizedCards * 100,
      bonusScore: scoreBreakdown.bonusScore || 0,
      completed: true,
      createdAt: `${dateKey}T12:00:00.000Z`,
      source: "local",
    };
  }

  function seedDailyCalendarDebugData() {
    if (app.view !== "daily" || typeof saveLocalDailyAttempt !== "function") return false;
    if (typeof saveProfileStats === "function" && typeof loadProfileStats === "function") {
      const stats = loadProfileStats();
      saveProfileStats({ ...stats, runsStarted: Math.max(1, Number(stats.runsStarted || 0)) });
    }

    let targetDate = app.dailyDate;
    let visibleKeys = getDailyCalendarDateKeys(targetDate).filter(isNavigableDailyDate);
    const previousMonth = shiftDailyMonth(targetDate, -1);
    if (visibleKeys.length < 28 && isNavigableDailyDate(previousMonth)) {
      targetDate = previousMonth;
      app.dailyDate = targetDate;
      visibleKeys = getDailyCalendarDateKeys(targetDate).filter(isNavigableDailyDate);
    }
    const gradePattern = [12, 30, 43, 52, 25, 38, 51, 52];
    visibleKeys.forEach((dateKey, index) => {
      saveLocalDailyAttempt(buildDebugDailyAttempt(dateKey, gradePattern[index % gradePattern.length], "normal"));
      saveLocalDailyAttempt(buildDebugDailyAttempt(dateKey, gradePattern[(index + 2) % gradePattern.length], "hard"));
    });

    renderDaily({ date: targetDate, variant: app.dailyVariant });
    return true;
  }

  function buildDailyCalendar(dateKey, variant) {
    const activeDate = parseDailyDateKey(dateKey);
    const today = getTodayKey();

    return getDailyCalendarDateKeys(dateKey).map((cellKey) => {
      const cellDate = parseDailyDateKey(cellKey);
      const inMonth = cellDate.getUTCMonth() === activeDate.getUTCMonth();
      const canSelect = isNavigableDailyDate(cellKey);
      const attempt = getCompletedDailyAttempt(cellKey, variant);
      const complete = !!attempt;
      const prevComplete = complete && typeof decrementDateKey === "function" && !!getCompletedDailyAttempt(decrementDateKey(cellKey), variant);
      const nextComplete = complete && typeof incrementDateKey === "function" && !!getCompletedDailyAttempt(incrementDateKey(cellKey), variant);
      const classes = [
        "daily-day",
        inMonth ? "" : "outside-month",
        cellKey === dateKey ? "selected" : "",
        complete ? "complete" : "",
        complete ? getDailyGradeClass(attempt) : "",
        prevComplete ? "linked-prev" : "",
        nextComplete ? "linked-next" : "",
      ].filter(Boolean).join(" ");
      return `
        <button
          class="${classes}"
          type="button"
          data-date="${cellKey}"
          ${canSelect ? "" : "disabled"}
          aria-label="${formatDateLabel(cellKey)}${complete ? `, ${getDailyCardsCleared(attempt)} cards` : ""}"
          ${cellKey > today ? "aria-disabled=\"true\"" : ""}
        >
          <span class="daily-day-number">${cellDate.getUTCDate()}</span>
          ${complete ? '<span class="daily-day-dot" aria-hidden="true"></span>' : ""}
        </button>
      `;
    }).join("");
  }

  function isDailyHardUnlocked(dateKey, playerId) {
    const normalAttempt = getCompletedDailyAttempt(dateKey, "normal");
    return !!normalAttempt && (!normalAttempt.playerId || normalAttempt.playerId === playerId);
  }

  function renderDailyVariantTabs(hardUnlocked) {
    const host = document.getElementById("daily-variant-tabs");
    if (!host) return;
    host.innerHTML = `
      <button class="segment-btn ${app.dailyVariant === "normal" ? "active" : ""}" data-daily-variant="normal" type="button">Normal</button>
      <button class="segment-btn ${app.dailyVariant === "hard" ? "active" : ""}" data-daily-variant="hard" type="button" ${hardUnlocked ? "" : "disabled"}>Hard</button>
    `;
    host.querySelectorAll("[data-daily-variant]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.disabled) return;
        app.dailyVariant = button.dataset.dailyVariant;
        app.dailyPage = 0;
        navigate("daily", { date: app.dailyDate, variant: app.dailyVariant }, { replace: true });
      });
    });
  }

  function getDailyBoardPageSize() {
    const card = document.querySelector(".daily-board-card");
    const height = card?.getBoundingClientRect().height || 0;
    if (height < 180) return 3;
    if (height < 212) return 4;
    return DAILY_BOARD_PAGE_SIZE;
  }

  async function renderDaily(options = {}) {
    app.dailyDate = String(options.date || app.dailyDate || getTodayKey()).trim();
    app.dailyVariant = typeof normalizeDailyVariant === "function" ? normalizeDailyVariant(options.variant || app.dailyVariant) : "normal";
    const host = document.getElementById("daily-body");
    if (!host) return;
    const today = getTodayKey();
    if (!isNavigableDailyDate(app.dailyDate)) app.dailyDate = today;
    const currentPlayerId = getOrCreateDailyPlayerId();
    const hardUnlocked = isDailyHardUnlocked(app.dailyDate, currentPlayerId);
    if (app.dailyVariant === "hard" && !hardUnlocked) app.dailyVariant = "normal";
    const attempt = getCompletedDailyAttempt(app.dailyDate, app.dailyVariant);
    const complete = !!attempt;
    const unlocked = isTutorialComplete();
    const canPlay = unlocked && !complete && app.dailyDate === today && (app.dailyVariant === "normal" || hardUnlocked);
    const streak = countDailyStreak(app.dailyVariant, app.dailyDate);
    const previousMonth = shiftDailyMonth(app.dailyDate, -1);
    const nextMonth = shiftDailyMonth(app.dailyDate, 1);
    host.classList.add("daily-layout");
    renderDailyVariantTabs(hardUnlocked);

    host.innerHTML = `
      <div class="fixed-card daily-calendar-card">
        <div class="daily-calendar-top">
          <button class="pager-btn daily-month-btn" id="daily-month-prev" type="button" aria-label="Previous month" ${isNavigableDailyDate(previousMonth) ? "" : "disabled"}>‹</button>
          <div class="daily-month-copy">
            <strong>${getDailyMonthLabel(app.dailyDate)}</strong>
            <span><b>${streak}</b> streak</span>
          </div>
          <button class="pager-btn daily-month-btn" id="daily-month-next" type="button" aria-label="Next month" ${isNavigableDailyDate(nextMonth) ? "" : "disabled"}>›</button>
        </div>
        <div class="daily-calendar-board">
          <div class="daily-weekdays" aria-hidden="true">${DAILY_WEEKDAY_LABELS.map((day) => `<span>${day}</span>`).join("")}</div>
          <div class="daily-calendar-grid">${buildDailyCalendar(app.dailyDate, app.dailyVariant)}</div>
        </div>
      </div>
      <button class="primary-btn daily-play-btn" id="daily-play-btn" type="button" ${canPlay ? "" : "disabled"}>PLAY</button>
      <div class="fixed-card daily-board-card">
        <div class="board-list" id="daily-board-list"><div class="app-loading">Loading...</div></div>
        <div class="pager-row"><button class="pager-btn" id="daily-page-prev" type="button">‹</button><span id="daily-page-label"></span><button class="pager-btn" id="daily-page-next" type="button">›</button></div>
      </div>
    `;

    host.querySelectorAll("[data-date]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.disabled) return;
        app.dailyDate = button.dataset.date;
        app.dailyPage = 0;
        navigate("daily", { date: app.dailyDate, variant: app.dailyVariant }, { replace: true });
      });
    });
    document.getElementById("daily-month-prev")?.addEventListener("click", () => {
      const previous = shiftDailyMonth(app.dailyDate, -1);
      if (!isNavigableDailyDate(previous)) return;
      app.dailyDate = previous;
      app.dailyPage = 0;
      navigate("daily", { date: app.dailyDate, variant: app.dailyVariant }, { replace: true });
    });
    document.getElementById("daily-month-next")?.addEventListener("click", () => {
      const next = shiftDailyMonth(app.dailyDate, 1);
      if (!isNavigableDailyDate(next)) return;
      app.dailyDate = next;
      app.dailyPage = 0;
      navigate("daily", { date: app.dailyDate, variant: app.dailyVariant }, { replace: true });
    });
    document.getElementById("daily-play-btn")?.addEventListener("click", () => {
      if (!loadPreferredPlayerName()) savePreferredPlayerName("Player");
      navigate("play", { date: app.dailyDate, variant: app.dailyVariant });
    });

    const requestedDate = app.dailyDate;
    const requestedVariant = app.dailyVariant;
    const response = await fetchDailyLeaderboard(app.dailyDate, 5000, app.dailyVariant);
    if (app.dailyDate !== requestedDate || app.dailyVariant !== requestedVariant) return;
    const entries = rankEntries(Array.isArray(response) ? response : response?.entries || []);
    renderBoardPage(entries, "daily-board-list", "daily-page-label", "daily-page-prev", "daily-page-next", app.dailyPage, (nextPage) => {
      app.dailyPage = nextPage;
      renderDaily({ date: app.dailyDate, variant: app.dailyVariant });
    }, (entry) => [
      entry.dailyDisplayRank || "-",
      entry.playerName || "Unknown",
      complete ? String(Math.max(0, Number(entry.cardsCleared ?? entry.score) || 0)) : "??",
    ], getDailyBoardPageSize());
  }

  function getEntryDescription(entry, type) {
    if (!entry) return "";
    if (entry.description) return entry.description;
    if (type === "cheat" && typeof CHEAT_DESCRIPTIONS !== "undefined") return CHEAT_DESCRIPTIONS?.[entry.name] || "";
    return "";
  }

  function getCollectionEntries(type) {
    if (type === "power") return Array.isArray(POWERS) ? POWERS.filter((entry) => entry?.id) : [];
    if (type === "joker") return Array.isArray(YELLOW_JOKERS) ? YELLOW_JOKERS.filter((entry) => entry?.id) : [];
    return Array.isArray(CHEATS) ? CHEATS.filter((entry) => entry?.id && entry.included !== false) : [];
  }

  function getCollectionTypeLabel(type) {
    if (type === "power") return "Power";
    if (type === "joker") return "Joker";
    return "Cheat";
  }

  function getCollectionItemState(type, entry) {
    if (!entry) return "locked";
    const stat = getItemUsageStat(type, entry.id);
    const used = type === "power"
      ? (stat.picked || 0) + (stat.used || 0) + (stat.success || 0)
      : (stat.used || 0) + (stat.success || 0);
    return used > 0 ? "unlocked" : "locked";
  }

  function getCollectionTileLabel(entry, state) {
    if (!entry || state === "locked") return "?";
    return entry.icon || entry.name?.slice(0, 2) || "?";
  }

  function getCollectionRarityKey(entry) {
    const rarity = String(entry?.rarity || "common").trim().toLowerCase();
    if (rarity === "normal" || rarity === "standard") return "common";
    if (["common", "uncommon", "rare", "legendary"].includes(rarity)) return rarity;
    return "common";
  }

  function getCollectionRarityLabel(entry) {
    const rarity = getCollectionRarityKey(entry);
    return rarity.replace(/^\w/, (letter) => letter.toUpperCase());
  }

  function getCollectionProgress(type) {
    const entries = getCollectionEntries(type);
    const unlocked = entries.reduce((count, entry) => count + (getCollectionItemState(type, entry) === "unlocked" ? 1 : 0), 0);
    return { unlocked, total: entries.length };
  }

  function getCollectionTabLabel(type) {
    const key = type === "cheat" ? "cheats" : type === "power" ? "powers" : "jokers";
    const progress = getCollectionProgress(type);
    return `${APP_STRINGS.collection[key].toUpperCase()} (${progress.unlocked} / ${progress.total})`;
  }

  function getCollectionColumnCount(host) {
    const width = Math.max(0, host?.clientWidth || window.innerWidth || 0);
    if (width <= 390) return 4;
    if (width <= 700) return 5;
    return 10;
  }

  function getCollectionPageSize(host) {
    const columns = getCollectionColumnCount(host);
    const width = Math.max(0, host?.clientWidth || window.innerWidth || 0);
    const height = Math.max(0, host?.clientHeight || 0);
    if (!width || !height) return COLLECTION_FALLBACK_PAGE_SIZE;
    const gap = 6;
    const rowGap = 10;
    const bottomInset = Math.max(0, Number.parseFloat(getComputedStyle(host).paddingBottom) || 0);
    const fixedRows = 42 + 108 + 36 + rowGap * 3 + bottomInset;
    const gridHeight = Math.max(0, height - fixedRows);
    const tileSize = Math.max(1, (width - gap * (columns - 1)) / columns);
    const rows = Math.max(1, Math.floor((gridHeight + gap) / (tileSize + gap)));
    return Math.max(columns, columns * rows);
  }

  function renderCollection(options = {}) {
    app.collectionType = ["cheat", "power", "joker"].includes(options.type) ? options.type : app.collectionType;
    const host = document.getElementById("collection-body");
    if (!host) return;
    const entries = getCollectionEntries(app.collectionType);
    const selected = entries.find((entry) => entry.id === app.selectedCollectionId) || entries[0];
    app.selectedCollectionId = selected?.id || "";
    const stat = selected ? getItemUsageStat(app.collectionType, selected.id) : {};
    const selectedState = getCollectionItemState(app.collectionType, selected);
    const selectedKnown = selectedState === "unlocked";
    const pageSize = getCollectionPageSize(host);
    const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
    app.collectionPage = Math.max(0, Math.min(app.collectionPage, pageCount - 1));
    const pageItems = entries.slice(app.collectionPage * pageSize, app.collectionPage * pageSize + pageSize);
    const typeLabel = getCollectionTypeLabel(app.collectionType);
    const selectedRarityKey = getCollectionRarityKey(selected);
    const selectedTitle = selectedKnown ? selected.name : `Unknown ${typeLabel}`;
    const selectedMeta = selectedState === "unlocked"
      ? getCollectionRarityLabel(selected)
      : `${typeLabel} · locked`;
    const selectedDesc = selectedState === "unlocked"
      ? getEntryDescription(selected, app.collectionType)
      : "Use this during play to reveal it.";

    host.innerHTML = `
      <div class="segment-row collection-tabs">
        ${["cheat", "power", "joker"].map((type) => `<button class="segment-btn ${app.collectionType === type ? "active" : ""}" data-type="${type}" type="button">${escapeHtml(getCollectionTabLabel(type))}</button>`).join("")}
      </div>
      <div class="fixed-card info-box collection-info">
        <div class="info-symbol">${escapeHtml(getCollectionTileLabel(selected, selectedState))}</div>
        <div class="info-copy">
          <p class="info-title">${escapeHtml(selectedTitle)}</p>
          <p class="info-meta ${selectedState === "unlocked" ? `rarity-${selectedRarityKey}` : ""}">${escapeHtml(selectedMeta)}</p>
          <p class="info-desc">${escapeHtml(selectedDesc)}</p>
          <p class="info-stats">Offered ${stat.offered || 0} · Picked ${stat.picked || 0} · Used ${stat.used || 0}</p>
        </div>
      </div>
      <div class="item-grid">${pageItems.map((entry) => {
        const state = getCollectionItemState(app.collectionType, entry);
        const label = getCollectionTileLabel(entry, state);
        const rarityClass = state === "unlocked" ? `rarity-${getCollectionRarityKey(entry)}` : "";
        const ariaLabel = state === "locked" ? `Unknown ${typeLabel}` : `${entry.name} ${state}`;
        return `<button class="item-tile item-state-${state} ${rarityClass} ${entry.id === app.selectedCollectionId ? "active" : ""}" data-id="${escapeHtml(entry.id)}" type="button" aria-label="${escapeHtml(ariaLabel)}">${escapeHtml(label)}</button>`;
      }).join("")}</div>
      <div class="pager-row"><button class="pager-btn" id="collection-prev-page" type="button" ${app.collectionPage <= 0 ? "disabled" : ""}>‹</button><span>${app.collectionPage + 1}/${pageCount}</span><button class="pager-btn" id="collection-next-page" type="button" ${app.collectionPage >= pageCount - 1 ? "disabled" : ""}>›</button></div>
    `;

    host.querySelectorAll("[data-type]").forEach((button) => button.addEventListener("click", () => {
      app.collectionType = button.dataset.type;
      app.collectionPage = 0;
      app.selectedCollectionId = "";
      navigate("collection", { type: app.collectionType }, { replace: true });
    }));
    host.querySelectorAll("[data-id]").forEach((button) => button.addEventListener("click", () => {
      app.selectedCollectionId = button.dataset.id;
      renderCollection({ type: app.collectionType });
    }));
    document.getElementById("collection-prev-page")?.addEventListener("click", () => {
      app.collectionPage = Math.max(0, app.collectionPage - 1);
      renderCollection({ type: app.collectionType });
    });
    document.getElementById("collection-next-page")?.addEventListener("click", () => {
      app.collectionPage = Math.min(pageCount - 1, app.collectionPage + 1);
      renderCollection({ type: app.collectionType });
    });
  }

  function getRenderHost(id) {
    return modal?.dataset.overlay ? modal.querySelector(`#${id}`) || document.getElementById(id) : document.getElementById(id);
  }

  function openShellMenu() {
    if (!shellMenu) return;
    shellMenu.classList.remove("hidden");
    shellMenu.setAttribute("aria-hidden", "false");
    shellMenuBackdrop?.classList.add("is-visible");
    shellMenuBackdrop?.setAttribute("aria-hidden", "false");
    menuBtn?.setAttribute("aria-expanded", "true");
  }

  function closeShellMenu() {
    if (!shellMenu) return;
    shellMenu.classList.add("hidden");
    shellMenu.setAttribute("aria-hidden", "true");
    shellMenuBackdrop?.classList.remove("is-visible");
    shellMenuBackdrop?.setAttribute("aria-hidden", "true");
    menuBtn?.setAttribute("aria-expanded", "false");
  }

  function toggleShellMenu() {
    if (shellMenu?.classList.contains("hidden")) openShellMenu();
    else closeShellMenu();
  }

  function overlayTitle(type) {
    if (type === "scores") return "High Scores";
    if (type === "help") return "How To Play";
    if (type === "confirm-exit") return "End Run?";
    return VIEW_TITLES[type] || APP_STRINGS.appTitle;
  }

  function hasOverlayHistoryEntry() {
    return !!history.state?.overlay;
  }

  function pushOverlayHistory(type) {
    if (hasOverlayHistoryEntry()) return;
    const route = routeFromLocation();
    history.pushState({ view: route.view, options: route.options, overlay: type }, "", window.location.href);
  }

  function discardOverlayHistoryEntry() {
    if (!hasOverlayHistoryEntry()) return;
    const route = routeFromLocation();
    history.replaceState({ view: route.view, options: route.options }, "", window.location.href);
  }

  function focusOverlay() {
    const preferredTarget = modal?.querySelector("#confirm-exit-cancel") || document.getElementById("shell-modal-close");
    preferredTarget?.focus?.({ preventScroll: true });
  }

  function openOverlay(type, options = {}, { useHistory = true } = {}) {
    if (!modal || !modalBody) return;
    const activeElement = document.activeElement;
    overlayReturnFocus = shellMenu?.contains(activeElement) ? menuBtn : activeElement;
    closeShellMenu();
    if (useHistory) pushOverlayHistory(type);
    modal.dataset.overlay = type;
    if (modalTitle) modalTitle.textContent = overlayTitle(type);
    renderOverlay(type, options);
    modal.classList.remove("hidden", "is-closing");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("shell-modal-open");
    window.requestAnimationFrame(focusOverlay);
  }

  function closeOverlay(animated = true, { useHistory = true } = {}) {
    if (!modal || modal.classList.contains("hidden")) return;
    if (useHistory && hasOverlayHistoryEntry()) {
      history.back();
      return;
    }
    stopSettingsResetHold();
    stopDeckCardResetHold();
    resetSettingsResetHoldVisuals();
    const finish = () => {
      modal.classList.add("hidden");
      modal.classList.remove("is-closing");
      delete modal.dataset.overlay;
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("shell-modal-open");
      if (modalBody) modalBody.innerHTML = "";
      const returnTarget = overlayReturnFocus;
      overlayReturnFocus = null;
      if (returnTarget?.isConnected) returnTarget.focus?.({ preventScroll: true });
    };
    if (!animated) {
      finish();
      return;
    }
    modal.classList.add("is-closing");
    window.setTimeout(finish, 210);
  }

  function renderOverlay(type, options = {}) {
    if (!modalBody) return;
    if (type === "confirm-exit") {
      modalBody.innerHTML = `
        <div class="confirm-exit-panel">
          <p class="confirm-exit-copy">Leave this run and return home?</p>
          <div class="confirm-exit-actions">
            <button class="secondary-btn" id="confirm-exit-cancel" type="button">Stay</button>
            <button class="primary-btn" id="confirm-exit-confirm" type="button">End Run</button>
          </div>
        </div>`;
      document.getElementById("confirm-exit-cancel")?.addEventListener("click", () => closeOverlay());
      document.getElementById("confirm-exit-confirm")?.addEventListener("click", exitRunToHome);
      return;
    }
    if (type === "shop") {
      modalBody.innerHTML = '<div id="shop-body" class="panel-body shop-layout modal-panel-body"></div>';
      renderShop();
      return;
    }
    if (type === "profile") {
      app.profileTab = options.tab === "deck" ? "deck" : "stats";
      modalBody.innerHTML = '<div id="profile-body" class="panel-body modal-panel-body"></div>';
      renderProfile({ tab: app.profileTab });
      return;
    }
    if (type === "settings") {
      modalBody.innerHTML = '<div id="settings-body" class="panel-body modal-panel-body"></div>';
      renderSettings();
      return;
    }
    if (type === "scores") {
      app.scoresTab = ["daily", "heroes"].includes(options.tab) ? options.tab : app.scoresTab;
      modalBody.innerHTML = '<div id="scores-body" class="panel-body modal-panel-body"></div>';
      renderScoresOverlay();
      return;
    }
    modalBody.innerHTML = '<div id="help-body" class="panel-body modal-panel-body"></div>';
    renderHelp();
  }

  function renderShop() {
    const host = getRenderHost("shop-body");
    if (!host) return;
    const cosmetics = getIncludedCardBackCosmetics();
    app.shopIndex = Math.max(0, Math.min(app.shopIndex, cosmetics.length - 1));
    const cosmetic = cosmetics[app.shopIndex] || cosmetics[0];
    const balance = loadExperience();
    const owned = isCardBackCosmeticOwned(cosmetic.id);
    const selected = loadSelectedCardBackCosmetic() === cosmetic.id;
    const affordable = owned || balance >= cosmetic.cost;
    const previewClasses = [
      "shop-card-art",
      cosmetic.previewClass || "",
      cosmetic.image ? "has-image" : "",
      owned ? "owned" : "locked",
      selected ? "selected" : "",
      affordable ? "" : "unaffordable",
    ].filter(Boolean).join(" ");
    host.innerHTML = `
      <div class="fixed-card info-box">
        <div class="info-symbol">XP</div>
        <div class="info-copy">
          <p class="info-title">${balance}</p>
          <p class="info-desc">${cosmetic.name}</p>
          <p class="info-stats">${owned ? selected ? "Selected" : "Owned" : `${cosmetic.cost} XP`}</p>
        </div>
      </div>
      <div class="fixed-card shop-preview">
        <button class="pager-btn" id="shop-prev" type="button">‹</button>
        <div class="${previewClasses}" id="shop-card-art" aria-label="${escapeHtml(cosmetic.name)} preview"></div>
        <button class="pager-btn" id="shop-next" type="button">›</button>
      </div>
      <button class="primary-btn" id="shop-buy-btn" type="button" ${selected || !affordable ? "disabled" : ""}>${selected ? "Selected" : owned ? "Select" : "Buy"}</button>
    `;
    const art = document.getElementById("shop-card-art");
    if (art && cosmetic.image) {
      art.style.setProperty("--card-back-cosmetic-image", `url("${cosmetic.image}")`);
    } else if (art) {
      art.style.removeProperty("--card-back-cosmetic-image");
    }
    document.getElementById("shop-prev")?.addEventListener("click", () => {
      app.shopIndex = (app.shopIndex - 1 + cosmetics.length) % cosmetics.length;
      renderShop();
    });
    document.getElementById("shop-next")?.addEventListener("click", () => {
      app.shopIndex = (app.shopIndex + 1) % cosmetics.length;
      renderShop();
    });
    document.getElementById("shop-buy-btn")?.addEventListener("click", () => {
      if (!owned) saveExperience(balance - cosmetic.cost);
      unlockCardBackCosmetic(cosmetic.id);
      saveSelectedCardBackCosmetic(cosmetic.id);
      refreshTopBar();
      renderShop();
    });
  }

  function renderBoardPage(entries, listId, labelId, prevId, nextId, page, setPage, mapRow, pageSize = PAGE_SIZE) {
    const list = document.getElementById(listId);
    const label = document.getElementById(labelId);
    const safePageSize = Math.max(1, Math.floor(Number(pageSize) || PAGE_SIZE));
    const pageCount = Math.max(1, Math.ceil(entries.length / safePageSize));
    const safePage = Math.max(0, Math.min(page, pageCount - 1));
    const rows = entries.slice(safePage * safePageSize, safePage * safePageSize + safePageSize);
    if (list) {
      list.innerHTML = rows.length
        ? rows.map((entry) => {
          const cells = mapRow(entry);
          return `<div class="board-row"><span>${cells[0]}</span><span>${escapeHtml(String(cells[1] || ""))}</span><span>${cells[2]}</span></div>`;
        }).join("")
        : '<div class="app-loading">Empty</div>';
    }
    if (label) label.textContent = `${safePage + 1}/${pageCount}`;
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);
    if (prev) prev.disabled = safePage <= 0;
    if (next) next.disabled = safePage >= pageCount - 1;
    prev?.addEventListener("click", () => setPage(Math.max(0, safePage - 1)));
    next?.addEventListener("click", () => setPage(Math.min(pageCount - 1, safePage + 1)));
  }

  function getHeroBoardKey(entry, absoluteIndex) {
    const baseKey = typeof getHeroEntryKey === "function"
      ? getHeroEntryKey(entry)
      : `${entry?.seed || ""}::${entry?.deck || ""}::${entry?.deckLevel || ""}`;
    return `${baseKey}::${entry?.createdAt || ""}::${absoluteIndex}`;
  }

  function getHeroLevelLabel(entry = {}) {
    const deck = String(entry.deck || "-").trim() || "-";
    const level = entry.hasExplicitDeckLevel ? `L${entry.deckLevel || 1}` : "L?";
    return deck === "-" ? level : `${deck} ${level}`;
  }

  function getHeroPowerLabel(entry = {}) {
    const power = String(entry.startingPower || "-").trim();
    return power && power !== "-" ? power : "-";
  }

  function renderHeroBoardPage(entries, pageSize = PAGE_SIZE) {
    const list = document.getElementById("scores-board-list");
    const label = document.getElementById("scores-page-label");
    const safePageSize = Math.max(1, Math.floor(Number(pageSize) || PAGE_SIZE));
    const pageCount = Math.max(1, Math.ceil(entries.length / safePageSize));
    const safePage = Math.max(0, Math.min(app.scoresPage, pageCount - 1));
    const rows = entries.slice(safePage * safePageSize, safePage * safePageSize + safePageSize);
    app.scoresPage = safePage;

    if (list) {
      list.innerHTML = rows.length
        ? rows.map((entry, index) => {
          const absoluteIndex = safePage * safePageSize + index;
          const key = getHeroBoardKey(entry, absoluteIndex);
          const selected = app.selectedHeroKey === key;
          const name = typeof formatNameWithCrownsHtml === "function"
            ? formatNameWithCrownsHtml(entry.playerName || "Unknown", entry)
            : escapeHtml(entry.playerName || "Unknown");
          const seed = String(entry.seed || "-").trim() || "-";
          return `
            <button class="board-row hero-board-row ${selected ? "active" : ""}" data-hero-key="${escapeHtml(key)}" type="button">
              <span class="hero-board-name">${name}</span>
              <span>${escapeHtml(getHeroLevelLabel(entry))}</span>
              <span>${escapeHtml(getHeroPowerLabel(entry))}</span>
            </button>
            ${selected ? `
              <div class="hero-detail-row">
                <span>Date <strong>${escapeHtml(formatHeroDate(entry.createdAt))}</strong></span>
                <button class="hero-seed-copy" data-copy-seed="${escapeHtml(seed)}" type="button">
                  <span>Seed</span>
                  <strong>${escapeHtml(seed)}</strong>
                </button>
              </div>` : ""}
          `;
        }).join("")
        : '<div class="app-loading">Empty</div>';
    }

    if (label) label.textContent = `${safePage + 1}/${pageCount}`;
    const prev = document.getElementById("scores-page-prev");
    const next = document.getElementById("scores-page-next");
    if (prev) prev.disabled = safePage <= 0;
    if (next) next.disabled = safePage >= pageCount - 1;
    prev?.addEventListener("click", () => {
      app.scoresPage = Math.max(0, safePage - 1);
      app.selectedHeroKey = "";
      renderScoresOverlay();
    });
    next?.addEventListener("click", () => {
      app.scoresPage = Math.min(pageCount - 1, safePage + 1);
      app.selectedHeroKey = "";
      renderScoresOverlay();
    });
    list?.querySelectorAll("[data-hero-key]").forEach((button) => button.addEventListener("click", () => {
      app.selectedHeroKey = app.selectedHeroKey === button.dataset.heroKey ? "" : button.dataset.heroKey;
      renderHeroBoardPage(entries, pageSize);
    }));
    list?.querySelectorAll("[data-copy-seed]").forEach((button) => button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const seed = button.dataset.copySeed || "";
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(seed);
        button.querySelector("span").textContent = "Copied";
      } catch {
        button.querySelector("span").textContent = "Copy unavailable";
      }
    }));
  }

  function getProfileBestRun() {
    if (typeof loadBestScoreMap !== "function") return loadBestScore() || 0;
    const scores = loadBestScoreMap();
    return Math.max(0, ...Object.values(scores || {}).map((value) => Number(value) || 0));
  }

  function getProfileStatRows(stats, wins) {
    return [
      ["Best Run", getProfileBestRun()],
      ["Total Correct", stats.totalCorrectGuesses || 0],
      ["Decks Beaten", stats.totalDecksCleared || 0],
      ["Runs Started", stats.runsStarted || 0],
      ["Blue Clears", wins.blue || 0],
      ["Orange Clears", wins.orange || 0],
      ["Green Clears", wins.green || 0],
      ["Yellow Clears", wins.yellow || 0],
      ["Blue Runs", stats.blueRunsStarted || 0],
      ["Orange Runs", stats.orangeRunsStarted || 0],
      ["Green Runs", stats.greenRunsStarted || 0],
      ["Yellow Runs", stats.yellowRunsStarted || 0],
      ["Daily Attempts", stats.dailyAttempts || 0],
      ["Dailies Cleared", stats.dailyClears || 0],
    ];
  }

  function getProfileAchievements(stats, wins) {
    return [
      ["First Deck Cleared", (stats.totalDecksCleared || 0) >= 1],
      ["Blue Deck Cleared", (wins.blue || 0) >= 1],
      ["Orange Deck Cleared", (wins.orange || 0) >= 1],
      ["Green Deck Cleared", (wins.green || 0) >= 1],
      ["Yellow Deck Cleared", (wins.yellow || 0) >= 1],
      ["100 Correct Guesses", (stats.totalCorrectGuesses || 0) >= 100],
      ["10 Decks Beaten", (stats.totalDecksCleared || 0) >= 10],
      ["Daily Starter", (stats.dailyAttempts || 0) >= 1],
      ["Daily Completed", (stats.dailyClears || 0) >= 1],
    ];
  }

  function getProfileTabLabel(tab) {
    if (tab === "achievements") return "Achievements";
    if (tab === "deck") return "Deck";
    return "Stats";
  }

  async function renderProfile(options = {}) {
    app.profileTab = ["stats", "achievements", "deck"].includes(options.tab) ? options.tab : app.profileTab;
    const host = getRenderHost("profile-body");
    if (!host) return;
    const stats = loadProfileStats();
    const wins = loadDeckWins();
    const crowns = typeof getCrownBadgesHtml === "function" ? getCrownBadgesHtml(getLocalCrownSnapshot()) : "";
    host.innerHTML = `
      <div class="fixed-card profile-name-card">
        <div class="form-row"><input id="profile-name-shell" maxlength="24" value="${escapeHtml(loadPreferredPlayerName())}" aria-label="Player name" placeholder="Player"></div>
        <div class="profile-crowns">${crowns || ""}</div>
      </div>
      <div class="segment-row">
        ${["stats", "achievements", "deck"].map((tab) => `<button class="segment-btn ${app.profileTab === tab ? "active" : ""}" data-tab="${tab}" type="button">${getProfileTabLabel(tab)}</button>`).join("")}
      </div>
      <div class="fixed-card profile-panel"><div id="profile-tab-body" style="min-height:0;display:grid;overflow:hidden;"></div></div>
    `;
    document.getElementById("profile-name-shell")?.addEventListener("input", (event) => {
      savePreferredPlayerName(event.target.value);
      if (typeof savePreferredHeroName === "function") savePreferredHeroName(event.target.value);
    });
    host.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
      app.profileTab = button.dataset.tab;
      app.boardPage = 0;
      renderProfile({ tab: app.profileTab });
    }));
    const tabBody = document.getElementById("profile-tab-body");
    if (app.profileTab === "stats") {
      tabBody.innerHTML = `
        <div class="profile-grid profile-stats-grid">
          ${getProfileStatRows(stats, wins).map(([label, value]) => `<div class="stat-cell profile-stat-cell"><strong>${value}</strong><span>${label}</span></div>`).join("")}
        </div>`;
      return;
    }
    if (app.profileTab === "achievements") {
      tabBody.innerHTML = `
        <div class="profile-achievement-grid">
          ${getProfileAchievements(stats, wins).map(([label, unlocked]) => `
            <div class="profile-achievement ${unlocked ? "unlocked" : "locked"}">
              <strong>${unlocked ? "Stamped" : "Locked"}</strong>
              <span>${unlocked ? label : "???"}</span>
            </div>
          `).join("")}
        </div>`;
      return;
    }
    renderDeckStateInto(tabBody);
  }

  async function renderScoresOverlay() {
    const host = getRenderHost("scores-body");
    if (!host) return;
    host.innerHTML = `
      <div class="segment-row">
        ${["daily", "heroes"].map((tab) => `<button class="segment-btn ${app.scoresTab === tab ? "active" : ""}" data-score-tab="${tab}" type="button">${tab}</button>`).join("")}
      </div>
      <div class="fixed-card scores-panel">
        <div class="board-list" id="scores-board-list"><div class="app-loading">Loading...</div></div>
        <div class="pager-row"><button class="pager-btn" id="scores-page-prev" type="button">‹</button><span id="scores-page-label"></span><button class="pager-btn" id="scores-page-next" type="button">›</button></div>
      </div>
    `;
    host.querySelectorAll("[data-score-tab]").forEach((button) => button.addEventListener("click", () => {
      app.scoresTab = button.dataset.scoreTab;
      app.scoresPage = 0;
      app.selectedHeroKey = "";
      renderScoresOverlay();
    }));
    const entries = app.scoresTab === "heroes"
      ? await fetchHeroes(120)
      : rankEntries(await fetchDailyLeaderboard(getTodayKey(), 120, "normal"));
    if (app.scoresTab === "heroes") {
      renderHeroBoardPage(entries);
      return;
    }
    renderBoardPage(entries, "scores-board-list", "scores-page-label", "scores-page-prev", "scores-page-next", app.scoresPage, (nextPage) => {
      app.scoresPage = nextPage;
      renderScoresOverlay();
    }, (entry) => [entry.dailyDisplayRank || "-", entry.playerName || "Unknown", Math.max(0, Number(entry.cardsCleared ?? entry.score) || 0)]);
  }

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

  function isTutorialToggleOn() {
    return sessionStorage.getItem(getTutorialForceReplayKey()) === "1" || localStorage.getItem(getTutorialCompletedKey()) !== "1";
  }

  function setSettingsStatus(message = "") {
    const status = document.getElementById("shell-settings-status");
    if (status) status.textContent = message;
  }

  function renderGameIfLoaded() {
    if (typeof render === "function") render();
  }

  function getLatestRunLogEntries() {
    if (typeof loadRunDebugLog !== "function") return [];
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

  function downloadLatestRunLog() {
    const payload = buildRunLogDownloadPayload();
    if (!payload) {
      setSettingsStatus("No run log found yet. Start a run first.");
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
    setSettingsStatus("Run log downloaded.");
  }

  async function shareLatestRunLog() {
    const payload = buildRunLogDownloadPayload();
    if (!payload) {
      setSettingsStatus("No run log found yet. Start a run first.");
      return;
    }
    if (typeof navigator.share !== "function") {
      downloadLatestRunLog();
      return;
    }
    const file = new File([JSON.stringify(payload, null, 2)], buildRunLogFilename(payload), { type: "application/json" });
    try {
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "52! Run Log",
          text: `52! run log for ${payload.deck} Level ${payload.level}, seed ${payload.seed || "unknown"}.`,
          files: [file],
        });
        setSettingsStatus("Run log shared.");
        return;
      }
      await navigator.share({
        title: "52! Run Log",
        text: `52! run log for ${payload.deck} Level ${payload.level}, seed ${payload.seed || "unknown"}.`,
      });
      setSettingsStatus("Run log shared.");
    } catch (error) {
      if (error?.name === "AbortError") {
        setSettingsStatus("Share cancelled.");
        return;
      }
      downloadLatestRunLog();
    }
  }

  function setDeckResetStatus(message = "") {
    const status = document.getElementById("deck-reset-shell-status");
    if (status) status.textContent = message;
  }

  function setSettingsResetHoldProgress(progress) {
    const fill = document.getElementById("deck-reset-shell-fill");
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
  }

  function resetSettingsResetHoldVisuals() {
    const label = document.getElementById("deck-reset-shell-label");
    setSettingsResetHoldProgress(0);
    if (label) label.textContent = "Hold To Reset";
  }

  function stopSettingsResetHold() {
    if (app.settingsResetTimer) {
      clearTimeout(app.settingsResetTimer);
      app.settingsResetTimer = null;
    }
    if (app.settingsResetRaf) {
      cancelAnimationFrame(app.settingsResetRaf);
      app.settingsResetRaf = 0;
    }
  }

  function stopDeckCardResetHold() {
    if (app.deckCardResetTimer) {
      clearTimeout(app.deckCardResetTimer);
      app.deckCardResetTimer = null;
    }
    app.deckCardResetCell?.classList.remove("restore-hold-active");
    app.deckCardResetCell = null;
  }

  function isAlteredCardStatus(status) {
    return !!(status?.tornCorner || status?.enchanted || (status?.backColor && status.backColor !== "blue"));
  }

  function syncDeckStateSnapshotCardStatus(cardId, status) {
    if (!cardId || typeof sessionStorage === "undefined" || typeof GAME_STATE_SNAPSHOT_KEY === "undefined") return;
    const raw = sessionStorage.getItem(GAME_STATE_SNAPSHOT_KEY);
    if (!raw) return;
    try {
      const snapshot = JSON.parse(raw);
      if (!snapshot || typeof snapshot !== "object") return;
      const statuses = snapshot.cardBackStatuses && typeof snapshot.cardBackStatuses === "object"
        ? snapshot.cardBackStatuses
        : {};
      if (status) statuses[cardId] = status;
      else delete statuses[cardId];
      snapshot.cardBackStatuses = statuses;
      sessionStorage.setItem(GAME_STATE_SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch {
      // Persistent storage remains the source of truth.
    }
  }

  function resetDeckStateCard(cardId) {
    if (!cardId || typeof loadCardBackStatuses !== "function" || typeof saveCardBackStatuses !== "function") return false;
    const statuses = loadCardBackStatuses();
    if (!isAlteredCardStatus(statuses?.[cardId])) return false;
    delete statuses[cardId];
    saveCardBackStatuses(statuses);
    syncDeckStateSnapshotCardStatus(cardId, null);
    try {
      if (typeof state === "object" && state?.cardBackStatuses) delete state.cardBackStatuses[cardId];
    } catch {
      // State may not be loaded in shell-only views.
    }
    renderGameIfLoaded();
    return true;
  }

  function beginDeckCardResetHold(cell, event) {
    if (!cell || cell.dataset.marked !== "true") return;
    if (event?.button !== undefined && event.button !== 0) return;
    stopDeckCardResetHold();
    event?.preventDefault?.();
    event?.currentTarget?.setPointerCapture?.(event.pointerId);
    app.deckCardResetCell = cell;
    cell.classList.add("restore-hold-active");
    setDeckResetStatus("Keep holding to reset this card.");
    app.deckCardResetTimer = setTimeout(() => {
      const cardId = cell.dataset.cardId || "";
      const label = cell.dataset.cardLabel || "Card";
      const restored = resetDeckStateCard(cardId);
      stopDeckCardResetHold();
      setDeckResetStatus(restored ? `${label} reset.` : "That card has no marks.");
      renderDeckStateInto(getRenderHost("profile-tab-body") || getRenderHost("deck-body"));
    }, 1800);
  }

  function updateSettingsResetHoldProgress() {
    if (!app.settingsResetStartedAt || app.settingsResetTriggered) return;
    const elapsed = performance.now() - app.settingsResetStartedAt;
    const progress = Math.min(1, elapsed / 5000);
    const label = document.getElementById("deck-reset-shell-label");
    setSettingsResetHoldProgress(progress);
    if (label) label.textContent = progress >= 1 ? "Deck Reset" : `Hold ${Math.max(0, Math.ceil((5000 - elapsed) / 1000))}s`;
    if (progress < 1) app.settingsResetRaf = requestAnimationFrame(updateSettingsResetHoldProgress);
  }

  function triggerSettingsDeckReset() {
    app.settingsResetTriggered = true;
    stopSettingsResetHold();
    stopDeckCardResetHold();
    if (typeof resetDeckAlterations === "function") resetDeckAlterations();
    else localStorage.removeItem(typeof CARD_BACK_STATUS_KEY === "string" ? CARD_BACK_STATUS_KEY : "hl_prototype_card_back_status_v1");
    if (typeof state === "object" && state) state.cardBackStatuses = {};
    setSettingsResetHoldProgress(1);
    const label = document.getElementById("deck-reset-shell-label");
    if (label) label.textContent = "Deck Reset";
    setDeckResetStatus("Deck physical changes cleared.");
    document.querySelectorAll("#profile-tab-body .deck-state-card.marked").forEach((card) => card.classList.remove("marked"));
    renderGameIfLoaded();
  }

  function beginSettingsResetHold(event) {
    if (event?.button !== undefined && event.button !== 0) return;
    stopSettingsResetHold();
    app.settingsResetTriggered = false;
    app.settingsResetStartedAt = performance.now();
    setDeckResetStatus("Keep holding to reset the deck.");
    app.settingsResetTimer = setTimeout(triggerSettingsDeckReset, 5000);
    app.settingsResetRaf = requestAnimationFrame(updateSettingsResetHoldProgress);
  }

  function cancelSettingsResetHold() {
    if (app.settingsResetTriggered) return;
    stopSettingsResetHold();
    app.settingsResetStartedAt = 0;
    resetSettingsResetHoldVisuals();
    setDeckResetStatus("");
  }

  function renderSettings() {
    const host = getRenderHost("settings-body");
    if (!host) return;
    const hasLog = getLatestRunLogEntries().length > 0;
    host.innerHTML = `
      <div class="shell-settings-form">
        <div class="shell-settings-rows">
          <label class="shell-settings-row" for="shell-settings-sound"><span>Sound</span><input class="shell-toggle-input" id="shell-settings-sound" type="checkbox" ${loadSoundEnabled() ? "checked" : ""}><span class="shell-toggle" aria-hidden="true"></span></label>
          <label class="shell-settings-row" for="shell-settings-haptics"><span>Haptics</span><input class="shell-toggle-input" id="shell-settings-haptics" type="checkbox" ${loadHapticsEnabled() ? "checked" : ""}><span class="shell-toggle" aria-hidden="true"></span></label>
          <label class="shell-settings-row" for="shell-settings-fast-reveal"><span>Fast Reveal</span><input class="shell-toggle-input" id="shell-settings-fast-reveal" type="checkbox" ${loadFastRevealEnabled() ? "checked" : ""}><span class="shell-toggle" aria-hidden="true"></span></label>
          <label class="shell-settings-row" for="shell-settings-reduced-effects"><span>Reduced Effects</span><input class="shell-toggle-input" id="shell-settings-reduced-effects" type="checkbox" ${loadEffectsPreference() === "reduced" ? "checked" : ""}><span class="shell-toggle" aria-hidden="true"></span></label>
          <label class="shell-settings-row" for="shell-settings-tutorial"><span>Tutorial</span><input class="shell-toggle-input" id="shell-settings-tutorial" type="checkbox" ${isTutorialToggleOn() ? "checked" : ""}><span class="shell-toggle" aria-hidden="true"></span></label>
          <label class="shell-settings-row" for="shell-settings-buttons"><span>Flip Buttons</span><input class="shell-toggle-input" id="shell-settings-buttons" type="checkbox" ${loadGuessButtonOrder() === "higher-lower" ? "checked" : ""}><span class="shell-toggle" aria-hidden="true"></span></label>
          <label class="shell-settings-row" for="shell-settings-nudges"><span>Flip Nudges</span><input class="shell-toggle-input" id="shell-settings-nudges" type="checkbox" ${loadNudgeButtonOrder() === "up-down" ? "checked" : ""}><span class="shell-toggle" aria-hidden="true"></span></label>
          <label class="shell-settings-row" for="shell-settings-xp"><span>Experience</span><input class="shell-toggle-input" id="shell-settings-xp" type="checkbox" ${loadExperienceDisplayEnabled() ? "checked" : ""}><span class="shell-toggle" aria-hidden="true"></span></label>
          <label class="shell-settings-row" for="shell-settings-unlock"><span>Unlock Decks</span><input class="shell-toggle-input" id="shell-settings-unlock" type="checkbox" ${loadUnlockDecks() ? "checked" : ""}><span class="shell-toggle" aria-hidden="true"></span></label>
        </div>
        <div class="shell-settings-actions">
          <button id="shell-settings-download-log" class="settings-action-btn" type="button" ${hasLog ? "" : "disabled"}>Download Run Log</button>
          <button id="shell-settings-share-log" class="settings-action-btn" type="button" ${hasLog && typeof navigator.share === "function" ? "" : "disabled"}>Share Run Log</button>
        </div>
        <p id="shell-settings-status" class="shell-settings-status"></p>
      </div>
    `;
    const buttonOrder = document.getElementById("shell-settings-buttons");
    const nudgeOrder = document.getElementById("shell-settings-nudges");
    document.getElementById("shell-settings-sound")?.addEventListener("change", (event) => {
      saveSoundEnabled(!!event.target.checked);
      setSettingsStatus(event.target.checked ? "Sound enabled." : "Sound disabled.");
    });
    document.getElementById("shell-settings-haptics")?.addEventListener("change", (event) => {
      saveHapticsEnabled(!!event.target.checked);
      setSettingsStatus(event.target.checked ? "Haptics enabled." : "Haptics disabled.");
    });
    document.getElementById("shell-settings-fast-reveal")?.addEventListener("change", (event) => {
      saveFastRevealEnabled(!!event.target.checked);
      if (typeof applyEffectsPreference === "function") applyEffectsPreference();
      setSettingsStatus(event.target.checked ? "Fast reveal enabled." : "Standard reveal enabled.");
    });
    document.getElementById("shell-settings-reduced-effects")?.addEventListener("change", (event) => {
      saveEffectsPreference(event.target.checked ? "reduced" : "full");
      if (typeof applyEffectsPreference === "function") applyEffectsPreference();
      renderGameIfLoaded();
      setSettingsStatus(event.target.checked ? "Reduced effects enabled." : "Full effects enabled.");
    });
    document.getElementById("shell-settings-tutorial")?.addEventListener("change", (event) => {
      if (event.target.checked) {
        sessionStorage.setItem(getTutorialForceReplayKey(), "1");
        if (typeof createTutorialController === "function") window.tutorialController = createTutorialController();
        setSettingsStatus("Tutorial enabled for the next run.");
        return;
      }
      localStorage.setItem(getTutorialCompletedKey(), "1");
      sessionStorage.removeItem(getTutorialForceReplayKey());
      window.tutorialController?.closeAndComplete?.();
      renderHome();
      setSettingsStatus("Tutorial disabled.");
    });
    buttonOrder?.addEventListener("change", (event) => {
      saveGuessButtonOrder(event.target.checked ? "higher-lower" : "lower-higher");
      renderGameIfLoaded();
      setSettingsStatus(event.target.checked ? "Guess buttons flipped." : "Guess buttons set to Lower / Higher.");
    });
    nudgeOrder?.addEventListener("change", (event) => {
      saveNudgeButtonOrder(event.target.checked ? "up-down" : "down-up");
      renderGameIfLoaded();
      setSettingsStatus(event.target.checked ? "Nudges flipped." : "Nudges set to Down / Up.");
    });
    document.getElementById("shell-settings-xp")?.addEventListener("change", (event) => {
      const enabled = saveExperienceDisplayEnabled(!!event.target.checked);
      if (!enabled && typeof completeExperienceBankingAnimation === "function") completeExperienceBankingAnimation({ fade: true });
      renderGameIfLoaded();
      refreshTopBar();
      setSettingsStatus(enabled ? "Experience display enabled." : "Experience is still tracked, but hidden in the run.");
    });
    document.getElementById("shell-settings-unlock")?.addEventListener("change", (event) => {
      saveUnlockDecks(!!event.target.checked);
      setSettingsStatus(event.target.checked ? "All decks are unlocked on this device." : "Normal deck progression restored.");
    });
    document.getElementById("shell-settings-download-log")?.addEventListener("click", downloadLatestRunLog);
    document.getElementById("shell-settings-share-log")?.addEventListener("click", shareLatestRunLog);
  }

  function renderDeckStateInto(host) {
    if (!host) return;
    const statuses = loadCardBackStatuses();
    const marked = new Set(Object.entries(statuses).filter(([, status]) => isAlteredCardStatus(status)).map(([id]) => id));
    const markCount = marked.size;
    host.innerHTML = `<div class="deck-state-grid">${SUITS.map((suit) => RANKS.map((rank) => {
      const id = getCardId(suit, rank.r);
      const red = suit === "♥" || suit === "♦";
      const isMarked = marked.has(id);
      return `<button class="deck-state-card ${red ? "red" : ""} ${isMarked ? "marked" : ""}" type="button" data-card-id="${id}" data-card-label="${rank.r}${suit}" data-marked="${isMarked ? "true" : "false"}" aria-label="${rank.r}${suit}${isMarked ? " marked. Hold to reset this card." : " unmarked."}">${rank.r}${suit}</button>`;
    }).join("")).join("")}</div><button class="shell-settings-reset" id="deck-reset-shell" type="button"><span id="deck-reset-shell-label">Hold To Reset</span><span id="deck-reset-shell-fill" class="shell-settings-reset-fill"></span></button><p id="deck-reset-shell-status" class="shell-settings-status">${markCount ? "Hold a marked card to reset it." : "No card marks currently active."}</p>`;
    host.querySelectorAll(".deck-state-card.marked").forEach((cell) => {
      cell.addEventListener("pointerdown", (event) => beginDeckCardResetHold(cell, event));
      cell.addEventListener("pointerup", stopDeckCardResetHold);
      cell.addEventListener("pointercancel", stopDeckCardResetHold);
      cell.addEventListener("pointerleave", stopDeckCardResetHold);
    });
    const resetDeckBtn = document.getElementById("deck-reset-shell");
    resetDeckBtn?.addEventListener("pointerdown", beginSettingsResetHold);
    resetDeckBtn?.addEventListener("pointerup", cancelSettingsResetHold);
    resetDeckBtn?.addEventListener("pointercancel", cancelSettingsResetHold);
    resetDeckBtn?.addEventListener("pointerleave", cancelSettingsResetHold);
  }

  function renderDeckState() {
    renderDeckStateInto(getRenderHost("deck-body"));
  }

  function renderHelp() {
    const host = getRenderHost("help-body");
    if (!host) return;
    host.innerHTML = `
      <div class="rules-strip">
        <div class="rule-chip"><strong>↕</strong><span>Higher / lower. Ties pass.</span></div>
        <div class="rule-chip"><strong>±</strong><span>Nudges shift the card before guessing.</span></div>
        <div class="rule-chip"><strong>★</strong><span>Cheats and powers alter a run.</span></div>
      </div>
      <div class="fixed-card help-copy-grid">
        <section><h3>Goal</h3><p>Clear as many cards as you can from the deck.</p></section>
        <section><h3>Guess</h3><p>Use higher or lower against the visible card. A wrong guess ends the run.</p></section>
        <section><h3>Tools</h3><p>Streaks can offer cheats. Some decks add powers or jokers.</p></section>
        <section><h3>Daily</h3><p>One shared challenge each day. Finish Normal to unlock Hard.</p></section>
      </div>`;
  }

  function isRunExitConfirmationNeeded() {
    if (app.view !== "play") return false;
    const isVisible = (el) => !!(
      el &&
      !el.hidden &&
      el.getAttribute("aria-hidden") !== "true" &&
      getComputedStyle(el).display !== "none" &&
      getComputedStyle(el).visibility !== "hidden"
    );
    if (isVisible(document.getElementById("higher-btn")) || isVisible(document.getElementById("lower-btn"))) return true;
    if (isVisible(document.getElementById("restart-btn"))) return false;
    try {
      return typeof state === "object" && !!state && !state.gameOver && !!state.current;
    } catch {
      return false;
    }
  }

  function exitRunToHome() {
    closeShellMenu();
    discardOverlayHistoryEntry();
    closeOverlay(false, { useHistory: false });
    window.skipAutoSnapshot = true;
    if (typeof clearGameStateSnapshot === "function") clearGameStateSnapshot();
    navigate("home");
  }

  function requestHomeNavigation() {
    closeShellMenu();
    if (app.view === "home") return;
    if (isRunExitConfirmationNeeded()) {
      openOverlay("confirm-exit");
      return;
    }
    discardOverlayHistoryEntry();
    closeOverlay(false, { useHistory: false });
    navigate("home");
  }

  function requestRunExit() {
    closeShellMenu();
    if (isRunExitConfirmationNeeded()) {
      openOverlay("confirm-exit");
      return;
    }
    exitRunToHome();
  }

  document.getElementById("home-play-btn")?.addEventListener("click", () => navigate("setup"));
  document.getElementById("home-daily-btn")?.addEventListener("click", () => navigate("daily", { date: getTodayKey() }));
  document.getElementById("home-collection-btn")?.addEventListener("click", () => navigate("collection"));
  homeBtn?.addEventListener("click", requestHomeNavigation);
  document.getElementById("top-shop-btn")?.addEventListener("click", () => openOverlay("shop"));
  document.getElementById("top-profile-btn")?.addEventListener("click", () => openOverlay("profile", { tab: "stats" }));
  menuBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleShellMenu();
  });
  document.getElementById("menu-help-btn")?.addEventListener("click", () => openOverlay("help"));
  document.getElementById("menu-scores-btn")?.addEventListener("click", () => openOverlay("scores"));
  document.getElementById("menu-settings-btn")?.addEventListener("click", () => openOverlay("settings"));
  document.getElementById("menu-exit-btn")?.addEventListener("click", requestRunExit);
  shellMenuBackdrop?.addEventListener("click", closeShellMenu);
  document.getElementById("shell-modal-backdrop")?.addEventListener("click", () => closeOverlay());
  document.getElementById("shell-modal-close")?.addEventListener("click", () => closeOverlay());
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".app-menu-wrap")) closeShellMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && modal && !modal.classList.contains("hidden")) {
      const focusable = Array.from(modal.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"))
        .filter((el) => el.getClientRects().length > 0);
      if (focusable.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
          return;
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
          return;
        }
      }
    }
    const target = event.target;
    const isTyping = target?.matches?.("input, textarea, select, [contenteditable='true']");
    if (!isTyping && event.shiftKey) {
      const key = event.key.toLowerCase();
      if (app.view === "daily" && key === "t") {
        event.preventDefault();
        seedDailyCalendarDebugData();
        return;
      }
      if (key === "u") {
        event.preventDefault();
        unlockSetupForDebug();
        return;
      }
      if (key === "r") {
        event.preventDefault();
        resetSetupProgressForDebug();
        return;
      }
    }
    if (event.key !== "Escape") return;
    closeShellMenu();
    closeOverlay();
  });
  window.addEventListener("popstate", () => {
    if (hasOverlayHistoryEntry()) {
      openOverlay(history.state.overlay, {}, { useHistory: false });
      return;
    }
    closeOverlay(false, { useHistory: false });
    const route = routeFromLocation();
    renderRoute(route.view, route.options);
  });

  const initialRoute = routeFromLocation();
  history.replaceState({ view: initialRoute.view, options: initialRoute.options }, "", buildUrl(initialRoute.view, initialRoute.options));
  renderRoute(initialRoute.view, initialRoute.options);
  window.setInterval(refreshTopBar, 750);
})();
