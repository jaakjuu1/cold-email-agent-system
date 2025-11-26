import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = import.meta.env.VITE_WS_URL || window.location.origin;
    socket = io(url, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function subscribeToCampaign(campaignId: string): void {
  const s = getSocket();
  s.emit('subscribe_campaign', campaignId);
}

export function unsubscribeFromCampaign(campaignId: string): void {
  const s = getSocket();
  s.emit('unsubscribe_campaign', campaignId);
}

export function subscribeToClient(clientId: string): void {
  const s = getSocket();
  s.emit('subscribe_client', clientId);
}

