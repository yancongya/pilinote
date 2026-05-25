import fs from 'node:fs'
import path from 'node:path'

const srcDir = path.resolve(process.cwd(), '../web/dist')
const destDir = path.resolve(process.cwd(), 'web-dist')

if (!fs.existsSync(srcDir)) {
  throw new Error(`Web dist not found: ${srcDir}. Run "pnpm --dir ../web build" first.`)
}

fs.rmSync(destDir, { recursive: true, force: true })
fs.mkdirSync(destDir, { recursive: true })
fs.cpSync(srcDir, destDir, { recursive: true })

console.log(`Copied web build: ${srcDir} -> ${destDir}`)
