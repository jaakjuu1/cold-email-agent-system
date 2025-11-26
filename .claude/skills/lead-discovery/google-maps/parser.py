#!/usr/bin/env python3
"""
Google Maps Parser - Parse and structure raw Google Maps results
"""

import os
import json
import argparse
import re
from typing import List, Optional
from urllib.parse import urlparse
import hashlib


def generate_prospect_id(name: str, location: str) -> str:
    """Generate a unique prospect ID"""
    hash_input = f"{name.lower()}-{location.lower()}"
    return f"prospect-{hashlib.md5(hash_input.encode()).hexdigest()[:10]}"


def parse_address(address: str) -> dict:
    """Parse address into components"""
    # Simple parsing - in production use a proper address parser
    parts = address.split(",")
    
    result = {
        "address": address,
        "city": "",
        "state": "",
        "country": "USA"
    }
    
    if len(parts) >= 2:
        # Usually: "123 Main St, City, State ZIP, Country"
        result["address"] = parts[0].strip()
        
        if len(parts) >= 3:
            result["city"] = parts[-3].strip() if len(parts) > 3 else parts[-2].strip()
            
            # Parse state from "State ZIP"
            state_part = parts[-2].strip()
            state_match = re.match(r"([A-Z]{2})", state_part)
            if state_match:
                result["state"] = state_match.group(1)
    
    return result


def extract_domain(url: Optional[str]) -> Optional[str]:
    """Extract domain from URL"""
    if not url:
        return None
    
    try:
        parsed = urlparse(url)
        domain = parsed.netloc
        # Remove www prefix
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except:
        return None


def infer_industry(types: List[str], name: str) -> str:
    """Infer industry from Google Maps types and company name"""
    
    # Map Google types to industries
    type_mapping = {
        "software": "Software",
        "technology": "Technology",
        "finance": "Finance",
        "real_estate": "Real Estate",
        "restaurant": "Food & Beverage",
        "health": "Healthcare",
        "law": "Legal",
        "accounting": "Accounting",
        "marketing": "Marketing",
        "consulting": "Consulting",
        "construction": "Construction",
        "manufacturing": "Manufacturing",
        "retail": "Retail",
        "e-commerce": "E-Commerce",
    }
    
    # Check types
    for t in types:
        t_lower = t.lower()
        for key, industry in type_mapping.items():
            if key in t_lower:
                return industry
    
    # Check name
    name_lower = name.lower()
    for key, industry in type_mapping.items():
        if key in name_lower:
            return industry
    
    return "Business Services"


def parse_result(raw: dict) -> dict:
    """Parse a single Google Maps result into prospect format"""
    
    name = raw.get("name", "Unknown")
    address = raw.get("formatted_address", raw.get("full_address", ""))
    location = parse_address(address)
    
    prospect = {
        "id": generate_prospect_id(name, address),
        "company_name": name,
        "website": raw.get("website"),
        "domain": extract_domain(raw.get("website")),
        "industry": infer_industry(raw.get("types", []), name),
        "location": {
            "city": location.get("city", ""),
            "state": location.get("state", ""),
            "country": location.get("country", "USA"),
            "address": location.get("address", ""),
            "full_address": address
        },
        "google_place_id": raw.get("place_id"),
        "google_maps_url": f"https://www.google.com/maps/place/?q=place_id:{raw.get('place_id')}" if raw.get("place_id") else None,
        "rating": raw.get("detailed_rating", raw.get("rating")),
        "review_count": raw.get("detailed_review_count", raw.get("user_ratings_total")),
        "phone": raw.get("phone"),
        "business_status": raw.get("business_status", "OPERATIONAL"),
        "types": raw.get("types", []),
        "contacts": [],
        "icp_match_score": 0.0
    }
    
    return prospect


def parse_results(raw_results: List[dict]) -> List[dict]:
    """Parse all raw results"""
    
    parsed = []
    seen_ids = set()
    
    for raw in raw_results:
        prospect = parse_result(raw)
        
        # Skip duplicates
        if prospect["id"] in seen_ids:
            continue
        
        seen_ids.add(prospect["id"])
        
        # Skip closed businesses
        if prospect.get("business_status") == "CLOSED_PERMANENTLY":
            continue
        
        parsed.append(prospect)
    
    return parsed


def main():
    parser = argparse.ArgumentParser(description="Parse Google Maps results")
    parser.add_argument("--input", required=True, help="Input raw results JSON file")
    parser.add_argument("--output", required=True, help="Output parsed results JSON file")
    
    args = parser.parse_args()
    
    try:
        # Load raw results
        with open(args.input, "r") as f:
            data = json.load(f)
        
        raw_results = data.get("results", [])
        query = data.get("query", {})
        
        print(f"Parsing {len(raw_results)} results...")
        
        # Parse results
        parsed = parse_results(raw_results)
        
        print(f"Parsed {len(parsed)} prospects (removed {len(raw_results) - len(parsed)} duplicates/closed)")
        
        # Prepare output
        output = {
            "query": query,
            "total_prospects": len(parsed),
            "prospects": parsed
        }
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        
        # Save results
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        
        print(f"Parsed results saved to: {args.output}")
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())

