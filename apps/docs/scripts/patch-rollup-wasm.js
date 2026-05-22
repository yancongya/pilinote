import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

// Patch Rollup's native loader to use WASM build in environments where native .node cannot be loaded
// (e.g. code signing / Team ID mismatch when running inside Codex's bundled node).

function findNativeJs(pnpmDir) {
  // Find: node_modules/.pnpm/rollup@*/node_modules/rollup/dist/native.js
  for (const ent of readdirSync(pnpmDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue
    if (!ent.name.startsWith('rollup@')) continue
    const candidate = path.join(pnpmDir, ent.name, 'node_modules/rollup/dist/native.js')
    if (existsSync(candidate)) return candidate
  }
  return null
}

const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm')
if (!existsSync(pnpmDir)) {
  console.log('[patch-rollup-wasm] no node_modules/.pnpm, skip')
  process.exit(0)
}

const nativeJs = findNativeJs(pnpmDir)
if (!nativeJs) {
  console.log('[patch-rollup-wasm] rollup native.js not found, skip')
  process.exit(0)
}

const src = readFileSync(nativeJs, 'utf8')
if (src.includes("require('@rollup/wasm-node')")) {
  console.log('[patch-rollup-wasm] already patched')
  process.exit(0)
}

const patched = src.replace(
  /const \{ parse, parseAsync, xxhashBase64Url, xxhashBase36, xxhashBase16 \} = requireWithFriendlyError\([\s\S]*?\);/m,
  "const { parse, parseAsync, xxhashBase64Url, xxhashBase36, xxhashBase16 } = require('@rollup/wasm-node');"
)

if (patched === src) {
  console.warn('[patch-rollup-wasm] failed to patch expected pattern')
  process.exit(1)
}

writeFileSync(nativeJs, patched, 'utf8')
console.log('[patch-rollup-wasm] patched', nativeJs)
