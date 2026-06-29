// ─────────────────────────────────────────────────────────────────────────────
// BSP tile tree
//
//   Leaf:   { type:'leaf', id:string, url:string|null, showBar:bool }
//   Split:  { type:'vsplit'|'hsplit', ratio:number, first:Node, second:Node }
//
//   vsplit → vertical divider:   [ first | second ]
//   hsplit → horizontal divider: [ first / second ]
// ─────────────────────────────────────────────────────────────────────────────

let _nextId = 0;
function mkId() {
  return String(++_nextId);
}

function makeLeaf(url = null) {
  return { type: "leaf", id: mkId(), url, showBar: true };
}

let tree = makeLeaf();
let focused = tree.id; // id of the currently focused leaf

// ── Tree helpers ─────────────────────────────────────────────────────────────

function findLeaf(node, id) {
  if (node.type === "leaf") return node.id === id ? node : null;
  return findLeaf(node.first, id) || findLeaf(node.second, id);
}

/** Returns the direct split-parent of the leaf with `id`, or null for root. */
function leafParent(node, id, parent = null) {
  if (node.type === "leaf") return node.id === id ? parent : null;
  return leafParent(node.first, id, node) || leafParent(node.second, id, node);
}

function replaceChild(root, target, replacement) {
  if (root.type === "leaf") return;
  if (root.first === target) {
    root.first = replacement;
    return;
  }
  if (root.second === target) {
    root.second = replacement;
    return;
  }
  replaceChild(root.first, target, replacement);
  replaceChild(root.second, target, replacement);
}

function firstLeaf(node) {
  return node.type === "leaf" ? node : firstLeaf(node.first);
}

function allLeafIds(node) {
  return node.type === "leaf"
    ? [node.id]
    : [...allLeafIds(node.first), ...allLeafIds(node.second)];
}

function hasLeaf(node, id) {
  return node.type === "leaf"
    ? node.id === id
    : hasLeaf(node.first, id) || hasLeaf(node.second, id);
}

// ── Layout computation ───────────────────────────────────────────────────────

/** Returns [{id, x, y, w, h}] for every leaf, in pixels. */
function computeLayout(node, x, y, w, h) {
  if (node.type === "leaf") return [{ id: node.id, x, y, w, h }];
  if (node.type === "vsplit") {
    const mid = Math.round(w * node.ratio);
    return [
      ...computeLayout(node.first, x, y, mid, h),
      ...computeLayout(node.second, x + mid, y, w - mid, h),
    ];
  }
  // hsplit
  const mid = Math.round(h * node.ratio);
  return [
    ...computeLayout(node.first, x, y, w, mid),
    ...computeLayout(node.second, x, y + mid, w, h - mid),
  ];
}

function getLayout() {
  return computeLayout(tree, 0, 0, window.innerWidth, window.innerHeight);
}

// ── Tree mutations ───────────────────────────────────────────────────────────

function splitFocused(kind) {
  // kind: 'vsplit' | 'hsplit'
  const leaf = findLeaf(tree, focused);
  if (!leaf) return;

  const newLeaf = makeLeaf();
  const split = { type: kind, ratio: 0.5, first: leaf, second: newLeaf };

  if (tree === leaf) {
    tree = split;
  } else {
    replaceChild(tree, leaf, split);
  }

  focused = newLeaf.id;
}

function closeFocused() {
  // If only one tile exists, recreate it blank.
  if (tree.type === "leaf") {
    removeTileDOM(tree.id);
    tree = makeLeaf();
    focused = tree.id;
    return;
  }

  const parent = leafParent(tree, focused);
  if (!parent) return;

  const closedSide = hasLeaf(parent.first, focused)
    ? parent.first
    : parent.second;
  const sibling = closedSide === parent.first ? parent.second : parent.first;

  for (const id of allLeafIds(closedSide)) removeTileDOM(id);

  if (parent === tree) {
    tree = sibling;
  } else {
    replaceChild(tree, parent, sibling);
  }

  focused = firstLeaf(sibling).id;
}

