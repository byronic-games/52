(function () {
  const tableBody = document.querySelector("#cheat-table tbody");
  const summaryEl = document.getElementById("catalog-summary");
  const searchEl = document.getElementById("cheat-search");
  const csvBtn = document.getElementById("download-csv-btn");
  const resetBtn = document.getElementById("reset-edits-btn");
  const powerReferenceEl = document.getElementById("power-reference-list");
  const powerIdOptionsEl = document.getElementById("power-id-options");

  if (!tableBody || !summaryEl || !searchEl) return;
  if (!Array.isArray(CHEATS)) return;

  const rarityOptions = ["common", "uncommon", "rare", "legendary"];
  const includedOptions = [
    { label: "Yes", value: true },
    { label: "No", value: false },
  ];
  let editableCheats = makeEditableCheats();

  function getCheatDescription(cheat) {
    return CHEAT_DESCRIPTIONS?.[cheat.name] || cheat.description || "";
  }

  function makeEditableCheats() {
    return CHEATS.map((cheat) => ({
      id: cheat.id || "",
      name: cheat.name || "",
      rarity: cheat.rarity || "common",
      unlockAt: Number(cheat.unlockAt || 0),
      included: cheat.included !== false,
      stacking: cheat.stacking || "unique",
      weight: Number.isFinite(cheat.weight) ? cheat.weight : 1,
      poolExcludedIfPowerOwned: cheat.poolExcludedIfPowerOwned || "",
      conditions: toConditionSummary(cheat),
      description: getCheatDescription(cheat),
    }));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toConditionSummary(cheat) {
    const parts = [];

    const unlockAt = Number(cheat.unlockAt || 0);
    if (unlockAt > 0) {
      parts.push(`Meta progression >= ${unlockAt}`);
    } else {
      parts.push("Available from run start");
    }

    if (cheat.included === false) {
      parts.push("Excluded from random pool");
    }

    if (cheat.poolExcludedIfPowerOwned) {
      parts.push(`Excluded when power '${cheat.poolExcludedIfPowerOwned}' is active`);
    }

    const desc = String(getCheatDescription(cheat));
    const restrictionMatch = desc.match(/Can only[^.]*\./i);
    if (restrictionMatch) {
      parts.push(restrictionMatch[0].trim());
    }

    return parts.join(" | ");
  }

  function optionMarkup(options, currentValue) {
    return options
      .map((option) => {
        const value = typeof option === "object" ? option.value : option;
        const label = typeof option === "object" ? option.label : option;
        const selected = String(value) === String(currentValue) ? " selected" : "";
        return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
      })
      .join("");
  }

  function inputMarkup(cheat, field, type = "text", extraClass = "", extraAttributes = "") {
    return `<input class="editor-field ${extraClass}" data-id="${escapeHtml(cheat.id)}" data-field="${field}" type="${type}" value="${escapeHtml(cheat[field])}" ${extraAttributes}>`;
  }

  function rowMarkup(cheat) {
    return `
      <tr>
        <td class="mono id-cell">${escapeHtml(cheat.id)}</td>
        <td class="name-cell">${inputMarkup(cheat, "name")}</td>
        <td class="description-cell">
          <textarea class="editor-field description-field" data-id="${escapeHtml(cheat.id)}" data-field="description">${escapeHtml(cheat.description)}</textarea>
        </td>
        <td>
          <select class="editor-field rarity-select rarity-${escapeHtml(cheat.rarity)}" data-id="${escapeHtml(cheat.id)}" data-field="rarity">
            ${optionMarkup(rarityOptions, cheat.rarity)}
          </select>
        </td>
        <td>${inputMarkup(cheat, "unlockAt", "number", "number-field")}</td>
        <td>
          <select class="editor-field included-select" data-id="${escapeHtml(cheat.id)}" data-field="included">
            ${optionMarkup(includedOptions, cheat.included)}
          </select>
        </td>
        <td>${inputMarkup(cheat, "stacking")}</td>
        <td>${inputMarkup(cheat, "weight", "number", "number-field")}</td>
        <td>${inputMarkup(cheat, "poolExcludedIfPowerOwned", "text", "power-exclude-field", 'list="power-id-options"')}</td>
        <td class="conditions-cell">${escapeHtml(cheat.conditions)}</td>
      </tr>
    `;
  }

  function toCsvRow(values) {
    return values
      .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
      .join(",");
  }

  function downloadCsv() {
    const header = toCsvRow([
      "id",
      "name",
      "rarity",
      "unlockAt",
      "included",
      "stacking",
      "weight",
      "poolExcludedIfPowerOwned",
      "conditions",
      "description",
    ]);

    const lines = editableCheats.map((cheat) =>
      toCsvRow([
        cheat.id,
        cheat.name,
        cheat.rarity,
        cheat.unlockAt ?? 0,
        !!cheat.included,
        cheat.stacking || "unique",
        Number.isFinite(Number(cheat.weight)) ? cheat.weight : 1,
        cheat.poolExcludedIfPowerOwned || "",
        cheat.conditions || "",
        cheat.description || "",
      ])
    );

    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cheat-catalog.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function updateSummary(visibleCheats) {
    const byRarity = visibleCheats.reduce((acc, cheat) => {
      const key = cheat.rarity || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const poolCounts = editableCheats.reduce(
      (acc, cheat) => {
        if (cheat.included === false) {
          acc.excluded += 1;
        } else {
          acc.included += 1;
        }
        return acc;
      },
      { included: 0, excluded: 0 },
    );

    const rarityText = Object.entries(byRarity)
      .map(([rarity, count]) => `${rarity}: ${count}`)
      .join(" | ");

    summaryEl.innerText = `Showing ${visibleCheats.length} / ${editableCheats.length} cheats. Pool: ${poolCounts.included} included, ${poolCounts.excluded} excluded${rarityText ? ` (${rarityText})` : ""}.`;
  }

  function getVisibleCheats(filterText) {
    const filter = String(filterText || "").trim().toLowerCase();
    return editableCheats.filter((cheat) => {
      if (!filter) return true;
      const haystack = [
        cheat.id,
        cheat.name,
        cheat.rarity,
        cheat.stacking,
        cheat.poolExcludedIfPowerOwned,
        cheat.description,
        cheat.conditions,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(filter);
    });
  }

  function render(filterText) {
    const visibleCheats = getVisibleCheats(filterText);
    tableBody.innerHTML = visibleCheats.map(rowMarkup).join("");
    updateSummary(visibleCheats);
  }

  function coerceFieldValue(field, rawValue) {
    if (field === "included") return rawValue === "true";
    if (field === "unlockAt") return Math.max(0, Number.parseInt(rawValue, 10) || 0);
    if (field === "weight") {
      const value = Number.parseFloat(rawValue);
      return Number.isFinite(value) ? value : 1;
    }
    return String(rawValue ?? "");
  }

  function renderPowerReference() {
    const powers = typeof POWERS !== "undefined" && Array.isArray(POWERS) ? POWERS : [];
    if (!powers.length) return;
    if (powerReferenceEl) {
      powerReferenceEl.innerHTML = powers.map((power) => `
        <div class="power-reference-item">
          <code>${escapeHtml(power.id)}</code>
          <span>${escapeHtml(power.name)}</span>
        </div>
      `).join("");
    }
    if (powerIdOptionsEl) {
      powerIdOptionsEl.innerHTML = powers.map((power) =>
        `<option value="${escapeHtml(power.id)}">${escapeHtml(power.name)}</option>`
      ).join("");
    }
  }

  tableBody.addEventListener("input", (event) => {
    const target = event.target;
    if (!target?.matches?.(".editor-field")) return;
    const cheat = editableCheats.find((entry) => entry.id === target.dataset.id);
    if (!cheat) return;
    cheat[target.dataset.field] = coerceFieldValue(target.dataset.field, target.value);
  });

  tableBody.addEventListener("change", (event) => {
    const target = event.target;
    if (!target?.matches?.(".editor-field")) return;
    const cheat = editableCheats.find((entry) => entry.id === target.dataset.id);
    if (!cheat) return;
    cheat[target.dataset.field] = coerceFieldValue(target.dataset.field, target.value);
    if (target.dataset.field === "rarity") {
      target.className = `editor-field rarity-select rarity-${cheat.rarity}`;
    }
    updateSummary(getVisibleCheats(searchEl.value));
  });

  searchEl.addEventListener("input", () => {
    render(searchEl.value);
  });

  csvBtn?.addEventListener("click", downloadCsv);

  resetBtn?.addEventListener("click", () => {
    editableCheats = makeEditableCheats();
    render(searchEl.value);
  });

  renderPowerReference();
  render("");
})();
