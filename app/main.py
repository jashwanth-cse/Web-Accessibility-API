from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import engine, Base, get_db
from app import models
from app.schemas import (
    GestureEvaluateRequest,
    GestureEvaluateResponse,
    GestureConfigRequest,
    GestureConfigResponse,
    SiteConfigResponse,
    SiteConfigUpdateRequest,
)
from app.services import GestureService, ConfigService, SiteConfigService

app = FastAPI()

# CORS configuration - allowing all origins for MVP
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Create database tables on startup."""
    Base.metadata.create_all(bind=engine)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/api/v1/gesture/evaluate", response_model=GestureEvaluateResponse)
async def evaluate_gesture(
    request: GestureEvaluateRequest, db: Session = Depends(get_db)
):
    """
    Evaluate a gesture and determine if it should be executed.

    Checks confidence threshold and maps gestures to actions.
    Saves valid gesture events to the database.
    """
    return GestureService.evaluate_gesture(request, db)


@app.post("/api/v1/config/mapping", response_model=GestureConfigResponse)
async def save_gesture_mapping(
    request: GestureConfigRequest, db: Session = Depends(get_db)
):
    """
    Save or update a site-specific gesture-to-action mapping.

    Site-specific mappings take precedence over default mappings.
    """
    return ConfigService.save_gesture_mapping(request, db)


@app.get("/api/v1/config/site/{site_id}", response_model=SiteConfigResponse)
async def get_site_config(site_id: str, db: Session = Depends(get_db)):
    """
    Get site configuration. Creates default config if it doesn't exist.

    Returns site-specific settings including enabled gestures, thresholds, and cooldown.
    """
    return SiteConfigService.get_site_config(site_id, db)


@app.post("/api/v1/config/site", response_model=SiteConfigResponse)
async def update_site_config(
    request: SiteConfigUpdateRequest, db: Session = Depends(get_db)
):
    """
    Update site configuration. Creates if doesn't exist.

    Only updates the fields that are provided in the request.
    """
    return SiteConfigService.update_site_config(request, db)


