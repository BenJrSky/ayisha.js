# Ayisha.js

A modern, ultra-lightweight, reactive Virtual DOM engine for the web. Ayisha.js is designed to be a drop-in alternative to heavy frameworks like Vue, React, Alpine, or Svelte, offering a declarative, expressive, and extensible approach to building dynamic web interfaces with zero build step and instant learning curve.

---

## Philosophy

- **Simplicity First:** Write HTML as you think it, enhance with powerful directives. No build tools, no transpilers, no complex state management.
- **Direct Manipulation:** All reactivity and logic is expressed directly in the DOM via attributes and mustache expressions.
- **Zero Boilerplate:** No class components, no hooks, no JSX, no virtual files. Just HTML, JavaScript, and Ayisha's magic.
- **Progressive Enhancement:** Use as much or as little as you want. Works with any backend, any static site, or as a micro-frontend.
- **Performance:** Fast, minimal memory usage, and no virtual DOM diffing overhead. Only the real DOM is updated, only when needed.

---

## Installation & Usage

You can use Ayisha.js in your project in several ways:

### 1. Direct Download

Scarica `ayisha-virtual.js` dal repository e includilo nel tuo progetto:

```html
<script src="ayisha-virtual.js"></script>
```

### 2. GitHub Pages CDN

Dopo aver pubblicato una release, puoi includere direttamente lo script dal tuo GitHub Pages:

```html
<script src="https://<tuo-username>.github.io/<repo>/ayisha-virtual.js"></script>
```

### 3. jsDelivr CDN (consigliato per produzione)

Dopo aver creato una release/tag su GitHub:

```html
<script src="https://cdn.jsdelivr.net/gh/<tuo-username>/<repo>@<tag>/ayisha-virtual.js"></script>
```

Sostituisci `<tuo-username>`, `<repo>`, e `<tag>` con i tuoi dati.

---

## Quick Start

```html
<script src="ayisha-virtual.js"></script>
<div>
  <init>
    state.name = 'World';
    state.count = 0;
  </init>
  <p>Hello, <span @text="name"></span>!</p>
  <input @model="name" placeholder="Enter your name">
  <button @click="count++">Increment</button>
  <span>Count: {{count}}</span>
</div>
```

> **Note:** In all expressions and directives, you can omit the `state.` prefix and refer directly to your state properties (e.g. `name` instead of `state.name`). Both are valid and equivalent.

---

## Core Concepts & Syntax Shortcuts

- **State:** All state is stored in `state` and is reactive. You can reference state properties directly (e.g. `name`) or with `state.` (e.g. `state.name`).
- **Directives:** Special attributes (e.g. `@if`, `@for`, `@click`) that control rendering, logic, and events.
- **Sub-directives:** Event-specific or context-specific variants (e.g. `@text:hover`, `@class:focus`).
- **Components:** Use `<component @src="file.html"></component>` to load and render HTML fragments as components. You can also use inline components with `@component`.
- **Reactivity:** Any change to `state` triggers a re-render. Watchers and computed logic are supported.

**Example: Both syntaxes are valid**
```html
<span @text="name"></span>
<span @text="state.name"></span>
```

---

## Components

Ayisha.js supports both inline and dynamic components, with full reactivity and state sharing.

### Inline Component
```html
<div @component="myComponent"></div>
<init>
  state.message = 'Hello from parent!';
  state.myComponent = `<p @text="message"></p>`;
</init>
```

### Dynamic Component (HTML Fragment)
```html
<component @src="components/home.html"></component>
```

### Passing State/Props to Components
```html
<component @src="components/posts.html" :userId="userId"></component>
<init>
  state.userId = 42;
</init>
```
Nel file `components/posts.html` puoi accedere a `userId` direttamente.

### Nested Components
```html
<component @src="components/nav.html"></component>
<component @src="components/footer.html"></component>
```

---

## @watch: Watchers & Side Effects

La direttiva `@watch` permette di reagire a cambiamenti di stato o espressioni, eseguendo codice, fetch, o altre azioni.

### Esempio base
```html
<div @watch="userId">
  <p>User ID changed: {{userId}}</p>
</div>
```

### Watcher con side effect
```html
<init>
  state.userId = 1;
  function logChange() { console.log('User changed:', userId); }
</init>
<button @click="userId++">Next</button>
<div @watch="userId" @result="logChange()"></div>
```

