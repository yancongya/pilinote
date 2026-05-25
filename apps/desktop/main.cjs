const { app, BrowserWindow } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const API_HOST = process.env.PILINOTE_API_HOST || '127.0.0.1'
const API_PORT = Number(process.env.PILINOTE_API_PORT || 8000)
const API_BASE_URL = `http://${API_HOST}:${API_PORT}`
const WS_BASE_URL = `ws://${API_HOST}:${API_PORT}`
const DEV_SERVER_URL = process.env.PILINOTE_DESKTOP_DEV_SERVER

let backendProcess = null

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true })
  return dirPath
}

const getRuntimePaths = () => {
  const runtimeRoot = ensureDir(app.getPath('userData'))
  return {
    runtimeRoot,
    dataDir: ensureDir(path.join(runtimeRoot, 'data')),
    logDir: ensureDir(path.join(runtimeRoot, 'logs')),
    tempDir: ensureDir(path.join(runtimeRoot, 'temp')),
    downloadsDir: ensureDir(path.join(runtimeRoot, 'downloads')),
    dbPath: path.join(runtimeRoot, 'data', 'pilinote.db')
  }
}

const migrateLegacyDatabaseIfNeeded = (runtimePaths) => {
  if (fs.existsSync(runtimePaths.dbPath)) {
    return
  }

  const manualLegacyDb = process.env.PILINOTE_LEGACY_DB_PATH
  const repoLegacyDb = path.resolve(__dirname, '../api/data/pilinote.db')
  const legacyCandidates = [manualLegacyDb, repoLegacyDb].filter(Boolean)
  const legacyDb = legacyCandidates.find((candidate) => fs.existsSync(candidate))

  if (!legacyDb) {
    return
  }

  fs.copyFileSync(legacyDb, runtimePaths.dbPath)
  fs.copyFileSync(runtimePaths.dbPath, `${runtimePaths.dbPath}.bak`)
}

const getPackagedBackendBinary = () => {
  if (process.env.PILINOTE_API_BINARY) {
    return process.env.PILINOTE_API_BINARY
  }

  const platform = process.platform
  if (platform === 'darwin') {
    return path.join(process.resourcesPath, 'backend', 'mac', 'pilinote-api-macos')
  }
  if (platform === 'win32') {
    return path.join(process.resourcesPath, 'backend', 'win', 'pilinote-api.exe')
  }
  return path.join(process.resourcesPath, 'backend', 'linux', 'pilinote-api')
}

const waitForApiReady = async (timeoutMs = 30000) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${API_BASE_URL}/health`)
      if (response.ok) {
        return
      }
    } catch (_err) {
      // Ignore and retry.
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error('Timed out waiting for backend health endpoint')
}

const startBackend = async () => {
  if (DEV_SERVER_URL || process.env.PILINOTE_SKIP_BACKEND === '1') {
    return
  }

  const runtimePaths = getRuntimePaths()
  migrateLegacyDatabaseIfNeeded(runtimePaths)

  const apiBinary = getPackagedBackendBinary()
  if (!fs.existsSync(apiBinary)) {
    throw new Error(`Backend binary not found: ${apiBinary}`)
  }

  const env = {
    ...process.env,
    DEBUG: process.env.DEBUG || '0',
    PILINOTE_RUNTIME_DIR: runtimePaths.runtimeRoot,
    PILINOTE_LOG_DIR: runtimePaths.logDir,
    PILINOTE_DOWNLOAD_PATH: runtimePaths.downloadsDir,
    PILINOTE_TEMP_PATH: runtimePaths.tempDir,
    DATABASE_URL: `sqlite:///${runtimePaths.dbPath}`,
    HOST: API_HOST,
    PORT: String(API_PORT)
  }

  backendProcess = spawn(apiBinary, [], {
    cwd: runtimePaths.runtimeRoot,
    env,
    stdio: 'pipe'
  })

  backendProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(`[api] ${chunk}`)
  })
  backendProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(`[api] ${chunk}`)
  })

  backendProcess.on('exit', (code, signal) => {
    if (!app.isQuitting) {
      console.error(`[api] exited unexpectedly code=${code} signal=${signal}`)
    }
    backendProcess = null
  })
}

const stopBackend = () => {
  if (!backendProcess) {
    return
  }
  backendProcess.kill('SIGTERM')
  backendProcess = null
}

const createMainWindow = async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      additionalArguments: [
        `--pilinote-api-base-url=${API_BASE_URL}`,
        `--pilinote-ws-base-url=${WS_BASE_URL}`
      ]
    }
  })

  if (DEV_SERVER_URL) {
    await win.loadURL(DEV_SERVER_URL)
  } else {
    await win.loadFile(path.join(__dirname, 'web-dist', 'index.html'))
  }

  win.once('ready-to-show', () => win.show())
}

app.on('before-quit', () => {
  app.isQuitting = true
  stopBackend()
})

app.whenReady().then(async () => {
  await startBackend()
  if (!DEV_SERVER_URL) {
    await waitForApiReady()
  }
  await createMainWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
