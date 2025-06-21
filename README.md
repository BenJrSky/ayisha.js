# 🚀 Ayisha.js - Advanced Reactive JavaScript Framework

Ayisha.js is a powerful, lightweight reactive JavaScript framework that combines simplicity with advanced features. It provides declarative data binding, component system, validation, animations, and much more.

## ✨ Features

### Core Features
- **Deep Reactivity** - Proxy-based reactive system with automatic dependency tracking
- **Declarative Directives** - Simple `@attribute` syntax for data binding
- **Component System** - Reusable components with props and lifecycle hooks
- **SPA Router** - Built-in single-page application routing
- **Form Validation** - Comprehensive validation system with built-in rules
- **Animation System** - CSS-based animations with triggers
- **HTTP Client** - Built-in fetch with loading/error states
- **Event System** - Advanced event handling with modifiers

### Advanced Features
- **Plugin System** - Extensible architecture
- **DevTools Integration** - Advanced debugging and inspection
- **Performance Monitoring** - Built-in performance tracking
- **Memory Management** - Automatic cleanup and leak prevention
- **Error Recovery** - Advanced error handling with retry strategies
- **SSR Support** - Server-side rendering capabilities
- **Testing Utilities** - Built-in testing helpers

## 🚀 Quick Start

### Installation
```html
<script src="ayisha.js"></script>
```

### Basic Example
```html
<div>
    <init>
        state.name = 'World';
        state.count = 0;
    </init>
    
    <p>Hello, <span @text="name"></span>!</p>
    <input @model="name" placeholder="Enter your name">
    
    <p>Count: <span @text="count"></span></p>
    <button @click="state.count++">Increment</button>
</div>
```

## 📖 Directive Reference

### Lifecycle
- `@init` - Execute code on initialization
- `@mounted` - Execute code after DOM processing

### Data Binding
- `@text="expression"` - Text content binding
- `@model="property"` - Two-way data binding
- `@class="{className: condition}"` - Dynamic class binding
- `@style="{property: value}"` - Dynamic style binding

### Conditional Rendering
- `@if="condition"` - Conditional rendering (DOM insertion/removal)
- `@show="condition"` - Conditional visibility (display: none)
- `@hide="condition"` - Conditional hiding

### Lists and Iteration
- `@for="item in list"` - List rendering
- `@key="expression"` - Unique keys for list items

### HTTP and Data Fetching
- `@fetch="url"` - HTTP requests
- `@method="GET|POST|PUT|DELETE"` - HTTP method
- `@body="data"` - Request body
- `@auth="Bearer=token"` - Authentication
- `@result="key"` - Result storage key

### Form Validation
- `@validate="rules"` - Field validation
- Built-in rules: `required`, `email`, `min:n`, `max:n`, `number`

### Events
- `@click="handler"` - Click events
- `@submit="handler"` - Form submission
- `@input="handler"` - Input events
- Event modifiers: `.prevent`, `.stop`, `.once`, `.enter`, `.debounce`, `.throttle`

### Components
- `@component="name"` - Component rendering
- `prop-name="value"` - Component props

### Animations
- `@animate="name"` - Animation binding
- `@trigger="event"` - Animation trigger

### Router
- `@page="base"` - Page container
- `@link="path"` - Navigation links

## 🎛️ Advanced Usage

### Creating Plugins
```javascript
const myPlugin = ayisha.createPlugin('my-plugin', {
    state: {
        pluginData: 'Hello from plugin'
    },
    methods: {
        myMethod() {
            console.log('Plugin method called');
        }
    },
    directives: {
        'my-directive': function(el, value) {
            el.textContent = `Custom: ${value}`;
        }
    },
    setup(ayisha, options) {
        // Plugin initialization
    }
});

ayisha.use(myPlugin);
```

### Component System
```javascript
ayisha.component('user-card', {
    template: `
        <div class="user-card">
            <h3>{{name}}</h3>
            <p>{{email}}</p>
        </div>
    `,
    mounted(context) {
        console.log('Component mounted with props:', context);
    }
});
```

### Form Validation
```javascript
// Custom validator
ayisha.validate('phone', (value) => ({
    valid: /^\d{10}$/.test(value),
    message: 'Please enter a valid 10-digit phone number'
}));
```

### Store Management
```javascript
const store = ayisha.createStore({
    user: null,
    posts: []
});

store.registerMutation('SET_USER', (state, user) => {
    state.user = user;
});

store.registerAction('fetchUser', async ({ commit }, userId) => {
    const user = await fetch(`/api/users/${userId}`).then(r => r.json());
    commit('SET_USER', user);
});
```

### Router with Guards
```javascript
const router = ayisha.createRouter([
    { path: '/home', component: '<h1>Home</h1>' },
    { path: '/profile', component: '<h1>Profile</h1>', meta: { requiresAuth: true } }
]);

router.beforeEach((to, from) => {
    if (to.meta.requiresAuth && !store.state.user) {
        return '/login'; // Redirect to login
    }
});
```

## 🛠️ Configuration

```javascript
ayisha.configure({
    devMode: true,
    performance: true,
    strict: true,
    errorReporting: {
        endpoint: '/api/errors'
    }
});
```

## 🧪 Testing

```javascript
const { instance, container, cleanup } = ayisha.createTestInstance(`
    <div>
        <span @text="message"></span>
        <button @click="state.count++">Click</button>
    </div>
`);

instance.setState({ message: 'Hello', count: 0 });
const button = container.querySelector('button');
button.click();

console.log(instance.getState().count); // 1
cleanup();
```

## 🐛 DevTools

Access developer tools via:
```javascript
// Enable dev mode
ayisha.enableDevMode();

// Access devtools
window.__AYISHA_DEVTOOLS__.inspect('button');
window.__AYISHA_DEVTOOLS__.trace('count');
```

## 📈 Performance

```javascript
// Enable performance monitoring
ayisha.enablePerformanceMonitoring();

// Get performance report
ayisha._performanceMonitor.report();
```

## 🔧 API Reference

### Core Methods
- `ayisha.setState(newState)` - Update application state
- `ayisha.getState()` - Get current state
- `ayisha.navigate(path)` - Navigate to route
- `ayisha.destroy()` - Cleanup framework instance

### Plugin Methods
- `ayisha.use(plugin, options)` - Install plugin
- `ayisha.createPlugin(name, definition)` - Create plugin

### Component Methods
- `ayisha.component(name, definition)` - Register component
- `ayisha.createComponentInstance(name, element, props)` - Create component instance

### Validation Methods
- `ayisha.validate(name, validator)` - Register validator
- `ayisha.createForm(schema)` - Create reactive form

### Advanced Methods
- `ayisha.configure(config)` - Configure framework
- `ayisha.enableDevMode()` - Enable development tools
- `ayisha.enablePerformanceMonitoring()` - Enable performance tracking
- `ayisha.onError(handler)` - Set error handler

## 🎯 Examples

See `examples.html` for interactive examples demonstrating all framework features.

## 📄 License

MIT License

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

Built with ❤️ for modern web development