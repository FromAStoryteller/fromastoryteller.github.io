// Generated from sources/games/brick-blitz.mjs; edit source and run npm run build:games.

// systems/games/input.js
var Input = {
  initialized: false,
  keyState: {},
  keyPressed: {},
  keyRepeatTimers: {},
  pointerState: {
    active: false,
    pointerId: null,
    pointerType: null,
    clientX: 0,
    clientY: 0,
    gameContainer: null,
    captureElement: null
  },
  // === INTERNAL HELPERS === //
  normalizeKeyCode(code) {
    if (code === "NumpadEnter") {
      return "Enter";
    }
    return code;
  },
  shouldPreventDefault(code) {
    return code === "ArrowUp" || code === "ArrowDown" || code === "ArrowLeft" || code === "ArrowRight" || code === "Space" || code === "Enter";
  },
  handleKeyDown(e) {
    const code = this.normalizeKeyCode(e.code);
    if (this.shouldPreventDefault(code)) {
      e.preventDefault();
    }
    if (!this.keyState[code]) {
      this.keyPressed[code] = true;
      this.keyRepeatTimers[code] = {
        nextTriggerTime: performance.now() + 300
      };
    }
    this.keyState[code] = true;
  },
  handleKeyUp(e) {
    const code = this.normalizeKeyCode(e.code);
    if (this.shouldPreventDefault(code)) {
      e.preventDefault();
    }
    this.keyState[code] = false;
    delete this.keyRepeatTimers[code];
  },
  isTouchPointerType(pointerType) {
    return pointerType === "touch" || pointerType === "pen";
  },
  getPlayableCanvasFromTarget(target) {
    if (!(target instanceof HTMLCanvasElement)) {
      return null;
    }
    const gameContainer = target.closest(".game-canvas");
    if (!gameContainer) {
      return null;
    }
    return {
      canvas: target,
      gameContainer
    };
  },
  handlePointerDown(e) {
    if (!this.isTouchPointerType(e.pointerType)) {
      return;
    }
    if (this.pointerState.active) {
      return;
    }
    const playable = this.getPlayableCanvasFromTarget(e.target);
    if (!playable) {
      return;
    }
    this.pointerState.active = true;
    this.pointerState.pointerId = e.pointerId;
    this.pointerState.pointerType = e.pointerType;
    this.pointerState.clientX = e.clientX;
    this.pointerState.clientY = e.clientY;
    this.pointerState.gameContainer = playable.gameContainer;
    this.pointerState.captureElement = playable.canvas;
    try {
      playable.canvas.setPointerCapture(e.pointerId);
    } catch {
    }
    e.preventDefault();
  },
  handlePointerMove(e) {
    if (!this.pointerState.active || e.pointerId !== this.pointerState.pointerId) {
      return;
    }
    this.pointerState.clientX = e.clientX;
    this.pointerState.clientY = e.clientY;
    e.preventDefault();
  },
  handlePointerEnd(e) {
    if (!this.pointerState.active || e.pointerId !== this.pointerState.pointerId) {
      return;
    }
    this.pointerState.clientX = e.clientX;
    this.pointerState.clientY = e.clientY;
    const captureElement = this.pointerState.captureElement;
    try {
      if (captureElement && captureElement.hasPointerCapture?.(e.pointerId)) {
        captureElement.releasePointerCapture(e.pointerId);
      }
    } catch {
    }
    this.pointerState.active = false;
    this.pointerState.pointerId = null;
    this.pointerState.pointerType = null;
    this.pointerState.gameContainer = null;
    this.pointerState.captureElement = null;
    e.preventDefault();
  },
  prepareTouchGameCanvases() {
    document.querySelectorAll(".game-canvas canvas").forEach((canvas) => {
      canvas.style.touchAction = "none";
    });
  },
  addTouchPauseButtons() {
    document.querySelectorAll(".game-canvas").forEach((gameContainer) => {
      if (gameContainer.querySelector(".game-touch-pause-button")) {
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "game-touch-pause-button";
      button.setAttribute("aria-label", "Pause game");
      button.setAttribute("title", "Pause");
      button.innerHTML = `
                <span class="game-touch-pause-icon" aria-hidden="true">
                    <span></span>
                    <span></span>
                </span>
            `;
      button.addEventListener(
        "pointerdown",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.triggerPress("Escape");
        },
        { passive: false }
      );
      gameContainer.appendChild(button);
    });
  },
  resolveGameContainer(containerOrId) {
    if (typeof containerOrId === "string") {
      return document.getElementById(containerOrId);
    }
    if (containerOrId instanceof HTMLElement) {
      return containerOrId;
    }
    return null;
  },
  getLogicalCanvasSize(canvas, rect2) {
    const inlineWidth = canvas.style.width?.trim() || "";
    const inlineHeight = canvas.style.height?.trim() || "";
    const parsedWidth = inlineWidth.endsWith("px") ? Number.parseFloat(inlineWidth) : NaN;
    const parsedHeight = inlineHeight.endsWith("px") ? Number.parseFloat(inlineHeight) : NaN;
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const logicalWidth = Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : Math.max(1, canvas.width / pixelRatio || rect2.width);
    const logicalHeight = Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : Math.max(1, canvas.height / pixelRatio || rect2.height);
    return {
      width: logicalWidth,
      height: logicalHeight
    };
  },
  // === SETUP === //
  init() {
    if (this.initialized) {
      this.prepareTouchGameCanvases();
      this.addTouchPauseButtons();
      return;
    }
    this.initialized = true;
    window.addEventListener(
      "keydown",
      (e) => this.handleKeyDown(e),
      { passive: false }
    );
    window.addEventListener(
      "keyup",
      (e) => this.handleKeyUp(e),
      { passive: false }
    );
    window.addEventListener(
      "pointerdown",
      (e) => this.handlePointerDown(e),
      { passive: false }
    );
    window.addEventListener(
      "pointermove",
      (e) => this.handlePointerMove(e),
      { passive: false }
    );
    window.addEventListener(
      "pointerup",
      (e) => this.handlePointerEnd(e),
      { passive: false }
    );
    window.addEventListener(
      "pointercancel",
      (e) => this.handlePointerEnd(e),
      { passive: false }
    );
    this.prepareTouchGameCanvases();
    this.addTouchPauseButtons();
  },
  // === PUBLIC KEYBOARD HELPERS === //
  isDown(code) {
    return !!this.keyState[code];
  },
  wasPressed(code) {
    return !!this.keyPressed[code];
  },
  wasPressedOrRepeated(code, initialDelay = 300, repeatInterval = 60) {
    if (this.wasPressed(code)) {
      if (this.keyRepeatTimers[code]) {
        this.keyRepeatTimers[code].nextTriggerTime = performance.now() + initialDelay;
      }
      return true;
    }
    if (!this.isDown(code)) {
      return false;
    }
    const timer = this.keyRepeatTimers[code];
    if (!timer) {
      return false;
    }
    const now = performance.now();
    if (now >= timer.nextTriggerTime) {
      timer.nextTriggerTime = now + repeatInterval;
      return true;
    }
    return false;
  },
  triggerPress(code) {
    const normalizedCode = this.normalizeKeyCode(code);
    this.keyPressed[normalizedCode] = true;
  },
  // === PUBLIC TOUCH / POINTER HELPERS === //
  isTouchActive() {
    return this.pointerState.active && this.isTouchPointerType(this.pointerState.pointerType);
  },
  getPointerPosition(containerOrId) {
    if (!this.isTouchActive()) {
      return null;
    }
    const gameContainer = this.resolveGameContainer(containerOrId);
    if (!gameContainer || gameContainer !== this.pointerState.gameContainer) {
      return null;
    }
    const canvas = gameContainer.querySelector("canvas");
    if (!canvas) {
      return null;
    }
    const rect2 = canvas.getBoundingClientRect();
    if (rect2.width <= 0 || rect2.height <= 0) {
      return null;
    }
    const logicalSize = this.getLogicalCanvasSize(canvas, rect2);
    const x = (this.pointerState.clientX - rect2.left) * (logicalSize.width / rect2.width);
    const y = (this.pointerState.clientY - rect2.top) * (logicalSize.height / rect2.height);
    return {
      x,
      y,
      inside: this.pointerState.clientX >= rect2.left && this.pointerState.clientX <= rect2.right && this.pointerState.clientY >= rect2.top && this.pointerState.clientY <= rect2.bottom
    };
  },
  clearPressed() {
    for (const code in this.keyPressed) {
      delete this.keyPressed[code];
    }
  }
};

