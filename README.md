# Ayisha.js v1.0.0

Ayisha.js è un micro-framework JavaScript per la creazione di interfacce utente reattive e component-based, ispirato a Vue.js, Alpine.js e React, ma con una sintassi minimalista e un bundle estremamente leggero. 

## Caratteristiche principali

- **Virtual DOM** e rendering reattivo
- **Direttive** simili a Vue/Alpine (`@if`, `@for`, `@model`, `@click`, ecc.)
- **Componenti** nativi e caricamento asincrono di componenti esterni
- **Sistema di routing** integrato (SPA)
- **Gestione fetch e stato asincrono**
- **Validazione form e binding bidirezionale**
- **Logger intelligente** per debug delle direttive
- **Sistema di help inline** per tutte le direttive

## Installazione

Scarica il file `Ayisha-1.0.0.js` e includilo nel tuo progetto:

```html
<script src="Ayisha-1.0.0.js"></script>
```

## Esempio base

```html
<div id="app">
  <h1>{{ title }}</h1>
  <input @model="title">
  <button @click="count++">Incrementa: {{ count }}</button>
  <ul>
    <li @for="item in items">{{ item }}</li>
  </ul>
</div>
<script>
  new AyishaVDOM(document.getElementById('app'));
</script>
```

## Sintassi delle direttive principali

- `@if="condizione"` — Mostra l'elemento se la condizione è vera
- `@for="item in items"` — Cicla su array/oggetti
- `@model="variabile"` — Binding bidirezionale input <-> stato
- `@click="espressione"` — Gestione eventi click
- `@fetch="'url'" @result="data"` — Fetch asincrono e assegnazione risultato
- `@component @src="comp.html"` — Componenti esterni
- `@validate="regole"` — Validazione input
- `@log` — Debug intelligente delle direttive

## Componenti

Definisci un componente:

```js
ayisha.component('my-card', `<div class="card">{{ title }}</div>`);
```

Usa un componente:

```html
<component @src="my-card"></component>
```

Oppure carica da file esterno:

```html
<component @src="/components/card.html"></component>
```

## Routing (SPA)

```html
<a @link="about">About</a>
<div @page="about">Contenuto About</div>
```

## Validazione

```html
<input @model="email" @validate="required,email">
```

## Logger e debug

Aggiungi `@log` a qualsiasi elemento per vedere lo stato delle direttive:

```html
<button @click="count++" @log>Incrementa</button>
```

## Licenza

Benito Massidda © 2025 devBen
