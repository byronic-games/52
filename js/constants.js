const SUITS = ["♠", "♥", "♦", "♣"];
    const SUIT_NAMES = {
      "♠": "spades",
      "♥": "hearts",
      "♦": "diamonds",
      "♣": "clubs",
    };

    const RANKS = [
      { r: "A", v: 1 },
      { r: "2", v: 2 },
      { r: "3", v: 3 },
      { r: "4", v: 4 },
      { r: "5", v: 5 },
      { r: "6", v: 6 },
      { r: "7", v: 7 },
      { r: "8", v: 8 },
      { r: "9", v: 9 },
      { r: "10", v: 10 },
      { r: "J", v: 11 },
      { r: "Q", v: 12 },
      { r: "K", v: 13 },
    ];

    const BEST_SCORE_KEY = "hl_prototype_best_score";
    const BEST_SCORES_BY_MODE_KEY = "hl_prototype_best_scores_by_mode";
    const BEST_SCORES_SCORING_MODE_KEY = "hl_prototype_best_scores_scoring_mode";
    const CARD_STATS_KEY = "hl_prototype_card_stats";
const CARD_BACK_STATUS_KEY = "hl_prototype_card_back_status";
const RUN_DEBUG_LOG_KEY = "hl_prototype_run_debug_log";
const GAME_STATE_SNAPSHOT_KEY = "hl_prototype_game_state_snapshot";
    const SETTINGS_RETURN_URL_KEY = "hl_prototype_settings_return_url";
    const SELECTED_DECK_KEY = "hl_prototype_selected_deck";
    const SELECTED_LEVEL_KEY = "hl_prototype_selected_level";
    const DECK_WINS_KEY = "hl_prototype_deck_wins";
    const DECK_LEVEL_CLEARS_KEY = "hl_prototype_deck_level_clears";
    const UNLOCK_DECKS_KEY = "hl_prototype_unlock_decks";
    const UNLOCK_ALL_KEY = "hl_prototype_unlock_all";
    const GUESS_BUTTON_ORDER_KEY = "hl_prototype_guess_button_order";
    const NUDGE_BUTTON_ORDER_KEY = "hl_prototype_nudge_button_order";
    const RED_DECK_DEBUG_UNLOCK_KEY = "hl_prototype_red_deck_debug_unlock";
    const PROFILE_STATS_KEY = "hl_prototype_profile_stats";
    const EXPERIENCE_KEY = "hl_prototype_experience";
    const EXPERIENCE_DISPLAY_KEY = "hl_prototype_experience_display";
    const CARD_BACK_COSMETICS_KEY = "hl_prototype_card_back_cosmetics";
    const SELECTED_CARD_BACK_COSMETIC_KEY = "hl_prototype_selected_card_back_cosmetic";
    const DISCOVERED_CHEATS_KEY = "hl_prototype_discovered_cheats";
    const DISCOVERED_POWERS_KEY = "hl_prototype_discovered_powers";
    const DISCOVERED_JOKERS_KEY = "hl_prototype_discovered_jokers";
    const RUN_SEED_KEY = "hl_prototype_last_seed";
    const META_PROGRESSION_KEY = "hl_prototype_meta_progression";
    const GAME_VERSION = "v0.1";
    const DEFAULT_LEVEL_NUMBER = 1;

    const CHEAT_RARITY = {
      common: 50,
      uncommon: 30,
      rare: 20,
      legendary: 0,
    };

const CHEAT_UNLOCKS_KEY = "hl_prototype_cheat_unlocks";;
const TUTORIAL_COMPLETED_KEY = "hl_prototype_tutorial_completed_v1";
const TUTORIAL_FORCE_REPLAY_KEY = "hl_prototype_tutorial_force_replay_v1";
const VISUAL_THEME_KEY = "hl_prototype_visual_theme";

const YELLOW_JOKERS = [
  {
    id: "yellow_joker_tearless",
    name: "Tearless",
    shortName: "Tearless",
    icon: "T",
    unlockLevel: 1,
    description: "Hides one torn corner from an unseen card for this run.",
  },
  {
    id: "yellow_joker_nudgeless",
    name: "Nudgeless",
    shortName: "Nudge-less",
    icon: "N",
    unlockLevel: 2,
    description: "Removes all banked Nudge charges.",
  },
  {
    id: "yellow_joker_cheatless",
    name: "Cheatless",
    shortName: "Cheat-less",
    icon: "C",
    unlockLevel: 3,
    description: "Removes all banked Cheat cards.",
  },
  {
    id: "yellow_joker_powerless",
    name: "Powerless",
    shortName: "Power-less",
    icon: "P",
    unlockLevel: 4,
    description: "Removes persistent powers and clears armed power/cheat effects.",
  },
  {
    id: "yellow_joker_timeless",
    name: "Timeless",
    shortName: "Timeless",
    icon: "T",
    unlockLevel: 2,
    description: "Shuffles recently revealed playing cards back into the deck.",
  },
  {
    id: "yellow_joker_rong",
    name: "RONG",
    shortName: "RONG",
    icon: "R",
    unlockLevel: 1,
    description: "For the rest of this run, Higher means Lower and Lower means Higher.",
  },
  {
    id: "yellow_joker_gridless",
    name: "Gridless",
    shortName: "Gridless",
    icon: "G",
    unlockLevel: 1,
    description: "Clears the visible found-card grid without changing cards cleared.",
  },
];

function mulberry32(a) {
      return function () {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

function stringToSeedNumber(str) {
      let h = 1779033703 ^ str.length;
      for (let i = 0; i < str.length; i += 1) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return h >>> 0;
    }

function randomSeedString(length = 6) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let out = "";
      for (let i = 0; i < length; i += 1) {
        out += chars[Math.floor(Math.random() * chars.length)];
      }
      return out;
    }

function normalizeSeed(seed) {
      return String(seed || "").trim().toUpperCase();
    }

function seededShuffle(array, seedString) {
      const rng = mulberry32(stringToSeedNumber(seedString));
      for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }

function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

function getCardId(suit, rank) {
      return `${SUIT_NAMES[suit]}_${rank}`;
    }
