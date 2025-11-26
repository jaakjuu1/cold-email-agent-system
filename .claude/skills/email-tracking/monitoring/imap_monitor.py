#!/usr/bin/env python3
"""
IMAP Monitor - Continuously monitors inbox for campaign responses
"""

import os
import sys
import json
import argparse
import time
import imaplib
import email
from email.header import decode_header
from datetime import datetime, timedelta
from typing import Optional, List, Dict
import re
import requests
from dotenv import load_dotenv

load_dotenv()

# Configuration
IMAP_HOST = os.getenv("IMAP_HOST", "imap.gmail.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
IMAP_USER = os.getenv("IMAP_USER", "")
IMAP_PASS = os.getenv("IMAP_PASS", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")


def decode_mime_header(header: str) -> str:
    """Decode MIME encoded header"""
    if not header:
        return ""
    
    decoded_parts = []
    for part, encoding in decode_header(header):
        if isinstance(part, bytes):
            decoded_parts.append(part.decode(encoding or "utf-8", errors="replace"))
        else:
            decoded_parts.append(part)
    
    return " ".join(decoded_parts)


def get_email_body(msg) -> str:
    """Extract email body from message"""
    body = ""
    
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))
            
            if content_type == "text/plain" and "attachment" not in content_disposition:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    body = payload.decode(charset, errors="replace")
                    break
            elif content_type == "text/html" and not body:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    # Strip HTML tags for plain text
                    html_body = payload.decode(charset, errors="replace")
                    body = re.sub(r'<[^>]+>', '', html_body)
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            body = payload.decode(charset, errors="replace")
    
    return body.strip()


def extract_campaign_info(msg) -> Optional[Dict]:
    """Extract campaign/prospect info from email headers or body"""
    
    # Check In-Reply-To header
    in_reply_to = msg.get("In-Reply-To", "")
    references = msg.get("References", "")
    
    # Look for tracking ID in headers or body
    body = get_email_body(msg)
    
    # Pattern: campaign:prospect:sequence
    tracking_pattern = r'tracking:([a-z0-9-]+):([a-z0-9-]+):(\d+)'
    
    # Check references first
    for header in [in_reply_to, references, body]:
        match = re.search(tracking_pattern, header)
        if match:
            return {
                "campaign_id": match.group(1),
                "prospect_id": match.group(2),
                "sequence": int(match.group(3))
            }
    
    # Try to match by Message-ID pattern
    msg_id_pattern = r'<([a-z0-9-]+)\.([a-z0-9-]+)\.(\d+)@'
    for header in [in_reply_to, references]:
        match = re.search(msg_id_pattern, header)
        if match:
            return {
                "campaign_id": match.group(1),
                "prospect_id": match.group(2),
                "sequence": int(match.group(3))
            }
    
    return None


def is_bounce_message(msg) -> bool:
    """Check if message is a bounce notification"""
    
    from_addr = msg.get("From", "").lower()
    subject = decode_mime_header(msg.get("Subject", "")).lower()
    
    bounce_indicators = [
        "mailer-daemon",
        "postmaster",
        "mail delivery",
        "delivery failed",
        "delivery status",
        "undeliverable",
        "returned mail",
        "delivery failure"
    ]
    
    return any(ind in from_addr or ind in subject for ind in bounce_indicators)


def is_out_of_office(msg) -> bool:
    """Check if message is an out-of-office reply"""
    
    subject = decode_mime_header(msg.get("Subject", "")).lower()
    
    ooo_indicators = [
        "out of office",
        "out of the office",
        "automatic reply",
        "auto-reply",
        "autoreply",
        "away from",
        "on vacation",
        "on leave"
    ]
    
    return any(ind in subject for ind in ooo_indicators)


def classify_response_basic(body: str, subject: str) -> str:
    """Basic response classification without AI"""
    
    text = f"{subject} {body}".lower()
    
    # Check for unsubscribe
    if any(word in text for word in ["unsubscribe", "remove me", "stop emailing", "don't contact"]):
        return "unsubscribe"
    
    # Check for positive indicators
    positive_words = ["interested", "love to", "would like", "let's", "schedule", "sounds good", "tell me more", "yes"]
    if any(word in text for word in positive_words):
        return "positive"
    
    # Check for negative indicators
    negative_words = ["not interested", "no thanks", "no thank you", "not a fit", "wrong person", "please don't"]
    if any(word in text for word in negative_words):
        return "negative"
    
    return "neutral"


