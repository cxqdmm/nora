
import { WebSocketServer, WebSocket } from 'ws';

export class LogServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(port: number = 3000) {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log('[LogServer] Client connected');

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });

    console.log(`[LogServer] WebSocket server started on port ${port}`);
  }

  broadcast(log: any) {
    const message = JSON.stringify({
      ...log,
      timestamp: new Date().toISOString()
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  close() {
    this.wss.close();
  }
}
