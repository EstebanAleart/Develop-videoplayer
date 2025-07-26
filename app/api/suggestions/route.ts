import { type NextRequest, NextResponse } from "next/server"

const YOUTUBE_API_KEY = "AIzaSyAHqpHnF0ltaDodbnyQM8Up7ibuRVUyn-U"

// Almacenamiento temporal en memoria (en producción usarías una base de datos)
let suggestions: any[] = []

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}


export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "http://radioweb.manudev.ovh",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// GET - Obtener todas las sugerencias
export async function GET() {
  return NextResponse.json({ suggestions })
}

// POST - Agregar nueva sugerencia de oyente
export async function POST(request: NextRequest) {
  try {
    const { url, listenerName } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    const videoId = url

    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 })
    }

    // Verificar si el video ya fue sugerido
    const existingSuggestion = suggestions.find((s) => s.id === videoId)
    if (existingSuggestion) {
      return NextResponse.json({ error: "Este video ya fue sugerido" }, { status: 400 })
    }

    // Obtener detalles del video desde YouTube API
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`,
    )

    if (!response.ok) {
      throw new Error("Failed to fetch video details")
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    const item = data.items[0]
    const video = {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      duration: item.contentDetails.duration,
      viewCount: item.statistics.viewCount,
      suggestedBy: listenerName || "Oyente Anónimo",
      suggestedAt: new Date().toISOString(),
    }

    // Agregar al inicio del array (más recientes primero)
    suggestions.unshift(video)

    // Limitar a 50 sugerencias máximo
    if (suggestions.length > 50) {
      suggestions = suggestions.slice(0, 50)
    }

    return NextResponse.json({ success: true, video }, {
      headers: {
        "Access-Control-Allow-Origin": "http://radioweb.manudev.ovh",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  } catch (error) {
    console.error("Error processing suggestion:", error)
    return NextResponse.json({ error: "Failed to process suggestion" }, { status: 500,
      headers: {
        "Access-Control-Allow-Origin": "http://radioweb.manudev.ovh",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  }
}

// DELETE - Eliminar una sugerencia (para moderación)
export async function DELETE(request: NextRequest) {
  try {
    const { videoId } = await request.json()

    if (!videoId) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 })
    }

    suggestions = suggestions.filter((s) => s.id !== videoId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting suggestion:", error)
    return NextResponse.json({ error: "Failed to delete suggestion" }, { status: 500 })
  }
}
