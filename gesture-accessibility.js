(function (window) {
  const GestureAccessibility = {};
  let config = {};
  let lastGesture = null;
  let lastSentTime = 0;

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

    const fingersOpen =
      index.y < lm[6].y &&
      middle.y < lm[10].y &&
      ring.y < lm[14].y &&
      pinky.y < lm[18].y;

    const pinch =
      Math.abs(thumb.x - index.x) < 0.05 &&
      Math.abs(thumb.y - index.y) < 0.05;

    if (pinch) {
      sendGesture("pinch");
    } else if (fingersOpen) {
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

  /* ================= EXPORT ================= */

  window.GestureAccessibility = GestureAccessibility;
})(window);
