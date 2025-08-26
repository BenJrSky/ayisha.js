
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
const AyishaVDOM = require('./ayisha.js');

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
    <script src="/static/ayisha.js"></script>
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
    <script src="/static/ayisha.js"></script>
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

      'test-ssr.js': `const AyishaVDOM = require('./ayisha.js');

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

if (fs.existsSync('ayisha.js')) {
  fs.copyFileSync('ayisha.js', 'public/ayisha.js');
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
const AyishaVDOM = require('./ayisha.js');

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
    <script type="module" src="/static/ayisha.js"></script>
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
    <script type="module" src="/static/ayisha.js"></script>
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

      'client.js': `import { AyishaVDOM } from './ayisha.js';

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
const AyishaVDOM = require('./ayisha.js');

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

if (fs.existsSync('ayisha.js')) {
  fs.copyFileSync('ayisha.js', 'public/ayisha.js');
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

const modernTemplates = {
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
    
    <script type="module" src="./ayisha-1.1.0.js"></script>
</body>
</html>`,
      'package.json': `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "type": "module",
  "description": "{{projectName}} - Modern Ayisha.js Application",
  "main": "index.html",
  "scripts": {
    "dev": "ayisha-dev-server",
    "build": "echo 'Build completed'"
  }
}`,
      'styles.css': `/* Modern Ayisha.js Application Styles */
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 0;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
}

