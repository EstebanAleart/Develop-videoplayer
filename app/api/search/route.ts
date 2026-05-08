import { type NextRequest, NextResponse } from "next/server"

const API_KEYS = [
  process.env.YOUTUBE_API_KEY,
  process.env.YOUTUBE_API_KEY_BACKUP,
].filter(Boolean) as string[]

async function searchWithKey(key: string, query: string, pageToken?: string | null) {
  let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(query)}&type=video&key=${key}`
  if (pageToken) searchUrl += `&pageToken=${pageToken}`

  const searchResponse = await fetch(searchUrl)
  if (!searchResponse.ok) {
    const body = await searchResponse.text()
    throw new Error(`YouTube API error (${searchResponse.status}): ${body}`)
  }

  const searchData = await searchResponse.json()
  const videoIds = searchData.items.map((item: any) => item.id.videoId).join(",")

  const detailsResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${key}`,
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

  return {
    videos,
    totalResults: searchData.pageInfo?.totalResults || 0,
    resultsPerPage: searchData.pageInfo?.resultsPerPage || 10,
    nextPageToken: searchData.nextPageToken || null,
    prevPageToken: searchData.prevPageToken || null,
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")
  const page = searchParams.get("page") || "1"
  const pageToken = searchParams.get("pageToken")

  if (!query) {
    return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
  }

  let lastError: Error | null = null

  for (const key of API_KEYS) {
    try {
      const result = await searchWithKey(key, query, pageToken)
      return NextResponse.json({ ...result, currentPage: Number.parseInt(page) })
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`API key failed (quota?), trying next...`, lastError.message.slice(0, 100))
    }
  }

  console.error("All API keys exhausted:", lastError?.message)
  return NextResponse.json({ error: "Failed to search videos" }, { status: 500 })
}
