import { execFileSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const OSXPHOTOS_CANDIDATES = [
  join(homedir(), '.local/bin/osxphotos'),
  '/opt/homebrew/bin/osxphotos',
  '/usr/local/bin/osxphotos',
]

const EXIFTOOL_CANDIDATES = [
  '/opt/homebrew/bin/exiftool',
  '/usr/local/bin/exiftool',
]

function probe(bin, args) {
  try {
    const out = execFileSync(bin, args, { timeout: 5000, encoding: 'utf8' })
    return out.trim()
  } catch {
    return null
  }
}

function findPipxPython() {
  const cfgPath = join(homedir(), '.local/pipx/venvs/osxphotos/pyvenv.cfg')
  if (!existsSync(cfgPath)) return null
  const cfg = readFileSync(cfgPath, 'utf8')
  // pyvenv.cfg has "home = /path/to/python/bin"
  const homeMatch = cfg.match(/^home\s*=\s*(.+)$/m)
  if (!homeMatch) return null
  const pythonDir = homeMatch[1].trim()
  // The executable is "python" in the venv bin directory, not the home dir
  const venvBin = join(homedir(), '.local/pipx/venvs/osxphotos/bin')
  for (const name of ['python', 'python3']) {
    const candidate = join(venvBin, name)
    if (existsSync(candidate)) return candidate
  }
  return null
}

export async function pathProbe() {
  const result = {
    osxphotos: { path: null, version: null, ok: false, error: null },
    python: { path: null, version: null, ok: false, error: null },
    exiftool: { path: null, version: null, ok: false, error: null },
  }

  // osxphotos
  for (const candidate of OSXPHOTOS_CANDIDATES) {
    if (!existsSync(candidate)) continue
    const out = probe(candidate, ['--version'])
    if (out) {
      const match = out.match(/version\s+([\d.]+)/i)
      result.osxphotos = { path: candidate, version: match?.[1] ?? out, ok: true, error: null }
      break
    }
  }
  if (!result.osxphotos.ok) {
    result.osxphotos.error = 'osxphotos not found. Install with: pipx install osxphotos'
  }

  // Python (prefer pipx venv — has osxphotos on sys.path)
  const pipxPython = findPipxPython()
  const pythonCandidates = pipxPython ? [pipxPython] : []

  for (const candidate of pythonCandidates) {
    if (!existsSync(candidate)) continue
    const out = probe(candidate, ['-c', 'import osxphotos; print(osxphotos.__version__)'])
    if (out) {
      const ver = probe(candidate, ['--version'])
      result.python = { path: candidate, version: ver, ok: true, error: null }
      break
    }
  }
  if (!result.python.ok) {
    result.python.error = 'Python with osxphotos not found. Try: pipx reinstall osxphotos'
  }

  // exiftool
  for (const candidate of EXIFTOOL_CANDIDATES) {
    if (!existsSync(candidate)) continue
    const out = probe(candidate, ['-ver'])
    if (out) {
      result.exiftool = { path: candidate, version: out, ok: true, error: null }
      break
    }
  }
  if (!result.exiftool.ok) {
    result.exiftool.error = 'exiftool not found. Install with: brew install exiftool'
  }

  return result
}

export function defaultPaths() {
  const osxphotos = OSXPHOTOS_CANDIDATES.find(existsSync) ?? ''
  const python = findPipxPython() ?? ''
  const exiftool = EXIFTOOL_CANDIDATES.find(existsSync) ?? ''
  const photosLibrary = join(homedir(), 'Pictures/Photos Library.photoslibrary')
  return { osxphotos, python, exiftool, photosLibrary }
}
