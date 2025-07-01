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

    ensureVarInState(expr, forceString = false, inputType = null) {
      if (typeof expr !== 'string') return;

      // FIXED: Don't create variables for JavaScript globals and built-ins
      const jsGlobals = [
        'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Math', 'RegExp',
        'console', 'window', 'document', 'setTimeout', 'setInterval', 'fetch', 'localStorage',
        'sessionStorage', 'history', 'location', 'navigator', 'undefined', 'null', 'true', 'false'
      ];

      // FIXED: Restore smart array initialization
      const arrayOps = expr.match(/([\w$]+)\.(push|pop|shift|unshift|filter|map|reduce|forEach|length|slice|splice)/);
      if (arrayOps) {
        const varName = arrayOps[1];
        if (!jsGlobals.includes(varName) && !(varName in this.state)) {
          this.state[varName] = [];
          console.log(`🧠 Smart init: ${varName} = [] (detected array operation)`);
        }
        return;
      }

      // FIXED: Only initialize if variable doesn't exist and is not a JS global
      const varName = expr.split('.')[0];
      if (!jsGlobals.includes(varName) && !(varName in this.state)) {
        if (inputType === 'number') {
          this.state[varName] = 0;
        } else if (forceString) {
          this.state[varName] = undefined;
        } else {
          // Smart initialization based on variable name patterns
          if (/items|list|array|data|results|errors|posts|todos|users/.test(varName)) {
            this.state[varName] = [];
          } else if (/count|total|index|id|size|length|number|num/.test(varName)) {
            this.state[varName] = 0;
          } else if (/show|hide|is|has|can|should|valid|enable/.test(varName)) {
            this.state[varName] = false;
          } else if (/user|config|form|settings/.test(varName)) {
            this.state[varName] = {};
          } else {
            this.state[varName] = undefined;
          }
        }
      }

      // Handle nested variables like form.name or foo.bar.baz
      const dotMatch = expr.match(/([\w$][\w\d$]*(?:\.[\w$][\w\d$]*)+)/);
      if (dotMatch) {
        const path = dotMatch[1].split('.');
        const rootVar = path[0];
        
        // Don't create nested properties on JS globals
        if (jsGlobals.includes(rootVar)) return;
        
        let obj = this.state;
        for (let i = 0; i < path.length; i++) {
          const key = path[i];
          if (!(key in obj)) {
            obj[key] = (i === path.length - 1) ? undefined : {};
          } else if (i < path.length - 1 && typeof obj[key] !== 'object') {
            obj[key] = {};
          }
          obj = obj[key];
        }
      }
    }

    safeSetArrayVariable(varName, value) {
      try {
        this.state[varName] = value;
      } catch (error) {
        Object.defineProperty(this.state, varName, {
          value: value,
          writable: true,
          configurable: true,
          enumerable: true
        });
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
      this.watchersReady = false;
      this._isUpdating = false; // FIXED: Prevent cascade updates
    }

    makeReactive() {
      this.state._isReactive = true;

      this.state = new Proxy(this.state, {
        set: (obj, prop, val) => {
          // FIXED: Prevent cascade effects during updates
          if (this._isUpdating) {
            obj[prop] = val;
            return true;
          }

          const old = obj[prop];
          if (JSON.stringify(old) === JSON.stringify(val)) {
            obj[prop] = val;
            return true;
          }

          // FIXED: Set flag to prevent cascade
          this._isUpdating = true;
          obj[prop] = val;

          // Execute watchers only if ready and for the specific property
          if (this.watchersReady && this.watchers[prop]) {
            this.watchers[prop].forEach(fn => {
              try {
                fn(val);
              } catch (error) {
                console.error('Watcher execution error:', error, 'for property:', prop);
              }
            });
          }

          // FIXED: Reset flag and render after all updates
          setTimeout(() => {
            this._isUpdating = false;
            this.renderCallback();
          }, 0);

          return true;
        }
      });
      return this.state;
    }

    addWatcher(prop, fn) {
      this.watchers[prop] = this.watchers[prop] || [];
      this.watchers[prop].push(fn);
    }

    enableWatchers() {
      this.watchersReady = true;
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
      
      // If still undefined, use raw expression (for direct URLs)
      if (url === undefined || url === null) {
        url = expr;
      }
      
      if (!url) return;

      console.log('🌐 setupFetch called:', { url, resultVariable: rk, force });

      const fid = `${url}::${rk}`;
      if (!force && this.lastFetchUrl[rk] === url) return;
      if (this.pendingFetches[fid]) return;

      this.pendingFetches[fid] = true;
      this.lastFetchUrl[rk] = url;

      // FIXED: Initialize result variable immediately
      if (!(rk in this.evaluator.state)) {
        this.evaluator.state[rk] = null; // Initialize as null instead of undefined
        console.log(`🔧 Initialized ${rk} = null`);
      }

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
          console.log('🌐 Fetch successful:', { url, data, resultVariable: rk });
          
          const oldVal = this.evaluator.state[rk];
          const isEqual = JSON.stringify(oldVal) === JSON.stringify(data);
          if (!isEqual) {
            this.evaluator.state[rk] = data;
            console.log(`✅ Set ${rk} =`, data);
          }
          if (this.fetched[url]) delete this.fetched[url].error;
        })
        .catch(err => {
          console.error('🌐 Fetch error:', { url, error: err.message, resultVariable: rk });
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
        '@for': `Esempio: <li @for="item in items">{{item}}</li> o <li @for="i, item in items">{{i}}: {{item}}</li>`,
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
      this.evaluator.ensureVarInState(key, true, el.type === 'number' ? 'number' : null);
      let ref = this.evaluator.state;
      if (key.includes('.')) {
        const path = key.split('.');
        for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]];
        const last = path[path.length - 1];
        if (el.type === 'number') {
          if (typeof ref[last] !== 'number') ref[last] = 0;
        } else {
          if (typeof ref[last] !== 'string') ref[last] = undefined;
        }
      } else {
        if (el.type === 'number') {
          if (typeof this.evaluator.state[key] !== 'number') this.evaluator.state[key] = 0;
        } else {
          if (typeof this.evaluator.state[key] !== 'string') this.evaluator.state[key] = undefined;
        }
      }

      const update = () => {
        const val = this.evaluator.evalExpr(key, ctx);
        if (el.type === 'checkbox') {
          el.checked = !!val;
        } else if (el.type === 'radio') {
          el.checked = val == el.value;
        } else if (el.type === 'color') {
          if (val && typeof val === 'string' && val.match(/^#[0-9A-Fa-f]{6}$/)) {
            el.value = val;
          } else if (val && typeof val === 'string' && val.match(/^[0-9A-Fa-f]{6}$/)) {
            el.value = '#' + val;
          } else {
            el.value = '#000000';
          }
        } else {
          if (el.value !== String(val)) el.value = val ?? '';
        }
      };

      this.modelBindings.push({ el, update });
      update();

      el.addEventListener('input', () => {
        this.evaluator.ensureVarInState(key, true, el.type === 'number' ? 'number' : null);
        let ref = this.evaluator.state;
        let value = el.value;
        if (el.type === 'number') {
          value = value === '' ? undefined : Number(value);
        }
        if (key.includes('.')) {
          const path = key.split('.');
          for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]];
          const last = path[path.length - 1];
          if (el.type === 'number') {
            ref[last] = value;
          } else {
            if (typeof ref[last] !== 'string') ref[last] = '';
            ref[last] = value;
          }
        } else {
          if (el.type === 'number') {
            this.evaluator.state[key] = value;
          } else {
            if (typeof this.evaluator.state[key] !== 'string') this.evaluator.state[key] = '';
            this.evaluator.state[key] = value;
          }
        }
        this.renderCallback();
      });
    }

    bindValidation(el, rulesStr, modelVar = null) {
      const rules = rulesStr.split(',').map(r => r.trim());

      if (!modelVar) {
        console.warn('@validate requires @model to be present on the same element');
        return;
      }

      if (!this.evaluator.state._validate) {
        this.evaluator.state._validate = {};
      }

      this.evaluator.state._validate[modelVar] = false;

      const validate = () => {
        let valid = true;

        for (const rule of rules) {
          if (rule === 'required') {
            if (!el.value || !el.value.trim()) {
              valid = false;
              break;
            }
          }
          else if (rule.startsWith('minLength:')) {
            const minLen = parseInt(rule.split(':')[1], 10);
            if (el.value.length < minLen) {
              valid = false;
              break;
            }
          }
          else if (rule.startsWith('maxLength:')) {
            const maxLen = parseInt(rule.split(':')[1], 10);
            if (el.value.length > maxLen) {
              valid = false;
              break;
            }
          }
          else if (rule.startsWith('min:')) {
            const minVal = parseFloat(rule.split(':')[1]);
            const val = parseFloat(el.value);
            if (isNaN(val) || val < minVal) {
              valid = false;
              break;
            }
          }
          else if (rule.startsWith('max:')) {
            const maxVal = parseFloat(rule.split(':')[1]);
            const val = parseFloat(el.value);
            if (isNaN(val) || val > maxVal) {
              valid = false;
              break;
            }
          }
          else if (rule === 'email') {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (el.value && !emailRegex.test(el.value)) {
              valid = false;
              break;
            }
          }
        }

        this.evaluator.state._validate[modelVar] = valid;
        el.classList.toggle('invalid', !valid);
        el.classList.toggle('valid', valid && el.value.length > 0);

        return valid;
      };

      validate();
      el.addEventListener('input', () => {
        validate();
        this.renderCallback();
      });
      el.addEventListener('blur', validate);
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

      // FIXED: Clean up any accidentally created JS global variables in state
      const jsGlobals = [
        'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'Math', 'RegExp',
        'console', 'window', 'document', 'setTimeout', 'setInterval', 'fetch', 'localStorage',
        'sessionStorage', 'history', 'location', 'navigator', 'undefined', 'null', 'true', 'false'
      ];
      
      jsGlobals.forEach(globalName => {
        if (globalName in this.state) {
          delete this.state[globalName];
          console.log(`🧹 Cleaned up global variable: ${globalName}`);
        }
      });

      // FIXED: Clean up any expression-based variable names (contain operators, spaces, etc.)
      const stateKeys = Object.keys(this.state);
      stateKeys.forEach(key => {
        // Remove variables that look like expressions rather than proper variable names
        if (/[+\-*\/=<>!&|(){}[\].,\s]|=>|==|!=|<=|>=|\|\||&&/.test(key)) {
          delete this.state[key];
          console.log(`🧹 Cleaned up expression-based variable: ${key}`);
        }
      });

      // Only ensure essential variables exist
      const essentialVars = ['_validate', 'currentPage'];
      essentialVars.forEach(varName => {
        if (!(varName in this.state)) {
          if (varName === '_validate') this.state[varName] = {};
          else if (varName === 'currentPage') this.state[varName] = '';
        }
      });
    }

    _preInitializeEssentialVariables() {
      // FIXED: Only initialize framework-essential variables
      if (!this.state._validate) this.state._validate = {};
      if (!this.state.currentPage) this.state.currentPage = '';
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

    _bindValidation(el, rulesStr, modelVar = null) {
      return this.bindingManager.bindValidation(el, rulesStr, modelVar);
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

      // FIXED: Only ensure variables for simple variable names, not complex expressions
      Object.entries(vNode.directives || {}).forEach(([dir, expr]) => {
        // Only ensure variables for simple identifiers, not complex expressions
        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim())) {
          if (dir === '@model') this.evaluator.ensureVarInState(expr, true);
          else this.evaluator.ensureVarInState(expr);
        }
      });
      
      Object.values(vNode.subDirectives || {}).forEach(ev => 
        Object.values(ev).forEach(expr => {
          // Only ensure variables for simple identifiers
          if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr.trim())) {
            this.evaluator.ensureVarInState(expr);
          }
        })
      );

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

      // Add children FIRST
      vNode.children.forEach(child => {
        const node = this._renderVNode(child, ctx);
        if (node) el.appendChild(node);
      });

      // FIXED: Handle sub-directives AFTER children are added (so original text is captured correctly)
      this._handleSubDirectives(el, vNode, ctx);

      return el;
    }

    _handleForDirective(vNode, ctx) {
      let match = vNode.directives['@for'].match(/(\w+),\s*(\w+) in (.+)/);
      if (match) {
        const [, indexVar, itemVar, expr] = match;
        let arr = this.evaluator.evalExpr(expr, ctx) || [];
        if (typeof arr === 'object' && !Array.isArray(arr)) arr = Object.values(arr);
        const frag = document.createDocumentFragment();
        arr.forEach((val, index) => {
          const clone = JSON.parse(JSON.stringify(vNode));
          delete clone.directives['@for'];
          // FIXED: Create reactive reference to original array item
          const subCtx = { 
            ...ctx, 
            [itemVar]: val, 
            [indexVar]: index,
            [`${itemVar}_index`]: index,
            [`${itemVar}_ref`]: `${expr.split('.')[0]}[${index}]` // Reference to original item
          };
          const node = this._renderVNode(clone, subCtx);
          if (node) frag.appendChild(node);
        });
        return frag;
      }

      match = vNode.directives['@for'].match(/(\w+) in (.+)/);
      if (match) {
        const [, it, expr] = match;
        let arr = this.evaluator.evalExpr(expr, ctx) || [];
        if (typeof arr === 'object' && !Array.isArray(arr)) arr = Object.values(arr);
        
        // FIXED: For filtered arrays, we need to find the original indices
        const originalArrayName = expr.split('.')[0];
        const isFiltered = expr.includes('.filter');
        
        const frag = document.createDocumentFragment();
        arr.forEach((val, index) => {
          const clone = JSON.parse(JSON.stringify(vNode));
          delete clone.directives['@for'];
          
          // FIXED: Find original index for filtered arrays
          let originalIndex = index;
          if (isFiltered && this.state[originalArrayName]) {
            originalIndex = this.state[originalArrayName].findIndex(item => 
              item.id === val.id || JSON.stringify(item) === JSON.stringify(val)
            );
          }
          
          const subCtx = { 
            ...ctx, 
            [it]: val, 
            $index: index,
            $originalIndex: originalIndex,
            $arrayName: originalArrayName
          };
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
      let sourceData = this.evaluator.evalExpr(vNode.directives['@source'], ctx);

      let arr = [];
      if (Array.isArray(sourceData)) {
        arr = sourceData;
      } else if (sourceData && typeof sourceData === 'object') {
        arr = Object.values(sourceData);
      } else if (sourceData == null) {
        arr = [];
      } else {
        arr = [sourceData];
      }

      const setState = (key, val) => {
        if (JSON.stringify(this.state[key]) !== JSON.stringify(val)) {
          Object.defineProperty(this.state, key, { value: val, writable: true, configurable: true, enumerable: true });
        }
      };
      let used = false;

      if (vNode.directives['@map']) {
        used = true;
        try {
          const fn = new Function('item', `return (${vNode.directives['@map']})`);
          setState(vNode.directives['@result'] || 'result', arr.map(fn));
        } catch (error) {
          console.error('Error in @map directive:', error);
          setState(vNode.directives['@result'] || 'result', []);
        }
      }

      if (vNode.directives['@filter']) {
        used = true;
        try {
          const fn = new Function('item', `return (${vNode.directives['@filter']})`);
          setState(vNode.directives['@result'] || 'result', arr.filter(fn));
        } catch (error) {
          console.error('Error in @filter directive:', error);
          setState(vNode.directives['@result'] || 'result', []);
        }
      }

      if (vNode.directives['@reduce']) {
        used = true;
        try {
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

          let result;
          if (arr.length === 0) {
            result = initial !== undefined ? initial : undefined;
          } else {
            result = initial !== undefined ? arr.reduce(redFn, initial) : arr.reduce(redFn);
          }
          setState(vNode.directives['@result'] || 'result', result);
        } catch (error) {
          console.error('Error in @reduce directive:', error);
          const initial = vNode.directives['@initial'] ? this.evaluator.evalExpr(vNode.directives['@initial'], ctx) : undefined;
          setState(vNode.directives['@result'] || 'result', initial !== undefined ? initial : undefined);
        }
      }

      if (used) return document.createComment('functional');
      return null;
    }

    _handleComponentDirective(vNode, ctx) {
      if (!vNode.directives['@src']) {
        return this.errorHandler.createErrorElement(`Error: <b>&lt;component&gt;</b> requires the <b>@src</b> attribute`);
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
        return this.errorHandler.createErrorElement(`Error: Invalid component URL`);
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
      placeholder.textContent = `Loading component: ${srcUrl}`;
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
      // @click - FIXED: Isolated execution to prevent cross-variable interference
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

          // FIXED: Clean processing without state prefix issues
          let processedCode = codeToRun.replace(/\bstate\./g, '');

          console.log('🚀 CLICK DEBUG:', {
            originalExpr: expr,
            processedCode: processedCode,
            context: ctx
          });

          try {
            // FIXED: Handle operations on loop context objects (like post.likes++)
            const contextObjMatch = processedCode.match(/^(\w+)\.(\w+)(\+\+|--|=.+)$/);
            if (contextObjMatch) {
              const [, objName, propName, operation] = contextObjMatch;
              console.log('🔍 Context object operation detected:', {
                objName, propName, operation,
                hasContext: !!ctx,
                contextKeys: ctx ? Object.keys(ctx) : [],
                contextObj: ctx ? ctx[objName] : 'not found'
              });

              if (ctx && ctx[objName]) {
                const targetObj = ctx[objName];
                
                // For array items, try to find and update in original array
                if (targetObj && typeof targetObj === 'object' && targetObj.id) {
                  // Find the array that contains this object
                  for (const [stateKey, stateValue] of Object.entries(this.state)) {
                    if (Array.isArray(stateValue)) {
                      const index = stateValue.findIndex(item => 
                        item && item.id === targetObj.id
                      );
                      if (index !== -1) {
                        console.log(`🎯 Found object in state.${stateKey}[${index}]`);
                        
                        if (operation === '++') {
                          this.state[stateKey][index][propName] = (this.state[stateKey][index][propName] || 0) + 1;
                          console.log(`✅ Incremented ${stateKey}[${index}].${propName} = ${this.state[stateKey][index][propName]}`);
                          
                          // FIXED: Force reactivity trigger by directly calling render
                          setTimeout(() => this.render(), 0);
                          return;
                        } else if (operation === '--') {
                          this.state[stateKey][index][propName] = (this.state[stateKey][index][propName] || 0) - 1;
                          console.log(`✅ Decremented ${stateKey}[${index}].${propName} = ${this.state[stateKey][index][propName]}`);
                          
                          // FIXED: Force reactivity trigger by directly calling render
                          setTimeout(() => this.render(), 0);
                          return;
                        } else if (operation.startsWith('=')) {
                          const value = this.evaluator.evalExpr(operation.substring(1).trim(), ctx);
                          this.state[stateKey][index][propName] = value;
                          console.log(`✅ Set ${stateKey}[${index}].${propName} = ${value}`);
                          
                          // FIXED: Force reactivity trigger by directly calling render
                          setTimeout(() => this.render(), 0);
                          return;
                        }
                      }
                    }
                  }
                  console.warn('❌ Could not find object in any state array');
                } else {
                  console.warn('❌ Target object has no ID or is not an object:', targetObj);
                }
              } else {
                console.warn('❌ Context object not found:', objName);
              }
            }

            // FIXED: Handle array filter operations with context
            const filterMatch = processedCode.match(/^(\w+)\s*=\s*(\w+)\.filter\((.+)\)$/);
            if (filterMatch) {
              const [, targetVar, sourceVar, filterExpr] = filterMatch;
              console.log('🔍 Filter operation detected:', {
                targetVar, 
                sourceVar, 
                filterExpr, 
                context: ctx,
                currentArray: this.state[sourceVar],
                arrayLength: this.state[sourceVar] ? this.state[sourceVar].length : 'undefined'
              });
              
              if (ctx && filterExpr.includes('!==') && targetVar === sourceVar) {
                // FIXED: Extract the variable name from the filter expression
                // For "p => p.id !== post.id", we want to find "post" in context
                const varMatch = filterExpr.match(/!==\s*(\w+)\.id/);
                let postToDelete = null;
                
                if (varMatch) {
                  const varName = varMatch[1]; // Should be "post"
                  postToDelete = ctx[varName];
                  console.log(`🎯 Looking for context variable: ${varName}`, postToDelete);
                } else {
                  // Fallback: search for any object with ID
                  for (const [ctxKey, ctxValue] of Object.entries(ctx)) {
                    console.log(`🔍 Checking context[${ctxKey}]:`, ctxValue);
                    if (ctxValue && typeof ctxValue === 'object' && ctxValue.id && ctxKey !== 'users') {
                      postToDelete = ctxValue;
                      console.log(`🎯 Found potential post object: ${ctxKey}`, postToDelete);
                      break;
                    }
                  }
                }
                
                if (postToDelete && postToDelete.id) {
                  const originalLength = this.state[targetVar].length;
                  const itemToDeleteId = postToDelete.id;
                  
                  console.log(`🗑️ Attempting to delete post with ID: ${itemToDeleteId}`);
                  console.log(`🗑️ Current posts:`, this.state[targetVar].map(p => ({ id: p.id, title: p.title })));
                  
                  this.state[targetVar] = this.state[targetVar].filter(p => p.id !== itemToDeleteId);
                  const newLength = this.state[targetVar].length;
                  
                  console.log(`✅ After deletion - posts:`, this.state[targetVar].map(p => ({ id: p.id, title: p.title })));
                  console.log(`✅ Deletion result:`, {
                    originalLength,
                    newLength,
                    deleted: originalLength - newLength,
                    targetArray: targetVar
                  });
                  
                  // Force re-render for array changes
                  setTimeout(() => this.render(), 0);
                  return;
                } else {
                  console.warn('❌ Could not find post to delete in context:', ctx);
                }
              } else {
                console.log('🔍 Filter operation not recognized as delete:', {
                  hasContext: !!ctx,
                  includesNotEqual: filterExpr.includes('!=='),
                  targetEqualsSource: targetVar === sourceVar
                });
              }
            }

            // FIXED: Pre-scan for array operations and ensure arrays exist
            const arrayMatches = processedCode.match(/([\w$]+)\.(push|pop|shift|unshift|filter|map|reduce|forEach|slice|splice)/g);
            if (arrayMatches) {
              arrayMatches.forEach(match => {
                const varName = match.split('.')[0];
                if (!(varName in this.state) || !Array.isArray(this.state[varName])) {
                  this.state[varName] = [];
                  console.log(`🔧 Auto-initialized array: ${varName} = []`);
                }
              });
            }

            // FIXED: More precise variable handling
            const incrementMatch = processedCode.match(/^(\w+)\+\+$/);
            if (incrementMatch) {
              const varName = incrementMatch[1];
              if (!(varName in this.state)) {
                this.state[varName] = 0;
              }
              let currentValue = Number(this.state[varName]) || 0;
              this.state[varName] = currentValue + 1;
              return;
            }

            const decrementMatch = processedCode.match(/^(\w+)--$/);
            if (decrementMatch) {
              const varName = decrementMatch[1];
              let currentValue = Number(this.state[varName]) || 0;
              this.state[varName] = currentValue - 1;
              return;
            }

            const arithMatch = processedCode.match(/^(\w+)\s*([+\-*\/])=\s*(.+)$/);
            if (arithMatch) {
              const [, varName, operator, valueExpr] = arithMatch;
              let currentValue = Number(this.state[varName]) || 0;
              let operandValue = Number(this.evaluator.evalExpr(valueExpr, ctx)) || 0;
              switch (operator) {
                case '+': this.state[varName] = currentValue + operandValue; break;
                case '-': this.state[varName] = currentValue - operandValue; break;
                case '*': this.state[varName] = currentValue * operandValue; break;
                case '/': this.state[varName] = operandValue !== 0 ? currentValue / operandValue : currentValue; break;
              }
              return;
            }

            const assignMatch = processedCode.match(/^(\w+)\s*=\s*(.+)$/);
            if (assignMatch) {
              const [, varName, valueExpr] = assignMatch;
              const value = this.evaluator.evalExpr(valueExpr, ctx);
              this.state[varName] = value;
              return;
            }

            // General execution as fallback
            console.log('🔄 Fallback execution:', processedCode);
            const func = new Function('state', 'ctx', `with(state) { ${processedCode} }`);
            func(this.state, ctx || {});

          } catch (err) {
            console.error('Click execution error:', err, 'Code:', processedCode);
            this.errorHandler.showAyishaError(el, err, processedCode);
          }
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
            const cleanCode = codeToRun.replace(/\bstate\./g, '');
            new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${cleanCode}}}`)
              (this.state, ctx, e);
          } catch (err) {
            this.errorHandler.showAyishaError(el, err, codeToRun);
          }
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
        try {
          const textValue = this.evaluator.evalExpr(vNode.directives['@text'], ctx);
          // FIXED: Handle undefined/null values gracefully
          if (textValue === undefined) {
            el.textContent = '';
          } else if (textValue === null) {
            el.textContent = 'null';
          } else {
            el.textContent = String(textValue);
          }
        } catch (error) {
          console.error('Error in @text directive:', error, 'Expression:', vNode.directives['@text']);
          el.textContent = `[Error: ${error.message}]`;
        }
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
        const modelVar = vNode.directives['@model'] || null;
        this.bindingManager.bindValidation(el, vNode.directives['@validate'], modelVar);
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
        const animationClass = vNode.directives['@animate'];
        el.classList.add(animationClass);
        if (animationClass === 'fadeIn' || animationClass === 'fade-in') {
          el.style.opacity = '1';
          el.style.transition = 'opacity 0.3s ease-in-out';
        }
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
            // FIXED: Use evalExpr directly for object expressions, evalAttrValue for interpolations
            const getEvaluatedExpr = () => {
              // For class expressions that are objects, use evalExpr directly
              if (dir === '@class' && expr.trim().startsWith('{')) {
                return this.evaluator.evalExpr(expr, ctx);
              }
              // For other expressions, use evalAttrValue for interpolation support
              return this.evaluator.evalAttrValue(expr, ctx);
            };

            if (dir === '@fetch') {
              this._handleFetchSubDirective(el, eventName, expr, vNode, ctx);
              return;
            }

            if (dir === '@class') {
              this._handleClassSubDirective(el, evt, getEvaluatedExpr, ctx);
              return;
            }

            if (dir === '@text') {
              this._handleTextSubDirective(el, evt, getEvaluatedExpr, ctx);
              return;
            }

            // Default: execute as pure JS code
            el.addEventListener(eventName, e => {
              let codeToRun = getEvaluatedExpr();
              try {
                const cleanCode = String(codeToRun).replace(/\bstate\./g, '');
                new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${cleanCode}}}`)
                  (this.state, ctx, e);
              } catch (err) {
                this.errorHandler.showAyishaError(el, err, codeToRun);
              }
            });
          }
        });
      });
    }

    _handleFetchSubDirective(el, eventName, expr, vNode, ctx) {
      el.addEventListener(eventName, e => {
        // FIXED: Simplified logic - just pass the expression to setupFetch
        // setupFetch can handle URLs, variables, and interpolated expressions
        
        const resultVar = vNode.directives['@result'] || 'result';
        
        try {
          // Try to evaluate as expression first (for variables)
          let url = this.evaluator.evalExpr(expr, ctx);
          if (url === undefined) {
            // If evaluation fails, use the raw expression (for direct URLs)
            url = expr;
          }
          
          console.log('🌐 Fetch click triggered:', {
            expression: expr,
            evaluatedUrl: url,
            resultVar: resultVar
          });
          
          this.fetchManager.setupFetch(url, resultVar, ctx, e, true);
          
        } catch (err) {
          // Fallback: use raw expression
          console.log('🌐 Fetch fallback - using raw expression:', expr);
          this.fetchManager.setupFetch(expr, resultVar, ctx, e, true);
        }
      });
    }

    _handleClassSubDirective(el, evt, getEvaluatedExpr, ctx) {
      if (evt === 'hover') {
        el.addEventListener('mouseover', e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.add(cls);
            });
          } catch (error) {
            console.error('Error in hover class directive:', error);
          }
        });
        el.addEventListener('mouseout', e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.remove(cls);
            });
          } catch (error) {
            console.error('Error in hover class directive:', error);
          }
        });
      } else if (evt === 'focus') {
        // Focus: add class when focused
        el.addEventListener('focus', e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.add(cls);
            });
          } catch (error) {
            console.error('Error in focus class directive:', error);
          }
        });
        // Remove class when loses focus (blur)
        el.addEventListener('blur', e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.remove(cls);
            });
          } catch (error) {
            console.error('Error in blur class directive:', error);
          }
        });
      } else if (evt === 'input') {
        // Input: add class while user is typing, remove on blur
        el.addEventListener('input', e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.add(cls);
            });
          } catch (error) {
            console.error('Error in input class directive:', error);
          }
        });
        el.addEventListener('blur', e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.remove(cls);
            });
          } catch (error) {
            console.error('Error in input blur class directive:', error);
          }
        });
      } else if (evt === 'click') {
        // Click: toggle class on each click
        el.addEventListener('click', e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) {
                el.classList.toggle(cls);
              }
            });
          } catch (error) {
            console.error('Error in click class directive:', error);
          }
        });
      } else {
        // For other events, add class when event occurs
        el.addEventListener(evt, e => {
          try {
            const clsMap = getEvaluatedExpr() || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) {
                el.classList.add(cls);
              }
            });
          } catch (error) {
            console.error('Error in class directive:', error);
          }
        });
      }
    }

    _handleTextSubDirective(el, evt, getInterpolatedExpr, ctx) {
      // FIXED: Capture original text AFTER element is fully rendered with children
      if (!el._ayishaOriginalText) {
        // Get the complete text content including all nested text
        el._ayishaOriginalText = el.textContent || el.innerText || '';
        // console.log('Captured original text:', el._ayishaOriginalText);
      }

      if (evt === 'click') {
        el.addEventListener('click', e => {
          const newText = this.evaluator.evalExpr(getInterpolatedExpr(), ctx, e);
          el.textContent = newText;
        });
      } else if (evt === 'hover') {
        el.addEventListener('mouseover', e => {
          const newText = this.evaluator.evalExpr(getInterpolatedExpr(), ctx, e);
          el.textContent = newText;
        });
        el.addEventListener('mouseout', () => {
          // Restore original text
          el.textContent = el._ayishaOriginalText || '';
        });
      } else if (evt === 'input' || evt === 'focus' || evt === 'blur') {
        el.addEventListener(evt, e => {
          const newText = this.evaluator.evalExpr(getInterpolatedExpr(), ctx, e);
          el.textContent = newText;
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
              window.ayisha.evaluator.ensureVarInState(code);
              new Function('state', 'newVal', `with(state) { ${code} }`)(state, newVal);
            } catch (e) {
              console.error('Watcher error:', e, 'Code:', code, 'Prop:', prop, 'NewVal:', newVal);
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
              new Function('state', 'newVal', `with(state){ ${code} }`)(state, newVal);
            } catch (e) {
              console.error('Generic watcher error:', e, 'Code:', code);
            }
          });
        }
      });
    }

    mount() {
      // Parse DOM first
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

      // Initialize essential variables
      this._preInitializeEssentialVariables();

      // Make reactive
      this._makeReactive();

      // Run init blocks
      this._runInitBlocks();

      // Enable watchers
      this.reactivitySystem.enableWatchers();

      // Setup routing
      this._setupRouting();
      this.router.setupCurrentPageProperty();

      // First render
      this.render();

      // Event listeners
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

  // Set up global reference
  window.AyishaVDOM = AyishaVDOM;

  // Add default animation styles
  const addDefaultAnimationStyles = () => {
    const existingStyle = document.getElementById('ayisha-default-animations');
    if (!existingStyle) {
      const style = document.createElement('style');
      style.id = 'ayisha-default-animations';
      style.textContent = `
        .fadeIn, .fade-in {
          animation: ayishaFadeIn 0.3s ease-in-out;
        }
        
        @keyframes ayishaFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .slide-down {
          overflow: hidden;
          transition: height 0.3s ease-in-out;
        }
      `;
      document.head.appendChild(style);
    }
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      addDefaultAnimationStyles();
      new AyishaVDOM(document.body).mount();
    });
  } else {
    addDefaultAnimationStyles();
    new AyishaVDOM(document.body).mount();
  }

})();