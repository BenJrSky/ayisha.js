(function(window) {
  class Ayisha {
    constructor(root = document) {
      this.root = root;
      this.watchers = {};
      this.loading = {};
      this.error = {};
      this.actions = {};
      this.plugins = new Map();
      this.components = new Map();
      this.validators = new Map();
      this.animations = new Map();
      this.devMode = false;
      this.config = {};

      // Stato iniziale con router SPA e alcune proprietà di default
      const initialState = { 
        currentPage: window.location.pathname,
        // Default properties to prevent ReferenceError
        textColor: '#000000',
        fontSize: 16,
        isActive: false,
        email_valid: false,
        password_valid: false,
        age_valid: false
      };
      this.state = this._makeReactive(initialState);

      window.addEventListener('popstate', () => {
        this.state.currentPage = window.location.pathname;
      });

      // Cache per funzioni compilate
      this._fnCache = new Map();
      
      // Setup built-in validators
      this._setupBuiltinValidators();
      
      // Setup built-in animations
      this._setupBuiltinAnimations();
      
      // Setup memory management
      this._setupMemoryManagement();
      
      // Initialize component processing in init chain
      this._componentProcessingEnabled = true;
    }

    // —————————————
    // Plugin System
    // —————————————
    use(plugin, options = {}) {
      if (typeof plugin === 'function') {
        plugin.call(this, this, options);
      } else if (plugin.install) {
        plugin.install.call(this, this, options);
      }
      this.plugins.set(plugin.name || 'anonymous', plugin);
      return this;
    }

    createPlugin(name, definition) {
      const plugin = {
        name,
        install(ayisha, options = {}) {
          if (definition.state) {
            Object.assign(ayisha.state, definition.state);
          }
          
          if (definition.methods) {
            Object.entries(definition.methods).forEach(([methodName, method]) => {
              ayisha[methodName] = method.bind(ayisha);
            });
          }
          
          if (definition.directives) {
            Object.entries(definition.directives).forEach(([directive, handler]) => {
              ayisha._customDirectives = ayisha._customDirectives || new Map();
              ayisha._customDirectives.set(directive, handler);
            });
          }
          
          if (definition.components) {
            Object.entries(definition.components).forEach(([compName, comp]) => {
              ayisha.component(compName, comp);
            });
          }
          
          if (definition.setup) {
            definition.setup(ayisha, options);
          }
        }
      };
      
      return plugin;
    }

    processCustomDirectives() {
      if (!this._customDirectives) return;
      
      this._customDirectives.forEach((handler, directive) => {
        this.root.querySelectorAll(`[\\@${directive}]`).forEach(el => {
          handler.call(this, el, el.getAttribute(`@${directive}`));
          el.removeAttribute(`@${directive}`);
        });
      });
    }

    // —————————————
    // Component System
    // —————————————
    component(name, definition) {
      if (typeof definition === 'function') {
        definition = { render: definition };
      }
      this.components.set(name, {
        ...definition,
        _compiled: false
      });
      return this;
    }

    processComponents() {
      this.components.forEach((comp, name) => {
        this.root.querySelectorAll(`[\\@component="${name}"], ${name}`).forEach(el => {
          this._renderComponent(el, name, comp);
        });
      });
    }

    _renderComponent(el, name, comp) {
      const props = this._extractProps(el);
      const context = { ...this.state, ...props };
      
      if (comp.template) {
        el.innerHTML = this._interpolateTemplate(comp.template, context);
      } else if (comp.render) {
        el.innerHTML = comp.render.call(el, context);
      }
      
      if (comp.mounted) {
        comp.mounted.call(el, context);
      }
    }

    _extractProps(el) {
      const props = {};
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('prop-')) {
          const propName = attr.name.replace('prop-', '');
          props[propName] = this.evaluate(attr.value) || attr.value;
        }
      });
      return props;
    }

    _interpolateTemplate(template, context) {
      return template.replace(/\{\{(.+?)\}\}/g, (match, expr) => {
        try {
          return new Function('ctx', `with(ctx) { return ${expr.trim()}; }`)(context) || '';
        } catch (e) {
          console.error('Template interpolation error:', e);
          return match;
        }
      });
    }

    // —————————————
    // Validation System
    // —————————————
    validate(name, rules) {
      this.validators.set(name, rules);
      return this;
    }

    _setupBuiltinValidators() {
      this.validate('required', (value) => ({
        valid: value != null && value !== '',
        message: 'This field is required'
      }));

      this.validate('email', (value) => ({
        valid: !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: 'Please enter a valid email address'
      }));

      this.validate('min', (value, min) => ({
        valid: !value || value.length >= min,
        message: `Minimum ${min} characters required`
      }));

      this.validate('max', (value, max) => ({
        valid: !value || value.length <= max,
        message: `Maximum ${max} characters allowed`
      }));

      this.validate('number', (value) => ({
        valid: !value || !isNaN(Number(value)),
        message: 'Please enter a valid number'
      }));
    }

    processValidation() {
      this.root.querySelectorAll('[\\@validate]').forEach(el => {
        const rules = el.getAttribute('@validate').split('|');
        const path = el.getAttribute('@model') || el.name;
        
        const validateField = () => {
          const value = this.lookup(this.state, path) || el.value;
          const errors = [];
          
          rules.forEach(rule => {
            const [ruleName, ...params] = rule.split(':');
            const validator = this.validators.get(ruleName);
            
            if (validator) {
              const result = validator(value, ...params);
              if (!result.valid) {
                errors.push(result.message);
              }
            }
          });
          
          const errorContainer = el.parentNode.querySelector('.validation-errors') || 
                               this._createErrorContainer(el);
          
          errorContainer.innerHTML = errors.map(err => `<div class="error">${err}</div>`).join('');
          el.classList.toggle('invalid', errors.length > 0);
          
          this.state[path + '_errors'] = errors;
          this.state[path + '_valid'] = errors.length === 0;
        };
        
        el.addEventListener('blur', validateField);
        el.addEventListener('input', () => {
          setTimeout(validateField, 300);
        });
        
        el.removeAttribute('@validate');
      });
    }

    _createErrorContainer(el) {
      const container = document.createElement('div');
      container.className = 'validation-errors';
      el.parentNode.insertBefore(container, el.nextSibling);
      return container;
    }

    // —————————————
    // Animation System
    // —————————————
    animate(name, definition) {
      this.animations.set(name, definition);
      return this;
    }

    _setupBuiltinAnimations() {
      this.animate('fadeIn', {
        from: { opacity: 0 },
        to: { opacity: 1 },
        duration: 300
      });

      this.animate('fadeOut', {
        from: { opacity: 1 },
        to: { opacity: 0 },
        duration: 300
      });

      this.animate('slideDown', {
        from: { height: 0, overflow: 'hidden' },
        to: { height: 'auto' },
        duration: 300
      });

      this.animate('slideUp', {
        from: { height: 'auto', overflow: 'hidden' },
        to: { height: 0 },
        duration: 300
      });
    }

    processAnimations() {
      this.root.querySelectorAll('[\\@animate]').forEach(el => {
        const animName = el.getAttribute('@animate');
        const trigger = el.getAttribute('@trigger') || 'mount';
        const animation = this.animations.get(animName);
        
        if (animation) {
          if (trigger === 'mount') {
            this._runAnimation(el, animation);
          } else {
            this._setupAnimationTrigger(el, animation, trigger);
          }
        }
        
        el.removeAttribute('@animate');
        el.removeAttribute('@trigger');
      });
    }

    _runAnimation(el, animation) {
      const { from, to, duration = 300, easing = 'ease' } = animation;
      
      Object.assign(el.style, from);
      el.offsetHeight;
      el.style.transition = `all ${duration}ms ${easing}`;
      Object.assign(el.style, to);
      
      setTimeout(() => {
        el.style.transition = '';
        if (animation.cleanup !== false) {
          Object.keys(from).forEach(prop => {
            if (to[prop] === undefined) {
              el.style[prop] = '';
            }
          });
        }
      }, duration);
    }

    _setupAnimationTrigger(el, animation, trigger) {
      if (trigger.startsWith('state:')) {
        const stateProp = trigger.replace('state:', '');
        this.addWatcher(stateProp, (newVal) => {
          if (newVal) this._runAnimation(el, animation);
        });
      }
    }

    // —————————————
    // DevTools Integration
    // —————————————
    enableDevMode() {
      this.devMode = true;
      this._setupDevTools();
      return this;
    }

    _setupDevTools() {
      if (typeof window !== 'undefined') {
        window.__AYISHA_DEVTOOLS__ = {
          instance: this,
          state: this.state,
          watchers: this.watchers,
          components: this.components,
          plugins: this.plugins,
          inspect: (selector) => {
            const el = document.querySelector(selector);
            if (el) {
              console.log('Element:', el);
              console.log('Bound events:', el._bound);
              console.log('Data attributes:', Object.fromEntries(
                Array.from(el.attributes)
                  .filter(attr => attr.name.startsWith('data-'))
                  .map(attr => [attr.name, attr.value])
              ));
            }
          },
          trace: (prop) => {
            console.log(`Watchers for "${prop}":`, this.watchers[prop]);
          },
          getMemoryUsage() {
            if (performance.memory) {
              return {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576),
                total: Math.round(performance.memory.totalJSHeapSize / 1048576),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
              };
            }
            return 'Memory API not available';
          }
        };
        
        console.log('🚀 Ayisha DevTools enabled');
        console.log('Access via window.__AYISHA_DEVTOOLS__');
      }
    }

    // —————————————
    // Memory Management
    // —————————————
    _setupMemoryManagement() {
      if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
              if (node.nodeType === 1) {
                this._cleanupElement(node);
              }
            });
          });
        });
        
        observer.observe(this.root, { childList: true, subtree: true });
        this._mutationObserver = observer;
      }
    }

    _cleanupElement(element) {
      if (element._bound) {
        element._bound = false;
      }
      element.querySelectorAll('*').forEach(child => {
        this._cleanupElement(child);
      });
    }

    // —————————————
    // Error Handling
    // —————————————
    onError(handler) {
      this._errorHandler = handler;
      return this;
    }

    _handleError(error, context = {}) {
      if (this._errorHandler) {
        this._errorHandler(error, context);
      } else {
        console.error('Ayisha Error:', error, context);
      }
    }

    _handleErrorWithRecovery(error, context = {}) {
      const errorInfo = {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };
      
      if (this._errorHandler) {
        const recovery = this._errorHandler(error, errorInfo);
        
        if (recovery === 'retry' && context.retry < 3) {
          setTimeout(() => {
            this._handleErrorWithRecovery(error, { ...context, retry: (context.retry || 0) + 1 });
          }, 1000 * (context.retry || 0));
        } else if (recovery === 'fallback' && context.fallback) {
          context.fallback();
        }
      } else {
        console.error('Ayisha Error:', errorInfo);
      }
    }

    // —————————————
    // Performance Monitoring
    // —————————————
    enablePerformanceMonitoring() {
      this._performanceMonitor = {
        metrics: new Map(),
        startTime: performance.now(),
        
        track(name) {
          const start = performance.now();
          return {
            end: () => {
              const duration = performance.now() - start;
              if (!this.metrics.has(name)) {
                this.metrics.set(name, []);
              }
              this.metrics.get(name).push(duration);
            }
          };
        },
        
        getStats(name) {
          const times = this.metrics.get(name) || [];
          if (times.length === 0) return null;
          
          const sum = times.reduce((a, b) => a + b, 0);
          const avg = sum / times.length;
          const min = Math.min(...times);
          const max = Math.max(...times);
          
          return { avg, min, max, count: times.length };
        },
        
        report() {
          console.group('🔥 Ayisha Performance Report');
          this.metrics.forEach((times, name) => {
            const stats = this.getStats(name);
            console.log(`${name}: avg ${stats.avg.toFixed(2)}ms (${stats.count} calls)`);
          });
          console.groupEnd();
        }
      };
      
      const originalInit = this.init.bind(this);
      this.init = function() {
        const tracker = this._performanceMonitor.track('init');
        const result = originalInit();
        if (result instanceof Promise) {
          result.then(() => tracker.end());
        } else {
          tracker.end();
        }
        return result;
      };
      
      return this;
    }

    // —————————————
    // Store Management
    // —————————————
    createStore(initialState = {}) {
      const store = {
        state: this._makeReactive(initialState),
        mutations: new Map(),
        actions: new Map(),
        getters: new Map(),
        
        commit(mutation, payload) {
          const mutationFn = this.mutations.get(mutation);
          if (mutationFn) {
            mutationFn(this.state, payload);
          }
        },
        
        dispatch(action, payload) {
          const actionFn = this.actions.get(action);
          if (actionFn) {
            return actionFn({ state: this.state, commit: this.commit.bind(this) }, payload);
          }
        },
        
        registerMutation(name, fn) {
          this.mutations.set(name, fn);
        },
        
        registerAction(name, fn) {
          this.actions.set(name, fn);
        },
        
        registerGetter(name, fn) {
          this.getters.set(name, fn);
        },
        
        get(getterName) {
          const getter = this.getters.get(getterName);
          return getter ? getter(this.state) : undefined;
        }
      };
      
      return store;
    }

    // —————————————
    // Form System
    // —————————————
    createForm(schema) {
      const form = {
        data: this._makeReactive({}),
        errors: this._makeReactive({}),
        touched: this._makeReactive({}),
        schema,
        
        validate(field) {
          if (!field) {
            Object.keys(this.schema).forEach(key => this.validate(key));
            return;
          }
          
          const rules = this.schema[field];
          const value = this.data[field];
          const errors = [];
          
          if (rules) {
            rules.forEach(rule => {
              const validator = window.ayisha.validators.get(rule.type);
              if (validator) {
                const result = validator(value, ...(rule.params || []));
                if (!result.valid) {
                  errors.push(result.message);
                }
              }
            });
          }
          
          this.errors[field] = errors;
          return errors.length === 0;
        },
        
        isValid() {
          return Object.values(this.errors).every(errors => errors.length === 0);
        },
        
        reset() {
          Object.keys(this.data).forEach(key => {
            this.data[key] = '';
            this.errors[key] = [];
            this.touched[key] = false;
          });
        }
      };
      
      Object.keys(schema).forEach(field => {
        form.data[field] = '';
        form.errors[field] = [];
        form.touched[field] = false;
      });
      
      return form;
    }

    // —————————————
    // Router System
    // —————————————
    createRouter(routes) {
      const router = {
        routes: new Map(),
        guards: {
          beforeEach: [],
          afterEach: []
        },
        currentRoute: null,
        
        addRoute(path, component, meta = {}) {
          this.routes.set(path, { component, meta });
        },
        
        beforeEach(guard) {
          this.guards.beforeEach.push(guard);
        },
        
        afterEach(guard) {
          this.guards.afterEach.push(guard);
        },
        
        async navigate(to, from = this.currentRoute) {
          for (const guard of this.guards.beforeEach) {
            const result = await guard(to, from);
            if (result === false) return;
            if (typeof result === 'string') {
              return this.navigate(result, from);
            }
          }
          
          const route = this.routes.get(to);
          if (route) {
            this.currentRoute = { path: to, ...route };
            
            const container = document.querySelector('[data-router-view]');
            if (container && route.component) {
              if (typeof route.component === 'string') {
                container.innerHTML = route.component;
              } else if (typeof route.component === 'function') {
                container.innerHTML = route.component();
              }
            }
            
            this.guards.afterEach.forEach(guard => guard(to, from));
          }
        }
      };
      
      routes.forEach(route => {
        router.addRoute(route.path, route.component, route.meta);
      });
      
      return router;
    }

    // —————————————
    // Testing Utilities
    // —————————————
    createTestInstance(html = '<div></div>') {
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      
      const instance = new Ayisha(container);
      instance._isTest = true;
      
      return {
        instance,
        container,
        cleanup: () => {
          document.body.removeChild(container);
        },
        findByAttribute: (attr) => container.querySelector(`[${attr}]`),
        findAllByAttribute: (attr) => Array.from(container.querySelectorAll(`[${attr}]`)),
        setState: (state) => instance.setState(state),
        getState: () => instance.getState(),
        trigger: (selector, event, data = {}) => {
          const el = container.querySelector(selector);
          if (el) {
            const evt = new Event(event, { bubbles: true });
            Object.assign(evt, data);
            el.dispatchEvent(evt);
          }
        }
      };
    }

    // —————————————
    // Reattività profonda
    // —————————————
    _makeReactive(obj) {
      if (obj && obj._isReactive) return obj;
      
      const self = this;
      
      // Make nested objects reactive
      Object.keys(obj).forEach(key => {
        if (self._isObject(obj[key]) && !obj[key]._isReactive) {
          obj[key] = self._makeReactive(obj[key]);
        }
      });
      
      const proxy = new Proxy(obj, {
        get(target, prop, receiver) {
          const val = Reflect.get(target, prop, receiver);
          if (self._isObject(val) && !val._isReactive) {
            return self._makeReactive(val);
          }
          return val;
        },
        set(target, prop, val, receiver) {
          const old = target[prop];
          if (old === val) return true; // Prevent infinite loops
          
          // Set the new value
          target[prop] = self._isObject(val) && !val._isReactive ? self._makeReactive(val) : val;
          
          // Trigger watchers asynchronously
          setTimeout(() => {
            if (self.watchers[prop]) {
              self.watchers[prop].forEach(fn => {
                try {
                  fn(val, old);
                } catch (e) {
                  console.error('Watcher error for prop:', prop, e);
                }
              });
            }
          }, 0);
          
          return true;
        }
      });
      
      // Mark as reactive
      Object.defineProperty(proxy, '_isReactive', {
        value: true,
        writable: false,
        enumerable: false
      });
      
      return proxy;
    }

    _isObject(val) {
      return val !== null && typeof val === 'object';
    }

    // —————————————
    // Compile + cache delle funzioni dinamiche
    // —————————————
    compile(args, body) {
      const key = args + '|' + body;
      if (!this._fnCache.has(key)) {
        try {
          const fn = new Function(...args.split(',').map(arg => arg.trim()), body);
          this._fnCache.set(key, fn);
        } catch (e) {
          console.error('Function compilation error:', e, 'Args:', args, 'Body:', body);
          // Return a safe function that does nothing
          this._fnCache.set(key, () => {});
        }
      }
      return this._fnCache.get(key);
    }

    // —————————————
    // Inizializzazione generale
    // —————————————
    init() {
      if (this._isInitializing) return Promise.resolve();
      this._isInitializing = true;
      
      this.processInit();
      return this.processIncludes()
        .then(() => Promise.all([
          this.processFetch(),
          this.processActions()
        ]))
        .then(() => {
          this.processMapFilterReduce();
          this.processShowHide();
          this.processIf();
          this.processSwitch();
          this.processFor();
          this.processText();
          this.processStyle();
          this.processClass();
          this.processModel();
          this.processPage();
          this.processMounted();
          this.processWatch();
          if (this._componentProcessingEnabled) {
            this.processComponents();
          }
          this.processValidation();
          this.processAnimations();
          this.processCustomDirectives();
          this.bindEvents();
          
          this._isInitializing = false;
          this._isInitialized = true;
        })
        .catch(e => {
          console.error('Initialization error:', e);
          this._isInitializing = false;
        });
    }

    // —————————————
    // Lifecycle: @init / <init>
    // —————————————
    processInit() {
      this.root.querySelectorAll('[\\@init]').forEach(el => {
        try {
          const code = el.getAttribute('@init');
          if (code && code.trim()) {
            this.compile('state', code).call(el, this.state);
          }
        } catch (e) {
          console.error('Init error:', e);
        }
        el.removeAttribute('@init');
      });
      Array.from(this.root.getElementsByTagName('init')).forEach(el => {
        try {
          const code = el.textContent;
          if (code && code.trim()) {
            this.compile('state', code).call(el, this.state);
          }
        } catch (e) {
          console.error('Init tag error:', e);
        }
        el.remove();
      });
    }

    // —————————————
    // Lifecycle: @mounted / <mounted>
    // —————————————
    processMounted() {
      this.root.querySelectorAll('[\\@mounted]').forEach(el => {
        try {
          this.compile('state', el.getAttribute('@mounted')).call(el, this.state);
        } catch (e) {
          console.error('Mounted error:', e);
        }
        el.removeAttribute('@mounted');
      });
      Array.from(this.root.getElementsByTagName('mounted')).forEach(el => {
        try {
          this.compile('state', el.textContent).call(el, this.state);
        } catch (e) {
          console.error('Mounted tag error:', e);
        }
        el.remove();
      });
    }

    // —————————————
    // @include / @displace (parallelizzati)
    // —————————————
    async processIncludes() {
      const incEls = Array.from(this.root.querySelectorAll('[\\@include]'));
      const dspEls = Array.from(this.root.querySelectorAll('[\\@displace]'));

      const incPs = incEls.map(async el => {
        try {
          const html = await fetch(el.getAttribute('@include')).then(r => r.text());
          el.innerHTML = html;
        } catch (e) {
          console.error('Include failed:', e);
        }
        el.removeAttribute('@include');
      });

      const dspPs = dspEls.map(async el => {
        try {
          const html = await fetch(el.getAttribute('@displace')).then(r => r.text());
          const frag = document.createRange().createContextualFragment(html);
          el.replaceWith(frag);
        } catch (e) {
          console.error('Displace failed:', e);
        }
      });

      await Promise.all([...incPs, ...dspPs]);
    }

    // —————————————
    // @fetch (parallelizzato)
    // —————————————
    async processFetch() {
      const els = Array.from(this.root.querySelectorAll('[\\@fetch]'));
      els.forEach(el => {
        const key = el.getAttribute('@result') || el.getAttribute('@fetch').split('/').pop();
        this.loading[key] = true;
        this.error[key] = null;
        el._key = key;
      });

      await Promise.all(els.map(async el => {
        const url = el.getAttribute('@fetch');
        const key = el._key;
        const opts = {
          method: (el.getAttribute('@method') || 'get').toUpperCase(),
          headers: {}
        };
        if (el.hasAttribute('@auth')) {
          const [type, token] = el.getAttribute('@auth').split('=');
          opts.headers.Authorization = `${type} ${token}`;
          el.removeAttribute('@auth');
        }
        if (el.hasAttribute('@body')) {
          opts.headers['Content-Type'] = 'application/json';
          opts.body = el.getAttribute('@body');
          el.removeAttribute('@body');
        }
        let ok = false;
        try {
          const res = await fetch(url, opts);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          this.state[key] = await res.json();
          ok = true;
        } catch (e) {
          this.error[key] = e.message;
          console.error('Fetch failed:', e);
        } finally {
          this.loading[key] = false;
        }
        if (ok && el.hasAttribute('@success')) window.location.href = el.getAttribute('@success');
        if (!ok && el.hasAttribute('@error')) window.location.href = el.getAttribute('@error');
        ['@fetch','@method','@result','@success','@error'].forEach(a => el.removeAttribute(a));
      }));
    }

    // —————————————
    // Nuove direttive @set / @actionTo / @actionOn
    // —————————————
    async processActions() {
      Array.from(this.root.querySelectorAll('[\\@set][\\@actionTo]')).forEach(el => {
        const template = el.getAttribute('@set');
        const key = el.getAttribute('@actionTo');
        const fn = this.compile('state',
          'return `' + template.replace(/{/g,'${state.').replace(/}/g,'}') + '`;'
        );
        const update = () => {
          try {
            this.actions[key] = fn(this.state);
          } catch (e) {
            console.error('Action set error:', e);
          }
        };
        update();
        const deps = [...template.matchAll(/{(\w+)}/g)].map(m => m[1]);
        deps.forEach(dep => this.addWatcher(dep, update));
        el.removeAttribute('@set');
        el.removeAttribute('@actionTo');
      });

      Array.from(this.root.querySelectorAll('[\\@actionOn]')).forEach(el => {
        const key = el.getAttribute('@actionOn');
        const result = el.getAttribute('@result') || key;
        el.addEventListener('click', async e => {
          e.preventDefault();
          const url = this.actions[key];
          if (!url) return console.warn(`No URL for action "${key}"`);
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(res.status);
            this.state[result] = await res.json();
          } catch (err) {
            console.error('Action fetch failed:', err);
            this.error[result] = err.message;
          }
        });
        el.removeAttribute('@actionOn');
        if (el.hasAttribute('@result')) el.removeAttribute('@result');
      });
    }

    // —————————————
    // @source + @map/@filter/@reduce
    // —————————————
    processMapFilterReduce() {
      this.root.querySelectorAll('[\\@source]').forEach(el => {
        const src = el.getAttribute('@source');
        const out = el.getAttribute('@result') || src;
        if (el.hasAttribute('@map')) {
          const expr = el.getAttribute('@map');
          this.state[out] = (this.state[src]||[]).map((item, index) => {
            try {
              // Replace 'value' with the actual item value for backward compatibility
              const processedExpr = expr.replace(/\bvalue\b/g, 'item');
              return this.compile('item,index,state', `return ${processedExpr}`)(item, index, this.state);
            } catch (e) {
              console.error('Map expression error:', e, 'Expression:', expr);
              return item;
            }
          });
        }
        if (el.hasAttribute('@filter')) {
          const cond = el.getAttribute('@filter');
          this.state[out] = (this.state[src]||[]).filter((item, index) => {
            try {
              // Replace 'value' with the actual item value for backward compatibility
              const processedCond = cond.replace(/\bvalue\b/g, 'item');
              return this.compile('item,index,state', `return ${processedCond}`)(item, index, this.state);
            } catch (e) {
              console.error('Filter expression error:', e, 'Expression:', cond);
              return false;
            }
          });
        }
        if (el.hasAttribute('@reduce')) {
          const raw = el.getAttribute('@reduce');
          const init = el.getAttribute('@initial') || '0';
          try {
            const [args, expr] = raw.split('=>').map(s=>s.trim());
            this.state[out] = (this.state[src]||[]).reduce((acc, item, index) => {
              try {
                return this.compile('acc,item,index,state', `return ${expr}`)(acc, item, index, this.state);
              } catch (e) {
                console.error('Reduce expression error:', e, 'Expression:', expr);
                return acc;
              }
            }, JSON.parse(init));
          } catch (e) {
            console.error('Reduce parsing error:', e, 'Expression:', raw);
            this.state[out] = this.state[src] || [];
          }
        }
        ['@source','@map','@filter','@reduce','@initial','@result'].forEach(a => el.removeAttribute(a));
      });
    }

    // —————————————
    // @show / @hide
    // —————————————
    processShowHide() {
      this.root.querySelectorAll('[\\@show],[\\@hide]').forEach(el => {
        const isShow = el.hasAttribute('@show');
        const expr = el.getAttribute(isShow ? '@show' : '@hide');
        const update = () => {
          const val = this.evaluate(expr);
          el.style.display = (val === isShow) ? '' : 'none';
        };
        update();
        const dep = expr.split('.')[0];
        this.addWatcher(dep, update);
        el.removeAttribute('@show');
        el.removeAttribute('@hide');
      });
    }

    // —————————————
    // @if
    // —————————————
    processIf() {
      this.root.querySelectorAll('[\\@if]').forEach(el => {
        const expr = el.getAttribute('@if');
        const parent = el.parentNode;
        const comment = document.createComment('ayisha-if');
        const update = () => {
          const ok = this.evaluate(expr);
          if (ok && comment.parentNode === parent) parent.replaceChild(el, comment);
          if (!ok && el.parentNode === parent) parent.replaceChild(comment, el);
        };
        parent.replaceChild(comment, el);
        update();
        const dep = expr.split('.')[0];
        this.addWatcher(dep, update);
        el.removeAttribute('@if');
      });
    }

    // —————————————
    // @switch / @case / @default
    // —————————————
    processSwitch() {
      this.root.querySelectorAll('[\\@switch]').forEach(block => {
        const key = block.getAttribute('@switch');
        const children = Array.from(block.children);
        const update = () => {
          const v = this.lookup(this.state, key);
          children.forEach(child => {
            if (child.hasAttribute('@case')) {
              child.style.display = (child.getAttribute('@case') == v) ? '' : 'none';
            }
            if (child.hasAttribute('@default')) {
              const any = children.some(c=>c.hasAttribute('@case') && c.getAttribute('@case') == v);
              child.style.display = any ? 'none' : '';
            }
          });
        };
        update();
        const dep = key.split('.')[0];
        this.addWatcher(dep, update);
        block.removeAttribute('@switch');
      });
    }

    // —————————————
    // @for with optional @key
    // —————————————
    processFor() {
      this.root.querySelectorAll('[\\@for]').forEach(el => {
        const [item, , list] = el.getAttribute('@for').split(/\s+/);
        const keyExpr = el.getAttribute('@key');
        const parent = el.parentNode;
        const template = el.cloneNode(true);

        const render = () => {
          // Remove existing items
          parent.querySelectorAll(`[data-for="${list}"]`).forEach(n=>n.remove());
          
          // Render new items
          (this.state[list]||[]).forEach((data, index) => {
            const clone = template.cloneNode(true);
            clone.removeAttribute('@for');
            clone.setAttribute('data-for', list);
            
            if (keyExpr) {
              try {
                const kfn = this.compile('item,state', `return ${keyExpr}`);
                clone.setAttribute('data-key', kfn(data, this.state));
              } catch(e) {
                console.error('Key eval error:', e);
              }
            }
            
            // Process @text attributes in clone with item context
            clone.querySelectorAll('[\\@text]').forEach(n => {
              const expr = n.getAttribute('@text');
              try {
                // Create a safer evaluation context
                const context = { ...this.state };
                context[item] = data;
                context.item = data;
                context.index = index;
                
                const stateKeys = Object.keys(context);
                const stateValues = stateKeys.map(key => context[key]);
                const fn = new Function(...stateKeys, `return ${expr}`);
                const result = fn(...stateValues);
                
                n.textContent = result ?? '';
              } catch (e) {
                console.error('For text binding error:', e, 'Expression:', expr);
                n.textContent = '';
              }
              n.removeAttribute('@text');
            });
            
            // Process @click events in clone
            clone.querySelectorAll('[\\@click]').forEach(n => {
              const clickExpr = n.getAttribute('@click');
              try {
                const context = { ...this.state };
                context[item] = data;
                context.item = data;
                context.index = index;
                
                const stateKeys = Object.keys(context);
                const handler = new Function('event', ...stateKeys, clickExpr);
                
                n.addEventListener('click', e => {
                  const stateValues = stateKeys.map(key => {
                    if (key === item || key === 'item') return data;
                    if (key === 'index') return index;
                    return this.state[key];
                  });
                  handler.call(n, e, ...stateValues);
                });
              } catch (e) {
                console.error('For click binding error:', e);
              }
              n.removeAttribute('@click');
            });
            
            parent.insertBefore(clone, el);
          });
        };

        render();
        this.addWatcher(list, render);
        el.remove();
      });
    }

    // —————————————
    // @text
    // —————————————
    processText() {
      this.root.querySelectorAll('[\\@text]').forEach(el => {
        const expr = el.getAttribute('@text');
        const update = () => {
          try {
            el.textContent = this.evaluate(expr) ?? '';
          } catch (e) {
            console.error('Text evaluation error:', e, 'Expression:', expr);
            el.textContent = '';
          }
        };
        update();
        // Extract all possible state dependencies from expression
        const deps = expr.match(/\b[a-zA-Z_]\w*\b/g) || [];
        deps.forEach(dep => {
          if (dep !== 'true' && dep !== 'false' && dep !== 'null' && dep !== 'undefined') {
            this.addWatcher(dep, update);
          }
        });
        el.removeAttribute('@text');
      });
    }

    // —————————————
    // @class binding
    // —————————————
    processClass() {
      this.root.querySelectorAll('[\\@class]').forEach(el => {
        const code = el.getAttribute('@class');
        const update = () => {
          try {
            const obj = this.compile('state', `return ${code}`)(this.state);
            Object.entries(obj || {}).forEach(([cls, on]) => {
              el.classList.toggle(cls, Boolean(on));
            });
          } catch (e) {
            console.error('Class binding error:', e, 'Expression:', code);
          }
        };
        update();
        // Watch all state properties for changes
        const deps = code.match(/\b[a-zA-Z_]\w*\b/g) || [];
        deps.forEach(dep => {
          if (dep !== 'true' && dep !== 'false' && dep !== 'null' && dep !== 'undefined') {
            this.addWatcher(dep, update);
          }
        });
        el.removeAttribute('@class');
      });
    }

    // —————————————
    // @style binding
    // —————————————
    processStyle() {
      this.root.querySelectorAll('[\\@style]').forEach(el => {
        const code = el.getAttribute('@style');
        const update = () => {
          try {
            const obj = this.compile('state', `return ${code}`)(this.state);
            Object.entries(obj || {}).forEach(([prop, val]) => {
              el.style[prop] = val;
            });
          } catch (e) {
            console.error('Style binding error:', e, 'Expression:', code);
          }
        };
        update();
        // Watch all state properties for changes
        const deps = code.match(/\b[a-zA-Z_]\w*\b/g) || [];
        deps.forEach(dep => {
          if (dep !== 'true' && dep !== 'false' && dep !== 'null' && dep !== 'undefined') {
            this.addWatcher(dep, update);
          }
        });
        el.removeAttribute('@style');
      });
    }

    // —————————————
    // @model two-way binding
    // —————————————
    processModel() {
      this.root.querySelectorAll('[\\@model]').forEach(el => {
        const path = el.getAttribute('@model');
        const update = () => {
          el.value = this.lookup(this.state, path) ?? '';
        };
        update();
        this.addWatcher(path.split('.')[0], update);
        el.addEventListener('input', e => this._setByPath(path, e.target.value));
        el.removeAttribute('@model');
      });
    }

    _setByPath(path, val) {
      const keys = path.split('.');
      const last = keys.pop();
      const obj = keys.reduce((o,k) => o[k], this.state);
      obj[last] = val;
    }

    // —————————————
    // @watch directive
    // —————————————
    processWatch() {
      this.root.querySelectorAll('[\\@watch]').forEach(el => {
        const [prop, fn] = el.getAttribute('@watch').split(':').map(s=>s.trim());
        this.addWatcher(prop, (newV, oldV) => {
          this.compile('newVal,oldVal,state', fn)(newV, oldV, this.state);
        });
        el.removeAttribute('@watch');
      });
    }

    // —————————————
    // SPA router: @page container
    // —————————————
    processPage() {
      const container = this.root.querySelector('[\\@page]');
      if (!container) return;
      const base = container.getAttribute('@page') || '';
      const update = () => {
        const path = this.state.currentPage;
        const url = base ? new URL(path, base).href : path;
        fetch(url)
          .then(r => r.text())
          .then(html => { container.innerHTML = html; })
          .catch(e => console.error('Page load failed:', e));
      };
      update();
      this.addWatcher('currentPage', update);
      container.removeAttribute('@page');
    }

    // —————————————
    // Event binding e @link / modifiers
    // —————————————
    bindEvents() {
      this.root.querySelectorAll('*').forEach(el => {
        // Skip elements that have already been processed
        if (el._eventsProcessed) return;
        
        Array.from(el.attributes).forEach(attr => {
          const name = attr.name;
          if (name === '@link') {
            const path = attr.value;
            el.addEventListener('click', e => {
              e.preventDefault();
              history.pushState({}, '', path);
              this.state.currentPage = path;
            });
            el.removeAttribute('@link');
            return;
          }
          if (!name.startsWith('@')) return;
          
          const parts = name.slice(1).split('.');
          const evt = parts[0];
          const mods = parts.slice(1);
          
          try {
            // Create a simple handler that just uses 'state' object
            const handler = new Function('event', 'state', attr.value);
            
            let fn = e => {
              if (mods.includes('prevent')) e.preventDefault();
              if (mods.includes('stop')) e.stopPropagation();
              if (mods.includes('once')) el.removeEventListener(evt, fn);
              if (mods.includes('enter') && e.key!=='Enter') return;
              
              // Pass the actual state object
              handler.call(el, e, this.state);
            };
            
            const dIdx = mods.indexOf('debounce');
            if (dIdx >= 0) {
              const ms = parseInt(mods[dIdx+1]||300,10);
              let tid;
              const o = fn;
              fn = e => { clearTimeout(tid); tid = setTimeout(()=>o(e), ms); };
            }
            
            const tIdx = mods.indexOf('throttle');
            if (tIdx >= 0) {
              const ms = parseInt(mods[tIdx+1]||300,10);
              let last = 0;
              const o = fn;
              fn = e => {
                const now = Date.now();
                if (now - last > ms) { o(e); last = now; }
              };
            }
            
            el.addEventListener(evt, fn);
            el.removeAttribute(name);
          } catch (e) {
            console.error('Event binding error:', e, 'Attribute:', name, 'Value:', attr.value);
          }
        });
        
        // Mark this element as processed
        el._eventsProcessed = true;
      });
    }

    // —————————————
    // Evaluate expressions in state context
    // —————————————
    evaluate(expr) {
      try {
        // Create a function that has access to all state properties as variables
        const stateKeys = Object.keys(this.state);
        const stateValues = stateKeys.map(key => this.state[key]);
        const fn = new Function(...stateKeys, `return ${expr}`);
        return fn(...stateValues);
      } catch (e) {
        try {
          // Fallback: use with statement
          return new Function('state', `with(state) { return ${expr}; }`)(this.state);
        } catch (e2) {
          console.error('Evaluation error:', e2, 'Expression:', expr);
          return '';
        }
      }
    }

    // —————————————
    // Utility methods
    // —————————————
    lookup(obj, path) {
      return path.split('.').reduce((o, k) => o?.[k], obj);
    }

    addWatcher(prop, fn) {
      if (!this.watchers[prop]) this.watchers[prop] = [];
      // Avoid duplicate watchers
      if (!this.watchers[prop].includes(fn)) {
        this.watchers[prop].push(fn);
      }
    }

    // —————————————
    // Public API methods
    // —————————————
    setState(newState) {
      Object.assign(this.state, newState);
    }

    getState() {
      return { ...this.state };
    }

    navigate(path) {
      history.pushState({}, '', path);
      this.state.currentPage = path;
    }

    destroy() {
      this.watchers = {};
      this._fnCache.clear();
      
      if (this._mutationObserver) {
        this._mutationObserver.disconnect();
      }
    }
  }

  // Global instance
  window.Ayisha = Ayisha;
  window.ayisha = new Ayisha();

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.ayisha.init());
  } else {
    window.ayisha.init();
  }

})(window);