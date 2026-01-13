from pydantic import BaseModel, Field


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

