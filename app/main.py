from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import engine, Base, get_db, SessionLocal
from app import models
from app.models import Site, SiteConfig
from app.schemas import (
    GestureEvaluateRequest,
    GestureEvaluateResponse,
    GestureConfigRequest,
    GestureConfigResponse,
    SiteConfigResponse,
    SiteConfigUpdateRequest,
)
from app.services import GestureService, ConfigService, SiteConfigService, get_profile_defaults

app = FastAPI()

# CORS configuration - allowing all origins for MVP
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def initialize_site_configs():
    """Create default SiteConfig for existing sites without configuration."""
    db = SessionLocal()
    try:
        # Get all sites
        sites = db.query(Site).all()
        
        for site in sites:
            # Check if site has config
            existing_config = db.query(SiteConfig).filter(
                SiteConfig.site_id == site.id
            ).first()
            
            if not existing_config:
                # Create default config
                profile_defaults = get_profile_defaults("default")
                config = SiteConfig(
                    site_id=site.id,
                    confidence_threshold=profile_defaults["confidence_threshold"],
                    cooldown_ms=profile_defaults["cooldown_ms"],
                    profile="default",
                )
                config.set_enabled_gestures(profile_defaults["enabled_gestures"])
                db.add(config)
                print(f"Created default SiteConfig for site: {site.id}")
        
        db.commit()
    finally:
        db.close()


@app.on_event("startup")
async def startup_event():
    """Create database tables and initialize site configurations on startup."""
    Base.metadata.create_all(bind=engine)
    initialize_site_configs()



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


