from sqlalchemy.orm import Session
from app.models import GestureEvent, GestureConfig
from app.schemas import (
    GestureEvaluateRequest,
    GestureEvaluateResponse,
    GestureConfigRequest,
    GestureConfigResponse,
)
from datetime import datetime
from typing import Dict, Tuple, Optional

# Gesture to action mapping
GESTURE_ACTION_MAP = {
    "open_palm": "scroll_down",
    "fist": "scroll_up",
    "swipe_left": "focus_previous",
    "swipe_right": "focus_next",
    "pinch": "click",
}

CONFIDENCE_THRESHOLD = 0.7
COOLDOWN_MS = 600  # Cooldown period in milliseconds


class CooldownManager:
    """Manages gesture cooldown state in memory."""

    def __init__(self):
        # Dictionary to store last execution time per (site_id, gesture)
        self._last_execution: Dict[Tuple[str, str], datetime] = {}

    def is_in_cooldown(self, site_id: str, gesture: str) -> bool:
        """
        Check if a gesture is currently in cooldown period.

        Args:
            site_id: The site identifier
            gesture: The gesture name

        Returns:
            True if gesture is in cooldown, False otherwise
        """
        key = (site_id, gesture)
        if key not in self._last_execution:
            return False

        last_time = self._last_execution[key]
        current_time = datetime.utcnow()
        elapsed_ms = (current_time - last_time).total_seconds() * 1000

        return elapsed_ms < COOLDOWN_MS

    def update_execution_time(self, site_id: str, gesture: str) -> None:
        """
        Update the last execution time for a gesture.

        Args:
            site_id: The site identifier
            gesture: The gesture name
        """
        key = (site_id, gesture)
        self._last_execution[key] = datetime.utcnow()


# Global cooldown manager instance
cooldown_manager = CooldownManager()


class ConfigService:
    """Service layer for gesture configuration management."""

    @staticmethod
    def save_gesture_mapping(
        request: GestureConfigRequest, db: Session
    ) -> GestureConfigResponse:
        """
        Save or update a site-specific gesture-to-action mapping.

        Args:
            request: The configuration request
            db: Database session

        Returns:
            GestureConfigResponse with saved configuration
        """
        # Check if mapping already exists
        existing_config = (
            db.query(GestureConfig)
            .filter(
                GestureConfig.site_id == request.site_id,
                GestureConfig.gesture == request.gesture,
            )
            .first()
        )

        if existing_config:
            # Update existing mapping
            existing_config.action = request.action
            message = "Gesture mapping updated successfully"
        else:
            # Create new mapping
            new_config = GestureConfig(
                site_id=request.site_id,
                gesture=request.gesture,
                action=request.action,
            )
            db.add(new_config)
            message = "Gesture mapping created successfully"

        db.commit()

        return GestureConfigResponse(
            site_id=request.site_id,
            gesture=request.gesture,
            action=request.action,
            message=message,
        )

    @staticmethod
    def get_action_for_gesture(site_id: str, gesture: str, db: Session) -> Optional[str]:
        """
        Get the action for a gesture, checking site-specific config first.

        Args:
            site_id: The site identifier
            gesture: The gesture name
            db: Database session

        Returns:
            Action string if found, None otherwise
        """
        # Check site-specific configuration first
        config = (
            db.query(GestureConfig)
            .filter(
                GestureConfig.site_id == site_id,
                GestureConfig.gesture == gesture,
            )
            .first()
        )

        if config:
            return config.action

        # Fallback to default mapping
        return GESTURE_ACTION_MAP.get(gesture)


class GestureService:
    """Service layer for gesture evaluation logic."""

    @staticmethod
    def evaluate_gesture(
        request: GestureEvaluateRequest, db: Session
    ) -> GestureEvaluateResponse:
        """
        Evaluate a gesture and determine if it should be executed.

        Args:
            request: The gesture evaluation request
            db: Database session

        Returns:
            GestureEvaluateResponse with execution decision
        """
        # Check confidence threshold
        if request.confidence < CONFIDENCE_THRESHOLD:
            return GestureEvaluateResponse(
                execute=False,
                action=None,
                reason=f"Confidence {request.confidence} below threshold {CONFIDENCE_THRESHOLD}",
            )

        # Get action for gesture (site-specific or default)
        action = ConfigService.get_action_for_gesture(
            request.site_id, request.gesture, db
        )

        if action is None:
            return GestureEvaluateResponse(
                execute=False,
                action=None,
                reason=f"Unknown gesture: {request.gesture}",
            )

        # Check cooldown
        if cooldown_manager.is_in_cooldown(request.site_id, request.gesture):
            return GestureEvaluateResponse(
                execute=False,
                action=action,
                reason="cooldown_active",
            )

        # Save gesture event to database
        gesture_event = GestureEvent(
            site_id=request.site_id,
            gesture=request.gesture,
            confidence=request.confidence,
            timestamp=datetime.utcnow(),
        )
        db.add(gesture_event)
        db.commit()
        db.refresh(gesture_event)

        # Update cooldown timestamp after successful execution
        cooldown_manager.update_execution_time(request.site_id, request.gesture)

        return GestureEvaluateResponse(
            execute=True,
            action=action,
            reason="Gesture recognized and validated",
        )

