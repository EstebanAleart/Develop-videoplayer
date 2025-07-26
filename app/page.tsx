"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Play, Eye, ListPlus, XCircle, SkipForward, SkipBack, RefreshCw } from "lucide-react" // Importar RefreshCw

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
  const [suggestions, setSuggestions] = useState<Video[]>([])
  const [playlist, setPlaylist] = useState<Video[]>([])
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState<number>(-1) // -1 means no playlist item is currently playing

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

  useEffect(() => {
    loadSuggestions()
  }, [])

  // Auto-play logic: prioritize playlist, then suggestions
  useEffect(() => {
    if (!currentVideo) {
      // Only auto-play if no video is currently set
      if (playlist.length > 0) {
        setCurrentVideo(playlist[0])
        setCurrentPlaylistIndex(0)
      } else if (suggestions.length > 0) {
        setCurrentVideo(suggestions[0])
        setCurrentPlaylistIndex(-1) // Not from playlist
      }
    }
  }, [currentVideo, playlist, suggestions]) // Dependencias: currentVideo, playlist, suggestions

  const playVideo = (video: Video, isFromPlaylist = false, index = -1) => {
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
      nextIndex = 0 // Loop back to start
    }
    setCurrentVideo(playlist[nextIndex])
    setCurrentPlaylistIndex(nextIndex)
  }, [playlist, currentPlaylistIndex])

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
              <Button onClick={searchVideos} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                <Search className="w-4 h-4 mr-2" />
                {loading ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Listener Suggestions Section */}
        <Card className="mb-8 bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-white">Sugerencias de Oyentes</CardTitle>
              <CardDescription className="text-gray-300">Videos sugeridos por la audiencia</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={loadSuggestions} className="text-white hover:bg-white/20">
              <RefreshCw className="w-5 h-5" />
              <span className="sr-only">Actualizar sugerencias</span>
            </Button>
          </CardHeader>
          <CardContent>
            {suggestions.length === 0 ? (
              <p className="text-gray-400">No hay sugerencias aún.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suggestions.map((video) => (
                  <Card
                    key={video.id}
                    className="bg-white/5 backdrop-blur-sm border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                  >
                    <CardContent className="p-3">
                      <div className="relative mb-2">
                        <img
                          src={video.thumbnail || "/placeholder.svg"}
                          alt={video.title}
                          className="w-full h-24 object-cover rounded"
                        />
                        {video.duration && (
                          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                            {formatDuration(video.duration)}
                          </span>
                        )}
                      </div>
                      <h4 className="text-white text-sm font-medium line-clamp-2 mb-1">{video.title}</h4>
                      <p className="text-gray-400 text-xs mb-1">{video.channelTitle}</p>
                      {video.suggestedBy && (
                        <p className="text-green-400 text-xs mb-1">Sugerido por: {video.suggestedBy}</p>
                      )}
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
                            <ListPlus className="w-4 h-4 text-purple-400" />
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

        <div className="grid lg:grid-cols-3 gap-8">
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
                    />
                    <div className="p-4">
                      <h2 className="text-xl font-bold text-white mb-2">{currentVideo.title}</h2>
                      <p className="text-gray-300 text-sm mb-2">{currentVideo.channelTitle}</p>
                      <p className="text-gray-400 text-sm line-clamp-3">{currentVideo.description}</p>
                      <div className="flex gap-2 mt-4">
                        <Button onClick={handlePlayPreviousInPlaylist} disabled={playlist.length === 0}>
                          <SkipBack className="w-4 h-4 mr-2" /> Anterior
                        </Button>
                        <Button onClick={handlePlayNextInPlaylist} disabled={playlist.length === 0}>
                          Siguiente <SkipForward className="w-4 h-4 ml-2" />
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

          {/* Playlist and Search Results */}
          <div className="space-y-8">
            {/* Playlist Section */}
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Mi Playlist</CardTitle>
                <CardDescription className="text-gray-300">Videos en cola para reproducir</CardDescription>
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

            {/* Search Results Section */}
            <h3 className="text-xl font-bold text-white">Resultados de búsqueda</h3>
            {videos.length === 0 && !loading ? (
              <p className="text-gray-400">No hay videos para mostrar. Realiza una búsqueda.</p>
            ) : (
              <div className="space-y-4">
                {videos.map((video) => (
                  <Card
                    key={video.id}
                    className="bg-white/10 backdrop-blur-sm border-white/20 cursor-pointer hover:bg-white/20 transition-colors"
                  >
                    <CardContent className="p-3">
                      <div className="flex gap-3">
                        <div className="relative flex-shrink-0">
                          <img
                            src={video.thumbnail || "/placeholder.svg"}
                            alt={video.title}
                            className="w-24 h-16 object-cover rounded"
                          />
                          {video.duration && (
                            <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                              {formatDuration(video.duration)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
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
                                <ListPlus className="w-4 h-4 text-purple-400" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
