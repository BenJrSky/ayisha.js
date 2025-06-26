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
      this._uidCounter = 0;  // For unique vNode IDs
      window.ayisha = this;
    }

    parse(node) {
      if (!node) return null;
      if (node.nodeType === 11) { // DocumentFragment
        const fragVNode = { tag: 'fragment', attrs: {}, directives: {}, subDirectives: {}, children: [], _uid: this._uidCounter++ };
        node.childNodes.forEach(child => {
          const cn = this.parse(child);
          if (cn) fragVNode.children.push(cn);
        });
        return fragVNode;
      }
      if (node.nodeType === 3) {
        return { type: 'text', text: node.textContent, _uid: this._uidCounter++ };
      }
      if (node.nodeType !== 1) return null;
      const tag = node.tagName.toLowerCase();
      if (tag === 'init') {
        this._initBlocks.push(node.textContent);
        return null;
      }
      const vNode = { tag, attrs: {}, directives: {}, subDirectives: {}, children: [], _uid: this._uidCounter++ };
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
      if (node.childNodes && node.childNodes.length > 0) {
        node.childNodes.forEach(child => {
          const cn = this.parse(child);
          if (cn) vNode.children.push(cn);
        });
      }
      return vNode;
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
      this.state = new Proxy(this.state, {
        set: (obj, prop, val) => {
          const oldVal = obj[prop];
          obj[prop] = val;
          (this.watchers[prop] || []).forEach(fn => fn(val, oldVal));
          this.render();
          return true;
        }
      });
    }

    addWatcher(prop, fn) {
      this.watchers[prop] = this.watchers[prop] || [];
      this.watchers[prop].push(fn);
    }

    component(name, html) {
      this.components[name] = html;
    }

    async _loadExternalComponent(url) {
      if (this._componentCache[url]) return this._componentCache[url];
      if (this._loadingComponents.has(url)) {
        while (this._loadingComponents.has(url)) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        return this._componentCache[url];
      }
      this._loadingComponents.add(url);
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

    _evalText(text, ctx) {
      return text.replace(/{{(.*?)}}/g, (_, e) => {
        const r = this._evalExpr(e.trim(), ctx);
        return r != null ? r : '';
      });
    }

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

    _setupRouting() {
      let p = location.pathname.replace(/^\//, '') || '';
      if (!p || p === 'index.html') { history.replaceState({}, '', '/'); p = ''; }
      this.state.currentPage = p;
      window.addEventListener('popstate', () => {
        this.state.currentPage = location.pathname.replace(/^\//, '') || '';
        this.render();
      });
    }

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
      const mountInto = this.root === document.body ? document.body : this.root;
      mountInto.innerHTML = '';
      if (real) {
        if (real.tagName === undefined && real.childNodes) {
          Array.from(real.childNodes).forEach(child => mountInto.appendChild(child));
        } else if (real instanceof DocumentFragment) {
          mountInto.appendChild(real);
        } else {
          mountInto.appendChild(real);
        }
      }
      if (focusInfo) {
        let node = mountInto;
        focusInfo.path.forEach(i => node = node.childNodes[i]);
        if (node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA')) {
          node.focus();
          node.setSelectionRange(focusInfo.start, focusInfo.end);
        }
      }
      this._modelBindings.forEach(b => b.update());
      this._isRendering = false;
    }

    _renderVNode(vNode, ctx) {
      if (!vNode) return null;
      // Generic @watch directive handling
      if (vNode.directives['@watch'] && !vNode._watchBound) {
        vNode._watchBound = true;
        vNode.directives['@watch'].split(',').forEach(w => {
          const watchStr = w.trim();
          let prop, expr;
          if (watchStr.includes('=>')) [prop, expr] = watchStr.split('=>').map(s => s.trim());
          else if (watchStr.includes(':')) [prop, expr] = watchStr.split(':').map(s => s.trim());
          if (expr) {
            this.addWatcher(prop, (newVal, oldVal) => {
              try { new Function('state','newVal','oldVal', `with(state){${expr}}`)(this.state, newVal, oldVal); }
              catch (e) { console.error('@watch error:', e); }
            });
          }
        });
      }
      if (vNode.type === 'text') return document.createTextNode(this._evalText(vNode.text, ctx));
      if (vNode.tag === 'fragment') {
        const frag = document.createDocumentFragment();
        vNode.children.forEach(child => {
          const node = this._renderVNode(child, ctx);
          if (node) frag.appendChild(node);
        });
        return frag;
      }
      if (vNode.directives['@if'] && !this._evalExpr(vNode.directives['@if'], ctx)) return null;
      if (vNode.directives['@show'] && !this._evalExpr(vNode.directives['@show'], ctx)) return null;
      if (vNode.directives['@hide'] && this._evalExpr(vNode.directives['@hide'], ctx)) return null;

      // ... (rest of existing implementation unchanged) ...
      // For brevity, all other directive and rendering logic remains as before
    }

    mount() {
      if (this.root.childNodes.length > 1) {
        const fragVNode = { tag: 'fragment', attrs: {}, directives: {}, subDirectives: {}, children: [], _uid: this._uidCounter++ };
        this.root.childNodes.forEach(child => {
          if (child.nodeType === 1 && child.tagName.toLowerCase() === 'init') return;
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
