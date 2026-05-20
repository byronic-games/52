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
];

function getCardBackCosmeticById(id) {
  return CARD_BACK_COSMETICS.find((cosmetic) => cosmetic.id === id) || CARD_BACK_COSMETICS[0];
}

function getSelectedCardBackCosmetic() {
  return getCardBackCosmeticById(
    typeof loadSelectedCardBackCosmetic === "function" ? loadSelectedCardBackCosmetic() : "classic",
  );
}

function getIncludedCardBackCosmetics() {
  return CARD_BACK_COSMETICS.filter((cosmetic) => cosmetic.included !== false);
}
