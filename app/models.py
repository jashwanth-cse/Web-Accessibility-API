from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey
from datetime import datetime
from app.database import Base


class Site(Base):
    __tablename__ = "sites"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


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

