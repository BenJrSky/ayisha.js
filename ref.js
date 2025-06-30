// ref.js - Refactoring modulare di AyishaVDOM
(function () {
  // Registry centrale per direttive e sub-direttive
  class DirectiveRegistry {
    constructor() {
      this.directives = {};
      this.subDirectives = {};
    }
    registerDirective(name, handler) { this.directives[name] = handler; }
    registerSubDirective(name, handler) { this.subDirectives[name] = handler; }
    getDirective(name) { return this.directives[name]; }
    getSubDirective(name) { return this.subDirectives[name]; }
    hasDirective(name) { return !!this.directives[name]; }
    hasSubDirective(name) { return !!this.subDirectives[name]; }
  }

  // Parser separato
  class VNodeParser {
    constructor() {}
    parse(node, initBlocks = this._initBlocks) {
      if (!node) return null;
      if (node.nodeType === 11) { // DocumentFragment
        const fragVNode = { tag: 'fragment', attrs: {}, directives: {}, subDirectives: {}, children: [] };
        node.childNodes.forEach(child => {
          const cn = this.parse(child, initBlocks);
          if (cn) fragVNode.children.push(cn);
        });
        return fragVNode;
      }
      if (node.nodeType === 3) {
        return { type: 'text', text: node.textContent };
      }
      if (node.nodeType !== 1) return null;
      const tag = node.tagName.toLowerCase();
      if (tag === 'init') { initBlocks.push(node.textContent); return null; }
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
      if (node.childNodes && node.childNodes.length > 0) {
        node.childNodes.forEach(child => {
          const cn = this.parse(child, initBlocks);
          if (cn) vNode.children.push(cn);
        });
      }
      return vNode;
    }
  }

  // Renderer principale
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
      this.registry = new DirectiveRegistry();
      this.parser = new VNodeParser();
      this._registerBuiltInDirectives();
      window.ayisha = this;
    }

    // --- REGISTRAZIONE DIRETTIVE ---
    _registerBuiltInDirectives() {
      // Direttive principali
      this.registry.registerDirective('@if', (vNode, ctx, next) => {
        if (!this._evalExpr(vNode.directives['@if'], ctx)) return null;
        return next();
      });
      this.registry.registerDirective('@show', (vNode, ctx, next) => {
        if (!this._evalExpr(vNode.directives['@show'], ctx)) return null;
        return next();
      });
      this.registry.registerDirective('@hide', (vNode, ctx, next) => {
        if (this._evalExpr(vNode.directives['@hide'], ctx)) return null;
        return next();
      });
      this.registry.registerDirective('@for', (vNode, ctx, next) => {
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
        return null;
      });
      this.registry.registerDirective('@switch', (vNode, ctx, next) => {
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
      });
      this.registry.registerDirective('@source', (vNode, ctx, next) => {
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
        return next();
      });
      // @state, @log, @fetch sono gestite direttamente nel render base per motivi di side effect e visualizzazione
      // Puoi aggiungere qui altre direttive custom...

      // SUB-DIRETTIVE: esempio per @set, @model, @fetch, @class, @text, ecc.
      this.registry.registerSubDirective('@set', (el, expr, ctx, event) => {
        let codeToRun = expr;
        if (this._hasInterpolation && this._hasInterpolation(expr)) {
          codeToRun = this._evalAttrValue(expr, ctx);
        }
        try {
          new Function('state', 'ctx', 'event', `with(state){with(ctx){${codeToRun}}}`)(this.state, ctx, event);
        } catch (err) {
          if (this._showAyishaError) this._showAyishaError(el, err, codeToRun);
        }
        this.render();
      });
      this.registry.registerSubDirective('@model', (el, expr, ctx, event) => {
        if (this._bindModel) this._bindModel(el, expr, ctx);
      });
      this.registry.registerSubDirective('@validate', (el, expr, ctx, event) => {
        if (this._bindValidation) this._bindValidation(el, expr);
      });
      // Puoi aggiungere qui altre sub-direttive custom...
    }

    // --- PARSING ---
    parse(node) {
      return this.parser.parse(node, this._initBlocks);
    }

    // --- ESECUZIONE INIT ---
    _runInitBlocks() {
      this._initBlocks.forEach(code => {
        try {
          new Function('state', code)(this.state);
        } catch (e) {
          console.error('Init error:', e);
        }
      });
    }

    // --- REATTIVITÀ ---
    _makeReactive() {
      this.state = new Proxy(this.state, {
        set: (obj, prop, val) => {
          const old = obj[prop];
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

    addWatcher(prop, fn) {
      this.watchers[prop] = this.watchers[prop] || [];
      this.watchers[prop].push(fn);
    }

    component(name, html) {
      this.components[name] = html;
    }

    // --- EVAL ---
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

    // --- RENDER ---
    render() {
      if (this._isRendering) return;
      this._isRendering = true;
      // ...gestione scroll, focus, ecc. come in ayisha.js...
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
      // ...ripristino scroll/focus, update modelBindings, ecc...
      this._isRendering = false;
    }

    // --- RENDER VNODE ---
    _renderVNode(vNode, ctx) {
      if (!vNode) return null;
      // Centralizzazione: applica tutte le direttive registrate
      for (const dir of Object.keys(vNode.directives || {})) {
        if (this.registry.hasDirective(dir)) {
          const handler = this.registry.getDirective(dir);
          const res = handler.call(this, vNode, ctx, () => this._renderVNodeBase(vNode, ctx));
          if (res !== undefined) return res;
        }
      }
      // Nessuna direttiva speciale: render base
      return this._renderVNodeBase(vNode, ctx);
    }

    // --- RENDER BASE (elemento, attributi, children, sub-direttive) ---
    _renderVNodeBase(vNode, ctx) {
      if (vNode.type === 'text') return document.createTextNode(this._evalText(vNode.text, ctx));
      if (vNode.tag === 'fragment') {
        const frag = document.createDocumentFragment();
        vNode.children.forEach(child => {
          const node = this._renderVNode(child, ctx);
          if (node) frag.appendChild(node);
        });
        return frag;
      }
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
          const url = this._lastFetchUrl && this._lastFetchUrl[rk];
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

      const el = document.createElement(vNode.tag);
      Object.entries(vNode.attrs).forEach(([k, v]) => {
        el.setAttribute(k, this._evalAttrValue(v, ctx));
      });

      // --- NUOVA DIRETTIVA @state ---
      if (vNode.directives && vNode.directives.hasOwnProperty('@state')) {
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

      // --- NUOVA DIRETTIVA @log ---
      let logWrapper = null;
      let fetchLogInfo = null;
      if (vNode.directives && vNode.directives.hasOwnProperty('@log')) {
        // ... Copia la logica @log da ayisha.js ...
        const logDir = vNode.directives['@log'];
        const isJson = (str) => {
          if (typeof str !== 'string') return false;
          str = str.trim();
          if (str.startsWith('{') && str.endsWith('}')) return true;
          if (str.startsWith('[') && str.endsWith(']')) return true;
          return false;
        };
        const formatJson = (str) => {
          if (!isJson(str)) return str;
          try {
            const json = JSON.parse(str);
            return JSON.stringify(json, null, 2);
          } catch {
            return str;
          }
        };
        const logMessages = Array.isArray(logDir) ? logDir : [logDir];
        const logContainer = document.createElement('div');
        logContainer.style.backgroundColor = '#222';
        logContainer.style.color = '#fff';
        logContainer.style.padding = '1em';
        logContainer.style.borderRadius = '4px';
        logContainer.style.marginTop = '1em';
        logContainer.style.overflow = 'auto';
        logContainer.style.maxHeight = '300px';
        logContainer.style.fontFamily = 'monospace';
        logContainer.style.fontSize = '0.9em';
        const title = document.createElement('h3');
        title.textContent = 'LOG MESSAGES';
        title.style.margin = '0 0 0.5em';
        title.style.fontSize = '1.1em';
        title.style.fontWeight = 'bold';
        title.style.color = '#fff';
        logContainer.appendChild(title);
        logMessages.forEach(msg => {
          const div = document.createElement('div');
          div.style.margin = '0.5em 0';
          div.style.padding = '0.5em';
          div.style.borderRadius = '4px';
          div.style.backgroundColor = '#333';
          div.style.border = '1px solid #444';
          if (typeof msg === 'object') {
            div.innerHTML = `<code>${formatJson(JSON.stringify(msg, null, 2))}</code>`;
          } else {
            div.textContent = String(msg);
          }
          logContainer.appendChild(div);
        });
        logWrapper = logContainer;
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

      // ... Tutta la logica di gestione direttive, sub-direttive, eventi, model, class, style, validate, ecc. ...
      // --- EVENTI DIRETTIVE PRINCIPALI ---
// @click
if (vNode.directives && vNode.directives['@click']) {
  el.addEventListener('click', e => {
    if (el.tagName === 'BUTTON') e.preventDefault();
    const expr = vNode.directives['@click'];
    let codeToRun = expr;
    if (this._hasInterpolation && this._hasInterpolation(expr)) {
      codeToRun = this._evalAttrValue(expr, ctx);
    }
    try {
      new Function('state', 'ctx', 'event', `with(state){with(ctx){${codeToRun}}}`)(this.state, ctx, e);
    } catch (err) {
      if (this._showAyishaError) this._showAyishaError(el, err, codeToRun);
    }
    this.render();
  });
}
// @hover
if (vNode.directives && vNode.directives['@hover']) {
  const rawExpr = vNode.directives['@hover'];
  const applyHover = e => {
    let codeToRun = rawExpr;
    if (this._hasInterpolation && this._hasInterpolation(rawExpr)) {
      codeToRun = this._evalAttrValue(rawExpr, ctx);
    }
    try {
      new Function('state', 'ctx', 'event', `with(state){with(ctx){${codeToRun}}}`)(this.state, ctx, e);
    } catch (err) {
      if (this._showAyishaError) this._showAyishaError(el, err, codeToRun);
    }
    this.render();
  };
  el.addEventListener('mouseover', applyHover);
  el.addEventListener('mouseout', applyHover);
}
// @model
if (vNode.directives && vNode.directives['@model'] && this._bindModel) {
  this._bindModel(el, vNode.directives['@model'], ctx);
}
// @class
if (vNode.directives && vNode.directives['@class'] && !vNode.subDirectives['@class']) {
  const clsMap = this._evalExpr(vNode.directives['@class'], ctx) || {};
  Object.entries(clsMap).forEach(([cls, cond]) => el.classList.toggle(cls, !!cond));
}
// @style
if (vNode.directives && vNode.directives['@style']) {
  const styles = this._evalExpr(vNode.directives['@style'], ctx) || {};
  Object.entries(styles).forEach(([prop, val]) => el.style[prop] = val);
}
// @validate
if (vNode.directives && vNode.directives['@validate'] && this._bindValidation) {
  this._bindValidation(el, vNode.directives['@validate']);
}
// @link
if (vNode.directives && vNode.directives['@link']) {
  el.setAttribute('href', vNode.directives['@link']);
  el.addEventListener('click', e => {
    e.preventDefault();
    this.state.currentPage = vNode.directives['@link'];
  });
}
// @page
if (vNode.directives && vNode.directives['@page'] && this.state.currentPage !== vNode.directives['@page']) return null;
// @animate
if (vNode.directives && vNode.directives['@animate']) el.classList.add(vNode.directives['@animate']);
// @component (inline)
if (vNode.directives && vNode.directives['@component']) {
  const n = vNode.directives['@component'];
  if (this.components[n]) {
    const frag = document.createRange().createContextualFragment(this.components[n]);
    const compVNode = this.parse(frag);
    const compEl = this._renderVNode(compVNode, ctx);
    if (compEl) el.appendChild(compEl);
  }
}
// --- SUB-DIRETTIVE ED EVENTI ---
if (vNode.subDirectives) {
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
        const getInterpolatedExpr = () => this._evalAttrValue(expr, ctx);
        if (dir === '@fetch') {
          el.addEventListener(eventName, e => {
            let exprToRun = expr;
            let matchAssign = expr.match(/^([\w$]+)\s*=\s*(.+)$/);
            if (matchAssign && this._hasInterpolation && this._hasInterpolation(expr)) {
              const varName = matchAssign[1];
              let valueExpr = matchAssign[2].trim();
              let interpolated = this._evalAttrValue(valueExpr, ctx);
              if (!(varName in this.state)) this.state[varName] = '';
              this.state[varName] = interpolated;
              setupFetch(varName, vNode.directives['@result'] || 'result', e, true);
            } else {
              let codeToRun = expr;
              if (this._hasInterpolation && this._hasInterpolation(expr)) {
                codeToRun = this._evalAttrValue(expr, ctx);
              }
              try {
                new Function('state', 'ctx', 'event', `with(state){with(ctx){${codeToRun}}}`)(this.state, ctx, e);
              } catch (err) {
                if (this._showAyishaError) this._showAyishaError(el, err, codeToRun);
              }
              setupFetch(expr, vNode.directives['@result'] || 'result', e, true);
            }
            this.render();
          });
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
          return;
        }
        el.addEventListener(eventName, e => {
          let codeToRun = getInterpolatedExpr();
          try {
            new Function('state', 'ctx', 'event', `with(state){with(ctx){${codeToRun}}}`)(this.state, ctx, e);
          } catch (err) {
            if (this._showAyishaError) this._showAyishaError(el, err, codeToRun);
          }
          this.render();
        });
        return;
      }
    });
  });
}
// @text (static)
if (vNode.directives && vNode.directives['@text'] && !vNode.subDirectives['@text']) {
  el.textContent = this._evalExpr(vNode.directives['@text'], ctx);
}
// --- CHILDREN ---
vNode.children.forEach(child => {
  const node = this._renderVNode(child, ctx);
  if (node) el.appendChild(node);
});
// ...fine logica direttive/subdirettive/eventi...
    }

    // --- MOUNT ---
    mount() {
      this._makeReactive();
      this._runInitBlocks();
      // --- ROUTING SPA ---
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
        },
        configurable: true,
        enumerable: true
      });
      this.render();
      this.root.addEventListener('click', e => {
        let el = e.target;
        while (el && el !== this.root) {
          if (el.hasAttribute && el.hasAttribute('@link')) {
            e.preventDefault();
            this.state.currentPage = el.getAttribute('@link');
            return;
          }
          el = el.parentNode;
        }
      }, true);
      // ...routing, ecc...
      this.render();
    }
  }

  window.AyishaVDOM = AyishaVDOM;
})();
