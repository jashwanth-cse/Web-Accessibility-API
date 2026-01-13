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
  - Supported gestures:
    - `open_palm` → `scroll_down`
    - `fist` → `scroll_up`
    - `swipe_left` → `focus_previous`
    - `swipe_right` → `focus_next`
    - `pinch` → `click`
  - Minimum confidence threshold: 0.7
  - Cooldown: 600ms per site+gesture (prevents rapid-fire execution)
  - Cooldown blocked gestures return `execute: false` with `reason: "cooldown_active"`

## API Documentation

Once the server is running, you can access:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
