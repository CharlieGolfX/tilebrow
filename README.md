# tilebrow

A keyboard-driven web browser where every tab is a tiled window — split, resize, and navigate without ever reaching for the mouse.

Built with [Electron](https://www.electronjs.org/).

---

## How it works

Instead of a tab bar, tilebrow tiles tabs across the window the way a tiling window manager (like i3 or dwm) tiles applications. Each tile is an independent browser view. New tiles are created by splitting an existing one — either side-by-side or stacked — and each split can be resized freely.

There is no persistent URL bar. To navigate, open a new tile and type a URL or search query directly into the address bar that appears in it.

---

## Getting started

```sh
npm install
npm start
```

Requires [Node.js](https://nodejs.org/) and npm.

---

## Building & installing

Packaged builds are produced with [electron-builder](https://www.electron.build/).
Install dependencies first, then run the target for your platform.

```sh
npm install
```

### Linux

```sh
npm run build:linux
```

Outputs to `dist/`:

| File | Format |
|---|---|
| `tilebrow-*.AppImage` | Portable — no installation needed, just make it executable and run it |
| `tilebrow-*.deb` | Debian / Ubuntu package |

**AppImage:**
```sh
chmod +x tilebrow-*.AppImage
./tilebrow-*.AppImage
```

**Debian / Ubuntu:**
```sh
sudo dpkg -i tilebrow-*.deb
```

### macOS

```sh
npm run build:mac
```

Outputs `dist/tilebrow-*.dmg`.

1. Open the `.dmg` file.
2. Drag **tilebrow** into your **Applications** folder.
3. Launch it from Applications or Spotlight.

> **Gatekeeper note:** Because the build is unsigned, macOS may block the first launch.
> Right-click the app in Finder and choose **Open**, then confirm in the dialog.

### Windows

```sh
npm run build:win
```

Outputs `dist/tilebrow-*-Setup.exe` (NSIS installer).

1. Run the installer.
2. Follow the setup wizard — tilebrow will be added to the Start menu.
3. Launch from the Start menu or the desktop shortcut.

> **SmartScreen note:** Because the build is unsigned, Windows may show a SmartScreen
> warning. Click **More info → Run anyway** to proceed.

---

## Keyboard shortcuts

All shortcuts use the `Ctrl+Alt` prefix to avoid conflicts with website shortcuts (`Ctrl+T`, `Ctrl+L`, …) and OS shortcuts (`Cmd+…` on macOS).

### Tiles

| Shortcut | Action |
|---|---|
| `Ctrl+Alt+N` | Split focused tile — new tile to the right |
| `Ctrl+Alt+Shift+N` | Split focused tile — new tile below |
| `Ctrl+Alt+W` | Close focused tile |
| `Ctrl+Alt+.` | Grow focused tile (adjusts the split ratio) |
| `Ctrl+Alt+,` | Shrink focused tile |

### Focus

| Shortcut | Action |
|---|---|
| `Ctrl+Alt+H` | Focus tile to the left |
| `Ctrl+Alt+L` | Focus tile to the right |
| `Ctrl+Alt+K` | Focus tile above |
| `Ctrl+Alt+J` | Focus tile below |

### Navigation

| Shortcut | Action |
|---|---|
| `Ctrl+Alt+R` | Reload |
| `Ctrl+Alt+←` | Go back |
| `Ctrl+Alt+→` | Go forward |

### Window

| Shortcut | Action |
|---|---|
| `F11` | Toggle fullscreen |
| `Ctrl+Alt+Q` | Quit |

---

## Navigating to a URL

1. Press `Ctrl+Alt+N` to open a new tile.
2. Type a URL (e.g. `github.com`) or a search query.
3. Press `Enter`.

- Bare hostnames automatically get `https://` prepended.
- Anything that isn't a hostname is sent to Google as a search.
- Press `Escape` in an empty tile to close it without navigating.

---

## Layout model

Tiles are arranged as a [binary space partition](https://en.wikipedia.org/wiki/Binary_space_partitioning) tree. Every split produces two children and a ratio (defaulting to 50/50). Grow/shrink adjusts the ratio of the nearest parent split by 5% per keypress.

```
┌─────────────────────────┐
│                         │
│          A              │   Single tile — the initial state.
│                         │
└─────────────────────────┘

  Ctrl+Alt+N  →

┌────────────┬────────────┐
│            │            │
│     A      │     B      │   vsplit(A, B, ratio=0.5)
│            │            │
└────────────┴────────────┘

  Ctrl+Alt+Shift+N on B  →

┌────────────┬────────────┐
│            │     B      │   vsplit(A, hsplit(B, C))
│     A      ├────────────┤
│            │     C      │
└────────────┴────────────┘
```
