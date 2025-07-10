
# Ayisha.js v1.0.0

Ayisha.js is a micro JavaScript framework for building reactive, component-based user interfaces. It offers a minimalist syntax, a powerful directive system, and an extremely lightweight bundle for fast and modern web development.

## Main Features

- **Virtual DOM** and reactive rendering
- **40+ directives** for every use case (`@if`, `@for`, `@model`, `@click`, `@when`, `@do`, `@go`, etc.)
- **Native components** and async loading of external components
- **Built-in SPA routing** with advanced navigation
- **Async fetch and state management**
- **Form validation and two-way binding**
- **Smart logger** for directive debugging
- **Inline help system** for all directives

## Installation

### Via CDN (recommended)

```html
<script src="https://cdn.jsdelivr.net/gh/BenJrSky/ayisha.js@main/dist/ayisha-1.0.1-min.js"></script>
```

### Local Download

Download the file and include it in your project:

```html
<script src="Ayisha-1.0.1.js"></script>
```

Or use the minified version:

```html
<script src="Ayisha-1.0.1-min.js"></script>
```

## Basic Example

```html
<div>
  <init>
    title = 'Hello Ayisha!';
    count = 0;
    items = ['Apple', 'Banana', 'Orange'];
  </init>
  
  <h1>{{ title }}</h1>
  <input @model="title">
  <button @click="count++">Increment: {{ count }}</button>
  <ul>
    <li @for="item in items">{{ item }}</li>
  </ul>
</div>

<script src="https://cdn.jsdelivr.net/gh/BenJrSky/ayisha.js@main/dist/ayisha-1.0.0-min.js"></script>
```

## Complete Directive Reference

### **Directive Execution Order (Hierarchy)**
Directives execute in this priority order:

1. **@page** / **@if** / **@show** / **@hide** — Conditional rendering
2. **@for** — Loop iteration  
3. **@fetch** / **@result** / **@source** / **@map** / **@filter** / **@reduce** — Data handling
4. **@src** — Component loading
5. **@model** / **@validate** — Form binding and validation
6. **@class** / **@style** — Styling
7. **@click** / **@input** / **@focus** / **@blur** / **@change** / **@hover** / **@set** — Events
8. **@text** — Text content
9. **@key** — Loop optimization
10. **@then** / **@finally** — Post-execution
11. **@log** / **@state** / **@attr** — Debug helpers

### **Core Directives**

| Directive | Description | Example |
|-----------|-------------|---------|
| `@if` | Show element if condition is true | `<div @if="isLoggedIn">Welcome!</div>` |
| `@show` | Show/hide element (CSS display) | `<div @show="menuOpen">Menu</div>` |
| `@hide` | Hide element if condition is true | `<div @hide="loading">Content</div>` |
| `@for` | Loop over arrays/objects | `<li @for="item in items" @key="item.id">{{item.name}}</li>` |
| `@model` | Two-way data binding | `<input @model="searchQuery">` |
| `@click` | Handle click events | `<button @click="count++">Increment</button>` |

### **Advanced Navigation Directives**

| Directive | Description | Example |
|-----------|-------------|---------|
| `@when` | Watch condition, trigger on true transition | `<span @when="_currentPage=='home'" @do="step='004'"></span>` |
| `@do` | Execute expression when @when triggers | `<span @when="!isLoggedIn" @do="showLogin=true"></span>` |
| `@go` | Navigate to page when @when triggers | `<span @when="error" @go="home"></span>` |
| `@wait` | Delay @do/@go execution (milliseconds) | `<span @when="success" @wait="2000" @go="dashboard"></span>` |

### **Data and API Directives**

| Directive | Description | Example |
|-----------|-------------|---------|
| `@fetch` | Perform HTTP request | `<div @fetch="'https://api.com/data'" @result="data"></div>` |
| `@result` | Target variable for @fetch result | `<div @fetch="apiUrl" @result="users"></div>` |
| `@source` | Data source for transformations | `<div @source="items" @map="item*2" @result="doubled"></div>` |
| `@map` | Transform array items | `<div @source="items" @map="item => item.name"></div>` |
| `@filter` | Filter array items | `<div @source="items" @filter="item.active"></div>` |
| `@reduce` | Reduce array to single value | `<div @source="items" @reduce="acc+item" @initial="0"></div>` |

