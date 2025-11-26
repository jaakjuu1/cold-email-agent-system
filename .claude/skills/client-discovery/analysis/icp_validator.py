#!/usr/bin/env python3
"""
ICP Validator - Validates ICP completeness and quality
"""

import json
import argparse
from typing import List, Tuple


def validate_icp(icp: dict) -> Tuple[bool, List[str], List[str]]:
    """
    Validate ICP structure and content quality
    Returns: (is_valid, errors, warnings)
    """
    errors = []
    warnings = []
    
    # Required top-level fields
    required_fields = [
        "icp_summary",
        "firmographic_criteria",
        "geographic_targeting",
        "industry_targeting",
        "decision_maker_targeting",
        "messaging_framework"
    ]
    
    for field in required_fields:
        if field not in icp:
            errors.append(f"Missing required field: {field}")
    
    # Validate ICP summary
    if "icp_summary" in icp:
        if len(icp["icp_summary"]) < 50:
            warnings.append("ICP summary is too short (< 50 chars)")
        if len(icp["icp_summary"]) > 1000:
            warnings.append("ICP summary is too long (> 1000 chars)")
    
    # Validate firmographic criteria
    if "firmographic_criteria" in icp:
        fc = icp["firmographic_criteria"]
        
        if "company_size" not in fc:
            errors.append("Missing company_size in firmographic_criteria")
        else:
            cs = fc["company_size"]
            if not cs.get("employee_ranges"):
                errors.append("No employee_ranges defined")
            if not cs.get("revenue_ranges"):
                warnings.append("No revenue_ranges defined")
        
        if not fc.get("company_stage"):
            warnings.append("No company_stage defined")
    
    # Validate geographic targeting
    if "geographic_targeting" in icp:
        gt = icp["geographic_targeting"]
        
        if not gt.get("primary_markets"):
            errors.append("No primary_markets defined")
        else:
            for market in gt["primary_markets"]:
                if not market.get("city") and not market.get("state"):
                    errors.append("Market missing location details")
                if not market.get("priority"):
                    warnings.append("Market missing priority level")
    
    # Validate industry targeting
    if "industry_targeting" in icp:
        it = icp["industry_targeting"]
        
        if not it.get("primary_industries"):
            errors.append("No primary_industries defined")
        else:
            for industry in it["primary_industries"]:
                if not industry.get("name"):
                    errors.append("Industry missing name")
    
    # Validate decision maker targeting
    if "decision_maker_targeting" in icp:
        dm = icp["decision_maker_targeting"]
        
        if not dm.get("primary_titles"):
            errors.append("No primary_titles defined")
        if not dm.get("departments"):
            warnings.append("No departments defined")
    
    # Validate messaging framework
    if "messaging_framework" in icp:
        mf = icp["messaging_framework"]
        
        if not mf.get("primary_pain_points_to_address"):
            errors.append("No pain_points defined")
        elif len(mf["primary_pain_points_to_address"]) < 2:
            warnings.append("Consider adding more pain points (< 2)")
        
        if not mf.get("value_propositions"):
            errors.append("No value_propositions defined")
        elif len(mf["value_propositions"]) < 2:
            warnings.append("Consider adding more value props (< 2)")
        
        if not mf.get("proof_points"):
            warnings.append("No proof_points defined")
    
    is_valid = len(errors) == 0
    
    return is_valid, errors, warnings


def main():
    parser = argparse.ArgumentParser(description="Validate ICP structure and quality")
    parser.add_argument("--icp", required=True, help="Path to ICP JSON file")
    parser.add_argument("--strict", action="store_true", help="Treat warnings as errors")
    
    args = parser.parse_args()
    
    try:
        # Load ICP
        with open(args.icp, "r") as f:
            icp = json.load(f)
        
        print("Validating ICP...")
        
        # Validate
        is_valid, errors, warnings = validate_icp(icp)
        
        # Report errors
        if errors:
            print("\n❌ Errors:")
            for error in errors:
                print(f"  - {error}")
        
        # Report warnings
        if warnings:
            print("\n⚠️  Warnings:")
            for warning in warnings:
                print(f"  - {warning}")
        
        # Summary
        if is_valid and not warnings:
            print("\n✅ ICP is valid and complete!")
            return 0
        elif is_valid and warnings:
            print(f"\n✅ ICP is valid but has {len(warnings)} warning(s)")
            return 0 if not args.strict else 1
        else:
            print(f"\n❌ ICP validation failed with {len(errors)} error(s)")
            return 1
        
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in ICP file: {e}")
        return 1
    except FileNotFoundError:
        print(f"Error: File not found: {args.icp}")
        return 1
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())

