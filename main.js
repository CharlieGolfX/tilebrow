const {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  session,
} = require("electron");
const path = require("path");

let mainWindow;

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

  // Minimal menu so Cmd+Q still works on macOS; hidden on all other platforms.
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

  // Shortcut → IPC action mapping.
  // Ctrl+Alt prefix avoids conflicts with common browser (Ctrl+T/W/L…) and
  // macOS (Cmd+…) shortcuts. globalShortcut ensures they fire even when a
  // webview inside the window has keyboard focus.
  const shortcuts = [
    ["Ctrl+Alt+N", "split-right"],
    ["Ctrl+Alt+Shift+N", "split-below"],
    ["Ctrl+Alt+W", "close-tile"],
    ["Ctrl+Alt+H", "focus-left"],
    ["Ctrl+Alt+L", "focus-right"],
    ["Ctrl+Alt+J", "focus-down"],
    ["Ctrl+Alt+K", "focus-up"],
    ["Ctrl+Alt+Left", "back"],
    ["Ctrl+Alt+Right", "forward"],
    ["Ctrl+Alt+R", "reload"],
    ["Ctrl+Alt+.", "grow"],
    ["Ctrl+Alt+,", "shrink"],
    ["Ctrl+Alt+Q", "quit"],
    ["F11", "toggle-fullscreen"],
  ];

  shortcuts.forEach(([key, action]) => {
    const ok = globalShortcut.register(key, () => {
      if (action === "quit") {
        app.quit();
        return;
      }
      if (action === "toggle-fullscreen") {
        mainWindow?.setFullScreen(!mainWindow.isFullScreen());
        return;
      }
      mainWindow?.webContents.send("shortcut", action);
    });
    if (!ok) console.warn(`[tilebrow] Could not register shortcut: ${key}`);
  });
}

app.whenReady().then(() => {
  // Make webviews identify as Chrome so sites don't block them.
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/120.0.0.0 Safari/537.36";
  session.fromPartition("persist:default").setUserAgent(ua);

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