function moveFocus(direction) {
  const layouts = getLayout();
  const cur = layouts.find((l) => l.id === focused);
  if (!cur) return;

  let best = null,
    bestDist = Infinity;
  const { x, y, w, h } = cur;

  for (const l of layouts) {
    if (l.id === focused) continue;
    const EPS = 1;
    let dist = Infinity,
      ok = false;

    if (direction === "left") {
      const re = l.x + l.w;
      if (re <= x + EPS) {
        const ov = Math.min(y + h, l.y + l.h) - Math.max(y, l.y);
        if (ov > 1) {
          dist = x - re;
          ok = true;
        }
      }
    } else if (direction === "right") {
      const le = l.x;
      if (le >= x + w - EPS) {
        const ov = Math.min(y + h, l.y + l.h) - Math.max(y, l.y);
        if (ov > 1) {
          dist = le - (x + w);
          ok = true;
        }
      }
    } else if (direction === "up") {
      const be = l.y + l.h;
      if (be <= y + EPS) {
        const ov = Math.min(x + w, l.x + l.w) - Math.max(x, l.x);
        if (ov > 1) {
          dist = y - be;
          ok = true;
        }
      }
    } else if (direction === "down") {
      const te = l.y;
      if (te >= y + h - EPS) {
        const ov = Math.min(x + w, l.x + l.w) - Math.max(x, l.x);
        if (ov > 1) {
          dist = te - (y + h);
          ok = true;
        }
      }
    }

    if (ok && dist < bestDist) {
      bestDist = dist;
      best = l.id;
    }
  }

  if (best) focused = best;
}

function resizeFocused(grow) {
  const parent = leafParent(tree, focused);
  if (!parent) return;

  const isFirst = hasLeaf(parent.first, focused);
  const delta = grow ? 0.05 : -0.05;

  // Positive delta grows the first child.
  parent.ratio = Math.min(
    0.9,
    Math.max(0.1, parent.ratio + (isFirst ? delta : -delta)),
  );
}

// ── DOM management ───────────────────────────────────────────────────────────

const container = document.getElementById("container");

// Map: id → { el, webview, bar, input }
const tileMap = new Map();

const HINTS = [
  ["Ctrl+Alt+N", "split right"],
  ["Ctrl+Alt+⇧+N", "split below"],
  ["Ctrl+Alt+W", "close tile"],
  ["Ctrl+Alt+H/L/J/K", "focus ←→↑↓"],
  ["Ctrl+Alt+←/→", "back / forward"],
  ["Ctrl+Alt+R", "reload"],
  ["Ctrl+Alt+. / ,", "grow / shrink"],
  ["Ctrl+Alt+Q", "quit"],
];

function createTileDOM(id) {
  const el = document.createElement("div");
  el.className = "tile";
  el.dataset.id = id;

  // Webview – shares the persist:default session so cookies are preserved.
  const webview = document.createElement("webview");
  webview.className = "tile-webview hidden";
  webview.setAttribute("partition", "persist:default");
  webview.setAttribute("allowpopups", "");

  // Address-bar overlay
  const bar = document.createElement("div");
  bar.className = "address-bar";

  const form = document.createElement("div");
  form.className = "address-form";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "address-input";
  input.placeholder = "Enter URL or search…";
  input.spellcheck = false;

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      navigateTile(id, input.value.trim());
    } else if (e.key === "Escape") {
      const leaf = findLeaf(tree, id);
      if (!leaf) return;
      if (leaf.url) {
        // URL already loaded — just hide the bar.
        leaf.showBar = false;
        bar.classList.add("hidden");
        webview.classList.remove("hidden");
        webview.focus();
      } else {
        // New empty tile — close it.
        focused = id;
        closeFocused();
        render();
      }
    }
  });

  // Hint grid
  const hints = document.createElement("div");
  hints.className = "shortcuts-hint";
  for (const [key, desc] of HINTS) {
    const kEl = document.createElement("kbd");
    kEl.textContent = key;
    const dEl = document.createElement("span");
    dEl.textContent = desc;
    hints.appendChild(kEl);
    hints.appendChild(dEl);
  }

  form.appendChild(input);
  bar.appendChild(form);
  bar.appendChild(hints);
  el.appendChild(webview);
  el.appendChild(bar);

  // Click on any tile makes it the focused tile.
  el.addEventListener("mousedown", () => {
    if (focused !== id) {
      focused = id;
      applyFocusClasses();
    }
  });

  container.appendChild(el);
  tileMap.set(id, { el, webview, bar, input, srcInitialized: false });
}

