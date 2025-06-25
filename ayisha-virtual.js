// ayisha-virtual.js - Virtual DOM engine with directives, sub-directives, two-way binding, routing, components

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
    window.ayisha = this;
  }

  // Parse DOM -> VDOM, collect <init> blocks
  parse(node) {
    if (node.nodeType === 3) return { type: 'text', text: node.textContent };
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
    for (const child of node.childNodes) {
      const cn = this.parse(child);
      if (cn) vNode.children.push(cn);
    }
    return vNode;
  }

  // Execute <init> blocks
  _runInitBlocks() {
    for (const code of this._initBlocks) {
      try { new Function('state', code)(this.state); }
      catch (e) { console.error('Init error:', e); }
    }
  }

  // Make state reactive
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

  addWatcher(prop, fn) {
    (this.watchers[prop] = this.watchers[prop] || []).push(fn);
  }

  component(name, html) {
    this.components[name] = html;
  }

  // Evaluate JS expression in state+ctx
  _evalExpr(expr, ctx = {}, event) {
    const t = expr.trim();
    if (/^['"].*['"]$/.test(t)) return t.slice(1, -1);
    if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
    try {
      const sp = new Proxy(this.state, { get: (o, k) => o[k], set: (o, k, v) => { o[k] = v; return true; } });
      return new Function('state','ctx','event', `with(state){with(ctx||{}){return (${expr})}}`)(sp, ctx, event);
    } catch {
      return undefined;
    }
  }

  // Process mustache {{ }} in text
  _evalText(text, ctx) {
    return text.replace(/{{(.*?)}}/g, (_, e) => {
      const r = this._evalExpr(e.trim(), ctx);
      return r != null ? r : '';
    });
  }

  // Two-way binding @model
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

  // Validate input @validate
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

  // Simple router @link/@page
  _setupRouting() {
    let p = location.pathname.replace(/^\//, '') || '';
    if (!p || p === 'index.html') { history.replaceState({}, '', '/'); p = ''; }
    this.state.currentPage = p;
    window.addEventListener('popstate', () => {
      const np = location.pathname.replace(/^\//, '') || '';
      this.state.currentPage = np;
      this.render();
    });
  }

  // Render VDOM -> real DOM
  render() {
    const active = document.activeElement;
    let focusInfo = null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      let path = [];
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
        if (real.tagName === 'BODY') [...real.childNodes].forEach(c => document.body.appendChild(c));
        else document.body.appendChild(real);
      }
    } else {
      this.root.innerHTML = '';
      if (real) this.root.appendChild(real);
    }
    if (focusInfo) {
      let node = this.root;
      focusInfo.path.forEach(i => { if (node.childNodes[i]) node = node.childNodes[i]; });
      if (node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA')) {
        node.focus(); node.setSelectionRange(focusInfo.start, focusInfo.end);
      }
    }
    this._modelBindings.forEach(b => b.update());
  }

  // Recursive VNode -> DOM node
  _renderVNode(vNode, ctx) {
    if (!vNode) return null;
    if (vNode.type === 'text') return document.createTextNode(this._evalText(vNode.text, ctx));
    if (vNode.directives['@if'] && !this._evalExpr(vNode.directives['@if'], ctx)) return null;
    if (vNode.directives['@show'] && !this._evalExpr(vNode.directives['@show'], ctx)) return null;
    if (vNode.directives['@hide'] && this._evalExpr(vNode.directives['@hide'], ctx)) return null;
    if (vNode.directives['@for']) {
      const m = vNode.directives['@for'].match(/(\w+) in (.+)/);
      if (m) {
        const [_, it, expr] = m;
        let arr = this._evalExpr(expr, ctx) || [];
        if (typeof arr === 'object' && !Array.isArray(arr)) arr = Object.values(arr);
        const frag = document.createDocumentFragment();
        arr.forEach(val => {
          const sub = { ...ctx, [it]: val };
          vNode.children.forEach(c => {
            const node = this._renderVNode(c, sub);
            if (node) frag.appendChild(node);
          });
        });
        return frag;
      }
    }
    if (vNode.directives['@switch']) {
      const swVal = this._evalExpr(vNode.directives['@switch'], ctx);
      let defNode = null;
      for (const c of vNode.children) {
        if (!c.directives) continue;
        if (c.directives['@case'] != null) {
          let cv = c.directives['@case'];
          if (/^['"].*['"]$/.test(cv)) cv = cv.slice(1, -1);
          if (String(cv) === String(swVal)) return this._renderVNode(c, ctx);
        }
        if (c.directives['@default'] != null) defNode = c;
      }
      return defNode ? this._renderVNode(defNode, ctx) : document.createComment('noswitch');
    }
    if (vNode.directives['@source']) {
      const arr = this._evalExpr(vNode.directives['@source'], ctx) || [];
      const silentSet = (key, val) => {
        if (JSON.stringify(this.state[key]) !== JSON.stringify(val)) {
          Object.defineProperty(this.state, key, { value: val, writable: true, configurable: true, enumerable: true });
        }
      };
      let used = false;
      if (vNode.directives['@map']) {
        used = true;
        const fn = new Function('item', `return (${vNode.directives['@map']})`);
        silentSet(vNode.directives['@result'] || 'result', arr.map(fn));
      }
      if (vNode.directives['@filter']) {
        used = true;
        const fn = new Function('item', `return (${vNode.directives['@filter']})`);
        silentSet(vNode.directives['@result'] || 'result', arr.filter(fn));
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
        const init = vNode.directives['@initial'] ? this._evalExpr(vNode.directives['@initial'], ctx) : undefined;
        const res = init !== undefined ? arr.reduce(redFn, init) : arr.reduce(redFn);
        silentSet(vNode.directives['@result'] || 'result', res);
      }
      if (used) return document.createComment('functional');
    }
    const el = document.createElement(vNode.tag);
    // Primary @hover directive
    if (vNode.directives['@hover']) {
      const exprHover = vNode.directives['@hover'];
      el.addEventListener('mouseenter', event => {
        try { new Function('state','ctx','event', `with(state){with(ctx){${exprHover}}}`)(this.state, ctx, event); } catch(e) { console.error('Error in @hover:', e); }
        this.render();
      });
    }
    Object.entries(vNode.attrs).forEach(([k, v]) => el.setAttribute(k, v));
    vNode.children.forEach(c => { const n = this._renderVNode(c, ctx); if (n) el.appendChild(n); });
    for (const [dir, evs] of Object.entries(vNode.subDirectives)) {
      for (const [evt, expr] of Object.entries(evs)) {
        if (dir === '@class') {
          const apply = () => { const m = this._evalExpr(expr, ctx) || {}; Object.keys(m).forEach(c => el.classList.add(c)); };
          const remove = () => { const m = this._evalExpr(expr, ctx) || {}; Object.keys(m).forEach(c => el.classList.remove(c)); };
          if (evt === 'hover') { el.addEventListener('mouseenter', apply); el.addEventListener('mouseleave', remove); }
          else { el.addEventListener(evt, e => { const m = this._evalExpr(expr, ctx, e) || {}; Object.entries(m).forEach(([c,cond]) => el.classList.toggle(c, !!cond)); }); }
        } else if (dir === '@text') {
          if (!el._ayishaOriginal) el._ayishaOriginal = el.textContent;
          if (evt === 'click') { el.addEventListener('click', e => { el.textContent = this._evalExpr(expr, ctx, e); }); }
          else if (evt === 'hover') { el.addEventListener('mouseenter', e => { el.textContent = this._evalExpr(expr, ctx, e); }); el.addEventListener('mouseleave', e => { el.textContent = el._ayishaOriginal; }); }
        } else if (dir === '@click') {
          el.addEventListener('click', e => { new Function('state','ctx','event', `with(state){with(ctx){${expr}}}`)(this.state, ctx, e); this.render(); });
        } else if (dir === '@hover') {
          el.addEventListener('mouseenter', e => { new Function('state','ctx','event', `with(state){with(ctx){${expr}}}`)(this.state, ctx, e); this.render(); });
          el.addEventListener('mouseleave', e => this.render());
        } else if (dir === '@fetch') {
          const eventName = (evt === 'hover' ? 'mouseenter' : evt);
          el.addEventListener(eventName, e => {
            const url = this._evalExpr(expr, ctx, e);
            if (!url) return;
            const rk = vNode.directives['@result'] || 'result';
            const fid = `${expr}_${rk}`;
            if (!this._fetched[fid]) {
              fetch(url)
                .then(res => res.ok ? res.json() : Promise.reject(res.status))
                .then(data => { this.state[rk] = data; })
                .catch(err => console.error('@fetch error:', err));
              this._fetched[fid] = true;
            }
          });
        }
      }
    }
    if (vNode.directives['@text'] && !vNode.subDirectives['@text']) el.textContent = this._evalExpr(vNode.directives['@text'], ctx);
    if (vNode.directives['@fetch'] && !vNode.subDirectives['@fetch']) {
      const tpl = vNode.directives['@fetch'];
      const rk = vNode.directives['@result'] || 'result';
      const fid = `${tpl}_${rk}`;
      if (!this._fetched[fid]) {
        const doFetch = () => {
          try {
            const url = tpl.replace(/\{([^}]+)\}/g, (_, k) => this._evalExpr(k, ctx));
            fetch(url)
              .then(res => res.ok ? res.json() : Promise.reject(res.status))
              .then(data => { this.state[rk] = data; })
              .catch(err => console.error('@fetch error:', err));
          } catch (err) {
            console.error('@fetch setup error:', err);
          }
        };
        doFetch();
        if (vNode.directives['@watch']) vNode.directives['@watch'].split(',').forEach(dep => this.addWatcher(dep.trim(), doFetch));
        this._fetched[fid] = true;
      }
    }
    if (vNode.directives['@model']) this._bindModel(el, vNode.directives['@model'], ctx);
    if (vNode.directives['@class'] && !vNode.subDirectives['@class']) {
      const cm = this._evalExpr(vNode.directives['@class'], ctx) || {};
      Object.entries(cm).forEach(([c, cond]) => el.classList.toggle(c, !!cond));
    }
    if (vNode.directives['@style']) {
      const so = this._evalExpr(vNode.directives['@style'], ctx) || {};
      Object.entries(so).forEach(([p, val]) => el.style[p] = val);
    }
    if (vNode.directives['@click']) el.addEventListener('click', e => { new Function('state','ctx','event', `with(state){with(ctx){${vNode.directives['@click']}}}`)(this.state, ctx, e); this.render(); });
    // Base @hover directive (primary)
    if (vNode.directives['@hover']) {
      el.addEventListener('mouseenter', e => { try { new Function('state','ctx','event', `with(state){with(ctx){${vNode.directives['@hover']}}}`)(this.state, ctx, e); } catch(err){ console.error('Error in @hover:',err);} this.render(); });
    }
    if (vNode.directives['@validate']) this._bindValidation(el, vNode.directives['@validate']);
    if (vNode.directives['@link']) { el.setAttribute('href', vNode.directives['@link']); el.addEventListener('click', e => { e.preventDefault(); this.state.currentPage = vNode.directives['@link']; }); }
    if (vNode.directives['@page'] && this.state.currentPage !== vNode.directives['@page']) return null;
    if (vNode.directives['@animate']) el.classList.add(vNode.directives['@animate']);
    if (vNode.directives['@component']) {
      const name = vNode.directives['@component'];
      if (this.components[name]) {
        const frag = document.createRange().createContextualFragment(this.components[name]);
        const cv = this.parse(frag);
        const ce = this._renderVNode(cv, ctx);
        if (ce) el.appendChild(ce);
      }
    }
    return el;
  }

  mount() {
    this._vdom = this.parse(this.root);
    this._makeReactive();
    this._runInitBlocks();
    this._setupRouting();
    const self = this; let cp = this.state.currentPage;
    Object.defineProperty(this.state, 'currentPage', { get(){ return cp; }, set(v){ if(cp!==v){ cp=v; history.pushState({}, '', '/' + v); self.render(); }} });
    this.render();
    this.root.addEventListener('click', e => { let el = e.target; while(el && el!==this.root){ if(el.hasAttribute('@link')){ e.preventDefault(); this.state.currentPage = el.getAttribute('@link'); return;} el = el.parentNode;} }, true);
  }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => new AyishaVDOM(document.body).mount()); } else { new AyishaVDOM(document.body).mount(); }
