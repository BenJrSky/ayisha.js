// Nuovo file ayisha-virtual.js: struttura base virtual DOM con direttive @ e componenti annidati

class AyishaVDOM {
  constructor(root = document) {
    this.root = root;
    this.state = {};
    this.watchers = {};
    this.components = {};
    this._vdom = null;
    window.ayisha = this; // Rende ayisha globale per i blocchi <init>
  }

  // Parsing: crea virtual dom (ogni nodo: {tag, attrs, children, directives, ...})
  parse(node) {
    if (node.nodeType === 3) return { type: 'text', text: node.textContent };
    if (node.nodeType !== 1) return null;
    // Ignora <script> e <style> nel virtual dom
    const tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style') return null;
    const vNode = {
      tag,
      attrs: {},
      directives: {},
      children: [],
      key: node.getAttribute && node.getAttribute('key')
    };
    Array.from(node.attributes).forEach(attr => {
      if (attr.name.startsWith('@')) {
        vNode.directives[attr.name] = attr.value;
      } else {
        vNode.attrs[attr.name] = attr.value;
      }
    });
    vNode.children = Array.from(node.childNodes).map(child => this.parse(child)).filter(Boolean);
    return vNode;
  }

  // Esegui i blocchi <init> e popola lo stato
  _runInitBlocks() {
    const inits = this.root.querySelectorAll('init');
    inits.forEach(init => {
      try {
        // Esegui il codice JS nel contesto di this.state
        new Function('state', init.textContent)(this.state);
      } catch (e) {
        console.error('Init block error:', e);
      }
    });
  }

  // Mount: crea virtual dom dalla root
  mount() {
    this._runInitBlocks();
    this._vdom = this.parse(this.root);
    this._makeReactive();
    this.render();
  }

  // 1. Supporto componenti custom
  component(name, html) {
    this.components[name] = html;
  }

  // 2. Supporto watcher base (solo per @watch)
  addWatcher(prop, fn) {
    if (!this.watchers[prop]) this.watchers[prop] = [];
    this.watchers[prop].push(fn);
  }

  // 3. Estendi _makeReactive per watcher
  _makeReactive() {
    const self = this;
    this.state = new Proxy(this.state, {
      set(target, prop, value) {
        target[prop] = value;
        if (self.watchers[prop]) self.watchers[prop].forEach(fn => fn(value));
        self.render();
        return true;
      }
    });
  }

  // Render: genera DOM reale dal virtual dom, senza direttive
  render() {
    const real = this._renderVNode(this._vdom, this.state);
    this.root.innerHTML = '';
    if (real) this.root.appendChild(real);
  }

