// ayisha-virtual.js - Virtual DOM engine con direttive @ e componenti

class AyishaVDOM {
  constructor(root = document) {
    this.root = root;
    this.state = {};
    this.watchers = {};
    this.components = {};
    this._vdom = null;
    window.ayisha = this;
  }

  // Parsing DOM -> VDOM
  parse(node) {
    if (node.nodeType === 3) return { type: 'text', text: node.textContent };
    if (node.nodeType !== 1) return null;
    const tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style') return null;
    const vNode = {
      tag,
      attrs: {},
      directives: {},
      subDirectives: {}, // <--- AGGIUNTA
      children: [],
      key: node.getAttribute ? node.getAttribute('key') : null
    };
    for (const attr of Array.from(node.attributes)) {
      if (attr.name.startsWith('@')) {
        // Gestione sub-direttive: @direttiva:evento
        const match = attr.name.match(/^(@[\w-]+):([\w-]+)/);
        if (match) {
          const dir = match[1];
          const event = match[2];
          if (!vNode.subDirectives[dir]) vNode.subDirectives[dir] = {};
          vNode.subDirectives[dir][event] = attr.value;
        } else {
          vNode.directives[attr.name] = attr.value;
        }
      } else vNode.attrs[attr.name] = attr.value;
    }
    vNode.children = Array.from(node.childNodes).map(child => this.parse(child)).filter(Boolean);
    return vNode;
  }

  // Esegui blocchi <init> per popolare lo stato
  _runInitBlocks() {
    this.root.querySelectorAll('init').forEach(init => {
      try { new Function('state', init.textContent)(this.state); }
      catch (e) { console.error('Init block error:', e); }
    });
  }

  // Monta l'applicazione
  mount() {
    this._runInitBlocks();
    this._vdom = this.parse(this.root);
    this._makeReactive();
    this.render();
  }

  // Registra un componente custom
  component(name, html) { this.components[name] = html; }

  // Aggiungi watcher su proprietà di stato
  addWatcher(prop, fn) {
    if (!this.watchers[prop]) this.watchers[prop] = [];
    this.watchers[prop].push(fn);
  }

  // Stato reattivo
  _makeReactive() {
    this.state = new Proxy(this.state, {
      set: (target, prop, value) => {
        target[prop] = value;
        if (this.watchers[prop]) this.watchers[prop].forEach(fn => fn(value));
        this.render();
        return true;
      }
    });
  }

