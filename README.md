# Accessibility API

A minimal FastAPI backend project.

## Requirements

- Python 3.10+

## Setup

1. **Create a virtual environment:**
   ```bash
   python -m venv venv
   ```

2. **Activate the virtual environment:**
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - Linux/Mac:
     ```bash
     source venv/bin/activate
     ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

Start the development server with uvicorn:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

## Database

The application uses SQLite for data persistence with SQLAlchemy ORM.

**Database file:** `app.db` (created automatically on first run)

**Models:**
- **Site** - Represents a site/location
  - `id` (string, primary key)
  - `name` (string)
  - `created_at` (datetime)

- **SiteConfig** - Site-specific configuration settings
  - `site_id` (string, primary key, foreign key to Site.id)
  - `enabled_gestures` (JSON stored as TEXT, list of enabled gesture strings)
  - `confidence_threshold` (float, default 0.7)
  - `cooldown_ms` (int, default 800)
  - `profile` (string, default "default")

- **GestureEvent** - Represents gesture recognition events
  - `id` (int, primary key, auto-increment)
  - `site_id` (string, foreign key to Site.id)
  - `gesture` (string)
  - `confidence` (float)
  - `timestamp` (datetime)

- **GestureConfig** - Site-specific gesture-to-action mappings
  - `site_id` (string, primary key)
  - `gesture` (string, primary key)
  - `action` (string)

Tables are created automatically when the application starts.

## API Endpoints

- **GET /health** - Health check endpoint
  - Response: `{"status": "ok"}`

- **POST /api/v1/config/mapping** - Configure site-specific gesture mappings
  - Request body:
    ```json
    {
      "site_id": "string",
      "gesture": "string",
      "action": "string"
    }
    ```
  - Response:
    ```json
    {
      "site_id": "string",
      "gesture": "string",
      "action": "string",
      "message": "Gesture mapping created/updated successfully"
    }
    ```
  - Site-specific mappings override default mappings

- **GET /api/v1/config/site/{site_id}** - Get site configuration
  - Path parameter:
    - `site_id` (string)
  - Response:
    ```json
    {
      "site_id": "string",
      "enabled_gestures": ["gesture1", "gesture2"] or null,
      "confidence_threshold": 0.7,
      "cooldown_ms": 800,
      "profile": "default"
    }
    ```
  - Creates default config if site config doesn't exist

- **POST /api/v1/config/site** - Update site configuration
  - Request body (all fields except site_id are optional):
    ```json
    {
      "site_id": "string",
      "enabled_gestures": ["pinch", "open_palm"],
      "confidence_threshold": 0.8,
      "cooldown_ms": 600,
      "profile": "high_precision"
    }
    ```
  - Response: Same as GET response
  - Only updates provided fields
  - Creates config with defaults if it doesn't exist
  - **Accessibility Profiles**: When setting a profile, default values are applied:
    - `default`: confidence 0.7, cooldown 800ms, all gestures enabled
    - `elderly`: confidence 0.6, cooldown 1200ms, only ["open_palm", "fist"]
    - `motor_impaired`: confidence 0.5, cooldown 1500ms, only ["open_palm"]
  - Explicit config values override profile defaults

- **POST /api/v1/gesture/evaluate** - Evaluate a gesture and determine action
  - Request body:
    ```json
    {
      "site_id": "string",
      "gesture": "string",
      "confidence": 0.0-1.0
    }
    ```
  - Response:
    ```json
    {
      "execute": true/false,
      "action": "string or null",
      "reason": "string"
    }
    ```
  - **Behavior**:
    - Loads site configuration (creates default if doesn't exist)
    - Checks if gesture is in `enabled_gestures` for the site
    - Uses site-specific `confidence_threshold`
    - Uses site-specific `cooldown_ms`
  - **Response reasons**:
    - `gesture_disabled` - Gesture not enabled for this site
    - `confidence_too_low` - Below site's confidence threshold
    - `cooldown_active` - Still in cooldown period
    - `gesture_accepted` - Gesture executed successfully
    - `Unknown gesture: {name}` - Gesture has no action mapping
  - Default supported gestures:
    - `open_palm` → `scroll_down`
    - `fist` → `scroll_up`
    - `swipe_left` → `focus_previous`
    - `swipe_right` → `focus_next`
    - `pinch` → `click`
  - Site-specific gesture mappings override defaults (see /api/v1/config/mapping)

## API Documentation

Once the server is running, you can access:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
