const { app, BrowserWindow, ipcMain, nativeImage, shell } = require('electron')
const electronRemote = require('@electron/remote/main')
const path = require('path-extra')
const fs = require('fs-extra')

// Environment
global.POI_VERSION = app.getVersion()
global.ROOT = __dirname
global.EXECROOT = path.join(process.execPath, '..')
global.APPDATA_PATH = path.join(app.getPath('appData'), 'poi')
global.EXROOT = global.APPDATA_PATH
global.DEFAULT_CACHE_PATH = path.join(global.EXROOT, 'MyCache')
global.DEFAULT_SCREENSHOT_PATH =
  process.platform === 'darwin'
    ? path.join(app.getPath('home'), 'Pictures', 'Poi')
    : path.join(global.APPDATA_PATH, 'screenshots')
global.MODULE_PATH = path.join(global.ROOT, 'node_modules')

const { ROOT } = global
const poiIconPath = path.join(
  ROOT,
  'assets',
  'icons',
  process.platform === 'linux' ? 'poi_32x32.png' : 'poi.ico',
)

electronRemote.initialize()

require('./lib/proxy')
require('./lib/module-path').setAllowedPath(global.ROOT)
const config = require('./lib/config')
const shortcut = require('./lib/shortcut')
const { warn, error } = require('./lib/utils')
const dbg = require('./lib/debug')
require('./lib/updater')
require('./lib/tray')
require('./lib/screenshot')
require('./lib/native-theme-helper')

// Disable HA
if (config.get('poi.misc.disablehwaccel', false)) {
  app.commandLine.appendSwitch('disable-software-rasterizer')
  app.disableHardwareAcceleration()
}

// check safe mode config
if (config.get('poi.misc.safemode', false)) {
  warn('Entering SAFE MODE according to config.')
  global.isSafeMode = true
  config.set('poi.misc.safemode')
}

// Add shortcut to start menu when os is windows
app.setAppUserModelId('org.poooi.poi')
if (process.platform === 'win32' && config.get('poi.misc.shortcut', true)) {
  const shortcutPath =
    app.getPath('appData') + '\\Microsoft\\Windows\\Start Menu\\Programs\\poi.lnk'
  const targetPath = app.getPath('exe')
  const argPath = app.getAppPath()
  const cwdPath = process.cwd().startsWith(app.getPath('appData'))
    ? ROOT.endsWith('.asar')
      ? path.dirname(targetPath)
      : ROOT
    : process.cwd()
  const option = {
    target: targetPath,
    args: argPath,
    cwd: cwdPath,
    appUserModelId: 'org.poooi.poi',
    description: 'poi the KanColle Browser Tool',
  }
  if (!ROOT.endsWith('.asar')) {
    Object.assign(option, {
      icon: path.join(ROOT, 'assets', 'icons', 'poi.ico'),
      iconIndex: 0,
    })
  }
  shell.writeShortcutLink(shortcutPath, option)
  const safeModeShortcutPath =
    app.getPath('appData') + '\\Microsoft\\Windows\\Start Menu\\Programs\\poi (safe mode).lnk'
  const safeModeOption = {
    ...option,
    description: 'poi the KanColle Browser Tool (safe mode)',
    args: `${argPath} --safe`,
    appUserModelId: 'org.poooi.poi.safe',
  }
  shell.writeShortcutLink(safeModeShortcutPath, safeModeOption)
}

if (dbg.isEnabled()) {
  global.SERVER_HOSTNAME = '127.0.0.1:17027'
} else {
  global.SERVER_HOSTNAME = 'api.poi.moe'
  process.env.NODE_ENV = 'production'
  if (config.get('poi.misc.exceptionReporting')) {
    const { init } = require('./lib/sentry')
    init({
      build: global.LATEST_COMMIT,
      paths: [global.ROOT, global.APPDATA_PATH],
    })
  }
}

let mainWindow
global.mainWindow = mainWindow = null

// enable audio autoplay
// https://github.com/electron/electron/issues/13525#issuecomment-410923391
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// Polyfill for webview iframe isolation
app.commandLine.appendSwitch('disable-site-isolation-trials')

app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
;(() => {
  /*
    Configure extra command flags.

    If APPDATA_PATH/hack/argv.json can be loaded successfully,
    add extra command line flags as specified by it:

    the loaded JSON object consists of two attributes:

    - "mode": only allowed value is "append"

    - "flags": must be an Array. elements are either:

      + plain string, in which case `appendSwitch(_)` is called
      + an Array consists of two strings, in which case `appendSwitch(_, _)` is called

    this could be useful to fine-tune some GPU settings, example content:

    {
      "mode": "append",
      "flags": [
        "ignore-gpu-blocklist",
        ["use-gl", "desktop"],
        ["gpu-testing-vendor-id", "0x1234"],
        ["gpu-testing-device-id", "0x5678"]
      ]
    }

    Note that this is intentionally not part of poi.config,
    as otherwise main program might not able to recover on its own
    should any of the command flags misconfigured.

   */
  const argvPath = path.join(global.APPDATA_PATH, 'hack', 'argv.json')
  try {
    const cfg = fs.readJsonSync(argvPath)
    if (cfg.mode !== 'append') {
      throw new Error('Only "append" mode is supported')
    }
    if (!Array.isArray(cfg.flags)) {
      throw new Error('No flags specified')
    }
    cfg.flags.forEach((flag) => {
      if (typeof flag === 'string') {
        app.commandLine.appendSwitch(flag)
      } else if (
        Array.isArray(flag) &&
        flag.length === 2 &&
        flag.every((x) => typeof x === 'string')
      ) {
        const [k, v] = flag
        app.commandLine.appendSwitch(k, v)
      } else {
        warn('Ignoring unrecognized flag: ', flag)
      }
    })
    console.info(`Config ${argvPath} loaded successfully.`)
  } catch (e) {
    if (e.code !== 'ENOENT') {
      error(`Error while attempting to load ${argvPath}`, e)
    }
  }
})()