def process_email(msg, msg_id: str) -> Optional[Dict]:
    """Process a single email message"""
    
    # Extract basic info
    from_addr = decode_mime_header(msg.get("From", ""))
    subject = decode_mime_header(msg.get("Subject", ""))
    date_str = msg.get("Date", "")
    message_id = msg.get("Message-ID", "")
    in_reply_to = msg.get("In-Reply-To", "")
    body = get_email_body(msg)
    
    # Extract campaign info
    campaign_info = extract_campaign_info(msg)
    
    if not campaign_info:
        # Not a campaign response
        return None
    
    # Determine response type
    if is_bounce_message(msg):
        return {
            "type": "email_bounce",
            "campaign_id": campaign_info["campaign_id"],
            "prospect_id": campaign_info["prospect_id"],
            "email_id": f"email-{campaign_info['sequence']}",
            "bounce_type": "hard",
            "reason": subject,
            "bounced_at": datetime.now().isoformat()
        }
    
    # Classify sentiment
    if is_out_of_office(msg):
        sentiment = "out_of_office"
    else:
        sentiment = classify_response_basic(body, subject)
    
    return {
        "type": "email_response",
        "campaign_id": campaign_info["campaign_id"],
        "prospect_id": campaign_info["prospect_id"],
        "email_id": f"email-{campaign_info['sequence']}",
        "message_id": message_id,
        "in_reply_to": in_reply_to,
        "from": from_addr,
        "subject": subject,
        "body": body[:2000],  # Truncate for storage
        "received_at": datetime.now().isoformat(),
        "sentiment": sentiment
    }


def notify_backend(event: Dict) -> bool:
    """Send event to backend API"""
    
    try:
        endpoint = f"{BACKEND_URL}/api/webhooks/email/response"
        response = requests.post(endpoint, json=event, timeout=10)
        return response.status_code == 200
    except Exception as e:
        print(f"Warning: Could not notify backend: {e}")
        return False


def check_inbox(mail: imaplib.IMAP4_SSL, since_date: str = None) -> List[Dict]:
    """Check inbox for new campaign responses"""
    
    events = []
    
    try:
        mail.select("INBOX")
        
        # Search criteria
        if since_date:
            search_criteria = f'(SINCE "{since_date}")'
        else:
            # Default to last 24 hours
            yesterday = (datetime.now() - timedelta(days=1)).strftime("%d-%b-%Y")
            search_criteria = f'(SINCE "{yesterday}")'
        
        result, data = mail.search(None, search_criteria)
        
        if result != "OK":
            print("Warning: IMAP search failed")
            return events
        
        msg_ids = data[0].split()
        print(f"Found {len(msg_ids)} messages to process")
        
        for msg_id in msg_ids:
            try:
                result, msg_data = mail.fetch(msg_id, "(RFC822)")
                if result != "OK":
                    continue
                
                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)
                
                event = process_email(msg, msg_id.decode())
                
                if event:
                    events.append(event)
                    print(f"  Found campaign response: {event['type']} - {event['sentiment']}")
                    
            except Exception as e:
                print(f"  Warning: Error processing message {msg_id}: {e}")
                continue
        
    except Exception as e:
        print(f"Error checking inbox: {e}")
    
    return events


def run_monitor(poll_interval: int = 60):
    """Run continuous IMAP monitor"""
    
    print(f"Starting IMAP monitor")
    print(f"  Host: {IMAP_HOST}:{IMAP_PORT}")
    print(f"  User: {IMAP_USER}")
    print(f"  Poll interval: {poll_interval}s")
    print()
    
    last_check = None
    
    while True:
        try:
            # Connect to IMAP
            mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
            mail.login(IMAP_USER, IMAP_PASS)
            
            print(f"[{datetime.now().isoformat()}] Checking inbox...")
            
            # Check for new messages
            since_date = last_check.strftime("%d-%b-%Y") if last_check else None
            events = check_inbox(mail, since_date)
            
            # Process events
            for event in events:
                success = notify_backend(event)
                status = "✓" if success else "✗"
                print(f"  {status} Processed: {event['type']} for {event['prospect_id']}")
            
            last_check = datetime.now()
            
            # Close connection
            mail.logout()
            
            print(f"  Processed {len(events)} events. Sleeping for {poll_interval}s...")
            time.sleep(poll_interval)
            
        except imaplib.IMAP4.error as e:
            print(f"IMAP error: {e}")
            time.sleep(poll_interval)
        except KeyboardInterrupt:
            print("\nShutting down monitor...")
            break
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(poll_interval)


def main():
    parser = argparse.ArgumentParser(description="IMAP Email Monitor")
    parser.add_argument("--host", default=IMAP_HOST, help="IMAP host")
    parser.add_argument("--user", default=IMAP_USER, help="IMAP username")
    parser.add_argument("--poll-interval", type=int, default=60, help="Polling interval in seconds")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    
    args = parser.parse_args()
    
    if not args.user or not IMAP_PASS:
        print("Error: IMAP credentials not configured")
        print("Set IMAP_USER and IMAP_PASS environment variables")
        return 1
    
    if args.once:
        # Single run mode
        mail = imaplib.IMAP4_SSL(args.host, IMAP_PORT)
        mail.login(args.user, IMAP_PASS)
        
        events = check_inbox(mail)
        
        for event in events:
            print(json.dumps(event, indent=2))
        
        mail.logout()
        return 0
    else:
        # Continuous monitoring
        run_monitor(poll_interval=args.poll_interval)
        return 0


if __name__ == "__main__":
    exit(main())

