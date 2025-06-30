(function () {
  // Prevent redeclaration
  if (window.AyishaVDOM) return;

  // ===== CORE MODULES =====

  /**
   * Module: Expression Evaluator
   * Handles all expression evaluation and interpolation
   */
  class ExpressionEvaluator {
    constructor(state) {
      this.state = state;
    }

    evalExpr(expr, ctx = {}, event) {
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

    evalText(text, ctx) {
      return text.replace(/{{(.*?)}}/g, (_, e) => {
        const r = this.evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
    }

    evalAttrValue(val, ctx) {
      let result = val.replace(/{{(.*?)}}/g, (_, e) => {
        const r = this.evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
      result = result.replace(/\[\{(.*?)\}\]/g, (_, e) => {
        const r = this.evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
      if (/^\{([^{}]+)\}$/.test(result.trim())) {
        const expr = result.trim().slice(1, -1);
        const r = this.evalExpr(expr, ctx);
        return r != null ? r : '';
      }
      result = result.replace(/\{([^{}]+)\}/g, (match, e) => {
        if (/^\{\{.*\}\}$/.test(match)) return match;
        const r = this.evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
      return result;
    }

    autoVarExpr(expr) {
      if (typeof expr === 'string' && /^\w+$/.test(expr.trim())) {
        return `{${expr.trim()}}`;
      }
      return expr;
    }

    hasInterpolation(expr) {
      return /\{\{.*?\}\}|\{[\w$.]+\}/.test(expr);
    }

    ensureVarInState(expr) {
      if (typeof expr !== 'string') return;

      // Support for nested object creation: form.email, foo.bar.baz
      const createNested = path => {
        if (!Array.isArray(path) || !path.length) return;
        let obj = this.state;
        for (let i = 0; i < path.length; i++) {
          const key = path[i];
          if (!(key in obj) || obj[key] == null) {
            // If last, assign undefined, else assign {}
            obj[key] = (i === path.length - 1) ? undefined : {};
          }
          obj = obj[key];
        }
      };

      // Match nested property access (form.email, foo.bar.baz)
      const nestedMatch = expr.match(/([\w$]+(?:\.[\w$]+)+)/);
      if (nestedMatch) {
        const path = nestedMatch[1].split('.');
        createNested(path);
      }

      // Existing logic for assignments, increments, push, etc.
      let m = expr.match(/([\w$]+)\s*=/);
      if (m) {
        const varName = m[1];
        if (!(varName in this.state)) {
          let valMatch = expr.match(/=\s*['"](.*)['\"]/);
          if (valMatch) this.state[varName] = valMatch[1];
          else if (/=\s*\d+/.test(expr)) this.state[varName] = parseInt(expr.split('=')[1]);
          else this.state[varName] = undefined;
        }
      }

      m = expr.match(/([\w$]+)\s*\+\+/);
      if (m) {
        const varName = m[1];
        if (!(varName in this.state) || this.state[varName] == null) this.state[varName] = 1;
      }

      m = expr.match(/([\w$]+)\s*\+=/);
      if (m) {
        const varName = m[1];
        if (!(varName in this.state) || this.state[varName] == null) this.state[varName] = 1;
      }

      m = expr.match(/([\w$]+)\.push\s*\(/);
      if (m) {
        const varName = m[1];
        if (!(varName in this.state)) this.state[varName] = [];
      }
    }
  }

  /**
   * Module: DOM Parser
   * Handles parsing of DOM to Virtual DOM
   */
  class DOMParser {
    constructor(initBlocks) {
      this.initBlocks = initBlocks;
    }

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
        this.initBlocks.push(node.textContent);
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
  }

  /**
   * Module: Component Manager
   * Handles component registration and loading
   */
  class ComponentManager {
    constructor() {
      this.components = {};
      this.cache = {};
      this.loadingComponents = new Set();
    }

    component(name, html) {
      this.components[name] = html;
    }

    async loadExternalComponent(url) {
      if (this.cache[url]) {
        return this.cache[url];
      }
      if (this.loadingComponents.has(url)) {
        while (this.loadingComponents.has(url)) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        return this.cache[url];
      }
      this.loadingComponents.add(url);
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const html = await response.text();
        this.cache[url] = html;
        return html;
      } catch (error) {
        console.error(`Errore nel caricamento del componente da ${url}:`, error);
        return null;
      } finally {
        this.loadingComponents.delete(url);
      }
    }

    getComponent(name) {
      return this.components[name];
    }

    getCachedComponent(url) {
      return this.cache[url];
    }

    isLoading(url) {
      return this.loadingComponents.has(url);
    }

    markAsLoading(url) {
      this.loadingComponents.add(url);
    }

    markAsLoaded(url) {
      this.loadingComponents.delete(url);
    }

    cacheComponent(url, html) {
      this.cache[url] = html;
    }
  }

  /**
   * Module: Reactivity System
   * Handles state reactivity and watchers
   */
  class ReactivitySystem {
    constructor(state, renderCallback) {
      this.state = state;
      this.watchers = {};
      this.renderCallback = renderCallback;
    }

    makeReactive() {
      this.state = new Proxy(this.state, {
        set: (obj, prop, val) => {
          const old = obj[prop];
          if (JSON.stringify(old) === JSON.stringify(val)) {
            obj[prop] = val;
            return true;
          }
          obj[prop] = val;
          (this.watchers[prop] || []).forEach(fn => fn(val));
          this.renderCallback();
          return true;
        }
      });
      return this.state;
    }

    addWatcher(prop, fn) {
      this.watchers[prop] = this.watchers[prop] || [];
      this.watchers[prop].push(fn);
    }
  }

  /**
   * Module: Router
   * Handles SPA routing
   */
  class Router {
    constructor(state, renderCallback) {
      this.state = state;
      this.renderCallback = renderCallback;
    }

    setupRouting() {
      let p = location.pathname.replace(/^\//, '') || '';
      if (!p || p === 'index.html') { 
        history.replaceState({}, '', '/'); 
        p = ''; 
      }
      this.state.currentPage = p;
      
      window.addEventListener('popstate', () => {
        this.state.currentPage = location.pathname.replace(/^\//, '') || '';
        this.renderCallback();
      });
    }

    setupCurrentPageProperty() {
      const self = this;
      let cp = this.state.currentPage;
      Object.defineProperty(this.state, 'currentPage', {
        get() { return cp; },
        set(v) {
          if (cp !== v) {
            cp = v;
            history.pushState({}, '', '/' + v);
            self.renderCallback();
          }
        }
      });
    }
  }

  /**
   * Module: Fetch Manager
   * Handles HTTP requests and caching
   */
  class FetchManager {
    constructor(evaluator) {
      this.evaluator = evaluator;
      this.pendingFetches = {};
      this.lastFetchUrl = {};
      this.fetched = {};
    }

    setupFetch(expr, rk, ctx, event, force) {
      let url = this.evaluator.evalExpr(expr, ctx, event);
      if (url === undefined) {
        url = expr.replace(/\{([^}]+)\}/g, (_, key) => {
          const val = this.evaluator.evalExpr(key, ctx, event);
          return val != null ? val : '';
        });
      }
      if (!url) return;
      
      const fid = `${url}::${rk}`;
      if (!force && this.lastFetchUrl[rk] === url) return;
      if (this.pendingFetches[fid]) return;
      
      this.pendingFetches[fid] = true;
      this.lastFetchUrl[rk] = url;
      
      fetch(url)
        .then(res => {
          if (!res.ok) {
            if (!this.fetched[url]) this.fetched[url] = {};
            this.fetched[url].error = `${res.status} ${res.statusText || 'errore di rete'}`;
            throw new Error(`${res.status} ${res.statusText}`);
          }
          return res.json();
        })
        .then(data => {
          if (!(rk in this.evaluator.state)) {
            this.evaluator.state[rk] = undefined;
          }
          const oldVal = this.evaluator.state[rk];
          const isEqual = JSON.stringify(oldVal) === JSON.stringify(data);
          if (!isEqual) {
            this.evaluator.state[rk] = data;
          }
          if (this.fetched[url]) delete this.fetched[url].error;
        })
        .catch(err => {
          if (!this.fetched[url]) this.fetched[url] = {};
          if (!this.fetched[url].error) this.fetched[url].error = err.message;
          console.error('@fetch error:', err);
        })
        .finally(() => {
          delete this.pendingFetches[fid];
        });
    }
  }

  /**
   * Module: Directive Help System
   * Provides help and validation for directives
   */
  class DirectiveHelpSystem {
    constructor() {
      this.helpTexts = {
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
        '@state': `Esempio: <div @state></div> (renderizza lo stato corrente come JSON)`,
        '@log': `Esempio: <div @log></div> (mostra il log delle direttive sull'elemento)`,
        '@hover': `Esempio: <div @hover="doSomething()"></div>`,
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
        '@blur': `Esempio: <input @blur="doSomething()">`,
        '@change': `Esempio: <input @change="doSomething()">`,
        '@input': `Esempio: <input @input="doSomething()">`
      };
    }

    getHelp(name) {
      return this.helpTexts[name] || '';
    }

    isValidDirective(name) {
      return this.helpTexts.hasOwnProperty(name);
    }
  }

  /**
   * Module: Error Handler
   * Handles error display and logging
   */
  class ErrorHandler {
    showAyishaError(el, err, expr) {
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
    }

    createErrorElement(message) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'ayisha-directive-error';
      errorDiv.style.background = '#c00';
      errorDiv.style.color = '#fff';
      errorDiv.style.padding = '1em';
      errorDiv.style.margin = '0.5em 0';
      errorDiv.style.borderRadius = '4px';
      errorDiv.style.fontWeight = 'bold';
      errorDiv.style.border = '1px solid #900';
      errorDiv.innerHTML = message;
      return errorDiv;
    }

    createWarningElement(message) {
      const warnDiv = document.createElement('div');
      warnDiv.className = 'ayisha-directive-warning';
      warnDiv.style.background = '#ffeb3b';
      warnDiv.style.color = '#333';
      warnDiv.style.padding = '1em';
      warnDiv.style.margin = '0.5em 0';
      warnDiv.style.borderRadius = '4px';
      warnDiv.style.fontWeight = 'bold';
      warnDiv.style.border = '1px solid #e0c200';
      warnDiv.innerHTML = message;
      return warnDiv;
    }
  }

  /**
   * Module: Binding Manager
   * Handles model binding and validation
   */
  class BindingManager {
    constructor(evaluator, renderCallback) {
      this.evaluator = evaluator;
      this.renderCallback = renderCallback;
      this.modelBindings = [];
    }

    bindModel(el, key, ctx) {
      const update = () => {
        const val = this.evaluator.evalExpr(key, ctx);
        if (el.type === 'checkbox') el.checked = !!val;
        else if (el.type === 'radio') el.checked = val == el.value;
        else if (el.value !== String(val)) el.value = val ?? '';
      };
      this.modelBindings.push({ el, update });
      update();
      el.addEventListener('input', () => {
        new Function('state', 'ctx', 'value', `with(state){with(ctx||{}){${key}=value}}`)(this.evaluator.state, ctx, el.value);
        this.renderCallback();
      });
    }

    bindValidation(el, rulesStr) {
      const rules = rulesStr.split(',').map(r => r.trim());
      // Quick validators
      const validators = {
        email: {
          test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
          msg: 'Invalid email address'
        },
        cf: {
          test: v => /^[A-Z0-9]{16}$/.test(v),
          msg: 'Invalid tax code'
        },
        required: {
          test: v => v && v.length > 0,
          msg: 'This field is required'
        },
        minLength: {
          test: (v, n) => v.length >= n,
          msg: n => `Minimum ${n} characters required`
        }
        // Add more quick rules here if needed
      };
      // Error element
      let errorEl = null;
      const showError = msg => {
        if (!errorEl) {
          errorEl = document.createElement('div');
          errorEl.className = 'ayisha-validate-error';
          errorEl.style.color = '#c00';
          errorEl.style.fontSize = '0.9em';
          errorEl.style.marginTop = '0.2em';
          el.insertAdjacentElement('afterend', errorEl);
        }
        errorEl.textContent = msg;
      };
      const clearError = () => {
        if (errorEl) errorEl.textContent = '';
      };
      el.addEventListener('input', () => {
        let valid = true;
        let errorMsg = '';
        for (const rule of rules) {
          if (rule === 'required') {
            if (!validators.required.test(el.value)) {
              valid = false;
              errorMsg = validators.required.msg;
              break;
            }
          } else if (rule.startsWith('minLength')) {
            const m = parseInt(rule.split(':')[1], 10);
            if (!validators.minLength.test(el.value, m)) {
              valid = false;
              errorMsg = validators.minLength.msg(m);
              break;
            }
          } else if (rule === 'email') {
            if (!validators.email.test(el.value)) {
              valid = false;
              errorMsg = validators.email.msg;
              break;
            }
          } else if (rule === 'cf') {
            if (!validators.cf.test(el.value)) {
              valid = false;
              errorMsg = validators.cf.msg;
              break;
            }
          } else if (rule.startsWith('regex:')) {
            const regexStr = rule.slice(6);
            let pattern = regexStr;
            let flags = '';
            // Support regex:/pattern/flags
            const match = regexStr.match(/^\/(.*)\/(\w*)$/);
            if (match) {
              pattern = match[1];
              flags = match[2];
            }
            const re = new RegExp(pattern, flags);
            if (!re.test(el.value)) {
              valid = false;
              errorMsg = 'Invalid format';
              break;
            }
          }
          // Add more custom rules here
        }
        el.classList.toggle('invalid', !valid);
        if (!valid) showError(errorMsg);
        else clearError();
      });
    }

    updateBindings() {
      this.modelBindings.forEach(b => b.update());
    }

    clearBindings() {
      this.modelBindings = [];
    }
  }

  // ===== MAIN AYISHA CLASS =====

  class AyishaVDOM {
    constructor(root = document.body) {
      this.root = root;
      this.state = {};
      this._initBlocks = [];
      this._vdom = null;
      this._isRendering = false;
      
      // Initialize modules
      this.evaluator = new ExpressionEvaluator(this.state);
      this.parser = new DOMParser(this._initBlocks);
      this.componentManager = new ComponentManager();
      this.reactivitySystem = new ReactivitySystem(this.state, () => this.render());
      this.router = new Router(this.state, () => this.render());
      this.fetchManager = new FetchManager(this.evaluator);
      this.helpSystem = new DirectiveHelpSystem();
      this.errorHandler = new ErrorHandler();
      this.bindingManager = new BindingManager(this.evaluator, () => this.render());
      
      window.ayisha = this;
    }

    // Public API methods
    component(name, html) {
      this.componentManager.component(name, html);
    }

    addWatcher(prop, fn) {
      this.reactivitySystem.addWatcher(prop, fn);
    }

    directiveHelp(name) {
      return this.helpSystem.getHelp(name);
    }

    // Core methods
    parse(node) {
      return this.parser.parse(node);
    }

    _runInitBlocks() {
      this._initBlocks.forEach(code => {
        try {
          new Function('state', code)(this.state);
        } catch (e) {
          console.error('Init error:', e);
        }
      });
    }

    _makeReactive() {
      this.state = this.reactivitySystem.makeReactive();
      this.evaluator.state = this.state;
      this.fetchManager.evaluator.state = this.state;
    }

    _setupRouting() {
      this.router.setupRouting();
    }

    // Backward compatibility aliases
    _evalExpr(expr, ctx, event) {
      return this.evaluator.evalExpr(expr, ctx, event);
    }

    _evalText(text, ctx) {
      return this.evaluator.evalText(text, ctx);
    }

    _evalAttrValue(val, ctx) {
      return this.evaluator.evalAttrValue(val, ctx);
    }

    _autoVarExpr(expr) {
      return this.evaluator.autoVarExpr(expr);
    }

    _hasInterpolation(expr) {
      return this.evaluator.hasInterpolation(expr);
    }

    _ensureVarInState(expr) {
      return this.evaluator.ensureVarInState(expr);
    }

    _bindModel(el, key, ctx) {
      return this.bindingManager.bindModel(el, key, ctx);
    }

    _bindValidation(el, rulesStr) {
      return this.bindingManager.bindValidation(el, rulesStr);
    }

    _showAyishaError(el, err, expr) {
      return this.errorHandler.showAyishaError(el, err, expr);
    }

    _loadExternalComponent(url) {
      return this.componentManager.loadExternalComponent(url);
    }

    render() {
      if (this._isRendering) return;
      this._isRendering = true;

      // Save scroll and focus
      const scrollX = window.scrollX, scrollY = window.scrollY;
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
        focusInfo = { path, start: active.selectionStart, end: active.selectionEnd, type: active.type };
      }

      this.bindingManager.clearBindings();
      const real = this._renderVNode(this._vdom, this.state);
      
      // Update DOM
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

      // Restore focus and scroll
      if (focusInfo) {
        let node = this.root;
        focusInfo.path.forEach(i => node = node.childNodes[i]);
        if (node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA')) {
          node.focus();
          try {
            if ((node.tagName === 'INPUT' && typeof node.selectionStart === 'number' && typeof node.setSelectionRange === 'function' && node.type !== 'number') || node.tagName === 'TEXTAREA') {
              node.setSelectionRange(focusInfo.start, focusInfo.end);
            }
          } catch (e) { }
        }
      }
      
      window.scrollTo(scrollX, scrollY);
      this.bindingManager.updateBindings();
      this._isRendering = false;
    }

    _renderVNode(vNode, ctx) {
      if (!vNode) return null;

      // Ensure variables exist in state
      Object.values(vNode.directives || {}).forEach(expr => this.evaluator.ensureVarInState(expr));
      Object.values(vNode.subDirectives || {}).forEach(ev => Object.values(ev).forEach(expr => this.evaluator.ensureVarInState(expr)));

      // Error handling for unknown directives
      let unknownDirective = null;
      let unknownSubDirective = null;
      let unknownSubDirectiveEvt = null;
      
      if (vNode && vNode.directives) {
        for (const dir of Object.keys(vNode.directives)) {
          if (dir === '@src' && vNode.tag === 'component') continue;
          if (!this.helpSystem.isValidDirective(dir)) {
            unknownDirective = dir;
            break;
          }
        }
      }
      
      if (!unknownDirective && vNode && vNode.subDirectives) {
        for (const [dir, evs] of Object.entries(vNode.subDirectives)) {
          for (const evt of Object.keys(evs)) {
            const key = `${dir}:${evt}`;
            if (!this.helpSystem.isValidDirective(key)) {
              unknownSubDirective = dir;
              unknownSubDirectiveEvt = evt;
              break;
            }
          }
          if (unknownSubDirective) break;
        }
      }
      
      if (unknownDirective || unknownSubDirective) {
        let msg = '';
        if (unknownDirective) {
          msg = `Error: Unknown directive <b>${unknownDirective}</b>.`;
          msg += '<br>' + this.directiveHelp(unknownDirective);
        } else {
          const key = `${unknownSubDirective}:${unknownSubDirectiveEvt}`;
          msg = `Error: Unknown sub-directive <b>${key}</b>.`;
          msg += '<br>' + this.directiveHelp(key);
        }
        return this.errorHandler.createErrorElement(msg);
      }

      // Network/parsing errors
      if (this.fetchManager.lastFetchUrl && this.fetchManager.fetched) {
        let foundError = null;
        let foundDir = null;
        let foundUrl = null;
        for (const dir in vNode.directives) {
          const rk = vNode.directives['@result'] || 'result';
          const url = this.fetchManager.lastFetchUrl[rk];
          if (url && this.fetchManager.fetched[url] && this.fetchManager.fetched[url].error) {
            foundError = this.fetchManager.fetched[url].error;
            foundDir = dir;
            foundUrl = url;
            break;
          }
        }
        if (foundError && foundDir) {
          let allDirs = Object.entries(vNode.directives)
            .map(([k, v]) => `<b>${k}</b>: <code>${String(v)}</code>`)
            .join('<br>');
          return this.errorHandler.createWarningElement(`${allDirs}<br><b>Error:</b> ${foundError}`);
        }
      }

      // Handle text nodes
      if (vNode.type === 'text') {
        return document.createTextNode(this.evaluator.evalText(vNode.text, ctx));
      }

      // Handle fragments
      if (vNode.tag === 'fragment') {
        const frag = document.createDocumentFragment();
        vNode.children.forEach(child => {
          const node = this._renderVNode(child, ctx);
          if (node) frag.appendChild(node);
        });
        return frag;
      }

      // Conditional rendering directives
      if (vNode.directives['@if'] && !this.evaluator.evalExpr(vNode.directives['@if'], ctx)) return null;
      if (vNode.directives['@show'] && !this.evaluator.evalExpr(vNode.directives['@show'], ctx)) return null;
      if (vNode.directives['@hide'] && this.evaluator.evalExpr(vNode.directives['@hide'], ctx)) return null;

      // @for directive
      if (vNode.directives['@for']) {
        return this._handleForDirective(vNode, ctx);
      }

      // @switch directive
      if (vNode.directives['@switch']) {
        return this._handleSwitchDirective(vNode, ctx);
      }

      // Functional directives (@source, @map, @filter, @reduce)
      if (vNode.directives['@source']) {
        return this._handleFunctionalDirectives(vNode, ctx);
      }

      // Component handling
      if (vNode.tag === 'component') {
        return this._handleComponentDirective(vNode, ctx);
      }

      // Create DOM element
      const el = document.createElement(vNode.tag);

      // Set attributes
      Object.entries(vNode.attrs).forEach(([k, v]) => {
        el.setAttribute(k, this.evaluator.evalAttrValue(v, ctx));
      });

      // Handle special directives
      this._handleSpecialDirectives(el, vNode, ctx);

      // Handle standard directives
      this._handleStandardDirectives(el, vNode, ctx);

      // Handle sub-directives
      this._handleSubDirectives(el, vNode, ctx);

      // Add children
      vNode.children.forEach(child => {
        const node = this._renderVNode(child, ctx);
        if (node) el.appendChild(node);
      });

      // Handle logging wrapper
      const logWrapper = this._createLogWrapper(vNode, ctx);
      if (logWrapper) {
        const frag = document.createDocumentFragment();
        frag.appendChild(el);
        frag.appendChild(logWrapper);
        return frag;
      }

      return el;
    }

    _handleForDirective(vNode, ctx) {
      const m = vNode.directives['@for'].match(/(\w+) in (.+)/);
      if (m) {
        const [, it, expr] = m;
        let arr = this.evaluator.evalExpr(expr, ctx) || [];
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
      return null;
    }

    _handleSwitchDirective(vNode, ctx) {
      const swVal = this.evaluator.evalExpr(vNode.directives['@switch'], ctx);
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

    _handleFunctionalDirectives(vNode, ctx) {
      const arr = this.evaluator.evalExpr(vNode.directives['@source'], ctx) || [];
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
        const initial = vNode.directives['@initial'] ? this.evaluator.evalExpr(vNode.directives['@initial'], ctx) : undefined;
        const result = initial !== undefined ? arr.reduce(redFn, initial) : arr.reduce(redFn);
        setState(vNode.directives['@result'] || 'result', result);
      }
      
      if (used) return document.createComment('functional');
      return null;
    }

    _handleComponentDirective(vNode, ctx) {
      if (!vNode.directives['@src']) {
        return this.errorHandler.createErrorElement(`Error: <b>&lt;component&gt;</b> requires the <b>@src</b> attribute (e.g. <code>&lt;component @src="file.html"&gt;</code>)`);
      }
      
      let srcUrl = null;
      try {
        srcUrl = this.evaluator.evalExpr(vNode.directives['@src'], ctx);
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
        return this.errorHandler.createErrorElement(`Error: Invalid component URL (<b>${vNode.directives['@src']}</b>)`);
      }
      
      if (this.componentManager.getCachedComponent(srcUrl) && this.componentManager.getCachedComponent(srcUrl).includes('component-error')) {
        return this.errorHandler.createErrorElement(`Error: component <b>${srcUrl}</b> not rendered or not found.`);
      }
      
      if (this.componentManager.getCachedComponent(srcUrl)) {
        const componentHtml = this.componentManager.getCachedComponent(srcUrl);
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
      
      if (!this.componentManager.getCachedComponent(srcUrl) && !this.componentManager.isLoading(srcUrl)) {
        this.componentManager.markAsLoading(srcUrl);
        fetch(srcUrl)
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return res.text();
          })
          .then(html => {
            this.componentManager.cacheComponent(srcUrl, html);
            this.componentManager.markAsLoaded(srcUrl);
            if (!this._isRendering) requestAnimationFrame(() => this.render());
          })
          .catch(err => {
            this.componentManager.cacheComponent(srcUrl, `<div class="component-error">Errore: ${err.message}</div>`);
            this.componentManager.markAsLoaded(srcUrl);
            if (!this._isRendering) requestAnimationFrame(() => this.render());
          });
      }
      
      const placeholder = document.createElement('div');
      placeholder.className = 'component-loading';
      if (this.componentManager.isLoading(srcUrl)) {
        placeholder.textContent = `Caricamento componente: ${srcUrl}`;
      } else if (this.componentManager.getCachedComponent(srcUrl) && this.componentManager.getCachedComponent(srcUrl).includes('component-error')) {
        placeholder.innerHTML = this.componentManager.getCachedComponent(srcUrl);
      } else {
        placeholder.textContent = `In attesa del componente: ${srcUrl}`;
      }
      return placeholder;
    }

    _handleSpecialDirectives(el, vNode, ctx) {
      // @state directive
      if (vNode.directives.hasOwnProperty('@state')) {
        const wrapper = document.createElement('div');
        wrapper.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        wrapper.style.color = '#fff';
        wrapper.style.padding = '1em';
        wrapper.style.borderRadius = '4px';
        wrapper.style.marginTop = '1em';
        wrapper.style.overflow = 'auto';

        const title = document.createElement('h3');
        title.textContent = 'CURRENT STATE';
        title.style.margin = '0.5em 0 2em';
        title.style.fontSize = '1.1em';
        title.style.fontWeight = 'bold';
        title.style.color = '#fff';
        wrapper.appendChild(title);

        const pre = document.createElement('pre');
        pre.style.margin = '0';
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.fontFamily = 'monospace';
        pre.textContent = JSON.stringify(this.state, null, 2);
        wrapper.appendChild(pre);

        el.appendChild(wrapper);
      }
    }

    _handleStandardDirectives(el, vNode, ctx) {
      // @click
      if (vNode.directives['@click']) {
        el.addEventListener('click', e => {
          if (el.tagName === 'BUTTON') {
            e.preventDefault();
          }
          const expr = vNode.directives['@click'];
          this.evaluator.ensureVarInState(expr);
          let codeToRun = expr;
          if (this.evaluator.hasInterpolation(expr)) {
            codeToRun = this.evaluator.evalAttrValue(expr, ctx);
          }
          try {
            new Function('state', 'ctx', 'event', `with(state){with(ctx){${codeToRun}}}`)
              (this.state, ctx, e);
          } catch (err) {
            this.errorHandler.showAyishaError(el, err, codeToRun);
          }
          this.render();
        });
      }

      // @hover
      if (vNode.directives['@hover']) {
        const rawExpr = vNode.directives['@hover'];
        const applyHover = e => {
          let codeToRun = rawExpr;
          if (this.evaluator.hasInterpolation(rawExpr)) {
            codeToRun = this.evaluator.evalAttrValue(rawExpr, ctx);
          }
          try {
            new Function('state', 'ctx', 'event', `with(state){with(ctx){${codeToRun}}}`)
              (this.state, ctx, e);
          } catch (err) {
            this.errorHandler.showAyishaError(el, err, codeToRun);
          }
          this.render();
        };
        el.addEventListener('mouseover', applyHover);
        el.addEventListener('mouseout', applyHover);
      }

      // @fetch
      if (vNode.directives['@fetch'] && !vNode.subDirectives['@fetch']) {
        const expr = this.evaluator.autoVarExpr(vNode.directives['@fetch']);
        const rk = vNode.directives['@result'] || 'result';
        this.fetchManager.setupFetch(expr, rk, ctx);
        
        if (vNode.directives['@watch']) {
          this._handleWatchDirective(vNode, expr, rk);
        }
      }

      // @watch (generic, non-fetch)
      if (vNode.directives['@watch'] && !vNode.directives['@fetch']) {
        this._handleGenericWatchDirective(vNode);
      }

      // @text
      if (vNode.directives['@text'] && !vNode.subDirectives['@text']) {
        el.textContent = this.evaluator.evalExpr(vNode.directives['@text'], ctx);
      }

      // @model
      if (vNode.directives['@model']) {
        this.bindingManager.bindModel(el, vNode.directives['@model'], ctx);
      }

      // @class
      if (vNode.directives['@class'] && !vNode.subDirectives['@class']) {
        const clsMap = this.evaluator.evalExpr(vNode.directives['@class'], ctx) || {};
        Object.entries(clsMap).forEach(([cls, cond]) => el.classList.toggle(cls, !!cond));
      }

      // @style
      if (vNode.directives['@style']) {
        const styles = this.evaluator.evalExpr(vNode.directives['@style'], ctx) || {};
        Object.entries(styles).forEach(([prop, val]) => el.style[prop] = val);
      }

      // @validate
      if (vNode.directives['@validate']) {
        this.bindingManager.bindValidation(el, vNode.directives['@validate']);
      }

      // @link
      if (vNode.directives['@link']) {
        el.setAttribute('href', vNode.directives['@link']);
        el.addEventListener('click', e => {
          e.preventDefault();
          this.state.currentPage = vNode.directives['@link'];
        });
      }

      // @page
      if (vNode.directives['@page'] && this.state.currentPage !== vNode.directives['@page']) {
        return null;
      }

      // @animate
      if (vNode.directives['@animate']) {
        el.classList.add(vNode.directives['@animate']);
      }

      // @component (inline)
      if (vNode.directives['@component']) {
        const n = vNode.directives['@component'];
        if (this.componentManager.getComponent(n)) {
          const frag = document.createRange().createContextualFragment(this.componentManager.getComponent(n));
          const compVNode = this.parse(frag);
          const compEl = this._renderVNode(compVNode, ctx);
          if (compEl) el.appendChild(compEl);
        }
      }
    }

    _handleSubDirectives(el, vNode, ctx) {
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
            const getInterpolatedExpr = () => this.evaluator.evalAttrValue(expr, ctx);
            
            if (dir === '@fetch') {
              this._handleFetchSubDirective(el, eventName, expr, vNode, ctx);
              return;
            }
            
            if (dir === '@class') {
              this._handleClassSubDirective(el, evt, getInterpolatedExpr, ctx);
              return;
            }
            
            if (dir === '@text') {
              this._handleTextSubDirective(el, evt, getInterpolatedExpr, ctx);
              return;
            }
            
            // Default: execute as pure JS code or interpolated
            el.addEventListener(eventName, e => {
              let codeToRun = getInterpolatedExpr();
              try {
                new Function('state', 'ctx', 'event', `with(state){with(ctx){${codeToRun}}}`)
                  (this.state, ctx, e);
              } catch (err) {
                this.errorHandler.showAyishaError(el, err, codeToRun);
              }
              this.render();
            });
          }
        });
      });
    }

    _handleFetchSubDirective(el, eventName, expr, vNode, ctx) {
      el.addEventListener(eventName, e => {
        let matchAssign = expr.match(/^([\w$]+)\s*=\s*(.+)$/);
        if (matchAssign && this.evaluator.hasInterpolation(expr)) {
          const varName = matchAssign[1];
          let valueExpr = matchAssign[2].trim();
          let interpolated = this.evaluator.evalAttrValue(valueExpr, ctx);
          if (!(varName in this.state)) this.state[varName] = '';
          this.state[varName] = interpolated;
          this.fetchManager.setupFetch(varName, vNode.directives['@result'] || 'result', ctx, e, true);
        } else {
          this.evaluator.ensureVarInState(expr);
          let codeToRun = expr;
          if (this.evaluator.hasInterpolation(expr)) {
            codeToRun = this.evaluator.evalAttrValue(expr, ctx);
          }
          try {
            new Function('state', 'ctx', 'event', `with(state){with(ctx){${codeToRun}}}`)
              (this.state, ctx, e);
          } catch (err) {
            this.errorHandler.showAyishaError(el, err, codeToRun);
          }
          this.fetchManager.setupFetch(expr, vNode.directives['@result'] || 'result', ctx, e, true);
        }
        this.render();
      });
    }

    _handleClassSubDirective(el, evt, getInterpolatedExpr, ctx) {
      if (evt === 'hover') {
        el.addEventListener('mouseover', e => {
          const clsMap = this.evaluator.evalExpr(getInterpolatedExpr(), ctx, e) || {};
          Object.entries(clsMap).forEach(([cls, cond]) => {
            if (cond) el.classList.add(cls);
          });
        });
        el.addEventListener('mouseout', e => {
          const clsMap = this.evaluator.evalExpr(getInterpolatedExpr(), ctx, e) || {};
          Object.entries(clsMap).forEach(([cls, cond]) => {
            if (cond) el.classList.remove(cls);
          });
        });
      } else {
        el.addEventListener(evt === 'hover' ? 'mouseover' : evt, e => {
          const clsMap = this.evaluator.evalExpr(getInterpolatedExpr(), ctx, e) || {};
          Object.entries(clsMap).forEach(([cls, cond]) => {
            if (cond) el.classList.add(cls);
            else el.classList.remove(cls);
          });
        });
      }
    }

    _handleTextSubDirective(el, evt, getInterpolatedExpr, ctx) {
      if (!el._ayishaOriginal) el._ayishaOriginal = el.textContent;
      if (evt === 'click') {
        el.addEventListener('click', e => {
          el.textContent = this.evaluator.evalExpr(getInterpolatedExpr(), ctx, e);
        });
      } else if (evt === 'hover') {
        el.addEventListener('mouseover', e => {
          el.textContent = this.evaluator.evalExpr(getInterpolatedExpr(), ctx, e);
        });
        el.addEventListener('mouseout', () => {
          el.textContent = el._ayishaOriginal;
        });
      }
    }

    _handleWatchDirective(vNode, expr, rk) {
      vNode.directives['@watch'].split(',').forEach(watchExpr => {
        watchExpr = watchExpr.trim();
        let match = watchExpr.match(/^([\w$]+)\s*=>\s*(.+)$/) || watchExpr.match(/^([\w$]+)\s*:\s*(.+)$/);
        if (match) {
          const prop = match[1];
          const code = match[2];
          this.evaluator.ensureVarInState(code);
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
          this.addWatcher(watchExpr, () => this.fetchManager.setupFetch(expr, rk, undefined, undefined, true));
        }
      });
    }

    _handleGenericWatchDirective(vNode) {
      vNode.directives['@watch'].split(',').forEach(watchExpr => {
        watchExpr = watchExpr.trim();
        const match = watchExpr.match(/^(\w+)\s*=>\s*(.+)$/)
          || watchExpr.match(/^(\w+)\s*:\s*(.+)$/);
        if (match) {
          const prop = match[1];
          const code = match[2];

          this.addWatcher(prop, function (newVal) {
            const state = window.ayisha.state;
            window.ayisha.evaluator.ensureVarInState(code);
            try {
              const pushMatch = code.match(/(\w+)\.push\s*\(/);
              if (pushMatch) {
                const arrName = pushMatch[1];
                if (!state[arrName]) state[arrName] = [];
              }
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

    _createLogWrapper(vNode, ctx) {
      if (!vNode.directives.hasOwnProperty('@log')) return null;
      
      const logWrapper = document.createElement('div');
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

      const renderValue = (expr, ctx) => {
        try {
          const val = this.evaluator.evalExpr(expr, ctx);
          if (typeof val === 'object') return `<pre style=\"color:#fff;background:#333;padding:0.5em;border-radius:3px;overflow:auto;width:100%;\">${JSON.stringify(val, null, 2)}</pre>`;
          return `<span style=\"color:#0f0\">${String(val)}</span>`;
        } catch (err) {
          return `<span style=\"color:#f55\">Errore: ${err.message}</span>`;
        }
      };

      // Handle fetch info
      this._addFetchInfoToLog(logWrapper, vNode, ctx);

      // Handle directives
      this._addDirectivesToLog(logWrapper, vNode, ctx, renderValue);

      // Handle sub-directives
      this._addSubDirectivesToLog(logWrapper, vNode, ctx, renderValue);

      return logWrapper;
    }

    _addFetchInfoToLog(logWrapper, vNode, ctx) {
      let fetchDir = null, fetchExpr = null;
      Object.entries(vNode.directives).forEach(([dir, expr]) => {
        if (dir.startsWith('@fetch')) {
          fetchDir = dir;
          fetchExpr = expr;
        }
      });
      Object.entries(vNode.subDirectives).forEach(([dir, evs]) => {
        if (dir === '@fetch') {
          Object.entries(evs).forEach(([evt, expr]) => {
            fetchDir = `${dir}:${evt}`;
            fetchExpr = expr;
          });
        }
      });
      
      if (fetchDir) {
        let url = null, method = 'GET', headers = {}, payload = null;
        try {
          url = this.evaluator.evalExpr(fetchExpr, ctx);
        } catch { }
        
        if (!url && typeof fetchExpr === 'string') {
          const m = fetchExpr.match(/([\w$]+)\s*=\s*(.+)/);
          if (m) url = this.evaluator.evalExpr(m[2], ctx);
        }
        
        if (vNode.directives['@method']) method = this.evaluator.evalExpr(vNode.directives['@method'], ctx) || 'GET';
        if (vNode.directives['@headers']) headers = this.evaluator.evalExpr(vNode.directives['@headers'], ctx) || {};
        if (vNode.directives['@payload']) payload = this.evaluator.evalExpr(vNode.directives['@payload'], ctx);

        let urlHtml = '';
        if (typeof url === 'string') {
          urlHtml = `<span style=\"color:#0ff\">${url}</span>`;
        } else if (url && typeof url === 'object') {
          let asString = '';
          try {
            asString = this.evaluator.evalAttrValue(fetchExpr, ctx);
          } catch { }
          if (asString && typeof asString === 'string' && asString !== '[object Object]') {
            urlHtml = `<span style=\"color:#0ff\">${asString}</span>`;
          } else {
            urlHtml = `<pre style=\"color:#0ff;background:#222;padding:0.3em;display:inline-block;max-width:400px;overflow:auto;\">${JSON.stringify(url, null, 2)}</pre>`;
          }
        } else {
          urlHtml = '<i>undefined</i>';
        }

        let headersHtml = '';
        if (headers && typeof headers === 'object' && Object.keys(headers).length) {
          headersHtml = `<pre style=\"color:#0ff;background:#222;padding:0.3em;display:inline-block;max-width:400px;overflow:auto;\">${JSON.stringify(headers, null, 2)}</pre>`;
        } else {
          headersHtml = '{}';
        }

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
          `<b style=\"color:#aaa\">Method:</b> <span style=\"color:#0ff\">${method}</span><br>` +
          `<b style=\"color:#aaa\">Headers:</b> ${headersHtml}<br>` +
          (payloadHtml ? `<b style=\"color:#aaa\">Payload:</b> ${payloadHtml}<br>` : '');
        logWrapper.appendChild(fetchInfo);
      }
    }

    _addDirectivesToLog(logWrapper, vNode, ctx, renderValue) {
      Object.entries(vNode.directives).forEach(([dir, expr]) => {
        if (dir === '@log') return;
        
        let info = '';
        if (dir === '@model') {
          const val = this.evaluator.evalExpr(expr, ctx);
          info = `<span style=\"color:#0ff\">(proprietà: <b>${expr}</b>, valore: <b>${val}</b>)</span>`;
        } else if (dir === '@watch') {
          info = `<span style=\"color:#0ff\">(osserva: <b>${expr}</b>)</span>`;
        } else if (dir === '@text') {
          const val = this.evaluator.evalExpr(expr, ctx);
          info = `<span style=\"color:#0ff\">(valore: <b>${val}</b>)</span>`;
        } else if (dir === '@class') {
          const val = this.evaluator.evalExpr(expr, ctx);
          info = `<span style=\"color:#0ff\">(classi: <b>${JSON.stringify(val)}</b>)</span>`;
        } else if (dir === '@style') {
          const val = this.evaluator.evalExpr(expr, ctx);
          info = `<span style=\"color:#0ff\">(stili: <b>${JSON.stringify(val)}</b>)</span>`;
        } else if (dir === '@validate') {
          info = `<span style=\"color:#0ff\">(regole: <b>${expr}</b>)</span>`;
        } else if (dir === '@result') {
          const val = this.evaluator.evalExpr(expr, ctx);
          info = `<span style=\"color:#0ff\">(variabile: <b>${expr}</b>, valore: <b>${JSON.stringify(val)}</b>)</span>`;
        } else if (dir === '@for') {
          info = `<span style=\"color:#0ff\">(iterazione: <b>${expr}</b>)</span>`;
        } else if (dir === '@if' || dir === '@show' || dir === '@hide') {
          const val = this.evaluator.evalExpr(expr, ctx);
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
    }

    _addSubDirectivesToLog(logWrapper, vNode, ctx, renderValue) {
      Object.entries(vNode.subDirectives).forEach(([dir, evs]) => {
        if (dir === '@fetch') return;
        Object.entries(evs).forEach(([evt, expr]) => {
          let info = '';
          if (dir === '@model') {
            const val = this.evaluator.evalExpr(expr, ctx);
            info = `<span style=\"color:#0ff\">(proprietà: <b>${expr}</b>, valore: <b>${val}</b>, evento: <b>${evt}</b>)</span>`;
          } else if (dir === '@watch') {
            info = `<span style=\"color:#0ff\">(osserva: <b>${expr}</b>, evento: <b>${evt}</b>)</span>`;
          } else if (dir === '@text') {
            const val = this.evaluator.evalExpr(expr, ctx);
            info = `<span style=\"color:#0ff\">(valore: <b>${val}</b>, evento: <b>${evt}</b>)</span>`;
          } else if (dir === '@class') {
            const val = this.evaluator.evalExpr(expr, ctx);
            info = `<span style=\"color:#0ff\">(classi: <b>${JSON.stringify(val)}</b>, evento: <b>${evt}</b>)</span>`;
          } else if (dir === '@style') {
            const val = this.evaluator.evalExpr(expr, ctx);
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
      
      this.router.setupCurrentPageProperty();
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

    // Logging methods
    _logDirective(type, name, el, msg, example) {
      if (!window.ayisha || !window.ayisha.logDirectives) return;
      const level = window.ayisha.logLevel || 'warn';
      const prefix = `[Ayisha.${type}]`;
      const where = el && el.outerHTML ? `\nElemento: ${el.outerHTML.slice(0, 120)}...` : '';
      const help = example ? `\nEsempio: ${example}` : '';
      if (level === 'error') console.error(`${prefix} ${name}: ${msg}${where}${help}`);
      else if (level === 'warn') console.warn(`${prefix} ${name}: ${msg}${where}${help}`);
      else console.info(`${prefix} ${name}: ${msg}${where}${help}`);
    }
  }

  // Set up global reference
  window.AyishaVDOM = AyishaVDOM;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AyishaVDOM(document.body).mount());
  } else {
    new AyishaVDOM(document.body).mount();
  }

  // Wrap directive logging for backwards compatibility
  const _oldRenderVNode = AyishaVDOM.prototype._renderVNode;
  AyishaVDOM.prototype._renderVNode = function (vNode, ctx) {
    if (vNode && vNode.directives) {
      Object.keys(vNode.directives).forEach(dir => {
        if (!this.helpSystem.isValidDirective(dir)) {
          this._logDirective('Direttiva', dir, null, 'Direttiva non riconosciuta.', null);
        }
      });
    }
    if (vNode && vNode.subDirectives) {
      Object.entries(vNode.subDirectives).forEach(([dir, evs]) => {
        Object.keys(evs).forEach(evt => {
          const key = `${dir}:${evt}`;
          if (!this.helpSystem.isValidDirective(key)) {
            this._logDirective('SubDirettiva', key, null, 'Sub-direttiva non riconosciuta.', null);
          }
        });
      });
    }
    return _oldRenderVNode.call(this, vNode, ctx);
  };

})();