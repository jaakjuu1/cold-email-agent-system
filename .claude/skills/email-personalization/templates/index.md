# Email Template Index

## Overview

This directory contains all email templates used by the email personalization skill. Each template is designed to maximize engagement while maintaining professional quality.

## Template Categories

### Outreach Sequence

| Template | File | Purpose | Timing |
|----------|------|---------|--------|
| Initial Outreach | `initial_outreach.md` | First contact | Day 0 |
| Follow-Up 1 | `follow_up_1.md` | Add value, re-engage | Day 3-4 |
| Follow-Up 2 | `follow_up_2.md` | Breakup/final attempt | Day 8-10 |

### Response Templates

| Template | File | Purpose |
|----------|------|---------|
| Positive Response | `response_positive.md` | Handle interested replies |
| Objection Handling | `response_objection.md` | Handle various objections |

## Template Variables

All templates use the following variable syntax: `{variable_name}`

### Universal Variables
- `{first_name}` - Prospect's first name
- `{company_name}` - Prospect's company
- `{signature}` - Sender's signature

### Context-Specific Variables
- `{personalized_subject}` - AI-generated subject line
- `{opening_hook}` - Personalized opener based on research
- `{relevance_statement}` - Connection to their situation
- `{value_proposition}` - Specific benefits
- `{social_proof}` - Similar companies/results
- `{call_to_action}` - Specific ask

## Personalization Levels

### Level 1: Basic (Automated)
- First name
- Company name
- Industry-specific messaging

### Level 2: Standard (AI-Enhanced)
- Recent company news reference
- Job posting insights
- Technology stack mentions

### Level 3: Deep (Research-Backed)
- Specific project mentions
- Personal career history reference
- Mutual connections
- Content they've published

## Quality Guidelines

### Subject Lines
- Maximum 60 characters
- 3-5 words ideal
- No spam triggers
- A/B test variations

### Email Body
- Initial email: 100-150 words
- Follow-ups: 50-100 words
- Response emails: 50-75 words

### Tone
- Professional but human
- Confident not aggressive
- Helpful not salesy
- Specific not generic

## A/B Testing

### Variables to Test
1. Subject line approach (question vs. statement)
2. Opening hook type (compliment vs. observation)
3. CTA format (specific time vs. open-ended)
4. Email length
5. Social proof placement

### Metrics to Track
- Open rate (subject line effectiveness)
- Reply rate (body effectiveness)
- Positive reply rate (messaging fit)
- Meeting booking rate (CTA effectiveness)

## Compliance

All emails must include:
- Clear sender identification
- Company physical address (in signature)
- Unsubscribe mechanism (handled by system)
- No deceptive subject lines
- No false urgency

## Integration

Templates are used by `personalization_engine.py` which:
1. Loads appropriate template
2. Fills in variables from prospect data
3. Applies AI personalization
4. Validates through `quality_checker.py`
5. Returns final email content

