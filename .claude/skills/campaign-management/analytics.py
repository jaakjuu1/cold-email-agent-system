#!/usr/bin/env python3
"""
Campaign Analytics for Email Campaign Management

Generates campaign performance analytics, reports, and insights.
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from pathlib import Path
import os


@dataclass
class CampaignMetrics:
    """Campaign performance metrics"""
    campaign_id: str
    
    # Volume metrics
    total_prospects: int = 0
    emails_sent: int = 0
    emails_delivered: int = 0
    emails_bounced: int = 0
    
    # Engagement metrics
    emails_opened: int = 0
    unique_opens: int = 0
    emails_clicked: int = 0
    unique_clicks: int = 0
    
    # Response metrics  
    total_responses: int = 0
    positive_responses: int = 0
    neutral_responses: int = 0
    negative_responses: int = 0
    out_of_office: int = 0
    unsubscribes: int = 0
    
    # Outcome metrics
    meetings_scheduled: int = 0
    conversions: int = 0
    
    # Calculated rates
    @property
    def delivery_rate(self) -> float:
        return self.emails_delivered / self.emails_sent if self.emails_sent > 0 else 0
    
    @property
    def bounce_rate(self) -> float:
        return self.emails_bounced / self.emails_sent if self.emails_sent > 0 else 0
    
    @property
    def open_rate(self) -> float:
        return self.unique_opens / self.emails_delivered if self.emails_delivered > 0 else 0
    
    @property
    def click_rate(self) -> float:
        return self.unique_clicks / self.emails_delivered if self.emails_delivered > 0 else 0
    
    @property
    def response_rate(self) -> float:
        return self.total_responses / self.emails_delivered if self.emails_delivered > 0 else 0
    
    @property
    def positive_response_rate(self) -> float:
        return self.positive_responses / self.emails_delivered if self.emails_delivered > 0 else 0
    
    @property
    def meeting_rate(self) -> float:
        return self.meetings_scheduled / self.total_prospects if self.total_prospects > 0 else 0
    
    @property
    def conversion_rate(self) -> float:
        return self.conversions / self.total_prospects if self.total_prospects > 0 else 0


@dataclass
class DailyMetrics:
    """Daily metrics snapshot"""
    date: str
    emails_sent: int = 0
    emails_delivered: int = 0
    emails_bounced: int = 0
    opens: int = 0
    clicks: int = 0
    responses: int = 0
    positive_responses: int = 0


class CampaignAnalytics:
    """Campaign analytics generator"""
    
    def __init__(self, campaign_id: str, storage_path: Optional[str] = None):
        self.campaign_id = campaign_id
        self.storage_path = storage_path or os.environ.get(
            'ANALYTICS_STORAGE',
            './.claude/data/analytics'
        )
        Path(self.storage_path).mkdir(parents=True, exist_ok=True)
        
        self.metrics = self._load_metrics()
        self.daily_metrics = self._load_daily_metrics()
    
    def _metrics_path(self) -> Path:
        return Path(self.storage_path) / f"{self.campaign_id}_metrics.json"
    
    def _daily_path(self) -> Path:
        return Path(self.storage_path) / f"{self.campaign_id}_daily.json"
    
    def _load_metrics(self) -> CampaignMetrics:
        """Load campaign metrics"""
        path = self._metrics_path()
        if path.exists():
            with open(path) as f:
                data = json.load(f)
                return CampaignMetrics(**data)
        return CampaignMetrics(campaign_id=self.campaign_id)
    
    def _load_daily_metrics(self) -> List[DailyMetrics]:
        """Load daily metrics history"""
        path = self._daily_path()
        if path.exists():
            with open(path) as f:
                data = json.load(f)
                return [DailyMetrics(**d) for d in data]
        return []
    
    def _save_metrics(self):
        """Save metrics to file"""
        with open(self._metrics_path(), 'w') as f:
            # Convert dataclass to dict, excluding calculated properties
            data = {
                'campaign_id': self.metrics.campaign_id,
                'total_prospects': self.metrics.total_prospects,
                'emails_sent': self.metrics.emails_sent,
                'emails_delivered': self.metrics.emails_delivered,
                'emails_bounced': self.metrics.emails_bounced,
                'emails_opened': self.metrics.emails_opened,
                'unique_opens': self.metrics.unique_opens,
                'emails_clicked': self.metrics.emails_clicked,
                'unique_clicks': self.metrics.unique_clicks,
                'total_responses': self.metrics.total_responses,
                'positive_responses': self.metrics.positive_responses,
                'neutral_responses': self.metrics.neutral_responses,
                'negative_responses': self.metrics.negative_responses,
                'out_of_office': self.metrics.out_of_office,
                'unsubscribes': self.metrics.unsubscribes,
                'meetings_scheduled': self.metrics.meetings_scheduled,
                'conversions': self.metrics.conversions,
            }
            json.dump(data, f, indent=2)
    
    def _save_daily_metrics(self):
        """Save daily metrics to file"""
        with open(self._daily_path(), 'w') as f:
            json.dump([asdict(d) for d in self.daily_metrics], f, indent=2)
    
    def record_event(self, event_type: str, count: int = 1):
        """Record a campaign event"""
        event_map = {
            'sent': 'emails_sent',
            'delivered': 'emails_delivered',
            'bounced': 'emails_bounced',
            'opened': 'emails_opened',
            'unique_open': 'unique_opens',
            'clicked': 'emails_clicked',
            'unique_click': 'unique_clicks',
            'response': 'total_responses',
            'positive': 'positive_responses',
            'neutral': 'neutral_responses',
            'negative': 'negative_responses',
            'ooo': 'out_of_office',
            'unsubscribe': 'unsubscribes',
            'meeting': 'meetings_scheduled',
            'conversion': 'conversions',
        }
        
        if event_type in event_map:
            attr = event_map[event_type]
            current = getattr(self.metrics, attr, 0)
            setattr(self.metrics, attr, current + count)
            self._save_metrics()
            
            # Also update daily metrics
            self._record_daily_event(event_type, count)
    
    def _record_daily_event(self, event_type: str, count: int):
        """Record event in daily metrics"""
        today = datetime.utcnow().strftime('%Y-%m-%d')
        
        # Find or create today's entry
        daily = None
        for d in self.daily_metrics:
            if d.date == today:
                daily = d
                break
        
        if not daily:
            daily = DailyMetrics(date=today)
            self.daily_metrics.append(daily)
        
        # Update daily metric
        daily_map = {
            'sent': 'emails_sent',
            'delivered': 'emails_delivered',
            'bounced': 'emails_bounced',
            'opened': 'opens',
            'unique_open': 'opens',
            'clicked': 'clicks',
            'unique_click': 'clicks',
            'response': 'responses',
            'positive': 'positive_responses',
        }
        
        if event_type in daily_map:
            attr = daily_map[event_type]
            current = getattr(daily, attr, 0)
            setattr(daily, attr, current + count)
        
        self._save_daily_metrics()
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate full campaign report"""
        return {
            'campaign_id': self.campaign_id,
            'generated_at': datetime.utcnow().isoformat(),
            
            'summary': {
                'total_prospects': self.metrics.total_prospects,
                'emails_sent': self.metrics.emails_sent,
                'response_count': self.metrics.total_responses,
                'meetings': self.metrics.meetings_scheduled,
            },
            
            'volume_metrics': {
                'total_prospects': self.metrics.total_prospects,
                'emails_sent': self.metrics.emails_sent,
                'emails_delivered': self.metrics.emails_delivered,
                'emails_bounced': self.metrics.emails_bounced,
            },
            
            'rates': {
                'delivery_rate': round(self.metrics.delivery_rate * 100, 2),
                'bounce_rate': round(self.metrics.bounce_rate * 100, 2),
                'open_rate': round(self.metrics.open_rate * 100, 2),
                'click_rate': round(self.metrics.click_rate * 100, 2),
                'response_rate': round(self.metrics.response_rate * 100, 2),
                'positive_response_rate': round(self.metrics.positive_response_rate * 100, 2),
                'meeting_rate': round(self.metrics.meeting_rate * 100, 2),
            },
            
            'engagement': {
                'unique_opens': self.metrics.unique_opens,
                'total_opens': self.metrics.emails_opened,
                'unique_clicks': self.metrics.unique_clicks,
                'total_clicks': self.metrics.emails_clicked,
            },
            
            'responses': {
                'total': self.metrics.total_responses,
                'positive': self.metrics.positive_responses,
                'neutral': self.metrics.neutral_responses,
                'negative': self.metrics.negative_responses,
                'out_of_office': self.metrics.out_of_office,
                'unsubscribes': self.metrics.unsubscribes,
            },
            
            'outcomes': {
                'meetings_scheduled': self.metrics.meetings_scheduled,
                'conversions': self.metrics.conversions,
            },
            
            'benchmarks': self._compare_to_benchmarks(),
        }
    
    def _compare_to_benchmarks(self) -> Dict[str, Any]:
        """Compare campaign performance to industry benchmarks"""
        benchmarks = {
            'open_rate': {'industry_avg': 0.25, 'good': 0.35, 'excellent': 0.45},
            'response_rate': {'industry_avg': 0.02, 'good': 0.05, 'excellent': 0.10},
            'bounce_rate': {'industry_avg': 0.05, 'good': 0.02, 'excellent': 0.01},
        }
        
        comparisons = {}
        
        for metric, thresholds in benchmarks.items():
            value = getattr(self.metrics, metric, 0)
            
            if value >= thresholds['excellent']:
                rating = 'excellent'
            elif value >= thresholds['good']:
                rating = 'good'
            elif value >= thresholds['industry_avg']:
                rating = 'average'
            else:
                rating = 'below_average'
            
            comparisons[metric] = {
                'value': round(value * 100, 2),
                'rating': rating,
                'industry_average': round(thresholds['industry_avg'] * 100, 2),
            }
        
        return comparisons
    
    def get_daily_report(self, days: int = 7) -> Dict[str, Any]:
        """Get daily metrics for last N days"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        cutoff_str = cutoff.strftime('%Y-%m-%d')
        
        filtered = [d for d in self.daily_metrics if d.date >= cutoff_str]
        filtered.sort(key=lambda x: x.date)
        
        return {
            'campaign_id': self.campaign_id,
            'period': f'last_{days}_days',
            'generated_at': datetime.utcnow().isoformat(),
            'daily_data': [asdict(d) for d in filtered],
            'totals': {
                'emails_sent': sum(d.emails_sent for d in filtered),
                'emails_delivered': sum(d.emails_delivered for d in filtered),
                'opens': sum(d.opens for d in filtered),
                'clicks': sum(d.clicks for d in filtered),
                'responses': sum(d.responses for d in filtered),
                'positive_responses': sum(d.positive_responses for d in filtered),
            }
        }
    
    def get_funnel(self) -> Dict[str, Any]:
        """Get conversion funnel data"""
        return {
            'campaign_id': self.campaign_id,
            'stages': [
                {
                    'name': 'Prospects',
                    'count': self.metrics.total_prospects,
                    'percentage': 100
                },
                {
                    'name': 'Emails Sent',
                    'count': self.metrics.emails_sent,
                    'percentage': round(self.metrics.emails_sent / self.metrics.total_prospects * 100, 1) if self.metrics.total_prospects > 0 else 0
                },
                {
                    'name': 'Delivered',
                    'count': self.metrics.emails_delivered,
                    'percentage': round(self.metrics.emails_delivered / self.metrics.total_prospects * 100, 1) if self.metrics.total_prospects > 0 else 0
                },
                {
                    'name': 'Opened',
                    'count': self.metrics.unique_opens,
                    'percentage': round(self.metrics.unique_opens / self.metrics.total_prospects * 100, 1) if self.metrics.total_prospects > 0 else 0
                },
                {
                    'name': 'Responded',
                    'count': self.metrics.total_responses,
                    'percentage': round(self.metrics.total_responses / self.metrics.total_prospects * 100, 1) if self.metrics.total_prospects > 0 else 0
                },
                {
                    'name': 'Meetings',
                    'count': self.metrics.meetings_scheduled,
                    'percentage': round(self.metrics.meetings_scheduled / self.metrics.total_prospects * 100, 1) if self.metrics.total_prospects > 0 else 0
                },
            ]
        }


def main():
    parser = argparse.ArgumentParser(description='Campaign Analytics')
    parser.add_argument('command', choices=['report', 'daily', 'funnel', 'record'])
    parser.add_argument('--campaign-id', '-c', required=True, help='Campaign ID')
    parser.add_argument('--days', type=int, default=7, help='Number of days for daily report')
    parser.add_argument('--event', help='Event type to record')
    parser.add_argument('--count', type=int, default=1, help='Event count')
    parser.add_argument('--output', '-o', help='Output file')
    parser.add_argument('--format', choices=['json', 'text'], default='json', help='Output format')
    
    args = parser.parse_args()
    
    analytics = CampaignAnalytics(args.campaign_id)
    
    if args.command == 'report':
        result = analytics.generate_report()
    
    elif args.command == 'daily':
        result = analytics.get_daily_report(args.days)
    
    elif args.command == 'funnel':
        result = analytics.get_funnel()
    
    elif args.command == 'record':
        if not args.event:
            print("Error: --event required for record command", file=sys.stderr)
            sys.exit(1)
        analytics.record_event(args.event, args.count)
        result = {'success': True, 'event': args.event, 'count': args.count}
    
    output = json.dumps(result, indent=2)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        print(f"Report saved to {args.output}")
    else:
        print(output)


if __name__ == '__main__':
    main()

