// ayisha.js - Nuova versione: parsing direttive, DOM pulito, reattività, modularità
(function(window) {
  class Ayisha {
    constructor(root = document.body) {
      this.root = root || document.body;
      if (!this.root) throw new Error('Ayisha: root element not found');
      this.state = this._makeReactive({});
      this.watchers = {};
      this.components = {};
      this.directives = {};
      this._templateHTML = this.root.innerHTML;
      this._initDirectives();
    }

    render() {
      this.root.innerHTML = this._templateHTML;
      this._parseAndClean(this.root);
      this._injectRuntime();
    }

    _parseAndClean(root) {
      Object.keys(this.directives).forEach(dir => {
        this.directives[dir].call(this, root);
      });
      // Rimuovi tutte le direttive custom dal DOM, anche su root
      const allEls = [root, ...root.querySelectorAll('*')];
      allEls.forEach(el => {
        Array.from(el.attributes).forEach(attr => {
          if (attr.name.startsWith('@')) el.removeAttribute(attr.name);
        });
      });
    }

    _injectRuntime() {
      let script = document.getElementById('ayisha-runtime');
      if (script) script.remove();
      let runtime = '(function(){\n  const state = window.ayisha.state;\n';
      if (document.querySelector('[data-ayisha-text]')) {
        runtime += `  document.querySelectorAll('[data-ayisha-text]').forEach(function(el){
    const expr = el.getAttribute('data-ayisha-text');
    function update(){
      try { el.textContent = new Function('state', 'with(state){return '+expr+'}')(state); } catch(e) { el.textContent = ''; }
    }
    update();
    Object.keys(state).forEach(function(k){
      window.ayisha.addWatcher(k, update);
    });
  });\n`;
      }
      if (document.querySelector('[data-ayisha-model]')) {
        runtime += `  document.querySelectorAll('[data-ayisha-model]').forEach(function(el){
    const path = el.getAttribute('data-ayisha-model');
    function update(){
      const value = window.ayisha.lookup(state, path) ?? '';
      if (el.value !== value) el.value = value;
    }
    update();
    window.ayisha.addWatcher(path.split('.')[0], update);
    el.addEventListener('input', function(e){
      window.ayisha._setByPath(path, e.target.value);
    });
  });\n`;
      }
      if (document.querySelector('[data-ayisha-class]')) {
        runtime += `  document.querySelectorAll('[data-ayisha-class]').forEach(function(el){
    const expr = el.getAttribute('data-ayisha-class');
    function update(){
      try {
        const obj = new Function('state', 'with(state){return '+expr+'}')(state);
        Object.entries(obj || {}).forEach(([cls, on]) => {
          el.classList.toggle(cls, !!on);
        });
      } catch(e){}
    }
    update();
    (expr.match(/\\b[a-zA-Z_]\\w*\\b/g) || []).forEach(function(dep){
      window.ayisha.addWatcher(dep, update);
    });
  });\n`;
      }
      if (document.querySelector('[data-ayisha-style]')) {
        runtime += `  document.querySelectorAll('[data-ayisha-style]').forEach(function(el){
    const expr = el.getAttribute('data-ayisha-style');
    function update(){
      try {
        const obj = new Function('state', 'with(state){return '+expr+'}')(state);
        Object.entries(obj || {}).forEach(([prop, val]) => {
          el.style[prop] = val;
        });
      } catch(e){}
    }
    update();
    (expr.match(/\\b[a-zA-Z_]\\w*\\b/g) || []).forEach(function(dep){
      window.ayisha.addWatcher(dep, update);
    });
  });\n`;
      }
      if (document.querySelector('[data-ayisha-click]')) {
        runtime += `  document.querySelectorAll('[data-ayisha-click]').forEach(function(el){
    const expr = el.getAttribute('data-ayisha-click');
    el.addEventListener('click', function(e){
      new Function('state', 'with(state){'+expr+'}')(state);
    });
  });\n`;
      }
      if (document.querySelector('[data-ayisha-if]')) {
        runtime += `  document.querySelectorAll('[data-ayisha-if]').forEach(function(el){
    const expr = el.getAttribute('data-ayisha-if');
    function update(){
      const show = new Function('state', 'with(state){return !!('+expr+')}')(state);
      el.style.display = show ? '' : 'none';
    }
    update();
    (expr.match(/\\b[a-zA-Z_]\\w*\\b/g) || []).forEach(function(dep){
      window.ayisha.addWatcher(dep, update);
    });
  });\n`;
      }
      if (document.querySelector('[data-ayisha-show]')) {
        runtime += `  document.querySelectorAll('[data-ayisha-show]').forEach(function(el){
    const expr = el.getAttribute('data-ayisha-show');
    function update(){
      const show = new Function('state', 'with(state){return !!('+expr+')}')(state);
      el.style.display = show ? '' : 'none';
    }
    update();
    (expr.match(/\\b[a-zA-Z_]\\w*\\b/g) || []).forEach(function(dep){
      window.ayisha.addWatcher(dep, update);
    });
  });\n`;
      }
      // @for: solo placeholder, implementazione completa richiede gestione template/clonazione
      runtime += '})();';
      script = document.createElement('script');
      script.id = 'ayisha-runtime';
      script.type = 'text/javascript';
      script.textContent = runtime;
      document.body.appendChild(script);
    }

    _initDirectives() {
      // @text
      this.directives['@text'] = function(root) {
        root.querySelectorAll('[\\@text]').forEach(el => {
          const expr = el.getAttribute('@text');
          el.setAttribute('data-ayisha-text', expr);
          el.removeAttribute('@text');
        });
      };
      // @model
      this.directives['@model'] = function(root) {
        root.querySelectorAll('[\\@model]').forEach(el => {
          const path = el.getAttribute('@model');
          el.setAttribute('data-ayisha-model', path);
          el.removeAttribute('@model');
        });
      };
      // @class
      this.directives['@class'] = function(root) {
        root.querySelectorAll('[\\@class]').forEach(el => {
          const expr = el.getAttribute('@class');
          el.setAttribute('data-ayisha-class', expr);
          el.removeAttribute('@class');
        });
      };
      // @style
      this.directives['@style'] = function(root) {
        root.querySelectorAll('[\\@style]').forEach(el => {
          const expr = el.getAttribute('@style');
          el.setAttribute('data-ayisha-style', expr);
          el.removeAttribute('@style');
        });
      };
      // @click
      this.directives['@click'] = function(root) {
        root.querySelectorAll('[\\@click]').forEach(el => {
          const expr = el.getAttribute('@click');
          el.setAttribute('data-ayisha-click', expr);
          el.removeAttribute('@click');
        });
      };
      // @if
      this.directives['@if'] = function(root) {
        root.querySelectorAll('[\\@if]').forEach(el => {
          const expr = el.getAttribute('@if');
          el.setAttribute('data-ayisha-if', expr);
          el.removeAttribute('@if');
        });
      };
      // @show
      this.directives['@show'] = function(root) {
        root.querySelectorAll('[\\@show]').forEach(el => {
          const expr = el.getAttribute('@show');
          el.setAttribute('data-ayisha-show', expr);
          el.removeAttribute('@show');
        });
      };
      // @for
      this.directives['@for'] = function(root) {
        root.querySelectorAll('[\\@for]').forEach(el => {
          const expr = el.getAttribute('@for');
          el.setAttribute('data-ayisha-for', expr);
          el.removeAttribute('@for');
        });
      };
      // @component
      this.directives['@component'] = function(root) {
        root.querySelectorAll('[\\@component]').forEach(el => {
          const name = el.getAttribute('@component');
          const comp = this.components[name];
          if (comp) {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = comp.template;
            const node = wrapper.firstElementChild;
            Array.from(el.attributes).forEach(attr => {
              if (attr.name.startsWith('prop-')) {
                const propName = attr.name.replace('prop-', '');
                node[propName] = this.lookup(this.state, attr.value);
              }
            });
            el.replaceWith(node);
            if (comp.mounted) comp.mounted(node);
          }
        });
      };
      // @fetch
      this.directives['@fetch'] = function(root) {
        root.querySelectorAll('[\\@fetch]').forEach(el => {
          const url = el.getAttribute('@fetch');
          fetch(url).then(r => r.json()).then(data => {
            el.textContent = JSON.stringify(data);
          });
          el.removeAttribute('@fetch');
        });
      };
      // @include
      this.directives['@include'] = function(root) {
        root.querySelectorAll('[\\@include]').forEach(el => {
          fetch(el.getAttribute('@include')).then(r => r.text()).then(html => {
            el.innerHTML = html;
            this._parseAndClean(el);
          });
          el.removeAttribute('@include');
        });
      };
    }

    // Interpolazione per @for
    _interpolateFor(node, item, data) {
      if (node.nodeType === Node.TEXT_NODE) {
        node.nodeValue = node.nodeValue.replace(new RegExp(`{{\\s*${item}\\.([\\w$]+)\\s*}}`, 'g'), (m, prop) => data[prop] ?? '');
      } else if (node.childNodes) {
        node.childNodes.forEach(child => this._interpolateFor(child, item, data));
      }
    }

    // Esecuzione espressioni
    evaluate(expr) {
      try {
        return new Function('state', `with(state) { return (${expr}); }`)(this.state);
      } catch (e) {
        return '';
      }
    }

    // Watcher semplice
    addWatcher(prop, fn) {
      if (!this.watchers[prop]) this.watchers[prop] = [];
      if (!this.watchers[prop].includes(fn)) this.watchers[prop].push(fn);
    }

    // Reattività semplice
    _makeReactive(obj) {
      const self = this;
      return new Proxy(obj, {
        set(target, prop, val) {
          target[prop] = val;
          if (self.watchers[prop]) self.watchers[prop].forEach(fn => fn(val));
          return true;
        }
      });
    }

    // Utility: lookup by path
    lookup(obj, path) {
      return path.split('.').reduce((o, k) => o?.[k], obj);
    }

    // Utility: set by path
    _setByPath(path, val) {
      const keys = path.split('.');
      const last = keys.pop();
      let obj = this.state;
      for (let key of keys) {
        if (!(key in obj)) obj[key] = {};
        obj = obj[key];
      }
      obj[last] = val;
    }

    // Component registration
    component(name, def) {
      this.components[name] = def;
    }

    // Dev mode
    enableDevMode() {
      this.devMode = true;
    }

    // Error handler
    onError(fn) {
      this._onError = fn;
    }
  }

  function initAyisha() {
    if (!window.ayisha) {
      window.Ayisha = Ayisha;
      window.ayisha = new Ayisha();
      window.ayisha.render();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAyisha);
  } else {
    initAyisha();
  }
})(window);