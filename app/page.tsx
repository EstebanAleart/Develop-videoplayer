"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Search, Play, XCircle, SkipForward, SkipBack, Eye, PlusCircle, ChevronLeft, ChevronRight } from "lucide-react"
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
  const [suggestions, setSuggestions] = useState<Video[]>([])
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState<number>(-1)
  const [autoPlayTimer, setAutoPlayTimer] = useState<NodeJS.Timeout | null>(null)
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [prevPageToken, setPrevPageToken] = useState<string | null>(null)
  const [pageTokens, setPageTokens] = useState<{ [key: number]: string }>({})
  const resultsPerPage = 10

  const playNextVideo = useCallback(() => {
    if (playlist.length === 0) return null

    let nextIndex = currentPlaylistIndex + 1

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

  const searchVideos = async (page = 1, pageToken?: string) => {
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      let url = `/api/search?q=${encodeURIComponent(searchQuery)}&page=${page}`
      if (pageToken) {
        url += `&pageToken=${pageToken}`
      }

      const response = await fetch(url)
      const data = await response.json()

      setVideos(data.videos || [])
      setTotalResults(data.totalResults || 0)
      setNextPageToken(data.nextPageToken || null)
      setPrevPageToken(data.prevPageToken || null)
      setCurrentPage(page)

      if (data.nextPageToken) {
        setPageTokens((prev) => ({
          ...prev,
          [page + 1]: data.nextPageToken,
        }))
      }
    } catch (error) {
      console.error("Error searching videos:", error)
    } finally {
      setLoading(false)
    }
  }

  const goToNextPage = () => {
    if (nextPageToken) {
      searchVideos(currentPage + 1, nextPageToken)
    }
  }

  const goToPrevPage = () => {
    if (currentPage > 1) {
      const prevToken = pageTokens[currentPage - 1]
      searchVideos(currentPage - 1, prevToken)
    }
  }

  const goToFirstPage = () => {
    if (currentPage > 1) {
      setPageTokens({}) // Limpiar tokens
      searchVideos(1)
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

  const SuggestionsList = dynamic<{}>(
    () => import("./components/suggestions-list").then((mod) => mod.SuggestionsList),
    {
      ssr: false,
      loading: () => <div className="text-center py-4">Cargando sugerencias...</div>,
    },
  )

  useEffect(() => {
    if (!currentVideo && playlist.length > 0) {
      setCurrentVideo(playlist[0])
      setCurrentPlaylistIndex(0)
    }
  }, [currentVideo, playlist])

  useEffect(() => {
    if (!currentVideo?.duration) return

    const parseDuration = (duration: string): number => {
      const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
      if (!match) return 0

      const hours = Number.parseInt(match[1]) || 0
      const minutes = Number.parseInt(match[2]) || 0
      const seconds = Number.parseInt(match[3]) || 0

      return (hours * 3600 + minutes * 60 + seconds) * 1000 // Convert to milliseconds
    }

    if (currentPlaylistIndex !== -1 && playlist.length > 0) {
      const durationMs = parseDuration(currentVideo.duration)

      if (durationMs > 0) {
        const timer = setTimeout(() => {
          playNextVideo()
        }, durationMs)

        setAutoPlayTimer(timer)
      }
    }

    return () => {
      if (autoPlayTimer) {
        clearTimeout(autoPlayTimer)
      }
    }
  }, [currentVideo, currentPlaylistIndex, playlist, playNextVideo])

  const playVideo = (video: Video, isFromPlaylist = false, index = -1) => {
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
    if (!playlist.some((item) => item.id === video.id)) {
      setPlaylist((prev) => [...prev, video])
    }
  }

  const handleRemoveFromPlaylist = (videoId: string) => {
    setPlaylist((prev) => prev.filter((video) => video.id !== videoId))
    if (currentVideo?.id === videoId || playlist.length === 1) {
      setCurrentVideo(null)
      setCurrentPlaylistIndex(-1)
    } else if (currentPlaylistIndex !== -1 && playlist[currentPlaylistIndex]?.id === videoId) {
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
                onClick={() => searchVideos()}
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
          <div className="lg:col-span-2">
            <Card className="bg-white/10 backdrop-blur-sm border-white/20">
              <CardContent className="p-0">
                {currentVideo ? (
                  <div className="aspect-video">
                    <iframe
                      src={`https://www.youtube.com/embed/${currentVideo.id}${autoPlayEnabled ? "?autoplay=1" : ""}`}
                      title={currentVideo.title}
                      className="w-full h-full rounded-t-lg"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      onLoad={() => {
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
                      <div className="flex flex-wrap gap-3 mt-4">
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
                        <Button
                          onClick={() => setAutoPlayEnabled(!autoPlayEnabled)}
                          className={`font-semibold px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2 ${
                            autoPlayEnabled
                              ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                              : "bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700"
                          } text-white`}
                        >
                          <Play className="w-4 h-4" />
                          {autoPlayEnabled ? "Auto ON" : "Auto OFF"}
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
                  <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500 space-y-3">
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

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <CardTitle className="text-white">Resultados de búsqueda</CardTitle>
                <CardDescription className="text-gray-300">
                  {totalResults > 0 && (
                    <>
                      <span className="hidden sm:inline">
                        Mostrando {(currentPage - 1) * resultsPerPage + 1}-
                        {Math.min(currentPage * resultsPerPage, totalResults)} de {totalResults.toLocaleString()}{" "}
                        resultados
                      </span>
                      <span className="sm:hidden">{totalResults.toLocaleString()} resultados encontrados</span>
                    </>
                  )}
                  {totalResults === 0 && "Videos encontrados en YouTube"}
                </CardDescription>
              </div>
              {videos.length > 0 && (
                <div className="hidden lg:flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={goToFirstPage}
                    disabled={currentPage === 1 || loading}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    Primera
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={goToPrevPage}
                    disabled={currentPage === 1 || loading}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-white text-sm px-2">Página {currentPage}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={goToNextPage}
                    disabled={!nextPageToken || loading}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {videos.length === 0 && !loading ? (
              <p className="text-gray-400">No hay videos para mostrar. Realiza una búsqueda.</p>
            ) : (
              <>
                <div className="max-h-[800px] overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-blue-600 hover:scrollbar-thumb-blue-500">
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
                </div>

                {videos.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="flex flex-col gap-4 sm:hidden">
                      <div className="text-center">
                        <div className="text-white text-sm mb-1">Página {currentPage}</div>
                        {totalResults > 0 && (
                          <div className="text-xs text-gray-400">
                            {(currentPage - 1) * resultsPerPage + 1}-
                            {Math.min(currentPage * resultsPerPage, totalResults)} de {totalResults.toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="outline"
                          onClick={goToPrevPage}
                          disabled={currentPage === 1 || loading}
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1 max-w-[120px]"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          onClick={goToNextPage}
                          disabled={!nextPageToken || loading}
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex-1 max-w-[120px]"
                        >
                          Siguiente
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                      {currentPage > 1 && (
                        <div className="flex justify-center">
                          <Button
                            variant="outline"
                            onClick={goToFirstPage}
                            disabled={loading}
                            className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-sm px-4"
                          >
                            Primera página
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="hidden sm:flex justify-center items-center gap-4">
                      <Button
                        variant="outline"
                        onClick={goToFirstPage}
                        disabled={currentPage === 1 || loading}
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        Primera página
                      </Button>
                      <Button
                        variant="outline"
                        onClick={goToPrevPage}
                        disabled={currentPage === 1 || loading}
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Anterior
                      </Button>
                      <div className="flex items-center gap-2 text-white px-4">
                        <span className="text-sm">Página {currentPage}</span>
                        {totalResults > 0 && (
                          <span className="text-xs text-gray-400 hidden md:inline">
                            ({totalResults.toLocaleString()} resultados)
                          </span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        onClick={goToNextPage}
                        disabled={!nextPageToken || loading}
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        Siguiente
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
