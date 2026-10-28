"""
Email Notification Service
Handles outbound mail protocols (SMTP with STARTTLS) for support tickets,
escalations, and critical system notifications.
"""

import asyncio
import email.utils
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any, Optional, List
from datetime import datetime

from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory log of dispatched emails for audit and admin preview
_DISPATCHED_EMAILS: List[Dict[str, Any]] = []


class EmailService:
    def __init__(self):
        self.recipient = settings.SUPPORT_NOTIFICATION_EMAIL or "devashish0716@gmail.com"
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.user = settings.SMTP_USER
        self.password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL or "alerts@devresolve.io"
        self.from_name = settings.SMTP_FROM_NAME or "DevResolve Incident Desk"
        self.use_tls = settings.SMTP_TLS

    def is_smtp_configured(self) -> bool:
        """Checks if real SMTP credentials have been provided in environment."""
        return bool(self.user and self.password and len(self.password) >= 6)

    def _build_ticket_html(self, ticket: Dict[str, Any]) -> str:
        """Constructs an elegant, responsive dark-mode styled HTML email."""
        ticket_id = ticket.get("id", "TIC-0000")
        title = ticket.get("title", "No Title Provided")
        description = ticket.get("description", "No description provided.")
        priority = (ticket.get("priority") or "high").upper()
        category = ticket.get("category", "General").replace("_", " ").title()
        user_email = ticket.get("user_email", "unknown@user")
        sla = ticket.get("estimated_resolution", "Under 1 hour")
        created_at = ticket.get("created_at", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"))
        metadata = ticket.get("metadata", {})

        priority_colors = {
            "CRITICAL": {"bg": "#fee2e2", "text": "#991b1b", "border": "#ef4444"},
            "HIGH": {"bg": "#ffedd5", "text": "#9a3412", "border": "#f97316"},
            "MEDIUM": {"bg": "#e0e7ff", "text": "#3730a3", "border": "#6366f1"},
            "LOW": {"bg": "#f3f4f6", "text": "#374151", "border": "#9ca3af"},
        }
        color = priority_colors.get(priority, priority_colors["HIGH"])

        metadata_rows = ""
        if metadata:
            for k, v in metadata.items():
                metadata_rows += f"""
                <tr>
                    <td style="padding: 6px 12px; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase;">{k}:</td>
                    <td style="padding: 6px 12px; color: #1e293b; font-size: 13px; font-family: monospace;">{v}</td>
                </tr>
                """

        html = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New DevResolve Support Ticket: #{ticket_id}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px 32px;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">⚡ DevResolve Support Desk</div>
                    <div style="font-size: 13px; color: #e0e7ff; margin-top: 4px;">Automated Engineering Escalation Alert</div>
                  </td>
                  <td align="right">
                    <span style="background-color: {color['bg']}; color: {color['text']}; border: 1px solid {color['border']}; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
                      {priority} PRIORITY
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Ticket Summary Card -->
          <tr>
            <td style="padding: 32px 32px 16px 32px;">
              <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #6366f1; font-weight: 700;">Ticket #{ticket_id}</div>
              <h1 style="font-size: 20px; font-weight: 700; color: #f8fafc; margin: 8px 0 16px 0; line-height: 1.4;">{title}</h1>
              
              <table role="presentation" width="100%" style="background-color: #1e293b; border-radius: 8px; border: 1px solid #334155; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #334155; width: 35%; color: #94a3b8; font-size: 13px;">Reported By:</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #334155; color: #f1f5f9; font-size: 13px; font-weight: 600;">{user_email}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #334155; color: #94a3b8; font-size: 13px;">Category:</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #334155; color: #f1f5f9; font-size: 13px;">{category}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #334155; color: #94a3b8; font-size: 13px;">SLA Target:</td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #334155; color: #38bdf8; font-size: 13px; font-weight: 600;">{sla}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; color: #94a3b8; font-size: 13px;">Timestamp:</td>
                  <td style="padding: 12px 16px; color: #cbd5e1; font-size: 13px;">{created_at}</td>
                </tr>
              </table>

              <!-- Description Block -->
              <div style="font-size: 13px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Issue Description:</div>
              <div style="background-color: #0f172a; border-left: 3px solid #6366f1; border-radius: 4px; padding: 16px; font-size: 14px; line-height: 1.6; color: #e2e8f0; white-space: pre-wrap; font-family: monospace;">{description}</div>
            </td>
          </tr>

          <!-- Metadata (if present) -->
          {f'''
          <tr>
            <td style="padding: 0 32px 16px 32px;">
              <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Diagnostic Metadata</div>
              <table role="presentation" width="100%" style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 6px;">
                {metadata_rows}
              </table>
            </td>
          </tr>
          ''' if metadata_rows else ''}

          <!-- Footer & Actions -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0d131f; border-top: 1px solid #1f2937; text-align: center;">
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b;">
                💡 <strong>Quick Action:</strong> Reply directly to this email to contact <strong>{user_email}</strong>.
              </p>
              <div style="font-size: 11px; color: #475569;">
                DevResolve Autonomous Engineering & Incident Response Platform • Automated Dispatch
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        """
        return html

    def _build_ticket_plaintext(self, ticket: Dict[str, Any]) -> str:
        """Plaintext fallback for non-HTML mail readers."""
        return (
            f"=== DevResolve Support Ticket Alert: #{ticket.get('id')} ===\n\n"
            f"Priority: {ticket.get('priority', 'high').upper()}\n"
            f"Category: {ticket.get('category', 'general')}\n"
            f"Reported By: {ticket.get('user_email', 'unknown')}\n"
            f"Target SLA: {ticket.get('estimated_resolution', 'Under 1 hour')}\n"
            f"Created At: {ticket.get('created_at', '')}\n\n"
            f"Title: {ticket.get('title')}\n\n"
            f"Description:\n{ticket.get('description')}\n\n"
            f"Metadata: {ticket.get('metadata')}\n\n"
            f"Reply to this email to answer the user directly.\n"
        )

    def _send_sync(self, ticket: Dict[str, Any]) -> Dict[str, Any]:
        """Synchronous SMTP worker executed in thread pool."""
        ticket_id = ticket.get("id", "TIC-0000")
        priority = (ticket.get("priority") or "high").upper()
        title = ticket.get("title", "Support Request")
        user_email = ticket.get("user_email")

        # 1. Build MIME Message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[{priority} TICKET #{ticket_id}] {title}"
        msg["From"] = f"{self.from_name} <{self.from_email}>"
        msg["To"] = self.recipient
        msg["Date"] = email.utils.formatdate(localtime=True)
        msg["Message-ID"] = email.utils.make_msgid(domain="devresolve.io")
        if user_email and "@" in user_email:
            msg["Reply-To"] = user_email

        plain_text = self._build_ticket_plaintext(ticket)
        html_text = self._build_ticket_html(ticket)

        msg.attach(MIMEText(plain_text, "plain", "utf-8"))
        msg.attach(MIMEText(html_text, "html", "utf-8"))

        dispatch_record = {
            "ticket_id": ticket_id,
            "recipient": self.recipient,
            "subject": msg["Subject"],
            "sent_at": datetime.utcnow().isoformat(),
            "status": "pending",
            "provider": "smtp",
        }

        # 2. Check if live SMTP is configured
        if not self.is_smtp_configured():
            # Log as simulated delivery with clear instructions
            logger.info(f"[MAIL DISPATCH] New Ticket #{ticket_id} escalated to {self.recipient}! Subject: {msg['Subject']}")
            print(f"\n[MAIL DISPATCH] New Ticket #{ticket_id} escalated to {self.recipient}!")
            print(f"   Subject: {msg['Subject']}")
            print(f"   Note: To transmit live over Google SMTP, add SMTP_USER and SMTP_PASSWORD to .env.\n")
            dispatch_record["status"] = "simulated_success"
            dispatch_record["note"] = "Ready for live transmission. Awaiting SMTP credentials in .env"
            _DISPATCHED_EMAILS.append(dispatch_record)
            return dispatch_record

        # 3. Live SMTP Transmission with STARTTLS
        try:
            with smtplib.SMTP(self.host, self.port, timeout=12.0) as server:
                server.ehlo()
                if self.use_tls:
                    server.starttls()
                    server.ehlo()
                if self.user and self.password:
                    clean_pwd = self.password.replace(" ", "").strip()
                    server.login(self.user.strip(), clean_pwd)
                server.sendmail(self.from_email, [self.recipient], msg.as_string())

            logger.info(f"[LIVE SMTP SUCCESS] Ticket #{ticket_id} email delivered to {self.recipient} via {self.host}:{self.port}!")
            print(f"\n[LIVE SMTP SUCCESS] Ticket #{ticket_id} email delivered to {self.recipient} via {self.host}:{self.port}!\n")
            dispatch_record["status"] = "delivered"
            _DISPATCHED_EMAILS.append(dispatch_record)
            return dispatch_record

        except Exception as e:
            logger.error(f"Failed to transmit ticket email via SMTP: {e}")
            print(f"\n[SMTP WARNING] Could not transmit email to {self.recipient}: {e}\n")
            dispatch_record["status"] = "failed"
            dispatch_record["error"] = str(e)
            _DISPATCHED_EMAILS.append(dispatch_record)
            return dispatch_record

    async def send_ticket_notification(self, ticket: Dict[str, Any]) -> Dict[str, Any]:
        """Asynchronously dispatches the email alert without blocking the API call."""
        return await asyncio.to_thread(self._send_sync, ticket)


def get_dispatched_emails() -> List[Dict[str, Any]]:
    """Accessor for audit logs and tests."""
    return _DISPATCHED_EMAILS