  // Renderizza il VDOM nel DOM reale
  render() {
    // Salva focus e posizione cursore se un input è attivo
    const active = document.activeElement;
    let focusInfo = null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      focusInfo = {
        el: active,
        name: active.getAttribute('name'),
        id: active.getAttribute('id'),
        class: active.getAttribute('class'),
        value: active.value,
        selectionStart: active.selectionStart,
        selectionEnd: active.selectionEnd,
        type: active.type
      };
    }
    const real = this._renderVNode(this._vdom, this.state);
    this.root.innerHTML = '';
    if (real) this.root.appendChild(real);
    // Ripristina focus
    if (focusInfo) {
      let selector = '';
      if (focusInfo.id) selector = `#${focusInfo.id}`;
      else if (focusInfo.name) selector = `[name='${focusInfo.name}']`;
      else if (focusInfo.class) selector = `.${focusInfo.class.split(' ')[0]}`;
      let newInput = selector ? this.root.querySelector(selector) : null;
      // Se non trovato, cerca per tipo e valore
      if (!newInput && focusInfo.type) {
        const candidates = Array.from(this.root.querySelectorAll(focusInfo.type === 'textarea' ? 'textarea' : 'input'));
        newInput = candidates.find(i => i.value === focusInfo.value);
      }
      if (newInput) {
        newInput.focus();
        if (focusInfo.selectionStart != null && newInput.setSelectionRange) {
          try { newInput.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd); } catch {}
        }
      }
    }
  }

  // Ricorsivo: VNode -> DOM
  _renderVNode(vNode, ctx) {
    if (!vNode) return null;
    if (vNode.type === 'text') return document.createTextNode(this._evalText(vNode.text, ctx));

    // Condizionali
    if (vNode.directives['@if'] && !this._evalExpr(vNode.directives['@if'], ctx)) return null;
    if (vNode.directives['@show'] && !this._evalExpr(vNode.directives['@show'], ctx)) return null;
    if (vNode.directives['@hide'] && this._evalExpr(vNode.directives['@hide'], ctx)) return null;

    // Ciclo @for
    if (vNode.directives['@for']) {
      // Supporta sintassi: item in items
      const forMatch = vNode.directives['@for'].match(/^(\w+) in (.+)$/);
      if (forMatch) {
        const itemVar = forMatch[1];
        const arr = this._evalExpr(forMatch[2], ctx) || [];
        const frag = document.createDocumentFragment();
        arr.forEach(val => {
          const subCtx = { ...ctx };
          subCtx[itemVar] = val;
          // Renderizza i children (non il vNode stesso!)
          if (vNode.children && vNode.children.length) {
            vNode.children.forEach(child => {
              const node = this._renderVNode(child, subCtx);
              if (node) frag.appendChild(node);
            });
          } else {
            // Se non ci sono children, renderizza il vNode stesso SENZA la direttiva @for
            const clonedVNode = { ...vNode, directives: { ...vNode.directives } };
            delete clonedVNode.directives['@for'];
            const node = this._renderVNode(clonedVNode, subCtx);
            if (node) frag.appendChild(node);
          }
        });
        return frag;
      }
    }

    // Crea elemento
    const el = document.createElement(vNode.tag);
    for (const [name, value] of Object.entries(vNode.attrs)) el.setAttribute(name, value);

    // Sub-direttive: aggiungi event listener per ogni direttiva:evento
    if (vNode.subDirectives) {
      for (const dir in vNode.subDirectives) {
        for (const event in vNode.subDirectives[dir]) {
          const expr = vNode.subDirectives[dir][event];
          if (dir === '@fetch') {
            el.addEventListener(event, e => {
              let url;
              if (/^https?:\/\//.test(expr.trim())) {
                url = expr.trim();
              } else {
                url = this._evalExpr(expr, ctx, e);
              }
              if (!url) return;
              url = String(url);
              // Usa resultKey se presente, altrimenti 'result'
              const resultKey = vNode.directives['@result'] || 'result';
              const method = (vNode.directives['@method'] || 'GET').toUpperCase();
              const bodyExpr = vNode.directives['@body'];
              let options = { method };
              if (bodyExpr && method !== 'GET') {
                let bodyObj = {};
                try { bodyObj = this._evalExpr(bodyExpr, ctx, e); }
                catch (err) { try { bodyObj = JSON.parse(bodyExpr); } catch { bodyObj = {}; } }
                options.body = JSON.stringify(bodyObj);
                options.headers = { 'Content-Type': 'application/json' };
              }
              fetch(url, options)
                .then(res => {
                  if (res.headers.get('content-type')?.includes('application/json')) return res.json();
                  return res.text();
                })
                .then(data => { if (resultKey) this.state[resultKey] = data; });
            });
          } else if (dir === '@text') {
            let originalText = null;
            if (event === 'mouseenter' || event === 'mouseover' || event === 'hover') {
              el.addEventListener('mouseenter', e => {
                if (originalText === null) originalText = el.textContent;
                el.textContent = this._evalExpr(expr, ctx, e) + '';
              });
              el.addEventListener('mouseleave', e => {
                if (originalText !== null) el.textContent = originalText;
              });
            } else if (event === 'click') {
              el.addEventListener('click', e => {
                el.textContent = this._evalExpr(expr, ctx, e) + '';
              });
            } else {
              el.addEventListener(event, e => {
                el.textContent = this._evalExpr(expr, ctx, e) + '';
              });
            }
            // Imposta il testo iniziale se presente
            if (el.textContent === '' && vNode.children && vNode.children.length === 1 && vNode.children[0].type === 'text') {
              el.textContent = vNode.children[0].text;
            }
          } else if (dir === '@class') {
            if (event === 'mouseenter' || event === 'mouseover' || event === 'hover') {
              el.addEventListener('mouseenter', e => {
                const classes = this._evalExpr(expr, ctx, e) || {};
                for (const [cls, cond] of Object.entries(classes)) {
                  if (cond) el.classList.add(cls);
                }
              });
              el.addEventListener('mouseleave', e => {
                const classes = this._evalExpr(expr, ctx, e) || {};
                for (const [cls] of Object.entries(classes)) {
                  el.classList.remove(cls);
                }
              });
            } else if (event === 'focus') {
              el.addEventListener('focus', e => {
                const classes = this._evalExpr(expr, ctx, e) || {};
                for (const [cls, cond] of Object.entries(classes)) {
                  if (cond) el.classList.add(cls);
                }
              });
              el.addEventListener('blur', e => {
                const classes = this._evalExpr(expr, ctx, e) || {};
                for (const [cls] of Object.entries(classes)) {
                  el.classList.remove(cls);
                }
              });
            } else if (event === 'click') {
              el.addEventListener('click', e => {
                const classes = this._evalExpr(expr, ctx, e) || {};
                for (const [cls, cond] of Object.entries(classes)) {
                  if (cond) el.classList.toggle(cls);
                }
              });
            } else {
              el.addEventListener(event, e => {
                const classes = this._evalExpr(expr, ctx, e) || {};
                for (const [cls, cond] of Object.entries(classes)) {
                  if (cond) el.classList.add(cls); else el.classList.remove(cls);
                }
              });
            }
          }
          // ...existing code for other sub-directives...
        }
      }
    }

    // @text
    if (vNode.directives['@text'] && (!vNode.subDirectives || !vNode.subDirectives['@text'])) el.textContent = this._evalExpr(vNode.directives['@text'], ctx);
    else if (!vNode.subDirectives || !vNode.subDirectives['@text']) vNode.children.forEach(child => { const node = this._renderVNode(child, ctx); if (node) el.appendChild(node); });

    // @model (two-way binding)
    if (vNode.directives['@model']) this._bindModel(el, vNode.directives['@model'], ctx);

    // @class dinamiche
    // Applica le classi dinamiche solo se NON ci sono sub-direttive @class
    if (vNode.directives['@class'] && (!vNode.subDirectives || !vNode.subDirectives['@class'])) {
      // Calcola le classi dinamiche
      const classes = this._evalExpr(vNode.directives['@class'], ctx) || {};
      // Rimuovi tutte le classi dichiarate nella mappa
      Object.keys(classes).forEach(cls => el.classList.remove(cls));
      // Aggiungi solo quelle attive
      Object.entries(classes).forEach(([cls, cond]) => {
        if (cond) el.classList.add(cls);
      });
    }

    // @style dinamici
    if (vNode.directives['@style']) {
      const styles = this._evalExpr(vNode.directives['@style'], ctx) || {};
      for (const [prop, val] of Object.entries(styles)) el.style[prop] = val;
    }

    // @click
    if (vNode.directives['@click']) {
      const expr = vNode.directives['@click'];
      el.addEventListener('click', event => {
        try { new Function('state', 'ctx', 'event', `with(state){with(ctx){${expr}}}`)(this.state, ctx, event); }
        catch (err) { console.error('Errore in @click:', err); }
        this.render();
      });
    }

    // Lifecycle: @mounted, @init
    if (vNode.directives['@mounted']) setTimeout(() => this._evalExpr(vNode.directives['@mounted'], ctx), 0);
    if (vNode.directives['@init']) this._evalExpr(vNode.directives['@init'], ctx);

    // @fetch
    if (vNode.directives['@fetch']) {
      const fetchId = vNode.directives['@fetch'] + (vNode.directives['@result'] || '');
      if (!this._fetched) this._fetched = {};
      if (!this._fetched[fetchId]) {
        const urlTemplate = vNode.directives['@fetch'];
        // Usa resultKey se presente, altrimenti 'result'
        const resultKey = vNode.directives['@result'] || 'result';
        const watchVar = vNode.directives['@watch'];
        const method = (vNode.directives['@method'] || 'GET').toUpperCase();
        const bodyExpr = vNode.directives['@body'];
        const doFetch = () => {
          let url = urlTemplate.replace(/\{(\w+)\}/g, (m, v) => this.state[v] ?? '');
          let options = { method };
          if (bodyExpr && method !== 'GET') {
            let bodyObj = {};
            try { bodyObj = this._evalExpr(bodyExpr, ctx); }
            catch (e) { try { bodyObj = JSON.parse(bodyExpr); } catch { bodyObj = {}; } }
            options.body = JSON.stringify(bodyObj);
            options.headers = { 'Content-Type': 'application/json' };
          }
          fetch(url, options)
            .then(res => res.json())
            .then(data => { if (resultKey) this.state[resultKey] = data; });
        };
        doFetch();
        if (watchVar) watchVar.split(',').forEach(dep => this.addWatcher(dep.trim(), doFetch));
        this._fetched[fetchId] = true;
      }
    }
    // @result
    if (vNode.directives['@result'] && !vNode.directives['@fetch']) {
      // NON iniettare mai @result come inner text se l'elemento non è un tag che mostra dati (es: <div>, <span>, <pre>, ecc.)
      // e mai se è presente una sub-directtiva @result
      // Quindi: solo se non ci sono sub-directive @result su questo nodo
      let hasResultSubDirective = vNode.subDirectives && vNode.subDirectives['@result'];
      // Solo per elementi che possono mostrare testo
      const canShowText = ['div','span','pre','p','code','td','th','li','b','i','strong','em','small'].includes(el.tagName.toLowerCase());
      // --- PATCH: NON modificare il textContent se il nodo ha ANCHE una sub-direttiva @fetch (es: @fetch:click) ---
      let hasFetchSubDirective = vNode.subDirectives && vNode.subDirectives['@fetch'];
      if (!hasResultSubDirective && canShowText && !hasFetchSubDirective) {
        const key = vNode.directives['@result'];
        const val = this.state[key];
        el.textContent = typeof val === 'object' ? JSON.stringify(val) : (val || '');
      }
    }

    // @watch
    if (vNode.directives['@watch']) {
      const [prop, fnBody] = vNode.directives['@watch'].split('=>').map(s => s.trim());
      if (fnBody) {
        this.addWatcher(prop, value => {
          try { new Function('value', 'state', 'with(state){' + fnBody + '}')(value, this.state); } catch {}
        });
      }
    }

    // @validate
    if (vNode.directives['@validate']) this._bindValidation(el, vNode.directives['@validate']);

    // Routing: @link, @page
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

    // @animate
    if (vNode.directives['@animate']) el.classList.add(vNode.directives['@animate']);

    // @component
    if (vNode.directives['@component']) {
      const compName = vNode.directives['@component'];
      if (this.components[compName]) {
        const compVNode = this.parse(this.components[compName]);
        const compEl = this._renderVNode(compVNode, ctx);
        if (compEl) el.appendChild(compEl);
      }
    }

    // Switch-case-default
    if (vNode.directives['@switch']) {
      const switchVal = this._evalExpr(vNode.directives['@switch'], ctx);
      let defaultNode = null;
      for (const child of vNode.children) {
        if (child.directives) {
          if (child.directives['@case'] != null) {
            let caseVal = child.directives['@case'];
            if (/^['"].*['"]$/.test(caseVal)) caseVal = caseVal.slice(1, -1);
            if (String(caseVal) === String(switchVal)) return this._renderVNode(child, ctx);
          }
          if (child.directives['@default'] != null) defaultNode = child;
        }
      }
      return defaultNode ? this._renderVNode(defaultNode, ctx) : document.createComment('noswitch');
    }

    // @set
    if (vNode.directives['@set']) {
      try {
        vNode.directives['@set'].split(';').forEach(assign => {
          if (!assign.trim()) return;
          const [key, ...rest] = assign.split('=');
          const varName = key.trim();
          const expr = rest.join('=').trim();
          if (varName && expr) {
            const newValue = new Function('state', 'with(state){return (' + expr + ')}')(this.state);
            if (this.state[varName] !== newValue) this.state[varName] = newValue;
          }
        });
      } catch (e) { console.error('Errore in @set:', e); }
    }

    // Funzionali: @map, @filter, @reduce
    if (vNode.directives['@source']) {
      const sourceArr = this._evalExpr(vNode.directives['@source'], ctx) || [];
      const silentSet = (key, value) => {
        if (JSON.stringify(this.state[key]) !== JSON.stringify(value)) {
          Object.defineProperty(this.state, key, { value, writable: true, configurable: true, enumerable: true });
        }
      };
      let isFunctional = false;
      if (vNode.directives['@map']) {
        isFunctional = true;
        const mapFn = new Function('item', 'return (' + vNode.directives['@map'] + ')');
        const result = sourceArr.map(mapFn);
        const resultKey = vNode.directives['@result'] || 'result';
        silentSet(resultKey, result);
      }
      if (vNode.directives['@filter']) {
        isFunctional = true;
        const filterFn = new Function('item', 'return (' + vNode.directives['@filter'] + ')');
        const result = sourceArr.filter(filterFn);
        const resultKey = vNode.directives['@result'] || 'result';
        silentSet(resultKey, result);
      }
      if (vNode.directives['@reduce']) {
        isFunctional = true;
        let reduceFn;
        const reduceStr = vNode.directives['@reduce'];
        if (reduceStr.includes('=>')) {
          const [params, body] = reduceStr.split('=>').map(s => s.trim());
          const [a, b] = params.replace(/[()]/g, '').split(',').map(s => s.trim());
          reduceFn = new Function(a, b, 'return (' + body + ')');
        } else {
          reduceFn = new Function('acc', 'item', 'return (' + reduceStr + ')');
        }
        const initial = vNode.directives['@initial'] ? this._evalExpr(vNode.directives['@initial'], ctx) : undefined;
        const result = initial !== undefined ? sourceArr.reduce(reduceFn, initial) : sourceArr.reduce(reduceFn);
        const resultKey = vNode.directives['@result'] || 'result';
        silentSet(resultKey, result);
      }
      if (isFunctional) return document.createComment('functional directive');
    }

    return el;
  }

  // Two-way binding helper
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

  // Validazione input
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

  // Eval JS expression in state+ctx
  _evalExpr(expr, ctx, event) {
    try {
      // Proxy per fallback automatico delle variabili non dichiarate
      const stateProxy = new Proxy(this.state, {
        get: (target, prop) => {
          if (!(prop in target)) {
            // Se la variabile non esiste, la crea come proprietà reattiva
            this.state[prop] = undefined;
            return this.state[prop];
          }
          return target[prop];
        },
        set: (target, prop, value) => {
          target[prop] = value;
          return true;
        }
      });
      // Esegue l'espressione in un contesto che include sia state che ctx
      return new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){return (typeof ${expr} !== 'undefined' ? ${expr} : state['${expr}'])}}`)(stateProxy, ctx, event);
    } catch (e) {
      // Se ReferenceError, crea la variabile nello state e riprova una volta
      if (e instanceof ReferenceError) {
        const match = /ReferenceError: ([\w$]+) is not defined/.exec(e.message);
        if (match && match[1]) {
          this.state[match[1]] = undefined;
          try {
            return new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){return (typeof ${expr} !== 'undefined' ? ${expr} : state['${expr}'])}}`)(this.state, ctx, event);
          } catch (e2) { console.error('Eval error:', e2); return undefined; }
        }
      }
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
