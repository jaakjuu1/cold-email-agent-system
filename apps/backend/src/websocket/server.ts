import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { WebSocketEvent } from '@cold-outreach/shared';

let ioInstance: SocketIOServer | null = null;

export function createWebSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Subscribe to campaign updates
    socket.on('subscribe_campaign', (campaignId: string) => {
      socket.join(`campaign:${campaignId}`);
      console.log(`📡 Client ${socket.id} subscribed to campaign ${campaignId}`);
    });

    // Unsubscribe from campaign updates
    socket.on('unsubscribe_campaign', (campaignId: string) => {
      socket.leave(`campaign:${campaignId}`);
      console.log(`📡 Client ${socket.id} unsubscribed from campaign ${campaignId}`);
    });

    // Subscribe to client updates
    socket.on('subscribe_client', (clientId: string) => {
      socket.join(`client:${clientId}`);
      console.log(`📡 Client ${socket.id} subscribed to client ${clientId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (${reason})`);
    });

    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  ioInstance = io;
  return io;
}

export function getIO(): SocketIOServer {
  if (!ioInstance) {
    throw new Error('WebSocket server not initialized');
  }
  return ioInstance;
}

// Broadcast helpers
export function broadcast(event: WebSocketEvent) {
  const io = getIO();
  io.emit(event.type, event);
}

export function broadcastToCampaign(campaignId: string, event: WebSocketEvent) {
  const io = getIO();
  io.to(`campaign:${campaignId}`).emit(event.type, event);
}

export function broadcastToClient(clientId: string, event: WebSocketEvent) {
  const io = getIO();
  io.to(`client:${clientId}`).emit(event.type, event);
}

export function notifyListenerEvent(
  listenerId: string,
  priority: 'low' | 'normal' | 'high',
  message: string
) {
  broadcast({
    type: 'listener_notification',
    listenerId,
    priority,
    message,
  });
}

