// A tiny fake DOM, enough for the selector and traversal surface content.js's composer
// code uses (compound selectors, comma lists, descendant and child combinators,
// closest, insertBefore, previousElementSibling…). Shared by the arena composer tests.
//
// WARNING: never pass one of these nodes to assert.equal / deepEqual — on failure Node
// inspects the circular node graph to build the message and the process dies of memory.
// Compare booleans (`a === b`) instead.

/**
 * Splits a selector on its combinators, ignoring spaces inside brackets or
 * quotes — `button[aria-label="Attach files"]` is ONE compound selector.
 */
function splitSelector(one) {
  const parts = [];
  let cur = '';
  let depth = 0;
  let quote = null;
  for (const ch of one.trim()) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '[') { depth += 1; cur += ch; continue; }
    if (ch === ']') { depth -= 1; cur += ch; continue; }
    if (depth === 0 && ch === '>') { if (cur) { parts.push(cur); cur = ''; } parts.push('>'); continue; }
    if (depth === 0 && /\s/.test(ch)) { if (cur) { parts.push(cur); cur = ''; } continue; }
    cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

/** A compound selector (`textarea[name="message"]`): tag, `#id`, `.class`, `[attr]`. */
const SIMPLE_RE = /\[[^\]]+\]|#[^.#[\]\s>]+|\.[^.#[\]\s>]+|[a-zA-Z*][\w-]*/g;

function simpleMatch(node, part) {
  const tokens = String(part).match(SIMPLE_RE) || [];
  return tokens.every((t) => {
    if (t === '*') return true;
    if (t[0] === '#') return node.id === t.slice(1);
    if (t[0] === '.') return node.classList.contains(t.slice(1));
    if (t[0] === '[') {
      const m = /^\[([^=\]]+)(?:=["']?([^"']*)["']?)?\]$/.exec(t);
      if (!m) return false;
      const v = node.getAttribute(m[1]);
      return m[2] === undefined ? v !== null : v === m[2];
    }
    return node.tagName === t.toUpperCase();
  });
}

/**
 * A selector list, with descendant combinators — enough for the ones content.js
 * uses here (`textarea[name="message"]`, `.ds-textarea textarea`, `header,nav`…).
 */
function matchesSel(node, selector) {
  return String(selector).split(',').some((one) => {
    const parts = splitSelector(one);
    if (!simpleMatch(node, parts[parts.length - 1])) return false;
    let cur = node;
    let i = parts.length - 2;
    while (i >= 0) {
      if (parts[i] === '>') { // child combinator
        i -= 1;
        const p = cur.parentNode;
        if (!p || p.nodeType !== 1 || !simpleMatch(p, parts[i])) return false;
        cur = p;
        i -= 1;
        continue;
      }
      // a descendant step: walk up until an ancestor matches
      let up = cur.parentNode;
      while (up && up.nodeType === 1 && !simpleMatch(up, parts[i])) up = up.parentNode;
      if (!up || up.nodeType !== 1) return false;
      cur = up;
      i -= 1;
    }
    return true;
  });
}

function makeEl(tag, attrs = {}) {
  const node = {
    nodeType: 1,
    tagName: String(tag).toUpperCase(),
    childNodes: [],
    parentNode: null,
    id: '',
    hidden: false,
    offsetParent: {},
    isConnected: true,
    dataset: {},
    _attrs: { ...attrs },
    _classes: [],
    _text: '',
    _html: '',
    _hover: {},
    get children() { return node.childNodes.filter((c) => c.nodeType === 1); },
    get className() { return node._classes.join(' '); },
    set className(v) { node._classes = String(v).split(/\s+/).filter(Boolean); },
    get innerHTML() { return node._html; },
    set innerHTML(v) { node._html = String(v); },
    get textContent() { return node._text + node.childNodes.map((c) => c.textContent).join(''); },
    set textContent(v) { node._text = String(v); node.childNodes = []; },
    get previousElementSibling() {
      const p = node.parentNode;
      if (!p) return null;
      const i = p.childNodes.indexOf(node);
      for (let k = i - 1; k >= 0; k -= 1) if (p.childNodes[k].nodeType === 1) return p.childNodes[k];
      return null;
    },
    get firstElementChild() { return node.children[0] || null; },
    get lastElementChild() { const k = node.children; return k.length ? k[k.length - 1] : null; },
    get nextElementSibling() {
      const p = node.parentNode;
      if (!p) return null;
      const i = p.childNodes.indexOf(node);
      for (let k = i + 1; k < p.childNodes.length; k += 1) if (p.childNodes[k].nodeType === 1) return p.childNodes[k];
      return null;
    },
    setAttribute(k, v) { node._attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(node._attrs, k) ? node._attrs[k] : null; },
    appendChild(c) { c.parentNode = node; node.childNodes.push(c); return c; },
    insertBefore(c, ref) {
      if (ref && ref.parentNode !== node) { const e = new Error('NotFoundError'); e.name = 'NotFoundError'; throw e; }
      const at = ref ? node.childNodes.indexOf(ref) : -1;
      c.parentNode = node;
      if (at < 0) node.childNodes.push(c); else node.childNodes.splice(at, 0, c);
      return c;
    },
    get parentElement() { return node.parentNode && node.parentNode.nodeType === 1 ? node.parentNode : null; },
    contains(other) { for (let n = other; n; n = n.parentNode) if (n === node) return true; return false; },
    closest(sel) { for (let n = node; n && n.nodeType === 1; n = n.parentNode) if (matchesSel(n, sel)) return n; return null; },
    matches(sel) { return matchesSel(node, sel); },
    querySelectorAll(sel) { return collect(node).filter((n) => matchesSel(n, sel)); },
    querySelector(sel) { return node.querySelectorAll(sel)[0] || null; },
    getBoundingClientRect: () => ({ width: 400, height: 40, top: 500, left: 0, right: 400, bottom: 540 }),
  };
  node.classList = {
    add: (c) => { if (!node._classes.includes(c)) node._classes.push(c); },
    remove: (c) => { node._classes = node._classes.filter((x) => x !== c); },
    contains: (c) => node._classes.includes(c),
  };
  node.style = { getPropertyValue: (k) => node._hover[k] || '', setProperty: (k, v) => { node._hover[k] = v; }, width: '' };
  if (attrs.id) node.id = attrs.id;
  return node;
}

function collect(node) {
  const out = [];
  const walk = (n) => n.childNodes.forEach((c) => { if (c.nodeType === 1) { out.push(c); walk(c); } });
  walk(node);
  return out;
}

export { makeEl, matchesSel, collect };
