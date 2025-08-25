const express = require('express');
const path = require('path');
const chokidar = require('chokidar');
const WebSocket = require('ws');

class AyishaDevServer {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.publicDir = options.publicDir || 'public';
    this.app = express();
    this.wss = null;
    this.setupServer();
  }

  setupServer() {
    // Serve static files
    this.app.use(express.static(this.publicDir));
    
    // Serve Ayisha.js locally
    this.app.use('/ayisha', express.static(path.join(__dirname, '../../dist')));
    
    // SPA fallback
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), this.publicDir, 'index.html'));
    });
  }

  setupHotReload() {
    const server = require('http').createServer(this.app);
    this.wss = new WebSocket.Server({ server });
    
    // Watch for file changes
    chokidar.watch(this.publicDir).on('change', () => {
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send('reload');
        }
      });
    });
    
    return server;
  }

  start() {
    const server = this.setupHotReload();
    server.listen(this.port, () => {
      console.log(`🚀 Ayisha Dev Server running on http://localhost:${this.port}`);
    });
  }
}

module.exports = AyishaDevServer;