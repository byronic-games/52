(function () {
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

  if (!cosmetics.length || !experienceEl || !previewEl || !nameEl || !descEl || !costEl || !actionBtn || !prevBtn || !nextBtn || !dotsEl) return;

  let currentIndex = Math.max(0, cosmetics.findIndex((cosmetic) => cosmetic.id === loadSelectedCardBackCosmetic()));

  function getBalance() {
    return typeof loadExperience === "function" ? loadExperience() : 0;
  }

  function setBalance(value) {
    if (typeof saveExperience === "function") return saveExperience(value);
    return value;
  }

  function renderDots() {
    dotsEl.innerHTML = "";
    cosmetics.forEach((_, index) => {
      const dot = document.createElement("span");
      dot.className = `shop-dot${index === currentIndex ? " active" : ""}`;
      dotsEl.appendChild(dot);
    });
  }

  function renderCurrent() {
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

  function move(delta) {
    currentIndex = (currentIndex + delta + cosmetics.length) % cosmetics.length;
    renderCurrent();
  }

  actionBtn.addEventListener("click", () => {
    const cosmetic = cosmetics[currentIndex] || cosmetics[0];
    const owned = isCardBackCosmeticOwned(cosmetic.id);
    if (!owned) {
      const balance = getBalance();
      if (balance < cosmetic.cost) return;
      setBalance(balance - cosmetic.cost);
      unlockCardBackCosmetic(cosmetic.id);
    }
    saveSelectedCardBackCosmetic(cosmetic.id);
    renderCurrent();
  });

  prevBtn.addEventListener("click", () => move(-1));
  nextBtn.addEventListener("click", () => move(1));

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  });

  renderCurrent();
})();
