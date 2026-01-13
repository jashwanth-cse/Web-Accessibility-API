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
)
from app.services import GestureService, ConfigService

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

