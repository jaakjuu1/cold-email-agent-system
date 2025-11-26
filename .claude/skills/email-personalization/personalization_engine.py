#!/usr/bin/env python3
"""
Personalization Engine - Generates personalized cold email sequences
"""

import os
import json
import argparse
from typing import List, Optional
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


def load_templates(templates_dir: str) -> dict:
    """Load email templates from directory"""
    
    templates = {}
    
    if not os.path.exists(templates_dir):
        return get_default_templates()
    
    for filename in os.listdir(templates_dir):
        if filename.endswith(".json"):
            with open(os.path.join(templates_dir, filename), "r") as f:
                template = json.load(f)
                templates[template.get("name", filename)] = template
    
    return templates if templates else get_default_templates()


def get_default_templates() -> dict:
    """Return default email templates"""
    
    return {
        "initial_outreach": {
            "name": "initial_outreach",
            "sequence": 1,
            "delay_days": 0,
            "structure": {
                "hook": "Personalized observation about their company",
                "value_prop": "How we can help with their specific challenge",
                "proof": "Brief social proof or case study reference",
                "cta": "Soft ask - question about their interest"
            },
            "subject_types": ["question", "observation", "mutual_connection"],
            "max_length": 150
        },
        "follow_up_1": {
            "name": "follow_up_1",
            "sequence": 2,
            "delay_days": 3,
            "structure": {
                "reference": "Quick reference to previous email",
                "new_angle": "Different value proposition or angle",
                "urgency": "Gentle urgency creator",
                "cta": "More direct ask"
            },
            "subject_types": ["follow_up", "new_angle"],
            "max_length": 100
        },
        "break_up": {
            "name": "break_up",
            "sequence": 3,
            "delay_days": 7,
            "structure": {
                "acknowledgment": "Acknowledge they're busy",
                "final_value": "One more key benefit",
                "door_open": "Leave door open for future",
                "cta": "Direct yes/no question"
            },
            "subject_types": ["break_up", "final"],
            "max_length": 80
        }
    }


def generate_email_sequence(
    prospect: dict,
    icp: dict,
    templates: dict
) -> List[dict]:
    """Generate personalized email sequence using Claude"""
    
    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    
    # Build context for personalization
    prospect_context = f"""
Company: {prospect.get('company_name', 'Unknown')}
Website: {prospect.get('website', 'N/A')}
Industry: {prospect.get('industry', 'N/A')}
Location: {prospect.get('location', {}).get('city', '')}, {prospect.get('location', {}).get('state', '')}
Rating: {prospect.get('rating', 'N/A')} ({prospect.get('review_count', 0)} reviews)

Contact: {prospect.get('contacts', [{}])[0].get('name', 'Decision Maker')}
Title: {prospect.get('contacts', [{}])[0].get('title', 'Executive')}

Research Summary: {prospect.get('research_summary', 'N/A')[:500]}
Website Description: {prospect.get('website_description', 'N/A')[:300]}
"""
    
    messaging = icp.get('messaging_framework', {})
    pain_points = messaging.get('primary_pain_points_to_address', [])
    value_props = messaging.get('value_propositions', [])
    proof_points = messaging.get('proof_points', [])
    
    prompt = f"""Generate a 3-email cold outreach sequence for this prospect:

{prospect_context}

Use this messaging framework:
- Pain Points to Address: {', '.join(pain_points)}
- Value Propositions: {', '.join(value_props)}
- Proof Points: {', '.join(proof_points)}

Email Guidelines:
1. Email 1 (Initial): ~150 words max. Hook with specific company insight. Soft CTA.
2. Email 2 (Follow-up, Day 3): ~100 words. New angle, address potential objection.
3. Email 3 (Break-up, Day 7): ~80 words. Direct question, create urgency.

Requirements:
- Highly personalized to the company
- Professional but conversational tone
- Focus on value, not features
- No generic phrases like "I hope this email finds you well"
- Each email should stand alone if others aren't read

Return as JSON array:
[
  {{
    "sequence": 1,
    "subject": "Subject line",
    "body": "Email body with {{{{first_name}}}} placeholder where appropriate",
    "delay_days": 0,
    "personalization_points": ["List", "of", "personalization", "used"]
  }},
  ...
]"""

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
    
    response_text = response.content[0].text
    
    # Extract JSON array
    import re
    json_match = re.search(r'\[[\s\S]*\]', response_text)
    
    if json_match:
        return json.loads(json_match.group())
    
    return []


def add_tracking_placeholder(body: str, prospect_id: str, sequence: int) -> str:
    """Add tracking pixel and link tracking placeholders"""
    
    # Add tracking pixel at the end
    tracking_pixel = f"\n\n<!-- tracking:{prospect_id}:{sequence} -->"
    
    return body + tracking_pixel


def main():
    parser = argparse.ArgumentParser(description="Generate personalized email sequence")
    parser.add_argument("--prospect", required=True, help="Prospect JSON file")
    parser.add_argument("--icp", required=True, help="ICP JSON file")
    parser.add_argument("--templates", default="./templates", help="Templates directory")
    parser.add_argument("--output", required=True, help="Output directory")
    
    args = parser.parse_args()
    
    if not ANTHROPIC_API_KEY:
        print("Error: ANTHROPIC_API_KEY not set")
        return 1
    
    try:
        # Load prospect
        with open(args.prospect, "r") as f:
            prospect = json.load(f)
        
        # Load ICP
        with open(args.icp, "r") as f:
            icp = json.load(f)
        
        # Load templates
        templates = load_templates(args.templates)
        
        prospect_name = prospect.get("company_name", "Unknown")
        print(f"Generating email sequence for: {prospect_name}")
        
        # Generate emails
        emails = generate_email_sequence(prospect, icp, templates)
        
        if not emails:
            print("Error: No emails generated")
            return 1
        
        # Ensure output directory exists
        os.makedirs(args.output, exist_ok=True)
        
        # Save each email
        for email in emails:
            sequence = email.get("sequence", 1)
            
            # Add tracking
            email["body"] = add_tracking_placeholder(
                email["body"],
                prospect.get("id", "unknown"),
                sequence
            )
            
            output_file = os.path.join(args.output, f"email_{sequence}.json")
            with open(output_file, "w") as f:
                json.dump(email, f, indent=2)
            
            print(f"  Saved: email_{sequence}.json")
        
        print(f"\nGenerated {len(emails)} emails in: {args.output}")
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())

