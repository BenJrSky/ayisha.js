const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = process.argv.includes('--dev');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));

// Compression middleware
app.use(compression());

// Static files
app.use(express.static('.'));

// SSR Route
app.get('/', (req, res) => {
  try {
    // Read the base HTML template
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ayisha.js SSR App</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div id="app">
        <h1>🚀 Ayisha.js SSR Application</h1>
        <p>Server-side rendered at: ${new Date().toISOString()}</p>
        <div class="features">
            <h2>✨ Features</h2>
            <ul>
                <li>Server-Side Rendering (SSR)</li>
                <li>Client-Side Hydration</li>
                <li>Express.js Server</li>
                <li>Security with Helmet</li>
                <li>Gzip Compression</li>
                <li>Hot Reload (Dev Mode)</li>
            </ul>
        </div>
        <div class="status">
            <p>Mode: ${isDev ? 'Development' : 'Production'}</p>
            <p>Port: ${PORT}</p>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/ayisha@latest/dist/ayisha-min.js"></script>
    <script src="client.js"></script>
</body>
</html>`;
    
    res.send(htmlTemplate);
  } catch (error) {
    console.error('SSR Error:', error);
    res.status(500).send('<h1>Server Error</h1><p>Something went wrong with server-side rendering.</p>');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Ayisha.js SSR Server running on http://localhost:${PORT}`);
  console.log(`📦 Mode: ${isDev ? 'Development' : 'Production'}`);
  if (isDev) {
    console.log('🔧 Development mode: Hot reload enabled');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Server shutting down gracefully...');
  process.exit(0);
});