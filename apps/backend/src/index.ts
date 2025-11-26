// IMPORTANT: Load environment variables BEFORE any other imports
// so that modules can access process.env during initialization
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from project root
config({ path: resolve(process.cwd(), '../../.env') });
// Also try local .env if exists
config({ path: resolve(process.cwd(), '.env') });

// Now import the rest after env is loaded
import { createServer } from './server.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
  try {
    const { app, httpServer, io } = await createServer();

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 WebSocket server ready`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down gracefully...');
      
      io.close();
      httpServer.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        console.error('⚠️ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();

