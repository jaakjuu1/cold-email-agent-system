#!/usr/bin/env python3
"""
Response Tracker for Email Campaign Management

Processes email responses, classifies sentiment, and updates campaign state.
"""

import argparse
import json
import sys
from datetime import datetime
from typing import Optional, List
from dataclasses import dataclass, asdict
from pathlib import Path
import os
import re

# Try to import anthropic for sentiment analysis
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False


@dataclass
class EmailResponse:
    """Represents an email response"""
    id: str
    campaign_id: str
    prospect_id: str
    email_id: str
    message_id: str
    in_reply_to: str
    from_address: str
    subject: str
    body: str
    received_at: str
    sentiment: Optional[str] = None
    requires_action: bool = False
    action_taken: Optional[str] = None
    processed_at: Optional[str] = None


class SentimentClassifier:
    """Classifies email response sentiment"""
    
    # Keywords for quick classification
    POSITIVE_KEYWORDS = [
        'interested', 'yes', 'schedule', 'call', 'meeting', 'discuss',
        'tell me more', 'sounds good', 'let\'s talk', 'available',
        'free', 'open to', 'love to', 'would like', 'happy to'
    ]
    
    NEGATIVE_KEYWORDS = [
        'not interested', 'no thanks', 'unsubscribe', 'remove me',
        'stop', 'don\'t contact', 'not a fit', 'no need', 'pass',
        'not looking', 'already have', 'no budget'
    ]
    
    OOO_KEYWORDS = [
        'out of office', 'ooo', 'away from', 'vacation', 'holiday',
        'limited access', 'returning', 'back on', 'auto-reply'
    ]
    
    UNSUBSCRIBE_KEYWORDS = [
        'unsubscribe', 'remove', 'opt out', 'stop emailing',
        'do not contact', 'take me off'
    ]
    
    def __init__(self, use_ai: bool = True):
        self.use_ai = use_ai and ANTHROPIC_AVAILABLE
        if self.use_ai:
            api_key = os.environ.get('ANTHROPIC_API_KEY')
            if api_key:
                self.client = anthropic.Anthropic(api_key=api_key)
            else:
                self.use_ai = False
    
    def classify(self, subject: str, body: str) -> dict:
        """Classify response sentiment"""
        text = f"{subject}\n{body}".lower()
        
        # Quick keyword checks first
        if any(kw in text for kw in self.UNSUBSCRIBE_KEYWORDS):
            return {
                'sentiment': 'unsubscribe',
                'confidence': 0.95,
                'requires_action': True,
                'action_type': 'remove_from_list'
            }
        
        if any(kw in text for kw in self.OOO_KEYWORDS):
            return {
                'sentiment': 'out_of_office',
                'confidence': 0.9,
                'requires_action': False,
                'action_type': 'reschedule_followup'
            }
        
        # Use AI for more nuanced classification
        if self.use_ai:
            return self._classify_with_ai(subject, body)
        
        # Fallback to keyword-based classification
        return self._classify_with_keywords(text)
    
    def _classify_with_keywords(self, text: str) -> dict:
        """Simple keyword-based classification"""
        positive_count = sum(1 for kw in self.POSITIVE_KEYWORDS if kw in text)
        negative_count = sum(1 for kw in self.NEGATIVE_KEYWORDS if kw in text)
        
        if positive_count > negative_count:
            return {
                'sentiment': 'positive',
                'confidence': min(0.5 + positive_count * 0.1, 0.85),
                'requires_action': True,
                'action_type': 'schedule_meeting'
            }
        elif negative_count > positive_count:
            return {
                'sentiment': 'negative',
                'confidence': min(0.5 + negative_count * 0.1, 0.85),
                'requires_action': False,
                'action_type': 'stop_sequence'
            }
        else:
            return {
                'sentiment': 'neutral',
                'confidence': 0.5,
                'requires_action': True,
                'action_type': 'manual_review'
            }
    
    def _classify_with_ai(self, subject: str, body: str) -> dict:
        """Use Claude for sentiment classification"""
        prompt = f"""Classify this email response to a cold outreach email.

Subject: {subject}
Body: {body}

Respond with a JSON object containing:
- sentiment: one of "positive", "neutral", "negative", "out_of_office", "unsubscribe"
- confidence: 0.0 to 1.0
- requires_action: boolean
- action_type: suggested action like "schedule_meeting", "manual_review", "stop_sequence", "reschedule_followup", "remove_from_list"
- summary: brief explanation of the classification

Only output the JSON, no other text."""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}]
            )
            
            result_text = response.content[0].text.strip()
            # Try to parse JSON from response
            if result_text.startswith('{'):
                return json.loads(result_text)
            
            # Try to extract JSON from response
            json_match = re.search(r'\{[^}]+\}', result_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
                
        except Exception as e:
            print(f"AI classification failed: {e}", file=sys.stderr)
        
        # Fallback to keyword classification
        return self._classify_with_keywords(f"{subject}\n{body}".lower())


class ResponseTracker:
    """Tracks and processes email responses"""
    
    def __init__(self, campaign_id: str, storage_path: Optional[str] = None):
        self.campaign_id = campaign_id
        self.storage_path = storage_path or os.environ.get(
            'RESPONSE_TRACKER_STORAGE',
            './.claude/data/responses'
        )
        Path(self.storage_path).mkdir(parents=True, exist_ok=True)
        
        self.classifier = SentimentClassifier()
        self.responses: List[EmailResponse] = self._load_responses()
    
    def _responses_path(self) -> Path:
        return Path(self.storage_path) / f"{self.campaign_id}_responses.json"
    
    def _load_responses(self) -> List[EmailResponse]:
        """Load existing responses"""
        path = self._responses_path()
        if path.exists():
            with open(path) as f:
                data = json.load(f)
                return [EmailResponse(**r) for r in data]
        return []
    
    def _save_responses(self):
        """Save responses to file"""
        with open(self._responses_path(), 'w') as f:
            json.dump([asdict(r) for r in self.responses], f, indent=2)
    
    def add_response(self, response: EmailResponse) -> EmailResponse:
        """Add and process a new response"""
        # Classify sentiment
        classification = self.classifier.classify(response.subject, response.body)
        
        response.sentiment = classification['sentiment']
        response.requires_action = classification['requires_action']
        response.processed_at = datetime.utcnow().isoformat()
        
        self.responses.append(response)
        self._save_responses()
        
        return response
    
    def process_responses(self, responses: List[dict]) -> List[EmailResponse]:
        """Process multiple new responses"""
        processed = []
        for r in responses:
            response = EmailResponse(**r)
            processed_response = self.add_response(response)
            processed.append(processed_response)
        return processed
    
    def get_unprocessed(self) -> List[EmailResponse]:
        """Get responses that need action"""
        return [r for r in self.responses if r.requires_action and not r.action_taken]
    
    def mark_actioned(self, response_id: str, action: str):
        """Mark a response as actioned"""
        for r in self.responses:
            if r.id == response_id:
                r.action_taken = action
                break
        self._save_responses()
    
    def generate_report(self) -> dict:
        """Generate response report"""
        total = len(self.responses)
        by_sentiment = {}
        requiring_action = 0
        actioned = 0
        
        for r in self.responses:
            sentiment = r.sentiment or 'unknown'
            by_sentiment[sentiment] = by_sentiment.get(sentiment, 0) + 1
            
            if r.requires_action:
                requiring_action += 1
                if r.action_taken:
                    actioned += 1
        
        return {
            'campaign_id': self.campaign_id,
            'total_responses': total,
            'by_sentiment': by_sentiment,
            'response_rate': {
                'positive': by_sentiment.get('positive', 0) / total if total > 0 else 0,
                'negative': by_sentiment.get('negative', 0) / total if total > 0 else 0,
                'neutral': by_sentiment.get('neutral', 0) / total if total > 0 else 0,
            },
            'action_status': {
                'requiring_action': requiring_action,
                'actioned': actioned,
                'pending': requiring_action - actioned
            },
            'generated_at': datetime.utcnow().isoformat()
        }
    
    def get_positive_responses(self) -> List[EmailResponse]:
        """Get all positive responses"""
        return [r for r in self.responses if r.sentiment == 'positive']


def main():
    parser = argparse.ArgumentParser(description='Email Response Tracker')
    parser.add_argument('command', choices=['process', 'report', 'pending', 'action'])
    parser.add_argument('--campaign-id', '-c', required=True, help='Campaign ID')
    parser.add_argument('--input', '-i', help='Input file for processing')
    parser.add_argument('--response-id', help='Response ID for action')
    parser.add_argument('--action', help='Action taken')
    parser.add_argument('--format', choices=['json', 'text'], default='json', help='Output format')
    
    args = parser.parse_args()
    
    tracker = ResponseTracker(args.campaign_id)
    
    if args.command == 'process':
        if args.input:
            with open(args.input) as f:
                responses = json.load(f)
        else:
            # Read from stdin
            responses = json.load(sys.stdin)
        
        processed = tracker.process_responses(responses)
        result = {'processed': len(processed), 'responses': [asdict(r) for r in processed]}
    
    elif args.command == 'report':
        result = tracker.generate_report()
    
    elif args.command == 'pending':
        pending = tracker.get_unprocessed()
        result = {'pending': len(pending), 'responses': [asdict(r) for r in pending]}
    
    elif args.command == 'action':
        if not args.response_id or not args.action:
            print("Error: --response-id and --action required", file=sys.stderr)
            sys.exit(1)
        tracker.mark_actioned(args.response_id, args.action)
        result = {'success': True, 'response_id': args.response_id, 'action': args.action}
    
    if args.format == 'json':
        print(json.dumps(result, indent=2))
    else:
        if args.command == 'report':
            print(f"\n=== Response Report: {args.campaign_id} ===\n")
            print(f"Total Responses: {result['total_responses']}")
            print("\nBy Sentiment:")
            for sentiment, count in result['by_sentiment'].items():
                print(f"  {sentiment}: {count}")
            print(f"\nPending Actions: {result['action_status']['pending']}")


if __name__ == '__main__':
    main()

