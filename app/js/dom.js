// Tiny DOM helpers: build elements without innerHTML, so trophy text is always set as text.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'text') el.textContent = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// Replace an element's children, skipping null/false entries (native replaceChildren would print "null").
export function fill(el, ...children) {
  el.replaceChildren();
  appendChildren(el, children);
  return el;
}

export function add(el, ...children) {
  appendChildren(el, children);
  return el;
}

export function byId(id) {
  return document.getElementById(id);
}

export function formatCount(n) {
  return n >= 10000 ? n.toLocaleString('en-US') : String(n);
}
