import { type NextRequest, NextResponse } from "next/server"
import { Innertube, Platform } from "youtubei.js"

export const runtime = "nodejs"
export const maxDuration = 300

// Provide a JS evaluator required by youtubei.js in Node.js environments
// @ts-ignore
Platform.shim.eval = (data: any, env: Record<string, any>) => {
  const properties: string[] = []
  if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`)
  if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`)
  const code = `${data.output}\nreturn { ${properties.join(", ")} }`
  return new Function(code)()
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const videoId = searchParams.get("videoId")
  const format = searchParams.get("format") || "video" // "audio" | "video"

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 })
  }

  try {
    const yt = await Innertube.create({
      retrieve_player: true,
      generate_session_locally: true,
    })

    const info = await yt.getBasicInfo(videoId)
    const title = (info.basic_info.title ?? videoId).replace(/[^\w\s-]/g, "").trim()

    let contentType: string
    let filename: string

    if (format === "audio") {
      contentType = "audio/mp4"
      filename = `${title}.m4a`
    } else {
      contentType = "video/mp4"
      filename = `${title}.mp4`
    }

    const dl = await yt.download(videoId, {
      type: format === "audio" ? "audio" : "video+audio",
      quality: "best",
    })

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of dl) {
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })

    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    })

    return new Response(stream, { headers })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Download error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