  // Ricorsivo: genera DOM reale da un vNode
  _renderVNode(vNode, ctx) {
    if (!vNode) return null;
    if (vNode.type === 'text') {
      return document.createTextNode(this._evalText(vNode.text, ctx));
    }
    // Gestione direttive principali
    if (vNode.directives['@if']) {
      if (!this._evalExpr(vNode.directives['@if'], ctx)) return null;
    }
    // Gestione @show / @hide (punto 2: Conditional Rendering)
    if (vNode.directives['@show']) {
      if (!this._evalExpr(vNode.directives['@show'], ctx)) return null;
    }
    if (vNode.directives['@hide']) {
      if (this._evalExpr(vNode.directives['@hide'], ctx)) return null;
    }
    // Gestione @for (supporta anche @key)
    if (vNode.directives['@for']) {
      const [item, arrExpr] = vNode.directives['@for'].split(' in ').map(s => s.trim());
      const arr = this._evalExpr(arrExpr, ctx) || [];
      const frag = document.createDocumentFragment();
      arr.forEach((val, idx) => {
        const newCtx = { ...ctx, [item]: val };
        vNode.children.forEach(child => {
          const n = this._renderVNode(child, newCtx);
          if (n) frag.appendChild(n);
        });
      });
      return frag;
    }
    // Crea nodo reale senza direttive
    const el = document.createElement(vNode.tag);
    Object.entries(vNode.attrs).forEach(([k, v]) => el.setAttribute(k, v));
    // Gestione @text (su qualsiasi elemento)
    if (vNode.directives['@text']) {
      el.textContent = this._evalExpr(vNode.directives['@text'], ctx);
    } else {
      vNode.children.forEach(child => {
        const n = this._renderVNode(child, ctx);
        if (n) el.appendChild(n);
      });
    }
    // Gestione @model (two-way binding base, input/select/checkbox/radio)
    if (vNode.directives['@model']) {
      const modelKey = vNode.directives['@model'];
      if (el.tagName === 'SELECT') {
        el.value = String(this._evalExpr(modelKey, ctx));
        el.addEventListener('change', e => {
          this.state[modelKey] = e.target.value;
        });
        // Aggiorna selected sulle option
        Array.from(el.options).forEach(opt => {
          opt.selected = (opt.value === String(this.state[modelKey]));
        });
      } else if (el.type === 'checkbox') {
        el.checked = !!this._evalExpr(modelKey, ctx);
        el.addEventListener('change', e => {
          this.state[modelKey] = e.target.checked;
        });
      } else if (el.type === 'radio') {
        el.checked = this._evalExpr(modelKey, ctx) == el.value;
        el.addEventListener('change', e => {
          if (e.target.checked) {
            this.state[modelKey] = el.value;
          }
        });
      } else {
        el.value = this._evalExpr(modelKey, ctx);
        el.addEventListener('input', e => {
          this.state[modelKey] = e.target.value;
        });
      }
    }
    // Gestione @show / @hide
    if (vNode.directives['@show']) {
      if (!this._evalExpr(vNode.directives['@show'], ctx)) el.style.display = 'none';
    }
    if (vNode.directives['@hide']) {
      if (this._evalExpr(vNode.directives['@hide'], ctx)) el.style.display = 'none';
    }
    // Gestione @class
    if (vNode.directives['@class']) {
      const classObj = this._evalExpr(vNode.directives['@class'], ctx);
      if (classObj && typeof classObj === 'object') {
        Object.entries(classObj).forEach(([cls, val]) => {
          if (val) el.classList.add(cls); else el.classList.remove(cls);
        });
      }
    }
    // Gestione @style
    if (vNode.directives['@style']) {
      const styleObj = this._evalExpr(vNode.directives['@style'], ctx);
      if (styleObj && typeof styleObj === 'object') {
        Object.entries(styleObj).forEach(([prop, val]) => {
          el.style[prop] = val;
        });
      }
    }
    // Gestione @model (two-way binding base) già sopra
    // Gestione @click
    if (vNode.directives['@click']) {
      el.addEventListener('click', e => {
        this._evalExpr(vNode.directives['@click'], ctx, e);
        this.render();
      });
    }
    // Gestione @mounted
    if (vNode.directives['@mounted']) {
      setTimeout(() => this._evalExpr(vNode.directives['@mounted'], ctx, el), 0);
    }
    // Gestione @init
    if (vNode.directives['@init']) {
      this._evalExpr(vNode.directives['@init'], ctx, el);
    }
    // Gestione @fetch (completa: supporta @result, loading, error)
    if (vNode.directives['@fetch']) {
      const url = this._evalExpr(vNode.directives['@fetch'], ctx);
      const resultKey = vNode.directives['@result'];
      el.textContent = 'Loading...';
      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (resultKey) {
            this.state[resultKey] = data;
            this.render();
          } else {
            el.textContent = JSON.stringify(data);
          }
        })
        .catch(err => {
          el.textContent = 'Error: ' + err.message;
        });
    }
    // Gestione @result (binding automatico)
    if (vNode.directives['@result']) {
      const key = vNode.directives['@result'];
      if (typeof this.state[key] === 'object') {
        el.textContent = JSON.stringify(this.state[key]);
      } else {
        el.textContent = this.state[key] || '';
      }
    }
    // Gestione @watch (solo esecuzione funzione su cambio stato)
    if (vNode.directives['@watch']) {
      const expr = vNode.directives['@watch'];
      const prop = expr.split('=>')[0].trim();
      const fnBody = expr.split('=>')[1] ? expr.split('=>')[1].trim() : null;
      if (fnBody) {
        this.addWatcher(prop, val => {
          try {
            new Function('value', 'state', fnBody)(val, this.state);
          } catch (e) { }
        });
      }
    }
    // Gestione @validate (solo required e minLength base)
    if (vNode.directives['@validate']) {
      const rules = vNode.directives['@validate'].split(',').map(r => r.trim());
      el.addEventListener('input', e => {
        let valid = true;
        rules.forEach(rule => {
          if (rule === 'required' && !el.value) valid = false;
          if (rule.startsWith('minLength')) {
            const min = parseInt(rule.split(':')[1], 10);
            if (el.value.length < min) valid = false;
          }
        });
        if (!valid) el.classList.add('invalid');
        else el.classList.remove('invalid');
      });
    }
    // Gestione @link (SPA router base: cambia state.currentPage)
    if (vNode.directives['@link']) {
      el.addEventListener('click', e => {
        e.preventDefault();
        this.state.currentPage = vNode.directives['@link'];
        this.render();
      });
    }
    // Gestione @page (mostra solo se state.currentPage === valore)
    if (vNode.directives['@page']) {
      if (this.state.currentPage !== vNode.directives['@page']) return null;
    }
    // Gestione @animate (aggiunge classe animazione)
    if (vNode.directives['@animate']) {
      el.classList.add(vNode.directives['@animate']);
    }
    // Gestione @source, @map, @filter, @reduce (solo visualizzazione base)
    if (vNode.directives['@source']) {
      let arr = this._evalExpr(vNode.directives['@source'], ctx) || [];
      if (vNode.directives['@map']) {
        const fn = vNode.directives['@map'];
        arr = arr.map(x => this._evalExpr(fn, { ...ctx, item: x }));
      }
      if (vNode.directives['@filter']) {
        const fn = vNode.directives['@filter'];
        arr = arr.filter(x => this._evalExpr(fn, { ...ctx, item: x }));
      }
      if (vNode.directives['@reduce']) {
        const fn = vNode.directives['@reduce'];
        arr = arr.reduce((acc, x) => this._evalExpr(fn, { ...ctx, acc, item: x }), 0);
      }
      el.textContent = JSON.stringify(arr);
    }
    // Gestione @component (inserimento di componenti registrati)
    if (vNode.directives['@component']) {
      const compName = vNode.directives['@component'];
      if (this.components[compName]) {
        const compVNode = this.parse(this.components[compName]);
        const compEl = this._renderVNode(compVNode, ctx);
        if (compEl) el.appendChild(compEl);
      }
    }
    // Gestione @switch/@case/@default: soluzione definitiva e robusta
    if (vNode.directives['@switch']) {
      let val = '';
      try {
        val = String(this._evalExpr(vNode.directives['@switch'], ctx));
      } catch (e) {
        val = '';
      }
      let matched = null;
      let defaultNode = null;

      // Analizza SOLO i figli diretti, ignora i nodi di testo
      for (const child of (vNode.children || [])) {
        if (child.type === 'text') continue;

        // caso @case
        if (child.directives && child.directives['@case']) {
          let caseVal = child.directives['@case'];
          if (/^['"].*['"]$/.test(caseVal)) {
            caseVal = caseVal.replace(/^['"]|['"]$/g, '');
          }
          caseVal = String(caseVal);
          if (matched === null && caseVal === val) {
            matched = child;
            break; // abbiamo trovato il match, esco dal ciclo
          }
        }

        // default: verifico solo l'esistenza della direttiva
        if (child.directives && Object.prototype.hasOwnProperty.call(child.directives, '@default')) {
          defaultNode = child;
        }
      }

      // Rendering
      if (matched !== null) {
        return this._renderVNode(matched, ctx);
      }
      if (defaultNode) {
        return this._renderVNode(defaultNode, ctx);
      }

      return document.createComment('switch-no-match');
    }

    return el;
  }

  // Valuta espressioni: supporta variabili, funzioni, operatore ternario
  _evalExpr(expr, ctx, event) {
    try {
      // Usa sempre this.state come contesto principale, ctx come variabili locali
      return new Function('state', 'ctx', 'event', `with(state){with(ctx){return (${expr})}}`)(this.state, ctx || {}, event);
    } catch (e) {
      return undefined;
    }
  }

  // Valuta testo: supporta {{}} per variabili e espressioni
  _evalText(text, ctx) {
    return text.replace(/{{(.*?)}}/g, (_, expr) => this._evalExpr(expr.trim(), ctx));
  }
}

// Avvia automaticamente AyishaVDOM su document.body dopo il caricamento
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new AyishaVDOM(document.body).mount());
} else {
  new AyishaVDOM(document.body).mount();
}
