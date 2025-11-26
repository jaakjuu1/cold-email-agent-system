#!/usr/bin/env python3
"""
Contact Finder - Discovers decision maker contact information
"""

import os
import json
import argparse
import asyncio
import re
from typing import List, Optional
import aiohttp
from dotenv import load_dotenv

load_dotenv()

HUNTER_API_KEY = os.getenv("HUNTER_API_KEY")
APOLLO_API_KEY = os.getenv("APOLLO_API_KEY")


def generate_email_patterns(domain: str, first_name: str, last_name: str) -> List[str]:
    """Generate common email patterns"""
    
    first = first_name.lower()
    last = last_name.lower()
    first_initial = first[0] if first else ""
    last_initial = last[0] if last else ""
    
    patterns = [
        f"{first}@{domain}",
        f"{last}@{domain}",
        f"{first}.{last}@{domain}",
        f"{first_initial}{last}@{domain}",
        f"{first}{last_initial}@{domain}",
        f"{first}_{last}@{domain}",
        f"{first}{last}@{domain}",
    ]
    
    return patterns


async def search_hunter(domain: str) -> List[dict]:
    """Search for contacts using Hunter.io"""
    
    if not HUNTER_API_KEY:
        return []
    
    params = {
        "domain": domain,
        "api_key": HUNTER_API_KEY,
        "limit": 5
    }
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(
                "https://api.hunter.io/v2/domain-search",
                params=params,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    emails = data.get("data", {}).get("emails", [])
                    
                    contacts = []
                    for email in emails:
                        contacts.append({
                            "name": f"{email.get('first_name', '')} {email.get('last_name', '')}".strip(),
                            "title": email.get("position", ""),
                            "email": email.get("value"),
                            "confidence": email.get("confidence", 0),
                            "source": "hunter"
                        })
                    
                    return contacts
        except Exception as e:
            print(f"Warning: Hunter.io error: {e}")
    
    return []


async def search_apollo(domain: str, titles: List[str] = None) -> List[dict]:
    """Search for contacts using Apollo.io"""
    
    if not APOLLO_API_KEY:
        return []
    
    if titles is None:
        titles = ["CEO", "CTO", "Founder", "VP", "Director"]
    
    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": APOLLO_API_KEY
    }
    
    payload = {
        "q_organization_domains": domain,
        "person_titles": titles,
        "per_page": 5
    }
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                "https://api.apollo.io/v1/mixed_people/search",
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    people = data.get("people", [])
                    
                    contacts = []
                    for person in people:
                        contacts.append({
                            "name": person.get("name", ""),
                            "title": person.get("title", ""),
                            "email": person.get("email"),
                            "linkedin_url": person.get("linkedin_url"),
                            "confidence": 90 if person.get("email") else 50,
                            "source": "apollo"
                        })
                    
                    return contacts
        except Exception as e:
            print(f"Warning: Apollo.io error: {e}")
    
    return []


async def find_contacts(prospect: dict, target_titles: List[str] = None) -> dict:
    """Find contacts for a single prospect"""
    
    if target_titles is None:
        target_titles = ["CEO", "CTO", "VP Engineering", "Director of Engineering", "Founder"]
    
    updated = prospect.copy()
    domain = prospect.get("domain")
    
    if not domain:
        return updated
    
    # Search multiple sources
    contacts = []
    
    # Hunter.io
    hunter_contacts = await search_hunter(domain)
    contacts.extend(hunter_contacts)
    
    # Apollo.io
    apollo_contacts = await search_apollo(domain, target_titles)
    contacts.extend(apollo_contacts)
    
    # Deduplicate by email
    seen_emails = set()
    unique_contacts = []
    
    for contact in contacts:
        email = contact.get("email")
        if email and email not in seen_emails:
            seen_emails.add(email)
            unique_contacts.append(contact)
        elif not email and contact.get("name"):
            # Keep contacts without email if they have a name
            unique_contacts.append(contact)
    
    # Sort by confidence and select top contacts
    unique_contacts.sort(key=lambda x: x.get("confidence", 0), reverse=True)
    
    # Mark primary contact
    if unique_contacts:
        unique_contacts[0]["is_primary"] = True
        for contact in unique_contacts[1:]:
            contact["is_primary"] = False
    
    updated["contacts"] = unique_contacts[:5]  # Keep top 5
    
    return updated


async def find_contacts_batch(
    prospects: List[dict],
    max_process: int = 20,
    delay: float = 1.0
) -> List[dict]:
    """Find contacts for multiple prospects"""
    
    results = []
    
    for i, prospect in enumerate(prospects):
        if i < max_process and prospect.get("domain"):
            print(f"Finding contacts {i+1}/{min(len(prospects), max_process)}: {prospect.get('company_name')}")
            updated = await find_contacts(prospect)
            results.append(updated)
            await asyncio.sleep(delay)
        else:
            results.append(prospect)
    
    return results


async def main():
    parser = argparse.ArgumentParser(description="Find decision maker contacts")
    parser.add_argument("--input", required=True, help="Input prospects JSON file")
    parser.add_argument("--output", required=True, help="Output JSON file with contacts")
    parser.add_argument("--max-process", type=int, default=20, help="Max prospects to process")
    
    args = parser.parse_args()
    
    try:
        # Load prospects
        with open(args.input, "r") as f:
            data = json.load(f)
        
        prospects = data.get("prospects", [])
        
        print(f"Finding contacts for up to {args.max_process} of {len(prospects)} prospects...")
        
        # Find contacts
        results = await find_contacts_batch(prospects, max_process=args.max_process)
        
        # Count contacts found
        contacts_found = sum(len(p.get("contacts", [])) for p in results)
        
        # Prepare output
        output = {
            "query": data.get("query", {}),
            "total_prospects": len(results),
            "contacts_found": contacts_found,
            "prospects": results
        }
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        
        # Save results
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        
        print(f"Found {contacts_found} contacts total")
        print(f"Results saved to: {args.output}")
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(asyncio.run(main()))

