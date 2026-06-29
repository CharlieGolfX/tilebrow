const { app, BrowserWindow, Menu, session } = require("electron");
const path = require("path");

let mainWindow;

// ── Shortcut handler ─────────────────────────────────────────────────────────

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

// Register handleShortcut on every WebContents as it is created — this covers
// the main window frame, and every webview guest (including ones created by
// mid-navigation process switches that would invalidate a did-attach ID).
app.on("web-contents-created", (_, wc) => {
  wc.on("before-input-event", handleShortcut);
});

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
