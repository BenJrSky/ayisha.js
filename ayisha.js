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

      // Patch: If inputType is 'number', always initialize as 0 if not present
      if (inputType === 'number') {
        const varName = expr.split('.')[0];
        if (!(varName in this.state)) {
          this.state[varName] = 0;
          //console.log(`🧠 ensureVarInState: ${varName} = 0 (input[type=number])`);
        }
      }

      // CORREZIONE: Sistema intelligente di deduzione del tipo
      this.smartInitializeVariable(expr, forceString);

      // Gestione variabili annidate tipo form.name o foo.bar.baz
      const dotMatch = expr.match(/([\w$][\w\d$]*(?:\.[\w$][\w\d$]*)+)/);
      if (dotMatch) {
        const path = dotMatch[1].split('.');
        let obj = this.state;
        for (let i = 0; i < path.length; i++) {
          const key = path[i];
          if (!(key in obj)) {
            obj[key] = (i === path.length - 1) ? (forceString ? undefined : undefined) : {};
          } else if (i < path.length - 1 && typeof obj[key] !== 'object') {
            obj[key] = {};
          }
          obj = obj[key];
        }
      }
    }

    smartInitializeVariable(expr, forceString = false) {
      // SISTEMA INTELLIGENTE: Deduce il tipo dal contesto

      // 1. Operazioni numeriche: var++, var--, var+=, var*=, etc.
      const numericOps = expr.match(/([\w$]+)(\+\+|--|\+=|\-=|\*=|\/=)/);
      if (numericOps) {
        const varName = numericOps[1];
        if (!(varName in this.state)) this.state[varName] = 0;
        let currentValue = this.state[varName];
        currentValue = (currentValue === '' || currentValue === undefined || currentValue === null) ? 0 : currentValue * 1;
        if (isNaN(currentValue)) currentValue = 0;
        this.state[varName] = currentValue;
        return;
      }

      // 2. Array operations: var.push, var.filter, var.map, etc.
      const arrayOps = expr.match(/([\w$]+)\.(push|pop|shift|unshift|filter|map|reduce|forEach|length|slice|splice)/);
      if (arrayOps) {
        const varName = arrayOps[1];
        if (!(varName in this.state)) {
          this.state[varName] = [];
          console.log(`🧠 Smart init: ${varName} = [] (detected array operation)`);
        }
        return;
      }

      // 3. Boolean operations: var = true/false, !var, var && something
      const boolOps = expr.match(/([\w$]+)\s*=\s*(true|false)|!([\w$]+)|([\w$]+)\s*(&&|\|\|)/);
      if (boolOps) {
        const varName = boolOps[1] || boolOps[3] || boolOps[4];
        if (varName && !(varName in this.state)) {
          this.state[varName] = false;
          console.log(`🧠 Smart init: ${varName} = false (detected boolean operation)`);
        }
        return;
      }

      // 4. Object property access: var.property
      const objAccess = expr.match(/([\w$]+)\.[\w$]+(?!\()/);
      if (objAccess) {
        const varName = objAccess[1];
        if (!(varName in this.state)) {
          this.state[varName] = {};
          console.log(`🧠 Smart init: ${varName} = {} (detected object property access)`);
        }
        return;
      }

      // 5. String operations: var.toLowerCase, var.includes, var + 'string'
      const stringOps = expr.match(/([\w$]+)\.(toLowerCase|toUpperCase|includes|indexOf|substring|slice|trim)/);
      if (stringOps) {
        const varName = stringOps[1];
        if (!(varName in this.state)) {
          this.state[varName] = undefined;
          console.log(`🧠 Smart init: ${varName} = undefined (detected string operation)`);
        }
        return;
      }

      // 6. Assignments with type hints: var = 123, var = "string", var = []
      const assignment = expr.match(/([\w$]+)\s*=\s*(.+)/);
      if (assignment) {
        const varName = assignment[1];
        const value = assignment[2].trim();

        if (!(varName in this.state)) {
          if (/^\d+$/.test(value)) {
            this.state[varName] = parseInt(value);
            console.log(`🧠 Smart init: ${varName} = ${parseInt(value)} (detected numeric literal)`);
          } else if (/^['"].*['"]$/.test(value)) {
            this.state[varName] = value.slice(1, -1);
            console.log(`🧠 Smart init: ${varName} = "${value.slice(1, -1)}" (detected string literal)`);
          } else if (value === 'true' || value === 'false') {
            this.state[varName] = value === 'true';
            console.log(`🧠 Smart init: ${varName} = ${value} (detected boolean literal)`);
          } else if (value === '[]') {
            this.state[varName] = [];
            console.log(`🧠 Smart init: ${varName} = [] (detected array literal)`);
          } else if (value === '{}') {
            this.state[varName] = {};
            console.log(`🧠 Smart init: ${varName} = {} (detected object literal)`);
          } else if (forceString) {
            this.state[varName] = undefined;
            console.log(`🧠 Smart init: ${varName} = undefined (forced string)`);
          }
        }
        return;
      }

      // 7. Single variable reference: se è da solo, cerca indizi dal nome
      const singleVar = expr.match(/^\s*([\w$]+)\s*$/);
      if (singleVar) {
        const varName = singleVar[1];
        if (!(varName in this.state)) {
          if (/count|total|index|id|size|length|number|num/i.test(varName)) {
            this.state[varName] = 0;
          } else if (/items|list|array|data|results|errors/i.test(varName)) {
            this.state[varName] = [];
          } else if (/show|hide|is|has|can|should|valid|enable/i.test(varName)) {
            this.state[varName] = false;
          } else if (/user|config|form|settings/i.test(varName)) {
            this.state[varName] = {};
          } else if (forceString) {
            this.state[varName] = undefined;
          } else {
            this.state[varName] = undefined;
          }
        }
      }
    }

    ensureArrayVariable(varName) {
      if (!(varName in this.state) || !Array.isArray(this.state[varName])) {
        this.safeSetArrayVariable(varName, []);
      }
    }

    safeSetArrayVariable(varName, value) {
      try {
        // Se il proxy reattivo non è ancora attivo, usa Object.defineProperty
        if (!this.state._isReactive) {
          Object.defineProperty(this.state, varName, {
            value: value,
            writable: true,
            configurable: true,
            enumerable: true
          });
        } else {
          // Se il proxy è attivo, assegna normalmente
          this.state[varName] = value;
        }
      } catch (error) {
        // Fallback: forza Object.defineProperty
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
    }

    makeReactive() {
      // Segna lo stato come reattivo
      this.state._isReactive = true;

      this.state = new Proxy(this.state, {
        set: (obj, prop, val) => {
          // CORREZIONE: Riduce il debug solo per proprietà specifiche
          const isDebugMode = ['userId', 'count', 'items'].includes(prop);
          if (isDebugMode) {
            console.log(`🔄 PROXY SET: ${prop} =`, val, `(type: ${typeof val})`);
          }

          const old = obj[prop];
          if (JSON.stringify(old) === JSON.stringify(val)) {
            obj[prop] = val;
            if (isDebugMode) {
              console.log(`📝 Proxy: ${prop} unchanged, set anyway`);
            }
            return true;
          }

          // CORREZIONE: Prevenzione loop infiniti
          if (prop === 'userUrl' && this._settingUserUrl) {
            console.warn(`🚨 Prevented userUrl loop!`);
            return true;
          }

          if (prop === 'userUrl') {
            this._settingUserUrl = true;
            setTimeout(() => { this._settingUserUrl = false; }, 100);
          }

          obj[prop] = val;
          if (isDebugMode) {
            console.log(`✅ Proxy: ${prop} set to`, val, `- verification:`, obj[prop]);
          }

          // Esegui watcher solo se sono pronti e non siamo in un loop
          if (this.watchersReady && this.watchers[prop] && !this._executingWatcher) {
            this._executingWatcher = true;
            setTimeout(() => {
              this.watchers[prop].forEach(fn => {
                try {
                  fn(val);
                } catch (error) {
                  console.error('Watcher execution error:', error, 'for property:', prop, 'new value:', val);
                }
              });
              this._executingWatcher = false;
            }, 0);
          }

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
      // Patch: Pass input type to ensureVarInState
      this.evaluator.ensureVarInState(key, true, el.type === 'number' ? 'number' : null);
      let ref = this.evaluator.state;
      if (key.includes('.')) {
        const path = key.split('.');
        for (let i = 0; i < path.length - 1; i++) ref = ref[path[i]];
        const last = path[path.length - 1];
        // Patch: For number input, always initialize as 0 if not present
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
          // CORREZIONE: Gestione speciale per input color
          if (val && typeof val === 'string' && val.match(/^#[0-9A-Fa-f]{6}$/)) {
            el.value = val;
          } else if (val && typeof val === 'string' && val.match(/^[0-9A-Fa-f]{6}$/)) {
            el.value = '#' + val;
          } else {
            el.value = '#000000'; // Default color
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
        // Se input type=number, salva come numero (o null se vuoto)
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

      // Assicura che state._validate esista
      if (!this.evaluator.state._validate) {
        this.evaluator.state._validate = {};
      }

      // Inizializza la validazione a false
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
          else if (rule === 'phone') {
            const phoneRegex = /^(\+39|0039|39)?[\s\-]?([0-9]{2,3})[\s\-]?([0-9]{6,7})$/;
            if (el.value && !phoneRegex.test(el.value)) {
              valid = false;
              break;
            }
          }
          else if (rule === 'url') {
            const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
            if (el.value && !urlRegex.test(el.value)) {
              valid = false;
              break;
            }
          }
          else if (rule.startsWith('/') && rule.endsWith('/')) {
            // Regex diretta: /pattern/
            try {
              const pattern = rule.slice(1, -1); // Rimuove i delimitatori /
              const regex = new RegExp(pattern);
              if (el.value && !regex.test(el.value)) {
                valid = false;
                break;
              }
            } catch (e) {
              console.error('Invalid regex pattern:', rule, e);
              valid = false;
              break;
            }
          }
          else if (rule.startsWith('regex:')) {
            // Supporto alternativo: regex:/pattern/ o regex:pattern
            try {
              let pattern = rule.substring(6); // Rimuove 'regex:'
              if (pattern.startsWith('/') && pattern.endsWith('/')) {
                pattern = pattern.slice(1, -1);
              }
              const regex = new RegExp(pattern);
              if (el.value && !regex.test(el.value)) {
                valid = false;
                break;
              }
            } catch (e) {
              console.error('Invalid regex pattern:', rule, e);
              valid = false;
              break;
            }
          }
        }

        // Aggiorna state._validate[variabile]
        this.evaluator.state._validate[modelVar] = valid;

        // Applica classi CSS
        el.classList.toggle('invalid', !valid);
        el.classList.toggle('valid', valid && el.value.length > 0);

        return valid;
      };

      // Validazione iniziale
      validate();

      // Validazione su input e blur
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

      // CORREZIONE: Dopo aver eseguito i blocchi init, forza i tipi corretti per variabili numeriche
      const shouldBeNumbers = ['userId', 'count', 'total', 'index', 'sinistra', 'destra', 'clicks', 'enterPresses', 'debounceCount', 'fontSize', 'sum'];
      shouldBeNumbers.forEach(varName => {
        if (varName in this.state) {
          let value = this.state[varName];
          if (typeof value === 'string' && value !== '') {
            const parsed = parseFloat(value);
            if (!isNaN(parsed)) {
              this.state[varName] = parsed;
              console.log(`🔧 Converted ${varName} from "${value}" to ${parsed}`);
            }
          } else if (value === '' || value === null || value === undefined) {
            this.state[varName] = 0;
            console.log(`🔧 Initialized ${varName} to 0`);
          }
        }
      });
    }

    _preInitializeEssentialVariables() {
      // CORREZIONE: Inizializza solo le variabili critiche del framework
      // Non più liste infinite di variabili!

      // Solo le variabili essenziali per il funzionamento del framework
      if (!this.state._validate) this.state._validate = {};
      if (!this.state.currentPage) this.state.currentPage = '';

      console.log('🔧 Initialized only essential framework variables');
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

      // Ensure variables exist in state
      Object.entries(vNode.directives || {}).forEach(([dir, expr]) => {
        // For @model, force string initialization
        if (dir === '@model') this.evaluator.ensureVarInState(expr, true);
        else this.evaluator.ensureVarInState(expr);
      });
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

      // CORREZIONE: Salva il testo originale per le direttive hover
      if (vNode.subDirectives && vNode.subDirectives['@text'] && vNode.subDirectives['@text']['hover']) {
        // Se c'è testo nei children, salvalo
        const textContent = vNode.children
          .filter(child => child.type === 'text')
          .map(child => child.text)
          .join('');
        if (textContent) {
          el._ayishaOriginalText = textContent;
        }
      }

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

      // CORREZIONE: Dopo aver aggiunto i children, salva il testo per hover se necessario
      if (vNode.subDirectives && vNode.subDirectives['@text'] && vNode.subDirectives['@text']['hover']) {
        if (!el._ayishaOriginalText) {
          el._ayishaOriginalText = el.textContent || el.innerText || '';
        }
      }

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
      // CORREZIONE: Supporta sia "item in items" che "index, item in items"
      let match = vNode.directives['@for'].match(/(\w+),\s*(\w+) in (.+)/);
      if (match) {
        // Sintassi: "i, item in items"
        const [, indexVar, itemVar, expr] = match;
        let arr = this.evaluator.evalExpr(expr, ctx) || [];
        if (typeof arr === 'object' && !Array.isArray(arr)) arr = Object.values(arr);
        const frag = document.createDocumentFragment();
        arr.forEach((val, index) => {
          const clone = JSON.parse(JSON.stringify(vNode));
          delete clone.directives['@for'];
          const subCtx = { ...ctx, [itemVar]: val, [indexVar]: index };
          const node = this._renderVNode(clone, subCtx);
          if (node) frag.appendChild(node);
        });
        return frag;
      }

      // Sintassi originale: "item in items"
      match = vNode.directives['@for'].match(/(\w+) in (.+)/);
      if (match) {
        const [, it, expr] = match;
        let arr = this.evaluator.evalExpr(expr, ctx) || [];
        if (typeof arr === 'object' && !Array.isArray(arr)) arr = Object.values(arr);
        const frag = document.createDocumentFragment();
        arr.forEach((val, index) => {
          const clone = JSON.parse(JSON.stringify(vNode));
          delete clone.directives['@for'];
          // CORREZIONE: Aggiungi sempre $index come variabile disponibile
          const subCtx = { ...ctx, [it]: val, $index: index };
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

      // CORREZIONE: Assicurati che sourceData sia sempre un array
      let arr = [];
      if (Array.isArray(sourceData)) {
        arr = sourceData;
      } else if (sourceData && typeof sourceData === 'object') {
        arr = Object.values(sourceData);
      } else if (sourceData == null) {
        arr = [];
      } else {
        // Se è un valore singolo, mettilo in un array
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

          let processedCode = codeToRun.replace(/\bstate\./g, '');

          console.log(`🚀 CLICK EVENT:`, {
            button: el.textContent?.trim(),
            expression: expr,
            processed: processedCode,
            currentState: { ...this.state }
          });

          try {
            // CORREZIONE: Gestione specifica per casi comuni

            // 1. Incrementi semplici: userId++, count++, etc.
            const incrementMatch = processedCode.match(/^(\w+)\+\+$/);
            if (incrementMatch) {
              const varName = incrementMatch[1];
              if (!(varName in this.state)) {
                this.state[varName] = 0;
              }
              let currentValue = this.state[varName];
              let originalValue = currentValue;
              // Conversione numerica forzata
              currentValue = (currentValue === '' || currentValue === undefined || currentValue === null) ? 0 : currentValue * 1;
              if (isNaN(currentValue)) currentValue = 0;
              const newValue = currentValue + 1;
              try {
                Object.defineProperty(this.state, varName, {
                  value: newValue,
                  writable: true,
                  configurable: true,
                  enumerable: true
                });
              } catch (err) {
                this.state[varName] = newValue;
              }
              setTimeout(() => this.render(), 0);
              return;
            }

            // 2. Decrementi semplici: count--, etc.
            const decrementMatch = processedCode.match(/^(\w+)--$/);
            if (decrementMatch) {
              const varName = decrementMatch[1];
              // CORREZIONE: Stessa logica robusta per i decrementi
              let currentValue = this.state[varName];
              currentValue = (currentValue === '' || currentValue === undefined || currentValue === null) ? 0 : currentValue * 1;
              if (isNaN(currentValue)) currentValue = 0;
              this.state[varName] = currentValue - 1;
              this.render();
              return;
            }

            // 2.5. Operazioni aritmetiche: count += 1, etc.
            const arithMatch = processedCode.match(/^(\w+)\s*([+\-*\/])=\s*(.+)$/);
            if (arithMatch) {
              const [, varName, operator, valueExpr] = arithMatch;
              try {
                let currentValue = this.state[varName];
                let operandValue = this.evaluator.evalExpr(valueExpr, ctx);
                // Conversione numerica forzata
                currentValue = (currentValue === '' || currentValue === undefined || currentValue === null) ? 0 : currentValue * 1;
                if (isNaN(currentValue)) currentValue = 0;
                operandValue = (operandValue === '' || operandValue === undefined || operandValue === null) ? 0 : operandValue * 1;
                if (isNaN(operandValue)) operandValue = 0;
                switch (operator) {
                  case '+': this.state[varName] = currentValue + operandValue; break;
                  case '-': this.state[varName] = currentValue - operandValue; break;
                  case '*': this.state[varName] = currentValue * operandValue; break;
                  case '/': this.state[varName] = operandValue !== 0 ? currentValue / operandValue : currentValue; break;
                }
                this.render();
                return;
              } catch (err) {
                // fallback
              }
            }

            // 3. Filter operations con contesto: items = items.filter(...)
            const filterMatch = processedCode.match(/^(\w+)\s*=\s*\1\.filter\((\w+)\s*=>\s*\2\.(\w+)\s*!==\s*(\w+)\.(\w+)\)$/);
            if (filterMatch && ctx) {
              const [, arrayName, paramName, paramProp, contextVar, contextProp] = filterMatch;
              if (ctx[contextVar] && this.state[arrayName]) {
                const contextValue = ctx[contextVar][contextProp];
                this.state[arrayName] = this.state[arrayName].filter(item => item[paramProp] !== contextValue);
                console.log(`✅ Filtered ${arrayName}, removed item with ${paramProp}:`, contextValue);
                this.render();
                return;
              }
            }

            // 4. Assegnazioni dirette: variable = value
            const assignMatch = processedCode.match(/^(\w+)\s*=\s*(.+)$/);
            if (assignMatch) {
              const [, varName, valueExpr] = assignMatch;
              try {
                const value = this.evaluator.evalExpr(valueExpr, ctx);
                this.state[varName] = value;
                console.log(`✅ Assigned ${varName} =`, value);
                this.render();
                return;
              } catch (err) {
                console.log('Assignment failed, trying general execution');
              }
            }

            // 5. Fallback: esecuzione generale
            console.log('🔄 Using general execution for:', processedCode);
            const func = new Function('state', 'ctx', `
              with(state) {
                ${processedCode}
              }
            `);
            func(this.state, ctx || {});

          } catch (err) {
            console.error('❌ Click execution failed:', err, 'Code:', processedCode);
            this.errorHandler.showAyishaError(el, err, processedCode);
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
            // CORREZIONE: Gestione migliorata per espressioni con 'state.'
            const cleanCode = codeToRun.replace(/\bstate\./g, '');
            new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${cleanCode}}}`)
              (this.state, ctx, e);
          } catch (err) {
            // Fallback: prova con il codice originale
            try {
              new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${codeToRun}}}`)
                (this.state, ctx, e);
            } catch (err2) {
              this.errorHandler.showAyishaError(el, err2, codeToRun);
            }
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
        // CORREZIONE: Se la classe è fade-in, assicurati che l'elemento sia visibile
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
                // CORREZIONE: Gestione migliorata per espressioni con 'state.'
                const cleanCode = codeToRun.replace(/\bstate\./g, '');
                new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${cleanCode}}}`)
                  (this.state, ctx, e);
              } catch (err) {
                // Fallback: prova con il codice originale
                try {
                  new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${codeToRun}}}`)
                    (this.state, ctx, e);
                } catch (err2) {
                  this.errorHandler.showAyishaError(el, err2, codeToRun);
                }
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
          if (!(varName in this.state)) this.state[varName] = undefined;
          this.state[varName] = interpolated;
          this.fetchManager.setupFetch(varName, vNode.directives['@result'] || 'result', ctx, e, true);
        } else {
          this.evaluator.ensureVarInState(expr);
          let codeToRun = expr;
          if (this.evaluator.hasInterpolation(expr)) {
            codeToRun = this.evaluator.evalAttrValue(expr, ctx);
          }
          try {
            // CORREZIONE: Gestione migliorata per espressioni con 'state.'
            const cleanCode = codeToRun.replace(/\bstate\./g, '');
            new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${cleanCode}}}`)
              (this.state, ctx, e);
                   } catch (err) {
            // Fallback: prova con il codice originale
            try {
              new Function('state', 'ctx', 'event', `with(state){with(ctx||{}){${codeToRun}}}`)
                (this.state, ctx, e);
            } catch (err2) {
              this.errorHandler.showAyishaError(el, err2, codeToRun);
            }
          }
          this.fetchManager.setupFetch(expr, vNode.directives['@result'] || 'result', ctx, e, true);
        }
        this.render();
      });
    }

    _handleClassSubDirective(el, evt, getInterpolatedExpr, ctx) {
      if (evt === 'hover') {
        el.addEventListener('mouseover', e => {
          try {
            const expr = getInterpolatedExpr();
            const clsMap = this.evaluator.evalExpr(expr, ctx, e) || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.add(cls);
            });
          } catch (error) {
            console.error('Error in hover class directive:', error);
          }
        });
        el.addEventListener('mouseout', e => {
          try {
            const expr = getInterpolatedExpr();
            const clsMap = this.evaluator.evalExpr(expr, ctx, e) || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.remove(cls);
            });
          } catch (error) {
            console.error('Error in hover class directive:', error);
          }
        });
      } else {
        el.addEventListener(evt === 'hover' ? 'mouseover' : evt, e => {
          try {
            const expr = getInterpolatedExpr();
            const clsMap = this.evaluator.evalExpr(expr, ctx, e) || {};
            Object.entries(clsMap).forEach(([cls, cond]) => {
              if (cond) el.classList.add(cls);
              else el.classList.remove(cls);
            });
          } catch (error) {
            console.error('Error in class directive:', error);
          }
        });
      }
    }

    _handleTextSubDirective(el, evt, getInterpolatedExpr, ctx) {
      // CORREZIONE: Salva il testo originale all'inizio del rendering
      if (!el._ayishaOriginalText) {
        el._ayishaOriginalText = el.textContent || el.innerText || '';
      }

      if (evt === 'click') {
        el.addEventListener('click', e => {
          el.textContent = this.evaluator.evalExpr(getInterpolatedExpr(), ctx, e);
        });
      } else if (evt === 'hover') {
        el.addEventListener('mouseover', e => {
          el.textContent = this.evaluator.evalExpr(getInterpolatedExpr(), ctx, e);
        });
        el.addEventListener('mouseout', () => {
          el.textContent = el._ayishaOriginalText;
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
              // CORREZIONE FINALE: Garantisci sempre che le variabili esistano
              window.ayisha.evaluator.ensureVarInState(code);

              // Esecuzione ultra-sicura del codice
              new Function('state', 'newVal', `
                with(state) { 
                  // Garantisce che le variabili comuni esistano sempre
                  if (!state.log || !Array.isArray(state.log)) {
                    state.log = [];
                  }
                  if (!state.errors || !Array.isArray(state.errors)) {
                    state.errors = [];
                  }
                  if (!state.items || !Array.isArray(state.items)) {
                    state.items = [];
                  }
                  if (!state.data || !Array.isArray(state.data)) {
                    state.data = [];
                  }
                  if (!state.results || !Array.isArray(state.results)) {
                    state.results = [];
                  }
                  if (!state.posts || !Array.isArray(state.posts)) {
                    state.posts = [];
                  }
                  
                  // Ora esegui il codice
                  ${code}
                }
              `)(state, newVal);
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
              // Prepara le variabili array prima dell'esecuzione
              new Function('state', 'newVal', `
                with(state){
                  // Variabili di sicurezza
                  if (!state.log || !Array.isArray(state.log)) {
                    state.log = [];
                  }
                  if (!state.errors || !Array.isArray(state.errors)) {
                    state.errors = [];
                  }
                  if (!state.items || !Array.isArray(state.items)) {
                    state.items = [];
                  }
                  if (!state.data || !Array.isArray(state.data)) {
                    state.data = [];
                  }
                  if (!state.posts || !Array.isArray(state.posts)) {
                    state.posts = [];
                  }
                  
                  ${code}
                }
              `)(state, newVal);
            } catch (e) {
              console.error('Generic watcher error:', e, 'Code:', code);
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
          return `<span style=\"color:#f55">Errore: ${err.message}</span>`;
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
      // ORDINE CRITICO CORRETTO:

      // 1. Parse del DOM PRIMA di tutto
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

      // 2. PRIMO: Pre-inizializza TUTTE le variabili essenziali
      this._preInitializeEssentialVariables();

      // 3. SECONDO: Attiva il sistema reattivo (ma watcher ancora disabilitati)
      this._makeReactive();

      // 4. TERZO: Esegui i blocchi init (ora le variabili esistono già)
      this._runInitBlocks();

      // 5. QUARTO: Abilita i watcher (ora tutto è pronto)
      this.reactivitySystem.enableWatchers();

      // 6. Setup routing
      this._setupRouting();
      this.router.setupCurrentPageProperty();

      // 7. Primo render
      this.render();

      // 8. Event listeners
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

  // CORREZIONE: Aggiungi CSS per le animazioni se non esistono
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