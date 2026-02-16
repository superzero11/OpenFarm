"""Email service — powered by Resend (https://resend.com)."""

from __future__ import annotations

import httpx

from app.core.config import settings
from app.core.logging import logger

RESEND_API_URL = "https://api.resend.com/emails"


async def _send(to: str, subject: str, html: str) -> dict | None:
    """Send an email via Resend. Returns None when Resend is not configured."""
    if not settings.resend_api_key:
        logger.info("resend_skipped", reason="RESEND_API_KEY not set", to=to)
        return None

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.resend_from_email,
                "to": [to],
                "subject": subject,
                "html": html,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        logger.info("email_sent", to=to, resend_id=data.get("id"))
        return data


async def send_invite_email(
    *,
    to_email: str,
    org_name: str,
    role: str,
    invited_by_name: str,
) -> dict | None:
    """Send a workspace invite notification."""
    subject = f"You've been invited to {org_name} on OpenFarm"
    html = f"""\
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
  <h2 style="margin: 0 0 16px; font-size: 20px; color: #111;">
    You're invited to <strong>{org_name}</strong>
  </h2>
  <p style="margin: 0 0 12px; font-size: 15px; color: #333; line-height: 1.5;">
    <strong>{invited_by_name}</strong> has invited you to join
    <strong>{org_name}</strong> as a <strong>{role}</strong>.
  </p>
  <p style="margin: 0 0 24px; font-size: 15px; color: #333; line-height: 1.5;">
    Sign in with your Google account to accept and start collaborating:
  </p>
  <a href="{settings.app_url}"
     style="display: inline-block; padding: 12px 28px; background: #16a34a; color: #fff;
            text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
    Open OpenFarm
  </a>
  <p style="margin: 24px 0 0; font-size: 13px; color: #888; line-height: 1.4;">
    If you weren't expecting this invitation, you can safely ignore this email.
  </p>
</div>
"""
    return await _send(to_email, subject, html)
