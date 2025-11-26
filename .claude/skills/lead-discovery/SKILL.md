---
description: "Discover and enrich B2B leads based on an Ideal Customer Profile. Use when the user wants to find prospects, search businesses on Google Maps, enrich company data, or find decision maker contacts for outreach."
---

# Lead Discovery Skill

## Overview
This skill discovers and enriches leads based on the Ideal Customer Profile, using Google Maps Places API and web research.

## Capabilities
1. **Google Maps Search**: Finds businesses matching ICP criteria
2. **Data Parsing**: Extracts and structures business information
3. **Company Enrichment**: Gathers additional data via web research
4. **Contact Finding**: Discovers decision maker contact information
5. **Data Validation**: Ensures lead quality before adding to pipeline

## Workflow

**IMPORTANT**: Use `uvx` to run Python scripts with dependencies managed automatically.

### Step 1: Search Google Maps
```bash
uvx --with googlemaps --with python-dotenv \
  python .claude/skills/lead-discovery/google-maps/scraper.py \
  --location "San Francisco, CA" \
  --industry "SaaS companies" \
  --limit 50 \
  --output /tmp/prospects/sf-ca/saas/raw_results.json
```

### Step 2: Parse Results
```bash
uvx --with python-dotenv \
  python .claude/skills/lead-discovery/google-maps/parser.py \
  --input /tmp/prospects/sf-ca/saas/raw_results.json \
  --output /tmp/prospects/sf-ca/saas/parsed_results.json
```

### Step 3: Enrich Companies
```bash
uvx --with aiohttp --with anthropic --with python-dotenv \
  python .claude/skills/lead-discovery/research-pipeline/company_enricher.py \
  --input /tmp/prospects/sf-ca/saas/parsed_results.json \
  --output /tmp/prospects/sf-ca/saas/enriched_results.json
```

### Step 4: Find Contacts
```bash
uvx --with aiohttp --with anthropic --with python-dotenv \
  python .claude/skills/lead-discovery/research-pipeline/contact_finder.py \
  --input /tmp/prospects/sf-ca/saas/enriched_results.json \
  --output /tmp/prospects/sf-ca/saas/with_contacts.json
```

### Step 5: Validate Data
```bash
uvx --with anthropic --with python-dotenv \
  python .claude/skills/lead-discovery/research-pipeline/data_validator.py \
  --input /tmp/prospects/sf-ca/saas/with_contacts.json \
  --icp /tmp/clients/<client_id>/icp.json \
  --output /tmp/prospects/sf-ca/saas/validated.json
```

## Output Format

### Prospect Data
```json
{
  "id": "prospect-xxx",
  "company_name": "...",
  "website": "...",
  "industry": "...",
  "location": {
    "city": "...",
    "state": "...",
    "country": "...",
    "address": "..."
  },
  "google_place_id": "...",
  "rating": 4.5,
  "review_count": 123,
  "contacts": [
    {
      "name": "...",
      "title": "...",
      "email": "...",
      "linkedin_url": "...",
      "is_primary": true
    }
  ],
  "icp_match_score": 0.85
}
```

## Dependencies
- googlemaps
- aiohttp
- anthropic
- python-dotenv

