---
description: "Analyze a client's business website and generate a comprehensive Ideal Customer Profile (ICP). Use when the user wants to discover a client's business, analyze their website, research their market, or create targeting criteria for outreach campaigns."
---

# Client Discovery Skill

## Overview
This skill analyzes a client's business through their website and market research to generate a comprehensive Ideal Customer Profile (ICP).

## Capabilities
1. **Website Analysis**: Crawls and analyzes company websites using Firecrawl
2. **Market Research**: Gathers competitive intelligence using Perplexity
3. **ICP Generation**: Creates detailed targeting criteria and messaging frameworks
4. **ICP Validation**: Ensures ICP quality and completeness

## Workflow

**IMPORTANT**: Use `uvx` to run Python scripts with dependencies managed automatically.

### Step 1: Website Analysis
```bash
uvx --with firecrawl-py --with anthropic --with aiohttp --with python-dotenv \
  python .claude/skills/client-discovery/analysis/website_analyzer.py \
  --url <website_url> --output /tmp/clients/<client_id>/website_analysis.json
```

### Step 2: Market Research
```bash
uvx --with anthropic --with aiohttp --with python-dotenv \
  python .claude/skills/client-discovery/analysis/market_researcher.py \
  --company <company_name> --industry <industry> \
  --output /tmp/clients/<client_id>/market_research.json
```

### Step 3: ICP Generation
```bash
uvx --with anthropic --with python-dotenv \
  python .claude/skills/client-discovery/analysis/icp_generator.py \
  --website-analysis /tmp/clients/<client_id>/website_analysis.json \
  --market-research /tmp/clients/<client_id>/market_research.json \
  --output /tmp/clients/<client_id>/icp.json
```

### Step 4: ICP Validation
```bash
uvx --with anthropic --with python-dotenv \
  python .claude/skills/client-discovery/analysis/icp_validator.py \
  --icp /tmp/clients/<client_id>/icp.json
```

## Output Format

### Website Analysis
```json
{
  "company_name": "...",
  "website": "...",
  "value_proposition": "...",
  "products_services": [...],
  "target_audience": "...",
  "key_features": [...],
  "pricing_model": "...",
  "content_themes": [...]
}
```

### ICP
```json
{
  "icp_summary": "...",
  "firmographic_criteria": {...},
  "geographic_targeting": {...},
  "industry_targeting": {...},
  "decision_maker_targeting": {...},
  "messaging_framework": {...}
}
```

## Dependencies
- firecrawl-py
- anthropic
- aiohttp
- python-dotenv

