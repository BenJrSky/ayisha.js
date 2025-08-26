
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
    <link rel="stylesheet" href="./src/styles.css">
</head>
<body>
    <init>
        title = 'Welcome to {{projectName}}!';
        message = 'Your modern Ayisha.js app is ready!';
    </init>
    
    <header>
        <div>
            <img src="./src/ayisha-logo-black.png" alt="Ayisha.js Logo">
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
        <small><img src="./src/ayisha-logo-black.png" alt="Ayisha.js Logo"></small>
        <small>Made with ❤️ using <a href="https://ayisha.app" target="_blank">Ayisha.js</a></small>
    </footer>
    
    <script type="module" src="./src/main.js"></script>
</body>
</html>`,
      'src/main.js': `import { AyishaVDOM } from '../ayisha.js';

new AyishaVDOM(document.body).mount();`,
      // Rimuovere 'src/style.css': `...`
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
    <link rel="stylesheet" href="./src/styles.css">
</head>
<body>
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
    
    <script type="module" src="./src/main.js"></script>
</body>
</html>`,
      'src/main.js': `import { AyishaVDOM } from '../ayisha.js';

new AyishaVDOM(document.body).mount();`,
      // Rimuovere 'src/style.css': `...`
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
  'Todo': {
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{projectName}} - Todo App</title>
    <link rel="stylesheet" href="./src/style.css">
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
    
    <script type="module" src="./src/main.js"></script>
</body>
</html>`,
      'src/main.js': `import { AyishaVDOM } from '../ayisha.js';

new AyishaVDOM(document.body).mount();`,
      'src/style.css': `/* This will be replaced with the actual styles.css content */`,
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