from pydantic_settings import BaseSettings
from pathlib import Path

# Backend root — always resolve relative to THIS file, not CWD
_BACKEND_DIR = Path(__file__).parent.resolve()
_PROJECT_DIR = _BACKEND_DIR.parent


class Settings(BaseSettings):
    gemini_api_key: str = ""
    baseline_dir: str = str(_PROJECT_DIR / "baselines")
    captures_dir: str = str(_PROJECT_DIR / "captures")
    reports_dir: str = str(_PROJECT_DIR / "reports")
    evidence_dir: str = str(_PROJECT_DIR / "evidence")
    site_username: str = ""
    site_password: str = ""
    log_level: str = "INFO"

    model_config = {
        "env_file": str(_BACKEND_DIR / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    def ensure_dirs(self):
        for d in [self.baseline_dir, self.captures_dir, self.reports_dir, self.evidence_dir]:
            Path(d).mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
