#!/usr/bin/env python3
"""
Quality Checker - Validates email quality and deliverability
"""

import os
import json
import argparse
import re
from typing import List, Tuple


# Spam trigger words to avoid
SPAM_TRIGGERS = [
    "act now", "limited time", "urgent", "click here", "buy now",
    "free", "guarantee", "no obligation", "winner", "congratulations",
    "100%", "amazing deal", "best price", "bonus", "cash",
    "cheap", "credit", "discount", "double your", "earn money",
    "extra income", "fast cash", "for free", "get paid", "incredible",
    "info you requested", "limited offer", "make money", "million",
    "no cost", "offer", "opportunity", "order now", "please read",
    "promise", "pure profit", "risk-free", "satisfaction", "save big",
    "special promotion", "this isn't spam", "unbelievable", "unlimited",
    "while supplies last", "why pay more"
]

# Generic phrases to avoid
GENERIC_PHRASES = [
    "hope this email finds you well",
    "i hope you're doing well",
    "i wanted to reach out",
    "just following up",
    "touching base",
    "circling back",
    "per my last email",
    "as discussed",
    "i am writing to",
    "my name is",
    "i'm reaching out because",
    "we are a leading",
    "industry-leading",
    "best-in-class",
    "synergy",
    "leverage",
    "paradigm",
    "disruptive"
]


def check_spam_score(text: str) -> Tuple[int, List[str]]:
    """Check for spam trigger words"""
    
    text_lower = text.lower()
    found_triggers = []
    
    for trigger in SPAM_TRIGGERS:
        if trigger in text_lower:
            found_triggers.append(trigger)
    
    # Score: 10 points per trigger, max 50
    score = min(len(found_triggers) * 10, 50)
    
    return score, found_triggers


def check_generic_phrases(text: str) -> Tuple[int, List[str]]:
    """Check for generic phrases"""
    
    text_lower = text.lower()
    found_phrases = []
    
    for phrase in GENERIC_PHRASES:
        if phrase in text_lower:
            found_phrases.append(phrase)
    
    # Score: 5 points per phrase, max 30
    score = min(len(found_phrases) * 5, 30)
    
    return score, found_phrases


def check_length(text: str, max_length: int = 150) -> Tuple[int, str]:
    """Check email length"""
    
    # Count words
    words = len(text.split())
    
    if words <= max_length:
        return 0, f"{words} words (good)"
    elif words <= max_length * 1.5:
        return 10, f"{words} words (slightly long)"
    else:
        return 25, f"{words} words (too long, aim for {max_length})"