// systems/games/audio.js
var AudioManager = {
  sounds: {},
  soundEnabled: true,
  masterVolume: 1,
  loadSounds(soundMap) {
    this.sounds = {};
    for (const key in soundMap) {
      this.sounds[key] = loadSound(soundMap[key]);
    }
    return this.sounds;
  },
  setSoundEnabled(enabled) {
    this.soundEnabled = enabled;
  },
  setMasterVolume(volumePercent) {
    const clamped = Math.max(0, Math.min(100, volumePercent));
    this.masterVolume = clamped / 100;
  },
  play(sound, baseVolume = 1) {
    if (!this.soundEnabled) return;
    if (!sound || !sound.isLoaded()) return;
    const finalVolume = Math.max(0, Math.min(1, baseVolume * this.masterVolume));
    sound.setVolume(finalVolume);
    sound.play();
  },
  stopAll() {
    for (const key in this.sounds) {
      const sound = this.sounds[key];
      if (sound && sound.isLoaded()) {
        sound.stop();
      }
    }
  }
};

// systems/games/canvas.js
var GAME_ASPECT_WIDTH = 16;
var GAME_ASPECT_HEIGHT = 9;
var GAME_ASPECT_RATIO = GAME_ASPECT_WIDTH / GAME_ASPECT_HEIGHT;
var MAX_EXPANDED_PIXEL_DENSITY = 3;
var MAX_EXPANDED_BACKING_WIDTH = 2560;
var MAX_EXPANDED_BACKING_HEIGHT = 1440;
var CanvasManager = {
  managers: /* @__PURE__ */ new Map(),
  fullscreenState: /* @__PURE__ */ new WeakMap(),
  resolveContainer(containerOrId) {
    if (typeof containerOrId === "string") {
      return document.getElementById(containerOrId);
    }
    if (containerOrId instanceof HTMLElement) {
      return containerOrId;
    }
    return null;
  },
  getContainer(containerId) {
    return this.resolveContainer(containerId);
  },
  getFrame(containerOrId) {
    const container = this.resolveContainer(containerOrId);
    if (!container) {
      return null;
    }
    return container.closest(".game-shell-frame") || container;
  },
  getDimensions(containerOrId) {
    const container = this.resolveContainer(containerOrId);
    if (!container) {
      return { width: 1, height: 1 };
    }
    const width2 = Math.max(1, Math.round(container.clientWidth));
    const height2 = Math.max(1, Math.round(width2 / GAME_ASPECT_RATIO));
    return { width: width2, height: height2 };
  },
  createResponsive(containerId) {
    const container = this.getContainer(containerId);
    if (!container) {
      throw new Error(`Canvas container not found: ${containerId}`);
    }
    this.prepareDisplay(containerId);
    const { width: width2, height: height2 } = this.getDimensions(container);
    const canvas = createCanvas(width2, height2);
    canvas.parent(containerId);
    this.observeContainer(containerId);
    return canvas;
  },
  resizeResponsive(containerId) {
    const container = this.getContainer(containerId);
    if (!container || typeof resizeCanvas !== "function") {
      return;
    }
    if (this.isFullscreen(container)) {
      return;
    }
    const { width: width2, height: height2 } = this.getDimensions(container);
    const manager = this.managers.get(containerId);
    if (manager && manager.lastWidth === width2 && manager.lastHeight === height2) {
      return;
    }
    resizeCanvas(width2, height2);
    if (manager) {
      manager.lastWidth = width2;
      manager.lastHeight = height2;
    }
  },
  prepareDisplay(containerId) {
    const container = this.getContainer(containerId);
    if (!container || container.dataset.gameDisplayReady === "true") {
      return;
    }
    container.dataset.gameDisplayReady = "true";
    this.addRotateOverlay(containerId);
  },
  addRotateOverlay(containerId) {
    const container = this.getContainer(containerId);
    if (!container || container.querySelector(".game-rotate-overlay")) {
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "game-rotate-overlay";
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `
            <div class="game-rotate-overlay-inner">
                <span class="game-rotate-icon" aria-hidden="true">\u21BB</span>
                <strong>Rotate your device to play</strong>
                <p>Turn your device sideways for the best game experience.</p>
            </div>
        `;
    container.appendChild(overlay);
  },
  getViewportDimensions() {
    const viewport = window.visualViewport;
    return {
      width: Math.max(
        1,
        Math.floor(viewport?.width || window.innerWidth || document.documentElement.clientWidth)
      ),
      height: Math.max(
        1,
        Math.floor(viewport?.height || window.innerHeight || document.documentElement.clientHeight)
      )
    };
  },
  getLargestAspectFit(viewportWidth, viewportHeight) {
    let width2 = viewportWidth;
    let height2 = Math.round(width2 / GAME_ASPECT_RATIO);
    if (height2 > viewportHeight) {
      height2 = viewportHeight;
      width2 = Math.round(height2 * GAME_ASPECT_RATIO);
    }
    return {
      width: Math.max(1, width2),
      height: Math.max(1, height2)
    };
  },
  getCanvasLogicalSize(container, renderDensity = 1) {
    const canvas = container?.querySelector("canvas");
    if (!canvas) {
      return null;
    }
    const inlineWidth = canvas.style.width?.trim() || "";
    const inlineHeight = canvas.style.height?.trim() || "";
    const parsedWidth = inlineWidth.endsWith("px") ? Number.parseFloat(inlineWidth) : NaN;
    const parsedHeight = inlineHeight.endsWith("px") ? Number.parseFloat(inlineHeight) : NaN;
    const safeDensity = Math.max(1, renderDensity || 1);
    return {
      width: Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : Math.max(1, canvas.width / safeDensity),
      height: Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : Math.max(1, canvas.height / safeDensity)
    };
  },
  getExpandedPixelDensity({
    displayWidth,
    displayHeight,
    logicalWidth,
    logicalHeight,
    devicePixelRatio = 1,
    embeddedDensity = 1
  }) {
    const safeLogicalWidth = Math.max(1, logicalWidth || 1);
    const safeLogicalHeight = Math.max(1, logicalHeight || 1);
    const safeDevicePixelRatio = Math.max(1, devicePixelRatio || 1);
    const safeEmbeddedDensity = Math.max(1, embeddedDensity || 1);
    const displayScale = Math.max(
      Math.max(1, displayWidth || 1) / safeLogicalWidth,
      Math.max(1, displayHeight || 1) / safeLogicalHeight
    );
    const desiredDensity = displayScale * safeDevicePixelRatio;
    const cappedDensity = Math.min(
      MAX_EXPANDED_PIXEL_DENSITY,
      MAX_EXPANDED_BACKING_WIDTH / safeLogicalWidth,
      MAX_EXPANDED_BACKING_HEIGHT / safeLogicalHeight
    );
    const roundedDensity = Math.ceil(
      Math.min(desiredDensity, cappedDensity) * 4
    ) / 4;
    return Math.max(safeEmbeddedDensity, roundedDensity);
  },
  getCurrentPixelDensity() {
    if (typeof pixelDensity !== "function") {
      return Math.max(1, window.devicePixelRatio || 1);
    }
    return Math.max(1, Number(pixelDensity()) || 1);
  },
  applyExpandedRenderDensity(container, display) {
    const frame = this.getFrame(container);
    const state = frame ? this.fullscreenState.get(frame) : null;
    if (!state || typeof pixelDensity !== "function") {
      return;
    }
    const embeddedDensity = state.embeddedRenderDensity;
    const logicalSize = this.getCanvasLogicalSize(
      container,
      embeddedDensity
    );
    if (!logicalSize) {
      return;
    }
    const expandedDensity = this.getExpandedPixelDensity({
      displayWidth: display.width,
      displayHeight: display.height,
      logicalWidth: logicalSize.width,
      logicalHeight: logicalSize.height,
      devicePixelRatio: window.devicePixelRatio,
      embeddedDensity
    });
    if (Math.abs(this.getCurrentPixelDensity() - expandedDensity) > 0.01) {
      pixelDensity(expandedDensity);
    }
    state.expandedRenderDensity = expandedDensity;
  },
  restoreEmbeddedRenderDensity(state) {
    if (!state || typeof pixelDensity !== "function" || !Number.isFinite(state.embeddedRenderDensity)) {
      return;
    }
    if (Math.abs(
      this.getCurrentPixelDensity() - state.embeddedRenderDensity
    ) > 0.01) {
      pixelDensity(state.embeddedRenderDensity);
    }
  },
  applyExpandedDisplaySize(containerOrId) {
    const container = this.resolveContainer(containerOrId);
    if (!container || !this.isFullscreen(container)) {
      return;
    }
    const viewport = this.getViewportDimensions();
    const display = this.getLargestAspectFit(
      viewport.width,
      viewport.height
    );
    container.style.width = `${display.width}px`;
    container.style.height = `${display.height}px`;
    this.applyExpandedRenderDensity(container, display);
  },
  isFullscreen(containerOrId) {
    const frame = this.getFrame(containerOrId);
    return Boolean(frame && frame.classList.contains("is-game-fullscreen"));
  },
  toggleFullscreen(containerOrId) {
    const container = this.resolveContainer(containerOrId);
    const frame = this.getFrame(container);
    if (!container || !frame) {
      return;
    }
    const enteringFullscreen = !this.isFullscreen(container);
    if (enteringFullscreen) {
      const frameRect = frame.getBoundingClientRect();
      const placeholder = document.createElement("div");
      placeholder.className = "game-expanded-placeholder";
      placeholder.style.width = `${frameRect.width}px`;
      placeholder.style.height = `${frameRect.height}px`;
      placeholder.style.visibility = "hidden";
      placeholder.setAttribute("aria-hidden", "true");
      frame.parentNode.insertBefore(placeholder, frame);
      this.fullscreenState.set(frame, {
        parent: frame.parentNode,
        placeholder,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        containerInlineWidth: container.style.width,
        containerInlineHeight: container.style.height,
        embeddedRenderDensity: this.getCurrentPixelDensity(),
        expandedRenderDensity: null
      });
      frame.classList.add("is-game-fullscreen");
      document.body.classList.add("game-fullscreen-active");
      document.body.appendChild(frame);
      this.applyExpandedDisplaySize(container);
    } else {
      const state = this.fullscreenState.get(frame);
      if (state?.placeholder?.parentNode) {
        state.placeholder.parentNode.replaceChild(
          frame,
          state.placeholder
        );
      } else if (state?.parent) {
        state.parent.appendChild(frame);
      }
      container.style.width = state?.containerInlineWidth || "";
      container.style.height = state?.containerInlineHeight || "";
      frame.classList.remove("is-game-fullscreen");
      document.body.classList.remove("game-fullscreen-active");
      this.restoreEmbeddedRenderDensity(state);
      this.fullscreenState.delete(frame);
      if (state) {
        requestAnimationFrame(() => {
          window.scrollTo(state.scrollX, state.scrollY);
        });
      }
    }
    document.dispatchEvent(new CustomEvent("gamefullscreenchange", {
      detail: {
        container,
        frame,
        isFullscreen: enteringFullscreen
      }
    }));
    if (!enteringFullscreen) {
      requestAnimationFrame(() => {
        const containerId = typeof containerOrId === "string" ? containerOrId : container.id;
        if (containerId) {
          this.resizeResponsive(containerId);
        }
      });
    }
  },
  observeContainer(containerId) {
    const container = this.getContainer(containerId);
    if (!container || this.managers.has(containerId)) {
      return;
    }
    const refreshExpandedDisplay = () => {
      if (this.isFullscreen(container)) {
        this.applyExpandedDisplaySize(container);
      }
    };
    window.addEventListener("resize", refreshExpandedDisplay);
    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        refreshExpandedDisplay
      );
    }
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", () => {
        this.resizeResponsive(containerId);
      });
      const { width: width3, height: height3 } = this.getDimensions(container);
      this.managers.set(containerId, {
        observer: null,
        resizeFrame: null,
        lastWidth: width3,
        lastHeight: height3
      });
      return;
    }
    let resizeFrame = null;
    const observer = new ResizeObserver(() => {
      if (resizeFrame) {
        cancelAnimationFrame(resizeFrame);
      }
      resizeFrame = requestAnimationFrame(() => {
        this.resizeResponsive(containerId);
      });
    });
    observer.observe(container);
    const { width: width2, height: height2 } = this.getDimensions(container);
    this.managers.set(containerId, {
      observer,
      resizeFrame,
      lastWidth: width2,
      lastHeight: height2
    });
  }
};

