const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  session,
  webContents: allWebContents,
} = require("electron");
const path = require("path");

let mainWindow;

// ── Shortcut handler ─────────────────────────────────────────────────────────
// Registered on the main webContents AND on every webview's guest webContents
// so shortcuts fire regardless of which frame has keyboard focus.
// Uses before-input-event instead of globalShortcut:
//   • works on Wayland (no global keyboard grab required)
//   • not stolen from other apps when tilebrow is in the background
//   • input.code is layout-independent (physical key position)

function handleShortcut(event, input) {
  if (input.type !== "keyDown") return;

  const { control: ctrl, alt, shift, code } = input;

  // F11 – toggle fullscreen, no extra modifiers.
  if (code === "F11" && !ctrl && !alt && !shift) {
    mainWindow?.setFullScreen(!mainWindow.isFullScreen());
    event.preventDefault();
    return;
  }

  if (!ctrl || !alt) return;

  let action = null;

  if (!shift) {
    switch (code) {
      case "KeyN":
        action = "split-right";
        break;
      case "KeyW":
        action = "close-tile";
        break;
      case "KeyH":
        action = "focus-left";
        break;
      case "KeyL":
        action = "focus-right";
        break;
      case "KeyJ":
        action = "focus-down";
        break;
      case "KeyK":
        action = "focus-up";
        break;
      case "ArrowLeft":
        action = "back";
        break;
      case "ArrowRight":
        action = "forward";
        break;
      case "KeyR":
        action = "reload";
        break;
      case "Period":
        action = "grow";
        break;
      case "Comma":
        action = "shrink";
        break;
      case "KeyQ":
        event.preventDefault();
        app.quit();
        return;
    }
  } else {
    if (code === "KeyN") action = "split-below";
  }

  if (action) {
    event.preventDefault();
    mainWindow?.webContents.send("shortcut", action);
  }
}

// ── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  // Intercept keys while the main frame (address bar, etc.) has focus.
  mainWindow.webContents.on("before-input-event", handleShortcut);

  // Minimal menu so Cmd+Q keeps working on macOS.
  if (process.platform === "darwin") {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: app.name,
          submenu: [
            {
              label: "Quit",
              accelerator: "CmdOrCtrl+Q",
              click: () => app.quit(),
            },
          ],
        },
      ]),
    );
  } else {
    Menu.setApplicationMenu(null);
  }
}

// When a webview is attached in the renderer it sends its guest webContentsId.
// We register the same shortcut handler there so keys fire while browsing.
ipcMain.on("register-webview", (_, wcId) => {
  const wc = allWebContents.fromId(wcId);
  if (wc) wc.on("before-input-event", handleShortcut);
});

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Make webviews identify as Chrome so sites don't block them.
  const ua =
    "Mozilla/5.0 (X11; Linux x86_64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/120.0.0.0 Safari/537.36";
  session.fromPartition("persist:default").setUserAgent(ua);

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