def check_personalization(text: str, subject: str) -> Tuple[int, List[str]]:
    """Check for personalization elements"""
    
    personalization_indicators = []
    score_bonus = 0
    
    # Check for placeholders
    if "{{" in text or "{" in text:
        personalization_indicators.append("Has dynamic placeholders")
        score_bonus += 5
    
    # Check for specific company mentions (not just generic)
    if re.search(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b', text):
        personalization_indicators.append("Contains proper nouns")
        score_bonus += 5
    
    # Check subject line personalization
    if "{{" in subject or re.search(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', subject):
        personalization_indicators.append("Subject line personalized")
        score_bonus += 10
    
    if not personalization_indicators:
        return -15, ["No personalization detected"]
    
    return score_bonus, personalization_indicators


def check_cta(text: str) -> Tuple[int, str]:
    """Check for call-to-action"""
    
    cta_patterns = [
        r'\?$',  # Ends with question
        r'(let me know|let\'s|would you|are you|can we|shall we)',
        r'(reply|respond|get back|reach out)',
        r'(schedule|book|set up|arrange)',
        r'(interested|curious|open to)'
    ]
    
    text_lower = text.lower()
    
    for pattern in cta_patterns:
        if re.search(pattern, text_lower):
            return 0, "Has clear CTA"
    
    return -15, "Missing clear call-to-action"


def check_subject_line(subject: str) -> Tuple[int, List[str]]:
    """Check subject line quality"""
    
    issues = []
    score = 0
    
    # Length check (4-9 words ideal)
    words = len(subject.split())
    if words < 3:
        issues.append("Subject too short")
        score -= 10
    elif words > 10:
        issues.append("Subject too long")
        score -= 10
    
    # All caps check
    if subject.isupper():
        issues.append("Subject is all caps (looks spammy)")
        score -= 15
    
    # Exclamation marks
    if subject.count("!") > 1:
        issues.append("Too many exclamation marks")
        score -= 10
    
    # RE: or FWD: fake threading
    if subject.lower().startswith(("re:", "fwd:", "fw:")):
        issues.append("Fake RE:/FWD: prefix (unethical)")
        score -= 20
    
    if not issues:
        return 5, ["Subject line looks good"]
    
    return score, issues


def calculate_quality_score(email: dict) -> dict:
    """Calculate overall quality score and provide feedback"""
    
    subject = email.get("subject", "")
    body = email.get("body", "")
    full_text = f"{subject}\n{body}"
    
    # Start with base score of 100
    score = 100
    feedback = []
    warnings = []
    
    # Spam check
    spam_penalty, spam_triggers = check_spam_score(full_text)
    score -= spam_penalty
    if spam_triggers:
        warnings.append(f"Spam triggers found: {', '.join(spam_triggers)}")
    
    # Generic phrases check
    generic_penalty, generic_phrases = check_generic_phrases(full_text)
    score -= generic_penalty
    if generic_phrases:
        warnings.append(f"Generic phrases found: {', '.join(generic_phrases)}")
    
    # Length check
    length_penalty, length_feedback = check_length(body)
    score -= length_penalty
    feedback.append(f"Length: {length_feedback}")
    
    # Personalization check
    pers_bonus, pers_feedback = check_personalization(body, subject)
    score += pers_bonus
    feedback.extend(pers_feedback)
    
    # CTA check
    cta_penalty, cta_feedback = check_cta(body)
    score += cta_penalty
    feedback.append(f"CTA: {cta_feedback}")
    
    # Subject line check
    subj_score, subj_feedback = check_subject_line(subject)
    score += subj_score
    feedback.extend(subj_feedback)
    
    # Ensure score is between 0 and 100
    score = max(0, min(100, score))
    
    return {
        "score": score,
        "grade": get_grade(score),
        "feedback": feedback,
        "warnings": warnings,
        "recommendations": get_recommendations(score, warnings, feedback)
    }


def get_grade(score: int) -> str:
    """Convert score to letter grade"""
    
    if score >= 90:
        return "A"
    elif score >= 80:
        return "B"
    elif score >= 70:
        return "C"
    elif score >= 60:
        return "D"
    else:
        return "F"


def get_recommendations(score: int, warnings: List[str], feedback: List[str]) -> List[str]:
    """Generate recommendations based on analysis"""
    
    recommendations = []
    
    if score < 80:
        if any("spam" in w.lower() for w in warnings):
            recommendations.append("Remove spam trigger words to improve deliverability")
        
        if any("generic" in w.lower() for w in warnings):
            recommendations.append("Replace generic phrases with specific, personalized content")
        
        if any("long" in f.lower() for f in feedback):
            recommendations.append("Shorten the email - aim for 100-150 words")
        
        if any("no personalization" in f.lower() for f in feedback):
            recommendations.append("Add specific details about the prospect's company")
        
        if any("missing" in f.lower() and "cta" in f.lower() for f in feedback):
            recommendations.append("Add a clear call-to-action (question or specific ask)")
    
    if not recommendations:
        recommendations.append("Email looks good! Consider A/B testing subject lines.")
    
    return recommendations


def main():
    parser = argparse.ArgumentParser(description="Check email quality")
    parser.add_argument("--email", required=True, help="Email JSON file")
    parser.add_argument("--min-score", type=int, default=70, help="Minimum acceptable score")
    parser.add_argument("--output", help="Output report JSON file")
    
    args = parser.parse_args()
    
    try:
        # Load email
        with open(args.email, "r") as f:
            email = json.load(f)
        
        print(f"Checking email quality...")
        print(f"Subject: {email.get('subject', 'N/A')[:50]}...")
        
        # Calculate quality
        result = calculate_quality_score(email)
        
        # Report
        print(f"\n{'='*50}")
        print(f"Quality Score: {result['score']}/100 (Grade: {result['grade']})")
        print(f"{'='*50}")
        
        if result['warnings']:
            print("\n⚠️  Warnings:")
            for warning in result['warnings']:
                print(f"  - {warning}")
        
        print("\n📊 Analysis:")
        for item in result['feedback']:
            print(f"  - {item}")
        
        print("\n💡 Recommendations:")
        for rec in result['recommendations']:
            print(f"  - {rec}")
        
        # Pass/fail
        passed = result['score'] >= args.min_score
        print(f"\n{'✅ PASSED' if passed else '❌ FAILED'} (minimum: {args.min_score})")
        
        # Save report if requested
        if args.output:
            report = {
                "email_file": args.email,
                "quality_report": result,
                "passed": passed,
                "min_score": args.min_score
            }
            with open(args.output, "w") as f:
                json.dump(report, f, indent=2)
            print(f"\nReport saved to: {args.output}")
        
        return 0 if passed else 1
        
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())