// systems/games/layout.js
var Layout = {
  getCenteredBox(widthRatio, heightRatio, offsetYRatio = 0) {
    return {
      x: width / 2,
      y: height / 2 + height * offsetYRatio,
      w: width * widthRatio,
      h: height * heightRatio
    };
  }
};

// systems/privacy/storage-choice.mjs
var CHOICE_KEY = "fas-site-storage-choice";
var CHOICE_DAYS = 180;
var OPTIONAL_KEYS = {
  "from-a-storyteller-theme": "preferences",
  rallyClash_SoundEnabled: "preferences",
  rallyClash_MasterVolume: "preferences",
  rallyClash_bestRally: "gameRecords",
  "games.brickBlitz.highscore": "gameRecords"
};
function parseChoice(value, now = Date.now()) {
  try {
    const d = JSON.parse(value);
    return d?.version === 1 && typeof d.preferences === "boolean" && typeof d.gameRecords === "boolean" && Number.isFinite(d.expiresAt) && d.expiresAt > now && d.expiresAt <= now + CHOICE_DAYS * 864e5 ? d : null;
  } catch {
    return null;
  }
}
var memoryChoice = null;
function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
function readChoice(storage = browserStorage()) {
  if (memoryChoice) return parseChoice(JSON.stringify(memoryChoice));
  try {
    return storage ? parseChoice(storage.getItem(CHOICE_KEY)) : parseChoice(JSON.stringify(memoryChoice));
  } catch {
    return parseChoice(JSON.stringify(memoryChoice));
  }
}
function optionalStorageAllowed(key, storage = browserStorage()) {
  const category = OPTIONAL_KEYS[key];
  return !!category && readChoice(storage)?.[category] === true;
}

