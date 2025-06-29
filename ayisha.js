(function () {
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
          const name = attr.name;
          const parts = name.split(':');
          if (parts.length === 2) {
            const [dir, evt] = parts;
            vNode.subDirectives[dir] = vNode.subDirectives[dir] || {};
            vNode.subDirectives[dir][evt] = attr.value;
          } else {
            vNode.directives[name] = attr.value;
          }
        } else {
          vNode.attrs[attr.name] = attr.value;
        }
      }
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
      const old = obj[prop];
      // se uguali (anche come oggetti), non scattare watcher né render
      if (JSON.stringify(old) === JSON.stringify(val)) {
        obj[prop] = val;
        return true;
      }
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
      if (this._componentCache[url]) {
        return this._componentCache[url];
      }
      if (this._loadingComponents.has(url)) {
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
        return new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){return (${expr})}}`)(sp, ctx, event);
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
      let result = val.replace(/{{(.*?)}}/g, (_, e) => {
        const r = this._evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
      result = result.replace(/\[\{(.*?)\}\]/g, (_, e) => {
        const r = this._evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
      if (/^\{([^{}]+)\}$/.test(result.trim())) {
        const expr = result.trim().slice(1, -1);
        const r = this._evalExpr(expr, ctx);
        return r != null ? r : '';
      }
      result = result.replace(/\{([^{}]+)\}/g, (match, e) => {
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
        new Function('state', 'ctx', 'value', `with(state){with(ctx||{}){${key}=value}}`)(this.state, ctx, el.value);
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
        if (
          node &&
          (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA')
        ) {
          node.focus();
          try {
            if (
              (node.tagName === 'INPUT' && typeof node.selectionStart === 'number' && typeof node.setSelectionRange === 'function' && node.type !== 'number') ||
              node.tagName === 'TEXTAREA'
            ) {
              node.setSelectionRange(focusInfo.start, focusInfo.end);
            }
          } catch (e) { }
        }
      }
      this._modelBindings.forEach(b => b.update());

      this._isRendering = false;
    }

    // @vdom - Render Virtual DOM node
    _renderVNode(vNode, ctx) {
      if (!vNode) return null;

      // --- ERROR HANDLING FOR UNKNOWN DIRECTIVES/SUB-DIRECTIVES ---
      let unknownDirective = null;
      let unknownSubDirective = null;
      let unknownSubDirectiveEvt = null;
      if (vNode && vNode.directives) {
        for (const dir of Object.keys(vNode.directives)) {
          if (dir === '@src' && vNode.tag === 'component') continue;
          if (!this.directiveHelp(dir) || this.directiveHelp(dir).startsWith('Nessun esempio')) {
            unknownDirective = dir;
            break;
          }
        }
      }
      if (!unknownDirective && vNode && vNode.subDirectives) {
        for (const [dir, evs] of Object.entries(vNode.subDirectives)) {
          for (const evt of Object.keys(evs)) {
            const key = `${dir}:${evt}`;
            if (!this.directiveHelp(key) || this.directiveHelp(key).startsWith('Nessun esempio')) {
              unknownSubDirective = dir;
              unknownSubDirectiveEvt = evt;
              break;
            }
          }
          if (unknownSubDirective) break;
        }
      }
      if (unknownDirective || unknownSubDirective) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'ayisha-directive-error';
        errorDiv.style.background = '#c00';
        errorDiv.style.color = '#fff';
        errorDiv.style.padding = '1em';
        errorDiv.style.margin = '0.5em 0';
        errorDiv.style.borderRadius = '4px';
        errorDiv.style.fontWeight = 'bold';
        errorDiv.style.border = '1px solid #900';
        let msg = '';
        if (unknownDirective) {
          msg = `Error: Unknown directive <b>${unknownDirective}</b>.`;
          msg += '<br>' + this.directiveHelp(unknownDirective);
        } else {
          const key = `${unknownSubDirective}:${unknownSubDirectiveEvt}`;
          msg = `Error: Unknown sub-directive <b>${key}</b>.`;
          msg += '<br>' + this.directiveHelp(key);
        }
        errorDiv.innerHTML = msg;
        return errorDiv;
      }

      // --- NETWORK/PARSING ERRORS FOR ALL DIRECTIVES ---
      if (this._lastFetchUrl && this._fetched) {
        let foundError = null;
        let foundDir = null;
        let foundUrl = null;
        for (const dir in vNode.directives) {
          const rk = vNode.directives['@result'] || 'result';
          const url = this._lastFetchUrl[rk];
          if (url && this._fetched[url] && this._fetched[url].error) {
            foundError = this._fetched[url].error;
            foundDir = dir;
            foundUrl = url;
            break;
          }
        }
        if (foundError && foundDir) {
          const warnDiv = document.createElement('div');
          warnDiv.className = 'ayisha-directive-warning';
          warnDiv.style.background = '#ffeb3b';
          warnDiv.style.color = '#333';
          warnDiv.style.padding = '1em';
          warnDiv.style.margin = '0.5em 0';
          warnDiv.style.borderRadius = '4px';
          warnDiv.style.fontWeight = 'bold';
          warnDiv.style.border = '1px solid #e0c200';
          let allDirs = Object.entries(vNode.directives)
            .map(([k, v]) => `<b>${k}</b>: <code>${String(v)}</code>`)
            .join('<br>');
          warnDiv.innerHTML = `${allDirs}<br><b>Error:</b> ${foundError}`;
          return warnDiv;
        }
      }

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
            const clone = JSON.parse(JSON.stringify(vNode));
            delete clone.directives['@for'];
            const subCtx = { ...ctx, [it]: val };
            const node = this._renderVNode(clone, subCtx);
            if (node) frag.appendChild(node);
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
            redFn = new Function('acc', 'item', `return (${str})`);
          }
          const initial = vNode.directives['@initial'] ? this._evalExpr(vNode.directives['@initial'], ctx) : undefined;
          const result = initial !== undefined ? arr.reduce(redFn, initial) : arr.reduce(redFn);
          setState(vNode.directives['@result'] || 'result', result);
        }
        if (used) return document.createComment('functional');
      }

      // Gestione speciale per il tag component con @src
      if (vNode.tag === 'component') {
        if (!vNode.directives['@src']) {
          const errorEl = document.createElement('div');
          errorEl.className = 'ayisha-directive-error';
          errorEl.style.background = '#c00';
          errorEl.style.color = '#fff';
          errorEl.style.padding = '1em';
          errorEl.style.margin = '0.5em 0';
          errorEl.style.borderRadius = '4px';
          errorEl.style.fontWeight = 'bold';
          errorEl.style.border = '1px solid #900';
          errorEl.innerHTML = `Error: <b>&lt;component&gt;</b> requires the <b>@src</b> attribute (e.g. <code>&lt;component @src="file.html"&gt;</code>)`;
          return errorEl;
        }
        let srcUrl = null;
        try {
          srcUrl = this._evalExpr(vNode.directives['@src'], ctx);
        } catch (e) {
          console.warn('Error evaluating @src:', e);
        }
        if (!srcUrl) {
          const rawSrc = vNode.directives['@src'].trim();
          if (/^['"].*['"]$/.test(rawSrc)) {
            srcUrl = rawSrc.slice(1, -1);
          } else {
            srcUrl = rawSrc;
          }
        }
        if (!srcUrl || srcUrl === 'undefined' || srcUrl === 'null') {
          const errorEl = document.createElement('div');
          errorEl.className = 'ayisha-directive-error';
          errorEl.style.background = '#c00';
          errorEl.style.color = '#fff';
          errorEl.style.padding = '1em';
          errorEl.style.margin = '0.5em 0';
          errorEl.style.borderRadius = '4px';
          errorEl.style.fontWeight = 'bold';
          errorEl.style.border = '1px solid #900';
          errorEl.innerHTML = `Error: Invalid component URL (<b>${vNode.directives['@src']}</b>)`;
          return errorEl;
        }
        if (this._componentCache[srcUrl] && this._componentCache[srcUrl].includes('component-error')) {
          const errorEl = document.createElement('div');
          errorEl.className = 'ayisha-directive-error';
          errorEl.style.background = '#c00';
          errorEl.style.color = '#fff';
          errorEl.style.padding = '1em';
          errorEl.style.margin = '0.5em 0';
          errorEl.style.borderRadius = '4px';
          errorEl.style.fontWeight = 'bold';
          errorEl.style.border = '1px solid #900';
          errorEl.innerHTML = `Error: component <b>${srcUrl}</b> not rendered or not found.`;
          return errorEl;
        }
        if (this._componentCache[srcUrl]) {
          const componentHtml = this._componentCache[srcUrl];
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = componentHtml;
          const componentVNode = this.parse(tempDiv);
          if (componentVNode && componentVNode.children) {
            const frag = document.createDocumentFragment();
            componentVNode.children.forEach(child => {
              const node = this._renderVNode(child, ctx);
              if (node) frag.appendChild(node);
            });
            return frag;
          }
        }
        if (!this._componentCache[srcUrl] && !this._loadingComponents.has(srcUrl)) {
          this._loadingComponents.add(srcUrl);
          fetch(srcUrl)
            .then(res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
              return res.text();
            })
            .then(html => {
              this._componentCache[srcUrl] = html;
              this._loadingComponents.delete(srcUrl);
              if (!this._isRendering) requestAnimationFrame(() => this.render());
            })
            .catch(err => {
              this._componentCache[srcUrl] = `<div class="component-error">Errore: ${err.message}</div>`;
              this._loadingComponents.delete(srcUrl);
              if (!this._isRendering) requestAnimationFrame(() => this.render());
            });
        }
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

      // --- NUOVA DIRETTIVA @state ---
      if (vNode.directives.hasOwnProperty('@state')) {
        // wrapper semitrasparente
        const wrapper = document.createElement('div');
        wrapper.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        wrapper.style.color = '#fff';
        wrapper.style.padding = '1em';
        wrapper.style.borderRadius = '4px';
        wrapper.style.marginTop = '1em';
        wrapper.style.overflow = 'auto';

        // titolo
        const title = document.createElement('h3');
        title.textContent = 'CURRENT STATE';
        title.style.margin = '0.5em 0 2em';
        title.style.fontSize = '1.1em';
        title.style.fontWeight = 'bold';
        title.style.color = '#fff';
        wrapper.appendChild(title);

        // pre con JSON formattato
        const pre = document.createElement('pre');
        pre.style.margin = '0';
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.fontFamily = 'monospace';
        pre.textContent = JSON.stringify(this.state, null, 2);
        wrapper.appendChild(pre);

        el.appendChild(wrapper);
      }

      // --- NUOVA DIRETTIVA @log ---
      let logWrapper = null;
      let fetchLogInfo = null;
      if (vNode.directives.hasOwnProperty('@log')) {
        logWrapper = document.createElement('div');
        logWrapper.className = 'ayisha-console-wrapper';
        logWrapper.style.background = '#222';
        logWrapper.style.color = '#fff';
        logWrapper.style.padding = '1em';
        logWrapper.style.borderRadius = '4px';
        logWrapper.style.marginTop = '1em';
        logWrapper.style.overflow = 'auto';
        logWrapper.style.fontSize = '0.95em';
        logWrapper.style.fontFamily = 'monospace';
        logWrapper.style.border = '1px solid #444';

        const title = document.createElement('div');
        title.textContent = 'AYISHA LOG';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '0.5em';
        title.style.letterSpacing = '1px';
        logWrapper.appendChild(title);

        // Helper per mostrare valore o errore
        const renderValue = (expr, ctx) => {
          try {
            const val = this._evalExpr(expr, ctx);
            if (typeof val === 'object') return `<pre style=\"color:#fff;background:#333;padding:0.5em;border-radius:3px;overflow:auto;width:100%;\">${JSON.stringify(val, null, 2)}</pre>`;
            return `<span style=\"color:#0f0\">${String(val)}</span>`;
          } catch (err) {
            return `<span style=\"color:#f55\">Errore: ${err.message}</span>`;
          }
        };

        // Se c'è una fetch, mostra info dettagliate
        let fetchDir = null, fetchExpr = null, fetchType = null;
        Object.entries(vNode.directives).forEach(([dir, expr]) => {
          if (dir.startsWith('@fetch')) {
            fetchDir = dir;
            fetchExpr = expr;
            fetchType = 'directive';
          }
        });
        Object.entries(vNode.subDirectives).forEach(([dir, evs]) => {
          if (dir === '@fetch') {
            Object.entries(evs).forEach(([evt, expr]) => {
              fetchDir = `${dir}:${evt}`;
              fetchExpr = expr;
              fetchType = 'subdirective';
            });
          }
        });
        if (fetchDir) {
          // Ricava url, method, headers, payload
          let url = null, method = 'GET', headers = {}, payload = null;
          try {
            url = this._evalExpr(fetchExpr, ctx);
          } catch { }
          // Se la fetch è una subdirettiva con assegnazione (es: url=...), estrai url
          if (!url && typeof fetchExpr === 'string') {
            const m = fetchExpr.match(/([\w$]+)\s*=\s*(.+)/);
            if (m) url = this._evalExpr(m[2], ctx);
          }
          // Se la fetch è una POST/PUT/DELETE, cerca @method, @headers, @payload
          if (vNode.directives['@method']) method = this._evalExpr(vNode.directives['@method'], ctx) || 'GET';
          if (vNode.directives['@headers']) headers = this._evalExpr(vNode.directives['@headers'], ctx) || {};
          if (vNode.directives['@payload']) payload = this._evalExpr(vNode.directives['@payload'], ctx);

          // Migliora la visualizzazione di url (stringa, oggetto, array)
          let urlHtml = '';
          if (typeof url === 'string') {
            urlHtml = `<span style=\"color:#0ff\">${url}</span>`;
          } else if (url && typeof url === 'object') {
            // Mostra sia l'oggetto che la stringa interpolata risultante da _evalAttrValue
            let asString = '';
            try {
              asString = this._evalAttrValue(fetchExpr, ctx);
            } catch { }
            if (asString && typeof asString === 'string' && asString !== '[object Object]') {
              urlHtml = `<span style=\"color:#0ff\">${asString}</span>`;
            } else {
              urlHtml = `<pre style=\"color:#0ff;background:#222;padding:0.3em;display:inline-block;max-width:400px;overflow:auto;\">${JSON.stringify(url, null, 2)}</pre>`;
            }
          } else {
            urlHtml = '<i>undefined</i>';
          }

          // Migliora la visualizzazione di headers
          let headersHtml = '';
          if (headers && typeof headers === 'object' && Object.keys(headers).length) {
            headersHtml = `<pre style=\"color:#0ff;background:#222;padding:0.3em;display:inline-block;max-width:400px;overflow:auto;\">${JSON.stringify(headers, null, 2)}</pre>`;
          } else {
            headersHtml = '{}';
          }

          // Migliora la visualizzazione di payload
          let payloadHtml = '';
          if (payload !== null && payload !== undefined) {
            if (typeof payload === 'object') {
              payloadHtml = `<pre style=\"color:#0ff;background:#222;padding:0.3em;display:inline-block;max-width:400px;overflow:auto;\">${JSON.stringify(payload, null, 2)}</pre>`;
            } else {
              payloadHtml = `<span style=\"color:#0ff\">${String(payload)}</span>`;
            }
          }

          const fetchInfo = document.createElement('div');
          fetchInfo.style.marginBottom = '0.5em';
          fetchInfo.innerHTML = `<b style=\"color:#ffd700\">${fetchDir}</b><br>` +
            `<b style=\"color:#aaa\">URL:</b> ${urlHtml}<br>` +
            `<b style=\"color:#aaa">Method:</b> <span style=\"color:#0ff\">${method}</span><br>` +
            `<b style=\"color:#aaa\">Headers:</b> ${headersHtml}<br>` +
            (payloadHtml ? `<b style=\"color:#aaa\">Payload:</b> ${payloadHtml}<br>` : '');
          logWrapper.appendChild(fetchInfo);
        }

        // Direttive normali
        Object.entries(vNode.directives).forEach(([dir, expr]) => {
          if (dir === '@log') return;
          // Evita duplicati per @fetch già mostrato sopra
          if (dir === fetchDir) return;
          // Evita duplicati per @watch già mostrato sopra
          if (dir === '@watch' && fetchLogInfo && fetchLogInfo.watch) return;
          let info = '';
          if (dir === '@model') {
            // Mostra la proprietà agganciata e il valore attuale
            const val = this._evalExpr(expr, ctx);
            info = `<span style=\"color:#0ff\">(proprietà: <b>${expr}</b>, valore: <b>${val}</b>)</span>`;
          } else if (dir === '@watch') {
            info = `<span style=\"color:#0ff\">(osserva: <b>${expr}</b>)</span>`;
          } else if (dir === '@text') {
            const val = this._evalExpr(expr, ctx);
            info = `<span style=\"color:#0ff\">(valore: <b>${val}</b>)</span>`;
          } else if (dir === '@class') {
            const val = this._evalExpr(expr, ctx);
            info = `<span style=\"color:#0ff\">(classi: <b>${JSON.stringify(val)}</b>)</span>`;
          } else if (dir === '@style') {
            const val = this._evalExpr(expr, ctx);
            info = `<span style=\"color:#0ff\">(stili: <b>${JSON.stringify(val)}</b>)</span>`;
          } else if (dir === '@validate') {
            info = `<span style=\"color:#0ff\">(regole: <b>${expr}</b>)</span>`;
          } else if (dir === '@result') {
            const val = this._evalExpr(expr, ctx);
            info = `<span style=\"color:#0ff\">(variabile: <b>${expr}</b>, valore: <b>${JSON.stringify(val)}</b>)</span>`;
          } else if (dir === '@for') {
            info = `<span style=\"color:#0ff\">(iterazione: <b>${expr}</b>)</span>`;
          } else if (dir === '@if' || dir === '@show' || dir === '@hide') {
            const val = this._evalExpr(expr, ctx);
            info = `<span style=\"color:#0ff\">(condizione: <b>${expr}</b> = <b>${val}</b>)</span>`;
          } else if (dir === '@component') {
            info = `<span style=\"color:#0ff\">(componente: <b>${expr}</b>)</span>`;
          } else if (dir === '@set') {
            info = `<span style=\"color:#0ff\">(assegnazione: <b>${expr}</b>)</span>`;
          } else if (dir === '@key') {
            info = `<span style=\"color:#0ff\">(chiave: <b>${expr}</b>)</span>`;
          } else if (dir === '@page') {
            info = `<span style=\"color:#0ff\">(pagina: <b>${expr}</b>)</span>`;
          } else if (dir === '@animate') {
            info = `<span style=\"color:#0ff\">(animazione: <b>${expr}</b>)</span>`;
          }
          const row = document.createElement('div');
          row.style.marginBottom = '0.5em';
          row.innerHTML = `<b style=\"color:#ffd700\">${dir}</b>: <span>${renderValue(expr, ctx)}</span> ${info}`;
          logWrapper.appendChild(row);
        });
        // Sub-direttive
        Object.entries(vNode.subDirectives).forEach(([dir, evs]) => {
          if (dir === '@fetch') return;
          Object.entries(evs).forEach(([evt, expr]) => {
            let info = '';
            if (dir === '@model') {
              const val = this._evalExpr(expr, ctx);
              info = `<span style=\"color:#0ff\">(proprietà: <b>${expr}</b>, valore: <b>${val}</b>, evento: <b>${evt}</b>)</span>`;
            } else if (dir === '@watch') {
              info = `<span style=\"color:#0ff\">(osserva: <b>${expr}</b>, evento: <b>${evt}</b>)</span>`;
            } else if (dir === '@text') {
              const val = this._evalExpr(expr, ctx);
              info = `<span style=\"color:#0ff\">(valore: <b>${val}</b>, evento: <b>${evt}</b>)</span>`;
            } else if (dir === '@class') {
              const val = this._evalExpr(expr, ctx);
              info = `<span style=\"color:#0ff\">(classi: <b>${JSON.stringify(val)}</b>, evento: <b>${evt}</b>)</span>`;
            } else if (dir === '@style') {
              const val = this._evalExpr(expr, ctx);
              info = `<span style=\"color:#0ff\">(stili: <b>${JSON.stringify(val)}</b>, evento: <b>${evt}</b>)</span>`;
            } else if (dir === '@set') {
              info = `<span style=\"color:#0ff\">(assegnazione: <b>${expr}</b>, evento: <b>${evt}</b>)</span>`;
            }
            const key = `${dir}:${evt}`;
            const row = document.createElement('div');
            row.style.marginBottom = '0.5em';
            row.innerHTML = `<b style=\"color:#ffd700\">${key}</b>: <span>${renderValue(expr, ctx)}</span> ${info}`;
            logWrapper.appendChild(row);
          });
        });
      }

      // @fetch - Unified fetch helper
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
        if (!force && this._lastFetchUrl[rk] === url) return;
        if (this._pendingFetches[fid]) return;
        this._pendingFetches[fid] = true;
        this._lastFetchUrl[rk] = url;
        fetch(url)
          .then(res => {
            if (!res.ok) {
              if (!this._fetched[url]) this._fetched[url] = {};
              this._fetched[url].error = `${res.status} ${res.statusText || 'errore di rete'}`;
              throw new Error(`${res.status} ${res.statusText}`);
            }
            return res.json();
          })
          .then(data => {
            // Se la variabile @result non esiste nello state, la crea
            if (!(rk in this.state)) {
              this.state[rk] = undefined;
            }
            const oldVal = this.state[rk];
            const isEqual = JSON.stringify(oldVal) === JSON.stringify(data);
            if (!isEqual) {
              this.state[rk] = data;
            }
            if (this._fetched[url]) delete this._fetched[url].error;
          })
          .catch(err => {
            if (!this._fetched[url]) this._fetched[url] = {};
            if (!this._fetched[url].error) this._fetched[url].error = err.message;
            console.error('@fetch error:', err);
          })
          .finally(() => {
            delete this._pendingFetches[fid];
          });
      };

      // ---------------------------------

      // @click
      if (vNode.directives['@click']) {
        el.addEventListener('click', e => {
          const expr = vNode.directives['@click'];
          this._ensureVarInState(expr);
          let codeToRun = expr;
          if (this._hasInterpolation(expr)) {
            codeToRun = this._evalAttrValue(expr, ctx);
          }
          try {
            new Function('state', 'ctx', 'event', `with(state){with(ctx){${codeToRun}}}`)
              (this.state, ctx, e);
          } catch (err) {
            this._showAyishaError(el, err, codeToRun);
          }
          this.render();
        });
      }

      // @hover
      if (vNode.directives['@hover']) {
        const rawExpr = vNode.directives['@hover'];
        const applyHover = e => {
          let codeToRun = rawExpr;
          if (this._hasInterpolation(rawExpr)) {
            codeToRun = this._evalAttrValue(rawExpr, ctx);
          }
          try {
            new Function('state', 'ctx', 'event', `with(state){with(ctx){${codeToRun}}}`)
              (this.state, ctx, e);
          } catch (err) {
            this._showAyishaError(el, err, codeToRun);
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
          const isEvent = (
            dir === '@click' || dir === '@hover' || dir === '@set' || dir === '@fetch' ||
            dir === '@model' || dir === '@focus' || dir === '@blur' || dir === '@change' ||
            dir === '@input' || dir === '@class' || dir === '@text'
          ) && (
              evt === 'click' || evt === 'hover' || evt === 'focus' || evt === 'input' || evt === 'change' || evt === 'blur'
            );
          if (isEvent) {
            if (dir === '@fetch') {
              el.addEventListener(eventName, e => {
                // Gestione assegnazione tipo url=...
                let exprToRun = expr;
                let matchAssign = expr.match(/^([\w$]+)\s*=\s*(.+)$/);
                if (matchAssign && this._hasInterpolation(expr)) {
                  const varName = matchAssign[1];
                  let valueExpr = matchAssign[2].trim();
                  // Interpola la parte destra, mantenendo eventuali virgolette
                  let interpolated = this._evalAttrValue(valueExpr, ctx);
                  if (!(varName in this.state)) this.state[varName] = '';
                  this.state[varName] = interpolated;
                  setupFetch(varName, vNode.directives['@result'] || 'result', e, true);
                } else {
                  // Caso classico: esegui come codice JS puro o interpolato
                  this._ensureVarInState(expr);
                  let codeToRun = expr;
                  if (this._hasInterpolation(expr)) {
                    codeToRun = this._evalAttrValue(expr, ctx);
                  }
                  try {
                    new Function('state', 'ctx', 'event', `with(state){with(ctx){${codeToRun}}}`)
                      (this.state, ctx, e);
                  } catch (err) {
                    this._showAyishaError(el, err, codeToRun);
                  }
                  if (/^\w+$/.test(expr.trim())) {
                    setupFetch(expr.trim(), vNode.directives['@result'] || 'result', e, true);
                  }
                }
                this.render();
              });
              return;
            }
            if (dir === '@class') {
              if (evt === 'hover') {
                el.addEventListener('mouseover', e => {
                  let codeToRun = expr;
                  if (this._hasInterpolation(expr)) {
                    codeToRun = this._evalAttrValue(expr, ctx);
                  }
                  const clsMap = this._evalExpr(codeToRun, ctx, e) || {};
                  Object.entries(clsMap).forEach(([cls, cond]) => {
                    if (cond) el.classList.add(cls);
                  });
                });
                el.addEventListener('mouseout', e => {
                  let codeToRun = expr;
                  if (this._hasInterpolation(expr)) {
                    codeToRun = this._evalAttrValue(expr, ctx);
                  }
                  const clsMap = this._evalExpr(codeToRun, ctx, e) || {};
                  Object.entries(clsMap).forEach(([cls, cond]) => {
                    if (cond) el.classList.remove(cls);
                  });
                });
              } else {
                el.addEventListener(eventName, e => {
                  let codeToRun = expr;
                  if (this._hasInterpolation(expr)) {
                    codeToRun = this._evalAttrValue(expr, ctx);
                  }
                  const clsMap = this._evalExpr(codeToRun, ctx, e) || {};
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
                  let codeToRun = expr;
                  if (this._hasInterpolation(expr)) {
                    codeToRun = this._evalAttrValue(expr, ctx);
                  }
                  el.textContent = this._evalExpr(codeToRun, ctx, e);
                });
              } else if (evt === 'hover') {
                el.addEventListener('mouseover', e => {
                  let codeToRun = expr;
                  if (this._hasInterpolation(expr)) {
                    codeToRun = this._evalAttrValue(expr, ctx);
                  }
                  el.textContent = this._evalExpr(codeToRun, ctx, e);
                });
                el.addEventListener('mouseout', () => {
                  el.textContent = el._ayishaOriginal;
                });
              }
              return;
            }
            // Default: esegui come codice JS puro o interpolato se contiene pattern
            el.addEventListener(eventName, e => {
              let codeToRun = expr;
              if (this._hasInterpolation(expr)) {
                codeToRun = this._evalAttrValue(expr, ctx);
              }
              try {
                new Function('state', 'ctx', 'event', `with(state){with(ctx){${codeToRun}}}`)
                  (this.state, ctx, e);
              } catch (err) {
                this._showAyishaError(el, err, codeToRun);
              }
              this.render();
            });
            return;
          }

          // Per sub-direttive NON evento, mantieni l'interpolazione
          Object.entries(evs).forEach(([evt, expr]) => {
            const eventName = evt === 'hover' ? 'mouseover' : evt;

            // Interpolazione sempre
            const getInterpolatedExpr = () => this._evalAttrValue(expr, ctx);

            if (dir === '@fetch') {
              el.addEventListener(eventName, e => setupFetch(getInterpolatedExpr(), vNode.directives['@result'] || 'result', e, true));
              return;
            }

            if (dir === '@class') {
              if (evt === 'hover') {
                el.addEventListener('mouseover', e => {
                  const clsMap = this._evalExpr(getInterpolatedExpr(), ctx, e) || {};
                  Object.entries(clsMap).forEach(([cls, cond]) => {
                    if (cond) el.classList.add(cls);
                  });
                });
                el.addEventListener('mouseout', e => {
                  const clsMap = this._evalExpr(getInterpolatedExpr(), ctx, e) || {};
                  Object.entries(clsMap).forEach(([cls, cond]) => {
                    if (cond) el.classList.remove(cls);
                  });
                });
              } else {
                el.addEventListener(eventName, e => {
                  const clsMap = this._evalExpr(getInterpolatedExpr(), ctx, e) || {};
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
                  el.textContent = this._evalExpr(getInterpolatedExpr(), ctx, e);
                });
              } else if (evt === 'hover') {
                el.addEventListener('mouseover', e => {
                  el.textContent = this._evalExpr(getInterpolatedExpr(), ctx, e);
                });
                el.addEventListener('mouseout', () => {
                  el.textContent = el._ayishaOriginal;
                });
              }
            }
          });
        });
      });

      // @fetch (default)
      if (vNode.directives['@fetch'] && !vNode.subDirectives['@fetch']) {
        const expr = this._autoVarExpr(vNode.directives['@fetch']);
        const rk = vNode.directives['@result'] || 'result';
        setupFetch(expr, rk);
        if (vNode.directives['@watch']) {
          vNode.directives['@watch'].split(',').forEach(watchExpr => {
            watchExpr = watchExpr.trim();
            let match = watchExpr.match(/^([\w$]+)\s*=>\s*(.+)$/) || watchExpr.match(/^([\w$]+)\s*:\s*(.+)$/);
            if (match) {
              const prop = match[1];
              const code = match[2];
              window.ayisha._ensureVarInState(code);
              window.ayisha._ensureVarInState(code);
              this.addWatcher(prop, function (newVal) {
                const state = window.ayisha.state;
                try {
                  const pushMatch = code.match(/state\.(\w+)\.push\s*\(/) || code.match(/(\w+)\.push\s*\(/);
                  if (pushMatch) {
                    const arrName = pushMatch[1];
                    if (!state[arrName]) state[arrName] = [];
                  }
                  new Function('state', 'newVal', `
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
              this.addWatcher(watchExpr, () => setupFetch(expr, rk, undefined, true));
            }
          });
        }
      }

      // @watch (generic, non-fetch)
      if (vNode.directives['@watch'] && !vNode.directives['@fetch']) {
        vNode.directives['@watch'].split(',').forEach(watchExpr => {
          watchExpr = watchExpr.trim();
          const match = watchExpr.match(/^(\w+)\s*=>\s*(.+)$/)
            || watchExpr.match(/^(\w+)\s*:\s*(.+)$/);
          if (match) {
            const prop = match[1];
            const code = match[2];

            this.addWatcher(prop, function (newVal) {
              const state = window.ayisha.state;

              // ← NUOVA RIGA: assicuro che la var esista **al momento del callback**
              window.ayisha._ensureVarInState(code);

              try {
                // Se usa .push() inizializzo l’array
                const pushMatch = code.match(/(\w+)\.push\s*\(/);
                if (pushMatch) {
                  const arrName = pushMatch[1];
                  if (!state[arrName]) state[arrName] = [];
                }
                // Eseguo il codice dentro with(state){…}
                new Function('state', 'newVal', `
            with(state){
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

      // Alla fine della funzione, dopo aver costruito el normalmente
      if (logWrapper) {
        const frag = document.createDocumentFragment();
        frag.appendChild(el);
        frag.appendChild(logWrapper);
        return frag;
      }
      return el;
    }

    // @mount - Mount the app
    mount() {
      if (this.root.childNodes.length > 1) {
        const fragVNode = { tag: 'fragment', attrs: {}, directives: {}, subDirectives: {}, children: [] };
        this.root.childNodes.forEach(child => {
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

    // Help examples for each directive/sub-directive
    directiveHelp(name) {
      const help = {
        '@if': `Esempio: <div @if="condizione">Mostra se condizione è true</div>`,
        '@show': `Esempio: <div @show="condizione">Mostra se condizione è true</div>`,
        '@hide': `Esempio: <div @hide="condizione">Nasconde se condizione è true</div>`,
        '@for': `Esempio: <li @for="item in items">{{item}}</li>`,
        '@model': `Esempio: <input @model="nome">`,
        '@click': `Esempio: <button @click="state.count++">Aumenta</button>`,
        '@fetch': `Esempio: <div @fetch="'url'" @result="data">Carica</div>`,
        '@result': `Esempio: <div @fetch="'url'" @result="data">Carica</div>`,
        '@watch': `Esempio: <div @watch="prop=>console.log(prop)"></div>`,
        '@text': `Esempio: <span @text="nome"></span>`,
        '@class': `Esempio: <div @class="{rosso: condizione}"></div>`,
        '@style': `Esempio: <div @style="{color:'red'}"></div>`,
        '@validate': `Esempio: <input @validate="required,minLength:3">`,
        '@link': `Esempio: <a @link="pagina">Vai</a>`,
        '@page': `Esempio: <div @page="home">Solo su home</div>`,
        '@component': `Esempio: <component @src="comp.html"></component>`,
        '@set': `Esempio: <button @set:click="foo=1"></button>`,
        '@key': `Esempio: <li @for="item in items" @key="item.id"></li>`,
        '@src': `Esempio: <component @src="comp.html"></component>`,
        '@switch': `Esempio: <div @switch="valore"><div @case="1">Uno</div><div @default>Altro</div></div>`,
        '@case': `Esempio: <div @case="1">Uno</div>`,
        '@default': `Esempio: <div @default>Altro</div>`,
        '@source': `Esempio: <div @source="items" @map="item => item*2" @result="doppio"></div>`,
        '@map': `Esempio: <div @source="items" @map="item => item*2"></div>`,
        '@filter': `Esempio: <div @source="items" @filter="item > 0"></div>`,
        '@reduce': `Esempio: <div @source="items" @reduce="(acc, item) => acc+item" @initial="0"></div>`,
        '@initial': `Esempio: <div @source="items" @reduce="(acc, item) => acc+item" @initial="0"></div>`,
        '@animate': `Esempio: <div @animate="fade-in"></div>`,
        // **NUOVA**
        '@state': `Esempio: <div @state></div> (renderizza lo stato corrente come JSON)`,
        '@log': `Esempio: <div @log></div> (mostra il log delle direttive sull'elemento)`,
        // Sub-directives
        '@text:hover': `Esempio: <div @text:hover="'Testo hover'"></div>`,
        '@text:click': `Esempio: <div @text:click="'Testo click'"></div>`,
        '@text:input': `Esempio: <input @text:input="nome">`,
        '@text:focus': `Esempio: <input @text:focus="nome">`,
        '@class:focus': `Esempio: <input @class:focus="{rosso:true}">`,
        '@class:hover': `Esempio: <div @class:hover="{rosso: condizione}"></div>`,
        '@class:click': `Esempio: <div @class:click="{rosso: condizione}"></div>`,
        '@class:input': `Esempio: <input @class:input="{rosso: condizione}">`,
        '@class:change': `Esempio: <input @class:change="{rosso: condizione}">`,
        '@fetch:click': `Esempio: <button @fetch:click="'url'" @result="data"></button>`,
        '@fetch:hover': `Esempio: <button @fetch:hover="'url'" @result="data"></button>`,
        '@fetch:input': `Esempio: <input @fetch:input="'url'" @result="data">`,
        '@fetch:change': `Esempio: <input @fetch:change="'url'" @result="data">`,
        '@model:input': `Esempio: <input @model:input="nome">`,
        '@model:change': `Esempio: <input @model:change="nome">`,
        '@model:focus': `Esempio: <input @model:focus="nome">`,
        '@model:blur': `Esempio: <input @model:blur="nome">`,
        '@set:change': `Esempio: <input @set:change="foo='bar'">`,
        '@set:click': `Esempio: <button @set:click="foo=1"></button>`,
        '@set:input': `Esempio: <input @set:input="foo='bar'">`,
        '@set:focus': `Esempio: <input @set:focus="foo='bar'">`,
        '@set:blur': `Esempio: <input @set:blur="foo='bar'">`,
        '@focus': `Esempio: <input @focus="doSomething()">`,
      };
      return help[name] || '';
    }

    // Utility: se expr è una sola parola, trattala come variabile
    _autoVarExpr(expr) {
      if (typeof expr === 'string' && /^\w+$/.test(expr.trim())) {
        return `{${expr.trim()}}`;
      }
      return expr;
    }

    // Utility: controlla se una stringa contiene pattern di interpolazione {var} o {{var}}
    _hasInterpolation(expr) {
      return /\{\{.*?\}\}|\{[\w$.]+\}/.test(expr);
    }

    // Utility: assicura che tutte le variabili usate in assegnazioni/espressioni esistano nello state
    _ensureVarInState(expr) {
      // Gestisce foo=..., foo++, foo+=..., foo.push(...)
      if (typeof expr !== 'string') return;
      // foo = ...
      let m = expr.match(/([\w$]+)\s*=/);
      if (m) {
        const varName = m[1];
        if (!(varName in this.state)) {
          // Se è un assegnamento stringa
          let valMatch = expr.match(/=\s*['"](.*)['"]/);
          if (valMatch) this.state[varName] = valMatch[1];
          // Se è un assegnamento numerico
          else if (/=\s*\d+/.test(expr)) this.state[varName] = parseInt(expr.split('=')[1]);
          else this.state[varName] = undefined;
        }
      }
      // foo++ o foo += ...
      m = expr.match(/([\w$]+)\s*\+\+/);
      if (m) {
        const varName = m[1];
        if (!(varName in this.state)) this.state[varName] = 1;
      }
      m = expr.match(/([\w$]+)\s*\+=/);
      if (m) {
        const varName = m[1];
        if (!(varName in this.state)) this.state[varName] = 1;
      }
      // foo.push(...)
      m = expr.match(/([\w$]+)\.push\s*\(/);
      if (m) {
        const varName = m[1];
        if (!(varName in this.state)) this.state[varName] = [];
      }
    }

  }

  window.AyishaVDOM = AyishaVDOM;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AyishaVDOM(document.body).mount());
  } else {
    new AyishaVDOM(document.body).mount();
  }

  // --- LOGGING & ERROR HANDLING SYSTEM FOR DIRECTIVES/SUB-DIRECTIVES ---
  AyishaVDOM.prototype._logDirective = function (type, name, el, msg, example) {
    if (!window.ayisha || !window.ayisha.logDirectives) return;
    const level = window.ayisha.logLevel || 'warn';
    const prefix = `[Ayisha.${type}]`;
    const where = el && el.outerHTML ? `\nElemento: ${el.outerHTML.slice(0, 120)}...` : '';
    const help = example ? `\nEsempio: ${example}` : '';
    if (level === 'error') console.error(`${prefix} ${name}: ${msg}${where}${help}`);
    else if (level === 'warn') console.warn(`${prefix} ${name}: ${msg}${where}${help}`);
    else console.info(`${prefix} ${name}: ${msg}${where}${help}`);
  };

  // Wrap all directive/sub-directive handlers with logging
  const _oldRenderVNode = AyishaVDOM.prototype._renderVNode;
  AyishaVDOM.prototype._renderVNode = function (vNode, ctx) {
    if (vNode && vNode.directives) {
      Object.keys(vNode.directives).forEach(dir => {
        if (!this.directiveHelp(dir)) {
          this._logDirective('Direttiva', dir, null, 'Direttiva non riconosciuta.', null);
        }
      });
    }
    if (vNode && vNode.subDirectives) {
      Object.entries(vNode.subDirectives).forEach(([dir, evs]) => {
        Object.keys(evs).forEach(evt => {
          const key = `${dir}:${evt}`;
          if (!this.directiveHelp(key)) {
            this._logDirective('SubDirettiva', key, null, 'Sub-direttiva non riconosciuta.', null);
          }
        });
      });
    }
    return _oldRenderVNode.call(this, vNode, ctx);
  };

  // Funzione di utilità per mostrare un banner di errore rosso vicino all'elemento
  AyishaVDOM.prototype._showAyishaError = function (el, err, expr) {
    if (!el) return;
    let banner = el.parentNode && el.parentNode.querySelector('.ayisha-error-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'ayisha-error-banner';
      banner.style.background = '#c00';
      banner.style.color = '#fff';
      banner.style.padding = '0.5em 1em';
      banner.style.margin = '0.5em 0';
      banner.style.borderRadius = '4px';
      banner.style.fontWeight = 'bold';
      banner.style.border = '1px solid #900';
      banner.style.position = 'relative';
      banner.style.zIndex = '1000';
      banner.innerHTML = `<b>Errore JS:</b> ${err.message}<br><code>${expr}</code>`;
      el.parentNode && el.parentNode.insertBefore(banner, el.nextSibling);
    } else {
      banner.innerHTML = `<b>Errore JS:</b> ${err.message}<br><code>${expr}</code>`;
    }
  };
})();
