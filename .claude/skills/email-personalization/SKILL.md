---
description: "Generate personalized cold email sequences for B2B outreach. Use when the user wants to create emails, write outreach sequences, personalize messages for prospects, or check email quality."
---

# Email Personalization Skill

## Overview
This skill generates highly personalized cold email sequences based on prospect data and ICP messaging frameworks.

## Capabilities
1. **Personalization Engine**: Creates tailored emails using prospect-specific data
2. **Quality Checking**: Validates emails for deliverability and effectiveness
3. **Template Management**: Maintains and applies email templates
4. **A/B Testing**: Generates email variants for testing

## Workflow

### Step 1: Generate Email Sequence
```bash
python personalization_engine.py \
  --prospect /prospects/<location>/<industry>/prospect.json \
  --icp /clients/<client_id>/icp.json \
  --templates /templates/default/ \
  --output /campaigns/<campaign_id>/emails/<prospect_id>/
```

### Step 2: Quality Check
```bash
python quality_checker.py \
  --email /campaigns/<campaign_id>/emails/<prospect_id>/email_1.json \
  --min-score 80
```

## Output Format

### Email
```json
{
  "sequence": 1,
  "subject": "...",
  "body": "...",
  "personalization_points": ["Company name", "Recent news"],
  "delay_days": 0,
  "quality_score": 85
}
```

## Dependencies
- anthropic
- python-dotenv

