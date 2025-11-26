import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer as createHttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { errorHandler } from './middleware/error.middleware.js';
import { createWebSocketServer } from './websocket/server.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import clientRoutes from './routes/clients.routes.js';
import campaignRoutes from './routes/campaigns.routes.js';
import prospectRoutes from './routes/prospects.routes.js';
import webhookRoutes from './routes/webhooks.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';

export async function createServer() {
  const app = express();
  const httpServer = createHttpServer(app);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logging
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/prospects', prospectRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/analytics', analyticsRoutes);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
    });
  });

  // Error handler
  app.use(errorHandler);

  // WebSocket server
  const io = createWebSocketServer(httpServer);

  return { app, httpServer, io };
}

