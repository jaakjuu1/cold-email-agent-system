#!/usr/bin/env python3
"""
ICP Generator - Creates Ideal Customer Profile from website and market research
"""

import os
import json
import argparse
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


def generate_icp(website_analysis: dict, market_research: dict) -> dict:
    """Generate ICP using Claude"""
    
    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    
    prompt = f"""Based on the following website analysis and market research, generate a comprehensive Ideal Customer Profile (ICP).

## Website Analysis
{json.dumps(website_analysis, indent=2)}

## Market Research
{json.dumps(market_research, indent=2)}

Generate an ICP in the following JSON format:
{{
    "icp_summary": "One paragraph summary of ideal customers",
    "firmographic_criteria": {{
        "company_size": {{
            "employee_ranges": ["10-50", "50-200"],
            "revenue_ranges": ["$1M-$10M", "$10M-$50M"]
        }},
        "company_stage": ["growth", "established"],
        "funding_status": ["bootstrapped", "seed", "series_a"]
    }},
    "geographic_targeting": {{
        "primary_markets": [
            {{"city": "San Francisco", "state": "CA", "country": "USA", "priority": "high"}}
        ],
        "expansion_markets": []
    }},
    "industry_targeting": {{
        "primary_industries": [
            {{"name": "SaaS", "sub_segments": ["B2B Software"], "priority": "high"}}
        ],
        "secondary_industries": []
    }},
    "decision_maker_targeting": {{
        "primary_titles": ["CEO", "CTO", "VP Engineering"],
        "secondary_titles": ["Director of Engineering"],
        "departments": ["Engineering", "Product"]
    }},
    "messaging_framework": {{
        "primary_pain_points_to_address": ["Pain point 1", "Pain point 2"],
        "value_propositions": ["Value prop 1", "Value prop 2"],
        "proof_points": ["Social proof 1", "Case study reference"],
        "objection_handlers": {{
            "price": "ROI justification...",
            "timing": "Quick implementation..."
        }}
    }}
}}

Be specific and actionable. Base your recommendations on the actual data provided."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )
    
    # Extract JSON from response
    response_text = response.content[0].text
    
    # Find JSON in response
    import re
    json_match = re.search(r'\{[\s\S]*\}', response_text)
    
    if json_match:
        return json.loads(json_match.group())
    else:
        raise ValueError("Could not parse ICP from response")


def main():
    parser = argparse.ArgumentParser(description="Generate ICP from research data")
    parser.add_argument("--website-analysis", required=True, help="Path to website analysis JSON")
    parser.add_argument("--market-research", required=True, help="Path to market research JSON")
    parser.add_argument("--output", required=True, help="Output file path")
    
    args = parser.parse_args()
    
    if not ANTHROPIC_API_KEY:
        print("Error: ANTHROPIC_API_KEY not set")
        return 1
    
    try:
        # Load input data
        with open(args.website_analysis, "r") as f:
            website_analysis = json.load(f)
        
        with open(args.market_research, "r") as f:
            market_research = json.load(f)
        
        print("Generating ICP...")
        
        # Generate ICP
        icp = generate_icp(website_analysis, market_research)
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        
        # Save results
        with open(args.output, "w") as f:
            json.dump(icp, f, indent=2)
        
        print(f"ICP saved to: {args.output}")
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())

