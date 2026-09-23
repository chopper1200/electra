"""Server-side date helpers. The pod clock is UTC — anchor "today" here, never in the browser."""

import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


def today_iso(tz: str | None = None) -> str:
    """Today's date as YYYY-MM-DD in `tz` (default: APP_TZ env, else UTC)."""
    zone = tz or os.environ.get("APP_TZ", "UTC")
    return datetime.now(ZoneInfo(zone)).strftime("%Y-%m-%d")


def current_month_iso(tz: str | None = None) -> str:
    """Current month as YYYY-MM in `tz` (default: APP_TZ env, else UTC)."""
    return today_iso(tz)[:7]


def giorni_tra(da_iso: str, a_iso: str) -> int:
    """Whole days from `da_iso` to `a_iso` (both YYYY-MM-DD); negative if a < da."""
    fmt = "%Y-%m-%d"
    return (datetime.strptime(a_iso, fmt) - datetime.strptime(da_iso, fmt)).days


def aggiungi_giorni(iso: str, giorni: int) -> str:
    """Date `iso` (YYYY-MM-DD) shifted by `giorni` days."""
    base = datetime.strptime(iso, "%Y-%m-%d") + timedelta(days=giorni)
    return base.strftime("%Y-%m-%d")