function removeTileDOM(id) {
  tileMap.get(id)?.el.remove();
  tileMap.delete(id);
}

function navigateTile(id, raw) {
  if (!raw) return;
  const leaf = findLeaf(tree, id);
  if (!leaf) return;

  let url = raw;
  // Add protocol if missing.
  if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(url)) {
    if (/^[\w-]+(\.[\w-]+)+/.test(url) && !url.includes(" ")) {
      url = "https://" + url;
    } else {
      url = "https://www.google.com/search?q=" + encodeURIComponent(url);
    }
  }

  leaf.url = url;
  leaf.showBar = false;

  const t = tileMap.get(id);
  if (!t) return;
  t.webview.setAttribute("src", url);
  t.srcInitialized = true;
  t.webview.classList.remove("hidden");
  t.bar.classList.add("hidden");
  // Size the guest surface immediately (navigateTile bypasses render()).
  const rect = t.el.getBoundingClientRect();
  t.webview.style.width = rect.width + "px";
  t.webview.style.height = rect.height + "px";
  t.webview.focus();
}

function applyFocusClasses() {
  for (const [id, { el }] of tileMap) {
    el.classList.toggle("focused", id === focused);
  }
}

function render() {
  const layouts = getLayout();
  const activeIds = new Set(layouts.map((l) => l.id));

  // Remove tiles that no longer exist in the tree.
  for (const id of [...tileMap.keys()]) {
    if (!activeIds.has(id)) removeTileDOM(id);
  }

  for (const { id, x, y, w, h } of layouts) {
    if (!tileMap.has(id)) createTileDOM(id);
    const t = tileMap.get(id);
    const { el, webview, bar, input } = t;
    const leaf = findLeaf(tree, id);

    // Position & size.
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = w + "px";
    el.style.height = h + "px";

    el.classList.toggle("focused", id === focused);

    // Show/hide address bar vs. webview.
    bar.classList.toggle("hidden", !leaf.showBar);
    webview.classList.toggle("hidden", leaf.showBar);

    // Electron webviews require explicit pixel dimensions on the element itself;
    // CSS inset/percentage alone does not resize the internal guest surface.
    webview.style.width = w + "px";
    webview.style.height = h + "px";

    // Set webview src exactly once; after that the webview navigates freely
    // and getAttribute('src') reflects the live URL, so we must not touch it.
    if (leaf.url && !t.srcInitialized) {
      t.webview.setAttribute("src", leaf.url);
      t.srcInitialized = true;
    }
  }

  // Focus the address input of the currently focused tile if bar is showing.
  const ft = tileMap.get(focused);
  if (ft) {
    const lf = findLeaf(tree, focused);
    if (lf?.showBar) ft.input.focus();
  }
}

// ── Shortcut handling ────────────────────────────────────────────────────────

window.tilebrow.onShortcut((action) => {
  switch (action) {
    case "split-right":
      splitFocused("vsplit");
      render();
      break;
    case "split-below":
      splitFocused("hsplit");
      render();
      break;
    case "close-tile":
      closeFocused();
      render();
      break;

    case "focus-left":
      moveFocus("left");
      applyFocusClasses();
      break;
    case "focus-right":
      moveFocus("right");
      applyFocusClasses();
      break;
    case "focus-up":
      moveFocus("up");
      applyFocusClasses();
      break;
    case "focus-down":
      moveFocus("down");
      applyFocusClasses();
      break;

    case "back":
      tileMap.get(focused)?.webview.goBack();
      break;
    case "forward":
      tileMap.get(focused)?.webview.goForward();
      break;
    case "reload":
      tileMap.get(focused)?.webview.reload();
      break;

    case "grow":
      resizeFocused(true);
      render();
      break;
    case "shrink":
      resizeFocused(false);
      render();
      break;
  }
});

// ── Boot ─────────────────────────────────────────────────────────────────────

window.addEventListener("resize", render);
render();
