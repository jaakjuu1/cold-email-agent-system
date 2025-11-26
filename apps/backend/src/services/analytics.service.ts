export interface DashboardMetrics {
  totalClients: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalProspects: number;
  totalEmailsSent: number;
  totalResponses: number;
  averageOpenRate: number;
  averageReplyRate: number;
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export interface CampaignAnalytics {
  campaignId: string;
  name: string;
  status: string;
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
  };
  rates: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    bounceRate: number;
  };
  timeline: Array<{
    date: string;
    sent: number;
    opened: number;
    replied: number;
  }>;
}

export interface DailyMetric {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
}

export interface ResponseAnalytics {
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  outOfOffice: number;
  byDay: Array<{
    date: string;
    count: number;
    sentiment: string;
  }>;
}

export interface FunnelData {
  stages: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
}

export class AnalyticsService {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    // Mock data - will be replaced with actual AgentFS queries
    return {
      totalClients: 5,
      totalCampaigns: 12,
      activeCampaigns: 3,
      totalProspects: 1250,
      totalEmailsSent: 3420,
      totalResponses: 156,
      averageOpenRate: 0.42,
      averageReplyRate: 0.045,
      recentActivity: [
        {
          type: 'response',
          message: 'New positive response from John at TechCo',
          timestamp: new Date().toISOString(),
        },
        {
          type: 'campaign',
          message: 'Q4 Outreach campaign completed',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
    };
  }

  async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
    // Mock data
    return {
      campaignId,
      name: 'Q4 SaaS Outreach',
      status: 'active',
      metrics: {
        sent: 500,
        delivered: 485,
        opened: 210,
        clicked: 45,
        replied: 23,
        bounced: 15,
      },
      rates: {
        deliveryRate: 0.97,
        openRate: 0.433,
        clickRate: 0.093,
        replyRate: 0.047,
        bounceRate: 0.03,
      },
      timeline: [
        { date: '2024-01-15', sent: 50, opened: 22, replied: 2 },
        { date: '2024-01-16', sent: 50, opened: 25, replied: 3 },
        { date: '2024-01-17', sent: 50, opened: 21, replied: 2 },
      ],
    };
  }

  async getDailyMetrics(
    campaignId: string,
    _startDate?: string,
    _endDate?: string
  ): Promise<DailyMetric[]> {
    // Mock data
    const days = 7;
    const metrics: DailyMetric[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      metrics.push({
        date: date.toISOString().split('T')[0]!,
        sent: Math.floor(Math.random() * 50) + 30,
        delivered: Math.floor(Math.random() * 48) + 28,
        opened: Math.floor(Math.random() * 25) + 10,
        clicked: Math.floor(Math.random() * 10) + 2,
        replied: Math.floor(Math.random() * 5) + 1,
        bounced: Math.floor(Math.random() * 3),
      });
    }
    
    return metrics;
  }

  async getResponseAnalytics(_campaignId?: string): Promise<ResponseAnalytics> {
    return {
      total: 156,
      positive: 89,
      neutral: 42,
      negative: 15,
      outOfOffice: 10,
      byDay: [
        { date: '2024-01-15', count: 5, sentiment: 'positive' },
        { date: '2024-01-16', count: 3, sentiment: 'neutral' },
        { date: '2024-01-17', count: 7, sentiment: 'positive' },
      ],
    };
  }

  async getFunnelData(_campaignId?: string): Promise<FunnelData> {
    return {
      stages: [
        { name: 'Prospects', count: 1000, percentage: 100 },
        { name: 'Contacted', count: 850, percentage: 85 },
        { name: 'Opened', count: 400, percentage: 47 },
        { name: 'Replied', count: 45, percentage: 11.25 },
        { name: 'Interested', count: 28, percentage: 62.2 },
        { name: 'Meeting Booked', count: 12, percentage: 42.8 },
      ],
    };
  }
}

