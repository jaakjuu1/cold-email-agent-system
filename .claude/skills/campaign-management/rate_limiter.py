#!/usr/bin/env python3
"""
Rate Limiter for Email Campaign Management

Manages sending rate limits, warmup schedules, and queue scheduling
to ensure optimal deliverability and sender reputation.
"""

import argparse
import json
import sys
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass, asdict
from pathlib import Path
import os

@dataclass
class RateLimitConfig:
    """Rate limit configuration"""
    per_hour: int = 50
    per_day: int = 200
    min_delay_seconds: int = 5
    warmup_enabled: bool = True
    warmup_day: int = 0  # Days since warmup started
    warmup_schedule: list = None
    
    def __post_init__(self):
        if self.warmup_schedule is None:
            self.warmup_schedule = [10, 25, 50, 100, 150, 200]
    
    @property
    def effective_daily_limit(self) -> int:
        """Get daily limit based on warmup schedule"""
        if not self.warmup_enabled:
            return self.per_day
        
        if self.warmup_day >= len(self.warmup_schedule):
            return self.per_day
        
        return self.warmup_schedule[self.warmup_day]


@dataclass 
class RateLimitState:
    """Current state of rate limiter"""
    sent_this_hour: int = 0
    sent_today: int = 0
    hour_reset_at: str = ""
    day_reset_at: str = ""
    last_sent_at: str = ""
    queue_size: int = 0
    
    def __post_init__(self):
        now = datetime.utcnow()
        if not self.hour_reset_at:
            self.hour_reset_at = (now + timedelta(hours=1)).isoformat()
        if not self.day_reset_at:
            self.day_reset_at = (now + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            ).isoformat()


class RateLimiter:
    """Email sending rate limiter"""
    
    def __init__(self, campaign_id: str, storage_path: Optional[str] = None):
        self.campaign_id = campaign_id
        self.storage_path = storage_path or os.environ.get(
            'RATE_LIMITER_STORAGE', 
            './.claude/data/rate_limits'
        )
        Path(self.storage_path).mkdir(parents=True, exist_ok=True)
        
        self.config = self._load_config()
        self.state = self._load_state()
        self._reset_if_needed()
    
    def _config_path(self) -> Path:
        return Path(self.storage_path) / f"{self.campaign_id}_config.json"
    
    def _state_path(self) -> Path:
        return Path(self.storage_path) / f"{self.campaign_id}_state.json"
    
    def _load_config(self) -> RateLimitConfig:
        """Load or create rate limit config"""
        path = self._config_path()
        if path.exists():
            with open(path) as f:
                data = json.load(f)
                return RateLimitConfig(**data)
        return RateLimitConfig()
    
    def _save_config(self):
        """Save rate limit config"""
        with open(self._config_path(), 'w') as f:
            json.dump(asdict(self.config), f, indent=2)
    
    def _load_state(self) -> RateLimitState:
        """Load or create rate limit state"""
        path = self._state_path()
        if path.exists():
            with open(path) as f:
                data = json.load(f)
                return RateLimitState(**data)
        return RateLimitState()
    
    def _save_state(self):
        """Save rate limit state"""
        with open(self._state_path(), 'w') as f:
            json.dump(asdict(self.state), f, indent=2)
    
    def _reset_if_needed(self):
        """Reset counters if time has passed"""
        now = datetime.utcnow()
        
        # Reset hourly counter
        hour_reset = datetime.fromisoformat(self.state.hour_reset_at)
        if now >= hour_reset:
            self.state.sent_this_hour = 0
            self.state.hour_reset_at = (now + timedelta(hours=1)).isoformat()
        
        # Reset daily counter
        day_reset = datetime.fromisoformat(self.state.day_reset_at)
        if now >= day_reset:
            self.state.sent_today = 0
            self.state.day_reset_at = (now + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            ).isoformat()
            
            # Advance warmup day
            if self.config.warmup_enabled:
                self.config.warmup_day += 1
                self._save_config()
        
        self._save_state()
    
    def can_send(self) -> dict:
        """Check if we can send an email now"""
        self._reset_if_needed()
        
        # Check daily limit
        daily_limit = self.config.effective_daily_limit
        if self.state.sent_today >= daily_limit:
            wait_seconds = (
                datetime.fromisoformat(self.state.day_reset_at) - 
                datetime.utcnow()
            ).total_seconds()
            return {
                'allowed': False,
                'reason': 'daily_limit_reached',
                'wait_seconds': max(0, wait_seconds),
                'limit': daily_limit,
                'sent': self.state.sent_today
            }
        
        # Check hourly limit
        if self.state.sent_this_hour >= self.config.per_hour:
            wait_seconds = (
                datetime.fromisoformat(self.state.hour_reset_at) - 
                datetime.utcnow()
            ).total_seconds()
            return {
                'allowed': False,
                'reason': 'hourly_limit_reached',
                'wait_seconds': max(0, wait_seconds),
                'limit': self.config.per_hour,
                'sent': self.state.sent_this_hour
            }
        
        # Check minimum delay
        if self.state.last_sent_at:
            last_sent = datetime.fromisoformat(self.state.last_sent_at)
            elapsed = (datetime.utcnow() - last_sent).total_seconds()
            if elapsed < self.config.min_delay_seconds:
                return {
                    'allowed': False,
                    'reason': 'min_delay',
                    'wait_seconds': self.config.min_delay_seconds - elapsed
                }
        
        return {'allowed': True}
    
    def record_send(self):
        """Record that an email was sent"""
        self.state.sent_this_hour += 1
        self.state.sent_today += 1
        self.state.last_sent_at = datetime.utcnow().isoformat()
        self._save_state()
    
    def get_status(self) -> dict:
        """Get current rate limiter status"""
        self._reset_if_needed()
        
        return {
            'campaign_id': self.campaign_id,
            'config': asdict(self.config),
            'state': {
                'sent_this_hour': self.state.sent_this_hour,
                'hourly_limit': self.config.per_hour,
                'hourly_remaining': max(0, self.config.per_hour - self.state.sent_this_hour),
                'hour_resets_at': self.state.hour_reset_at,
                'sent_today': self.state.sent_today,
                'daily_limit': self.config.effective_daily_limit,
                'daily_remaining': max(0, self.config.effective_daily_limit - self.state.sent_today),
                'day_resets_at': self.state.day_reset_at,
                'queue_size': self.state.queue_size,
            },
            'warmup': {
                'enabled': self.config.warmup_enabled,
                'day': self.config.warmup_day,
                'schedule': self.config.warmup_schedule,
                'current_limit': self.config.effective_daily_limit,
            },
            'can_send': self.can_send()
        }
    
    def configure(
        self,
        per_hour: Optional[int] = None,
        per_day: Optional[int] = None,
        min_delay: Optional[int] = None,
        warmup_enabled: Optional[bool] = None,
        warmup_schedule: Optional[list] = None
    ):
        """Update rate limiter configuration"""
        if per_hour is not None:
            self.config.per_hour = per_hour
        if per_day is not None:
            self.config.per_day = per_day
        if min_delay is not None:
            self.config.min_delay_seconds = min_delay
        if warmup_enabled is not None:
            self.config.warmup_enabled = warmup_enabled
        if warmup_schedule is not None:
            self.config.warmup_schedule = warmup_schedule
        
        self._save_config()
        return self.get_status()
    
    def schedule_batch(self, batch_size: int) -> dict:
        """Calculate when a batch can be sent"""
        status = self.can_send()
        
        if not status['allowed']:
            return {
                'can_start': False,
                'wait_seconds': status.get('wait_seconds', 0),
                'reason': status.get('reason')
            }
        
        # Calculate how many we can send now
        remaining_hourly = self.config.per_hour - self.state.sent_this_hour
        remaining_daily = self.config.effective_daily_limit - self.state.sent_today
        can_send_now = min(batch_size, remaining_hourly, remaining_daily)
        
        # Calculate total time for batch
        total_time_seconds = can_send_now * self.config.min_delay_seconds
        
        # Calculate if we need multiple batches
        remaining = batch_size - can_send_now
        additional_batches = []
        
        if remaining > 0 and remaining_hourly <= can_send_now:
            # Will hit hourly limit, need to continue next hour
            additional_batches.append({
                'emails': min(remaining, self.config.per_hour),
                'start_at': self.state.hour_reset_at
            })
        
        return {
            'can_start': True,
            'immediate_batch': can_send_now,
            'estimated_duration_seconds': total_time_seconds,
            'remaining_for_later': remaining,
            'additional_batches': additional_batches
        }


