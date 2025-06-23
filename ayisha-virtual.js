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
    const tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style') return null;
    const vNode = {
      tag,
      attrs: {},
      directives: {},
      children: [],
      key: node.getAttribute ? node.getAttribute('key') : null
    };
    Array.from(node.attributes).forEach(attr => {
      if (attr.name.startsWith('@')) {
        vNode.directives[attr.name] = attr.value;
      } else {
        vNode.attrs[attr.name] = attr.value;
      }
    });
    vNode.children = Array.from(node.childNodes)
      .map(child => this.parse(child))
      .filter(Boolean);
    return vNode;
  }

  // Esegui i blocchi <init> e popola lo stato
  _runInitBlocks() {
    const inits = this.root.querySelectorAll('init');
    inits.forEach(init => {
      try {
        new Function('state', init.textContent)(this.state);
      } catch (e) {
        console.error('Init block error:', e);
      }
    });
  }

  // Mount: esegue init, parsing, rende reattivo e renderizza
  mount() {
    this._runInitBlocks();
    this._vdom = this.parse(this.root);
    this._makeReactive();
    this.render();
  }

  // Registra componente custom
  component(name, html) {
    this.components[name] = html;
  }

  // Aggiunge watcher per proprietà di stato
  addWatcher(prop, fn) {
    if (!this.watchers[prop]) this.watchers[prop] = [];
    this.watchers[prop].push(fn);
  }

  // Crea proxy reattivo sullo stato
  _makeReactive() {
    this.state = new Proxy(this.state, {
      set: (target, prop, value) => {
        target[prop] = value;
        if (this.watchers[prop]) {
          this.watchers[prop].forEach(fn => fn(value));
        }
        this.render();
        return true;
      }
    });
  }

  // Render: genera DOM reale dal VDOM e lo monta
  render() {
    const real = this._renderVNode(this._vdom, this.state);
    this.root.innerHTML = '';
    if (real) this.root.appendChild(real);
  }

  // Ricorsivo: genera un nodo DOM a partire da un vNode
  _renderVNode(vNode, ctx) {
    if (!vNode) return null;
    if (vNode.type === 'text') {
      return document.createTextNode(this._evalText(vNode.text, ctx));
    }

    // Direttive condizionali
    if (vNode.directives['@if'] && !this._evalExpr(vNode.directives['@if'], ctx)) {
      return null;
    }
    if (vNode.directives['@show'] && !this._evalExpr(vNode.directives['@show'], ctx)) {
      return null;
    }
    if (vNode.directives['@hide'] && this._evalExpr(vNode.directives['@hide'], ctx)) {
      return null;
    }

    // Direttiva @for
    if (vNode.directives['@for']) {
      const [item, arrExpr] = vNode.directives['@for'].split(' in ').map(s => s.trim());
      const arr = this._evalExpr(arrExpr, ctx) || [];
      const frag = document.createDocumentFragment();
      arr.forEach(val => {
        const subCtx = { ...ctx, [item]: val };
        vNode.children.forEach(child => {
          const node = this._renderVNode(child, subCtx);
          if (node) frag.appendChild(node);
        });
      });
      return frag;
    }

    // Creazione elemento reale
    const el = document.createElement(vNode.tag);
    Object.entries(vNode.attrs).forEach(([name, value]) => el.setAttribute(name, value));

    // Gestione @text
    if (vNode.directives['@text']) {
      el.textContent = this._evalExpr(vNode.directives['@text'], ctx);
    } else {
      vNode.children.forEach(child => {
        const node = this._renderVNode(child, ctx);
        if (node) el.appendChild(node);
      });
    }

    // Two-way binding: @model
    if (vNode.directives['@model']) {
      this._bindModel(el, vNode.directives['@model'], ctx);
    }

    // Classi dinamiche: @class
    if (vNode.directives['@class']) {
      const classes = this._evalExpr(vNode.directives['@class'], ctx) || {};
      Object.entries(classes).forEach(([cls, cond]) => {
        if (cond) el.classList.add(cls);
        else el.classList.remove(cls);
      });
    }

    // Stili dinamici: @style
    if (vNode.directives['@style']) {
      const styles = this._evalExpr(vNode.directives['@style'], ctx) || {};
      Object.entries(styles).forEach(([prop, val]) => {
        el.style[prop] = val;
      });
    }

    // Eventi: @click con supporto multi-statement
    if (vNode.directives['@click']) {
      const expr = vNode.directives['@click'];
      el.addEventListener('click', event => {
        try {
          new Function('state', 'ctx', 'event', `with(state){with(ctx){${expr}}}`)(this.state, ctx, event);
        } catch (err) {
          console.error('Errore in @click:', err);
        }
        this.render();
      });
    }

    // Lifecycle hooks: @mounted e @init
    if (vNode.directives['@mounted']) {
      setTimeout(() => this._evalExpr(vNode.directives['@mounted'], ctx), 0);
    }
    if (vNode.directives['@init']) {
      this._evalExpr(vNode.directives['@init'], ctx);
    }

    // Fetch data: @fetch e risultato @result
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
    if (vNode.directives['@result'] && !vNode.directives['@fetch']) {
      const key = vNode.directives['@result'];
      const val = this.state[key];
      el.textContent = typeof val === 'object' ? JSON.stringify(val) : (val || '');
    }

    // Watchers: @watch
    if (vNode.directives['@watch']) {
      const [prop, fnBody] = vNode.directives['@watch'].split('=>').map(s => s.trim());
      if (fnBody) {
        this.addWatcher(prop, value => {
          try {
            new Function('value', 'state', fnBody)(value, this.state);
          } catch {}
        });
      }
    }

    // Validation: @validate
    if (vNode.directives['@validate']) {
      this._bindValidation(el, vNode.directives['@validate']);
    }

    // Routing: @link e @page
    if (vNode.directives['@link']) {
      el.addEventListener('click', e => {
        e.preventDefault();
        this.state.currentPage = vNode.directives['@link'];
        this.render();
      });
    }
    if (vNode.directives['@page']) {
      if (this.state.currentPage !== vNode.directives['@page']) return null;
    }

    // Animazioni: @animate
    if (vNode.directives['@animate']) {
      el.classList.add(vNode.directives['@animate']);
    }

    // Componenti: @component
    if (vNode.directives['@component']) {
      const compName = vNode.directives['@component'];
      if (this.components[compName]) {
        const compVNode = this.parse(this.components[compName]);
        const compEl = this._renderVNode(compVNode, ctx);
        if (compEl) el.appendChild(compEl);
      }
    }

    // Switch-case-default: @switch, @case, @default
    if (vNode.directives['@switch']) {
      const switchVal = this._evalExpr(vNode.directives['@switch'], ctx);
      let defaultNode = null;
      for (const child of vNode.children) {
        if (child.directives) {
          if (child.directives['@case'] != null) {
            let caseVal = child.directives['@case'];
            if (/^['"].*['"]$/.test(caseVal)) {
              caseVal = caseVal.slice(1, -1);
            }
            if (String(caseVal) === String(switchVal)) {
              return this._renderVNode(child, ctx);
            }
          }
          if (child.directives['@default'] != null) {
            defaultNode = child;
          }
        }
      }
      return defaultNode ? this._renderVNode(defaultNode, ctx) : document.createComment('noswitch');
    }

    return el;
  }

  // Helper: two-way data binding
  _bindModel(el, key, ctx) {
    if (el.tagName === 'SELECT') {
      el.value = this._evalExpr(key, ctx);
      el.addEventListener('change', e => this.state[key] = e.target.value);
    } else if (el.type === 'checkbox') {
      el.checked = this._evalExpr(key, ctx);
      el.addEventListener('change', e => this.state[key] = e.target.checked);
    } else if (el.type === 'radio') {
      el.checked = this._evalExpr(key, ctx) == el.value;
      el.addEventListener('change', e => { if (e.target.checked) this.state[key] = e.target.value; });
    } else {
      el.value = this._evalExpr(key, ctx);
      el.addEventListener('input', e => this.state[key] = e.target.value);
    }
  }

  // Helper: validazione input
  _bindValidation(el, rulesStr) {
    const rules = rulesStr.split(',').map(r => r.trim());
    el.addEventListener('input', () => {
      let valid = true;
      rules.forEach(rule => {
        if (rule === 'required' && !el.value) valid = false;
        if (rule.startsWith('minLength')) {
          const min = parseInt(rule.split(':')[1], 10);
          if (el.value.length < min) valid = false;
        }
      });
      el.classList.toggle('invalid', !valid);
    });
  }

  // Eval expression JS in state+ctx
  _evalExpr(expr, ctx, event) {
    try {
      return new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){return (${expr})}}`)(this.state, ctx, event);
    } catch (e) {
      console.error('Eval error:', e);
      return undefined;
    }
  }

  // Eval text moustache
  _evalText(text, ctx) {
    return text.replace(/{{(.*?)}}/g, (_, expr) => this._evalExpr(expr.trim(), ctx));
  }
}

// Auto-mount su document.body
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new AyishaVDOM(document.body).mount());
} else {
  new AyishaVDOM(document.body).mount();
}
