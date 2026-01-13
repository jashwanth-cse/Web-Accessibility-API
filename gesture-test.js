const API_URL = "http://localhost:8000/api/v1/gesture/evaluate";
const SITE_ID = "demo-site";

async function sendGesture(gesture) {
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
  console.log("API Response:", data);

  if (!data.execute) return;

  runAction(data.action);
}

function runAction(action) {
  switch (action) {
    case "scroll_down":
      window.scrollBy({ top: 300, behavior: "smooth" });
      break;

    case "scroll_up":
      window.scrollBy({ top: -300, behavior: "smooth" });
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
  next.focus();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") sendGesture("open_palm");
  if (e.key === "ArrowUp") sendGesture("fist");
  if (e.key === "ArrowRight") sendGesture("swipe_right");
  if (e.key === " ") sendGesture("pinch");
});
