import logging
import os

from fastapi import APIRouter, Depends
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.organizations import Organization
from src.core.events.database import get_db_session
from src.core.ee_hooks import is_multi_org_allowed
from src.core.deployment_mode import get_deployment_mode
from src.services.orgs.cache import get_cached_instance_info, set_cached_instance_info
from config.config import get_learnhouse_config

router = APIRouter()
logger = logging.getLogger(__name__)


def _configured_org_slug() -> str:
    """The single org this deployment serves (same env var the installer uses)."""
    return os.environ.get("LEARNHOUSE_INITIAL_ORG_SLUG", "").strip().lower()


def _strip_port(domain: str) -> str:
    """Strip port from a domain string (e.g. 'localhost:3000' -> 'localhost')."""
    return domain.split(":")[0] if ":" in domain else domain


@router.get(
    "/info",
    summary="Get instance info",
    description=(
        "Public endpoint returning instance configuration (deployment mode, default org slug, "
        "frontend domain, and multi-org flag). Result is cached for performance."
    ),
    responses={
        200: {"description": "Instance configuration for the current deployment."},
    },
)
async def get_instance_info(db_session: AsyncSession = Depends(get_db_session)):
    """Public endpoint returning instance configuration."""
    cached = get_cached_instance_info()
    if cached is not None:
        return cached

    configured_slug = _configured_org_slug()
    default_org = None
    try:
        # Prefer the configured org, then the conventional "default" slug,
        # then whatever org exists — this fork serves a single org.
        for slug in dict.fromkeys(s for s in (configured_slug, "default") if s):
            statement = select(Organization).where(Organization.slug == slug)
            default_org = (await db_session.execute(statement)).scalars().first()
            if default_org:
                break
        if not default_org:
            statement = select(Organization).order_by(Organization.id).limit(1)
            default_org = (await db_session.execute(statement)).scalars().first()
    except Exception:
        # e.g. Neon waking from suspend. Answer with the configured slug but
        # don't cache it, so the next request retries the real lookup.
        logger.warning("Instance info: organization lookup failed", exc_info=True)

    default_org_slug = default_org.slug if default_org else (configured_slug or "default")

    config = get_learnhouse_config()
    frontend_domain = config.hosting_config.frontend_domain
    top_domain = _strip_port(frontend_domain)
    tenancy = config.hosting_config.tenancy

    result = {
        "mode": get_deployment_mode(),
        "tenancy": tenancy,
        # Deprecated: prefer `tenancy`. Will be removed in a future release.
        "multi_org_enabled": tenancy == "multi" and is_multi_org_allowed(),
        "default_org_slug": default_org_slug,
        "frontend_domain": frontend_domain,
        "top_domain": top_domain,
    }

    # Only cache a slug that was confirmed against the database; caching a
    # fallback would serve "org not found" for the whole 10-minute TTL.
    if default_org:
        set_cached_instance_info(result)
    return result