### Watcher multiplo (corretto)
```html
<div @watch="userId, filter">
  <p>Either userId or filter changed!</p>
</div>
```

> **Nota:** La sintassi con array (`@watch="[userId, filter]"`) **non è supportata**. Se vuoi osservare più variabili, separale con una virgola come nell'esempio sopra.

### Watch + Fetch combinato
```html
<div @fetch="`/api/user/${userId}`" @result="user" @watch="userId">
  <span @if="user" @text="user.name"></span>
</div>
```

---

## Advanced Examples

### 1. Todo List con Validazione, Animazioni e Sub-Directives
```html
<div>
  <init>
    state.todos = [];
    state.newTodo = '';
    state.error = '';
  </init>
  <input @model="newTodo" @validate="required,minLength:3" placeholder="Add todo" @focus="error=''">
  <button @click="addTodo()" @animate="pulse">Add</button>
  <ul>
    <li @for="todo, i in todos" @key="i" @class:click="{done: todo.done}" @click="todo.done = !todo.done">
      <span @text="todo.text"></span>
      <button @click="todos.splice(i,1)">Remove</button>
    </li>
  </ul>
  <p @if="error" @class="{red:true}">{{error}}</p>
  <init>
    function addTodo() {
      if (newTodo.length < 3) { error = 'Min 3 chars'; return; }
      todos.push({text: newTodo, done: false});
      newTodo = '';
      error = '';
    }
  </init>
</div>
```

### 2. Fetch, Routing, Componenti Dinamici e Error Handling
```html
<nav>
  <a @link="home">Home</a>
  <a @link="posts">Posts</a>
</nav>
<component @src="components/{{page}}.html"></component>

<!-- components/posts.html -->
<div>
  <div @fetch="'https://jsonplaceholder.typicode.com/posts'" @result="posts">
    <ul>
      <li @for="post in posts" @key="post.id">
        <h3 @text="post.title"></h3>
        <p @text="post.body"></p>
      </li>
    </ul>
    <p @if="!posts">Loading...</p>
  </div>
</div>
```

### 3. Functional Data, Animazioni, Sub-Directives
```html
<div>
  <init>
    state.numbers = [1,2,3,4,5];
    state.filterEven = false;
  </init>
  <button @click="filterEven = !filterEven">Toggle Even</button>
  <ul>
    <li @for="n in filterEven ? numbers.filter(x=>x%2===0) : numbers" @animate:click="bounce" @click="n++" @text="n"></li>
  </ul>
</div>
```

---

## Real-World & Advanced Examples

### 1. Annidamento di direttive e componenti
```html
<div>
  <init>
    state.user = { id: 1, name: 'Alice', posts: [
      { id: 1, title: 'Hello', content: 'First post!' },
      { id: 2, title: 'Ayisha.js', content: 'Reactive and simple.' }
    ] };
    state.selectedPost = null;
  </init>
  <h2 @text="user.name"></h2>
  <ul>
    <li @for="post in user.posts" @key="post.id">
      <b @text="post.title"></b>
      <button @click="selectedPost = post">Show</button>
    </li>
  </ul>
  <div @if="selectedPost">
    <h3 @text="selectedPost.title"></h3>
    <p @text="selectedPost.content"></p>
    <button @click="selectedPost = null">Close</button>
  </div>
</div>
```

### 2. Esempio misto: @watch, @click, @fetch, annidati
```html
<div>
  <init>
    state.userId = 1;
    state.user = null;
    state.log = [];
  </init>
  <button @click="userId++">Next User</button>
  <button @click="userId = Math.max(1, userId-1)">Prev User</button>
  <div @fetch="`https://jsonplaceholder.typicode.com/users/${userId}`" @result="user" @watch="userId">
    <h3 @if="user" @text="user.name"></h3>
    <p @if="user" @text="user.email"></p>
    <p @if="!user">Loading...</p>
  </div>
  <div @watch="userId: log.push('UserId changed to ' + userId)"></div>
  <h4>Log:</h4>
  <ul>
    <li @for="entry in log" @text="entry"></li>
  </ul>