// systems/games/storage.js
var Storage = {
  save(key, value) {
    if (!optionalStorageAllowed(key)) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
    }
  },
  load(key, fallbackValue) {
    if (!optionalStorageAllowed(key)) return fallbackValue;
    let storedValue;
    try {
      storedValue = localStorage.getItem(key);
    } catch {
      return fallbackValue;
    }
    if (storedValue === null) {
      return fallbackValue;
    }
    try {
      return JSON.parse(storedValue);
    } catch {
      return fallbackValue;
    }
  }
};

// systems/games/ui.js
var UI = {
  drawMessageBox(x, y, w, h, config) {
    rectMode(CENTER);
    const fillCol = color(config.fillColor);
    fillCol.setAlpha(config.fillAlpha);
    fill(fillCol);
    const strokeCol = color(config.strokeColor);
    strokeCol.setAlpha(config.strokeAlpha);
    stroke(strokeCol);
    strokeWeight(config.strokeWeight);
    rect(x, y, w, h, config.radius);
    noStroke();
    rectMode(CORNER);
  }
};

// sources/games/brick-blitz.mjs
var MenuScreens = {
  create(menu2) {
    return {
      title: {
        title: "Main Menu",
        items: [
          {
            type: "button",
            label: "Play",
            action: () => menu2.startGame()
          },
          {
            type: "select",
            label: "Difficulty",
            key: "difficulty",
            source: "sessionOptions",
            options: ["Easy", "Normal", "Hard"]
          },
          {
            type: "button",
            label: "Settings",
            action: () => menu2.openScreen("settings", "title")
          },
          {
            type: "button",
            label: () => menu2.getFullscreenLabel(),
            action: () => menu2.toggleFullscreen()
          }
        ]
      },
      pause: {
        title: "Paused",
        items: [
          {
            type: "button",
            label: "Resume",
            action: () => menu2.resumeGame()
          },
          {
            type: "button",
            label: "Settings",
            action: () => menu2.openScreen("settings", "pause")
          },
          {
            type: "button",
            label: () => menu2.getFullscreenLabel(),
            action: () => menu2.toggleFullscreen()
          },
          {
            type: "button",
            label: "Return to Title",
            action: () => menu2.returnToTitle()
          }
        ]
      },
      settings: {
        title: "Settings",
        items: [
          {
            type: "toggle",
            label: "Sounds",
            key: "soundEnabled",
            source: "settings"
          },
          {
            type: "slider",
            label: "Master Volume",
            key: "masterVolume",
            source: "settings",
            min: 0,
            max: 100,
            step: 1
          },
          {
            type: "button",
            label: "Back",
            action: () => menu2.goBack()
          }
        ]
      },
      matchResult: {
        title: () => {
          const result = menu2.getScreenData("result", "gameOver");
          if (result === "victory") return "Victory";
          if (result === "defeat") return "Defeat";
          return "Game Over";
        },
        content: () => menu2.getScreenData("stats", []),
        items: [
          {
            type: "button",
            label: "Play Again",
            action: () => menu2.startGame()
          },
          {
            type: "button",
            label: "Return to Title",
            action: () => menu2.returnToTitle()
          }
        ]
      }
    };
  }
};
var MenuManager = class {
  constructor(actions = {}) {
    this.actions = actions;
    this.isOpen = false;
    this.currentScreen = "title";
    this.previousScreen = null;
    this.selectedIndex = 0;
    this.screenData = {};
    this.sessionOptions = {
      difficulty: "Normal",
      players: 1
    };
    const audioSettings = typeof this.actions.getAudioSettings === "function" ? this.actions.getAudioSettings() : {
      soundEnabled: true,
      masterVolume: 100
    };
    this.settings = {
      soundEnabled: audioSettings.soundEnabled,
      masterVolume: audioSettings.masterVolume
    };
    this.screens = MenuScreens.create(this);
    this.container = null;
    this.panel = null;
    this.mountElement = null;
    this.fullscreenEventsBound = false;
  }
  init(mountElement) {
    this.mountElement = mountElement;
    this.container = document.createElement("div");
    this.container.className = "menu-overlay hidden";
    this.panel = document.createElement("div");
    this.panel.className = "menu-panel";
    this.container.appendChild(this.panel);
    mountElement.appendChild(this.container);
    if (!this.fullscreenEventsBound) {
      const handleFullscreenChange = (event) => {
        if (this.isOpen && event.detail?.container === this.mountElement) {
          this.render();
        }
      };
      document.addEventListener("gamefullscreenchange", handleFullscreenChange);
      this.fullscreenEventsBound = true;
    }
    this.render();
  }
  openScreen(screenId, previousScreen = null, screenData = {}) {
    this.isOpen = true;
    this.currentScreen = screenId;
    this.previousScreen = previousScreen;
    this.selectedIndex = 0;
    this.screenData = { ...screenData };
    if (screenId === "settings" && typeof this.actions.getAudioSettings === "function") {
      const audioSettings = this.actions.getAudioSettings();
      this.settings.soundEnabled = audioSettings.soundEnabled;
      this.settings.masterVolume = audioSettings.masterVolume;
    }
    if (this.container) {
      this.container.classList.remove("hidden");
    }
    this.render();
  }
  close() {
    this.isOpen = false;
    this.screenData = {};
    if (this.container) {
      this.container.classList.add("hidden");
    }
  }
  goBack() {
    if (this.previousScreen) {
      const target = this.previousScreen;
      this.previousScreen = null;
      this.openScreen(target);
      return;
    }
    if (this.currentScreen === "pause") {
      this.resumeGame();
    }
  }
  moveSelection(direction) {
    const screen = this.screens[this.currentScreen];
    const items = screen?.items ?? [];
    if (items.length === 0) return;
    const itemCount = items.length;
    this.selectedIndex += direction;
    if (this.selectedIndex < 0) {
      this.selectedIndex = itemCount - 1;
    }
    if (this.selectedIndex >= itemCount) {
      this.selectedIndex = 0;
    }
    this.render();
  }
  getValue(item) {
    return this[item.source][item.key];
  }
  setValue(item, value) {
    this[item.source][item.key] = value;
    if (item.source === "settings") {
      if (item.key === "soundEnabled" && typeof this.actions.setSoundEnabled === "function") {
        this.actions.setSoundEnabled(value);
      }
      if (item.key === "masterVolume" && typeof this.actions.setMasterVolume === "function") {
        this.actions.setMasterVolume(value);
      }
    }
  }
  changeValue(direction) {
    const screen = this.screens[this.currentScreen];
    const items = screen?.items ?? [];
    const item = items[this.selectedIndex];
    if (!item) return;
    if (item.type === "select") {
      const currentValue = this.getValue(item);
      const currentIndex = item.options.indexOf(currentValue);
      let newIndex = currentIndex + direction;
      if (newIndex < 0) newIndex = 0;
      if (newIndex >= item.options.length) newIndex = item.options.length - 1;
      if (newIndex !== currentIndex) {
        this.setValue(item, item.options[newIndex]);
        this.render();
      }
    }
    if (item.type === "toggle") {
      this.setValue(item, direction < 0);
      this.render();
    }
    if (item.type === "slider") {
      let newValue = this.getValue(item) + direction * item.step;
      if (newValue < item.min) newValue = item.min;
      if (newValue > item.max) newValue = item.max;
      this.setValue(item, newValue);
      this.render();
    }
  }
  activateSelected() {
    const screen = this.screens[this.currentScreen];
    const items = screen?.items ?? [];
    const item = items[this.selectedIndex];
    if (!item) return;
    if (item.type === "button" && item.action) {
      item.action();
      return;
    }
    if (item.type === "toggle") {
      this.setValue(item, !this.getValue(item));
      this.render();
      return;
    }
    if (item.type === "select") {
      const currentValue = this.getValue(item);
      const currentIndex = item.options.indexOf(currentValue);
      const nextIndex = (currentIndex + 1) % item.options.length;
      this.setValue(item, item.options[nextIndex]);
      this.render();
      return;
    }
    if (item.type === "slider") {
      let newValue = this.getValue(item) + item.step;
      if (newValue > item.max) {
        newValue = item.min;
      }
      this.setValue(item, newValue);
      this.render();
    }
  }
  getScreenData(key, fallback = null) {
    if (!this.screenData || !(key in this.screenData)) {
      return fallback;
    }
    return this.screenData[key];
  }
  resolveScreenValue(value, fallback = null) {
    if (typeof value === "function") {
      return value();
    }
    return value ?? fallback;
  }
  getFullscreenLabel() {
    return CanvasManager.isFullscreen(this.mountElement) ? "Exit Expanded View" : "Expand Game";
  }
  toggleFullscreen() {
    if (!this.mountElement) {
      return;
    }
    CanvasManager.toggleFullscreen(this.mountElement);
  }
  render() {
    const screen = this.screens[this.currentScreen];
    if (!screen || !this.panel) return;
    this.panel.innerHTML = "";
    this.panel.className = "menu-panel";
    this.panel.classList.add(`menu-screen-${this.currentScreen}`);
    const resultType = this.getScreenData("result", null);
    if (resultType) {
      this.panel.classList.add(`menu-result-${resultType}`);
    }
    const title = document.createElement("h2");
    title.className = "menu-title";
    if (this.currentScreen === "matchResult") {
      title.classList.add("menu-result-title");
    }
    title.textContent = this.resolveScreenValue(screen.title, "");
    this.panel.appendChild(title);
    const contentRows = this.resolveScreenValue(screen.content, []);
    if (Array.isArray(contentRows) && contentRows.length > 0) {
      const content = document.createElement("div");
      content.className = "menu-content";
      const statsGrid = document.createElement("div");
      statsGrid.className = "menu-stats-grid";
      contentRows.forEach((entry) => {
        if (entry.type === "stat") {
          statsGrid.appendChild(this.createStatCard(entry));
        }
      });
      content.appendChild(statsGrid);
      this.panel.appendChild(content);
    }
    const list = document.createElement("div");
    list.className = "menu-list";
    if (this.currentScreen === "matchResult") {
      list.classList.add("menu-result-actions");
    }
    const items = screen.items ?? [];
    items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "menu-row";
      if (this.currentScreen === "matchResult") {
        row.classList.add("menu-result-action");
        if (index === 0) {
          row.classList.add("menu-result-action-primary");
        }
        if (index === 1) {
          row.classList.add("menu-result-action-secondary");
        }
      }
      if (index === this.selectedIndex) {
        row.classList.add("selected");
      }
      const label = document.createElement("span");
      label.className = "menu-label";
      label.textContent = this.resolveScreenValue(item.label, "");
      row.appendChild(label);
      if (item.type === "toggle") {
        row.appendChild(this.createToggleDisplay(item));
      } else if (item.type === "slider") {
        row.appendChild(this.createSliderDisplay(item));
      } else if (item.type === "select") {
        row.appendChild(this.createSelectDisplay(item));
      } else {
        const value = document.createElement("span");
        value.className = "menu-value";
        value.textContent = this.getDisplayValue(item);
        row.appendChild(value);
      }
      row.addEventListener("mouseenter", () => {
        if (this.selectedIndex !== index) {
          this.selectedIndex = index;
          this.render();
        }
      });
      if (item.type === "button") {
        row.addEventListener("click", () => {
          this.selectedIndex = index;
          this.activateSelected();
        });
      }
      list.appendChild(row);
    });
    this.panel.appendChild(list);
  }
  createStatCard(entry) {
    const card = document.createElement("div");
    card.className = "menu-stat-card";
    if (entry.highlight === true) {
      card.classList.add("highlight");
    }
    const label = document.createElement("div");
    label.className = "menu-stat-label";
    label.textContent = entry.label;
    const value = document.createElement("div");
    value.className = "menu-stat-value";
    value.textContent = entry.value;
    card.appendChild(label);
    card.appendChild(value);
    if (entry.suffix) {
      const suffix = document.createElement("div");
      suffix.className = "menu-stat-suffix";
      suffix.textContent = entry.suffix;
      card.appendChild(suffix);
    }
    return card;
  }
  createToggleDisplay(item) {
    const wrapper = document.createElement("div");
    wrapper.className = "menu-toggle-group";
    const currentValue = this.getValue(item);
    const onButton = document.createElement("button");
    onButton.type = "button";
    onButton.className = "menu-toggle-option";
    onButton.textContent = "On";
    if (currentValue === true) {
      onButton.classList.add("active");
    }
    onButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.selectedIndex = this.screens[this.currentScreen].items.indexOf(item);
      this.setValue(item, true);
      this.render();
    });
    const offButton = document.createElement("button");
    offButton.type = "button";
    offButton.className = "menu-toggle-option";
    offButton.textContent = "Off";
    if (currentValue === false) {
      offButton.classList.add("active");
    }
    offButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.selectedIndex = this.screens[this.currentScreen].items.indexOf(item);
      this.setValue(item, false);
      this.render();
    });
    wrapper.appendChild(onButton);
    wrapper.appendChild(offButton);
    return wrapper;
  }
  createSelectDisplay(item) {
    const wrapper = document.createElement("div");
    wrapper.className = "menu-select-group";
    const currentValue = this.getValue(item);
    item.options.forEach((option) => {
      const optionButton = document.createElement("button");
      optionButton.type = "button";
      optionButton.className = "menu-select-option";
      optionButton.textContent = option;
      if (option === currentValue) {
        optionButton.classList.add("active");
      }
      optionButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.selectedIndex = this.screens[this.currentScreen].items.indexOf(item);
        this.setValue(item, option);
        this.render();
      });
      wrapper.appendChild(optionButton);
    });
    return wrapper;
  }
  createSliderDisplay(item) {
    const wrapper = document.createElement("div");
    wrapper.className = "menu-slider-wrap";
    const valueLabel = document.createElement("span");
    valueLabel.className = "menu-slider-value";
    const track = document.createElement("div");
    track.className = "menu-slider-bar";
    const fill2 = document.createElement("div");
    fill2.className = "menu-slider-fill";
    const thumb = document.createElement("div");
    thumb.className = "menu-slider-thumb";
    const min2 = item.min ?? 0;
    const max = item.max ?? 100;
    const step = item.step ?? 1;
    const updateSliderVisuals = (value) => {
      const clampedValue = Math.max(min2, Math.min(max, value));
      const percent = (clampedValue - min2) / (max - min2);
      fill2.style.width = `${percent * 100}%`;
      thumb.style.left = `${percent * 100}%`;
      valueLabel.textContent = clampedValue;
    };
    const setSliderFromPointer = (clientX) => {
      const rect2 = track.getBoundingClientRect();
      if (rect2.width <= 0) {
        return;
      }
      const rawRatio = (clientX - rect2.left) / rect2.width;
      const clampedRatio = Math.max(0, Math.min(1, rawRatio));
      const rawValue = min2 + clampedRatio * (max - min2);
      const steppedValue = Math.round((rawValue - min2) / step) * step + min2;
      const finalValue = Math.max(
        min2,
        Math.min(max, steppedValue)
      );
      this.selectedIndex = this.screens[this.currentScreen].items.indexOf(item);
      this.setValue(item, finalValue);
      updateSliderVisuals(finalValue);
    };
    updateSliderVisuals(this.getValue(item));
    let activePointerId = null;
    const finishPointerDrag = (event) => {
      if (activePointerId === null || event.pointerId !== activePointerId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      try {
        if (track.hasPointerCapture?.(activePointerId)) {
          track.releasePointerCapture(activePointerId);
        }
      } catch {
      }
      activePointerId = null;
      this.render();
    };
    track.addEventListener(
      "pointerdown",
      (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        activePointerId = event.pointerId;
        try {
          track.setPointerCapture(event.pointerId);
        } catch {
        }
        setSliderFromPointer(event.clientX);
      },
      { passive: false }
    );
    track.addEventListener(
      "pointermove",
      (event) => {
        if (activePointerId === null || event.pointerId !== activePointerId) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setSliderFromPointer(event.clientX);
      },
      { passive: false }
    );
    track.addEventListener(
      "pointerup",
      finishPointerDrag,
      { passive: false }
    );
    track.addEventListener(
      "pointercancel",
      finishPointerDrag,
      { passive: false }
    );
    track.appendChild(fill2);
    track.appendChild(thumb);
    wrapper.appendChild(track);
    wrapper.appendChild(valueLabel);
    return wrapper;
  }
  getDisplayValue(item) {
    if (item.type === "button") return "";
    return "";
  }
  handleInput(wasKeyPressed, wasKeyPressedOrRepeated = wasKeyPressed) {
    if (!this.isOpen) return false;
    if (this.currentScreen === "matchResult") {
      if (wasKeyPressedOrRepeated("ArrowLeft")) {
        this.moveSelection(-1);
        return true;
      }
      if (wasKeyPressedOrRepeated("ArrowRight")) {
        this.moveSelection(1);
        return true;
      }
      if (wasKeyPressedOrRepeated("ArrowUp") || wasKeyPressedOrRepeated("ArrowDown")) {
        return true;
      }
    } else {
      if (wasKeyPressedOrRepeated("ArrowUp")) {
        this.moveSelection(-1);
        return true;
      }
      if (wasKeyPressedOrRepeated("ArrowDown")) {
        this.moveSelection(1);
        return true;
      }
      if (wasKeyPressedOrRepeated("ArrowLeft")) {
        this.changeValue(-1);
        return true;
      }
      if (wasKeyPressedOrRepeated("ArrowRight")) {
        this.changeValue(1);
        return true;
      }
    }
    if (wasKeyPressed("Enter") || wasKeyPressed("Space")) {
      this.activateSelected();
      return true;
    }
    if (wasKeyPressed("Escape")) {
      this.goBack();
      return true;
    }
    return false;
  }
  startGame() {
    if (typeof this.actions.startGame !== "function") {
      throw new Error("MenuManager actions.startGame is missing or not a function");
    }
    this.actions.startGame(this.sessionOptions);
    this.close();
  }
  resumeGame() {
    if (typeof this.actions.resumeGame === "function") {
      this.actions.resumeGame();
    }
    this.close();
  }
  returnToTitle() {
    if (typeof this.actions.returnToTitle === "function") {
      this.actions.returnToTitle();
    }
    this.openScreen("title");
  }
};
var Menu = { Manager: MenuManager };
var GAME_STATE = {
  MENU: "menu",
  COUNTDOWN: "countdown",
  PLAYING: "playing",
  PAUSED: "paused",
  GAME_OVER: "game-over"
};
var GAME_COLORS = {
  bg: "#26231f",
  main: "#d4af37",
  text: "#f5f1e8"
};
var GAME_CONFIG = {
  startingLives: 3,
  ballStartSpeed: 4,
  ballSpeedStep: 0.2,
  ballMaxSpeed: 7,
  baseBrickScore: 10,
  comboResetFrames: 120,
  // about 2 seconds at 60fps
  loseLifePenaltyBricks: 3,
  levelSpeedBonus: 0.2,
  // extra starting speed per level
  levelMaxSpeedBonus: 0.35,
  // extra max speed per level
  levelPaddleSpeedBonus: 0.15
  // paddle speed also rises
};
var STORAGE_KEYS = {
  allTimeHighscore: "games.brickBlitz.highscore"
};
var ball = {
  x: 0,
  y: 0,
  r: 8,
  vx: 0,
  vy: 0,
  speed: GAME_CONFIG.ballStartSpeed
};
var gameState = GAME_STATE.MENU;
var menu;
var lives = GAME_CONFIG.startingLives;
var score = 0;
var level = 1;
var allTimeHighscore = 0;
var combo = 0;
var comboTimer = 0;
var highestCombo = 0;
var comboPopFrames = 0;
var comboPopDuration = 12;
var countdownValue = 0;
var countdownFrames = 0;
var screenShakeFrames = 0;
var screenShakeStrength = 0;
var sounds = {};
var paddle = {
  x: 100,
  y: 300,
  w: 120,
  h: 20,
  speed: 8
};
var bricks = [];
function startCountdown() {
  countdownValue = 3;
  countdownFrames = 60;
  gameState = GAME_STATE.COUNTDOWN;
  AudioManager.play(sounds.countdown, 0.35);
}
function setupPaddle() {
  paddle.x = (width - paddle.w) / 2;
  paddle.y = height - 40;
}
function resetBall() {
  ball.x = width / 2;
  ball.y = height / 2;
  ball.vx = 0;
  ball.vy = 0;
}
function parkBallOnPaddle() {
  ball.x = paddle.x + paddle.w / 2;
  ball.y = paddle.y - ball.r;
  ball.vx = 0;
  ball.vy = 0;
}
function launchBall() {
  const maxLaunchAngle = radians(20);
  const launchAngle = random(-maxLaunchAngle, maxLaunchAngle);
  ball.vx = ball.speed * sin(launchAngle);
  ball.vy = -ball.speed * cos(launchAngle);
}
function getBallStartSpeed() {
  return GAME_CONFIG.ballStartSpeed + (level - 1) * GAME_CONFIG.levelSpeedBonus;
}
function getBallMaxSpeed() {
  return GAME_CONFIG.ballMaxSpeed + (level - 1) * GAME_CONFIG.levelMaxSpeedBonus;
}
function getPaddleSpeed() {
  return 8 + (level - 1) * GAME_CONFIG.levelPaddleSpeedBonus;
}
function increaseBallSpeed() {
  ball.speed = Math.min(
    ball.speed + GAME_CONFIG.ballSpeedStep,
    getBallMaxSpeed()
  );
}
function applyBallSpeedToCurrentDirection() {
  const currentMagnitude = Math.hypot(ball.vx, ball.vy);
  if (currentMagnitude === 0) return;
  ball.vx = ball.vx / currentMagnitude * ball.speed;
  ball.vy = ball.vy / currentMagnitude * ball.speed;
}
function setupBricks() {
  bricks = [];
  const patternType = getPatternType();
  const rows = Math.min(3 + Math.floor((level - 1) / 1), 6);
  const cols = Math.min(5 + Math.floor((level - 1) / 2), 10);
  const gap = 4;
  const sidePadding = 50;
  const topOffset = 40;
  const totalGapWidth = gap * (cols - 1);
  const brickWidth = (width - sidePadding * 2 - totalGapWidth) / cols;
  const brickHeight = 20;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let active = true;
      if (patternType === "gaps") {
        if (c % 2 === 0) active = false;
      }
      if (patternType === "checker") {
        if ((r + c) % 2 === 0) active = false;
      }
      if (patternType === "pyramid") {
        const center = (cols - 1) / 2;
        const distance = Math.abs(c - center);
        if (distance > r) active = false;
      }
      if (patternType === "frame") {
        if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
          active = false;
        }
      }
      if (patternType === "tunnel") {
        const centerLeft = Math.floor((cols - 1) / 2);
        const centerRight = Math.ceil((cols - 1) / 2);
        if (c === centerLeft || c === centerRight) {
          active = false;
        }
      }
      if (patternType === "diamond") {
        const centerRow = (rows - 1) / 2;
        const centerCol = (cols - 1) / 2;
        const rowDistance = Math.abs(r - centerRow);
        const colDistance = Math.abs(c - centerCol);
        const maxDistance = Math.min(centerRow, centerCol);
        if (rowDistance + colDistance > maxDistance + 0.5) {
          active = false;
        }
      }
      let health = 1;
      if (active) {
        if (level >= 3 && r === 0) {
          health = 2;
        }
        if (level >= 5 && r <= 1 && active) {
          health = 2;
        }
        if (level >= 8 && r === 0) {
          health = 3;
        }
        if (level >= 10 && r <= 1) {
          health = 3;
        }
        if (level >= 14 && r <= 2) {
          health = 4;
        }
      }
      bricks.push({
        x: sidePadding + c * (brickWidth + gap),
        y: topOffset + r * (brickHeight + gap),
        w: brickWidth,
        h: brickHeight,
        active,
        health
      });
    }
  }
}
function getPatternType() {
  if (level === 1) return "full";
  if (level === 2) return "gaps";
  if (level === 3) return "checker";
  if (level === 4) return "pyramid";
  if (level === 5) return "frame";
  if (level === 6) return "tunnel";
  if (level === 7) return "diamond";
  const latePatterns = ["full", "gaps", "checker", "pyramid", "frame", "tunnel", "diamond"];
  return latePatterns[(level - 8) % latePatterns.length];
}
function triggerScreenShake(frames, strength) {
  screenShakeFrames = frames;
  screenShakeStrength = strength;
}
function buildMenuActions() {
  return {
    startGame: () => {
      userStartAudio();
      startNewGame();
    },
    resumeGame: () => {
      gameState = GAME_STATE.PLAYING;
    },
    returnToTitle: () => {
      gameState = GAME_STATE.MENU;
    },
    getAudioSettings: () => ({
      soundEnabled: true,
      masterVolume: 100
    }),
    setSoundEnabled: (enabled) => {
      AudioManager.setSoundEnabled(enabled);
    },
    setMasterVolume: (volume) => {
      AudioManager.setMasterVolume(volume);
    }
  };
}
function startNewGame() {
  score = 0;
  level = 1;
  lives = GAME_CONFIG.startingLives;
  combo = 0;
  comboTimer = 0;
  highestCombo = 0;
  setupBricks();
  resetRound();
}
function resetRound() {
  ball.speed = getBallStartSpeed();
  paddle.speed = getPaddleSpeed();
  setupPaddle();
  parkBallOnPaddle();
  resetCombo();
  startCountdown();
}
function startNewLevel() {
  level++;
  setupBricks();
  resetRound();
}
function loseLife() {
  applyLoseLifePenalty();
  resetCombo();
  lives--;
  if (lives <= 0) {
    endGame("gameOver");
  } else {
    resetRound();
  }
}
function getLevelMultiplier() {
  return level;
}
function getBrickScoreValue() {
  return GAME_CONFIG.baseBrickScore * getLevelMultiplier() * Math.max(1, combo);
}
function resetCombo() {
  combo = 0;
  comboTimer = 0;
  comboPopFrames = 0;
}
function refreshComboTimer() {
  comboTimer = GAME_CONFIG.comboResetFrames;
}
function increaseCombo() {
  combo++;
  highestCombo = Math.max(highestCombo, combo);
  refreshComboTimer();
  comboPopFrames = comboPopDuration;
}
function updateComboTimer() {
  if (comboTimer > 0) {
    comboTimer--;
    if (comboTimer <= 0) {
      resetCombo();
    }
  }
}
function getLoseLifePenalty() {
  return GAME_CONFIG.baseBrickScore * GAME_CONFIG.loseLifePenaltyBricks * level;
}
function applyLoseLifePenalty() {
  score -= getLoseLifePenalty();
  if (score < 0) {
    score = 0;
  }
}
function updateAllTimeHighscore() {
  if (score > allTimeHighscore) {
    allTimeHighscore = score;
    Storage.save(STORAGE_KEYS.allTimeHighscore, allTimeHighscore);
    return true;
  }
  return false;
}
function endGame(result) {
  AudioManager.play(sounds.gameover, 0.6);
  const isNewHighscore = updateAllTimeHighscore();
  const stats = [
    {
      type: "stat",
      label: "Score",
      value: nf(score, 6)
    },
    {
      type: "stat",
      label: "All-Time Highscore",
      value: nf(allTimeHighscore, 6),
      highlight: isNewHighscore,
      suffix: isNewHighscore ? "NEW HIGHSCORE" : ""
    }
  ];
  gameState = GAME_STATE.GAME_OVER;
  menu.openScreen("matchResult", null, {
    result,
    stats
  });
}
function checkGameOver() {
  let activeBrickFound = false;
  for (let i = 0; i < bricks.length; i++) {
    if (bricks[i].active) {
      activeBrickFound = true;
      break;
    }
  }
  if (!activeBrickFound) {
    startNewLevel();
  }
}
function pauseGame() {
  gameState = GAME_STATE.PAUSED;
  menu.openScreen("pause");
}
function updateCountdown() {
  parkBallOnPaddle();
  countdownFrames--;
  if (countdownFrames <= 0) {
    countdownValue--;
    if (countdownValue <= 0) {
      AudioManager.play(sounds.start, 0.5);
      launchBall();
      gameState = GAME_STATE.PLAYING;
      return;
    }
    AudioManager.play(sounds.countdown, 0.35);
    countdownFrames = 60;
  }
}
function updatePaddle() {
  const touchPosition = Input.getPointerPosition("brick-blitz-game");
  if (Input.isTouchActive() && touchPosition) {
    paddle.x = touchPosition.x - paddle.w / 2;
  } else {
    if (Input.isDown("ArrowLeft")) {
      paddle.x -= paddle.speed;
    }
    if (Input.isDown("ArrowRight")) {
      paddle.x += paddle.speed;
    }
  }
  if (paddle.x < 0) {
    paddle.x = 0;
  }
  if (paddle.x + paddle.w > width) {
    paddle.x = width - paddle.w;
  }
}
function updateBall() {
  ball.x += ball.vx;
  ball.y += ball.vy;
  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    ball.vx *= -1;
    AudioManager.play(sounds.wallHit, 0.3);
  }
  if (ball.x + ball.r > width) {
    ball.x = width - ball.r;
    ball.vx *= -1;
    AudioManager.play(sounds.wallHit, 0.3);
  }
  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    ball.vy *= -1;
    AudioManager.play(sounds.wallHit, 0.3);
  }
  if (ball.x + ball.r > paddle.x && ball.x - ball.r < paddle.x + paddle.w && ball.y + ball.r > paddle.y && ball.y - ball.r < paddle.y + paddle.h) {
    const ballLeft = ball.x - ball.r;
    const ballRight = ball.x + ball.r;
    const ballTop = ball.y - ball.r;
    const ballBottom = ball.y + ball.r;
    const paddleLeft = paddle.x;
    const paddleRight = paddle.x + paddle.w;
    const paddleTop = paddle.y;
    const paddleBottom = paddle.y + paddle.h;
    const overlapLeft = ballRight - paddleLeft;
    const overlapRight = paddleRight - ballLeft;
    const overlapTop = ballBottom - paddleTop;
    const overlapBottom = paddleBottom - ballTop;
    const minOverlapX = Math.min(overlapLeft, overlapRight);
    const minOverlapY = Math.min(overlapTop, overlapBottom);
    if (minOverlapX < minOverlapY) {
      if (overlapLeft < overlapRight) {
        ball.x = paddleLeft - ball.r;
      } else {
        ball.x = paddleRight + ball.r;
      }
      ball.vx *= -1;
    } else {
      if (overlapTop < overlapBottom) {
        ball.y = paddleTop - ball.r;
        const paddleCenter = paddle.x + paddle.w / 2;
        const hitOffset = ball.x - paddleCenter;
        const normalizedHit = hitOffset / (paddle.w / 2);
        const clampedHit = constrain(normalizedHit, -1, 1);
        const maxBounceAngle = radians(60);
        const bounceAngle = clampedHit * maxBounceAngle;
        increaseBallSpeed();
        ball.vx = ball.speed * sin(bounceAngle);
        ball.vy = -ball.speed * cos(bounceAngle);
        AudioManager.play(sounds.paddleHit, 0.45);
        resetCombo();
        triggerScreenShake(4, 0.6);
      } else {
        ball.y = paddleBottom + ball.r;
        ball.vy *= -1;
      }
    }
  }
  if (ball.y - ball.r > height) {
    loseLife();
    return;
  }
  for (let i = 0; i < bricks.length; i++) {
    let brick = bricks[i];
    if (!brick.active) continue;
    if (ball.x + ball.r > brick.x && ball.x - ball.r < brick.x + brick.w && ball.y + ball.r > brick.y && ball.y - ball.r < brick.y + brick.h) {
      brick.health--;
      if (brick.health <= 0) {
        brick.active = false;
        increaseCombo();
        score += getBrickScoreValue();
        AudioManager.play(sounds.brickBreak, 0.4);
      } else {
        refreshComboTimer();
        AudioManager.play(sounds.brickHit, 0.3);
      }
      const ballLeft = ball.x - ball.r;
      const ballRight = ball.x + ball.r;
      const ballTop = ball.y - ball.r;
      const ballBottom = ball.y + ball.r;
      const brickLeft = brick.x;
      const brickRight = brick.x + brick.w;
      const brickTop = brick.y;
      const brickBottom = brick.y + brick.h;
      const overlapLeft = ballRight - brickLeft;
      const overlapRight = brickRight - ballLeft;
      const overlapTop = ballBottom - brickTop;
      const overlapBottom = brickBottom - ballTop;
      const minOverlapX = Math.min(overlapLeft, overlapRight);
      const minOverlapY = Math.min(overlapTop, overlapBottom);
      if (minOverlapX < minOverlapY) {
        if (overlapLeft < overlapRight) {
          ball.x = brickLeft - ball.r;
        } else {
          ball.x = brickRight + ball.r;
        }
        ball.vx *= -1;
      } else {
        if (overlapTop < overlapBottom) {
          ball.y = brickTop - ball.r;
        } else {
          ball.y = brickBottom + ball.r;
        }
        ball.vy *= -1;
      }
      increaseBallSpeed();
      applyBallSpeedToCurrentDirection();
      triggerScreenShake(3, 1);
      break;
    }
  }
  checkGameOver();
}
function drawBackground() {
  background(GAME_COLORS.bg);
}
function drawPaddle() {
  fill(GAME_COLORS.main);
  noStroke();
  rect(paddle.x, paddle.y, paddle.w, paddle.h);
}
function drawBall() {
  fill(GAME_COLORS.text);
  circle(ball.x, ball.y, ball.r * 2);
}
function drawBricks() {
  noStroke();
  for (let i = 0; i < bricks.length; i++) {
    let brick = bricks[i];
    if (brick.active) {
      if (brick.health >= 4) {
        fill("#5e3b0c");
      } else if (brick.health === 3) {
        fill("#7a5516");
      } else if (brick.health === 2) {
        fill("#8b6b1f");
      } else {
        fill(GAME_COLORS.main);
      }
      rect(brick.x, brick.y, brick.w, brick.h);
    }
  }
}
function drawHud() {
  noStroke();
  fill(GAME_COLORS.text);
  textSize(20);
  textAlign(LEFT, TOP);
  const scoreLabel = "Score: " + nf(score, 6);
  text(scoreLabel, 12, 12);
  if (combo > 1) {
    const scoreWidth = textWidth(scoreLabel);
    const popProgress = comboPopFrames / comboPopDuration;
    const comboSize = 14 + popProgress * 4;
    const comboY = 14 - popProgress * 2;
    fill(combo >= 5 ? "#f4deb0" : "#d4af37");
    textSize(comboSize);
    text("   |   x" + combo + " Combo", 12 + scoreWidth + 6, comboY);
  }
  fill(GAME_COLORS.text);
  textSize(20);
  textAlign(CENTER, TOP);
  text("Level: " + level, width / 2, 12);
  textAlign(RIGHT, TOP);
  text("Lives: " + lives, width - 12, 12);
}
function drawOverlay() {
  if (gameState === GAME_STATE.COUNTDOWN) {
    const box = Layout.getCenteredBox(0.28, 0.18, 0);
    UI.drawMessageBox(box.x, box.y, box.w, box.h, {
      fillColor: "#111111",
      fillAlpha: 220,
      strokeColor: "#d4af37",
      strokeAlpha: 255,
      strokeWeight: 2,
      radius: 18
    });
    fill(GAME_COLORS.text);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(42);
    text(countdownValue, box.x, box.y);
  }
}
function drawGame() {
  drawPaddle();
  drawBall();
  drawBricks();
}
window.preload = function() {
  sounds = AudioManager.loadSounds({
    brickBreak: "/assets/sounds/games/brick-blitz/brick-break.wav",
    brickHit: "/assets/sounds/games/brick-blitz/brick-hit.wav",
    paddleHit: "/assets/sounds/games/brick-blitz/paddle-hit.wav",
    wallHit: "/assets/sounds/games/brick-blitz/wall-hit.wav",
    gameover: "/assets/sounds/games/brick-blitz/game-over.wav",
    countdown: "/assets/sounds/games/brick-blitz/countdown-beep.wav",
    start: "/assets/sounds/games/brick-blitz/start.wav"
  });
};
window.setup = function() {
  CanvasManager.createResponsive("brick-blitz-game");
  Input.init();
  menu = new Menu.Manager(buildMenuActions());
  const gameContainer = document.getElementById("brick-blitz-game");
  menu.init(gameContainer);
  menu.openScreen("title");
  allTimeHighscore = Storage.load(STORAGE_KEYS.allTimeHighscore, 0);
  setupPaddle();
  setupBricks();
  resetBall();
  gameState = GAME_STATE.MENU;
};
window.draw = function() {
  const menuHandled = menu.handleInput(
    (code) => Input.wasPressed(code),
    (code) => Input.wasPressedOrRepeated(code)
  );
  if (!menuHandled) {
    if (Input.wasPressed("Escape")) {
      if (gameState === GAME_STATE.PLAYING) {
        pauseGame();
      } else if (gameState === GAME_STATE.PAUSED) {
        menu.actions.resumeGame();
      }
    }
  }
  if (!menuHandled) {
    if (gameState === GAME_STATE.PLAYING || gameState === GAME_STATE.COUNTDOWN) {
      updatePaddle();
    }
  }
  if (!menuHandled) {
    if (gameState === GAME_STATE.PLAYING) {
      updateBall();
      updateComboTimer();
      if (comboPopFrames > 0) {
        comboPopFrames--;
      }
    }
    if (gameState === GAME_STATE.COUNTDOWN) {
      updateCountdown();
    }
  }
  drawBackground();
  push();
  if (screenShakeFrames > 0) {
    const decay = screenShakeFrames / 4;
    const strength = screenShakeStrength * decay;
    const shakeX = random(-strength, strength);
    const shakeY = random(-strength, strength);
    translate(shakeX, shakeY);
    screenShakeFrames--;
  }
  drawGame();
  pop();
  drawHud();
  drawOverlay();
  Input.clearPressed();
};