def main():
    parser = argparse.ArgumentParser(description='Email Campaign Rate Limiter')
    parser.add_argument('command', choices=['status', 'configure', 'schedule', 'check'])
    parser.add_argument('--campaign-id', '-c', required=True, help='Campaign ID')
    parser.add_argument('--hourly', type=int, help='Hourly send limit')
    parser.add_argument('--daily', type=int, help='Daily send limit')
    parser.add_argument('--min-delay', type=int, help='Minimum delay between sends (seconds)')
    parser.add_argument('--warmup', type=str, choices=['on', 'off'], help='Enable/disable warmup')
    parser.add_argument('--batch-size', type=int, default=50, help='Batch size for scheduling')
    parser.add_argument('--output', '-o', choices=['json', 'text'], default='json', help='Output format')
    
    args = parser.parse_args()
    
    limiter = RateLimiter(args.campaign_id)
    
    if args.command == 'status':
        result = limiter.get_status()
    
    elif args.command == 'configure':
        warmup = None
        if args.warmup:
            warmup = args.warmup == 'on'
        
        result = limiter.configure(
            per_hour=args.hourly,
            per_day=args.daily,
            min_delay=args.min_delay,
            warmup_enabled=warmup
        )
    
    elif args.command == 'schedule':
        result = limiter.schedule_batch(args.batch_size)
    
    elif args.command == 'check':
        result = limiter.can_send()
    
    if args.output == 'json':
        print(json.dumps(result, indent=2))
    else:
        if args.command == 'status':
            print(f"\n=== Rate Limiter Status: {args.campaign_id} ===\n")
            print(f"Hourly:  {result['state']['sent_this_hour']}/{result['state']['hourly_limit']} "
                  f"({result['state']['hourly_remaining']} remaining)")
            print(f"Daily:   {result['state']['sent_today']}/{result['state']['daily_limit']} "
                  f"({result['state']['daily_remaining']} remaining)")
            print(f"Queue:   {result['state']['queue_size']} emails")
            print(f"\nWarmup:  {'Enabled' if result['warmup']['enabled'] else 'Disabled'}")
            if result['warmup']['enabled']:
                print(f"  Day {result['warmup']['day']} - Limit: {result['warmup']['current_limit']}/day")
            print(f"\nCan send now: {'Yes' if result['can_send']['allowed'] else 'No'}")
            if not result['can_send']['allowed']:
                print(f"  Reason: {result['can_send']['reason']}")


if __name__ == '__main__':
    main()