</div>
```

### 3. Annidamento di fetch, for, if, e sub-direttive
```html
<div>
  <init>
    state.filter = '';
  </init>
  <input @model="filter" placeholder="Filter posts">
  <div @fetch="'https://jsonplaceholder.typicode.com/posts'" @result="posts">
    <ul>
      <li @for="post in posts.filter(p => !filter || p.title.includes(filter))" @key="post.id">
        <b @text="post.title"></b>
        <button @click="post.show = !post.show">Toggle</button>
        <div @if="post.show">
          <p @text="post.body"></p>
        </div>
      </li>
    </ul>
  </div>
</div>
```

### 4. Componenti dinamici annidati e passaggio di stato
```html
<component @src="components/user.html" :userId="userId"></component>
<init>
  state.userId = 1;
</init>
<!-- components/user.html -->
<div>
  <div @fetch="`https://jsonplaceholder.typicode.com/users/${userId}`" @result="user">
    <h2 @if="user" @text="user.name"></h2>
    <component @src="components/posts.html" :userId="userId"></component>
  </div>
</div>
<!-- components/posts.html -->
<div>
  <div @fetch="`https://jsonplaceholder.typicode.com/posts?userId=${userId}`" @result="posts">
    <ul>
      <li @for="post in posts" @key="post.id">
        <b @text="post.title"></b>
      </li>
    </ul>
  </div>
</div>
```

### 5. Validazione, animazioni, sub-direttive e gestione errori
```html
<form>
  <input @model="email" @validate="required,email" placeholder="Email" @focus="error=''">
  <input @model="password" @validate="required,minLength:6" type="password" placeholder="Password">
  <button @click="submit()" @animate="bounce">Login</button>
  <p @if="error" @class="{red:true}">{{error}}</p>
  <init>
    state.error = '';
    function submit() {
      if (!email || !password) {
        error = 'Please fill all fields.';
      } else {
        error = '';
        // login logic
      }
    }
  </init>
</form>
```

### 6. Esempio completo: dashboard con tutto
```html
<div>
  <init>
    state.page = 'home';
    state.userId = 1;
    state.log = [];
  </init>
  <nav>
    <a @click="page='home'">Home</a>
    <a @click="page='users'">Users</a>
    <a @click="page='posts'">Posts</a>
  </nav>
  <div @switch="page">
    <div @case="'home'">
      <h2>Welcome!</h2>
    </div>
    <div @case="'users'">
      <button @click="userId++">Next User</button>
      <div @fetch="`https://jsonplaceholder.typicode.com/users/${userId}`" @result="user" @watch="userId">
        <h3 @if="user" @text="user.name"></h3>
        <p @if="user" @text="user.email"></p>
      </div>
    </div>
    <div @case="'posts'">
      <component @src="components/posts.html" :userId="userId"></component>
    </div>
    <div @default>
      <p>Page not found</p>
    </div>
  </div>
  <div @watch="page: log.push('Page changed to ' + page)"></div>
  <h4>Log:</h4>
  <ul>
    <li @for="entry in log" @text="entry"></li>
  </ul>
