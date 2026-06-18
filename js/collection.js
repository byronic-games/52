(function () {
  const RESTORE_HOLD_DURATION_MS = 1800;

  const cosmetics = typeof getIncludedCardBackCosmetics === "function" ? getIncludedCardBackCosmetics() : [];
  const experienceEl = document.getElementById("shop-experience-value");
  const previewEl = document.getElementById("shop-card-preview");
  const nameEl = document.getElementById("shop-cosmetic-name");
  const descEl = document.getElementById("shop-cosmetic-desc");
  const costEl = document.getElementById("shop-cosmetic-cost");
  const actionBtn = document.getElementById("shop-action-btn");
  const prevBtn = document.getElementById("shop-prev-btn");
  const nextBtn = document.getElementById("shop-next-btn");
  const dotsEl = document.getElementById("shop-dots");
  const noteEl = document.getElementById("shop-note");
  const cardStateSummaryEl = document.getElementById("collection-card-state-summary");
  const cardStateGridEl = document.getElementById("collection-card-state-grid");
  const resetDeckBtn = document.getElementById("collection-reset-deck-btn");
  const resetDeckStatus = document.getElementById("collection-reset-deck-status");
  const cheatsGridEl = document.getElementById("collection-cheats-grid");
  const powersGridEl = document.getElementById("collection-powers-grid");
  const cheatsSummaryEl = document.getElementById("collection-cheats-summary");
  const powersSummaryEl = document.getElementById("collection-powers-summary");

  let currentIndex = Math.max(0, cosmetics.findIndex((cosmetic) => cosmetic.id === loadSelectedCardBackCosmetic()));
  let resetConfirmUntil = 0;
  let holdTimer = null;
  let activeRestoreCell = null;
  let discoveryHoldTimer = null;
  let activeDiscoveryCard = null;

  function getBalance() {
    return typeof loadExperience === "function" ? loadExperience() : 0;
  }

  function setBalance(value) {
    if (typeof saveExperience === "function") return saveExperience(value);
    return value;
  }

  function renderDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = "";
    cosmetics.forEach((_, index) => {
      const dot = document.createElement("span");
      dot.className = `shop-dot${index === currentIndex ? " active" : ""}`;
      dotsEl.appendChild(dot);
    });
  }

  function renderCurrentCosmetic() {
    if (!cosmetics.length || !experienceEl || !previewEl || !nameEl || !descEl || !costEl || !actionBtn) return;

    const cosmetic = cosmetics[currentIndex] || cosmetics[0];
    const balance = getBalance();
    const owned = isCardBackCosmeticOwned(cosmetic.id);
    const selected = loadSelectedCardBackCosmetic() === cosmetic.id;

    experienceEl.innerText = String(balance);
    nameEl.innerText = cosmetic.name;
    descEl.innerText = cosmetic.description || "";
    costEl.innerText = owned ? (selected ? "Selected" : "Owned") : `${cosmetic.cost} XP`;

    previewEl.className = `shop-card-preview card-back card-back-blue ${cosmetic.previewClass || ""}${owned ? "" : " locked"}`.trim();
    if (cosmetic.image) {
      previewEl.style.setProperty("--card-back-cosmetic-image", `url("${cosmetic.image}")`);
    } else {
      previewEl.style.removeProperty("--card-back-cosmetic-image");
    }

    actionBtn.disabled = selected || (!owned && balance < cosmetic.cost);
    actionBtn.innerText = selected ? "Selected" : owned ? "Select" : `Buy ${cosmetic.cost} XP`;
    if (noteEl) {
      noteEl.innerText = selected
        ? "This card back is active."
        : owned
          ? "Owned. Select it to use it on future face-down cards."
          : balance >= cosmetic.cost
            ? "Spend experience to unlock this card back."
            : "Not enough experience yet.";
    }
    renderDots();
  }

  function moveCosmetic(delta) {
    if (!cosmetics.length) return;
    currentIndex = (currentIndex + delta + cosmetics.length) % cosmetics.length;
    renderCurrentCosmetic();
  }

  function getSuitName(suit) {
    return SUIT_NAMES?.[suit] || String(suit || "");
  }

  function getCardTextLabel(rank, suit) {
    return `${rank} of ${getSuitName(suit)}`;
  }

  function syncSnapshotCardBackStatus(cardId, status) {
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
      // Persistent storage is the source of truth.
    }
  }

  function restoreTornCard(cardId) {
    if (!cardId || typeof loadCardBackStatuses !== "function" || typeof saveCardBackStatuses !== "function") return false;
    const statuses = loadCardBackStatuses();
    const current = statuses?.[cardId];
    if (!current?.tornCorner) return false;

    const nextStatus = { ...current, tornCorner: false };
    const isDefaultStatus = !nextStatus.tornCorner && (!nextStatus.backColor || nextStatus.backColor === "blue");
    if (isDefaultStatus) {
      delete statuses[cardId];
      syncSnapshotCardBackStatus(cardId, null);
    } else {
      statuses[cardId] = nextStatus;
      syncSnapshotCardBackStatus(cardId, nextStatus);
    }
    saveCardBackStatuses(statuses);
    return true;
  }

  function renderCardStateGrid() {
    if (!cardStateGridEl || !cardStateSummaryEl || !Array.isArray(SUITS) || !Array.isArray(RANKS)) return;

    const statuses = typeof loadCardBackStatuses === "function" ? loadCardBackStatuses() : {};
    const tornIds = new Set(
      Object.entries(statuses || {})
        .filter(([, status]) => !!status?.tornCorner)
        .map(([cardId]) => cardId)
    );

    cardStateGridEl.innerHTML = "";
    SUITS.forEach((suit) => {
      RANKS.forEach((rank) => {
        const cardId = getCardId(suit, rank.r);
        const isTorn = tornIds.has(cardId);
        const cell = document.createElement("button");
        cell.type = "button";
        cell.dataset.cardId = cardId;
        cell.dataset.cardLabel = `${rank.r}${suit}`;
        cell.dataset.cardTextLabel = getCardTextLabel(rank.r, suit);
        cell.dataset.torn = isTorn ? "true" : "false";
        cell.className = `profile-card-state-cell ${suit === SUITS[1] || suit === SUITS[2] ? "red" : "black"} ${isTorn ? "torn" : ""}`;
        cell.setAttribute("aria-label", `${rank.r}${suit}${isTorn ? " has a torn corner" : " has no tear"}`);
        cell.innerHTML = `<span class="profile-card-state-rank">${rank.r}</span><span class="profile-card-state-suit">${suit}</span>`;
        cardStateGridEl.appendChild(cell);
      });
    });

    cardStateSummaryEl.textContent = tornIds.size > 0
      ? `${tornIds.size} torn ${tornIds.size === 1 ? "card" : "cards"} marked.`
      : "No torn cards currently marked.";
  }

  function clearRestoreHold() {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    activeRestoreCell?.classList.remove("restore-hold-active");
    activeRestoreCell = null;
  }

  function beginRestoreHold(cell) {
    if (!cell || cell.dataset.torn !== "true") return;
    clearRestoreHold();
    activeRestoreCell = cell;
    cell.classList.add("restore-hold-active");
    if (resetDeckStatus) resetDeckStatus.innerText = "Keep holding to repair this card.";
    holdTimer = setTimeout(() => {
      const cardId = cell.dataset.cardId || "";
      const label = cell.dataset.cardTextLabel || cell.dataset.cardLabel || "Card";
      const restored = restoreTornCard(cardId);
      clearRestoreHold();
      if (resetDeckStatus) {
        resetDeckStatus.innerText = restored ? `${label} repaired.` : "That card is already repaired.";
      }
      renderCardStateGrid();
    }, RESTORE_HOLD_DURATION_MS);
  }

  function getEntryDescription(entry, typeLabel) {
    if (!entry) return "";
    if (entry.description) return entry.description;
    if (typeLabel === "Cheat" && typeof CHEAT_DESCRIPTIONS !== "undefined") {
      return CHEAT_DESCRIPTIONS?.[entry.name] || "";
    }
    return "";
  }

  function clearDiscoveryHold() {
    if (discoveryHoldTimer) {
      clearTimeout(discoveryHoldTimer);
      discoveryHoldTimer = null;
    }
    activeDiscoveryCard?.classList.remove("detail-holding");
    document.querySelector(".collection-discovery-detail.is-visible")?.classList.remove("is-visible");
    activeDiscoveryCard = null;
  }

  function beginDiscoveryHold(card) {
    if (!card || card.dataset.hasDetail !== "true") return;
    clearDiscoveryHold();
    activeDiscoveryCard = card;
    discoveryHoldTimer = setTimeout(() => {
      const detail = card.querySelector(".collection-discovery-detail");
      if (!detail) return;
      detail.style.visibility = "hidden";
      detail.classList.add("is-visible");
      const detailWidth = detail.offsetWidth;
      const detailHeight = detail.offsetHeight;
      const rect = card.getBoundingClientRect();
      const top = Math.max(12, rect.top - detailHeight - 10);
      const left = Math.min(
        window.innerWidth - detailWidth - 10,
        Math.max(10, rect.left + (rect.width / 2) - (detailWidth / 2))
      );
      detail.style.setProperty("--detail-top", `${top}px`);
      detail.style.setProperty("--detail-left", `${left}px`);
      card.classList.add("detail-holding");
      detail.style.visibility = "";
      discoveryHoldTimer = null;
    }, 420);
  }

  function renderDiscoveryGrid(gridEl, summaryEl, entries, discoveredSet, typeLabel) {
    if (!gridEl) return;
    const included = entries.filter((entry) => entry?.included !== false && entry?.id);
    const discoveredCount = included.filter((entry) => discoveredSet.has(entry.id)).length;
    if (summaryEl) summaryEl.innerText = `${discoveredCount}/${included.length} discovered`;

    gridEl.innerHTML = "";
    included.forEach((entry) => {
      const discovered = discoveredSet.has(entry.id);
      const button = document.createElement("button");
      const rarity = document.createElement("span");
      const name = document.createElement("strong");
      const detail = document.createElement("span");
      const detailText = discovered ? getEntryDescription(entry, typeLabel) : "";
      button.type = "button";
      button.className = `collection-discovery-card ${discovered ? "discovered" : "locked"}`;
      button.dataset.entryId = entry.id;
      button.dataset.hasDetail = detailText ? "true" : "false";
      rarity.className = "collection-discovery-rarity";
      rarity.textContent = discovered ? (entry.rarity || "common") : "undiscovered";
      name.textContent = discovered ? entry.name : `Unknown ${typeLabel}`;
      button.append(rarity, name);
      if (detailText) {
        detail.className = "collection-discovery-detail";
        detail.textContent = detailText;
        button.appendChild(detail);
        button.addEventListener("pointerdown", (event) => {
          if (event.button !== undefined && event.button !== 0) return;
          event.preventDefault();
          button.setPointerCapture?.(event.pointerId);
          beginDiscoveryHold(button);
        });
        button.addEventListener("pointerup", clearDiscoveryHold);
        button.addEventListener("pointerleave", clearDiscoveryHold);
        button.addEventListener("pointercancel", clearDiscoveryHold);
      }
      gridEl.appendChild(button);
    });
  }

  function renderDiscovery() {
    const discoveredCheats = typeof loadDiscoveredCheats === "function" ? loadDiscoveredCheats() : new Set();
    const discoveredPowers = typeof loadDiscoveredPowers === "function" ? loadDiscoveredPowers() : new Set();
    renderDiscoveryGrid(cheatsGridEl, cheatsSummaryEl, Array.isArray(CHEATS) ? CHEATS : [], discoveredCheats, "Cheat");
    renderDiscoveryGrid(powersGridEl, powersSummaryEl, Array.isArray(POWERS) ? POWERS : [], discoveredPowers, "Power");
  }

  actionBtn?.addEventListener("click", () => {
    const cosmetic = cosmetics[currentIndex] || cosmetics[0];
    const owned = isCardBackCosmeticOwned(cosmetic.id);
    if (!owned) {
      const balance = getBalance();
      if (balance < cosmetic.cost) return;
      setBalance(balance - cosmetic.cost);
      unlockCardBackCosmetic(cosmetic.id);
    }
    saveSelectedCardBackCosmetic(cosmetic.id);
    renderCurrentCosmetic();
  });

  prevBtn?.addEventListener("click", () => moveCosmetic(-1));
  nextBtn?.addEventListener("click", () => moveCosmetic(1));

  cardStateGridEl?.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const cell = event.target.closest(".profile-card-state-cell.torn");
    if (!cell || !cardStateGridEl.contains(cell)) return;
    event.preventDefault();
    cell.setPointerCapture?.(event.pointerId);
    beginRestoreHold(cell);
  });
  cardStateGridEl?.addEventListener("pointerup", clearRestoreHold);
  cardStateGridEl?.addEventListener("pointerleave", clearRestoreHold);
  cardStateGridEl?.addEventListener("pointercancel", clearRestoreHold);

  resetDeckBtn?.addEventListener("click", () => {
    const now = Date.now();
    if (now < resetConfirmUntil) {
      if (typeof resetDeckAlterations === "function") resetDeckAlterations();
      resetConfirmUntil = 0;
      if (resetDeckStatus) resetDeckStatus.innerText = "Deck state reset. Tears removed.";
      renderCardStateGrid();
      return;
    }
    resetConfirmUntil = now + 3500;
    if (resetDeckStatus) resetDeckStatus.innerText = "Tap Reset Deck again to remove all tears and card-back marks.";
  });

  renderCurrentCosmetic();
  renderCardStateGrid();
  renderDiscovery();
})();
