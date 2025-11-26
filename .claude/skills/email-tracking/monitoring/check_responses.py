#!/usr/bin/env python3
"""
Check Responses - On-demand response checking for a specific campaign
"""

import os
import json
import argparse
import imaplib
import email
from email.header import decode_header
from datetime import datetime
from typing import List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()

IMAP_HOST = os.getenv("IMAP_HOST", "imap.gmail.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
IMAP_USER = os.getenv("IMAP_USER", "")
IMAP_PASS = os.getenv("IMAP_PASS", "")


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
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            body = payload.decode(charset, errors="replace")
    
    return body.strip()


def search_campaign_responses(
    mail: imaplib.IMAP4_SSL,
    campaign_id: str,
    since_date: str
) -> List[Dict]:
    """Search for responses to a specific campaign"""
    
    responses = []
    
    try:
        mail.select("INBOX")
        
        # Search for messages since date
        search_criteria = f'(SINCE "{since_date}")'
        result, data = mail.search(None, search_criteria)
        
        if result != "OK":
            return responses
        
        msg_ids = data[0].split()
        
        for msg_id in msg_ids:
            try:
                result, msg_data = mail.fetch(msg_id, "(RFC822)")
                if result != "OK":
                    continue
                
                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)
                
                # Check if this is a response to our campaign
                in_reply_to = msg.get("In-Reply-To", "")
                references = msg.get("References", "")
                body = get_email_body(msg)
                
                # Look for campaign ID in tracking
                if campaign_id in in_reply_to or campaign_id in references or campaign_id in body:
                    from_addr = decode_mime_header(msg.get("From", ""))
                    subject = decode_mime_header(msg.get("Subject", ""))
                    date_str = msg.get("Date", "")
                    
                    responses.append({
                        "from": from_addr,
                        "subject": subject,
                        "date": date_str,
                        "body": body[:500],
                        "message_id": msg.get("Message-ID", ""),
                        "in_reply_to": in_reply_to
                    })
                    
            except Exception as e:
                print(f"Warning: Error processing message: {e}")
                continue
        
    except Exception as e:
        print(f"Error: {e}")
    
    return responses


def main():
    parser = argparse.ArgumentParser(description="Check responses for a campaign")
    parser.add_argument("--campaign-id", required=True, help="Campaign ID to check")
    parser.add_argument("--since", default="01-Jan-2024", help="Check messages since date (DD-Mon-YYYY)")
    parser.add_argument("--output", help="Output JSON file")
    
    args = parser.parse_args()
    
    if not IMAP_USER or not IMAP_PASS:
        print("Error: IMAP credentials not configured")
        return 1
    
    print(f"Checking responses for campaign: {args.campaign_id}")
    print(f"Since: {args.since}")
    
    try:
        # Connect to IMAP
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        mail.login(IMAP_USER, IMAP_PASS)
        
        # Search for responses
        responses = search_campaign_responses(mail, args.campaign_id, args.since)
        
        # Report
        print(f"\nFound {len(responses)} responses:")
        
        for i, resp in enumerate(responses, 1):
            print(f"\n--- Response {i} ---")
            print(f"From: {resp['from']}")
            print(f"Subject: {resp['subject']}")
            print(f"Date: {resp['date']}")
            print(f"Preview: {resp['body'][:100]}...")
        
        # Save if output specified
        if args.output:
            with open(args.output, "w") as f:
                json.dump(responses, f, indent=2)
            print(f"\nSaved to: {args.output}")
        
        mail.logout()
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())

