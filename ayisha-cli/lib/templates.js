
const cdnTemplates = {
  'Basic': {
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{projectName}}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <init>
        title = 'Welcome to {{projectName}}!';
        message = 'Your Ayisha.js app is ready!';
    </init>
    
    <header>
        <div>
            <img src="ayisha-logo-black.png" alt="Ayisha.js Logo">
            <h1>{{ title }}</h1>
            <p>{{ message }}</p>
        </div>
    </header>
    
    <main>
        <section>
            <p>Your application is ready to use!</p>
        </section>
    </main>
    
    <footer>
        <small><img src="ayisha-logo-black.png" alt="Ayisha.js Logo"></small>
        <small>Made with ❤️ using <a href="https://ayisha.app" target="_blank">Ayisha.js</a></small>
    </footer>
    
    <script src="https://cdn.jsdelivr.net/gh/BenJrSky/ayisha.js@main/ayisha.js"></script>
</body>
</html>`
    }
  },
  'SPA': {
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{projectName}} - SPA</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        .navbar { background: #333; color: white; padding: 1rem; }
        .container { padding: 20px; }
    </style>
</head>
<body>
    <div>
        <init>
            appName = '{{projectName}} SPA';
            currentPage = 'home';
        </init>
        
        <nav class="navbar">{{ appName }}</nav>
        
        <div class="container">
            <div @page="home">
                <h1>Home Page</h1>
                <p>Welcome to your SPA!</p>
                <a @link="about">Go to About</a>
            </div>
            
            <div @page="about">
                <h1>About Page</h1>
                <p>This is the about page.</p>
                <a @link="home">Back to Home</a>
            </div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/gh/BenJrSky/ayisha.js@main/ayisha.js"></script>
</body>
</html>`
    }
  },
  'Todo': {
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{projectName}} - Todo App</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <init>
       newTodo =""
       todos = []
    </init>
    
    <header>
        <div>
            <img src="ayisha-logo-black.png" alt="Ayisha.js Logo">
            <h1>{{projectName}} Todo App</h1>
            <p class="hero-subtitle">Build and manage your tasks with the power of Ayisha.js reactive framework</p>
        </div>
    </header>
    
    <main>
        <section>
            <input type="text" @model="newTodo" placeholder="What needs to be done?">
            <nav>
                <button @click="if(newTodo.trim()) { todos.push({text: newTodo.trim(), completed: false}); newTodo = '' }">Add Todo</button>
                <button @click="todos = []">Clear All</button>
                <button @click="todos = todos.filter(t => !t.completed)">Clear Completed</button>
            </nav>
        </section>
        
        <div @show="todos.length > 0">
            <p><strong @text="todos.filter(t => !t.completed).length"></strong> active, 
            <strong @text="todos.filter(t => t.completed).length"></strong> completed, 
            <strong @text="todos.length"></strong> total</p>
        </div>
        
        <div @if="todos.length === 0">
            <p>🎯 No todos yet. Add one above to get started!</p>
        </div>
        
        <ul @if="todos.length > 0">
            <li @for="todo in todos">
                <label>
                    <input type="checkbox" @model="todo.completed">
                    <span @text="todo.text"></span>
                    <span @click="todos = todos.filter(t => t !== todo)">❌</span>
                </label>
            </li>
        </ul>
    </main>
    
    <footer>
        <small><img src="ayisha-logo-black.png" alt="Ayisha.js Logo"></small>
        <small>Made with ❤️ using <a href="https://ayisha.app" target="_blank">Ayisha.js</a></small>
    </footer>
    
    <script src="https://cdn.jsdelivr.net/gh/BenJrSky/ayisha.js@main/ayisha.js"></script>
