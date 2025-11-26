#!/usr/bin/env python3
"""
Company Enricher - Enriches prospect data with web research
"""

import os
import json
import argparse
import asyncio
from typing import Optional
import aiohttp
from dotenv import load_dotenv

load_dotenv()

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")


async def scrape_website(url: str) -> Optional[dict]:
    """Scrape company website using Firecrawl"""
    
    if not url or not FIRECRAWL_API_KEY:
        return None
    
    headers = {
        "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "url": url,
        "formats": ["markdown"],
        "onlyMainContent": True
    }
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                "https://api.firecrawl.dev/v1/scrape",
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("success"):
                        return {
                            "content": data.get("data", {}).get("markdown", "")[:3000],
                            "title": data.get("data", {}).get("metadata", {}).get("title"),
                            "description": data.get("data", {}).get("metadata", {}).get("description")
                        }
        except Exception as e:
            print(f"Warning: Could not scrape {url}: {e}")
    
    return None


async def research_company(company_name: str, website: Optional[str]) -> Optional[dict]:
    """Research company using Perplexity"""
    
    if not PERPLEXITY_API_KEY:
        return None
    
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    query = f"What does {company_name} do?"
    if website:
        query += f" (website: {website})"
    query += " Provide a brief description, their main products/services, and estimated company size."
    
    payload = {
        "model": "sonar",
        "messages": [
            {"role": "user", "content": query}
        ],
        "max_tokens": 300
    }
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                "https://api.perplexity.ai/chat/completions",
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "research": data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    }
        except Exception as e:
            print(f"Warning: Could not research {company_name}: {e}")
    
    return None


async def enrich_prospect(prospect: dict) -> dict:
    """Enrich a single prospect with additional data"""
    
    enriched = prospect.copy()
    
    # Scrape website if available
    if prospect.get("website"):
        website_data = await scrape_website(prospect["website"])
        if website_data:
            enriched["website_content"] = website_data.get("content")
            enriched["website_title"] = website_data.get("title")
            enriched["website_description"] = website_data.get("description")
    
    # Research company
    research = await research_company(
        prospect.get("company_name", ""),
        prospect.get("website")
    )
    if research:
        enriched["research_summary"] = research.get("research")
    
    enriched["enriched"] = True
    
    return enriched


async def enrich_prospects(
    prospects: list,
    max_enrich: int = 20,
    delay: float = 1.0
) -> list:
    """Enrich multiple prospects"""
    
    enriched = []
    
    for i, prospect in enumerate(prospects):
        if i < max_enrich:
            print(f"Enriching {i+1}/{min(len(prospects), max_enrich)}: {prospect.get('company_name')}")
            enriched_prospect = await enrich_prospect(prospect)
            enriched.append(enriched_prospect)
            await asyncio.sleep(delay)  # Rate limiting
        else:
            # Keep remaining prospects without enrichment
            prospect["enriched"] = False
            enriched.append(prospect)
    
    return enriched


async def main():
    parser = argparse.ArgumentParser(description="Enrich prospect data")
    parser.add_argument("--input", required=True, help="Input prospects JSON file")
    parser.add_argument("--output", required=True, help="Output enriched JSON file")
    parser.add_argument("--max-enrich", type=int, default=20, help="Max prospects to enrich")
    
    args = parser.parse_args()
    
    try:
        # Load prospects
        with open(args.input, "r") as f:
            data = json.load(f)
        
        prospects = data.get("prospects", [])
        
        print(f"Enriching up to {args.max_enrich} of {len(prospects)} prospects...")
        
        # Enrich prospects
        enriched = await enrich_prospects(prospects, max_enrich=args.max_enrich)
        
        # Prepare output
        output = {
            "query": data.get("query", {}),
            "total_prospects": len(enriched),
            "enriched_count": sum(1 for p in enriched if p.get("enriched")),
            "prospects": enriched
        }
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        
        # Save results
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        
        print(f"Enriched results saved to: {args.output}")
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(asyncio.run(main()))

