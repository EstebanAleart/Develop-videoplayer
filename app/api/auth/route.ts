import { NextResponse } from "next/server"
import { Innertube } from "youtubei.js"
import { Platform } from "youtubei.js"
import { saveTokens, loadTokens } from "@/lib/youtube-tokens"

export const runtime = "nodejs"
export const maxDuration = 300

// @ts-ignore
Platform.shim.eval = (data: any, env: Record<string, any>) => {
  const properties: string[] = []
  if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`)
  if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`)
  const code = `${data.output}\nreturn { ${properties.join(", ")} }`
  return new Function(code)()
}

// GET /api/auth → devuelve device code para ingresar en google.com/device
export async function GET() {
  const tokens = await loadTokens()
  if (tokens) {
    return NextResponse.json({
      status: "already_authenticated",
      message: "Ya hay tokens guardados. Borra .youtube-tokens.json para re-autenticar.",
    })
  }

  const yt = await Innertube.create({ retrieve_player: false })

  // getDeviceAndUserCode() requiere client_id seteado — lo obtenemos primero
  const clientId = await yt.session.oauth.getClientID()
  // @ts-ignore — client_id es public en JS aunque no esté en el .d.ts
  yt.session.oauth.client_id = clientId

  const deviceAndUserCode = await yt.session.oauth.getDeviceAndUserCode()

  return NextResponse.json({
    status: "pending",
    user_code: deviceAndUserCode.user_code,
    verification_url: deviceAndUserCode.verification_url,
    device_code: deviceAndUserCode.device_code,
    expires_in: deviceAndUserCode.expires_in,
    interval: deviceAndUserCode.interval,
    // Incluimos client para que el POST no tenga que volver a buscarlo
    client: clientId,
    message: `Ingresa el codigo "${deviceAndUserCode.user_code}" en ${deviceAndUserCode.verification_url} y luego llama a POST /api/auth con el body JSON completo.`,
  })
}

// POST /api/auth — body JSON con el objeto devuelto por GET
// Hace polling hasta que el usuario autorice en google.com/device
export async function POST(request: Request) {
  let body: any

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Body debe ser JSON con: device_code, user_code, verification_url, expires_in, interval, client" },
      { status: 400 }
    )
  }

  if (!body?.device_code) {
    return NextResponse.json({ error: "device_code es requerido en el body" }, { status: 400 })
  }

  const yt = await Innertube.create({ retrieve_player: false })

  // Reusar el client_id del GET, o buscarlo de nuevo si no viene
  const clientId = body.client ?? (await yt.session.oauth.getClientID())
  // @ts-ignore
  yt.session.oauth.client_id = clientId

  try {
    const credentials = await new Promise<any>((resolve, reject) => {
      yt.session.on("auth", ({ credentials }: { credentials: any }) => resolve(credentials))
      yt.session.on("auth-error", (err: any) => reject(err instanceof Error ? err : new Error(String(err))))
      yt.session.oauth.pollForAccessToken({
        device_code: body.device_code,
        user_code: body.user_code,
        verification_url: body.verification_url,
        expires_in: body.expires_in,
        interval: body.interval,
      })
    })

    await saveTokens(credentials)
    return NextResponse.json({ status: "success", message: "Tokens guardados. Ya podes descargar videos con tu cuenta." })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
