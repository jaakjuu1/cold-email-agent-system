---
description: "Manage email campaign execution, scheduling, and analytics. Use when the user wants to start/pause campaigns, manage rate limits, schedule email sequences, or generate campaign performance reports."
---

# Campaign Management Skill

## Overview
This skill manages email campaign execution, including scheduling, rate limiting, sequence management, and performance tracking.

## Capabilities

### 1. Campaign Scheduling
- Schedule email sequences based on prospect timezone
- Respect send windows (e.g., 9 AM - 5 PM local time)
- Skip weekends and holidays
- Handle daily send limits

### 2. Rate Limiting
- Enforce hourly/daily send limits
- Implement warmup schedules for new domains
- Manage multiple campaign priorities
- Handle burst protection

### 3. Sequence Management
- Track prospect progress through email sequences
- Handle follow-up timing
- Manage sequence pauses and resumptions
- Process out-of-office and bounces

### 4. Performance Analytics
- Track open rates, reply rates, bounce rates
- Monitor deliverability metrics
- Generate campaign reports
- Identify optimization opportunities

## Scripts

### rate_limiter.py
Manages sending rate limits and queue scheduling.

```bash
# Check current rate limit status
python rate_limiter.py status --campaign-id <id>

# Schedule next batch
python rate_limiter.py schedule --campaign-id <id> --batch-size 50

# Adjust limits
python rate_limiter.py configure --hourly 100 --daily 500
```

### response_tracker.py
Processes email responses and updates campaign state.

```bash
# Process new responses
python response_tracker.py process --campaign-id <id>

# Generate response report
python response_tracker.py report --campaign-id <id> --format json
```

### analytics.py
Generates campaign performance analytics.

```bash
# Generate daily report
python analytics.py daily --campaign-id <id>

# Generate full campaign report
python analytics.py campaign --campaign-id <id> --output report.json
```

## Workflow

### Starting a Campaign
1. Validate campaign configuration
2. Check prospect data quality
3. Initialize rate limiter
4. Schedule first batch
5. Begin monitoring

### During Campaign
1. Process scheduled emails
2. Handle bounces and errors
3. Monitor responses
4. Adjust timing as needed
5. Track metrics

### Campaign Completion
1. Send final follow-ups
2. Generate final report
3. Archive campaign data
4. Update prospect statuses

## Integration Points

- **Email Service**: Sends actual emails
- **IMAP Monitor**: Receives responses
- **AgentFS**: Stores campaign state
- **WebSocket**: Sends real-time updates

## Configuration

```json
{
  "rateLimits": {
    "perHour": 50,
    "perDay": 200,
    "warmupEnabled": true,
    "warmupSchedule": [10, 25, 50, 100, 150, 200]
  },
  "sendWindow": {
    "start": "09:00",
    "end": "17:00",
    "timezone": "recipient",
    "skipWeekends": true
  },
  "sequences": {
    "defaultDelay": [0, 3, 7],
    "stopOnReply": true,
    "stopOnBounce": true
  }
}
```

## Error Handling

### Soft Bounces
- Retry after 24 hours
- Max 3 retries
- Then mark as bounced

### Hard Bounces
- Immediately stop sequence
- Mark prospect as invalid
- Log for domain reputation

### Rate Limit Exceeded
- Queue remaining emails
- Resume when limits reset
- Notify via WebSocket

### API Errors
- Exponential backoff
- Alert after 3 failures
- Pause campaign if persistent

