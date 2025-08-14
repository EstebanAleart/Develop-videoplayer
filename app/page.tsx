"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Search, Play, XCircle, SkipForward, SkipBack, Eye, PlusCircle } from "lucide-react"
import dynamic from "next/dynamic"
import { useCallback } from "react"

interface Video {
  id: string
  title: string
  description: string
  thumbnail: string
  channelTitle: string
  publishedAt: string
  duration?: string
  viewCount?: string
  suggestedBy?: string
}

export default function VideoPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [videos, setVideos] = useState<Video[]>([])
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(false)
  const [playlist, setPlaylist] = useState<Video[]>([])
  const [suggestions, setSuggestions] = useState<Video[]>([]) // Mantener para compatibilidad
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState<number>(-1) // -1 means no playlist item is currently playing
  const [autoPlayTimer, setAutoPlayTimer] = useState<NodeJS.Timeout | null>(null)

  // Function to play the next video in the playlist
  const playNextVideo = useCallback(() => {
    if (playlist.length === 0) return null

    let nextIndex = currentPlaylistIndex + 1

    // If we've reached the end of the playlist, loop back to the start
    if (nextIndex >= playlist.length) {
      nextIndex = 0
    }

    const nextVideo = playlist[nextIndex]
    if (nextVideo) {
      setCurrentVideo(nextVideo)
      setCurrentPlaylistIndex(nextIndex)
      return nextVideo
    }
    return null
  }, [currentPlaylistIndex, playlist])

  const searchVideos = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setVideos(data.videos || [])
    } catch (error) {
      console.error("Error searching videos:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadSuggestions = async () => {
    try {
      const response = await fetch("/api/suggestions")
      const data = await response.json()
      setSuggestions(data.suggestions || [])
    } catch (error) {
      console.error("Error loading suggestions:", error)
    }
  }

  // Función para cargar sugerencias
  // Importar dinámicamente el componente de sugerencias para deshabilitar el SSR
  const SuggestionsList = dynamic<{}>(
    () => import("./components/suggestions-list").then((mod) => mod.SuggestionsList),
    {
      ssr: false,
      loading: () => <div className="text-center py-4">Cargando sugerencias...</div>,
    },
  )

  // Auto-play logic: prioritize playlist
  useEffect(() => {
    if (!currentVideo && playlist.length > 0) {
      setCurrentVideo(playlist[0])
      setCurrentPlaylistIndex(0)
    }
  }, [currentVideo, playlist])

  // Set up auto-play timer when currentVideo changes
  useEffect(() => {
    if (!currentVideo?.duration) return

    // Parse duration in ISO 8601 format (e.g., 'PT1H2M3S')
    const parseDuration = (duration: string): number => {
      const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
      if (!match) return 0

      const hours = Number.parseInt(match[1]) || 0
      const minutes = Number.parseInt(match[2]) || 0
      const seconds = Number.parseInt(match[3]) || 0

      return (hours * 3600 + minutes * 60 + seconds) * 1000 // Convert to milliseconds
    }

    // Only set timer if we're playing from a playlist
    if (currentPlaylistIndex !== -1 && playlist.length > 0) {
      const durationMs = parseDuration(currentVideo.duration)

      if (durationMs > 0) {
        // Set a timeout to play the next video when the current one ends
        const timer = setTimeout(() => {
          playNextVideo()
        }, durationMs)

        setAutoPlayTimer(timer)
      }
    }

    // Clean up timer on unmount or when video changes
    return () => {
      if (autoPlayTimer) {
        clearTimeout(autoPlayTimer)
      }
    }
  }, [currentVideo, currentPlaylistIndex, playlist, playNextVideo])

  // Play video function

  const playVideo = (video: Video, isFromPlaylist = false, index = -1) => {
    // Clear any existing auto-play timer
    if (autoPlayTimer) {
      clearTimeout(autoPlayTimer)
      setAutoPlayTimer(null)
    }

    setCurrentVideo(video)
    if (isFromPlaylist) {
      setCurrentPlaylistIndex(index)
    } else {
      setCurrentPlaylistIndex(-1) // Not playing from playlist
    }
  }

  const handleAddToPlaylist = (video: Video) => {
    // Check if video already exists in playlist to avoid duplicates
    if (!playlist.some((item) => item.id === video.id)) {
      setPlaylist((prev) => [...prev, video])
    }
  }

  const handleRemoveFromPlaylist = (videoId: string) => {
    setPlaylist((prev) => prev.filter((video) => video.id !== videoId))
    // If the removed video was the current one, or if the playlist becomes empty, reset current video
    if (currentVideo?.id === videoId || playlist.length === 1) {
      // If it was the only one or the current one
      setCurrentVideo(null)
      setCurrentPlaylistIndex(-1)
    } else if (currentPlaylistIndex !== -1 && playlist[currentPlaylistIndex]?.id === videoId) {
      // If the removed video was the current one in the playlist, try to play next or previous
      if (currentPlaylistIndex < playlist.length - 1) {
        setCurrentVideo(playlist[currentPlaylistIndex + 1])
      } else if (currentPlaylistIndex > 0) {
        setCurrentVideo(playlist[currentPlaylistIndex - 1])
        setCurrentPlaylistIndex(currentPlaylistIndex - 1) // Adjust index if playing previous
      } else {
        setCurrentVideo(null)
        setCurrentPlaylistIndex(-1)
      }
    }
  }

  const handlePlayNextInPlaylist = useCallback(() => {
    if (playlist.length === 0) return

    let nextIndex = currentPlaylistIndex + 1
    if (nextIndex >= playlist.length) {
      nextIndex = 0
    }
    setCurrentVideo(playlist[nextIndex])
    setCurrentPlaylistIndex(nextIndex)
  }, [playlist, currentPlaylistIndex]) // Removed isLoopEnabled dependency

  const handlePlayPreviousInPlaylist = useCallback(() => {
    if (playlist.length === 0) return

    let prevIndex = currentPlaylistIndex - 1
    if (prevIndex < 0) {
      prevIndex = playlist.length - 1 // Loop to end
    }
    setCurrentVideo(playlist[prevIndex])
    setCurrentPlaylistIndex(prevIndex)
  }, [playlist, currentPlaylistIndex])

  const formatDuration = (duration: string) => {
    if (!duration) return ""
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
    if (!match) return ""

    const hours = match[1] ? Number.parseInt(match[1]) : 0
    const minutes = match[2] ? Number.parseInt(match[2]) : 0
    const seconds = match[3] ? Number.parseInt(match[3]) : 0

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const formatViewCount = (count: string) => {
    if (!count) return ""
    const num = Number.parseInt(count)
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M views`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K views`
    }
    return `${num} views`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Radio Video Player</h1>
          <p className="text-gray-300">Busca y reproduce videos de YouTube</p>
        </div>

        {/* Search Section */}
        <Card className="mb-8 bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Buscar Videos</CardTitle>
            <CardDescription className="text-gray-300">Encuentra videos en YouTube</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                onKeyPress={(e) => e.key === "Enter" && searchVideos()}
              />
              <Button
                onClick={searchVideos}
                disabled={loading}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <Search className="w-4 h-4 mr-2" />
                {loading ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-0">
                {currentVideo ? (
                  <div className="aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${currentVideo.id}?autoplay=1`}
                      title={currentVideo.title}
                      className="w-full h-full rounded-t-lg"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      onLoad={() => {
                        // Add event listener for video end
                        const iframe = document.querySelector("iframe")
                        if (iframe) {
                          iframe.addEventListener("ended", () => {
                            if (currentPlaylistIndex !== -1 && playlist.length > 0) {
                              handlePlayNextInPlaylist()
                            }
                          })
                        }
                      }}
                    />
                    <div className="p-4">
                      <h2 className="text-xl font-bold text-white mb-2">{currentVideo.title}</h2>
                      <p className="text-gray-300 text-sm mb-2">{currentVideo.channelTitle}</p>
                      <p className="text-gray-400 text-sm line-clamp-3">{currentVideo.description}</p>
                      <div className="flex gap-3 mt-4">
                        <Button
                          onClick={handlePlayPreviousInPlaylist}
                          disabled={playlist.length === 0}
                          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                        >
                          <SkipBack className="w-4 h-4" />
                          Anterior
                        </Button>
                        <Button
                          onClick={handlePlayNextInPlaylist}
                          disabled={playlist.length === 0}
                          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                        >
                          Siguiente
                          <SkipForward className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video flex items-center justify-center bg-gray-800 rounded-lg">
                    <div className="text-center">
                      <Play className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400">Selecciona un video para reproducir</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            {/* Playlist Section */}
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <div>
                  <CardTitle className="text-white">Mi Playlist</CardTitle>
                  <CardDescription className="text-gray-300">
                    Videos en cola para reproducir (Loop automático activado)
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {playlist.length === 0 ? (
                  <p className="text-gray-400">La playlist está vacía. Agrega videos de la búsqueda o sugerencias.</p>
                ) : (
                  <div className="space-y-3">
                    {playlist.map((video, index) => (
                      <Card
                        key={video.id}
                        className={`bg-white/5 backdrop-blur-sm border-white/10 cursor-pointer hover:bg-white/10 transition-colors ${
                          currentPlaylistIndex === index ? "border-blue-500 ring-2 ring-blue-500" : ""
                        }`}
                        onClick={() => playVideo(video, true, index)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <img
                                src={video.thumbnail || "/placeholder.svg"}
                                alt={video.title}
                                className="w-20 h-14 object-cover rounded"
                              />
                              {video.duration && (
                                <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                                  {formatDuration(video.duration)}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white text-sm font-medium line-clamp-2">{video.title}</h4>
                              <p className="text-gray-400 text-xs">{video.channelTitle}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveFromPlaylist(video.id)
                              }}
                            >
                              <XCircle className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Search Results Section */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Resultados de búsqueda</CardTitle>
            <CardDescription className="text-gray-300">Videos encontrados en YouTube</CardDescription>
          </CardHeader>
          <CardContent>
            {videos.length === 0 && !loading ? (
              <p className="text-gray-400">No hay videos para mostrar. Realiza una búsqueda.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {videos.map((video) => (
                  <Card
                    key={video.id}
                    className="bg-white/5 backdrop-blur-sm border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    <CardContent className="p-3">
                      <div className="relative mb-2">
                        <img
                          src={video.thumbnail || "/placeholder.svg"}
                          alt={video.title}
                          className="w-full h-32 object-cover rounded"
                        />
                        {video.duration && (
                          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                            {formatDuration(video.duration)}
                          </span>
                        )}
                      </div>
                      <h4 className="text-white text-sm font-medium line-clamp-2 mb-1">{video.title}</h4>
                      <p className="text-gray-400 text-xs mb-1">{video.channelTitle}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {video.viewCount && (
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {formatViewCount(video.viewCount)}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => playVideo(video)}>
                            <Play className="w-4 h-4 text-blue-400" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleAddToPlaylist(video)}>
                            <PlusCircle className="w-4 h-4 text-blue-400" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
