#!/usr/bin/env python3
"""
Market Researcher - Gathers competitive intelligence using Perplexity API
"""

import os
import json
import argparse
import asyncio
import aiohttp
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"


async def research_company(company_name: str, industry: str) -> dict:
    """Research a company using Perplexity API"""
    
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    queries = [
        f"What does {company_name} do? What products or services do they offer?",
        f"Who are the main competitors of {company_name} in the {industry} industry?",
        f"What is the target market for {company_name}? What types of customers do they serve?",
        f"What are the key differentiators and unique selling points of {company_name}?",
        f"What is the company size, funding, and growth stage of {company_name}?",
    ]
    
    results = {}
    
    async with aiohttp.ClientSession() as session:
        for i, query in enumerate(queries):
            try:
                payload = {
                    "model": "sonar",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a business analyst researching companies. Provide concise, factual information."
                        },
                        {
                            "role": "user",
                            "content": query
                        }
                    ],
                    "max_tokens": 500
                }
                
                async with session.post(
                    PERPLEXITY_API_URL,
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        answer = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                        
                        # Map to result keys
                        keys = ["overview", "competitors", "target_market", "differentiators", "company_info"]
                        results[keys[i]] = answer
                    else:
                        print(f"Warning: Query {i+1} failed: {await response.text()}")
                
                # Rate limiting
                await asyncio.sleep(1)
                
            except Exception as e:
                print(f"Warning: Query {i+1} error: {e}")
    
    return results


async def research_industry(industry: str) -> dict:
    """Research industry trends and dynamics"""
    
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "sonar",
        "messages": [
            {
                "role": "system",
                "content": "You are an industry analyst. Provide insights about industry trends and dynamics."
            },
            {
                "role": "user",
                "content": f"""Analyze the {industry} industry:
1. What are the current market trends?
2. What are the common pain points for companies in this industry?
3. What technologies or solutions are in demand?
4. What is the typical buying process and who are the decision makers?"""
            }
        ],
        "max_tokens": 1000
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            PERPLEXITY_API_URL,
            headers=headers,
            json=payload
        ) as response:
            if response.status == 200:
                data = await response.json()
                return {
                    "industry_analysis": data.get("choices", [{}])[0].get("message", {}).get("content", "")
                }
            else:
                return {"industry_analysis": "Unable to analyze industry"}


async def main():
    parser = argparse.ArgumentParser(description="Research a company and its market")
    parser.add_argument("--company", required=True, help="Company name")
    parser.add_argument("--industry", required=True, help="Industry vertical")
    parser.add_argument("--output", required=True, help="Output file path")
    
    args = parser.parse_args()
    
    if not PERPLEXITY_API_KEY:
        print("Error: PERPLEXITY_API_KEY not set")
        return 1
    
    print(f"Researching: {args.company} in {args.industry}")
    
    try:
        # Research company
        company_research = await research_company(args.company, args.industry)
        
        # Research industry
        industry_research = await research_industry(args.industry)
        
        # Combine results
        results = {
            "company_name": args.company,
            "industry": args.industry,
            **company_research,
            **industry_research
        }
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        
        # Save results
        with open(args.output, "w") as f:
            json.dump(results, f, indent=2)
        
        print(f"Research saved to: {args.output}")
        return 0
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(asyncio.run(main()))

