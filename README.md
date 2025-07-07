
# Ayisha.js v1.0.0

Ayisha.js is a micro JavaScript framework for building reactive, component-based user interfaces. It offers a minimalist syntax, a powerful directive system, and an extremely lightweight bundle for fast and modern web development.

## Main Features

- **Virtual DOM** and reactive rendering
- **Vue/Alpine-like directives** (`@if`, `@for`, `@model`, `@click`, etc.)
- **Native components** and async loading of external components
- **Built-in routing system** (SPA)
- **Async fetch and state management**
- **Form validation and two-way binding**
- **Smart logger** for directive debugging
- **Inline help system** for all directives

## Installation

Download the file `Ayisha-1.0.0.js` and include it in your project:

```html
<script src="Ayisha-1.0.0.js"></script>
```


## Basic Example

```html
<div id="app">
  <h1>{{ title }}</h1>
  <input @model="title">
  <button @click="count++">Increment: {{ count }}</button>
  <ul>
    <li @for="item in items">{{ item }}</li>
  </ul>
</div>
<script>
  new AyishaVDOM(document.getElementById('app'));
</script>
```


## Main Directive Syntax

- `@if="condition"` — Show the element if the condition is true
- `@for="item in items"` — Loop over arrays/objects
- `@model="variable"` — Two-way input <-> state binding
- `@click="expression"` — Handle click events
- `@fetch="'url'" @result="data"` — Async fetch and assign result
- `@component @src="comp.html"` — External components
- `@validate="rules"` — Input validation
- `@log` — Smart directive debugging


## Components

Define a component:

```js
ayisha.component('my-card', `<div class="card">{{ title }}</div>`);
```

Use a component:

```html
<component @src="my-card"></component>
```

Or load from an external file:

```html
<component @src="/components/card.html"></component>
```


## Routing (SPA)

```html
<a @link="about">About</a>
<div @page="about">About content</div>
```


## Validation

```html
<input @model="email" @validate="required,email">
```


## Logger & Debug

Add `@log` to any element to see the state of its directives:

```html
<button @click="count++" @log>Increment</button>
```

## License

Benito Massidda © 2025 devBen