</div>
```

---

## Best Practices & Shortcuts

| Sintassi         | Descrizione                                    |
|------------------|------------------------------------------------|
| `@text="foo"`    | Equivale a `@text="state.foo"`                |
| `{{foo}}`        | Equivale a `{{state.foo}}`                     |
| `@model="bar"`  | Two-way binding su `state.bar`                  |
| `@watch="foo"`  | Esegue azioni quando `foo` cambia               |
| `@component`     | Inline component con stringa HTML               |
| `@src`           | Carica componente da file HTML                  |
| `@fetch`         | Fetch asincrono, risultato in `@result`         |
| Sub-directives   | Eventi: `@text:click`, `@class:hover`, ecc.     |

---

## Directives Reference

### Main Directives

| Directive         | Description                                                                                 |
|-------------------|---------------------------------------------------------------------------------------------|
| `@if`            | Conditional rendering. E.g. `<div @if="state.show">Visible</div>`                          |
| `@show`          | Show/hide via CSS. E.g. `<div @show="state.visible">Show if true</div>`                    |
| `@hide`          | Hide via CSS. E.g. `<div @hide="state.hidden">Hide if true</div>`                          |
| `@for`           | List rendering. E.g. `<li @for="item in items">{{item}}</li>`                              |
| `@model`         | Two-way binding for inputs. E.g. `<input @model="name">`                                   |
| `@click`         | Click event. E.g. `<button @click="state.count++">Inc</button>`                            |
| `@fetch`         | Fetch data from URL. E.g. `<div @fetch="'url'" @result="data"></div>`                    |
| `@result`        | Where to store fetch result.                                                                |
| `@watch`         | Watch a property and run code or refetch.                                                   |
| `@text`          | Set text content. E.g. `<span @text="name"></span>`                                        |
| `@class`         | Dynamic classes. E.g. `<div @class="{red: state.error}"></div>`                            |
| `@style`         | Dynamic styles. E.g. `<div @style="{color:'red'}"></div>`                                  |
| `@validate`      | Input validation. E.g. `<input @validate="required,minLength:3">`                          |
| `@link`          | SPA navigation. E.g. `<a @link="page">Go</a>`                                              |
| `@page`          | Show only on specific page. E.g. `<div @page="home"></div>`                                |
| `@component`     | Inline component. E.g. `<div @component="myComp"></div>`                                   |
| `@src`           | Component source. E.g. `<component @src="file.html"></component>`                          |
| `@set`           | Set state on event. E.g. `<button @set:click="foo=1"></button>`                            |
| `@key`           | Unique key for list items.                                                                  |
| `@switch`        | Switch/case rendering.                                                                      |
| `@case`          | Case for switch.                                                                            |
| `@default`       | Default for switch.                                                                         |
| `@source`        | Functional data source for map/filter/reduce.                                               |
| `@map`           | Map function.                                                                               |
| `@filter`        | Filter function.                                                                            |
| `@reduce`        | Reduce function.                                                                            |
| `@initial`       | Initial value for reduce.                                                                   |
| `@animate`       | Add animation class.                                                                        |
| `@focus`         | Focus event. E.g. `<input @focus="doSomething()">`                                         |

### Sub-Directives

| Sub-Directive         | Description/Example                                                        |
|----------------------|-----------------------------------------------------------------------------|
| `@text:hover`        | `<div @text:hover="'Hovered!'"></div>`                                    |
| `@text:click`        | `<div @text:click="'Clicked!'"></div>`                                    |
| `@class:focus`       | `<input @class:focus="{red:true}">`                                       |
| `@class:hover`       | `<div @class:hover="{red: state.hover}"></div>`                           |
| `@fetch:click`       | `<button @fetch:click="'url'" @result="data"></button>`                 |
| `@model:input`       | `<input @model:input="name">`                                             |
| `@set:change`        | `<input @set:change="foo='bar'">`                                         |
| ...and many more!    | See code for full list.                                                     |

---

## Advanced Features

- **Dynamic Components:** Load HTML fragments as components, with full reactivity and nested directives.
- **SPA Routing:** Use `@link` and `@page` for client-side navigation.
- **Validation:** Built-in validation for forms, extensible with custom rules.
- **Functional Data:** Use `@source`, `@map`, `@filter`, `@reduce` for functional programming on arrays.
- **Error Handling:** All errors and warnings are shown in the UI, with clear messages and context.
- **Logging:** Enable logging for directives and sub-directives for easier debugging.

---

## Use Cases

- **Replace Alpine.js, Vue, React, Svelte** for small/medium projects, static sites, admin panels, dashboards, or anywhere you want reactivity without a build step.
- **Progressive enhancement** for legacy or server-rendered apps.
- **Rapid prototyping** and design systems.
- **Educational projects** to learn reactivity and declarative UI.

---

## Comparison with Other Frameworks

| Feature         | Ayisha.js | Vue | React | Alpine | Svelte |
|-----------------|-----------|-----|-------|--------|--------|
| No build step   | ✅        | ❌  | ❌    | ✅     | ❌     |
| File size       | <10KB     | 30KB+| 40KB+| 10KB   | 15KB+  |
| Directives      | ✅        | ✅  | ❌    | ✅     | ❌     |
| SPA Routing     | ✅        | ✅  | ✅    | ❌     | ✅     |
| Components      | ✅        | ✅  | ✅    | ❌     | ✅     |
| Two-way binding | ✅        | ✅  | ❌    | ✅     | ✅     |
| Error banners   | ✅        | ❌  | ❌    | ❌     | ❌     |
| No dependencies | ✅        | ❌  | ❌    | ✅     | ❌     |

---

## License

MIT License. Use freely, contribute, and make the web simpler!

---

## Author

Created by devBen. Contributions welcome!