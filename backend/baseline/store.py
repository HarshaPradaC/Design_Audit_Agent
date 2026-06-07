"""SQLite-backed baseline store with versioned filesystem screenshots."""
import json
import uuid
from pathlib import Path
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, Boolean, DateTime, Text, text
from sqlalchemy.orm import DeclarativeBase, Session
from schemas import BaselineEntry
from config import settings


DB_PATH = Path(settings.baseline_dir) / "baselines.db"


class Base(DeclarativeBase):
    pass


class BaselineRow(Base):
    __tablename__ = "baselines"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    page = Column(String, nullable=False, index=True)
    screenshot_path = Column(String)
    ui_state_path = Column(String, nullable=True)
    annotated_url = Column(String, nullable=True)
    version = Column(Integer, default=1)
    approved = Column(Boolean, default=True)
    approved_by = Column(String, default="auto")
    report_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(f"sqlite:///{DB_PATH}", echo=False)
        Base.metadata.create_all(_engine)
        # Safe migration: add annotated_url column to existing DBs that predate it
        with _engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE baselines ADD COLUMN annotated_url VARCHAR"))
                conn.commit()
            except Exception:
                pass  # Column already exists — ignore
    return _engine


class BaselineStore:

    def _session(self) -> Session:
        return Session(_get_engine())

    def save(
        self,
        page_name: str,
        screenshot_bytes: bytes,
        approved: bool = True,
        report_summary: dict | None = None,
        ui_state_path: str | None = None,
        annotated_url: str | None = None,
    ) -> BaselineEntry:
        with self._session() as session:
            version = self._get_next_version(page_name, session)
            path = Path(settings.baseline_dir) / f"{page_name}_v{version}.png"
            with open(path, "wb") as f:
                f.write(screenshot_bytes)

            row = BaselineRow(
                id=str(uuid.uuid4()),
                page=page_name,
                screenshot_path=str(path),
                ui_state_path=ui_state_path,
                annotated_url=annotated_url,
                version=version,
                approved=approved,
                approved_by="auto",
                report_summary=json.dumps(report_summary) if report_summary else None,
                created_at=datetime.utcnow(),
            )
            session.add(row)
            session.commit()

            return BaselineEntry(
                baseline_id=row.id,
                page=page_name,
                created_at=row.created_at,
                approved=approved,
                screenshot_path=str(path),
                ui_state_path=ui_state_path,
                annotated_url=annotated_url,
                version=version,
            )

    def get(self, page_name: str) -> BaselineEntry | None:
        with self._session() as session:
            row = (
                session.query(BaselineRow)
                .filter_by(page=page_name, approved=True)
                .order_by(BaselineRow.version.desc())
                .first()
            )
            if not row:
                return None
            return BaselineEntry(
                baseline_id=row.id,
                page=page_name,
                created_at=row.created_at,
                approved=row.approved,
                screenshot_path=row.screenshot_path,
                ui_state_path=row.ui_state_path,
                annotated_url=row.annotated_url,
                version=row.version,
            )

    def get_latest_capture(self, page_name: str) -> bytes | None:
        path = Path(settings.captures_dir) / f"{page_name}_latest.png"
        if path.exists():
            return path.read_bytes()
        return None

    def refresh(self, page_name: str) -> BaselineEntry | None:
        latest_bytes = self.get_latest_capture(page_name)
        if not latest_bytes:
            return None
        return self.save(page_name, latest_bytes, approved=True)

    def _get_next_version(self, page_name: str, session: Session) -> int:
        last = (
            session.query(BaselineRow)
            .filter_by(page=page_name)
            .order_by(BaselineRow.version.desc())
            .first()
        )
        return (last.version + 1) if last else 1

    def list_pages(self) -> list[str]:
        with self._session() as session:
            rows = session.query(BaselineRow.page).distinct().all()
            return [r.page for r in rows]
