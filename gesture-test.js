// ================= CONFIG =================
const API_URL = "http://localhost:8000/api/v1/gesture/evaluate";
const SITE_ID = "demo-site";
let lastGesture = null;
let lastSentTime = 0;

// ================= API CALL =================
async function sendGesture(gesture) {
  const now = Date.now();
  if (gesture === lastGesture && now - lastSentTime < 800) return;

  lastGesture = gesture;
  lastSentTime = now;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      site_id: SITE_ID,
      gesture: gesture,
      confidence: 0.9
    })
  });

  const data = await res.json();
  console.log("Gesture:", gesture, "→", data);

  if (!data.execute) return;
  runAction(data.action);
}

// ================= DOM ACTIONS =================
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
  const items = document.querySelectorAll("button, a, input");
  const index = [...items].indexOf(document.activeElement);
  const next = items[index + 1] || items[0];
  next.focus();
}

// ================= MEDIAPIPE =================
const video = document.createElement("video");
video.style.display = "none";
document.body.appendChild(video);

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
document.body.appendChild(canvas);

navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
  video.srcObject = stream;
  video.play();
});

// Load MediaPipe from CDN
const script1 = document.createElement("script");
script1.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
document.body.appendChild(script1);

const script2 = document.createElement("script");
script2.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
document.body.appendChild(script2);

script2.onload = () => {
  const hands = new Hands({
    locateFile: file =>
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

  camera.start();
};

// ================= GESTURE LOGIC =================
function onResults(results) {
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;

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