</body>
</html>`
    }
  },
  'SSR': {
    files: {
      'package.json': `{
  "name": "{{projectName}}-ssr",
  "version": "1.0.0",
  "description": "{{projectName}} - Ayisha.js SSR Application",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "build": "node build.js",
    "test": "node test-ssr.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "compression": "^1.7.4",
    "helmet": "^7.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}`,

      'server.js': `const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const helmet = require('helmet');

// Import Ayisha.js
const AyishaVDOM = require('./ayisha-1.1.0.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'public')));

// SSR Route with enhanced error handling
app.get('*', async (req, res) => {
  try {
    const ssrResult = await renderPageWithFallback(req.path);
    
    if (ssrResult.success) {
      res.send(ssrResult.html);
    } else {
      console.warn('SSR failed, falling back to CSR:', ssrResult.error);
      res.send(getClientSideTemplate());
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).send(getErrorTemplate(error));
  }
});

// Enhanced SSR function with validation
async function renderPageWithFallback(path) {
  try {
    if (!validateSSRCapabilities()) {
      return {
        success: false,
        error: 'SSR capabilities not available'
      };
    }

    const template = getTemplate();
    const initialState = getInitialState(path);
    
    const ayisha = new AyishaVDOM({
      ssr: true,
      hydration: false
    });

    const result = ayisha.renderToString(template, initialState);
    
    if (!result || !result.html) {
      throw new Error('renderToString returned invalid result');
    }

    const html = \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{projectName}} - SSR</title>
    <link rel="stylesheet" href="/static/styles.css">
    \${result.metaTags || ''}
</head>
<body>
    <div id="app">\${result.html}</div>
    <script>
        window.__AYISHA_STATE__ = \${JSON.stringify(result.state || {})};
    </script>
    \${result.hydrationScript || ''}
    <script src="/static/ayisha-1.1.0.js"></script>
    <script src="/static/client.js"></script>
</body>
</html>\`;

    return { success: true, html };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function validateSSRCapabilities() {
  try {
    const testInstance = new AyishaVDOM({ ssr: true });
    return (
      typeof testInstance.renderToString === 'function' &&
      typeof testInstance.isServerSide === 'function' &&
      testInstance.isServerSide() === true
    );
  } catch (error) {
    console.error('SSR validation failed:', error);
    return false;
  }
}

function getTemplate() {
  return \`
    <div class="container">
      <init>
        title = "{{projectName}} SSR";
        message = "Hello from Server-Side Rendering!";
        features = ["SSR", "Hydration", "Performance", "SEO"];
        serverTime = new Date().toISOString();
      </init>
      
      <header class="header">
        <img src="/static/ayisha-logo-black.png" alt="Ayisha.js Logo">
        <h1>{{ title }}</h1>
        <p>{{ message }}</p>
      </header>
      
      <main class="main">
        <section class="features">
          <h2>Features</h2>
          <ul>
            @for(feature in features)
              <li>{{ feature }}</li>
            @endfor
          </ul>
        </section>
        
        <section class="info">
          <p>This page was rendered on the server!</p>
          <p>Server time: {{ serverTime }}</p>
        </section>
      </main>
      
      <footer>
        <small><img src="/static/ayisha-logo-black.png" alt="Ayisha.js Logo"></small>
        <small>Made with ❤️ using <a href="https://ayisha.app" target="_blank">Ayisha.js</a></small>
      </footer>
    </div>
  \`;
}

function getInitialState(path) {
  return {
    currentPath: path,
    serverRendered: true,
    timestamp: new Date().toISOString()
  };
}

function getClientSideTemplate() {
  return \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{projectName}} (CSR Fallback)</title>
    <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
    <div id="app">
        <div class="loading">Loading...</div>
    </div>
    <script src="/static/ayisha-1.1.0.js"></script>
    <script src="/static/client.js"></script>
</body>
</html>\`;
}

function getErrorTemplate(error) {
  return \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error</title>
</head>
<body>
    <h1>Server Error</h1>
    <p>Something went wrong. Please try again later.</p>
    \${process.env.NODE_ENV === 'development' ? \`<pre>\${error.stack}</pre>\` : ''}
</body>
</html>\`;
}

app.listen(PORT, () => {
  console.log(\`🚀 SSR Server running on http://localhost:\${PORT}\`);
  console.log('SSR capabilities:', validateSSRCapabilities() ? '✅ Available' : '⚠️ Limited');
});`,

      'client.js': `(function() {
  'use strict';
  
  function initializeClient() {
    try {
      const initialState = window.__AYISHA_STATE__ || {};
      
      const ayisha = new AyishaVDOM({
        ssr: false,
        hydration: true
      });
      
      const template = \`
        <div class="container">
          <init>
            title = "{{projectName}} SSR";
            message = "Now running on client-side!";
            features = ["SSR", "Hydration", "Performance", "SEO", "Interactivity"];
            counter = 0;
            serverTime = "";
          </init>
          
          <header class="header">
            <img src="/static/ayisha-logo-black.png" alt="Ayisha.js Logo">
            <h1>{{ title }}</h1>
            <p>{{ message }}</p>
          </header>
          
          <main class="main">
            <section class="features">
              <h2>Features</h2>
              <ul>
                @for(feature in features)
                  <li>{{ feature }}</li>
                @endfor
              </ul>
            </section>
            
            <section class="interactive">
              <h3>Interactive Counter</h3>
              <p>Count: {{ counter }}</p>
              <button @click="counter++">Increment</button>
              <button @click="counter--">Decrement</button>
              <button @click="counter = 0">Reset</button>
            </section>
            
            <section class="info">
              <p>Server rendered: {{ serverRendered ? 'Yes' : 'No' }}</p>
              <p>Hydrated at: {{ new Date().toLocaleTimeString() }}</p>
              @if(serverTime)
                <p>Original server time: {{ serverTime }}</p>
              @endif
            </section>
          </main>
          
          <footer>
            <small><img src="/static/ayisha-logo-black.png" alt="Ayisha.js Logo"></small>
            <small>Made with ❤️ using <a href="https://ayisha.app" target="_blank">Ayisha.js</a></small>
          </footer>
        </div>
      \`;
      
      const clientState = {
        ...initialState,
        hydrated: true,
        hydratedAt: new Date().toISOString()
      };
      
      ayisha.mount('#app', template, clientState);
      
      console.log('✅ Client-side hydration completed');
    } catch (error) {
      console.error('❌ Client initialization failed:', error);
      document.getElementById('app').innerHTML = '<p>App loaded with limited functionality</p>';
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeClient);
  } else {
    initializeClient();
  }
})();`,

      'test-ssr.js': `const AyishaVDOM = require('./ayisha-1.1.0.js');

console.log('🧪 Testing Ayisha SSR capabilities...');

try {
  const ayisha = new AyishaVDOM({ ssr: true });
  console.log('✅ SSR instance created successfully');
} catch (error) {
  console.error('❌ SSR instance creation failed:', error.message);
  process.exit(1);
}

try {
  const ayisha = new AyishaVDOM({ ssr: true });
  const isServer = ayisha.isServerSide();
  console.log(\`✅ Server-side detection: \${isServer}\`);
} catch (error) {
  console.error('❌ Server-side detection failed:', error.message);
}

try {
  const ayisha = new AyishaVDOM({ ssr: true });
  const template = '<div><init>message = "Hello SSR";</init><p>{{ message }}</p></div>';
  const result = ayisha.renderToString(template, {});
  
  if (result && result.html) {
    console.log('✅ renderToString working');
    console.log('  HTML output:', result.html.substring(0, 100) + '...');
  } else {
    console.error('❌ renderToString returned invalid result');
  }
} catch (error) {
  console.error('❌ renderToString failed:', error.message);
}

try {
  const ayisha = new AyishaVDOM({ ssr: true });
  const template = \`
    <div>
      <init>
        items = ["test1", "test2"];
        showContent = true;
      </init>
      @if(showContent)
        <ul>
          @for(item in items)
            <li>{{ item }}</li>
          @endfor
        </ul>
      @endif
    </div>
  \`;
  
  const result = ayisha.renderToString(template, {});
  
  if (result && result.html && result.html.includes('test1')) {
    console.log('✅ Complex template rendering working');
  } else {
    console.error('❌ Complex template rendering failed');
  }
} catch (error) {
  console.error('❌ Complex template test failed:', error.message);
}

console.log('\n🏁 SSR testing completed. Check results above.');`,

      'build.js': `const fs = require('fs');
const path = require('path');

console.log('🔨 Building SSR application...');

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
  console.log('📁 Created public directory');
}

if (fs.existsSync('ayisha-1.1.0.js')) {
  fs.copyFileSync('ayisha-1.1.0.js', 'public/ayisha-1.1.0.js');
  console.log('📄 Copied Ayisha.js to public directory');
}

if (fs.existsSync('styles.css')) {
  fs.copyFileSync('styles.css', 'public/styles.css');
  console.log('🎨 Copied styles.css to public directory');
}

if (fs.existsSync('client.js')) {
  fs.copyFileSync('client.js', 'public/client.js');
  console.log('📄 Copied client.js to public directory');
}

if (fs.existsSync('ayisha-logo-black.png')) {
  fs.copyFileSync('ayisha-logo-black.png', 'public/ayisha-logo-black.png');
  console.log('🖼️ Copied logo to public directory');
}

console.log('✅ Build completed successfully!\n');
console.log('🚀 Run "npm start" to start the SSR server');
console.log('🔧 Run "npm run dev" for development with auto-reload');`,

      'README.md': `# {{projectName}} - Ayisha.js SSR Application

Server-Side Rendered application built with Ayisha.js and Express.js.

## 🚀 Features

- ✅ **Server-Side Rendering** with fallback to Client-Side Rendering
- ✅ **Enhanced error handling** and validation
- ✅ **Client-side hydration** for interactivity
- ✅ **Performance optimizations** (compression, helmet)
- ✅ **Development and production** modes
- ✅ **Comprehensive testing** suite
- ✅ **Graceful fallbacks** for reliability

## 📦 Installation

\`\`\`bash
npm install
\`\`\`

## 🔧 Development

\`\`\`bash
npm run dev
\`\`\`

Starts the server with auto-reload using nodemon.

## 🏗️ Build

\`\`\`bash
npm run build
\`\`\`

Copies all necessary files to the public directory.

## 🚀 Production

\`\`\`bash
npm start
\`\`\`

Starts the production server.

## 🧪 Testing SSR

\`\`\`bash
npm test
\`\`\`

Runs comprehensive SSR capability tests.

## ⚠️ Important Notes

### SSR Reliability

This implementation includes **multiple fallback mechanisms** for potential issues with Ayisha.js SSR capabilities:

1. **SSR Validation**: Tests SSR capabilities before attempting to render
2. **Error Handling**: Catches and logs SSR errors, falls back to CSR
3. **Client Hydration**: Ensures interactivity even if SSR fails
4. **Development Debugging**: Detailed error messages in development mode

### Architecture

- **\`server.js\`** - Express server with SSR logic and fallbacks
- **\`client.js\`** - Client-side hydration and enhanced interactivity
- **\`test-ssr.js\`** - Comprehensive SSR capability testing
- **\`build.js\`** - Production build script
- **\`public/\`** - Static assets served by Express

### Performance Features

- **Compression middleware** for smaller payloads
- **Helmet security headers** for protection
- **Static file serving** for optimal asset delivery
- **Graceful error handling** with user-friendly fallbacks

### Development Workflow

1. **Development**: \`npm run dev\` - Auto-reload server
2. **Testing**: \`npm test\` - Verify SSR capabilities
3. **Building**: \`npm run build\` - Prepare for production
4. **Production**: \`npm start\` - Run production server

## 🔍 Troubleshooting

If SSR fails, the application will:
1. Log the error to console
2. Automatically fall back to client-side rendering
3. Maintain full functionality for users

This ensures **100% uptime** even with SSR issues.

---

**Built with ❤️ using [Ayisha.js](https://ayisha.app)**`
    }
  },
  'SSR': {
    files: {
      'package.json': `{
  "name": "{{projectName}}-ssr",
  "version": "1.0.0",
  "description": "{{projectName}} - Ayisha.js SSR Application",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "build": "node build.js",
    "test": "node test-ssr.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "compression": "^1.7.4",
    "helmet": "^7.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}`,

      'server.js': `import express from 'express';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Import Ayisha.js
const AyishaVDOM = require('./ayisha-1.1.0.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'public')));

// SSR Route with enhanced error handling
app.get('*', async (req, res) => {
  try {
    const ssrResult = await renderPageWithFallback(req.path);
    
    if (ssrResult.success) {
      res.send(ssrResult.html);
    } else {
      console.warn('SSR failed, falling back to CSR:', ssrResult.error);
      res.send(getClientSideTemplate());
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).send(getErrorTemplate(error));
  }
});

// Enhanced SSR function with validation
async function renderPageWithFallback(path) {
  try {
    if (!validateSSRCapabilities()) {
      return {
        success: false,
        error: 'SSR capabilities not available'
      };
    }

    const template = getTemplate();
    const initialState = getInitialState(path);
    
    const ayisha = new AyishaVDOM({
      ssr: true,
      hydration: false
    });

    const result = ayisha.renderToString(template, initialState);
    
    if (!result || !result.html) {
      throw new Error('renderToString returned invalid result');
    }

    const html = \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{projectName}} - SSR</title>
    <link rel="stylesheet" href="/static/styles.css">
    \${result.metaTags || ''}
</head>
<body>
    <div id="app">\${result.html}</div>
    <script>
        window.__AYISHA_STATE__ = \${JSON.stringify(result.state || {})};
    </script>
    \${result.hydrationScript || ''}
    <script type="module" src="/static/ayisha-1.1.0.js"></script>
    <script type="module" src="/static/client.js"></script>
</body>
</html>\`;

    return { success: true, html };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function validateSSRCapabilities() {
  try {
    const testInstance = new AyishaVDOM({ ssr: true });
    return (
      typeof testInstance.renderToString === 'function' &&
      typeof testInstance.isServerSide === 'function' &&
      testInstance.isServerSide() === true
    );
  } catch (error) {
    console.error('SSR validation failed:', error);
    return false;
  }
}

function getTemplate() {
  return \`
    <div class="container">
      <init>
        title = "{{projectName}} SSR";
        message = "Hello from Server-Side Rendering!";
        features = ["SSR", "Hydration", "Performance", "SEO"];
        serverTime = new Date().toISOString();
      </init>
      
      <header class="header">
        <img src="/static/ayisha-logo-black.png" alt="Ayisha.js Logo">
        <h1>{{ title }}</h1>
        <p>{{ message }}</p>
      </header>
      
      <main class="main">
        <section class="features">
          <h2>Features</h2>
          <ul>
            @for(feature in features)
              <li>{{ feature }}</li>
            @endfor
          </ul>
        </section>
        
        <section class="info">
          <p>This page was rendered on the server!</p>
          <p>Server time: {{ serverTime }}</p>
        </section>
      </main>
      
      <footer>
        <small><img src="/static/ayisha-logo-black.png" alt="Ayisha.js Logo"></small>
        <small>Made with ❤️ using <a href="https://ayisha.app" target="_blank">Ayisha.js</a></small>
      </footer>
    </div>
  \`;
}

function getInitialState(path) {
  return {
    currentPath: path,
    serverRendered: true,
    timestamp: new Date().toISOString()
  };
}

function getClientSideTemplate() {
  return \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{projectName}} (CSR Fallback)</title>
    <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
    <div id="app">
        <div class="loading">Loading...</div>
    </div>
    <script type="module" src="/static/ayisha-1.1.0.js"></script>
    <script type="module" src="/static/client.js"></script>
</body>
</html>\`;
}

function getErrorTemplate(error) {
  return \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error</title>
</head>
<body>
    <h1>Server Error</h1>
    <p>Something went wrong. Please try again later.</p>
    \${process.env.NODE_ENV === 'development' ? \`<pre>\${error.stack}</pre>\` : ''}
</body>
</html>\`;
}

app.listen(PORT, () => {
  console.log(\`🚀 SSR Server running on http://localhost:\${PORT}\`);
  console.log('SSR capabilities:', validateSSRCapabilities() ? '✅ Available' : '⚠️ Limited');
});`,

      'client.js': `import { AyishaVDOM } from './ayisha-1.1.0.js';

(function() {
  'use strict';
  
  function initializeClient() {
    try {
      const initialState = window.__AYISHA_STATE__ || {};
      
      const ayisha = new AyishaVDOM({
        ssr: false,
        hydration: true
      });
      
      const template = \`
        <div class="container">
          <init>
            title = "{{projectName}} SSR";
            message = "Now running on client-side!";
            features = ["SSR", "Hydration", "Performance", "SEO", "Interactivity"];
            counter = 0;
            serverTime = "";
          </init>
          
          <header class="header">
            <img src="/static/ayisha-logo-black.png" alt="Ayisha.js Logo">
            <h1>{{ title }}</h1>
            <p>{{ message }}</p>
          </header>
          
          <main class="main">
            <section class="features">
              <h2>Features</h2>
              <ul>
                @for(feature in features)
                  <li>{{ feature }}</li>
                @endfor
              </ul>
            </section>
            
            <section class="interactive">
              <h3>Interactive Counter</h3>
              <p>Count: {{ counter }}</p>
              <button @click="counter++">Increment</button>
              <button @click="counter--">Decrement</button>
              <button @click="counter = 0">Reset</button>
            </section>
            
            <section class="info">
              <p>Server rendered: {{ serverRendered ? 'Yes' : 'No' }}</p>
              <p>Hydrated at: {{ new Date().toLocaleTimeString() }}</p>
              @if(serverTime)
                <p>Original server time: {{ serverTime }}</p>
              @endif
            </section>
          </main>
          
          <footer>
            <small><img src="/static/ayisha-logo-black.png" alt="Ayisha.js Logo"></small>
            <small>Made with ❤️ using <a href="https://ayisha.app" target="_blank">Ayisha.js</a></small>
          </footer>
        </div>
      \`;
      
      const clientState = {
        ...initialState,
        hydrated: true,
        hydratedAt: new Date().toISOString()
      };
      
      ayisha.mount('#app', template, clientState);
      
      console.log('✅ Client-side hydration completed');
    } catch (error) {
      console.error('❌ Client initialization failed:', error);
      document.getElementById('app').innerHTML = '<p>App loaded with limited functionality</p>';
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeClient);
  } else {
    initializeClient();
  }
})();`,

      'test-ssr.js': `import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const AyishaVDOM = require('./ayisha-1.1.0.js');

console.log('🧪 Testing Ayisha SSR capabilities...');

try {
  const ayisha = new AyishaVDOM({ ssr: true });
  console.log('✅ SSR instance created successfully');
} catch (error) {
  console.error('❌ SSR instance creation failed:', error.message);
  process.exit(1);
}

try {
  const ayisha = new AyishaVDOM({ ssr: true });
  const isServer = ayisha.isServerSide();
  console.log(\`✅ Server-side detection: \${isServer}\`);
} catch (error) {
  console.error('❌ Server-side detection failed:', error.message);
}

try {
  const ayisha = new AyishaVDOM({ ssr: true });
  const template = '<div><init>message = "Hello SSR";</init><p>{{ message }}</p></div>';
  const result = ayisha.renderToString(template, {});
  
  if (result && result.html) {
    console.log('✅ renderToString working');
    console.log('  HTML output:', result.html.substring(0, 100) + '...');
  } else {
    console.error('❌ renderToString returned invalid result');
  }
} catch (error) {
  console.error('❌ renderToString failed:', error.message);
}

try {
  const ayisha = new AyishaVDOM({ ssr: true });
  const template = \`
    <div>
      <init>
        items = ["test1", "test2"];
        showContent = true;
      </init>
      @if(showContent)
        <ul>
          @for(item in items)
            <li>{{ item }}</li>
          @endfor
        </ul>
      @endif
    </div>
  \`;
  
  const result = ayisha.renderToString(template, {});
  
  if (result && result.html && result.html.includes('test1')) {
    console.log('✅ Complex template rendering working');
  } else {
    console.error('❌ Complex template rendering failed');
  }
} catch (error) {
  console.error('❌ Complex template test failed:', error.message);
}

console.log('\n🏁 SSR testing completed. Check results above.');`,

      'build.js': `import fs from 'fs';
import path from 'path';

console.log('🔨 Building SSR application...');

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
  console.log('📁 Created public directory');
}

if (fs.existsSync('ayisha-1.1.0.js')) {
  fs.copyFileSync('ayisha-1.1.0.js', 'public/ayisha-1.1.0.js');
  console.log('📄 Copied Ayisha.js to public directory');
}

if (fs.existsSync('styles.css')) {
  fs.copyFileSync('styles.css', 'public/styles.css');
  console.log('🎨 Copied styles.css to public directory');
}

if (fs.existsSync('client.js')) {
  fs.copyFileSync('client.js', 'public/client.js');
  console.log('📄 Copied client.js to public directory');
}

if (fs.existsSync('ayisha-logo-black.png')) {
  fs.copyFileSync('ayisha-logo-black.png', 'public/ayisha-logo-black.png');
  console.log('🖼️ Copied logo to public directory');
}

console.log('✅ Build completed successfully!\n');
console.log('🚀 Run "npm start" to start the SSR server');
console.log('🔧 Run "npm run dev" for development with auto-reload');`,

      'README.md': `# {{projectName}} - Ayisha.js SSR Application

Server-Side Rendered application built with Ayisha.js and Express.js using modern ES modules.

## 🚀 Features

- ✅ **Server-Side Rendering** with fallback to Client-Side Rendering
- ✅ **ES Modules** support for modern JavaScript
- ✅ **Enhanced error handling** and validation
- ✅ **Client-side hydration** for interactivity
- ✅ **Performance optimizations** (compression, helmet)
- ✅ **Development and production** modes
- ✅ **Comprehensive testing** suite
- ✅ **Graceful fallbacks** for reliability

## 📦 Installation

\`\`\`bash
npm install
\`\`\`

## 🔧 Development

\`\`\`bash
npm run dev
\`\`\`

Starts the server with auto-reload using nodemon.

## 🏗️ Build

\`\`\`bash
npm run build
\`\`\`

Copies all necessary files to the public directory.

## 🚀 Production

\`\`\`bash
npm start
\`\`\`

Starts the production server.

## 🧪 Testing SSR

\`\`\`bash
npm test
\`\`\`

Runs comprehensive SSR capability tests.

## ⚠️ Important Notes

### Modern JavaScript

This template uses **ES Modules** (\`"type": "module"\`) for modern JavaScript development.

### SSR Reliability

This implementation includes **multiple fallback mechanisms** for potential issues with Ayisha.js SSR capabilities:

1. **SSR Validation**: Tests SSR capabilities before attempting to render
2. **Error Handling**: Catches and logs SSR errors, falls back to CSR
3. **Client Hydration**: Ensures interactivity even if SSR fails
4. **Development Debugging**: Detailed error messages in development mode

### Architecture

- **\`server.js\`** - Express server with SSR logic and fallbacks
- **\`client.js\`** - Client-side hydration and enhanced interactivity
- **\`test-ssr.js\`** - Comprehensive SSR capability testing
- **\`build.js\`** - Production build script
- **\`public/\`** - Static assets served by Express

### Performance Features

- **Compression middleware** for smaller payloads
- **Helmet security headers** for protection
- **Static file serving** for optimal asset delivery
- **Graceful error handling** with user-friendly fallbacks

### Development Workflow

1. **Development**: \`npm run dev\` - Auto-reload server
2. **Testing**: \`npm test\` - Verify SSR capabilities
3. **Building**: \`npm run build\` - Prepare for production
4. **Production**: \`npm start\` - Run production server

## 🔍 Troubleshooting

If SSR fails, the application will:
1. Log the error to console
2. Automatically fall back to client-side rendering
3. Maintain full functionality for users

This ensures **100% uptime** even with SSR issues.

---

**Built with ❤️ using [Ayisha.js](https://ayisha.app)**`
    }
  }
};

function getTemplate(templateName, mode = 'cdn') {
  const templates = mode === 'modern' ? modernTemplates : cdnTemplates;
  return templates[templateName];
}

function getTemplates(mode = 'cdn') {
  const templates = mode === 'modern' ? modernTemplates : cdnTemplates;
  return Object.keys(templates);
}

// Backward compatibility
const templates = cdnTemplates;

module.exports = {
  templates,
  cdnTemplates,
  modernTemplates,
  getTemplate,
  getTemplates
};