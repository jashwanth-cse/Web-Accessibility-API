(function (window) {
  const GestureAccessibility = {};
  let config = {};
  let lastGesture = null;
  let lastSentTime = 0;

  // Site Configuration (Defaults)
  let siteConfig = {
    cursor_mode_enabled: true,
    profile: "default",
    cursor_speed: 12,
    scroll_speed: 15,
    enter_hold_ms: 3000,
    exit_hold_ms: 3000,
    click_cooldown_ms: 800
  };

  // Cursor Mode State
  let gestureStartTime = 0;
  let lastGestureState = null;
  let clickCooldown = 0;
  let lastCursorActivity = 0; // Track last interaction for inactivity timeout
  const INACTIVITY_TIMEOUT = 30000; // 30 seconds

  // Scroll fallback state
  let lastHandY = null;
  const SCROLL_THRESHOLD = 0.03;
  const SCROLL_FACTOR = 500;

  /* ================= INIT ================= */

  GestureAccessibility.init = function (options) {
    config = {
      apiUrl: options.apiUrl,
      siteId: options.siteId,
      debug: options.debug || false,
      cooldown: 800
    };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      log("Camera not supported");
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", loadMediaPipe);
    } else {
      loadMediaPipe();
    }

    // Fetch config asynchronously (non-blocking)
    fetchSiteConfig(config.apiUrl, config.siteId);
  };

  async function fetchSiteConfig(apiUrl, siteId) {
    if (!apiUrl || !siteId) return;
    try {
      const res = await fetch(`${apiUrl}/api/v1/config/site/${siteId}`);
      if (res.ok) {
        const data = await res.json();

        // 1. Apply Profile Base Defaults
        if (data.profile === "elderly") {
          siteConfig.cursor_speed = 8;
          siteConfig.scroll_speed = 10;
          siteConfig.enter_hold_ms = 4000;
          siteConfig.exit_hold_ms = 4000;
        } else if (data.profile === "motor_impaired") {
          siteConfig.cursor_speed = 6;
          siteConfig.scroll_speed = 8;
          siteConfig.enter_hold_ms = 5000;
          siteConfig.exit_hold_ms = 5000;
        }

        // 2. Merge Explicit Overrides
        if (data.profile) siteConfig.profile = data.profile;
        if (typeof data.cursor_mode_enabled === "boolean") siteConfig.cursor_mode_enabled = data.cursor_mode_enabled;

        // Map backend cooldown to click cooldown
        if (data.cooldown_ms) siteConfig.click_cooldown_ms = data.cooldown_ms;

        // Optional fields (if supported by backend future updates)
        if (data.cursor_speed) siteConfig.cursor_speed = Number(data.cursor_speed);
        if (data.scroll_speed) siteConfig.scroll_speed = Number(data.scroll_speed);
        if (data.enter_hold_ms) siteConfig.enter_hold_ms = Number(data.enter_hold_ms);
        if (data.exit_hold_ms) siteConfig.exit_hold_ms = Number(data.exit_hold_ms);

        // 3. Safety Validation & Clamping
        siteConfig.cursor_speed = Math.max(1, Math.min(50, siteConfig.cursor_speed || 12));
        siteConfig.scroll_speed = Math.max(1, Math.min(100, siteConfig.scroll_speed || 15));
        siteConfig.enter_hold_ms = Math.max(500, siteConfig.enter_hold_ms || 3000);
        siteConfig.exit_hold_ms = Math.max(500, siteConfig.exit_hold_ms || 3000);
        siteConfig.click_cooldown_ms = Math.max(200, siteConfig.click_cooldown_ms || 800);

        if (typeof siteConfig.cursor_mode_enabled !== "boolean") {
          siteConfig.cursor_mode_enabled = false; // Safe default
        }

        log("Site config loaded", siteConfig);
      } else {
        log("Failed to load site config (Status " + res.status + "), using defaults");
      }
    } catch (e) {
      log("Error fetching site config", e);
    }
  }

  /* ================= LOG ================= */

  function log(...args) {
    if (config.debug) console.log("[GestureAccessibility]", ...args);
  }

  /* ================= SCRIPT LOADER ================= */

  function loadScriptAsync(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      (document.body || document.head).appendChild(script);
    });
  }

  /* ================= MEDIAPIPE LOADER ================= */

  async function loadMediaPipe() {
    try {
      await loadScriptAsync("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
      await loadScriptAsync("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
      startCamera();
    } catch (e) {
      console.error("Failed to load MediaPipe", e);
    }
  }

  /* ================= CAMERA ================= */

  function startCamera() {
    const video = document.createElement("video");
    video.style.display = "none";
    document.body.appendChild(video);

    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
      video.srcObject = stream;
      video.play();
    });

    const hands = new Hands({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    hands.onResults(onResults);

    const camera = new Camera(video, {
      onFrame: async () => await hands.send({ image: video }),
      width: 640,
      height: 480
    });

    setTimeout(() => camera.start(), 300);
  }

  /* ================= GESTURE LOGIC ================= */

  function onResults(results) {
    if (!results.multiHandLandmarks?.length) return;

    const lm = results.multiHandLandmarks[0];
    const thumb = lm[4];
    const index = lm[8];
    const middle = lm[12];
    const ring = lm[16];
    const pinky = lm[20];

    const isIndexOpen = index.y < lm[6].y;
    const isMiddleOpen = middle.y < lm[10].y;
    const isRingOpen = ring.y < lm[14].y;
    const isPinkyOpen = pinky.y < lm[18].y;

    const isFingersOpen = isIndexOpen && isMiddleOpen && isRingOpen && isPinkyOpen;
    const isTwoFingers = isIndexOpen && isMiddleOpen && !isRingOpen && !isPinkyOpen;
    const isThreeFingers = isIndexOpen && isMiddleOpen && isRingOpen && !isPinkyOpen;
    const isRockGesture = isIndexOpen && !isMiddleOpen && !isRingOpen && isPinkyOpen;

    const isPinch =
      Math.abs(thumb.x - index.x) < 0.05 &&
      Math.abs(thumb.y - index.y) < 0.05;

    const isFist =
      !isFingersOpen &&
      !isPinch &&
      middle.y > lm[10].y &&
      ring.y > lm[14].y &&
      pinky.y > lm[18].y;

    let currentGesture = null;
    if (isPinch) currentGesture = "pinch";
    else if (isFingersOpen) currentGesture = "open_palm";
    else if (isFist) currentGesture = "fist";

    const now = Date.now();

    // Global State Tracking
    if (currentGesture !== lastGestureState) {
      gestureStartTime = now;
      lastGestureState = currentGesture;
    }
    const holdDuration = now - gestureStartTime;

    /* ================= CURSOR MODE ================= */
    if (cursorModeActive) {
      // Inactivity Timeout Check
      if (now - lastCursorActivity > INACTIVITY_TIMEOUT) {
        exitCursorMode();
        lastHandY = null;
        return;
      }
      // 1. Exit Check (Highest Priority)
      // Freeze cursor while holding Fist.
      if (currentGesture === "fist") {
        if (holdDuration > siteConfig.exit_hold_ms) {
          exitCursorMode();
          lastHandY = null;
        }
        return;
      }

      // 2. Click Check (Prevents Drift)
      if (currentGesture === "pinch") {
        if (now - clickCooldown > siteConfig.click_cooldown_ms) {
          clickCooldown = now;
          lastCursorActivity = now; // Update activity timestamp
          document.elementFromPoint(cursorX, cursorY)?.click();
        }
        return;
      }

      // 3. Scroll Check (Prevents Drift)
      const SCROLL_SPEED = siteConfig.scroll_speed;
      if (isTwoFingers) {
        lastCursorActivity = now; // Update activity timestamp
        window.scrollBy({ top: -SCROLL_SPEED, behavior: "auto" }); // Scroll Up
        return;
      }
      if (isRockGesture) {
        lastCursorActivity = now; // Update activity timestamp
        window.scrollBy({ top: SCROLL_SPEED, behavior: "auto" }); // Scroll Down
        return;
      }

      // Relative Drift Logic (Joystick)
      const normX = 1 - index.x; // Mirror X
      const normY = index.y;

      const dx = normX - 0.5;
      const dy = normY - 0.5;
      const DEADZONE = 0.05; // Center 10%
      const SPEED = siteConfig.cursor_speed;

      if (Math.abs(dx) > DEADZONE) {
        cursorX += Math.sign(dx) * SPEED;
        lastCursorActivity = now; // Update activity on movement
      }
      if (Math.abs(dy) > DEADZONE) {
        cursorY += Math.sign(dy) * SPEED;
        lastCursorActivity = now; // Update activity on movement
      }

      // Clamp to screen
      cursorX = Math.max(0, Math.min(window.innerWidth, cursorX));
      cursorY = Math.max(0, Math.min(window.innerHeight, cursorY));

      const x = cursorX;
      const y = cursorY;

      moveCursor(x, y);



      return;
    }

    /* ================= MODE ENTRY ================= */
    lastHandY = null;

    // Enter (Hold Open Palm 3s)
    if (currentGesture === "open_palm" && siteConfig.cursor_mode_enabled && holdDuration > siteConfig.enter_hold_ms) {
      enterCursorMode();
      return;
    }

    /* ================= NORMAL NAVIGATION ================= */
    // Backend gestures disabled to avoid conflicts with cursor mode
    // When cursor mode is active, it handles all interactions internally
    // When cursor mode is inactive, only the entry gesture is monitored
    // if (isPinch) sendGesture("pinch");
    // else if (isFingersOpen) sendGesture("open_palm");
  }

  /* ================= API ================= */

  async function sendGesture(gesture) {
    const now = Date.now();
    if (gesture === lastGesture && now - lastSentTime < config.cooldown) return;
    lastGesture = gesture;
    lastSentTime = now;

    const res = await fetch(`${config.apiUrl}/api/v1/gesture/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_id: config.siteId,
        gesture,
        confidence: 0.9
      })
    });

    const data = await res.json();
    if (data.execute) runAction(data.action);
  }

  function runAction(action) {
    if (action === "scroll_down") window.scrollBy({ top: 250, behavior: "smooth" });
    if (action === "scroll_up") window.scrollBy({ top: -250, behavior: "smooth" });
  }

  /* ================= VIRTUAL CURSOR ================= */

  let cursorElement = null;
  let cursorModeActive = false;
  let cursorX = 0;
  let cursorY = 0;

  function createCursor() {
    if (cursorElement) return;
    cursorElement = document.createElement("div");
    cursorElement.id = "gesture-cursor";
    Object.assign(cursorElement.style, {
      position: "fixed",
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      background: "rgba(255,100,100,0.8)",
      border: "2px solid white",
      pointerEvents: "none",
      zIndex: "999999",
      display: "none",
      transform: "translate(-50%, -50%)"
    });
    document.body.appendChild(cursorElement);
  }

  function showCursor() {
    createCursor();
    cursorElement.style.display = "block";
  }

  function hideCursor() {
    if (cursorElement) cursorElement.style.display = "none";
  }

  function moveCursor(x, y) {
    createCursor();
    cursorElement.style.left = x + "px";
    cursorElement.style.top = y + "px";
  }

  function enterCursorMode() {
    cursorModeActive = true;
    cursorX = window.innerWidth / 2;
    cursorY = window.innerHeight / 2;
    lastCursorActivity = Date.now(); // Initialize activity timer
    showCursor();
    moveCursor(cursorX, cursorY);
    log("Cursor mode ON");
  }

  function exitCursorMode() {
    cursorModeActive = false;
    hideCursor();
    log("Cursor mode OFF");
  }

  window.GestureAccessibility = GestureAccessibility;
})(window);
