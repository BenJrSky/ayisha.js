// ayisha-virtual.js - Virtual DOM engine with directives, sub-directives, two-way binding, routing, components

(function() {
  // Prevent redeclaration
  if (window.AyishaVDOM) return;

  class AyishaVDOM {
    constructor(root = document.body) {
      this.root = root;
      this.state = {};
      this.watchers = {};
      this.components = {};
      this._initBlocks = [];
      this._vdom = null;
      this._modelBindings = [];
      this._fetched = {};
      this._componentCache = {};
      this._loadingComponents = new Set();
      this._isRendering = false;
      window.ayisha = this;
    }

    // @parse - Parsing DOM to Virtual DOM
    parse(node) {
      if (!node) return null;
      // Handle DocumentFragment (for HTML fragments)
      if (node.nodeType === 11) { // DocumentFragment
        const fragVNode = { tag: 'fragment', attrs: {}, directives: {}, subDirectives: {}, children: [] };
        node.childNodes.forEach(child => {
          const cn = this.parse(child);
          if (cn) fragVNode.children.push(cn);
        });
        return fragVNode;
      }
      if (node.nodeType === 3) {
        return { type: 'text', text: node.textContent };
      }
      if (node.nodeType !== 1) return null;
      const tag = node.tagName.toLowerCase();
      if (tag === 'init') {
        this._initBlocks.push(node.textContent);
        return null;
      }
      const vNode = { tag, attrs: {}, directives: {}, subDirectives: {}, children: [] };
      for (const attr of Array.from(node.attributes)) {
        if (attr.name.startsWith('@')) {
          const parts = attr.name.split(':');
          if (parts.length === 2) {
            const [dir, evt] = parts;
            vNode.subDirectives[dir] = vNode.subDirectives[dir] || {};
            vNode.subDirectives[dir][evt] = attr.value;
          } else {
            vNode.directives[attr.name] = attr.value;
          }
        } else {
          vNode.attrs[attr.name] = attr.value;
        }
      }
      // Always try to parse children (self-closing tags will just have none)
      if (node.childNodes && node.childNodes.length > 0) {
        node.childNodes.forEach(child => {
          const cn = this.parse(child);
          if (cn) vNode.children.push(cn);
        });
      }
      return vNode;
    }

    // @init - Run <init> blocks
    _runInitBlocks() {
      this._initBlocks.forEach(code => {
        try {
          new Function('state', code)(this.state);
        } catch (e) {
          console.error('Init error:', e);
        }
      });
    }

    // @reactivity - Make state reactive
    _makeReactive() {
      this.state = new Proxy(this.state, {
        set: (obj, prop, val) => {
          obj[prop] = val;
          (this.watchers[prop] || []).forEach(fn => fn(val));
          this.render();
          return true;
        }
      });
    }

    // @watch - Add watcher for a property
    addWatcher(prop, fn) {
      this.watchers[prop] = this.watchers[prop] || [];
      this.watchers[prop].push(fn);
    }

    // @component - Register a component
    component(name, html) {
      this.components[name] = html;
    }

    // @component:external - Load external component by URL
    async _loadExternalComponent(url) {
      // Controlla se il componente è già in cache
      if (this._componentCache[url]) {
        return this._componentCache[url];
      }

      // Evita richieste duplicate per lo stesso URL
      if (this._loadingComponents.has(url)) {
        // Attende che la richiesta in corso si completi
        while (this._loadingComponents.has(url)) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        return this._componentCache[url];
      }

      this._loadingComponents.add(url);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // Salva in cache
        this._componentCache[url] = html;
        
        return html;
      } catch (error) {
        console.error(`Errore nel caricamento del componente da ${url}:`, error);
        return null;
      } finally {
        this._loadingComponents.delete(url);
      }
    }

    // @expression - Evaluate JS expressions in context
    _evalExpr(expr, ctx = {}, event) {
      const t = expr.trim();
      if (/^['"].*['"]$/.test(t)) return t.slice(1, -1);
      if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
      try {
        const sp = new Proxy(this.state, {
          get: (o, k) => o[k],
          set: (o, k, v) => { o[k] = v; return true; }
        });
        return new Function('state','ctx','event', `with(state){with(ctx||{}){return (${expr})}}`)(sp, ctx, event);
      } catch {
        return undefined;
      }
    }

    // @expression:text - Evaluate mustache in text
    _evalText(text, ctx) {
      return text.replace(/{{(.*?)}}/g, (_, e) => {
        const r = this._evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
    }

    // @expression:attr - Evaluate dynamic attribute values
    _evalAttrValue(val, ctx) {
      // Replace {{...}} expressions
      let result = val.replace(/{{(.*?)}}/g, (_, e) => {
        const r = this._evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
      // Replace [{...}] expressions (for array/object access)
      result = result.replace(/\[\{(.*?)\}\]/g, (_, e) => {
        const r = this._evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
      // Replace {...} expressions (for direct JS-like access)
      // If the whole value is a single {...}, evaluate as a full JS expression
      if (/^\{([^{}]+)\}$/.test(result.trim())) {
        const expr = result.trim().slice(1, -1);
        const r = this._evalExpr(expr, ctx);
        return r != null ? r : '';
      }
      // Otherwise, replace {...} inside the string
      result = result.replace(/\{([^{}]+)\}/g, (match, e) => {
        // Avoid replacing inside {{...}}
        if (/^\{\{.*\}\}$/.test(match)) return match;
        const r = this._evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
      return result;
    }

    // @model - Two-way binding for inputs
    _bindModel(el, key, ctx) {
      const update = () => {
        const val = this._evalExpr(key, ctx);
        if (el.type === 'checkbox') el.checked = !!val;
        else if (el.type === 'radio') el.checked = val == el.value;
        else if (el.value !== String(val)) el.value = val ?? '';
      };
      this._modelBindings.push({ el, update });
      update();
      el.addEventListener('input', () => {
        new Function('state','ctx','value', `with(state){with(ctx||{}){${key}=value}}`)(this.state, ctx, el.value);
        this.render();
      });
    }

    // @validate - Input validation
    _bindValidation(el, rulesStr) {
      const rules = rulesStr.split(',').map(r => r.trim());
      el.addEventListener('input', () => {
        let valid = true;
        rules.forEach(rule => {
          if (rule === 'required' && !el.value) valid = false;
          if (rule.startsWith('minLength')) {
            const m = parseInt(rule.split(':')[1], 10);
            if (el.value.length < m) valid = false;
          }
        });
        el.classList.toggle('invalid', !valid);
      });
    }

    // @router - SPA Routing
    _setupRouting() {
      let p = location.pathname.replace(/^\//, '') || '';
      if (!p || p === 'index.html') { history.replaceState({}, '', '/'); p = ''; }
      this.state.currentPage = p;
      window.addEventListener('popstate', () => {
        this.state.currentPage = location.pathname.replace(/^\//, '') || '';
        this.render();
      });
    }

    // @render - Main render function
    render() {
      // Evita rendering ricorsivo
      if (this._isRendering) return;
      this._isRendering = true;
      
      const active = document.activeElement;
      let focusInfo = null;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        const path = [];
        let node = active;
        while (node && node !== this.root) {
          const parent = node.parentNode;
          path.unshift([...parent.childNodes].indexOf(node));
          node = parent;
        }
        focusInfo = { path, start: active.selectionStart, end: active.selectionEnd };
      }
      this._modelBindings = [];
      const real = this._renderVNode(this._vdom, this.state);
      if (this.root === document.body) {
        document.body.innerHTML = '';
        if (real) {
          if (real.tagName === undefined && real.childNodes) {
            // If it's a fragment, append all children
            Array.from(real.childNodes).forEach(child => document.body.appendChild(child));
          } else if (real instanceof DocumentFragment) {
            document.body.appendChild(real);
          } else {
            document.body.appendChild(real);
          }
        }
      } else {
        this.root.innerHTML = '';
        if (real) {
          if (real.tagName === undefined && real.childNodes) {
            Array.from(real.childNodes).forEach(child => this.root.appendChild(child));
          } else if (real instanceof DocumentFragment) {
            this.root.appendChild(real);
          } else {
            this.root.appendChild(real);
          }
        }
      }
      if (focusInfo) {
        let node = this.root;
        focusInfo.path.forEach(i => node = node.childNodes[i]);
        // Exclude input types that do not support setSelectionRange
        const unsupportedTypes = [
          'number', 'range', 'color', 'date', 'datetime-local', 'month', 'time',
          'week', 'file', 'checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'hidden'
        ];
        if (
          node &&
          (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') &&
          !(node.tagName === 'INPUT' && unsupportedTypes.includes(node.type))
        ) {
          node.focus();
          node.setSelectionRange(focusInfo.start, focusInfo.end);
        }
      }
      this._modelBindings.forEach(b => b.update());
      
      this._isRendering = false;
    }

    // @vdom - Render Virtual DOM node
    _renderVNode(vNode, ctx) {
      if (!vNode) return null;

      // @text
      if (vNode.type === 'text') return document.createTextNode(this._evalText(vNode.text, ctx));

      // @fragment
      if (vNode.tag === 'fragment') {
        const frag = document.createDocumentFragment();
        vNode.children.forEach(child => {
          const node = this._renderVNode(child, ctx);
          if (node) frag.appendChild(node);
        });
        return frag;
      }

      // @if, @show, @hide
      if (vNode.directives['@if'] && !this._evalExpr(vNode.directives['@if'], ctx)) return null;
      if (vNode.directives['@show'] && !this._evalExpr(vNode.directives['@show'], ctx)) return null;
      if (vNode.directives['@hide'] && this._evalExpr(vNode.directives['@hide'], ctx)) return null;

      // @for
      if (vNode.directives['@for']) {
        const m = vNode.directives['@for'].match(/(\w+) in (.+)/);
        if (m) {
          const [, it, expr] = m;
          let arr = this._evalExpr(expr, ctx) || [];
          if (typeof arr === 'object' && !Array.isArray(arr)) arr = Object.values(arr);
          const frag = document.createDocumentFragment();
          arr.forEach(val => {
            const subCtx = { ...ctx, [it]: val };
            vNode.children.forEach(c => {
              const node = this._renderVNode(c, subCtx);
              if (node) frag.appendChild(node);
            });
          });
          return frag;
        }
      }

      // @switch, @case, @default
      if (vNode.directives['@switch']) {
        const swVal = this._evalExpr(vNode.directives['@switch'], ctx);
        let defaultNode = null;
        for (const child of vNode.children) {
          if (!child.directives) continue;
          if (child.directives['@case'] != null) {
            let cv = child.directives['@case'];
            if (/^['"].*['"]$/.test(cv)) cv = cv.slice(1, -1);
            if (String(cv) === String(swVal)) return this._renderVNode(child, ctx);
          }
          if (child.directives['@default'] != null) defaultNode = child;
        }
        return defaultNode ? this._renderVNode(defaultNode, ctx) : document.createComment('noswitch');
      }

      // @source, @map, @filter, @reduce (functional)
      if (vNode.directives['@source']) {
        const arr = this._evalExpr(vNode.directives['@source'], ctx) || [];
        const setState = (key, val) => {
          if (JSON.stringify(this.state[key]) !== JSON.stringify(val)) {
            Object.defineProperty(this.state, key, { value: val, writable: true, configurable: true, enumerable: true });
          }
        };
        let used = false;
        if (vNode.directives['@map']) {
          used = true;
          const fn = new Function('item', `return (${vNode.directives['@map']})`);
          setState(vNode.directives['@result'] || 'result', arr.map(fn));
        }
        if (vNode.directives['@filter']) {
          used = true;
          const fn = new Function('item', `return (${vNode.directives['@filter']})`);
          setState(vNode.directives['@result'] || 'result', arr.filter(fn));
        }
        if (vNode.directives['@reduce']) {
          used = true;
          const str = vNode.directives['@reduce'];
          let redFn;
          if (str.includes('=>')) {
            const [params, body] = str.split('=>').map(s => s.trim());
            const [a, b] = params.replace(/[()]/g, '').split(',').map(s => s.trim());
            redFn = new Function(a, b, `return (${body})`);
          } else {
            redFn = new Function('acc','item', `return (${str})`);
          }
          const initial = vNode.directives['@initial'] ? this._evalExpr(vNode.directives['@initial'], ctx) : undefined;
          const result = initial !== undefined ? arr.reduce(redFn, initial) : arr.reduce(redFn);
          setState(vNode.directives['@result'] || 'result', result);
        }
        if (used) return document.createComment('functional');
      }

      // Gestione speciale per il tag component con @src
      if (vNode.tag === 'component' && vNode.directives['@src']) {
        // Migliore gestione dell'URL del componente
        let srcUrl = null;
        
        // Prima prova a valutare l'espressione
        try {
          srcUrl = this._evalExpr(vNode.directives['@src'], ctx);
        } catch (e) {
          console.warn('Errore nella valutazione di @src:', e);
        }
        
        // Se l'URL è ancora undefined o null, prova ad interpretarlo come stringa letterale
        if (!srcUrl) {
          const rawSrc = vNode.directives['@src'].trim();
          // Se è una stringa quotata, rimuovi le quote
          if (/^['"].*['"]$/.test(rawSrc)) {
            srcUrl = rawSrc.slice(1, -1);
          } else {
            // Altrimenti usa il valore così com'è
            srcUrl = rawSrc;
          }
        }
        
        // Controlla che l'URL sia valido
        if (!srcUrl || srcUrl === 'undefined' || srcUrl === 'null') {
          console.error('URL del componente non valido:', vNode.directives['@src']);
          const errorEl = document.createElement('div');
          errorEl.className = 'component-error';
          errorEl.textContent = `Errore: URL componente non valido (${vNode.directives['@src']})`;
          return errorEl;
        }
        
        // Se il componente è caricato, lo renderizza
        if (this._componentCache[srcUrl]) {
          const componentHtml = this._componentCache[srcUrl];
          
          // Crea un fragment dal HTML del componente
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = componentHtml;
          
          // Parsa il contenuto del componente come nuovo vDOM
          const componentVNode = this.parse(tempDiv);
          
          // Renderizza il componente nel contesto corrente
          if (componentVNode && componentVNode.children) {
            const frag = document.createDocumentFragment();
            componentVNode.children.forEach(child => {
              const node = this._renderVNode(child, ctx);
              if (node) frag.appendChild(node);
            });
            return frag;
          }
        }
        
        // Se il componente non è ancora caricato e non è in caricamento, avvia il caricamento
        if (!this._componentCache[srcUrl] && !this._loadingComponents.has(srcUrl)) {
          this._loadingComponents.add(srcUrl);
          
          // Avvia il caricamento asincrono
          fetch(srcUrl)
            .then(res => {
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
              }
              return res.text();
            })
            .then(html => {
              this._componentCache[srcUrl] = html;
              this._loadingComponents.delete(srcUrl);
              // Re-render solo se non stiamo già renderizzando
              if (!this._isRendering) {
                requestAnimationFrame(() => this.render());
              }
            })
            .catch(err => {
              console.error(`Errore caricamento componente ${srcUrl}:`, err);
              this._componentCache[srcUrl] = `<div class="component-error">Errore: ${err.message}</div>`;
              this._loadingComponents.delete(srcUrl);
              if (!this._isRendering) {
                requestAnimationFrame(() => this.render());
              }
            });
        }
        
        // Restituisce un placeholder con informazioni più dettagliate
        const placeholder = document.createElement('div');
        placeholder.className = 'component-loading';
        if (this._loadingComponents.has(srcUrl)) {
          placeholder.textContent = `Caricamento componente: ${srcUrl}`;
        } else if (this._componentCache[srcUrl] && this._componentCache[srcUrl].includes('component-error')) {
          placeholder.innerHTML = this._componentCache[srcUrl];
        } else {
          placeholder.textContent = `In attesa del componente: ${srcUrl}`;
        }
        return placeholder;
      }

      // @element - Create real DOM element
      const el = document.createElement(vNode.tag);

      // @attr - Set attributes
      Object.entries(vNode.attrs).forEach(([k, v]) => {
        el.setAttribute(k, this._evalAttrValue(v, ctx));
      });

      // @fetch - Unified fetch helper
      // ---------------------------------
      if (!this._pendingFetches) this._pendingFetches = {};
      if (!this._lastFetchUrl) this._lastFetchUrl = {};
      const setupFetch = (expr, rk, event, force) => {
        let url = this._evalExpr(expr, ctx, event);
        if (url === undefined) {
          url = expr.replace(/\{([^}]+)\}/g, (_, key) => {
            const val = this._evalExpr(key, ctx, event);
            return val != null ? val : '';
          });
        }
        if (!url) return;
        const fid = `${url}::${rk}`;
        // Only fetch if url changed or force is true
        if (!force && this._lastFetchUrl[rk] === url) return;
        if (this._pendingFetches[fid]) return;
        this._pendingFetches[fid] = true;
        this._lastFetchUrl[rk] = url;
        fetch(url)
          .then(res => res.ok ? res.json() : Promise.reject(res.status))
          .then(data => {
            const oldVal = this.state[rk];
            const isEqual = JSON.stringify(oldVal) === JSON.stringify(data);
            if (!isEqual) {
              this.state[rk] = data;
            }
          })
          .catch(err => console.error('@fetch error:', err))
          .finally(() => {
            delete this._pendingFetches[fid];
          });
      };
      // ---------------------------------

      // @directives - Main directives
      // ---------------------------------
      // @click
      if (vNode.directives['@click']) {
        el.addEventListener('click', e => {
          new Function('state','ctx','event', `with(state){with(ctx){${vNode.directives['@click']}}}`)
            (this.state, ctx, e);
          this.render();
        });
      }

      // @hover
      if (vNode.directives['@hover']) {
        // hover applies expression on enter and restores on leave
        const expr = vNode.directives['@hover'];
        const applyHover = e => {
          try {
            new Function('state','ctx','event', `with(state){with(ctx){${expr}}}`)
              (this.state, ctx, e);
          } catch (err) {
            console.error('Error in @hover:', err);
          }
          this.render();
        };
        el.addEventListener('mouseover', applyHover);
        el.addEventListener('mouseout', applyHover);
      }

      // @children
      vNode.children.forEach(child => {
        const node = this._renderVNode(child, ctx);
        if (node) el.appendChild(node);
      });

      // @sub-directives
      Object.entries(vNode.subDirectives).forEach(([dir, evs]) => {
        Object.entries(evs).forEach(([evt, expr]) => {
          const eventName = evt === 'hover' ? 'mouseover' : evt;

          if (dir === '@fetch') {
            el.addEventListener(eventName, e => setupFetch(expr, vNode.directives['@result'] || 'result', e, true));
            return;
          }

          if (dir === '@class') {
            if (evt === 'hover') {
              el.addEventListener('mouseover', e => {
                const clsMap = this._evalExpr(expr, ctx, e) || {};
                Object.entries(clsMap).forEach(([cls, cond]) => {
                  if (cond) el.classList.add(cls);
                });
              });
              el.addEventListener('mouseout', e => {
                const clsMap = this._evalExpr(expr, ctx, e) || {};
                Object.entries(clsMap).forEach(([cls, cond]) => {
                  if (cond) el.classList.remove(cls);
                });
              });
            } else {
              el.addEventListener(eventName, e => {
                const clsMap = this._evalExpr(expr, ctx, e) || {};
                Object.entries(clsMap).forEach(([cls, cond]) => {
                  if (cond) el.classList.add(cls);
                  else el.classList.remove(cls);
                });
              });
            }
            return;
          }

          if (dir === '@text') {
            if (!el._ayishaOriginal) el._ayishaOriginal = el.textContent;
            if (evt === 'click') {
              el.addEventListener('click', e => {
                el.textContent = this._evalExpr(expr, ctx, e);
              });
            } else if (evt === 'hover') {
              el.addEventListener('mouseover', e => {
                el.textContent = this._evalExpr(expr, ctx, e);
              });
              el.addEventListener('mouseout', () => {
                el.textContent = el._ayishaOriginal;
              });
            }
          }
        });
      });

      // @fetch (default)
      if (vNode.directives['@fetch'] && !vNode.subDirectives['@fetch']) {
        const expr = vNode.directives['@fetch'];
        const rk = vNode.directives['@result'] || 'result';
        setupFetch(expr, rk); // fetch solo se url cambia
        if (vNode.directives['@watch']) {
          vNode.directives['@watch'].split(',').forEach(watchExpr => {
            watchExpr = watchExpr.trim();
            // Support both "prop" and "prop=>code" or "prop: code"
            let match = watchExpr.match(/^(\w+)\s*=>\s*(.+)$/) || watchExpr.match(/^(\w+)\s*:\s*(.+)$/);
            if (match) {
              const prop = match[1];
              const code = match[2];
              this.addWatcher(prop, function(newVal) {
                const state = window.ayisha.state;
                try {
                  // Auto-initialize arrays for .push usage in watcher code
                  const pushMatch = code.match(/state\.(\w+)\.push\s*\(/) || code.match(/(\w+)\.push\s*\(/);
                  if (pushMatch) {
                    const arrName = pushMatch[1];
                    if (!state[arrName]) state[arrName] = [];
                  }
                  new Function('state','newVal', `
                    with(state){ 
                      const {${Object.keys(state).join(',')}} = state;
                      ${code}
                    }
                  `)(state, newVal);
                } catch (e) {
                  console.error('Watcher error:', e, code);
                }
              });
            } else {
              // Simple watcher: just refetch
              this.addWatcher(watchExpr, () => setupFetch(expr, rk, undefined, true));
            }
          });
        }
      }

      // @watch (generic, not fetch)
      if (vNode.directives['@watch'] && !vNode.directives['@fetch']) {
        vNode.directives['@watch'].split(',').forEach(watchExpr => {
          watchExpr = watchExpr.trim();
          let match = watchExpr.match(/^(\w+)\s*=>\s*(.+)$/) || watchExpr.match(/^(\w+)\s*:\s*(.+)$/);
          if (match) {
            const prop = match[1];
            const code = match[2];
            this.addWatcher(prop, function(newVal) {
              const state = window.ayisha.state;
              try {
                const pushMatch = code.match(/state\.(\w+)\.push\s*\(/) || code.match(/(\w+)\.push\s*\(/);
                if (pushMatch) {
                  const arrName = pushMatch[1];
                  if (!state[arrName]) state[arrName] = [];
                }
                new Function('state','newVal', `
                  with(state){ 
                    const {${Object.keys(state).join(',')}} = state;
                    ${code}
                  }
                `)(state, newVal);
              } catch (e) {
                console.error('Watcher error:', e, code);
              }
            });
          }
        });
      }

      // @text (static)
      if (vNode.directives['@text'] && !vNode.subDirectives['@text']) {
        el.textContent = this._evalExpr(vNode.directives['@text'], ctx);
      }

      // @model
      if (vNode.directives['@model']) this._bindModel(el, vNode.directives['@model'], ctx);

      // @class
      if (vNode.directives['@class'] && !vNode.subDirectives['@class']) {
        const clsMap = this._evalExpr(vNode.directives['@class'], ctx) || {};
        Object.entries(clsMap).forEach(([cls, cond]) => el.classList.toggle(cls, !!cond));
      }
      // @style
      if (vNode.directives['@style']) {
        const styles = this._evalExpr(vNode.directives['@style'], ctx) || {};
        Object.entries(styles).forEach(([prop, val]) => el.style[prop] = val);
      }
      // @validate
      if (vNode.directives['@validate']) this._bindValidation(el, vNode.directives['@validate']);
      // @link
      if (vNode.directives['@link']) {
        el.setAttribute('href', vNode.directives['@link']);
        el.addEventListener('click', e => {
          e.preventDefault();
          this.state.currentPage = vNode.directives['@link'];
        });
      }
      // @page
      if (vNode.directives['@page'] && this.state.currentPage !== vNode.directives['@page']) return null;
      // @animate
      if (vNode.directives['@animate']) el.classList.add(vNode.directives['@animate']);
      // @component (inline)
      if (vNode.directives['@component']) {
        const n = vNode.directives['@component'];
        if (this.components[n]) {
          const frag = document.createRange().createContextualFragment(this.components[n]);
          const compVNode = this.parse(frag);
          const compEl = this._renderVNode(compVNode, ctx);
          if (compEl) el.appendChild(compEl);
        }
      }
      // ---------------------------------

      return el;
    }

    // @mount - Mount the app
    mount() {
      // Se il root ha più figli, crea un fragment vNode ESCLUDENDO <init>
      if (this.root.childNodes.length > 1) {
        const fragVNode = { tag: 'fragment', attrs: {}, directives: {}, subDirectives: {}, children: [] };
        this.root.childNodes.forEach(child => {
          // Escludi nodi <init>
          if (child.nodeType === 1 && child.tagName && child.tagName.toLowerCase() === 'init') return;
          const cn = this.parse(child);
          if (cn) fragVNode.children.push(cn);
        });
        this._vdom = fragVNode;
      } else {
        this._vdom = this.parse(this.root);
      }
      this._makeReactive();
      this._runInitBlocks();
      this._setupRouting();
      const self = this;
      let cp = this.state.currentPage;
      Object.defineProperty(this.state, 'currentPage', {
        get() { return cp; },
        set(v) {
          if (cp !== v) {
            cp = v;
            history.pushState({}, '', '/' + v);
            self.render();
          }
        }
      });
      this.render();
      this.root.addEventListener('click', e => {
        let el = e.target;
        while (el && el !== this.root) {
          if (el.hasAttribute('@link')) {
            e.preventDefault();
            this.state.currentPage = el.getAttribute('@link');
            return;
          }
          el = el.parentNode;
        }
      }, true);
    }
  }

  window.AyishaVDOM = AyishaVDOM;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AyishaVDOM(document.body).mount());
  } else {
    new AyishaVDOM(document.body).mount();
  }
})();