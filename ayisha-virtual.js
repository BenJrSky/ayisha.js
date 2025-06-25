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

  // Parse: DOM -> VDOM and collect <init> blocks
  parse(node) {
    if (node.nodeType === 3) return { type: 'text', text: node.textContent };
    if (node.nodeType !== 1) return null;
    const tag = node.tagName.toLowerCase();
    if (tag === 'init') { this._initBlocks.push(node.textContent); return null; }
    const vNode = { tag, attrs: {}, directives: {}, subDirectives: {}, children: [] };
    Array.from(node.attributes).forEach(attr => {
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
    });
    node.childNodes.forEach(child => {
      const cn = this.parse(child);
      if (cn) vNode.children.push(cn);
    });
    return vNode;
  }

  // Execute <init> code
  _runInitBlocks() {
    this._initBlocks.forEach(code => {
      try { new Function('state', code)(this.state); }
      catch (e) { console.error('Init block error:', e); }
    });
  }

  // Make state reactive
  _makeReactive() {
    this.state = new Proxy(this.state, {
      set: (obj, prop, val) => {
        obj[prop] = val;
        this.watchers[prop]?.forEach(fn => fn(val));
        this.render();
        return true;
      }
    });
  }

  addWatcher(prop, fn) {
    (this.watchers[prop] = this.watchers[prop] || []).push(fn);
  }

  component(name, html) { this.components[name] = html; }

  _evalExpr(expr, ctx = {}, event) {
    const t = expr.trim();
    if (/^['"].*['"]$/.test(t)) return t.slice(1,-1);
    if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
    try {
      const sp = new Proxy(this.state, { get:(o,k)=>o[k], set:(o,k,v)=>o[k]=v });
      return new Function('state','ctx','event', `with(state){with(ctx||{}){return (${expr})}}`)(sp,ctx,event);
    } catch { return undefined; }
  }

  _evalText(text, ctx) {
    return text.replace(/{{(.*?)}}/g, (_,e) => {
      const r = this._evalExpr(e.trim(),ctx);
      return r != null ? r : '';
    });
  }

  // Two-way binding for @model
  _bindModel(el,key,ctx) {
    const update = () => {
      const val = this._evalExpr(key,ctx);
      if (el.type==='checkbox') el.checked = !!val;
      else if (el.type==='radio') el.checked = val==el.value;
      else if (el.value!==String(val)) el.value = val ?? '';
    };
    this._modelBindings.push({ el, update }); update();
    el.addEventListener('input',e=>{
      new Function('state','ctx','value', `with(state){with(ctx||{}){${key}=value}}`)(this.state,ctx,el.value);
      this.render();
    });
  }

  _bindValidation(el,rulesStr) {
    const rules = rulesStr.split(',').map(r=>r.trim());
    el.addEventListener('input',()=>{
      let valid=true;
      rules.forEach(rule=>{
        if(rule==='required'&&!el.value) valid=false;
        if(rule.startsWith('minLength')){
          const m=parseInt(rule.split(':')[1],10);
          if(el.value.length<m) valid=false;
        }
      });
      el.classList.toggle('invalid',!valid);
    });
  }

  _setupRouting() {
    let p=location.pathname.replace(/^\//,'')||'';
    if(!p||p==='index.html'){history.replaceState({},'', '/');p='';}
    this.state.currentPage=p;
    window.addEventListener('popstate',()=>{const np=location.pathname.replace(/^\//,'')||'';this.state.currentPage=np;this.render();});
  }

  render() {
    // save focus
    const active=document.activeElement;
    let fi=null;
    if(active&&(active.tagName==='INPUT'||active.tagName==='TEXTAREA')){
      let path=[]; let node=active;
      while(node&&node!==this.root){const p=node.parentNode; const idx=[...p.childNodes].indexOf(node); path.unshift(idx); node=p;}
      fi={path,selStart:active.selectionStart,selEnd:active.selectionEnd};
    }
    this._modelBindings=[];
    const real=this._renderVNode(this._vdom,this.state);
    // replace root
    if(this.root===document.body){document.body.innerHTML=''; if(real){if(real.tagName==='BODY') [...real.childNodes].forEach(n=>document.body.appendChild(n)); else document.body.appendChild(real);} }
    else{this.root.innerHTML=''; real&&this.root.appendChild(real);}    
    // restore focus
    if(fi){let node=this.root; fi.path.forEach(i=>{if(node.childNodes[i])node=node.childNodes[i];}); if(node&&(node.tagName==='INPUT'||node.tagName==='TEXTAREA')){node.focus(); node.setSelectionRange(fi.selStart,fi.selEnd);} }
    this._modelBindings.forEach(b=>b.update());
  }

  _renderVNode(vNode,ctx) {
    if(!vNode) return null;
    if(vNode.type==='text') return document.createTextNode(this._evalText(vNode.text,ctx));
    // directives: if/show/hide
    if(vNode.directives['@if'] && !this._evalExpr(vNode.directives['@if'],ctx)) return null;
    if(vNode.directives['@show'] && !this._evalExpr(vNode.directives['@show'],ctx)) return null;
    if(vNode.directives['@hide'] && this._evalExpr(vNode.directives['@hide'],ctx)) return null;
    // for
    if(vNode.directives['@for']){
      const m=vNode.directives['@for'].match(/(\w+) in (.+)/);
      if(m){const[_,it,expr]=m;let arr=this._evalExpr(expr,ctx)||[]; if(typeof arr==='object'&&!Array.isArray(arr))arr=Object.values(arr);
        const frag=document.createDocumentFragment(); arr.forEach(val=>{const sub={...ctx,[it]:val}; vNode.children.forEach(c=>{const n=this._renderVNode(c,sub);n&&frag.appendChild(n);});}); return frag;}
    }
    // switch/case/default
    if(vNode.directives['@switch']){
      const sw=this._evalExpr(vNode.directives['@switch'],ctx); let def=null;
      for(const c of vNode.children){if(!c.directives)continue; if(c.directives['@case']!=null){let cv=c.directives['@case']; if(/^['"].*['"]$/.test(cv))cv=cv.slice(1,-1); if(String(cv)===String(sw)) return this._renderVNode(c,ctx);} if(c.directives['@default']!=null)def=c;}
      return def?this._renderVNode(def,ctx):document.createComment('noswitch');
    }
    // element
    const el=document.createElement(vNode.tag);
    Object.entries(vNode.attrs).forEach(([k,v])=>el.setAttribute(k,v));
    // children
    vNode.children.forEach(c=>{const n=this._renderVNode(c,ctx);n&&el.appendChild(n);});
    // sub-directives handling
    Object.entries(vNode.subDirectives).forEach(([dir,evs])=>{
      Object.entries(evs).forEach(([evt,expr])=>{
        const eventName=(evt==='hover'?'mouseenter':evt);
        if(dir==='@fetch'){
          el.addEventListener(eventName,e=>{
            setTimeout(()=>{
              try{
                let url=expr.replace(/\{([^}]+)\}/g,(_,k)=>{const r=this._evalExpr(k,ctx,e); if(r==null)throw Error('Missing '+k);return r;});
                const rk=vNode.directives['@result']||'result'; const fid=url+rk;
                if(!this._fetched[fid]){ fetch(url).then(r=>r.ok?r.json():Promise.reject(r.status)).then(d=>this.state[rk]=d).catch(err=>console.error(err)); this._fetched[fid]=true; }
              }catch(err){console.error(err);}  
            },0);
          });
        }
        else if(dir==='@hover'){
          el.addEventListener('mouseenter',e=>{try{new Function('state','ctx','event',`with(state){with(ctx){${expr}}}`)(this.state,ctx,e);}catch(err){console.error(err);} this.render();});
          el.addEventListener('mouseleave',e=>{this.render();});
        }
        else if(dir==='@click'){
          el.addEventListener('click',e=>{try{new Function('state','ctx','event',`with(state){with(ctx){${expr}}}`)(this.state,ctx,e);}catch(err){console.error(err);} this.render();});
        }
        else if(dir==='@model'){
          el.addEventListener(evt,e=>{const val=el.value; this.state[expr]=val; this.render();});
        }
        else if(dir==='@set'){
          el.addEventListener(evt,e=>{try{new Function('state','ctx','event',`with(state){with(ctx){${expr}}}`)(this.state,ctx,e);}catch(err){console.error(err);} this.render();});
        }
        else if(dir==='@text'){
          if(evt==='click') el.addEventListener('click',e=>{el.textContent=this._evalExpr(expr,ctx,e);});
          else if(evt==='hover'||evt==='mouseenter'){
            const orig=el.textContent;
            el.addEventListener('mouseenter',e=>{el.textContent=this._evalExpr(expr,ctx,e);});
            el.addEventListener('mouseleave',e=>{el.textContent=orig;});
          }
        }
        else if(dir==='@class'){
          el.addEventListener(evt,e=>{const clsMap=this._evalExpr(expr,ctx,e)||{}; Object.entries(clsMap).forEach(([c,cond])=>el.classList.toggle(c,!!cond));});
        }
      });
    });
    // base directives
    if(vNode.directives['@text']&&!vNode.subDirectives['@text']) el.textContent=this._evalExpr(vNode.directives['@text'],ctx);
    if(vNode.directives['@fetch']&&!vNode.subDirectives['@fetch']){
      const tpl=vNode.directives['@fetch'], rk=vNode.directives['@result']||'result', fid=tpl+rk;
      if(!this._fetched[fid]){ const fn=()=>{try{let url=tpl.replace(/\{([^}]+)\}/g,(_,k)=>this._evalExpr(k,ctx)); fetch(url).then(r=>r.ok?r.json():Promise.reject(r.status)).then(d=>this.state[rk]=d);}catch(err){console.error(err);}}; fn(); if(vNode.directives['@watch']) vNode.directives['@watch'].split(',').forEach(dep=>this.addWatcher(dep.trim(),fn)); this._fetched[fid]=true; }
    }
    if(vNode.directives['@model']) this._bindModel(el,vNode.directives['@model'],ctx);
    if(vNode.directives['@class']&&!vNode.subDirectives['@class']){const cm=this._evalExpr(vNode.directives['@class'],ctx)||{};Object.entries(cm).forEach(([c,cond])=>el.classList.toggle(c,!!cond));}
    if(vNode.directives['@style']){const so=this._evalExpr(vNode.directives['@style'],ctx)||{};Object.entries(so).forEach(([p,val])=>el.style[p]=val);}
    if(vNode.directives['@click']) el.addEventListener('click',e=>{try{new Function('state','ctx','event',`with(state){with(ctx){${vNode.directives['@click']}}}`)(this.state,ctx,e);}catch(err){console.error(err);}this.render();});
    if(vNode.directives['@validate']) this._bindValidation(el,vNode.directives['@validate']);
    if(vNode.directives['@link']){el.setAttribute('href',vNode.directives['@link']);el.addEventListener('click',e=>{e.preventDefault();this.state.currentPage=vNode.directives['@link'];});}
    if(vNode.directives['@page']&&this.state.currentPage!==vNode.directives['@page']) return null;
    if(vNode.directives['@animate']) el.classList.add(vNode.directives['@animate']);
    if(vNode.directives['@component']){const name=vNode.directives['@component'];if(this.components[name]){const frag=document.createRange().createContextualFragment(this.components[name]);const cv=this.parse(frag);const cel=this._renderVNode(cv,ctx);cel&&el.appendChild(cel);}}
    return el;
  }

  mount(){
    this._vdom=this.parse(this.root);
    this._makeReactive();
    this._runInitBlocks();
    this._setupRouting();
    const self=this;let cp=this.state.currentPage;
    Object.defineProperty(this.state,'currentPage',{get(){return cp;},set(v){if(cp!==v){cp=v;history.pushState({},'', '/'+v);self.render();}}});
    this.render();
    this.root.addEventListener('click',e=>{let el=e.target;while(el&&el!==this.root){if(el.hasAttribute('@link')){e.preventDefault();this.state.currentPage=el.getAttribute('@link');return;} if(el.hasAttribute('@click')){const m=el.getAttribute('@click').match(/currentPage\s*=\s*['\"](.*?)['\"]/);if(m){this.state.currentPage=m[1];return;}} el=el.parentNode;}},true);
  }
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',()=>new AyishaVDOM(document.body).mount());}else new AyishaVDOM(document.body).mount();
