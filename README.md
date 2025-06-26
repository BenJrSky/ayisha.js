# AyishaVDOM.js

A modern, ultra-lightweight, reactive Virtual DOM engine for the web. AyishaVDOM is designed to be a drop-in alternative to heavy frameworks like Vue, React, Alpine, or Svelte, offering a declarative, expressive, and extensible approach to building dynamic web interfaces with zero build step and instant learning curve.

---

## Philosophy

- **Simplicity First:** Write HTML as you think it, enhance with powerful directives. No build tools, no transpilers, no complex state management.
- **Direct Manipulation:** All reactivity and logic is expressed directly in the DOM via attributes and mustache expressions.
- **Zero Boilerplate:** No class components, no hooks, no JSX, no virtual files. Just HTML, JavaScript, and Ayisha's magic.
- **Progressive Enhancement:** Use as much or as little as you want. Works with any backend, any static site, or as a micro-frontend.
- **Performance:** Fast, minimal memory usage, and no virtual DOM diffing overhead. Only the real DOM is updated, only when needed.

---

## Why AyishaVDOM?

- **No build step:** Just include the script and go. Perfect for rapid prototyping, static sites, or full SPAs.
- **Tiny footprint:** Under 10KB minified, no dependencies.
- **Powerful reactivity:** State is reactive by default. Two-way binding, computed expressions, and watchers are built-in.
- **Component system:** Use HTML fragments as components, load them dynamically, or inline.
- **Directives and sub-directives:** Express logic, events, and data flow directly in your markup.
- **Routing, validation, fetch, and more:** All the essentials for modern web apps, with zero config.
- **Debuggable:** Errors and warnings are clear, contextual, and visible in the UI.

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
  <button @click="state.count++">Increment</button>
  <span>Count: {{count}}</span>
</div>
```

---

## Core Concepts

- **State:** All state is stored in `state` and is reactive. Use `@model` for two-way binding.
- **Directives:** Special attributes (e.g. `@if`, `@for`, `@click`) that control rendering, logic, and events.
- **Sub-directives:** Event-specific or context-specific variants (e.g. `@text:hover`, `@class:focus`).
- **Components:** Use `<component @src="file.html"></component>` to load and render HTML fragments as components.
- **Reactivity:** Any change to `state` triggers a re-render. Watchers and computed logic are supported.

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

| Feature         | AyishaVDOM | Vue | React | Alpine | Svelte |
|-----------------|------------|-----|-------|--------|--------|
| No build step   | ✅         | ❌  | ❌    | ✅     | ❌     |
| File size       | <10KB      | 30KB+| 40KB+| 10KB   | 15KB+  |
| Directives      | ✅         | ✅  | ❌    | ✅     | ❌     |
| SPA Routing     | ✅         | ✅  | ✅    | ❌     | ✅     |
| Components      | ✅         | ✅  | ✅    | ❌     | ✅     |
| Two-way binding | ✅         | ✅  | ❌    | ✅     | ✅     |
| Error banners   | ✅         | ❌  | ❌    | ❌     | ❌     |
| No dependencies | ✅         | ❌  | ❌    | ✅     | ❌     |

---

## License

MIT License. Use freely, contribute, and make the web simpler!

---

## Author

Created by devBen. Contributions welcome!