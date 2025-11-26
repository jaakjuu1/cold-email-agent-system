---
description: "Monitor email responses and track campaign engagement. Use when the user wants to check for replies, detect bounces, classify response sentiment, or track email opens and clicks."
---

# Email Tracking Skill

## Overview
This skill monitors email responses, tracks engagement events, and classifies response sentiment for campaign management.

## Capabilities
1. **IMAP Monitoring**: Monitors inbox for campaign responses
2. **Response Detection**: Identifies replies to outreach emails
3. **Bounce Detection**: Detects and handles bounced emails
4. **Engagement Scoring**: Tracks opens, clicks, and reply sentiment

## Components

### Python Scripts
- `monitoring/imap_monitor.py` - Continuous IMAP inbox monitoring
- `monitoring/check_responses.py` - On-demand response checking

### TypeScript Listeners
- `listeners/response-detector.ts` - Classifies and routes responses
- `listeners/bounce-detector.ts` - Handles bounce notifications
- `listeners/engagement-scorer.ts` - Calculates engagement scores

## Workflow

### Start IMAP Monitor
```bash
uvx --with anthropic --with python-dotenv \
  python .claude/skills/email-tracking/monitoring/imap_monitor.py \
  --host imap.gmail.com \
  --user outreach@company.com \
  --poll-interval 60
```

### Check Responses (On-demand)
```bash
uvx --with anthropic --with python-dotenv \
  python .claude/skills/email-tracking/monitoring/check_responses.py \
  --campaign-id campaign-xxx \
  --since 2024-01-01
```

**Important**: Always use `uvx` to run Python scripts to ensure dependencies are available without creating a .venv folder.

## Event Format

### Response Event
```json
{
  "type": "email_response",
  "campaign_id": "...",
  "prospect_id": "...",
  "email_id": "...",
  "message_id": "...",
  "in_reply_to": "...",
  "from": "...",
  "subject": "...",
  "body": "...",
  "received_at": "...",
  "sentiment": "positive|neutral|negative|out_of_office|unsubscribe"
}
```

### Bounce Event
```json
{
  "type": "email_bounce",
  "campaign_id": "...",
  "prospect_id": "...",
  "email_id": "...",
  "bounce_type": "hard|soft",
  "reason": "...",
  "bounced_at": "..."
}
```

## Dependencies
- imaplib (Python standard library)
- email (Python standard library)
- anthropic
- python-dotenv

