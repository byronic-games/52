(function () {
  if (!("serviceWorker" in navigator)) return;

  const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
  let waitingWorker = null;
  let refreshing = false;
  let updatePrompt = null;

  function createUpdatePrompt() {
    if (updatePrompt) return updatePrompt;

    const prompt = document.createElement("div");
    prompt.setAttribute("role", "status");
    prompt.setAttribute("aria-live", "polite");
    prompt.style.position = "fixed";
    prompt.style.left = "16px";
    prompt.style.right = "16px";
    prompt.style.bottom = "calc(18px + env(safe-area-inset-bottom, 0px))";
    prompt.style.zIndex = "99999";
    prompt.style.display = "none";
    prompt.style.alignItems = "center";
    prompt.style.justifyContent = "space-between";
    prompt.style.gap = "12px";
    prompt.style.padding = "12px 14px";
    prompt.style.border = "1px solid rgba(90, 226, 255, 0.35)";
    prompt.style.borderRadius = "14px";
    prompt.style.background = "rgba(18, 10, 27, 0.96)";
    prompt.style.boxShadow = "0 14px 40px rgba(0, 0, 0, 0.45), 0 0 24px rgba(90, 226, 255, 0.22)";
    prompt.style.color = "#f5edff";
    prompt.style.fontFamily = "inherit";

    const text = document.createElement("span");
    text.textContent = "New version available";
    text.style.fontSize = "14px";
    text.style.fontWeight = "800";
    text.style.letterSpacing = "0";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Update";
    button.style.border = "0";
    button.style.borderRadius = "10px";
    button.style.padding = "10px 14px";
    button.style.background = "#c8ff3d";
    button.style.color = "#1a2208";
    button.style.fontFamily = "inherit";
    button.style.fontSize = "13px";
    button.style.fontWeight = "900";
    button.style.letterSpacing = "0";
    button.addEventListener("click", () => {
      if (!waitingWorker) return;
      button.disabled = true;
      button.textContent = "Updating";
      waitingWorker.postMessage({ type: "SKIP_WAITING", confirmed: true });
    });

    prompt.append(text, button);
    document.body.appendChild(prompt);
    updatePrompt = prompt;
    return prompt;
  }

  function showUpdatePrompt(worker) {
    waitingWorker = worker;
    const prompt = createUpdatePrompt();
    prompt.style.display = "flex";
  }

  function watchRegistration(registration) {
    if (registration.waiting && navigator.serviceWorker.controller) {
      showUpdatePrompt(registration.waiting);
    }

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdatePrompt(newWorker);
        }
      });
    });

    window.setInterval(() => {
      registration.update().catch(() => {});
    }, UPDATE_CHECK_INTERVAL_MS);
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then((registration) => {
        watchRegistration(registration);
        return registration.update();
      })
      .catch(() => {});
  });
}());
