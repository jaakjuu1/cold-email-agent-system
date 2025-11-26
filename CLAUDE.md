# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered B2B cold outreach automation system that discovers client businesses, generates Ideal Customer Profiles (ICP), finds leads via Google Maps, creates personalized email campaigns, and tracks responses in real-time.

## Development Commands

```bash
# Install dependencies (requires pnpm >= 8.0.0)
pnpm install

# Development - run all apps in parallel
pnpm dev

# Run single app
pnpm --filter @cold-outreach/backend dev
pnpm --filter @cold-outreach/frontend dev

# Build
pnpm build                    # Build all
pnpm build:backend            # Build backend (builds shared + agent first)
pnpm build:frontend           # Build frontend (builds shared first)

# Tests
pnpm test                     # Run backend + frontend tests
pnpm test:backend             # Backend tests only
pnpm test:frontend            # Frontend tests only
pnpm test:e2e                 # Playwright E2E tests

# Run single test file
pnpm --filter @cold-outreach/backend test src/services/__tests__/email.service.test.ts

# Type checking
pnpm typecheck

# Docker
docker-compose up -d          # Start all services
docker-compose logs -f        # Follow logs
```

## Architecture

### Monorepo Structure

- **apps/backend**: Express API server with WebSocket (Socket.io), uses BullMQ for job queues
- **apps/frontend**: React 18 + Vite + Tailwind CSS + Zustand + TanStack Query
- **packages/agent**: Claude orchestration using `@anthropic-ai/claude-agent-sdk` with Skills auto-discovery and Turso (libsql) for AgentFS storage
- **packages/shared**: Shared Zod schemas and TypeScript types - must be built before other packages
- **e2e/**: Playwright E2E tests

### Agent Skills System

Located in `.claude/skills/`, skills are loaded automatically by the Claude Agent SDK when `settingSources: ["project"]` is configured. Each skill has:
- `SKILL.md`: YAML frontmatter with `description` field (triggers skill invocation) + workflow documentation
- Python scripts for external API integrations (Firecrawl, Perplexity, Google Maps)
- TypeScript listeners for event-driven processing

The Orchestrator in `packages/agent/src/orchestrator.ts` uses `query()` from the SDK with skills enabled. Claude autonomously invokes skills based on the prompt and skill descriptions.

Skills:
- **client-discovery**: Website analysis and ICP generation
- **lead-discovery**: Google Maps scraping and company enrichment
- **email-personalization**: Personalized email sequence generation
- **email-tracking**: IMAP monitoring and response detection
- **campaign-management**: Rate limiting and analytics

### Data Flow

1. Client onboarding → Website analysis → ICP generation (packages/agent/orchestrator.ts)
2. ICP approval → Lead discovery via Google Maps (skills/lead-discovery/)
3. Lead enrichment → Email sequence generation (skills/email-personalization/)
4. Campaign execution → Real-time tracking via WebSocket (apps/backend/websocket/)

### Key Patterns

- **Type definitions**: Shared Zod schemas in `packages/shared/src/types/index.ts` - both runtime validation and TypeScript types
- **Backend services**: Located in `apps/backend/src/services/`, orchestrator.service.ts coordinates Claude agent calls
- **Frontend state**: Zustand stores in `apps/frontend/src/store/`, React Query for server state
- **AI integration**: Orchestrator class in `packages/agent/src/orchestrator.ts` uses Claude Agent SDK's `query()` with skills from `.claude/skills/`

## Environment Setup

Copy `env.example` to `.env` and configure:
- `ANTHROPIC_API_KEY`: Required for Claude integration
- `GOOGLE_MAPS_API_KEY`: Required for lead discovery
- `FIRECRAWL_API_KEY`, `PERPLEXITY_API_KEY`: Required for research
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`: Production database
- `REDIS_URL`: Task queue (default: redis://localhost:6379)

## Testing

- Backend: Vitest with tests in `src/services/__tests__/`
- Frontend: Vitest + Testing Library with tests co-located (`*.test.ts(x)`)
- E2E: Playwright with tests in `e2e/tests/`, runs against `http://localhost:5173`

## Build Order

Shared packages must build first due to workspace dependencies:
1. `@cold-outreach/shared`
2. `@cold-outreach/agent`
3. `@cold-outreach/backend` / `@cold-outreach/frontend`
