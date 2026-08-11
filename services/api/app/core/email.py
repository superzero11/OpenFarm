"""Email service - powered by Resend (https://resend.com)."""

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


async def send_ownership_transferred_email(
    *,
    to_email: str,
    org_name: str,
    is_new_owner: bool,
    other_party_name: str,
) -> dict | None:
    """Notify both parties about an ownership transfer."""
    if is_new_owner:
        subject = f"You are now the owner of {org_name} on OpenFarm"
        body_text = (
            f"<strong>{other_party_name}</strong> has transferred ownership of "
            f"<strong>{org_name}</strong> to you. You now have full control over "
            f"this workspace, including managing members and settings."
        )
    else:
        subject = f"Ownership of {org_name} has been transferred"
        body_text = (
            f"You have transferred ownership of <strong>{org_name}</strong> to "
            f"<strong>{other_party_name}</strong>. Your role has been changed to "
            f"<strong>admin</strong>."
        )
    html = f"""\
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
  <h2 style="margin: 0 0 16px; font-size: 20px; color: #111;">
    Ownership Transfer - {org_name}
  </h2>
  <p style="margin: 0 0 24px; font-size: 15px; color: #333; line-height: 1.5;">
    {body_text}
  </p>
  <a href="{settings.app_url}"
     style="display: inline-block; padding: 12px 28px; background: #16a34a; color: #fff;
            text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
    Open OpenFarm
  </a>
</div>
"""
    return await _send(to_email, subject, html)


async def send_invite_accepted_email(
    *,
    to_email: str,
    org_name: str,
    accepted_by_name: str,
    role: str,
    notify_admin: bool = False,
) -> dict | None:
    """Notify when an invite is accepted - sends to both the acceptor and the admin/owner."""
    if notify_admin:
        subject = f"{accepted_by_name} has joined {org_name}"
        body_text = (
            f"<strong>{accepted_by_name}</strong> has accepted the invitation "
            f"and joined <strong>{org_name}</strong> as a <strong>{role}</strong>."
        )
    else:
        subject = f"Welcome to {org_name} on OpenFarm!"
        body_text = (
            f"You've successfully joined <strong>{org_name}</strong> as a "
            f"<strong>{role}</strong>. You can now collaborate with your team."
        )
    html = f"""\
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
  <h2 style="margin: 0 0 16px; font-size: 20px; color: #111;">
    {"New Member" if notify_admin else "Welcome"} - {org_name}
  </h2>
  <p style="margin: 0 0 24px; font-size: 15px; color: #333; line-height: 1.5;">
    {body_text}
  </p>
  <a href="{settings.app_url}"
     style="display: inline-block; padding: 12px 28px; background: #16a34a; color: #fff;
            text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
    Open OpenFarm
  </a>
</div>
"""
    return await _send(to_email, subject, html)


async def send_invite_cancelled_email(
    *,
    to_email: str,
    org_name: str,
) -> dict | None:
    """Notify the invited person that their invite has been cancelled."""
    subject = f"Your invitation to {org_name} has been cancelled"
    html = f"""\
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
  <h2 style="margin: 0 0 16px; font-size: 20px; color: #111;">
    Invitation Cancelled
  </h2>
  <p style="margin: 0 0 24px; font-size: 15px; color: #333; line-height: 1.5;">
    Your pending invitation to join <strong>{org_name}</strong> has been cancelled
    by an administrator. If you believe this was a mistake, please contact the
    workspace owner.
  </p>
</div>
"""
    return await _send(to_email, subject, html)


async def send_role_changed_email(
    *,
    to_email: str,
    org_name: str,
    new_role: str,
    changed_by_name: str,
) -> dict | None:
    """Notify a member that their role has been changed."""
    subject = f"Your role in {org_name} has been updated"
    html = f"""\
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
  <h2 style="margin: 0 0 16px; font-size: 20px; color: #111;">
    Role Updated - {org_name}
  </h2>
  <p style="margin: 0 0 24px; font-size: 15px; color: #333; line-height: 1.5;">
    <strong>{changed_by_name}</strong> has changed your role in
    <strong>{org_name}</strong> to <strong>{new_role}</strong>.
  </p>
  <a href="{settings.app_url}"
     style="display: inline-block; padding: 12px 28px; background: #16a34a; color: #fff;
            text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
    Open OpenFarm
  </a>
</div>
"""
    return await _send(to_email, subject, html)
