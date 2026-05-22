(function () {
  if (typeof CHEATS === "undefined" || !Array.isArray(CHEATS)) return;

  const editableKeys = [
    "name",
    "rarity",
    "unlockAt",
    "included",
    "stacking",
    "weight",
    "poolExcludedIfPowerOwned",
  ];

  function parseBool(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
    return null;
  }

  function parseNumber(value, integerOnly = false) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const parsed = integerOnly ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          field += '"';
          i += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }

    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function csvToOverrides(csvText) {
    const rows = parseCsv(csvText).filter((row) => row.some((field) => String(field).trim()));
    if (rows.length < 2) return null;

    const headers = rows[0].map((header) => String(header).trim());
    const overrides = {};

    rows.slice(1).forEach((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ?? "";
      });

      const id = String(record.id || "").trim();
      if (!id) return;

      const entry = {};
      editableKeys.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(record, key)) return;
        const raw = String(record[key] ?? "").trim();
        if (!raw) return;

        if (key === "included") {
          const parsed = parseBool(raw);
          if (parsed !== null) entry[key] = parsed;
          return;
        }

        if (key === "unlockAt") {
          const parsed = parseNumber(raw, true);
          if (parsed !== null) entry[key] = parsed;
          return;
        }

        if (key === "weight") {
          const parsed = parseNumber(raw);
          if (parsed !== null) entry[key] = parsed;
          return;
        }

        entry[key] = raw;
      });

      if (Object.prototype.hasOwnProperty.call(record, "description")) {
        const description = String(record.description || "").trim();
        if (description) entry.description = description;
      }

      if (Object.keys(entry).length) {
        overrides[id] = entry;
      }
    });

    return overrides;
  }

  function loadCatalogOverridesSync() {
    const path = window.CHEAT_CATALOG_CSV_PATH || "tools/cheat-catalog.csv";
    try {
      const request = new XMLHttpRequest();
      request.open("GET", path, false);
      request.send(null);

      const loaded = request.status === 0 || (request.status >= 200 && request.status < 300);
      if (!loaded || !request.responseText) return null;
      return csvToOverrides(request.responseText);
    } catch (error) {
      return null;
    }
  }

  function applyOverrides(overrides) {
    if (!overrides) return;

    CHEATS.forEach((cheat) => {
      if (!cheat || !cheat.id) return;
      const override = overrides[cheat.id];
      if (!override) return;

      const previousName = cheat.name;

      editableKeys.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(override, key)) return;
        cheat[key] = override[key];
      });

      if (typeof CHEAT_DESCRIPTIONS !== "undefined" && CHEAT_DESCRIPTIONS) {
        if (
          cheat.name !== previousName &&
          CHEAT_DESCRIPTIONS[previousName] &&
          !CHEAT_DESCRIPTIONS[cheat.name]
        ) {
          CHEAT_DESCRIPTIONS[cheat.name] = CHEAT_DESCRIPTIONS[previousName];
        }

        if (Object.prototype.hasOwnProperty.call(override, "description")) {
          CHEAT_DESCRIPTIONS[cheat.name] = override.description;
        }
      }
    });
  }

  if (typeof CHEAT_BALANCE_OVERRIDES !== "undefined" && CHEAT_BALANCE_OVERRIDES) {
    applyOverrides(CHEAT_BALANCE_OVERRIDES);
  }

  const catalogOverrides = loadCatalogOverridesSync();
  if (catalogOverrides) {
    applyOverrides(catalogOverrides);
    window.CHEAT_CATALOG_SOURCE = "tools/cheat-catalog.csv";
  } else {
    window.CHEAT_CATALOG_SOURCE = "js/cheat-balance-overrides.js";
  }
})();