// Cache size
const cacheSize = parseInt(config.get('poi.misc.cache.size'))
if (Number.isInteger(cacheSize)) {
  app.commandLine.appendSwitch('disk-cache-size', `${1048576 * cacheSize}`)
}

app.on('window-all-closed', () => {
  shortcut.unregister()
  app.quit()
})

// Single instance
const getLock = app.requestSingleInstanceLock()

if (!getLock) {
  error('Another instance is running, exiting')
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
    }
  })
}

app.on('ready', () => {
  require('electron-react-titlebar/main').initialize()
  const { screen } = require('electron')
  shortcut.register()
  const { workArea } = screen.getPrimaryDisplay()
  let { x, y, width, height } = config.get('poi.window', workArea)
  const validate = (n, min, range) => n != null && n >= min && n < min + range
  const withinDisplay = (d) => {
    const wa = d.workArea
    return validate(x, wa.x, wa.width) && validate(y, wa.y, wa.height)
  }
  if (!screen.getAllDisplays().some(withinDisplay)) {
    x = workArea.x
    y = workArea.y
  }
  if (width == null) {
    width = workArea.width
  }
  if (height == null) {
    height = workArea.height
  }
  const hideTitlebar = config.get(
    'poi.appearance.customtitlebar',
    process.platform === 'win32' || process.platform === 'linux',
  )
  global.mainWindow = mainWindow = new BrowserWindow({
    x: x,
    y: y,
    width: width,
    height: height,
    title: 'poi',
    icon: poiIconPath,
    resizable: config.get('poi.content.resizable', true),
    alwaysOnTop: config.get('poi.content.alwaysOnTop', false),
    // FIXME: titlebarStyle and transparent: https://github.com/electron/electron/issues/14129
    titleBarStyle: process.platform === 'darwin' ? null : hideTitlebar ? 'hidden' : null,
    // FIXME: click-through of transparency: https://github.com/electron/electron/issues/1335
    transparent: false,
    frame: !hideTitlebar,
    enableLargerThanScreen: true,
    maximizable: config.get('poi.content.resizable', true),
    fullscreenable: config.get('poi.content.resizable', true),
    webPreferences: {
      plugins: true,
      webviewTag: true,
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      nodeIntegrationInSubFrames: true,
      zoomFactor: config.get('poi.appearance.zoom', 1),
      enableRemoteModule: true,
      contextIsolation: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
    backgroundColor: '#00000000',
    backgroundMaterial: config.get('poi.appearance.vibrant', 0) ? 'acrylic' : 'none',
    roundedCorners: true,
  })

  electronRemote.enable(mainWindow.webContents)
  mainWindow.webContents.addListener('did-attach-webview', (e, webContent) => {
    electronRemote.enable(webContent)
  })

  // Default menu
  if (process.platform === 'darwin') {
    const { renderMainTouchbar } = require('./lib/touchbar')
    renderMainTouchbar()
    if (/electron$/i.test(process.argv[0])) {
      const icon = nativeImage.createFromPath(`${ROOT}/assets/icons/poi.png`)
      app.dock.setIcon(icon)
    }
  } else {
    mainWindow.setMenu(null)
  }
  mainWindow.loadURL(`file://${__dirname}/index.html${dbg.isEnabled() ? '?react_perf' : ''}`)
  if (config.get('poi.window.isMaximized', false)) {
    mainWindow.maximize()
  }
  if (config.get('poi.window.isFullScreen', false)) {
    mainWindow.setFullScreen(true)
  }
  if (dbg.isEnabled()) {
    mainWindow.openDevTools({
      mode: 'detach',
    })
  }
  // Never wants navigate
  mainWindow.webContents.on('will-navigate', (e) => {
    e.preventDefault()
  })
  mainWindow.on('closed', () => {
    // Close all sub window
    require('./lib/window').closeWindows()
    mainWindow = null
  })

  // display config
  const handleScreenStatusChange = () => {
    mainWindow.webContents.send('screen-status-changed', screen.getAllDisplays())
  }
  ipcMain.on('displays::get-all', (e) => {
    e.returnValue = screen.getAllDisplays()
  })
  ipcMain.on('displays::remove-all-listeners', () => {
    screen.removeListener('display-added', handleScreenStatusChange)
    screen.removeListener('display-removed', handleScreenStatusChange)
    screen.removeListener('display-metrics-changed', handleScreenStatusChange)
  })
  screen.addListener('display-added', handleScreenStatusChange)
  screen.addListener('display-removed', handleScreenStatusChange)
  screen.addListener('display-metrics-changed', handleScreenStatusChange)

  // devtool
  if (config.get('poi.devtool.enable', false)) {
    require('./lib/devtool')
  }
})
// http basic auth
app.on('login', (event, webContents, request, authInfo, callback) => {
  event.preventDefault()
  mainWindow.webContents.send('http-basic-auth', 'login')
  ipcMain.once('basic-auth-info', (event, usr, pwd) => {
    callback(usr, pwd)
  })
})

ipcMain.on('refresh-shortcut', () => {
  shortcut.unregister()
  shortcut.register()
})

const { createHash } = require('crypto')
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  const trusted = config.get('poi.misc.trustedCerts', [])
  const hash = createHash('sha256').update(certificate.data).digest('base64')
  if (trusted.includes(hash)) {
    event.preventDefault()
    callback(true)
  }
})

// Uncaught error
process.on('uncaughtException', (e) => {
  error(e.stack)
})
