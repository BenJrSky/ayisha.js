
const cdnTemplates = {
  'Basic': {
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{projectName}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
    </style>
</head>
<body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/ayisha@1.0.4/dist/ayisha-1.0.4-min.js"></script>
    <script>
        const app = new AyishaVDOM('#app');
        app.render({
            tag: 'div',
            children: [
                { tag: 'h1', children: 'Welcome to {{projectName}}!' },
                { tag: 'p', children: 'Your Ayisha.js app is ready!' }
            ]
        });
    </script>
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
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/ayisha@1.0.4/dist/ayisha-1.0.4-min.js"></script>
    <script>
        const app = new AyishaVDOM('#app');
        // SPA routing logic here
        app.render({
            tag: 'div',
            children: [
                { tag: 'nav', class: 'navbar', children: '{{projectName}} SPA' },
                { tag: 'div', class: 'container', children: 'SPA Content' }
            ]
        });
    </script>
</body>
</html>`
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
</head>
<body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
</body>
</html>`,
      'src/main.js': `// Import Ayisha from CDN for now - will be replaced with proper module later
import { AyishaVDOM } from 'https://cdn.jsdelivr.net/npm/ayisha@1.0.4/dist/ayisha-1.0.4-min.js';

const app = new AyishaVDOM('#app');

app.render({
  tag: 'div',
  children: [
    { tag: 'h1', children: 'Welcome to {{projectName}}!' },
    { tag: 'p', children: 'Your modern Ayisha.js app is ready!' }
  ]
});
`,
      'vite.config.js': `import { defineConfig } from 'vite';

export default defineConfig({
  // Basic Vite configuration
});
`
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
</head>
<body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
</body>
</html>`,
      'src/main.js': `// Import Ayisha from CDN for now
import { AyishaVDOM } from 'https://cdn.jsdelivr.net/npm/ayisha@1.0.4/dist/ayisha-1.0.4-min.js';
import './style.css';

const app = new AyishaVDOM('#app');

// Simple SPA Router
class Router {
  constructor(app) {
    this.app = app;
    this.routes = {};
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  addRoute(path, component) {
    this.routes[path] = component;
  }

  handleRoute() {
    const path = window.location.hash.slice(1) || '/';
    const component = this.routes[path] || this.routes['/'];
    this.app.render(component);
  }
}

const router = new Router(app);

router.addRoute('/', {
  tag: 'div',
  children: [
    { tag: 'nav', class: 'navbar', children: '{{projectName}} SPA' },
    { tag: 'div', class: 'container', children: 'Home Page' }
  ]
});

router.handleRoute();
`,
      'src/style.css': `body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
}

.navbar {
  background: #333;
  color: white;
  padding: 1rem;
}

.container {
  padding: 20px;
}
`,
      'vite.config.js': `import { defineConfig } from 'vite';

export default defineConfig({
  // Basic Vite configuration
});
`
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