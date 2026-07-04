"""Tenancy-aware CORS configuration."""

import re
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.config import get_learnhouse_config


_SINGLE_TENANCY_LOCALHOST_REGEX = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"


def _host_from(value: str) -> str:
    """Extract a bare hostname from a config value that may be a host or URL."""
    value = (value or "").strip().rstrip("/")
    if not value:
        return ""
    host = urlparse(value).hostname if "://" in value else value
    return (host or "").removeprefix("www.").lower()


def _single_tenancy_origin_regex(config) -> str:
    """Build a CORS origin regex pinned to the configured host(s)."""
    hosts = set()
    for cfg_value in (
        config.hosting_config.frontend_domain,
        config.hosting_config.domain,
    ):
        host = _host_from(cfg_value)
        if host and host not in ("localhost", "127.0.0.1"):
            hosts.add(host)

    if not hosts:
        return _SINGLE_TENANCY_LOCALHOST_REGEX

    host_alternation = "|".join(
        rf"(?:www\.)?{re.escape(h)}" for h in sorted(hosts)
    )
    return (
        rf"^https?://(?:{host_alternation}|localhost|127\.0\.0\.1)(:\d+)?$"
    )


def get_cors_origin_regex() -> str:
    """
    Compute the regex for ``CORSMiddleware``'s ``allow_origin_regex`` based on
    the active tenancy mode.
    """
    config = get_learnhouse_config()
    if config.hosting_config.tenancy == "single":
        return _single_tenancy_origin_regex(config)
    allowed_regexp = config.hosting_config.allowed_regexp
    if allowed_regexp:
        return allowed_regexp
    domain = _host_from(config.hosting_config.domain)
    if domain:
        return rf"^https?://(?:[a-z0-9-]+\.)*{re.escape(domain)}(:\d+)?$"
    return _SINGLE_TENANCY_LOCALHOST_REGEX


def configure_cors(app: FastAPI) -> None:
    """Register CORS middleware on ``app`` with tenancy-aware origin policy."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://learnhouse.lhscommons.org",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_origin_regex=get_cors_origin_regex(),
        allow_methods=["*"],
        allow_credentials=True,
        allow_headers=["*"],
    )