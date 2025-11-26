#!/usr/bin/env python3
"""
Website Analyzer - Crawls and analyzes company websites using Firecrawl
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
FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1"


async def scrape_website(url: str, deep_crawl: bool = False) -> dict:
    """Scrape a website using Firecrawl API"""
    
    headers = {
        "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "url": url,
        "formats": ["markdown", "html"],
        "onlyMainContent": True
    }
    
    async with aiohttp.ClientSession() as session:
        # Single page scrape
        async with session.post(
            f"{FIRECRAWL_API_URL}/scrape",
            headers=headers,
            json=payload
        ) as response:
            if response.status != 200:
                raise Exception(f"Firecrawl API error: {await response.text()}")
            
            result = await response.json()
            
            if deep_crawl:
                # Also crawl important subpages
                subpages = await crawl_subpages(session, headers, url)
                result["subpages"] = subpages
            
            return result


async def crawl_subpages(
    session: aiohttp.ClientSession,
    headers: dict,
    base_url: str
) -> list:
    """Crawl important subpages like /about, /product, /pricing"""
    
    important_paths = ["/about", "/product", "/products", "/pricing", "/features", "/solutions"]
    subpages = []
    
    for path in important_paths:
        try:
            url = f"{base_url.rstrip('/')}{path}"
            payload = {
                "url": url,
                "formats": ["markdown"],
                "onlyMainContent": True
            }
            
            async with session.post(
                f"{FIRECRAWL_API_URL}/scrape",
                headers=headers,
                json=payload
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    if result.get("success"):
                        subpages.append({
                            "path": path,
                            "content": result.get("data", {}).get("markdown", "")
                        })
        except Exception as e:
            print(f"Warning: Could not crawl {path}: {e}")
    
    return subpages


def analyze_content(scraped_data: dict) -> dict:
    """Analyze scraped content to extract business information"""
    
    main_content = scraped_data.get("data", {}).get("markdown", "")
    metadata = scraped_data.get("data", {}).get("metadata", {})
    subpages = scraped_data.get("subpages", [])
    
    # Combine all content for analysis
    all_content = main_content
    for subpage in subpages:
        all_content += f"\n\n--- {subpage['path']} ---\n{subpage['content']}"
    
    analysis = {
        "url": metadata.get("sourceURL", ""),
        "title": metadata.get("title", ""),
        "description": metadata.get("description", ""),
        "content_length": len(all_content),
        "main_content": main_content[:5000],  # First 5000 chars for context
        "subpages_crawled": len(subpages),
        "has_pricing": any("/pricing" in sp.get("path", "") for sp in subpages),
        "has_about": any("/about" in sp.get("path", "") for sp in subpages),
    }
    
    return analysis


async def main():
    parser = argparse.ArgumentParser(description="Analyze a company website")
    parser.add_argument("--url", required=True, help="Website URL to analyze")
    parser.add_argument("--deep-crawl", action="store_true", help="Crawl subpages")
    parser.add_argument("--output", required=True, help="Output file path")
    
    args = parser.parse_args()
    
    if not FIRECRAWL_API_KEY:
        print("Error: FIRECRAWL_API_KEY not set")
        return 1
    
    print(f"Analyzing website: {args.url}")
    
    try:
        # Scrape the website
        scraped_data = await scrape_website(args.url, args.deep_crawl)
        
        # Analyze the content
        analysis = analyze_content(scraped_data)
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        
        # Save results
        with open(args.output, "w") as f:
            json.dump(analysis, f, indent=2)
        
        print(f"Analysis saved to: {args.output}")
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(asyncio.run(main()))

