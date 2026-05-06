// Token storage: env var YOUTUBE_TOKENS en Vercel, archivo local en dev
const isVercel = !!process.env.VERCEL

export async function saveTokens(tokens: object): Promise<void> {
  if (isVercel) {
    // En Vercel el filesystem es efímero — no se puede persistir.
    // Los tokens se ponen manualmente como env var YOUTUBE_TOKENS en el dashboard.
    return
  }
  const { writeFileSync } = await import("fs")
  const { join } = await import("path")
  writeFileSync(join(process.cwd(), ".youtube-tokens.json"), JSON.stringify(tokens, null, 2))
}

export async function loadTokens(): Promise<object | null> {
  if (isVercel) {
    const raw = process.env.YOUTUBE_TOKENS
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  }
  const { existsSync, readFileSync } = await import("fs")
  const { join } = await import("path")
  const path = join(process.cwd(), ".youtube-tokens.json")
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, "utf-8")) } catch { return null }
}