### **Component and Routing**

| Directive | Description | Example |
|-----------|-------------|---------|
| `@src` | Component source URL | `<component @src="./components/card.html"></component>` |
| `@link` | SPA navigation link | `<a @link="about">About Page</a>` |
| `@page` | Show only on specific page | `<div @page="home">Home content</div>` |

### **Form and Validation**

| Directive | Description | Example |
|-----------|-------------|---------|
| `@validate` | Input validation rules | `<input @model="email" @validate="required,email">` |
| `@set` | Set state values on events | `<button @set:click="isOpen=true; count=0">Reset</button>` |

### **Event Directives**

| Directive | Description | Example |
|-----------|-------------|---------|
| `@input` | Handle input events | `<input @input="validateForm()">` |
| `@focus` | Handle focus events | `<input @focus="showHelp=true">` |
| `@blur` | Handle blur events | `<input @blur="validateField()">` |
| `@change` | Handle change events | `<select @change="updateResults()">` |
| `@hover` | Handle hover events | `<div @hover="showTooltip=true">` |

### **Styling Directives**

| Directive | Description | Example |
|-----------|-------------|---------|
| `@class` | Dynamic CSS classes | `<div @class="{active: isActive, hidden: !visible}">` |
| `@style` | Dynamic inline styles | `<div @style="{color: themeColor, fontSize: size+'px'}">` |
| `@text` | Set element text content | `<span @text="userName"></span>` |

### **Advanced Features**

| Directive | Description | Example |
|-----------|-------------|---------|
| `@switch` | Switch statement for multiple conditions | `<div @switch="status">` |
| `@case` | Case option for @switch | `<div @case="'loading'">Loading...</div>` |
| `@default` | Default case for @switch | `<div @default>Unknown status</div>` |
| `@key` | Unique key for @for optimization | `<li @for="item in items" @key="item.id">` |
| `@animate` | Apply CSS animations | `<div @animate="fadeIn">` |
| `@then` | Execute after other directives | `<div @then="console.log('rendered')">` |
| `@finally` | Execute after everything | `<div @finally="cleanup()">` |

### **Debug and Development**

| Directive | Description | Example |
|-----------|-------------|---------|
| `@log` | Show directive debug info | `<button @click="count++" @log>Debug me</button>` |
| `@state` | Show current state as JSON | `<div @state></div>` |
| `@attr` | Show state attributes list | `<div @attr></div>` |
| `no` | Disable interpolation | `<no>{{this won't be processed}}</no>` |

### **Event Variants**
Most directives support event-specific variants:
- `@fetch:click` — Fetch on click
- `@model:change` — Bind on change event  
- `@class:hover` — Apply classes on hover
- `@set:input` — Set values on input
- `@text:focus` — Update text on focus

## Practical Examples

### Navigation Flow Control
```html
<!-- Automatic redirects and guided flows -->
<span @when="!isLoggedIn" @go="login"></span>
<span @when="_currentPage=='random'" @wait="3000" @go="home"></span>
<div @when="searchResults.length > 0" @do="showMessage=true"></div>
```

### Advanced Forms
```html
<form>
  <input @model="user.email" @validate="required,email">
  <input @model="user.password" @validate="required,minLength:8">
  <button @set:click="loading=true; error=''" 
          @fetch:click="'/api/login'" 
          @result="loginResult">
    Login
  </button>
</form>
```

### Dynamic Data Processing
```html
<div @source="products" 
     @filter="item => item.price < maxPrice"
     @map="item => ({...item, discounted: item.price * 0.9})"
     @result="discountedProducts">
     
  <div @for="product in discountedProducts" @key="product.id">
    <h3>{{product.name}}</h3>
    <span class="price">{{product.discounted}}</span>
  </div>
</div>
```

