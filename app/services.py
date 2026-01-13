from sqlalchemy.orm import Session
from app.models import GestureEvent, GestureConfig, SiteConfig
from app.schemas import (
    GestureEvaluateRequest,
    GestureEvaluateResponse,
    GestureConfigRequest,
    GestureConfigResponse,
    SiteConfigResponse,
    SiteConfigUpdateRequest,
)
from datetime import datetime
from typing import Dict, Tuple, Optional
from fastapi import HTTPException

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

# Accessibility Profiles
PROFILES = {
    "default": {
        "confidence_threshold": 0.7,
        "cooldown_ms": 800,
        "enabled_gestures": ["open_palm", "fist", "swipe_left", "swipe_right", "pinch"],
    },
    "elderly": {
        "confidence_threshold": 0.6,
        "cooldown_ms": 1200,
        "enabled_gestures": ["open_palm", "fist"],
    },
    "motor_impaired": {
        "confidence_threshold": 0.5,
        "cooldown_ms": 1500,
        "enabled_gestures": ["open_palm"],
    },
}


def get_profile_defaults(profile_name: str) -> dict:
    """
    Get default configuration for a profile.

    Args:
        profile_name: Name of the profile

    Returns:
        Dictionary with profile defaults
    """
    return PROFILES.get(profile_name, PROFILES["default"]).copy()


class CooldownManager:
    """Manages gesture cooldown state in memory."""

    def __init__(self):
        # Dictionary to store last execution time per (site_id, gesture)
        self._last_execution: Dict[Tuple[str, str], datetime] = {}

    def is_in_cooldown(self, site_id: str, gesture: str, cooldown_ms: int) -> bool:
        """
        Check if a gesture is currently in cooldown period.

        Args:
            site_id: The site identifier
            gesture: The gesture name
            cooldown_ms: Cooldown period in milliseconds

        Returns:
            True if gesture is in cooldown, False otherwise
        """
        key = (site_id, gesture)
        if key not in self._last_execution:
            return False

        last_time = self._last_execution[key]
        current_time = datetime.utcnow()
        elapsed_ms = (current_time - last_time).total_seconds() * 1000

        return elapsed_ms < cooldown_ms

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



class SiteConfigService:
    """Service layer for site configuration management."""

    @staticmethod
    def get_site_config(site_id: str, db: Session) -> SiteConfigResponse:
        """
        Get site configuration. Creates default config if it doesn't exist.

        Returns effective configuration with profile defaults merged with explicit values.

        Args:
            site_id: The site identifier
            db: Database session

        Returns:
            SiteConfigResponse with site configuration
        """
        config = db.query(SiteConfig).filter(SiteConfig.site_id == site_id).first()

        if not config:
            # Create default configuration
            profile_defaults = get_profile_defaults("default")
            config = SiteConfig(
                site_id=site_id,
                confidence_threshold=profile_defaults["confidence_threshold"],
                cooldown_ms=profile_defaults["cooldown_ms"],
                profile="default",
            )
            config.set_enabled_gestures(profile_defaults["enabled_gestures"])
            db.add(config)
            db.commit()
            db.refresh(config)

        return SiteConfigResponse(
            site_id=config.site_id,
            enabled_gestures=config.get_enabled_gestures(),
            confidence_threshold=config.confidence_threshold,
            cooldown_ms=config.cooldown_ms,
            profile=config.profile,
        )

    @staticmethod
    def update_site_config(
        request: SiteConfigUpdateRequest, db: Session
    ) -> SiteConfigResponse:
        """
        Update site configuration with profile support.

        When profile is set, applies profile defaults then overlays explicit values.
        Explicit config values always override profile defaults.

        Args:
            request: The configuration update request
            db: Database session

        Returns:
            SiteConfigResponse with updated configuration
        """
        config = (
            db.query(SiteConfig).filter(SiteConfig.site_id == request.site_id).first()
        )

        # Determine if profile is being changed
        profile_changed = False
        new_profile = request.profile if request.profile is not None else (config.profile if config else "default")
        
        if not config:
            # Create new configuration
            config = SiteConfig(site_id=request.site_id)
            db.add(config)
            profile_changed = True
        elif request.profile is not None and request.profile != config.profile:
            profile_changed = True

        # If profile changed, apply profile defaults first
        if profile_changed:
            profile_defaults = get_profile_defaults(new_profile)
            config.profile = new_profile
            
            # Apply profile defaults (will be overridden by explicit values below)
            config.confidence_threshold = profile_defaults["confidence_threshold"]
            config.cooldown_ms = profile_defaults["cooldown_ms"]
            config.set_enabled_gestures(profile_defaults["enabled_gestures"])

        # Apply explicit values - these override profile defaults
        if request.enabled_gestures is not None:
            config.set_enabled_gestures(request.enabled_gestures)

        if request.confidence_threshold is not None:
            config.confidence_threshold = request.confidence_threshold

        if request.cooldown_ms is not None:
            config.cooldown_ms = request.cooldown_ms

        # If profile wasn't explicitly set but we're creating new config, use default
        if not config.profile:
            config.profile = "default"

        db.commit()
        db.refresh(config)

        return SiteConfigResponse(
            site_id=config.site_id,
            enabled_gestures=config.get_enabled_gestures(),
            confidence_threshold=config.confidence_threshold,
            cooldown_ms=config.cooldown_ms,
            profile=config.profile,
        )



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

        Respects site-specific configuration including enabled gestures,
        confidence threshold, and cooldown period.

        Args:
            request: The gesture evaluation request
            db: Database session

        Returns:
            GestureEvaluateResponse with execution decision
        """
        # Load site configuration (creates default if doesn't exist)
        site_config = SiteConfigService.get_site_config(request.site_id, db)

        # Check if gesture is enabled for this site
        if site_config.enabled_gestures is not None:
            if request.gesture not in site_config.enabled_gestures:
                return GestureEvaluateResponse(
                    execute=False,
                    action=None,
                    reason="gesture_disabled",
                )

        # Check site-specific confidence threshold
        if request.confidence < site_config.confidence_threshold:
            return GestureEvaluateResponse(
                execute=False,
                action=None,
                reason="confidence_too_low",
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

        # Check cooldown using site-specific cooldown period
        if cooldown_manager.is_in_cooldown(
            request.site_id, request.gesture, site_config.cooldown_ms
        ):
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
            reason="gesture_accepted",
        )