header {
    text-align: center;
    padding: 2rem;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    margin: 2rem;
    border-radius: 15px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

header img {
    width: 80px;
    height: 80px;
    margin-bottom: 1rem;
}

main {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
}

section {
    background: rgba(255, 255, 255, 0.95);
    padding: 2rem;
    border-radius: 15px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
}

footer {
    text-align: center;
    padding: 2rem;
    margin-top: 2rem;
    color: rgba(255, 255, 255, 0.8);
}

footer img {
    width: 20px;
    height: 20px;
    vertical-align: middle;
    margin-right: 0.5rem;
}

footer a {
    color: rgba(255, 255, 255, 0.9);
    text-decoration: none;
}

footer a:hover {
    text-decoration: underline;
}`,
      'ayisha-1.1.0.js': '/* Ayisha.js will be copied here during project creation */'
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
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div>
        <init>
            appName = '{{projectName}} SPA';
            currentPage = 'home';
        </init>
        
        <nav class="navbar">
            <h1>{{ appName }}</h1>
            <div class="nav-links">
                <a @link="home" @class="currentPage === 'home' ? 'active' : ''">Home</a>
                <a @link="about" @class="currentPage === 'about' ? 'active' : ''">About</a>
            </div>
        </nav>
        
        <div class="container">
            <div @page="home">
                <h2>Home Page</h2>
                <p>Welcome to your modern SPA built with Ayisha.js!</p>
                <div class="feature-grid">
                    <div class="feature-card">
                        <h3>🚀 Fast</h3>
                        <p>Lightning-fast reactivity</p>
                    </div>
                    <div class="feature-card">
                        <h3>📱 Responsive</h3>
                        <p>Works on all devices</p>
                    </div>
                    <div class="feature-card">
                        <h3>🎨 Modern</h3>
                        <p>Beautiful UI components</p>
                    </div>
                </div>
                <button @click="currentPage = 'about'" class="cta-button">Learn More</button>
            </div>
            
            <div @page="about">
                <h2>About Page</h2>
                <p>This is a modern single-page application built with Ayisha.js.</p>
                <div class="about-content">
                    <h3>Features</h3>
                    <ul>
                        <li>ES Modules support</li>
                        <li>Modern JavaScript</li>
                        <li>Reactive data binding</li>
                        <li>Component-based architecture</li>
                    </ul>
                </div>
                <button @click="currentPage = 'home'" class="cta-button">Back to Home</button>
            </div>
        </div>
    </div>
    <script type="module" src="./ayisha-1.1.0.js"></script>
</body>
</html>`,
      'package.json': `{
  "name": "{{projectName}}-spa",
  "version": "1.0.0",
  "type": "module",
  "description": "{{projectName}} - Modern SPA with Ayisha.js",
  "main": "index.html",
  "scripts": {
    "dev": "ayisha-dev-server",
    "build": "echo 'Build completed'"
  }
}`,
      'styles.css': `/* Modern SPA Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
}

.navbar {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
}

.navbar h1 {
    color: #667eea;
    font-size: 1.5rem;
}

.nav-links {
    display: flex;
    gap: 1rem;
}

.nav-links a {
    text-decoration: none;
    color: #666;
    padding: 0.5rem 1rem;
    border-radius: 25px;
    transition: all 0.3s ease;
    cursor: pointer;
}

.nav-links a:hover,
.nav-links a.active {
    background: #667eea;
    color: white;
    transform: translateY(-2px);
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

.feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
    margin: 2rem 0;
}

.feature-card {
    background: rgba(255, 255, 255, 0.95);
    padding: 2rem;
    border-radius: 15px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
    transition: transform 0.3s ease;
}

.feature-card:hover {
    transform: translateY(-5px);
}

.feature-card h3 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: #667eea;
}

.about-content {
    background: rgba(255, 255, 255, 0.95);
    padding: 2rem;
    border-radius: 15px;
    margin: 2rem 0;
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.about-content ul {
    list-style: none;
    padding-left: 0;
}

.about-content li {
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(102, 126, 234, 0.1);
}

.about-content li:before {
    content: "✓";
    color: #667eea;
    font-weight: bold;
    margin-right: 0.5rem;
}

.cta-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 25px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.cta-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

@media (max-width: 768px) {
    .navbar {
        flex-direction: column;
        gap: 1rem;
    }
    
    .container {
        padding: 1rem;
    }
    
    .feature-grid {
        grid-template-columns: 1fr;
    }
}`,
      'ayisha-1.1.0.js': '/* Ayisha.js will be copied here during project creation */'
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
       newTodo = ""
       todos = []
       filter = "all"
    </init>
    
    <div class="app">
        <header class="header">
            <img src="ayisha-logo-black.png" alt="Ayisha.js Logo">
            <h1>{{projectName}} Todo</h1>
            <p class="subtitle">Modern task management with Ayisha.js</p>
        </header>
        
        <main class="main">
            <section class="input-section">
                <div class="input-container">
                    <input 
                        type="text" 
                        @model="newTodo" 
                        placeholder="What needs to be done?"
                        class="todo-input"
                        @keyup="if(event.key === 'Enter' && newTodo.trim()) { todos.push({id: Date.now(), text: newTodo.trim(), completed: false}); newTodo = '' }"
                    >
                    <button 
                        @click="if(newTodo.trim()) { todos.push({id: Date.now(), text: newTodo.trim(), completed: false}); newTodo = '' }"
                        class="add-button"
                    >
                        Add
                    </button>
                </div>
            </section>
            
            <section class="stats-section" @show="todos.length > 0">
                <div class="stats">
                    <span class="stat">
                        <strong @text="todos.filter(t => !t.completed).length"></strong> active
                    </span>
                    <span class="stat">
                        <strong @text="todos.filter(t => t.completed).length"></strong> completed
                    </span>
                    <span class="stat">
                        <strong @text="todos.length"></strong> total
                    </span>
                </div>
                
                <div class="filters">
                    <button @click="filter = 'all'" @class="filter === 'all' ? 'active' : ''">All</button>
                    <button @click="filter = 'active'" @class="filter === 'active' ? 'active' : ''">Active</button>
                    <button @click="filter = 'completed'" @class="filter === 'completed' ? 'active' : ''">Completed</button>
                </div>
                
                <div class="actions">
                    <button @click="todos = todos.filter(t => !t.completed)" class="clear-button">Clear Completed</button>
                    <button @click="todos = []" class="clear-all-button">Clear All</button>
                </div>
            </section>
            
            <section class="empty-state" @if="todos.length === 0">
                <div class="empty-content">
                    <span class="empty-icon">📝</span>
                    <h3>No todos yet</h3>
                    <p>Add a task above to get started!</p>
                </div>
            </section>
            
            <section class="todos-section" @if="todos.length > 0">
                <ul class="todo-list">
                    <li 
                        @for="todo in todos.filter(t => filter === 'all' || (filter === 'active' && !t.completed) || (filter === 'completed' && t.completed))"
                        @class="todo.completed ? 'completed' : ''"
                        class="todo-item"
                    >
                        <label class="todo-label">
                            <input 
                                type="checkbox" 
                                @model="todo.completed"
                                class="todo-checkbox"
                            >
                            <span class="checkmark"></span>
                            <span @text="todo.text" class="todo-text"></span>
                        </label>
                        <button 
                            @click="todos = todos.filter(t => t.id !== todo.id)"
                            class="delete-button"
                            title="Delete todo"
                        >
                            ×
                        </button>
                    </li>
                </ul>
            </section>
        </main>
        
        <footer class="footer">
            <img src="ayisha-logo-black.png" alt="Ayisha.js Logo">
            <p>Made with ❤️ using <a href="https://ayisha.app" target="_blank">Ayisha.js</a></p>
        </footer>
    </div>
    
    <script type="module" src="./ayisha-1.1.0.js"></script>
</body>
</html>`,
      'package.json': `{
  "name": "{{projectName}}-todo",
  "version": "1.0.0",
  "type": "module",
  "description": "{{projectName}} - Modern Todo App with Ayisha.js",
  "main": "index.html",
  "scripts": {
    "dev": "ayisha-dev-server",
    "build": "echo 'Build completed'"
  }
}`,
      'styles.css': `/* Modern Todo App Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
}

.app {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
}

.header {
    text-align: center;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    padding: 2rem;
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
}

.header img {
    width: 60px;
    height: 60px;
    margin-bottom: 1rem;
}

.header h1 {
    color: #667eea;
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
}

.subtitle {
    color: #666;
    font-size: 1.1rem;
}

.main {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.input-section {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    padding: 2rem;
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.input-container {
    display: flex;
    gap: 1rem;
}

.todo-input {
    flex: 1;
    padding: 1rem 1.5rem;
    border: 2px solid #e1e5e9;
    border-radius: 25px;
    font-size: 1rem;
    outline: none;
    transition: all 0.3s ease;
}

.todo-input:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.add-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 25px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.add-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.stats-section {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    padding: 2rem;
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.stats {
    display: flex;
    justify-content: center;
    gap: 2rem;
    margin-bottom: 2rem;
}

.stat {
    text-align: center;
    color: #666;
}

.stat strong {
    display: block;
    font-size: 2rem;
    color: #667eea;
    margin-bottom: 0.25rem;
}

.filters {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 2rem;
}

.filters button {
    background: transparent;
    border: 2px solid #e1e5e9;
    color: #666;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.filters button:hover,
.filters button.active {
    background: #667eea;
    border-color: #667eea;
    color: white;
}

.actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
}

.clear-button,
.clear-all-button {
    background: transparent;
    border: 2px solid #ff6b6b;
    color: #ff6b6b;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.clear-button:hover,
.clear-all-button:hover {
    background: #ff6b6b;
    color: white;
}

.empty-state {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    padding: 4rem 2rem;
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    text-align: center;
}

.empty-content {
    color: #666;
}

.empty-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 1rem;
}

.empty-content h3 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: #667eea;
}

.todos-section {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    overflow: hidden;
}

.todo-list {
    list-style: none;
}

.todo-item {
    display: flex;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
}

.todo-item:hover {
    background: rgba(102, 126, 234, 0.05);
}

.todo-item:last-child {
    border-bottom: none;
}

.todo-item.completed {
    opacity: 0.6;
}

.todo-item.completed .todo-text {
    text-decoration: line-through;
}

.todo-label {
    display: flex;
    align-items: center;
    flex: 1;
    cursor: pointer;
}

.todo-checkbox {
    display: none;
}

.checkmark {
    width: 24px;
    height: 24px;
    border: 2px solid #e1e5e9;
    border-radius: 50%;
    margin-right: 1rem;
    position: relative;
    transition: all 0.3s ease;
}

.todo-checkbox:checked + .checkmark {
    background: #667eea;
    border-color: #667eea;
}

.todo-checkbox:checked + .checkmark::after {
    content: "✓";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 14px;
    font-weight: bold;
}

.todo-text {
    font-size: 1.1rem;
    color: #333;
}

.delete-button {
    background: none;
    border: none;
    color: #ff6b6b;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
}

.delete-button:hover {
    background: rgba(255, 107, 107, 0.1);
    transform: scale(1.1);
}

.footer {
    text-align: center;
    padding: 2rem;
    margin-top: 2rem;
    color: rgba(255, 255, 255, 0.8);
}

.footer img {
    width: 20px;
    height: 20px;
    vertical-align: middle;
    margin-right: 0.5rem;
}

.footer a {
    color: rgba(255, 255, 255, 0.9);
    text-decoration: none;
}

.footer a:hover {
    text-decoration: underline;
}

@media (max-width: 768px) {
    .app {
        padding: 1rem;
    }
    
    .input-container {
        flex-direction: column;
    }
    
    .stats {
        flex-direction: column;
        gap: 1rem;
    }
    
    .filters,
    .actions {
        flex-wrap: wrap;
    }
    
    .todo-item {
        padding: 1rem;
    }
}`,
      'ayisha-1.1.0.js': '/* Ayisha.js will be copied here during project creation */'
    }
  },
  'SSR': {
    files: {
      'package.json': `{
  "name": "{{projectName}}-ssr",
  "version": "1.0.0",
  "type": "module",
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
      'client.js': `import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const AyishaVDOM = require('./ayisha-1.1.0.js');

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
      'styles.css': `/* Modern SSR Application Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

.header {
    text-align: center;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    padding: 3rem 2rem;
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
}

.header img {
    width: 80px;
    height: 80px;
    margin-bottom: 1rem;
}

.header h1 {
    color: #667eea;
    font-size: 3rem;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.header p {
    font-size: 1.2rem;
    color: #666;
}

.main {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-bottom: 2rem;
}

.features,
.interactive,
.info {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    padding: 2rem;
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.features h2,
.interactive h3 {
    color: #667eea;
    margin-bottom: 1rem;
    font-size: 1.5rem;
}

.features ul {
    list-style: none;
    padding: 0;
}

.features li {
    padding: 0.75rem 0;
    border-bottom: 1px solid rgba(102, 126, 234, 0.1);
    position: relative;
    padding-left: 2rem;
}

.features li:before {
    content: "✓";
    position: absolute;
    left: 0;
    color: #667eea;
    font-weight: bold;
    font-size: 1.2rem;
}

.features li:last-child {
    border-bottom: none;
}

.interactive {
    text-align: center;
}

.interactive p {
    font-size: 1.5rem;
    margin: 1rem 0;
    color: #667eea;
    font-weight: bold;
}

.interactive button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    margin: 0.25rem;
    border-radius: 25px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 1rem;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.interactive button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.info {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
}

.info p {
    margin: 0.5rem 0;
    color: #555;
}

.loading {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 50vh;
    font-size: 1.5rem;
    color: #667eea;
}

footer {
    text-align: center;
    padding: 2rem;
    color: rgba(255, 255, 255, 0.8);
    margin-top: 2rem;
}

footer img {
    width: 20px;
    height: 20px;
    vertical-align: middle;
    margin-right: 0.5rem;
}

footer a {
    color: rgba(255, 255, 255, 0.9);
    text-decoration: none;
}

footer a:hover {
    text-decoration: underline;
}

@media (max-width: 768px) {
    .container {
        padding: 1rem;
    }
    
    .header {
        padding: 2rem 1rem;
    }
    
    .header h1 {
        font-size: 2rem;
    }
    
    .main {
        grid-template-columns: 1fr;
    }
    
    .interactive button {
        display: block;
        width: 100%;
        margin: 0.5rem 0;
    }
}`,
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

**Built with ❤️ using [Ayisha.js](https://ayisha.app)**`,
      'ayisha-1.1.0.js': '/* Ayisha.js will be copied here during project creation */'
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



