# 🎯 **Complete Implementation Plan: AI-Powered Cold Outreach System**

## **Executive Summary**

This is a comprehensive, production-ready B2B cold outreach automation system that:
1. Discovers and analyzes your client's business
2. Generates ideal customer profiles with targeting recommendations
3. Finds high-quality leads via Google Maps + multi-source research
4. Creates personalized email campaigns using AI
5. Tracks responses in real-time and manages follow-ups intelligently

**Estimated Timeline**: 8-10 weeks for MVP, 12-14 weeks for production-ready
**Team Size**: 1-2 developers
**Skill Requirements**: TypeScript, Python, React, SQL basics

---

## **📋 Table of Contents**

1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Prerequisites & Setup](#prerequisites-setup)
4. [Project Structure](#project-structure)
5. [Implementation Phases](#implementation-phases)
6. [Data Models & Schemas](#data-models-schemas)
7. [API Design](#api-design)
8. [Testing Strategy](#testing-strategy)
9. [Deployment](#deployment)
10. [Monitoring & Maintenance](#monitoring-maintenance)

---

## **1. System Architecture**

### **High-Level Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                    (React + Tailwind CSS)                       │
│  ┌──────────────┬──────────────┬──────────────┬─────────────┐ │
│  │  Onboarding  │  Campaign    │  Lead List   │  Analytics  │ │
│  │  Dashboard   │  Management  │  Viewer      │  Dashboard  │ │
│  └──────────────┴──────────────┴──────────────┴─────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API / WebSocket
┌─────────────────────────▼───────────────────────────────────────┐
│                    BACKEND API SERVER                            │
│                    (Express + TypeScript)                        │
│  ┌──────────────┬──────────────┬──────────────┬─────────────┐ │
│  │  Client      │  Campaign    │  Email       │  Webhook    │ │
│  │  Routes      │  Routes      │  Routes      │  Handler    │ │
│  └──────────────┴──────────────┴──────────────┴─────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│              CLAUDE AGENT ORCHESTRATOR                           │
│           (Claude Agent SDK + Skills System)                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   AGENT SKILLS                          │   │
│  │  ┌────────────┬────────────┬────────────┬────────────┐ │   │
│  │  │  Client    │    Lead    │   Email    │  Campaign  │ │   │
│  │  │ Discovery  │ Discovery  │ Tracking   │  Mgmt      │ │   │
│  │  └────────────┴────────────┴────────────┴────────────┘ │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐  │   │
│  │  │          EVENT LISTENERS                        │  │   │
│  │  │  • Response Detector                            │  │   │
│  │  │  • Bounce Detector                              │  │   │
│  │  │  • Engagement Scorer                            │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                   AGENTFS STORAGE LAYER                          │
│                (Turso + SQLite per client)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  /clients/          - Client profiles & ICP               │  │
│  │  /prospects/        - Lead data by location/industry      │  │
│  │  /campaigns/        - Campaign configurations & tracking  │  │
│  │  /emails/           - Email sequences & templates         │  │
│  │  /tracking/         - Email status & responses            │  │
│  │  Tool Call History  - Complete audit trail                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                   EXTERNAL SERVICES                              │
│  ┌────────────┬────────────┬────────────┬──────────────────┐   │
│  │  Google    │ Firecrawl  │ Perplexity │  Email Service   │   │
│  │  Maps API  │    API     │    API     │ (Resend/SMTP)    │   │
│  └────────────┴────────────┴────────────┴──────────────────┘   │
│  ┌────────────┬────────────┬────────────┐                      │
│  │  Contact   │   IMAP     │  WebSocket │                      │
│  │ Enrichment │  Monitor   │   Server   │                      │
│  └────────────┴────────────┴────────────┘                      │
└──────────────────────────────────────────────────────────────────┘
```

### **Core Components Explained**

#### **1. User Interface (Frontend)**
- **Technology**: React 18 + TypeScript + Tailwind CSS
- **Purpose**: User interaction, visualization, campaign management
- **Key Features**:
  - Client onboarding wizard
  - Campaign creation and monitoring
  - Lead list management
  - Real-time notifications via WebSocket
  - Analytics dashboards

#### **2. Backend API Server**
- **Technology**: Express.js + TypeScript
- **Purpose**: Handle HTTP requests, authentication, business logic
- **Key Features**:
  - RESTful API endpoints
  - WebSocket server for real-time updates
  - Authentication & session management
  - Rate limiting and security

#### **3. Claude Agent Orchestrator**
- **Technology**: Claude Agent SDK + Skills System
- **Purpose**: Intelligent automation using Claude
- **Key Features**:
  - Multi-agent coordination
  - Skill-based task delegation
  - Event-driven listeners
  - Context management

#### **4. AgentFS Storage Layer**
- **Technology**: Turso AgentFS (SQLite-based)
- **Purpose**: Persistent storage with audit trails
- **Key Features**:
  - One database per client (isolation)
  - Filesystem for documents
  - KV store for metadata
  - Tool call history (complete auditability)

#### **5. External Services**
- **Google Maps API**: Business discovery by location
- **Firecrawl API**: Website scraping and research
- **Perplexity API**: Company intelligence gathering
- **Email Service**: Sending emails (Resend/SendGrid)
- **IMAP Monitor**: Real-time email response detection
- **Contact Enrichment**: Email finding (Hunter.io, Apollo.io)

---

## **2. Technology Stack**

### **Frontend Stack**

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | React | 18.x | UI framework |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| State Management | Zustand | 4.x | Simple state management |
| Data Fetching | TanStack Query | 5.x | Server state management |
| Routing | React Router | 6.x | Client-side routing |
| Forms | React Hook Form | 7.x | Form handling |
| Charts | Recharts | 2.x | Data visualization |
| WebSocket | Socket.io Client | 4.x | Real-time updates |
| Build Tool | Vite | 5.x | Fast builds |

### **Backend Stack**

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Runtime | Node.js | 20.x LTS | JavaScript runtime |
| Framework | Express | 4.x | Web framework |
| Language | TypeScript | 5.x | Type safety |
| Agent SDK | Claude Agent SDK | Latest | AI orchestration |
| Storage | AgentFS SDK | Latest | Persistent storage |
| WebSocket | Socket.io | 4.x | Real-time communication |
| Task Queue | BullMQ | 5.x | Background jobs |
| Validation | Zod | 3.x | Schema validation |
| Email | Nodemailer | 6.x | SMTP client |
| HTTP Client | Axios | 1.x | API requests |

### **Python Scripts**

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Runtime | Python | 3.11+ | Script execution |
| Google Maps | googlemaps | Latest | Places API |
| Web Scraping | Requests | 2.x | HTTP requests |
| Email Monitor | imaplib | Built-in | IMAP IDLE |
| Data Processing | Pandas | 2.x | Data manipulation |
| Async | asyncio/aiohttp | Built-in | Async operations |

### **Infrastructure & DevOps**

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Database | Turso | AgentFS storage |
| Hosting | Docker + Railway/Fly.io | Containerized deployment |
| Redis | Upstash Redis | Task queue & caching |
| Monitoring | Sentry | Error tracking |
| Analytics | PostHog | Product analytics |
| CDN | Cloudflare | Static asset delivery |

---

## **3. Prerequisites & Setup**

### **Development Environment**

#### **Required Software**
```bash
# Install Node.js 20 LTS
nvm install 20
nvm use 20

# Install Python 3.11+
brew install python@3.11  # macOS
# or use pyenv

# Install pnpm (preferred over npm)
npm install -g pnpm

# Install Docker Desktop
# Download from https://www.docker.com/products/docker-desktop
```

#### **Required API Keys**

Create accounts and obtain API keys for:

1. **Anthropic API** (Required)
   - Go to: https://console.anthropic.com
   - Get API key from Settings
   - Set tier to at least Tier 2 for production

2. **Google Maps API** (Required)
   - Go to: https://console.cloud.google.com
   - Enable Places API
   - Enable Maps JavaScript API
   - Create API key with restrictions

3. **Firecrawl API** (Required)
   - Go to: https://firecrawl.dev
   - Sign up and get API key
   - Start with free tier (500 requests/month)

4. **Perplexity API** (Required)
   - Go to: https://www.perplexity.ai/api
   - Get API key
   - Use Sonar model for searches

5. **Email Service** (Required - Choose one)
   - **Resend** (Recommended): https://resend.com
   - **SendGrid**: https://sendgrid.com
   - **Or use SMTP** with your email provider

6. **Contact Enrichment** (Optional but recommended)
   - **Hunter.io**: https://hunter.io (email finding)
   - **Apollo.io**: https://www.apollo.io (contact data)

7. **Turso** (Required for production)
   - Go to: https://turso.tech
   - Create account
   - Get database URL and token

### **Environment Configuration**

Create `.env` file in project root:

```bash
# Anthropic API
ANTHROPIC_API_KEY=sk-ant-api03-...

# Google Maps
GOOGLE_MAPS_API_KEY=AIza...

# Firecrawl
FIRECRAWL_API_KEY=fc-...

# Perplexity
PERPLEXITY_API_KEY=pplx-...

# Email Service (Resend)
EMAIL_SERVICE=resend
RESEND_API_KEY=re_...

# OR Email Service (SMTP)
# EMAIL_SERVICE=smtp
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password

# IMAP (for monitoring responses)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password

# Contact Enrichment (optional)
HUNTER_API_KEY=...
APOLLO_API_KEY=...

# Turso (production)
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...

# Redis (task queue)
REDIS_URL=redis://localhost:6379

# Application
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
```

---

## **4. Project Structure**

```
cold-outreach-system/
├── README.md
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── .env.example
├── .gitignore
│
├── apps/
│   ├── backend/                      # Express API server
│   │   ├── src/
│   │   │   ├── index.ts             # Entry point
│   │   │   ├── server.ts            # Express app setup
│   │   │   ├── routes/
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── clients.routes.ts
│   │   │   │   ├── campaigns.routes.ts
│   │   │   │   ├── prospects.routes.ts
│   │   │   │   └── webhooks.routes.ts
│   │   │   ├── controllers/
│   │   │   │   ├── client.controller.ts
│   │   │   │   ├── campaign.controller.ts
│   │   │   │   └── prospect.controller.ts
│   │   │   ├── services/
│   │   │   │   ├── orchestrator.service.ts
│   │   │   │   ├── email.service.ts
│   │   │   │   └── analytics.service.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── validation.middleware.ts
│   │   │   │   └── error.middleware.ts
│   │   │   ├── websocket/
│   │   │   │   └── server.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── frontend/                     # React UI
│       ├── src/
│       │   ├── main.tsx             # Entry point
│       │   ├── App.tsx
│       │   ├── pages/
│       │   │   ├── Dashboard.tsx
│       │   │   ├── Onboarding.tsx
│       │   │   ├── Campaigns.tsx
│       │   │   ├── Prospects.tsx
│       │   │   └── Analytics.tsx
│       │   ├── components/
│       │   │   ├── ClientDiscovery/
│       │   │   ├── CampaignBuilder/
│       │   │   ├── ProspectList/
│       │   │   └── shared/
│       │   ├── hooks/
│       │   │   ├── useWebSocket.ts
│       │   │   └── useAgentFS.ts
│       │   ├── lib/
│       │   │   ├── api.ts
│       │   │   └── websocket.ts
│       │   └── types/
│       │       └── index.ts
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── tailwind.config.js
│
├── packages/
│   ├── agent/                        # Claude Agent Orchestrator
│   │   ├── src/
│   │   │   ├── orchestrator.ts       # Main agent coordinator
│   │   │   ├── agents/
│   │   │   │   ├── client-discovery.agent.ts
│   │   │   │   ├── lead-discovery.agent.ts
│   │   │   │   ├── outreach.agent.ts
│   │   │   │   └── tracking.agent.ts
│   │   │   ├── storage/
│   │   │   │   └── agentfs-manager.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                       # Shared types & utilities
│       ├── src/
│       │   ├── types/
│       │   └── utils/
│       ├── package.json
│       └── tsconfig.json
│
├── .claude/                          # Claude Agent Skills
│   ├── skills/
│   │   ├── client-discovery/
│   │   │   ├── SKILL.md
│   │   │   └── analysis/
│   │   │       ├── website_analyzer.py
│   │   │       ├── market_researcher.py
│   │   │       ├── icp_generator.py
│   │   │       └── icp_validator.py
│   │   │
│   │   ├── lead-discovery/
│   │   │   ├── SKILL.md
│   │   │   ├── google-maps/
│   │   │   │   ├── scraper.py
│   │   │   │   └── parser.py
│   │   │   ├── research-pipeline/
│   │   │   │   ├── company_enricher.py
│   │   │   │   ├── contact_finder.py
│   │   │   │   └── data_validator.py
│   │   │   └── reference/
│   │   │       ├── icp-templates.md
│   │   │       └── search-strategies.md
│   │   │
│   │   ├── email-personalization/
│   │   │   ├── SKILL.md
│   │   │   ├── templates/
│   │   │   ├── personalization_engine.py
│   │   │   └── quality_checker.py
│   │   │
│   │   ├── email-tracking/
│   │   │   ├── SKILL.md
│   │   │   ├── listeners/
│   │   │   │   ├── response-detector.ts
│   │   │   │   ├── bounce-detector.ts
│   │   │   │   └── engagement-scorer.ts
│   │   │   └── monitoring/
│   │   │       ├── imap_monitor.py
│   │   │       └── check_responses.py
│   │   │
│   │   └── campaign-management/
│   │       ├── SKILL.md
│   │       ├── rate_limiter.py
│   │       ├── response_tracker.py
│   │       └── analytics.py
│   │
│   ├── settings.json
│   └── types.ts
│
├── scripts/                          # Utility scripts
│   ├── setup.sh                      # Initial setup
│   ├── seed-data.ts                  # Seed test data
│   └── migrate.ts                    # Database migrations
│
└── docs/                             # Documentation
    ├── API.md
    ├── DEPLOYMENT.md
    └── ARCHITECTURE.md
```

---

## **5. Implementation Phases**

### **Phase 1: Foundation & Setup (Week 1-2)**

#### **Week 1: Project Initialization**

**Day 1-2: Project Setup**
```bash
# Initialize monorepo
mkdir cold-outreach-system
cd cold-outreach-system

# Initialize package.json with workspaces
pnpm init

# Add workspace configuration to package.json
{
  "name": "cold-outreach-system",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}

# Create directory structure
mkdir -p apps/backend/src apps/frontend/src
mkdir -p packages/agent/src packages/shared/src
mkdir -p .claude/skills scripts docs

# Initialize TypeScript
pnpm add -D typescript @types/node
npx tsc --init
```

**Day 3-4: Backend Foundation**
```bash
cd apps/backend

# Install dependencies
pnpm add express cors helmet morgan
pnpm add @anthropic-ai/claude-agent-sdk agentfs-sdk
pnpm add dotenv zod
pnpm add -D @types/express @types/cors @types/node tsx nodemon

# Create basic Express server
# apps/backend/src/index.ts
```

```typescript
// apps/backend/src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from 'dotenv';

config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

**Day 5-7: Frontend Foundation**
```bash
cd apps/frontend

# Create Vite React app
pnpm create vite . --template react-ts

# Install dependencies
pnpm add react-router-dom zustand @tanstack/react-query
pnpm add axios socket.io-client
pnpm add -D tailwindcss postcss autoprefixer
pnpm add lucide-react # Icon library

# Initialize Tailwind
npx tailwindcss init -p
```

```typescript
// apps/frontend/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

#### **Week 2: AgentFS & Core Infrastructure**

**Day 8-10: AgentFS Integration**
```typescript
// packages/agent/src/storage/agentfs-manager.ts
import { AgentFS } from 'agentfs-sdk';

export class AgentFSManager {
  private agent: AgentFS;
  
  async initialize(clientId: string) {
    this.agent = await AgentFS.open({
      id: `outreach-${clientId}`
    });
    
    await this.setupDirectories();
  }
  
  private async setupDirectories() {
    const dirs = [
      '/clients',
      '/prospects',
      '/campaigns',
      '/emails',
      '/tracking',
      '/research'
    ];
    
    for (const dir of dirs) {
      await this.agent.fs.mkdir(dir).catch(() => {});
    }
  }
  
  // KV Store operations
  async setClientProfile(clientId: string, profile: any) {
    await this.agent.kv.set(`client:${clientId}`, profile);
  }
  
  async getClientProfile(clientId: string) {
    return await this.agent.kv.get(`client:${clientId}`);
  }
  
  // Filesystem operations
  async saveProspects(location: string, industry: string, prospects: any[]) {
    const path = `/prospects/${location}/${industry}/prospects.json`;
    await this.agent.fs.writeFile(path, JSON.stringify(prospects, null, 2));
  }
  
  async loadProspects(path: string) {
    const content = await this.agent.fs.readFile(path);
    return JSON.parse(content.toString());
  }
  
  // Campaign tracking
  async trackEmailSent(campaignId: string, prospectId: string, emailData: any) {
    await this.agent.tools.record(
      'email_send',
      Date.now() / 1000,
      Date.now() / 1000 + 0.5,
      { campaignId, prospectId },
      emailData
    );
  }
}
```

**Day 11-14: Basic API Routes**
```typescript
// apps/backend/src/routes/clients.routes.ts
import { Router } from 'express';
import { ClientController } from '../controllers/client.controller';

const router = Router();
const controller = new ClientController();

router.post('/clients', controller.create);
router.get('/clients/:id', controller.getById);
router.put('/clients/:id', controller.update);
router.delete('/clients/:id', controller.delete);
router.post('/clients/:id/discover', controller.discoverBusiness);

export default router;
```

```typescript
// apps/backend/src/controllers/client.controller.ts
import { Request, Response } from 'express';
import { OrchestratorService } from '../services/orchestrator.service';

export class ClientController {
  private orchestrator = new OrchestratorService();
  
  async create(req: Request, res: Response) {
    try {
      const client = await this.orchestrator.createClient(req.body);
      res.status(201).json(client);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  async discoverBusiness(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { websiteUrl } = req.body;
      
      const icp = await this.orchestrator.discoverClient(id, websiteUrl);
      res.json(icp);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}
```

---

### **Phase 2: Client Discovery System (Week 3-4)**

#### **Week 3: Website Analysis & ICP Generation**

**Day 15-17: Implement Client Discovery Skill**

1. Create SKILL.md file (already designed above)
2. Implement Python scripts:

```bash
cd .claude/skills/client-discovery/analysis

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install aiohttp firecrawl-py anthropic
```

```python
# .claude/skills/client-discovery/analysis/website_analyzer.py
# (Use the complete implementation from earlier)
```

**Day 18-21: Claude Agent Integration**

```typescript
// packages/agent/src/agents/client-discovery.agent.ts
import { ClaudeAgent } from '@anthropic-ai/claude-agent-sdk';
import { AgentFSManager } from '../storage/agentfs-manager';

export class ClientDiscoveryAgent {
  private agent: ClaudeAgent;
  private storage: AgentFSManager;
  
  constructor(clientId: string) {
    this.storage = new AgentFSManager();
    
    this.agent = new ClaudeAgent({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-sonnet-4-20250514',
      settingSources: ['project'],
      systemPrompt: `You are an expert business analyst specializing in B2B market research and ICP generation.`
    });
  }
  
  async discoverClient(websiteUrl: string): Promise<ICPProposal> {
    const prompt = `Use the client-discovery skill to analyze this client's business:
    
    Website URL: ${websiteUrl}
    
    Follow the complete workflow:
    1. Run website_analyzer.py with --deep-crawl
    2. Run market_researcher.py with --perplexity-deep-search
    3. Run icp_generator.py to create detailed ICP proposal
    4. Run icp_validator.py to validate
    
    Save outputs to /clients/[company_name]/
    
    Present the ICP proposal in structured format.`;
    
    const result = await this.agent.run({
      messages: [{ role: 'user', content: prompt }]
    });
    
    // Parse and return ICP
    return this.parseICPFromResult(result);
  }
}
```

#### **Week 4: ICP Refinement & UI**

**Day 22-24: Frontend - Onboarding Flow**

```typescript
// apps/frontend/src/pages/Onboarding.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

export function Onboarding() {
  const [step, setStep] = useState(1);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [icpProposal, setIcpProposal] = useState(null);
  const navigate = useNavigate();
  
  const discoverMutation = useMutation({
    mutationFn: (url: string) => api.post('/clients/discover', { websiteUrl: url }),
    onSuccess: (data) => {
      setIcpProposal(data.icp);
      setStep(2);
    }
  });
  
  const handleDiscover = () => {
    if (!websiteUrl) return;
    discoverMutation.mutate(websiteUrl);
  };
  
  return (
    <div className="max-w-4xl mx-auto p-8">
      {step === 1 && (
        <div>
          <h1 className="text-3xl font-bold mb-6">Welcome! Let's discover your business</h1>
          <input
            type="url"
            placeholder="https://yourcompany.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="w-full p-4 border rounded-lg"
          />
          <button
            onClick={handleDiscover}
            disabled={discoverMutation.isPending}
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg"
          >
            {discoverMutation.isPending ? 'Analyzing...' : 'Analyze My Business'}
          </button>
        </div>
      )}
      
      {step === 2 && icpProposal && (
        <ICPProposalReview 
          proposal={icpProposal}
          onAccept={() => navigate('/dashboard')}
          onRefine={(refinements) => {
            // Handle refinements
          }}
        />
      )}
    </div>
  );
}
```

**Day 25-28: Testing & Refinement**

- Test website analysis with various company types
- Test ICP generation quality
- Implement refinement workflow
- Add error handling and loading states

---

### **Phase 3: Lead Discovery System (Week 5-6)**

#### **Week 5: Google Maps Integration & Company Enrichment**

**Day 29-31: Google Maps Scraper**

```python
# .claude/skills/lead-discovery/google-maps/scraper.py
# (Use complete implementation from earlier)
```

Test the scraper:
```bash
python scraper.py \
  --location "San Francisco, CA" \
  --industry "Software Company" \
  --radius 25 \
  --limit 50 \
  --output test_results.json
```

**Day 32-35: Company Enrichment Pipeline**

```python
# .claude/skills/lead-discovery/research-pipeline/company_enricher.py
# (Use complete implementation from earlier)
```

Implement Firecrawl and Perplexity integrations:

```python
# Test enrichment
python company_enricher.py \
  test_results.json \
  --output enriched_prospects.json \
  --concurrent 5
```

#### **Week 6: Contact Finding & Data Validation**

**Day 36-38: Contact Finder**

```python
# .claude/skills/lead-discovery/research-pipeline/contact_finder.py
# (Use complete implementation from earlier)
```

**Day 39-42: Lead Discovery Agent**

```typescript
// packages/agent/src/agents/lead-discovery.agent.ts
export class LeadDiscoveryAgent {
  async discoverLeads(icpProposal: ICPProposal, phase: string) {
    const prompt = `Use the lead-discovery skill to find prospects:
    
    ICP Context: ${JSON.stringify(icpProposal)}
    Phase: ${phase}
    
    Execute complete pipeline:
    1. Google Maps scraping for each city + industry combination
    2. Enrich companies (Firecrawl + Perplexity)
    3. Find decision makers
    4. Validate data quality
    5. Score against ICP
    
    Save to /prospects/${phase}/`;
    
    return await this.agent.run({
      messages: [{ role: 'user', content: prompt }]
    });
  }
}
```

---

### **Phase 4: Email Campaign System (Week 7-8)**

#### **Week 7: Email Generation & Personalization**

**Day 43-45: Email Templates & Personalization Engine**

```python
# .claude/skills/email-personalization/personalization_engine.py
import anthropic
import json

class EmailPersonalizer:
    def __init__(self):
        self.client = anthropic.Anthropic()
    
    def generate_sequence(self, prospect: dict, client_context: dict, messaging: dict):
        """Generate 3-email sequence"""
        
        prompt = f"""Create a personalized 3-email cold outreach sequence:
        
        Prospect Info:
        - Company: {prospect['company_name']}
        - Industry: {prospect['industry']}
        - Pain Points: {prospect.get('pain_points', [])}
        - Recent News: {prospect.get('recent_news', '')}
        - Decision Maker: {prospect['contact']['name']} ({prospect['contact']['title']})
        
        Client Context:
        - Company: {client_context['company']}
        - Solution: {client_context['solution']}
        - Value Prop: {client_context['value_proposition']}
        
        Messaging Framework:
        - Pain Points to Address: {messaging['primary_pain_points_to_address']}
        - Value Props: {messaging['value_propositions']}
        - Proof Points: {messaging['proof_points']}
        
        Generate 3 emails:
        1. Initial outreach (max 150 words)
        2. Follow-up 1 - 3 days later (max 100 words)
        3. Follow-up 2 - 7 days later (max 100 words)
        
        Requirements:
        - Reference specific company details in email 1
        - Use conversational, professional tone
        - Strong, clear CTA in each email
        - No buzzwords or generic language
        """
        
        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        )
        
        # Parse response and return email sequence
        return self.parse_emails(response.content[0].text)
```

**Day 46-49: Outreach Agent**

```typescript
// packages/agent/src/agents/outreach.agent.ts
export class OutreachAgent {
  async createCampaign(campaignConfig: CampaignConfig, icpProposal: ICPProposal) {
    // Load prospects
    const prospects = await this.storage.loadProspects(campaignConfig.prospectSource);
    
    // Generate emails for each prospect
    for (const prospect of prospects) {
      const prompt = `Use email-personalization skill:
      
      Generate 3-email sequence for:
      ${JSON.stringify(prospect)}
      
      Using client context and ICP messaging framework.
      
      Save to /campaigns/${campaignConfig.id}/emails/${prospect.id}/`;
      
      await this.agent.run({
        messages: [{ role: 'user', content: prompt }]
      });
    }
    
    // Track in AgentFS
    await this.storage.agent.kv.set(`campaign:${campaignConfig.id}`, {
      ...campaignConfig,
      status: 'draft',
      createdAt: Date.now(),
      prospectCount: prospects.length
    });
  }
}
```

#### **Week 8: Email Sending & Basic Tracking**

**Day 50-52: Email Service Implementation**

```typescript
// apps/backend/src/services/email.service.ts
import { Resend } from 'resend';

export class EmailService {
  private resend: Resend;
  
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }
  
  async sendEmail(to: string, subject: string, html: string, metadata: any) {
    const result = await this.resend.emails.send({
      from: 'outreach@yourdomain.com',
      to,
      subject,
      html,
      headers: {
        'X-Campaign-ID': metadata.campaignId,
        'X-Prospect-ID': metadata.prospectId,
        'X-Sequence-Number': metadata.sequenceNumber.toString()
      }
    });
    
    return {
      messageId: result.id,
      success: true
    };
  }
  
  async sendCampaignBatch(campaignId: string, batchSize: number = 10) {
    // Load unsent emails
    const emails = await this.loadUnsentEmails(campaignId, batchSize);
    
    // Send with rate limiting
    for (const email of emails) {
      await this.sendEmail(
        email.to,
        email.subject,
        email.html,
        email.metadata
      );
      
      // Track sent
      await this.trackEmailSent(email);
      
      // Rate limit (e.g., 1 per 5 seconds)
      await this.delay(5000);
    }
  }
  
  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**Day 53-56: Campaign Management UI**

```typescript
// apps/frontend/src/pages/Campaigns.tsx
export function Campaigns() {
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns')
  });
  
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Campaigns</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns?.map(campaign => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </div>
      
      <button className="fixed bottom-8 right-8 ...">
        Create Campaign
      </button>
    </div>
  );
}
```

---

### **Phase 5: Email Tracking & Response Management (Week 9-10)**

#### **Week 9: IMAP Monitor & Listeners**

**Day 57-59: IMAP IDLE Monitor**

```python
# .claude/skills/email-tracking/monitoring/imap_monitor.py
# (Use complete implementation from earlier)

# Test it
python imap_monitor.py \
  --email your-email@gmail.com \
  --password your-app-password
```

**Day 60-63: Response Detection Listeners**

```typescript
// .claude/skills/email-tracking/listeners/response-detector.ts
// (Use complete implementation from earlier)
```

Set up listeners manager:

```typescript
// apps/backend/src/services/listeners.service.ts
import { ListenersManager } from '../../../.claude/listeners-manager';

export class ListenersService {
  private manager: ListenersManager;
  
  async initialize() {
    this.manager = new ListenersManager(
      emailApi,
      (notification) => this.handleNotification(notification)
    );
    
    await this.manager.loadAllListeners();
  }
  
  async startMonitoring(campaignId: string) {
    // Start IMAP monitor
    // Connect listeners
  }
  
  private handleNotification(notification: any) {
    // Broadcast via WebSocket
    this.wsServer.broadcast('listener_notification', notification);
  }
}
```

#### **Week 10: Real-time Updates & Analytics**

**Day 64-66: WebSocket Server**

```typescript
// apps/backend/src/websocket/server.ts
import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

export class WebSocketServer {
  private io: Server;
  
  initialize(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: { origin: process.env.FRONTEND_URL }
    });
    
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      socket.on('subscribe_campaign', (campaignId) => {
        socket.join(`campaign:${campaignId}`);
      });
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }
  
  broadcast(event: string, data: any) {
    this.io.emit(event, data);
  }
  
  broadcastToCampaign(campaignId: string, event: string, data: any) {
    this.io.to(`campaign:${campaignId}`).emit(event, data);
  }
}
```

**Day 67-70: Analytics Dashboard**

```typescript
// apps/frontend/src/pages/Analytics.tsx
export function Analytics({ campaignId }: { campaignId: string }) {
  const [metrics, setMetrics] = useState<CampaignMetrics>();
  const ws = useWebSocket();
  
  useEffect(() => {
    if (!ws) return;
    
    ws.emit('subscribe_campaign', campaignId);
    
    ws.on('metrics_update', (data) => {
      if (data.campaignId === campaignId) {
        setMetrics(data.metrics);
      }
    });
    
    ws.on('new_response', (data) => {
      // Update UI with new response
    });
  }, [ws, campaignId]);
  
  return (
    <div className="p-8">
      <MetricsGrid metrics={metrics} />
      <ResponseTimeline campaignId={campaignId} />
      <EngagementChart data={metrics?.engagement} />
    </div>
  );
}
```

---

### **Phase 6: Testing, Optimization & Deployment (Week 11-12)**

#### **Week 11: Testing**

**Day 71-73: Unit & Integration Tests**

```typescript
// apps/backend/__tests__/services/orchestrator.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { OrchestratorService } from '../../src/services/orchestrator.service';

describe('OrchestratorService', () => {
  let service: OrchestratorService;
  
  beforeEach(() => {
    service = new OrchestratorService();
  });
  
  it('should create client', async () => {
    const client = await service.createClient({
      name: 'Test Client',
      website: 'https://example.com'
    });
    
    expect(client.id).toBeDefined();
  });
  
  it('should discover client business', async () => {
    const icp = await service.discoverClient(
      'client-123',
      'https://example.com'
    );
    
    expect(icp.icp_summary).toBeDefined();
    expect(icp.geographic_targeting).toBeDefined();
  });
});
```

**Day 74-77: End-to-End Testing**

```typescript
// e2e/onboarding.spec.ts
import { test, expect } from '@playwright/test';

test('complete onboarding flow', async ({ page }) => {
  await page.goto('http://localhost:5173/onboarding');
  
  // Step 1: Enter website
  await page.fill('input[type="url"]', 'https://example.com');
  await page.click('button:has-text("Analyze My Business")');
  
  // Wait for analysis
  await page.waitForSelector('text=ICP Proposal', { timeout: 60000 });
  
  // Step 2: Review ICP
  await expect(page.locator('text=Geographic Focus')).toBeVisible();
  await expect(page.locator('text=Industry Targeting')).toBeVisible();
  
  // Accept ICP
  await page.click('button:has-text("Accept & Continue")');
  
  // Should navigate to dashboard
  await expect(page).toHaveURL(/.*dashboard/);
});
```

#### **Week 12: Deployment & Documentation**

**Day 78-80: Docker & Deployment**

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Backend
FROM base AS backend
WORKDIR /app
COPY apps/backend/package.json .
RUN pnpm install
COPY apps/backend .
RUN pnpm build
CMD ["pnpm", "start"]

# Frontend
FROM base AS frontend
WORKDIR /app
COPY apps/frontend/package.json .
RUN pnpm install
COPY apps/frontend .
RUN pnpm build

FROM nginx:alpine
COPY --from=frontend /app/dist /usr/share/nginx/html
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: .
      target: backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - redis
  
  frontend:
    build:
      context: .
      target: frontend
    ports:
      - "80:80"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  imap-monitor:
    build:
      context: .
      dockerfile: Dockerfile.python
    command: python monitoring/imap_monitor.py
    env_file:
      - .env
```

Deploy to Railway/Fly.io:
```bash
# Railway
railway login
railway init
railway up

# Or Fly.io
fly auth login
fly launch
fly deploy
```

**Day 81-84: Documentation & Handoff**

Create comprehensive documentation:

1. **API.md**: Complete API documentation
2. **DEPLOYMENT.md**: Deployment instructions
3. **ARCHITECTURE.md**: System architecture details
4. **USER_GUIDE.md**: End-user documentation

---

## **6. Data Models & Schemas**

### **AgentFS Structure**

```
/agent (AgentFS root for each client)
├── /clients
│   └── {clientId}.json
│       {
│         "id": "client-123",
│         "name": "Acme Corp",
│         "website": "https://acme.com",
│         "industry": "SaaS",
│         "solution": "Marketing automation",
│         "created_at": "2025-11-25T10:00:00Z"
│       }
│
├── /icp
│   └── {clientId}_icp.json
│       {
│         "icp_summary": {...},
│         "firmographic_criteria": {...},
│         "geographic_targeting": {...},
│         "industry_targeting": {...},
│         "decision_maker_targeting": {...},
│         "messaging_framework": {...}
│       }
│
├── /prospects
│   └── {location}
│       └── {industry}
│           └── prospects.json
│               [
│                 {
│                   "id": "prospect-456",
│                   "company_name": "TechCo",
│                   "website": "https://techco.com",
│                   "industry": "SaaS",
│                   "employee_count": "50-100",
│                   "icp_match_score": 0.87,
│                   "contacts": [...]
│                 }
│               ]
│
├── /campaigns
│   └── {campaignId}
│       ├── config.json
│       │   {
│       │     "id": "campaign-789",
│       │     "client_id": "client-123",
│       │     "name": "Q1 2025 Outreach",
│       │     "status": "active",
│       │     "created_at": "2025-11-25T10:00:00Z",
│       │     "prospect_ids": [...]
│       │   }
│       │
│       └── emails
│           └── {prospectId}
│               ├── email_1.json
│               ├── email_2.json
│               └── email_3.json
│
└── /tracking
    └── {campaignId}
        └── {prospectId}.json
            {
              "prospect_id": "prospect-456",
              "campaign_id": "campaign-789",
              "emails_sent": [
                {
                  "sequence": 1,
                  "message_id": "<abc@example.com>",
                  "sent_at": "2025-11-25T10:00:00Z",
                  "status": "SENT",
                  "delivered": true
                }
              ],
              "status": "NO_RESPONSE",
              "last_updated": "2025-11-25T10:00:00Z"
            }
```

### **KV Store Schema**

```typescript
interface KVSchema {
  // Client profiles
  [`client:${clientId}`]: ClientProfile;
  
  // Campaign metadata
  [`campaign:${campaignId}`]: Campaign;
  [`campaign:${campaignId}:stats`]: CampaignStats;
  
  // Email tracking
  [`email:${messageId}`]: SentEmail;
  [`prospect:${prospectId}:status`]: ProspectStatus;
  
  // Analytics
  [`analytics:${campaignId}:daily:${date}`]: DailyMetrics;
}
```

---

## **7. API Design**

### **REST API Endpoints**

```
# Authentication (if needed)
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

# Clients
POST   /api/clients
GET    /api/clients/:id
PUT    /api/clients/:id
DELETE /api/clients/:id
POST   /api/clients/:id/discover        # Start client discovery

# ICP
GET    /api/clients/:id/icp
PUT    /api/clients/:id/icp              # Refine ICP
POST   /api/clients/:id/icp/approve

# Prospects
GET    /api/prospects                    # List all
POST   /api/prospects/discover           # Start lead discovery
GET    /api/prospects/:id
PUT    /api/prospects/:id
DELETE /api/prospects/:id

# Campaigns
GET    /api/campaigns
POST   /api/campaigns                    # Create campaign
GET    /api/campaigns/:id
PUT    /api/campaigns/:id
DELETE /api/campaigns/:id
POST   /api/campaigns/:id/start          # Start sending
POST   /api/campaigns/:id/pause
GET    /api/campaigns/:id/stats
GET    /api/campaigns/:id/prospects      # List prospects in campaign

# Emails
GET    /api/campaigns/:id/emails         # List emails
GET    /api/emails/:messageId
POST   /api/emails/:messageId/resend

# Tracking
GET    /api/tracking/campaign/:id        # Campaign tracking data
GET    /api/tracking/prospect/:id        # Prospect tracking data
POST   /api/tracking/check-responses     # Manual response check

# Analytics
GET    /api/analytics/campaign/:id
GET    /api/analytics/dashboard          # Overall analytics

# Webhooks
POST   /api/webhooks/email/delivered     # Email delivery webhook
POST   /api/webhooks/email/bounced       # Bounce webhook
POST   /api/webhooks/email/opened        # Open tracking
POST   /api/webhooks/email/clicked       # Click tracking
```

### **WebSocket Events**

```typescript
// Client → Server
{
  subscribe_campaign: { campaignId: string }
  unsubscribe_campaign: { campaignId: string }
}

// Server → Client
{
  listener_notification: {
    type: 'listener_notification',
    listenerId: string,
    listenerName: string,
    priority: 'low' | 'normal' | 'high',
    message: string,
    timestamp: string
  }
  
  metrics_update: {
    type: 'metrics_update',
    campaignId: string,
    metrics: CampaignMetrics
  }
  
  new_response: {
    type: 'new_response',
    campaignId: string,
    prospectId: string,
    response: ResponseData
  }
  
  campaign_status: {
    type: 'campaign_status',
    campaignId: string,
    status: 'active' | 'paused' | 'completed'
  }
}
```

---

## **8. Testing Strategy**

### **Unit Testing**

```typescript
// Test structure
apps/backend/__tests__/
├── services/
│   ├── orchestrator.test.ts
│   ├── email.test.ts
│   └── analytics.test.ts
├── controllers/
│   └── campaign.controller.test.ts
└── utils/
    └── validation.test.ts

// Example test
import { describe, it, expect } from 'vitest';

describe('EmailService', () => {
  it('should send email with correct headers', async () => {
    const service = new EmailService();
    const result = await service.sendEmail(...);
    
    expect(result.messageId).toBeDefined();
    expect(result.success).toBe(true);
  });
});
```

### **Integration Testing**

```typescript
// Test API endpoints
describe('POST /api/campaigns', () => {
  it('should create campaign', async () => {
    const response = await request(app)
      .post('/api/campaigns')
      .send({
        clientId: 'client-123',
        name: 'Test Campaign',
        prospectIds: ['prospect-1', 'prospect-2']
      });
    
    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
  });
});
```

### **E2E Testing**

```typescript
// Playwright tests
test('user can create and launch campaign', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');
  
  // Create campaign
  await page.goto('/campaigns/new');
  await page.fill('[name="name"]', 'Test Campaign');
  await page.click('button:has-text("Create")');
  
  // Verify creation
  await expect(page).toHaveURL(/campaigns\/[a-z0-9-]+/);
  await expect(page.locator('text=Test Campaign')).toBeVisible();
});
```

---

## **9. Deployment**

### **Environment Setup**

```bash
# Production environment variables
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourapp.com

# API Keys (use secrets management)
ANTHROPIC_API_KEY=...
GOOGLE_MAPS_API_KEY=...
FIRECRAWL_API_KEY=...
PERPLEXITY_API_KEY=...
RESEND_API_KEY=...

# Database
TURSO_DATABASE_URL=...
TURSO_AUTH_TOKEN=...

# Redis
REDIS_URL=...
```

### **Deployment Options**

#### **Option 1: Railway (Recommended for MVP)**

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up

# Set environment variables
railway variables set ANTHROPIC_API_KEY=...
```

#### **Option 2: Fly.io**

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app
fly launch

# Deploy
fly deploy
```

#### **Option 3: Docker + VPS**

```bash
# Build images
docker-compose build

# Push to registry
docker-compose push

# Deploy on VPS
ssh user@your-server
docker-compose pull
docker-compose up -d
```

### **CI/CD Pipeline**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: pnpm install
      - run: pnpm test
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## **10. Monitoring & Maintenance**

### **Error Tracking**

```typescript
// Sentry integration
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0
});

// Use in error handlers
app.use(Sentry.Handlers.errorHandler());
```

### **Logging**

```typescript
// Winston logger
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### **Monitoring Dashboards**

1. **Application Metrics**: Use PostHog or Mixpanel
2. **Infrastructure**: Railway/Fly.io dashboards
3. **Email Deliverability**: Resend dashboard
4. **API Usage**: Track Anthropic API usage
5. **Campaign Health**: Custom AgentFS queries

### **Backup Strategy**

```bash
# Backup AgentFS databases
# Daily cron job
0 2 * * * /scripts/backup-agentfs.sh

# backup-agentfs.sh
#!/bin/bash
BACKUP_DIR="/backups/agentfs/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Copy all .agentfs databases
cp -r .agentfs/* $BACKUP_DIR/

# Upload to S3 or similar
aws s3 sync $BACKUP_DIR s3://your-bucket/agentfs-backups/
```

---

## **11. Success Metrics**

### **System Performance**

- **Client Discovery**: < 5 minutes per website
- **Lead Discovery**: 100 prospects per hour
- **Email Generation**: < 30 seconds per prospect
- **Response Detection**: < 5 seconds (real-time)
- **API Response Time**: < 500ms (p95)
- **Uptime**: > 99.5%

### **Business Metrics**

- **Email Delivery Rate**: > 95%
- **Open Rate**: > 40% (industry average: 20-30%)
- **Reply Rate**: > 5% (industry average: 1-3%)
- **Positive Reply Rate**: > 60% of replies
- **Meeting Booking Rate**: > 2%

---

## **12. Common Issues & Solutions**

### **Issue: Claude Agent timeouts**
**Solution**: Implement chunking for large operations, use async processing

### **Issue: Google Maps rate limits**
**Solution**: Implement request queuing, use exponential backoff

### **Issue: IMAP connection drops**
**Solution**: Implement auto-reconnect logic, monitor connection health

### **Issue: Email deliverability**
**Solution**: Warm up sending domain, implement SPF/DKIM/DMARC, monitor sender reputation

### **Issue: AgentFS database size**
**Solution**: Implement data retention policies, archive old campaigns

---

## **13. Next Steps After MVP**

1. **Enhanced Features**
   - A/B testing for email templates
   - Automated follow-up optimization
   - Multi-channel outreach (LinkedIn, phone)
   - CRM integrations (Salesforce, HubSpot)

2. **AI Improvements**
   - Fine-tuned models for better personalization
   - Predictive lead scoring
   - Automated response handling
   - Meeting scheduling automation

3. **Scalability**
   - Multi-tenant support
   - Team collaboration features
   - White-label options
   - API for third-party integrations

4. **Advanced Analytics**
   - Cohort analysis
   - Attribution tracking
   - Revenue forecasting
   - Competitive benchmarking

---

This is your complete blueprint! Start with Phase 1, follow each step methodically, and you'll have a production-ready system in 12-14 weeks. 🚀