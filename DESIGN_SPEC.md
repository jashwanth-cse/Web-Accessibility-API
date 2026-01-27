# Hybrid Gesture-Based Cursor Control Specification

## 1. System Modes

The system operates in two distinct, mutually exclusive modes to prevent interaction conflicts.

### A. Normal Navigation Mode (Default)
- **Status**: Active on system startup.
- **Behavior**: Standard web browsing. Gestures trigger high-level semantic actions (e.g., "Scroll Page", "Focus Next Link").
- **Cursor**: Hidden.
- **Safety**: No virtual cursor events are fired.

### B. Cursor Mode
- **Status**: Activated by user intent.
- **Behavior**: Direct control of a virtual on-screen cursor. High-level navigation gestures (like semantic focus) are disabled to prevent accidental navigation while aiming.
- **Cursor**: Visible, high-contrast overlay.
- **Safety**: "Fist" gesture serves as an immediate kill-switch to return to Normal Mode.

---

## 2. Mode Switching

Mode switching relies on **Static Hold Gestures** to differentiate intentional commands from transient hand movements.

| Action | Gesture | Duration | Rationale |
|BC|---|---|---|
| **Enter Cursor Mode** | **Open Palm** (Static) | **1.5 Seconds** | Long duration is required to distinguish this command from common "Hello" waves or resting hand positions. Prevents accidental activation. |
| **Exit Cursor Mode** | **Fist** (Static) | **0.5 Seconds** | "Grab" or "Stop" metaphor. Shorter duration allows for quick cancellation if the user loses control or wants to resume navigation. |

---

## 3. Cursor Movement (Hybrid Relative Control)

To solve the "Field of View" problem (where reaching screen corners causes the hand to exit the camera frame), Cursor Mode uses a **Relative (Rate Control)** scheme, similar to a joystick.

### Behavior
1.  **Neutral Zone (Deadzone)**: The center 20% of the camera frame is a "Neutral Zone".
2.  **Drift Mechanism**:
    - When the hand (Index Finger Tip) moves **outside** the Neutral Zone, the cursor begins to move (drift) in that direction.
    - **Velocity**: The further the hand moves from the center, the faster the cursor moves.
    - **Stop**: Returning the hand to the center stops the cursor immediately.

### Benefits
- **Field of View Safety**: The user's hand remains largely centered in the camera frame, ensuring stable tracking.
- **Ergonomics**: Small, comfortable wrist movements control the entire screen; no large arm waves required.
- **Precision**: Users can "nudge" the cursor by briefly dipping out of the neutral zone.

---

## 4. Interaction Primitive: Click

| Action | Gesture | Type | Rationale |
|---|---|---|---|
| **Left Click** | **Pinch** (Thumb touches Index) | Static (Momentary) | The "Pinch" mimics physically picking up an object. It is biomechanically distinct from the "Open Palm" (Neutral) state, reducing false positives. |

- **Feedback**: Cursor visual state changes (e.g., shrinks or changes color) immediately upon detection.
- **Debounce**: 1.0 Second cooldown after a click to prevent accidental double-clicks.

---

## 5. Scrolling (Cursor Mode)

To allow reading without exiting Cursor Mode, simple static postures control scrolling. Movement is continuous while the gesture is held.

| Action | Gesture | Rationale |
|---|---|---|
| **Scroll Down** | **Index + Pinky** ("Rock" 🤘) | Distinct "Horns" gesture, separate from Victory. |
| **Scroll Up** | **Victory / Peace** ("Two" ✌️) | Standard extension of the index finger gesture. Easy to transition. |

- **Behavior**: Constant speed scrolling while held. Stops immediately when gesture changes.
- **Constraint**: No finger-isolated gestures (e.g., Pinky only) to ensure robust detection in poor lighting.

---

## 6. Safety & Usability Constraints

1.  **Fail-Safe Exit**: The "Fist" gesture must *always* override any other interaction to exit Cursor Mode immediately.
2.  **No Cursor Trapping**: The virtual cursor must never become "stuck" or prevent the user from switching modes.
3.  **Visual Feedback**:
    - **Cursor Mode Active**: Cursor is Red/High-Contrast.
    - **Click Registered**: Cursor flashes Blue-White.
    - **Neutral Zone**: Optional faint overlay to guide user hand placement.
4.  **Conflict Prevention**: While in Cursor Mode, the "Open Palm" gesture (used to *enter* mode) is ignored or treated as a Neutral/Stop drift command.

---

## 7. MVP Gesture Table

| Gesture | Mode | Type | Action |
|---|---|---|---|
| **Open Palm** | Normal | Static Hold (1.5s) | **Enter Cursor Mode** |
| **Fist** | Cursor | Static Hold (0.5s) | **Exit Cursor Mode** |
| **Index Move** | Cursor | Relative Motion | **Move Cursor** (Joystick style) |
| **Pinch** | Cursor | Momentary | **Click** (at cursor loc) |
| **Rock (🤘)** | Cursor | Continuous Hold | **Scroll Down** |
| **Victory (✌️)** | Cursor | Continuous Hold | **Scroll Up** |
| **Swipe L/R** | Normal | Dynamic Motion | **Focus Next/Prev** (Existing) |
| **Fist** | Normal | Dynamic | **Scroll Up** (Existing Legacy) |
| **Open Palm** | Normal | Dynamic | **Scroll Down** (Existing Legacy) |

> *Note: Legacy normal mode gestures (Fist/Open Palm for scroll) function only when NOT holding for mode switch.*

---

## 8. Out of Scope (MVP)

The following features are explicitly excluded to ensure a shippable MVP:
- **Pixel-Perfect Accuracy**: The relative drift model is for general accessibility, not graphic design.
- **Drag & Drop**: Requires complex "Hold Pinch + Move" logic which is prone to tracking loss.
- **Text Selection**: Too precise for MVP relative movement.
- **Mobile Browsers**: Computationally too heavy for reliable JS-based tracking on low-end mobile.
- **Tremor Suppression**: Basic smoothing only; advanced Kalman filters not included.
