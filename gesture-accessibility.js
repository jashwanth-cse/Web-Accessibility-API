(function (window) {
  const GestureAccessibility = {};
  let config = {};
  let lastGesture = null;
  let lastSentTime = 0;

  // Cursor Mode State
  let gestureStartTime = 0;
  let lastGestureState = null;
  let clickCooldown = 0;

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

    // Ensure DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", loadMediaPipe);
    } else {
      loadMediaPipe();
    }
  };

  /* ================= LOG ================= */

  function log(...args) {
    if (config.debug) {
      console.log("[GestureAccessibility]", ...args);
    }
  }

  /* ================= SCRIPT LOADER ================= */

  function loadScriptAsync(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = reject;

      (document.body || document.head).appendChild(script);
    });
  }

  /* ================= MEDIAPIPE LOADER ================= */

  async function loadMediaPipe() {
    try {
      log("Loading MediaPipe scripts...");

      await loadScriptAsync(
        "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"
      );
      await loadScriptAsync(
        "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
      );

      log("MediaPipe loaded");
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

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        video.srcObject = stream;
        video.play();
      })
      .catch((err) => {
        console.error("Camera access denied", err);
        return;
      });

    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    hands.onResults(onResults);

    const camera = new Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video });
      },
      width: 640,
      height: 480
    });

    // Delay start to avoid WASM abort
    setTimeout(() => {
      camera.start();
      log("Camera started");
    }, 300);
  }

  /* ================= GESTURE LOGIC ================= */

  function onResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0)
      return;

    const lm = results.multiHandLandmarks[0];

    const thumb = lm[4];
    const index = lm[8];
    const middle = lm[12];
    const ring = lm[16];
    const pinky = lm[20];

    // Detect Gestures
    const isFingersOpen =
      index.y < lm[6].y &&
      middle.y < lm[10].y &&
      ring.y < lm[14].y &&
      pinky.y < lm[18].y;

    const isPinch =
      Math.abs(thumb.x - index.x) < 0.05 &&
      Math.abs(thumb.y - index.y) < 0.05;

    // Simple Fist: Fingers curled down (tip > knuckle)
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

    // ================= CURSOR MODE LOGIC =================
    if (cursorModeActive) {
      // 1. Tracking
      const x = (1 - index.x) * window.innerWidth;
      const y = index.y * window.innerHeight;
      moveCursor(x, y);

      // 2. Actions
      if (currentGesture === "fist") {
        exitCursorMode();
        return; // Exit processed
      }

      if (currentGesture === "pinch") {
        // Click with cooldown
        if (now - clickCooldown > 800) {
          clickCooldown = now;
          const target = document.elementFromPoint(x, y);
          target?.click();

          // Visual feedback
          const cursor = document.getElementById("gesture-cursor");
          if (cursor) {
            cursor.style.transform = "translate(-50%, -50%) scale(0.8)";
            setTimeout(() => cursor.style.transform = "translate(-50%, -50%) scale(1)", 150);
          }
          log("Cursor CLICK at", x, y);
        }
      }
      return; // Disable normal navigation in cursor mode
    }

    // ================= MODE SWITCHING =================
    // Hold Open Palm for 500ms to enter Cursor Mode
    if (currentGesture === "open_palm") {
      if (lastGestureState !== "open_palm") {
        gestureStartTime = now;
      } else if (now - gestureStartTime > 500) {
        enterCursorMode();
        return;
      }
    } else {
      gestureStartTime = 0;
    }

    lastGestureState = currentGesture;

    // ================= NORMAL NAVIGATION =================
    if (isPinch) {
      sendGesture("pinch");
    } else if (isFingersOpen) {
      sendGesture("open_palm");
    }
  }

  /* ================= API ================= */

  async function sendGesture(gesture) {
    const now = Date.now();

    if (gesture === lastGesture && now - lastSentTime < config.cooldown) return;

    lastGesture = gesture;
    lastSentTime = now;

    try {
      const res = await fetch(
        `${config.apiUrl}/api/v1/gesture/evaluate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site_id: config.siteId,
            gesture: gesture,
            confidence: 0.9
          })
        }
      );

      const data = await res.json();
      log("Gesture:", gesture, "→", data);

      if (data.execute) {
        runAction(data.action);
      }
    } catch (e) {
      console.error("API error", e);
    }
  }

  /* ================= DOM ACTIONS ================= */

  function runAction(action) {
    switch (action) {
      case "scroll_down":
        window.scrollBy({ top: 250, behavior: "smooth" });
        break;

      case "scroll_up":
        window.scrollBy({ top: -250, behavior: "smooth" });
        break;

      case "focus_next":
        focusNext();
        break;

      case "click":
        document.activeElement?.click();
        break;
    }
  }

  function focusNext() {
    const elements = document.querySelectorAll("button, a, input");
    const index = [...elements].indexOf(document.activeElement);
    const next = elements[index + 1] || elements[0];
    next?.focus();
  }

  /* ================= VIRTUAL CURSOR ================= */

  let cursorElement = null;
  let cursorModeActive = false;

  function createCursor() {
    /**
     * Create the virtual cursor DOM element.
     */
    if (cursorElement) return; // Already exists

    cursorElement = document.createElement("div");
    cursorElement.id = "gesture-cursor";

    // Style the cursor
    cursorElement.style.position = "fixed";
    cursorElement.style.width = "20px";
    cursorElement.style.height = "20px";
    cursorElement.style.borderRadius = "50%";
    cursorElement.style.backgroundColor = "rgba(255, 100, 100, 0.8)";
    cursorElement.style.border = "2px solid white";
    cursorElement.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.5)";
    cursorElement.style.pointerEvents = "none";
    cursorElement.style.zIndex = "999999";
    cursorElement.style.display = "none"; // Hidden by default
    cursorElement.style.transform = "translate(-50%, -50%)";
    cursorElement.style.transition = "opacity 0.2s ease";

    document.body.appendChild(cursorElement);
    log("Virtual cursor created");
  }

  function showCursor() {
    /**
     * Show the virtual cursor.
     */
    if (!cursorElement) {
      createCursor();
    }
    cursorElement.style.display = "block";
    cursorElement.style.opacity = "1";
    log("Cursor visible");
  }

  function hideCursor() {
    /**
     * Hide the virtual cursor.
     */
    if (cursorElement) {
      cursorElement.style.opacity = "0";
      setTimeout(() => {
        if (cursorElement) {
          cursorElement.style.display = "none";
        }
      }, 200);
      log("Cursor hidden");
    }
  }

  function moveCursor(x, y) {
    /**
     * Move the virtual cursor to specified screen coordinates.
     * 
     * @param {number} x - X coordinate (pixels from left)
     * @param {number} y - Y coordinate (pixels from top)
     */
    if (!cursorElement) {
      createCursor();
    }
    cursorElement.style.left = x + "px";
    cursorElement.style.top = y + "px";
  }

  function enterCursorMode() {
    /**
     * Enter cursor control mode.
     */
    cursorModeActive = true;
    showCursor();
    log("Entered cursor mode");
  }

  function exitCursorMode() {
    /**
     * Exit cursor control mode.
     */
    cursorModeActive = false;
    hideCursor();
    log("Exited cursor mode");
  }

  // Expose cursor functions
  GestureAccessibility.createCursor = createCursor;
  GestureAccessibility.showCursor = showCursor;
  GestureAccessibility.hideCursor = hideCursor;
  GestureAccessibility.moveCursor = moveCursor;
  GestureAccessibility.enterCursorMode = enterCursorMode;
  GestureAccessibility.exitCursorMode = exitCursorMode;


  /* ================= EXPORT ================= */

  window.GestureAccessibility = GestureAccessibility;
})(window);
