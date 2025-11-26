#!/usr/bin/env python3
"""
Data Validator - Validates prospects against ICP and ensures data quality
"""

import os
import json
import argparse
import re
from typing import List, Tuple


def validate_email(email: str) -> bool:
    """Validate email format"""
    if not email:
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def calculate_icp_score(prospect: dict, icp: dict) -> float:
    """Calculate how well a prospect matches the ICP"""
    
    score = 0.0
    weights = {
        "industry": 0.25,
        "location": 0.20,
        "company_size": 0.15,
        "contact_title": 0.25,
        "has_email": 0.15
    }
    
    # Industry match
    industry_targeting = icp.get("industry_targeting", {})
    primary_industries = [i.get("name", "").lower() for i in industry_targeting.get("primary_industries", [])]
    secondary_industries = [i.get("name", "").lower() for i in industry_targeting.get("secondary_industries", [])]
    
    prospect_industry = prospect.get("industry", "").lower()
    if any(ind in prospect_industry or prospect_industry in ind for ind in primary_industries):
        score += weights["industry"]
    elif any(ind in prospect_industry or prospect_industry in ind for ind in secondary_industries):
        score += weights["industry"] * 0.5
    
    # Location match
    geo_targeting = icp.get("geographic_targeting", {})
    primary_markets = geo_targeting.get("primary_markets", [])
    
    prospect_city = prospect.get("location", {}).get("city", "").lower()
    prospect_state = prospect.get("location", {}).get("state", "").lower()
    
    for market in primary_markets:
        if (market.get("city", "").lower() == prospect_city or 
            market.get("state", "").lower() == prospect_state):
            score += weights["location"]
            break
    
    # Company size match (simplified - would need actual employee data)
    if prospect.get("employee_count") or prospect.get("website"):
        score += weights["company_size"] * 0.5  # Partial score if we have some data
    
    # Contact title match
    dm_targeting = icp.get("decision_maker_targeting", {})
    primary_titles = [t.lower() for t in dm_targeting.get("primary_titles", [])]
    secondary_titles = [t.lower() for t in dm_targeting.get("secondary_titles", [])]
    
    contacts = prospect.get("contacts", [])
    for contact in contacts:
        contact_title = contact.get("title", "").lower()
        if any(pt in contact_title for pt in primary_titles):
            score += weights["contact_title"]
            break
        elif any(st in contact_title for st in secondary_titles):
            score += weights["contact_title"] * 0.5
            break
    
    # Has valid email
    for contact in contacts:
        if validate_email(contact.get("email", "")):
            score += weights["has_email"]
            break
    
    return round(min(score, 1.0), 2)


def validate_prospect(prospect: dict) -> Tuple[bool, List[str]]:
    """Validate a single prospect's data quality"""
    
    issues = []
    
    # Required fields
    if not prospect.get("company_name"):
        issues.append("Missing company name")
    
    if not prospect.get("location", {}).get("city"):
        issues.append("Missing city")
    
    # Contact validation
    contacts = prospect.get("contacts", [])
    if not contacts:
        issues.append("No contacts found")
    else:
        has_valid_email = False
        for contact in contacts:
            if validate_email(contact.get("email", "")):
                has_valid_email = True
                break
        
        if not has_valid_email:
            issues.append("No valid email found")
        
        primary_contacts = [c for c in contacts if c.get("is_primary")]
        if not primary_contacts:
            issues.append("No primary contact designated")
    
    # Business status
    if prospect.get("business_status") == "CLOSED_PERMANENTLY":
        issues.append("Business is permanently closed")
    
    return len(issues) == 0, issues


def validate_prospects(prospects: List[dict], icp: dict, min_score: float = 0.3) -> dict:
    """Validate all prospects and filter by ICP score"""
    
    validated = []
    rejected = []
    
    for prospect in prospects:
        # Calculate ICP score
        icp_score = calculate_icp_score(prospect, icp)
        prospect["icp_match_score"] = icp_score
        
        # Validate data quality
        is_valid, issues = validate_prospect(prospect)
        prospect["validation_issues"] = issues
        prospect["is_valid"] = is_valid
        
        # Filter
        if is_valid and icp_score >= min_score:
            validated.append(prospect)
        else:
            rejected.append(prospect)
    
    # Sort by ICP score
    validated.sort(key=lambda x: x.get("icp_match_score", 0), reverse=True)
    
    return {
        "validated": validated,
        "rejected": rejected,
        "stats": {
            "total": len(prospects),
            "validated": len(validated),
            "rejected": len(rejected),
            "avg_icp_score": round(
                sum(p.get("icp_match_score", 0) for p in validated) / len(validated)
                if validated else 0, 2
            )
        }
    }


def main():
    parser = argparse.ArgumentParser(description="Validate prospects against ICP")
    parser.add_argument("--input", required=True, help="Input prospects JSON file")
    parser.add_argument("--icp", required=True, help="ICP JSON file")
    parser.add_argument("--output", required=True, help="Output validated JSON file")
    parser.add_argument("--min-score", type=float, default=0.3, help="Minimum ICP score to accept")
    
    args = parser.parse_args()
    
    try:
        # Load prospects
        with open(args.input, "r") as f:
            data = json.load(f)
        
        # Load ICP
        with open(args.icp, "r") as f:
            icp = json.load(f)
        
        prospects = data.get("prospects", [])
        
        print(f"Validating {len(prospects)} prospects against ICP...")
        
        # Validate
        results = validate_prospects(prospects, icp, min_score=args.min_score)
        
        # Report
        stats = results["stats"]
        print(f"\nValidation Results:")
        print(f"  Total: {stats['total']}")
        print(f"  Validated: {stats['validated']}")
        print(f"  Rejected: {stats['rejected']}")
        print(f"  Average ICP Score: {stats['avg_icp_score']}")
        
        # Prepare output
        output = {
            "query": data.get("query", {}),
            "validation_stats": stats,
            "prospects": results["validated"]
        }
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        
        # Save results
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        
        print(f"\nValidated prospects saved to: {args.output}")
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())

