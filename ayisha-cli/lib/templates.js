
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
    <div class="container">
        <init>
            title = 'Welcome to {{projectName}}!';
            message = 'Your Ayisha.js app is ready!';
        </init>
        
        <h1>{{ title }}</h1>
        <p>{{ message }}</p>
    </div>
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
    <link rel="stylesheet" href="./src/style.css">
</head>
<body>
    <div id="app">
        <h1>{{ title }}</h1>
        <p>{{ message }}</p>
    </div>
    <script type="module" src="./src/main.js"></script>
</body>
</html>`,
      'src/main.js': `import { AyishaVDOM } from '../ayisha.js';

const app = new AyishaVDOM(document.getElementById('app'), {
  data: {
    title: 'Welcome to {{projectName}}!',
    message: 'Your modern Ayisha.js app is ready!'
  }
});

app.render();`,
      'src/style.css': `body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 20px;
}

.container {
  max-width: 800px;
  margin: 0 auto;
}
`,
      'vite.config.js': `import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      'ayisha': './ayisha.js'
    }
  }
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
    <link rel="stylesheet" href="./src/style.css">
</head>
<body>
    <div id="app">
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
    <script type="module" src="./src/main.js"></script>
</body>
</html>`,
      'src/main.js': `import { AyishaVDOM } from '../ayisha.js';

const app = new AyishaVDOM(document.getElementById('app'), {
  data: {
    appName: '{{projectName}} SPA',
    currentPage: 'home'
  }
});

app.render();`,
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
  resolve: {
    alias: {
      'ayisha': './ayisha.js'
    }
  }
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