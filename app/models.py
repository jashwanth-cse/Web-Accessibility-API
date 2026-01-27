from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, Boolean
from datetime import datetime
from app.database import Base
import json


class Site(Base):
    __tablename__ = "sites"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SiteConfig(Base):
    __tablename__ = "site_configs"

    site_id = Column(String, ForeignKey("sites.id"), primary_key=True, nullable=False)
    enabled_gestures = Column(Text, nullable=True)  # JSON stored as TEXT for SQLite
    confidence_threshold = Column(Float, default=0.7, nullable=False)
    cooldown_ms = Column(Integer, default=800, nullable=False)
    profile = Column(String, default="default", nullable=False)
    cursor_mode_enabled = Column(Boolean, default=True, nullable=False)


    def get_enabled_gestures(self):
        """Parse enabled_gestures from JSON string."""
        if self.enabled_gestures:
            return json.loads(self.enabled_gestures)
        return None

    def set_enabled_gestures(self, gestures_list):
        """Store enabled_gestures as JSON string."""
        if gestures_list is not None:
            self.enabled_gestures = json.dumps(gestures_list)
        else:
            self.enabled_gestures = None


class GestureEvent(Base):
    __tablename__ = "gesture_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    site_id = Column(String, ForeignKey("sites.id"), nullable=False)
    gesture = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)


class GestureConfig(Base):
    __tablename__ = "gesture_configs"

    site_id = Column(String, primary_key=True, nullable=False)
    gesture = Column(String, primary_key=True, nullable=False)
    action = Column(String, nullable=False)


