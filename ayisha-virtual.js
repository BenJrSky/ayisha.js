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

  // --- PARSING DOM -> VDOM ---
  parse(node) {
    if (node.nodeType === 3) return { type: 'text', text: node.textContent };
    if (node.nodeType !== 1) return null;
    const tag = node.tagName.toLowerCase();
    // Se il tag è tra quelli da ignorare completamente (script, style), esci subito
    if (tag === 'script' || tag === 'style') return null;
    // Se il tag è uno "nascosto" (ayisha-directive, a-dir, x), processa solo le direttive ma non renderizzare nulla
    if (tag === 'ayisha-directive' || tag === 'a-dir' || tag === 'x') {
      const vNode = {
        tag,
        attrs: {},
        directives: {},
        subDirectives: {},
        children: [],
        key: node.getAttribute ? node.getAttribute('key') : null
      };
      for (const attr of Array.from(node.attributes)) {
        if (attr.name.startsWith('@')) {
          const subDirMatch = attr.name.match(/^(@[\w-]+):([\w-]+)$/);
          if (subDirMatch) {
            const dir = subDirMatch[1];
            const event = subDirMatch[2];
            if (!vNode.subDirectives[dir]) vNode.subDirectives[dir] = {};
            vNode.subDirectives[dir][event] = attr.value;
          } else {
            vNode.directives[attr.name] = attr.value;
          }
        } else {
          vNode.attrs[attr.name] = attr.value;
        }
      }
      // Non processare children, restituisci solo le direttive
      return vNode;
    }
    const vNode = {
      tag,
      attrs: {},
      directives: {},
      subDirectives: {},
      children: [],
      key: node.getAttribute ? node.getAttribute('key') : null
    };
    for (const attr of Array.from(node.attributes)) {
      if (attr.name.startsWith('@')) {
        const subDirMatch = attr.name.match(/^(@[\w-]+):([\w-]+)$/);
        if (subDirMatch) {
          const dir = subDirMatch[1];
          const event = subDirMatch[2];
          if (!vNode.subDirectives[dir]) vNode.subDirectives[dir] = {};
          vNode.subDirectives[dir][event] = attr.value;
        } else {
          vNode.directives[attr.name] = attr.value;
        }
      } else {
        vNode.attrs[attr.name] = attr.value;
      }
    }
    vNode.children = Array.from(node.childNodes).map(child => this.parse(child)).filter(Boolean);
    return vNode;
  }

  // --- INIZIALIZZAZIONE STATO ---
  _runInitBlocks() {
    this.root.querySelectorAll('init').forEach(init => {
      try { new Function('state', init.textContent)(this.state); }
      catch (e) { console.error('Init block error:', e); }
    });
  }

  // --- MOUNT APP ---
  mount() {
    this._runInitBlocks();
    this._vdom = this.parse(this.root);
    this._makeReactive();
    this.render();
  }

  // --- COMPONENTI CUSTOM ---
  component(name, html) { this.components[name] = html; }

  // --- WATCHER SU PROPRIETÀ DI STATO ---
  addWatcher(prop, fn) {
    if (!this.watchers[prop]) this.watchers[prop] = [];
    this.watchers[prop].push(fn);
  }

  // --- STATO REATTIVO ---
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

  // --- RENDER VDOM NEL DOM REALE ---
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

  // --- VNODE -> DOM (RICORSIVO) ---
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
      const forMatch = vNode.directives['@for'].match(/^([\w$]+) in (.+)$/);
      if (forMatch) {
        const itemVar = forMatch[1];
        let arr = this._evalExpr(forMatch[2], ctx);
        if (!Array.isArray(arr)) {
          if (arr == null) arr = [];
          else if (typeof arr === 'object') arr = Object.values(arr);
          else arr = [];
        }
        const frag = document.createDocumentFragment();
        for (const val of arr) {
          const subCtx = { ...ctx };
          subCtx[itemVar] = val;
          if (vNode.children && vNode.children.length) {
            vNode.children.forEach(child => {
              const node = this._renderVNode(child, subCtx);
              if (node) frag.appendChild(node);
            });
          } else {
            const clonedVNode = { ...vNode, directives: { ...vNode.directives } };
            delete clonedVNode.directives['@for'];
            const node = this._renderVNode(clonedVNode, subCtx);
            if (node) frag.appendChild(node);
          }
        }
        return frag;
      }
    }

    // Crea elemento
    const el = document.createElement(vNode.tag);
    for (const [name, value] of Object.entries(vNode.attrs)) el.setAttribute(name, value);

    // --- DIRETTIVE PRINCIPALI ---
    if (vNode.directives['@hover']) {
      const expr = vNode.directives['@hover'];
      el.addEventListener('mouseenter', event => {
        try { new Function('state', 'ctx', 'event', `with(state){with(ctx){${expr}}}`)(this.state, ctx, event); }
        catch (err) { console.error('Errore in @hover:', err); }
        this.render();
      });
    }
    if (vNode.directives['@fetch'] && vNode.attrs && vNode.attrs['@fetch:hover']) {
      const expr = vNode.attrs['@fetch:hover'];
      el.addEventListener('mouseenter', e => {
        setTimeout(() => {
          let url;
          if (/^https?:\/\//.test(expr.trim())) url = expr.trim();
          else url = this._evalExpr(expr, ctx, e);
          if (!url) return;
          url = String(url);
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
            .then(res => res.headers.get('content-type')?.includes('application/json') ? res.json() : res.text())
            .then(data => { if (resultKey) this.state[resultKey] = data; });
        }, 0);
      });
    }

    // --- SOTTO-DIRETTIVE (EVENTI) ---
    if (vNode.subDirectives) {
      for (const dir in vNode.subDirectives) {
        for (let event in vNode.subDirectives[dir]) {
          const realEvent = (event === 'hover') ? 'mouseenter' : event;
          const expr = vNode.subDirectives[dir][event];
          if (dir === '@fetch') {
            el.addEventListener(realEvent, e => {
              setTimeout(() => {
                let url = expr.trim();
                url = url.replace(/\{([^}]+)\}/g, (m, key) => {
                  try { return this._evalExpr(key, ctx, e); } catch { return ''; }
                });
                if (!url) return;
                url = String(url);
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
                  .then(res => res.headers.get('content-type')?.includes('application/json') ? res.json() : res.text())
                  .then(data => { if (resultKey) this.state[resultKey] = data; });
              }, 0);
            });
            continue;
          }
          if (dir === '@hover') {
            if (event === 'mouseenter' || event === 'mouseover' || event === 'hover') {
              el.addEventListener('mouseenter', e => {
                try { new Function('state','ctx','event', 'with(state){with(ctx){'+expr+'}}')(this.state, ctx, e); } catch {}
                this.render();
              });
            } else {
              el.addEventListener(event, e => {
                try { new Function('state','ctx','event', 'with(state){with(ctx){'+expr+'}}')(this.state, ctx, e); } catch {}
                this.render();
              });
            }
            continue;
          }
          if (dir === '@text') {
            if (!el._ayishaOriginalText) {
              let staticText = '';
              if (vNode.children && vNode.children.length) {
                staticText = vNode.children.filter(c => c.type === 'text').map(c => c.text).join('');
              }
              if (vNode.directives['@text']) {
                try { el._ayishaOriginalText = this._evalExpr(vNode.directives['@text'], ctx); } catch {} 
              } else if (staticText) {
                el._ayishaOriginalText = staticText;
              } else {
                el._ayishaOriginalText = el.textContent;
              }
              if (!vNode.directives['@text']) el.textContent = el._ayishaOriginalText;
            }
            if (event === 'mouseenter' || event === 'mouseover' || event === 'hover') {
              el.addEventListener('mouseenter', e => {
                let val = expr;
                if (/^(['"]).*\1$/.test(expr.trim())) val = expr.trim().slice(1, -1);
                else {
                  try { val = new Function('state','ctx','event', 'with(state){with(ctx){return ('+expr+')}}')(this.state, ctx, e); } catch {}
                }
                el.textContent = val;
              });
              el.addEventListener('mouseleave', e => {
                el.textContent = el._ayishaOriginalText;
              });
            } else if (event === 'click') {
              el.addEventListener('click', e => {
                let val = expr;
                if (/^(['"]).*\1$/.test(expr.trim())) val = expr.trim().slice(1, -1);
                else {
                  try { val = new Function('state','ctx','event', 'with(state){with(ctx){return ('+expr+')}}')(this.state, ctx, e); } catch {}
                }
                el.textContent = val;
                el._ayishaOriginalText = val;
              });
            }
          } else if (dir === '@class') {
            if (!el._ayishaOriginalClasses) el._ayishaOriginalClasses = Array.from(el.classList);
            if (vNode.directives['@class']) {
              try {
                const classes = this._evalExpr(vNode.directives['@class'], ctx) || {};
                el._ayishaOriginalClasses = Object.entries(classes).filter(([cls, cond]) => cond).map(([cls]) => cls);
              } catch {}
            }
            if (event === 'hover' || event === 'mouseenter' || event === 'mouseover') {
              el.addEventListener('mouseenter', e => {
                let val = expr;
                if (/^\s*\{.*\}\s*$/.test(expr.trim())) {
                  try { val = new Function('state','ctx','event', 'with(state){with(ctx){return '+expr+'}}')(this.state, ctx, e); } catch {}
                } else {
                  try { val = new Function('state','ctx','event', 'with(state){with(ctx){return ('+expr+')}}')(this.state, ctx, e); } catch {}
                }
                if (typeof val === 'object' && val) {
                  Object.entries(val).forEach(([cls, cond]) => {
                    if (cond) el.classList.add(cls); else el.classList.remove(cls);
                  });
                }
              });
              el.addEventListener('mouseleave', e => {
                el.className = '';
                el._ayishaOriginalClasses.forEach(cls => el.classList.add(cls));
              });
            } else if (event === 'click') {
              el.addEventListener('click', e => {
                let val = expr;
                if (/^\s*\{.*\}\s*$/.test(expr.trim())) {
                  try { val = new Function('state','ctx','event', 'with(state){with(ctx){return '+expr+'}}')(this.state, ctx, e); } catch {}
                } else {
                  try { val = new Function('state','ctx','event', 'with(state){with(ctx){return ('+expr+')}}')(this.state, ctx, e); } catch {}
                }
                if (typeof val === 'object' && val) {
                  Object.entries(val).forEach(([cls, cond]) => {
                    if (cond) el.classList.add(cls); else el.classList.remove(cls);
                  });
                }
                el._ayishaOriginalClasses = Array.from(el.classList);
              });
            } else {
              el.addEventListener(event, e => {
                let val = expr;
                if (/^\s*\{.*\}\s*$/.test(expr.trim())) {
                  try { val = new Function('state','ctx','event', 'with(state){with(ctx){return '+expr+'}}')(this.state, ctx, e); } catch {}
                } else {
                  try { val = new Function('state','ctx','event', 'with(state){with(ctx){return ('+expr+')}}')(this.state, ctx, e); } catch {}
                }
                if (typeof val === 'object' && val) {
                  Object.entries(val).forEach(([cls, cond]) => {
                    if (cond) el.classList.add(cls); else el.classList.remove(cls);
                  });
                }
              });
            }
          }
        }
      }
    }

    // --- DIRETTIVE DI BASE ---
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

    // --- LIFECYCLE ---
    if (vNode.directives['@mounted']) setTimeout(() => this._evalExpr(vNode.directives['@mounted'], ctx), 0);
    if (vNode.directives['@init']) this._evalExpr(vNode.directives['@init'], ctx);

    // --- FETCH ---
    if (vNode.directives['@fetch']) {
      const fetchId = vNode.directives['@fetch'] + (vNode.directives['@result'] || '');
      if (!this._fetched) this._fetched = {};
      if (!this._fetched[fetchId]) {
        const urlTemplate = vNode.directives['@fetch'];
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
    if (vNode.directives['@result'] && !vNode.directives['@fetch']) {
      let hasResultSubDirective = vNode.subDirectives && vNode.subDirectives['@result'];
      const canShowText = ['div','span','pre','p','code','td','th','li','b','i','strong','em','small'].includes(el.tagName.toLowerCase());
      let hasFetchSubDirective = vNode.subDirectives && vNode.subDirectives['@fetch'];
      if (!hasResultSubDirective && canShowText && !hasFetchSubDirective) {
        const key = vNode.directives['@result'];
        const val = this.state[key];
        el.textContent = typeof val === 'object' ? JSON.stringify(val) : (val || '');
      }
    }

    // --- WATCH ---
    if (vNode.directives['@watch']) {
      const [prop, fnBody] = vNode.directives['@watch'].split('=>').map(s => s.trim());
      if (fnBody) {
        this.addWatcher(prop, value => {
          try { new Function('value', 'state', 'with(state){' + fnBody + '}')(value, this.state); } catch {}
        });
      }
    }

    // --- VALIDAZIONE ---
    if (vNode.directives['@validate']) this._bindValidation(el, vNode.directives['@validate']);

    // --- ROUTING ---
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

    // --- ANIMATE ---
    if (vNode.directives['@animate']) el.classList.add(vNode.directives['@animate']);

    // --- COMPONENTI ---
    if (vNode.directives['@component']) {
      const compName = vNode.directives['@component'];
      if (this.components[compName]) {
        const compVNode = this.parse(this.components[compName]);
        const compEl = this._renderVNode(compVNode, ctx);
        if (compEl) el.appendChild(compEl);
      }
    }

    // --- SWITCH/CASE/DEFAULT ---
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

    // --- SET ---
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

    // --- FUNZIONALI: MAP/FILTER/REDUCE ---
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

  // --- TWO-WAY BINDING ---
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

  // --- VALIDAZIONE INPUT ---
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

  // --- EVAL ESPRESSIONI JS ---
  _evalExpr(expr, ctx, event) {
    try {
      const stateProxy = new Proxy(this.state, {
        get: (target, prop) => {
          if (!(prop in target)) {
            this.state[prop] = 0;
            return this.state[prop];
          }
          return target[prop];
        },
        set: (target, prop, value) => {
          target[prop] = value;
          return true;
        }
      });
      return new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){return (typeof ${expr} !== 'undefined' ? ${expr} : state['${expr}'])}}`)(stateProxy, ctx, event);
    } catch (e) {
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

  // --- EVAL TESTO MUSTACHE ---
  _evalText(text, ctx) {
    return text.replace(/{{(.*?)}}/g, (_, expr) => this._evalExpr(expr.trim(), ctx));
  }
}

// --- AUTO-MOUNT SU document.body ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new AyishaVDOM(document.body).mount());
} else {
  new AyishaVDOM(document.body).mount();
}
