import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

const CONFIG_PATH = join(homedir(), '.bd-eye.json')

const DEFAULTS = {
  scanRoots: [join(homedir(), 'workspace')],
  lastUsedBoard: null,
  excludePaths: []
}

/** @returns {{ scanRoots: string[], lastUsedBoard: string | null, excludePaths: string[] }} */
export const loadConfig = () => {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
      return { ...DEFAULTS, ...raw }
    }
  } catch { /* invalid json, use defaults */ }
  return { ...DEFAULTS }
}

/** @param {Partial<{ scanRoots: string[], lastUsedBoard: string | null, excludePaths: string[] }>} updates */
export const saveConfig = (updates) => {
  const current = loadConfig()
  const merged = { ...current, ...updates }
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2) + '\n')
  return merged
}
