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

### Step 1: Website Analysis
```bash
python analysis/website_analyzer.py --url <website_url> --output /clients/<client_id>/website_analysis.json
```

### Step 2: Market Research
```bash
python analysis/market_researcher.py --company <company_name> --industry <industry> --output /clients/<client_id>/market_research.json
```

### Step 3: ICP Generation
```bash
python analysis/icp_generator.py \
  --website-analysis /clients/<client_id>/website_analysis.json \
  --market-research /clients/<client_id>/market_research.json \
  --output /clients/<client_id>/icp.json
```

### Step 4: ICP Validation
```bash
python analysis/icp_validator.py --icp /clients/<client_id>/icp.json
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

