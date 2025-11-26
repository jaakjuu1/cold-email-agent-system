#!/usr/bin/env python3
"""
Google Maps Scraper - Search for businesses using Google Maps Places API
"""

import os
import json
import argparse
import asyncio
from typing import List, Optional
import aiohttp
from dotenv import load_dotenv

load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
PLACES_API_URL = "https://maps.googleapis.com/maps/api/place"


async def search_places(
    query: str,
    location: str,
    radius: int = 50000,
    limit: int = 50
) -> List[dict]:
    """Search for places using Google Maps Places API"""
    
    results = []
    next_page_token = None
    
    async with aiohttp.ClientSession() as session:
        while len(results) < limit:
            # Text Search API
            params = {
                "query": f"{query} in {location}",
                "key": GOOGLE_MAPS_API_KEY,
                "type": "establishment"
            }
            
            if next_page_token:
                params["pagetoken"] = next_page_token
                # Google requires a short delay before using pagetoken
                await asyncio.sleep(2)
            
            async with session.get(
                f"{PLACES_API_URL}/textsearch/json",
                params=params
            ) as response:
                if response.status != 200:
                    raise Exception(f"Google Maps API error: {await response.text()}")
                
                data = await response.json()
                
                if data.get("status") != "OK" and data.get("status") != "ZERO_RESULTS":
                    if data.get("status") == "OVER_QUERY_LIMIT":
                        print("Warning: API quota exceeded")
                        break
                    raise Exception(f"API error: {data.get('status')}")
                
                places = data.get("results", [])
                results.extend(places)
                
                next_page_token = data.get("next_page_token")
                
                if not next_page_token or len(places) == 0:
                    break
                
                print(f"Found {len(results)} results so far...")
    
    return results[:limit]


async def get_place_details(place_id: str) -> Optional[dict]:
    """Get detailed information about a place"""
    
    params = {
        "place_id": place_id,
        "key": GOOGLE_MAPS_API_KEY,
        "fields": "name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,types,business_status,opening_hours"
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{PLACES_API_URL}/details/json",
            params=params
        ) as response:
            if response.status != 200:
                return None
            
            data = await response.json()
            
            if data.get("status") != "OK":
                return None
            
            return data.get("result")


async def enrich_results(results: List[dict], max_details: int = 20) -> List[dict]:
    """Enrich search results with detailed information"""
    
    enriched = []
    
    for i, place in enumerate(results[:max_details]):
        print(f"Enriching {i+1}/{min(len(results), max_details)}: {place.get('name')}")
        
        place_id = place.get("place_id")
        if not place_id:
            enriched.append(place)
            continue
        
        details = await get_place_details(place_id)
        
        if details:
            place.update({
                "website": details.get("website"),
                "phone": details.get("formatted_phone_number"),
                "full_address": details.get("formatted_address"),
                "business_status": details.get("business_status"),
                "detailed_rating": details.get("rating"),
                "detailed_review_count": details.get("user_ratings_total"),
            })
        
        enriched.append(place)
        
        # Rate limiting
        await asyncio.sleep(0.1)
    
    # Add remaining results without enrichment
    enriched.extend(results[max_details:])
    
    return enriched


async def main():
    parser = argparse.ArgumentParser(description="Search Google Maps for businesses")
    parser.add_argument("--location", required=True, help="Location to search (e.g., 'San Francisco, CA')")
    parser.add_argument("--industry", required=True, help="Industry/business type to search")
    parser.add_argument("--limit", type=int, default=50, help="Maximum number of results")
    parser.add_argument("--enrich", action="store_true", help="Fetch detailed info for each result")
    parser.add_argument("--output", required=True, help="Output file path")
    
    args = parser.parse_args()
    
    if not GOOGLE_MAPS_API_KEY:
        print("Error: GOOGLE_MAPS_API_KEY not set")
        return 1
    
    print(f"Searching for: {args.industry} in {args.location}")
    
    try:
        # Search for places
        results = await search_places(
            query=args.industry,
            location=args.location,
            limit=args.limit
        )
        
        print(f"Found {len(results)} results")
        
        # Optionally enrich with details
        if args.enrich:
            print("Enriching results with details...")
            results = await enrich_results(results)
        
        # Prepare output
        output = {
            "query": {
                "location": args.location,
                "industry": args.industry,
                "limit": args.limit
            },
            "total_results": len(results),
            "results": results
        }
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        
        # Save results
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        
        print(f"Results saved to: {args.output}")
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(asyncio.run(main()))

