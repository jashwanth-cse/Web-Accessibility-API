from pydantic import BaseModel, Field
from typing import Optional


class GestureEvaluateRequest(BaseModel):
    site_id: str
    gesture: str
    confidence: float = Field(ge=0.0, le=1.0)


class GestureEvaluateResponse(BaseModel):
    execute: bool
    action: str | None
    reason: str


class GestureConfigRequest(BaseModel):
    site_id: str
    gesture: str
    action: str


class GestureConfigResponse(BaseModel):
    site_id: str
    gesture: str
    action: str
    message: str


class SiteConfigResponse(BaseModel):
    site_id: str
    enabled_gestures: Optional[list[str]] = None
    confidence_threshold: float
    cooldown_ms: int
    profile: str


class SiteConfigUpdateRequest(BaseModel):
    site_id: str
    enabled_gestures: Optional[list[str]] = None
    confidence_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    cooldown_ms: Optional[int] = Field(None, ge=0)
    profile: Optional[str] = None


