# Multi-stage Dockerfile for Cold Outreach System

# ==============================================================================
# Base stage - Common dependencies
# ==============================================================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@latest --activate

# ==============================================================================
# Dependencies stage - Install all dependencies
# ==============================================================================
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/agent/package.json ./packages/agent/

# Install dependencies
RUN pnpm install --frozen-lockfile

# ==============================================================================
# Builder stage - Build all packages
# ==============================================================================
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/agent/node_modules ./packages/agent/node_modules

# Copy source code
COPY . .

# Build shared package
RUN pnpm --filter @cold-outreach/shared build

# Build agent package
RUN pnpm --filter @cold-outreach/agent build

# Build backend
RUN pnpm --filter @cold-outreach/backend build

# Build frontend
RUN pnpm --filter @cold-outreach/frontend build

# ==============================================================================
# Backend runtime stage
# ==============================================================================
FROM base AS backend
WORKDIR /app

ENV NODE_ENV=production

# Copy built backend
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/packages/shared/dist ../packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ../packages/shared/
COPY --from=builder /app/packages/agent/dist ../packages/agent/dist
COPY --from=builder /app/packages/agent/package.json ../packages/agent/

# Copy node_modules (production only)
COPY --from=deps /app/apps/backend/node_modules ./node_modules

# Copy skills for Claude agent
COPY --from=builder /app/.claude ./.claude

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 backend
USER backend

EXPOSE 3000

CMD ["node", "dist/index.js"]

# ==============================================================================
# Frontend runtime stage (nginx)
# ==============================================================================
FROM nginx:alpine AS frontend

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built frontend
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# ==============================================================================
# Python runtime stage (for skills)
# ==============================================================================
FROM python:3.11-slim AS python-skills
WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy skills
COPY .claude/skills ./.claude/skills

# Create non-root user
RUN useradd -m -u 1001 skills
USER skills

CMD ["python", "--version"]

