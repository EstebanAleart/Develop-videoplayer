import { type NextRequest, NextResponse } from "next/server"

const YOUTUBE_API_KEY = "AIzaSyAHqpHnF0ltaDodbnyQM8Up7ibuRVUyn-U"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
  }

  try {
    // Search for videos
    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`,
    )

    if (!searchResponse.ok) {
      throw new Error("Failed to search videos")
    }

    const searchData = await searchResponse.json()
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(",")

    // Get additional video details (duration, view count, etc.)
    const detailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`,
    )

    const detailsData = detailsResponse.ok ? await detailsResponse.json() : { items: [] }

    const videos = searchData.items.map((item: any) => {
      const details = detailsData.items.find((detail: any) => detail.id === item.id.videoId)

      return {
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.medium.url,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        duration: details?.contentDetails?.duration,
        viewCount: details?.statistics?.viewCount,
      }
    })

    return NextResponse.json({ videos })
  } catch (error) {
    console.error("Error searching videos:", error)
    return NextResponse.json({ error: "Failed to search videos" }, { status: 500 })
  }
}
