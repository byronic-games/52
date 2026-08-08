(function () {
  // Inside the Capacitor native shell, visualViewport.height has been
  // observed to under-report the true screen height (missing safe-area
  // insets), which shrinks the app below the real screen and pushes safe
  // areas out of sync - notch overlap at the top, a stray native-background
  // gap at the bottom. Plain CSS 100dvh already resolves safe areas
  // correctly there, so skip the JS override entirely in that context.
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform()) {
    return;
  }

  let viewportTicking = false;

  function applyViewportHeightVar() {
    if (viewportTicking) return;
    viewportTicking = true;
    window.requestAnimationFrame(() => {
      viewportTicking = false;
      const viewport = window.visualViewport;
      const height =
        Math.floor((viewport && viewport.height) || window.innerHeight || document.documentElement.clientHeight);
      if (!height) return;
      document.documentElement.style.setProperty("--app-height", `${height}px`);
    });
  }

  applyViewportHeightVar();
  window.addEventListener("resize", applyViewportHeightVar, { passive: true });
  window.addEventListener("orientationchange", applyViewportHeightVar, { passive: true });
  window.addEventListener("pageshow", applyViewportHeightVar, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", applyViewportHeightVar, { passive: true });
  }
})();
