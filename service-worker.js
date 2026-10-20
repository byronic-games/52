const CACHE_VERSION = "20261020b";
const CACHE_NAME = `byronic-52-${CACHE_VERSION}`;
const GAME_ASSET_VERSION = "20261020b";

const CARD_SUITS = ["clubs", "diamonds", "hearts", "spades"];
const CARD_RANKS = ["ace", "02", "03", "04", "05", "06", "07", "08", "09", "10", "jack", "queen", "king"];
const CARD_FACE_ASSETS = ["LargeCards", "SmallCards"].flatMap((folder) => [
  ...CARD_SUITS.flatMap((suit) => CARD_RANKS.map((rank) => `./images/${folder}/${suit}_${rank}.png`)),
  `./images/${folder}/Joker1.png`,
  `./images/${folder}/Joker2.png`,
]);
const PIXEL_CARD_FACE_ASSETS = [0, 14, 28, 42].flatMap((suitOffset) =>
  Array.from({ length: 13 }, (_, rankIndex) =>
    `./images/PixelCards/${String(suitOffset + rankIndex + 1).padStart(2, "0")}_kerenel_Cards.png`,
  ),
);
const CARD_BACK_ASSETS = [
  ...Array.from({ length: 8 }, (_, index) => `./images/LargeCards/back${String(index + 1).padStart(2, "0")}.png`),
  "./images/SmallCards/back01.png",
  "./images/SmallCards/back02.png",
];

const APP_SHELL = [
  "./",
  "./index.html",
  "./game.html",
  "./shop.html",
  "./shop-index.html",
  "./text-index.html",
  "./daily.html",
  "./settings.html",
  "./profile.html",
  "./heroes.html",
  "./cheat-index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./images/52logo.png",
  "./images/card_backs/rocco_birthday.png",
  "./images/icons/apple-touch-icon.png",
  "./images/icons/icon-192.png",
  "./images/icons/icon-512.png",
  "./images/icons/icon-maskable-512.png",
  `./app-shell.css?v=${GAME_ASSET_VERSION}`,
  `./intro.css?v=${GAME_ASSET_VERSION}`,
  `./styles.css?v=${GAME_ASSET_VERSION}`,
  "./daily.css",
  "./settings.css",
  `./profile.css?v=${GAME_ASSET_VERSION}`,
  "./heroes.css",
  `./shop.css?v=${GAME_ASSET_VERSION}`,
  `./shop-index.css?v=${GAME_ASSET_VERSION}`,
  `./text-index.css?v=${GAME_ASSET_VERSION}`,
  `./cheat-index.css?v=${GAME_ASSET_VERSION}`,
  "./cheat-catalog.csv",
  `./js/constants.js?v=${GAME_ASSET_VERSION}`,
  `./js/app-strings.js?v=${GAME_ASSET_VERSION}`,
  `./js/text-catalog-overrides.js?v=${GAME_ASSET_VERSION}`,
  `./js/text-catalog.js?v=${GAME_ASSET_VERSION}`,
  `./js/app-shell.js?v=${GAME_ASSET_VERSION}`,
  `./js/storage.js?v=${GAME_ASSET_VERSION}`,
  `./js/item-stats.js?v=${GAME_ASSET_VERSION}`,
  `./js/cosmetics.js?v=${GAME_ASSET_VERSION}`,
  `./js/card-back-catalog-overrides.js?v=${GAME_ASSET_VERSION}`,
  `./js/state.js?v=${GAME_ASSET_VERSION}`,
  `./js/powers.js?v=${GAME_ASSET_VERSION}`,
  `./js/cheats.js?v=${GAME_ASSET_VERSION}`,
  `./js/cheat-balance-overrides.js?v=${GAME_ASSET_VERSION}`,
  `./js/apply-cheat-balance-overrides.js?v=${GAME_ASSET_VERSION}`,
  `./js/logic.js?v=${GAME_ASSET_VERSION}`,
  `./js/render.js?v=${GAME_ASSET_VERSION}`,
  `./js/input.js?v=${GAME_ASSET_VERSION}`,
  `./js/main.js?v=${GAME_ASSET_VERSION}`,
  `./js/fullscreen.js?v=${GAME_ASSET_VERSION}`,
  `./js/daily.js?v=${GAME_ASSET_VERSION}`,
  `./js/daily-page.js?v=${GAME_ASSET_VERSION}`,
  "./js/settings.js",
  `./js/profile-page.js?v=${GAME_ASSET_VERSION}`,
  `./js/shop.js?v=${GAME_ASSET_VERSION}`,
  `./js/shop-index.js?v=${GAME_ASSET_VERSION}`,
  `./js/text-index.js?v=${GAME_ASSET_VERSION}`,
  `./js/collection.js?v=${GAME_ASSET_VERSION}`,
  "./js/heroes.js",
  `./js/leaderboard.js?v=${GAME_ASSET_VERSION}`,
  `./js/cheat-index.js?v=${GAME_ASSET_VERSION}`,
  `./js/pwa-update.js?v=${GAME_ASSET_VERSION}`,
  ...CARD_FACE_ASSETS,
  ...PIXEL_CARD_FACE_ASSETS,
  ...CARD_BACK_ASSETS,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith("byronic-52-") && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }) || caches.match("./index.html")),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") return response;
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      });
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING" && event.data?.confirmed) {
    self.skipWaiting();
  }
});