### Conditional UI with Switch
```html
<div @switch="orderStatus">
  <div @case="'pending'" class="status-pending">
    <span>⏳ Processing your order...</span>
  </div>
  <div @case="'shipped'" class="status-shipped">
    <span>🚚 Order shipped!</span>
  </div>
  <div @case="'delivered'" class="status-delivered">
    <span>✅ Order delivered</span>
  </div>
  <div @default class="status-unknown">
    <span>❓ Unknown status</span>
  </div>
</div>
```

## Components

Define inline components:
```js
ayisha.component('user-card', `
  <div class="card">
    <img src="{{user.avatar}}" alt="{{user.name}}">
    <h3>{{user.name}}</h3>
    <p>{{user.email}}</p>
  </div>
`);
```

Use components:
```html
<component @src="/components/header.html"></component>
```

## SPA Routing

```html
<!-- Navigation -->
<nav>
  <a @link="home">Home</a>
  <a @link="about">About</a>
  <a @link="contact">Contact</a>
</nav>

<!-- Pages -->
<div @page="home">
  <h1>Welcome Home</h1>
</div>
<div @page="about">
  <h1>About Us</h1>
</div>
<div @page="contact">
  <component @src="/pages/contact.html"></component>
</div>
```

## Form Validation

```html
<input @model="email" @validate="required,email">
<input @model="password" @validate="required,minLength:8,password">
<input @model="age" @validate="required,min:18,max:100">
<input @model="website" @validate="url">
<input @model="phone" @validate="phone">
```

Available validation rules:
- `required` — Field is required
- `email` — Valid email format
- `minLength:n` — Minimum length
- `maxLength:n` — Maximum length  
- `min:n` — Minimum numeric value
- `max:n` — Maximum numeric value
- `password` — Strong password
- `phone` — Valid phone number
- `url` — Valid URL
- `regex:pattern` — Custom regex pattern

## API Integration

```html
<!-- Simple fetch -->
<div @fetch="'https://api.example.com/users'" @result="users">
  <div @for="user in users" @key="user.id">
    {{user.name}}
  </div>
</div>

<!-- Fetch with error handling -->
<button @click="loading=true; error=''" 
        @fetch:click="apiUrl" 
        @result="data">
  Load Data
</button>

<div @if="loading">Loading...</div>
<div @if="error">Error: {{error}}</div>
<div @if="data && !loading">
  <!-- Success content -->
</div>
```

## State Management

Initialize state:
```html
<init>
  // Application state
  user = { name: '', email: '', loggedIn: false };
  products = [];
  cart = [];
  currentPage = 'home';
  
  // UI state  
  loading = false;
  error = '';
  modalOpen = false;
  
  // Settings
  theme = 'light';
  language = 'en';
</init>
```

## Debug and Development

Add logging to any element:
```html
<button @click="count++" @log>Debug Button</button>
```

Show current state:
```html
<div @state></div>              <!-- Full state -->
<div @state="user"></div>       <!-- Specific object -->
<div @state="user.name"></div>  <!-- Specific property -->
```

## Performance Tips

1. **Use @key for lists**: Always provide unique keys for @for loops
```html
<li @for="item in items" @key="item.id">{{item.name}}</li>
```

2. **Optimize conditions**: Place most likely conditions first
```html
<div @if="isLoggedIn && user.isAdmin">Admin Panel</div>
```

3. **Batch state updates**: Use @set for multiple updates
```html
<button @set:click="loading=true; error=''; step=1">Start</button>
```

4. **Use @show vs @if**: Use @show for frequent toggles, @if for rare conditions
```html
<div @show="menuOpen">Menu</div>      <!-- Frequent toggle -->
<div @if="user.isAdmin">Admin</div>   <!-- Rare condition -->
```

## API Reference

### State Access
- Access: `{{variableName}}` or `{{object.property}}`
- Binding: `@model="variableName"`
- Updates: `@click="variableName = newValue"`

### Event Handling
- Standard: `@click="expression"`
- Variants: `@click:input`, `@fetch:hover`, `@model:change`
- Multiple: `@set:click="var1=1; var2='hello'; var3=var3+1"`

## License

MIT License © 2025 devBen

---

**Ayisha.js** - Build reactive UIs with minimal code. Fast, lightweight, and powerful.

*Created with ❤️ by [devBen](https://github.com/BenJrSky)*
