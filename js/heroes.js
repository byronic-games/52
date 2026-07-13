async function renderHeroesBoard() {
  const bodyEl = document.getElementById("heroes-table-body");
  const noteEl = document.getElementById("heroes-note");
  if (!bodyEl || !noteEl) return;

  const heroes = await fetchHeroes(300);
  bodyEl.innerHTML = "";

  if (!heroes.length) {
    bodyEl.innerHTML = "<tr><td colspan='6'>No 52-card clears yet. Be the first hero.</td></tr>";
    noteEl.innerText = leaderboardRemoteEnabled()
      ? "Connected to online leaderboard."
      : "Showing local leaderboard only. Configure Supabase in js/leaderboard.js for global tracking.";
    return;
  }

  heroes.forEach((hero) => {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.dataset.label = "Name";
    if (typeof formatNameWithCrownsHtml === "function") {
      nameTd.innerHTML = formatNameWithCrownsHtml(hero.playerName || "Unknown", hero);
    } else {
      nameTd.innerText = hero.playerName || "Unknown";
    }

    const seedTd = document.createElement("td");
    seedTd.dataset.label = "Seed";
    seedTd.innerText = hero.seed || "-";

    const dateTd = document.createElement("td");
    dateTd.dataset.label = "Date";
    dateTd.innerText = formatHeroDate(hero.createdAt);

    const deckTd = document.createElement("td");
    deckTd.dataset.label = "Deck";
    deckTd.innerText = hero.deck || "-";

    const levelTd = document.createElement("td");
    levelTd.dataset.label = "Level";
    levelTd.innerText = hero.hasExplicitDeckLevel ? String(hero.deckLevel || 1) : "-";

    const powerTd = document.createElement("td");
    powerTd.dataset.label = "Power";
    powerTd.innerText = hero.startingPower || "-";

    tr.appendChild(nameTd);
    tr.appendChild(seedTd);
    tr.appendChild(dateTd);
    tr.appendChild(deckTd);
    tr.appendChild(levelTd);
    tr.appendChild(powerTd);
    bodyEl.appendChild(tr);
  });

  noteEl.innerText = leaderboardRemoteEnabled()
    ? "Connected to online leaderboard."
    : "Showing local leaderboard only. Configure Supabase in js/leaderboard.js for global tracking.";
}

document.getElementById("heroes-back-btn")?.addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = "index.html?view=play";
});

renderHeroesBoard();
