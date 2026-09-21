const CARD_BACK_COSMETICS = [
  {
    id: "classic",
    name: "Classic",
    description: "The standard 52! patterned back.",
    cost: 0,
    included: true,
    previewClass: "card-back-cosmetic-classic",
  },
  {
    id: "midnight_stars",
    name: "Midnight Stars",
    description: "A dark starfield back, ready for final art.",
    cost: 120,
    included: true,
    previewClass: "card-back-cosmetic-midnight-stars",
  },
  {
    id: "neon_table",
    name: "Neon Table",
    description: "A bright casino-glow test back.",
    cost: 180,
    included: true,
    previewClass: "card-back-cosmetic-neon-table",
  },
  {
    id: "royal_felt",
    name: "Royal Felt",
    description: "A green felt test back for texture checks.",
    cost: 240,
    included: true,
    previewClass: "card-back-cosmetic-royal-felt",
  },
  {
    id: "oll_logo",
    name: "OLL Logo",
    description: "OLL logo card back.",
    cost: 300,
    included: true,
    previewClass: "card-back-cosmetic-oll-logo",
    image: "images/card_backs/oll_logo.png",
  },
  {
    id: "muse_logo",
    name: "Muse Logo",
    description: "Muse logo card back.",
    cost: 400,
    included: true,
    previewClass: "card-back-cosmetic-muse-logo",
    image: "images/card_backs/muse_logo.png",
  },
  {
    id: "rocco_birthday",
    name: "Rocco Birthday",
    description: "Happy birthday, Rocco!",
    cost: 0,
    included: true,
    hiddenWhenUnowned: true,
    previewClass: "card-back-cosmetic-rocco-birthday",
    image: "images/card_backs/rocco_birthday.png",
  },
];

if (typeof CARD_BACK_CATALOG_OVERRIDES !== "undefined" && CARD_BACK_CATALOG_OVERRIDES) {
  CARD_BACK_COSMETICS.forEach((cosmetic) => {
    const override = CARD_BACK_CATALOG_OVERRIDES[cosmetic.id];
    if (!override) return;
    ["name", "description", "cost", "included", "hiddenWhenUnowned", "image"].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(override, key)) cosmetic[key] = override[key];
    });
  });
  Object.entries(CARD_BACK_CATALOG_OVERRIDES).forEach(([id, override]) => {
    if (!id || CARD_BACK_COSMETICS.some((cosmetic) => cosmetic.id === id)) return;
    CARD_BACK_COSMETICS.push({
      id,
      name: override.name || id,
      description: override.description || "",
      cost: Math.max(0, Number(override.cost) || 0),
      included: override.included !== false,
      hiddenWhenUnowned: !!override.hiddenWhenUnowned,
      image: override.image || "",
    });
  });
}

function getCardBackCosmeticById(id) {
  return CARD_BACK_COSMETICS.find((cosmetic) => cosmetic.id === id) || CARD_BACK_COSMETICS[0];
}

function getSelectedCardBackCosmetic() {
  return getCardBackCosmeticById(
    typeof loadSelectedCardBackCosmetic === "function" ? loadSelectedCardBackCosmetic() : "classic",
  );
}

function getIncludedCardBackCosmetics() {
  const selectedId = typeof loadSelectedCardBackCosmetic === "function" ? loadSelectedCardBackCosmetic() : "classic";
  return CARD_BACK_COSMETICS.filter((cosmetic) => {
    if (cosmetic.included === false) return false;
    if (!cosmetic.hiddenWhenUnowned) return true;
    return cosmetic.id === selectedId || (
      typeof isCardBackCosmeticOwned === "function" && isCardBackCosmeticOwned(cosmetic.id)
    );
  });
}
