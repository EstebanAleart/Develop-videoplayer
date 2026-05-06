"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  Search, Play, X, SkipForward, SkipBack, Eye, Plus, ChevronLeft,
  ChevronRight, Download, ListMusic, Shuffle, Volume2, Keyboard
} from "lucide-react"
import dynamic from "next/dynamic"

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

const SuggestionsList = dynamic<{}>(
  () => import("./components/suggestions-list").then((mod) => mod.SuggestionsList),
  { ssr: false, loading: () => <p className="text-zinc-500 text-sm">Cargando sugerencias...</p> }
)

// Portal dropdown — renders in body to avoid z-index issues
function DownloadDropdown({ videoId, onDownload, onClose }: {
  videoId: string
  onDownload: (id: string, fmt: "audio" | "video") => void
  onClose: () => void
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const btn = document.querySelector(`[data-download-btn="${videoId}"]`)
    if (btn) {
      const rect = btn.getBoundingClientRect()
      setPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX })
    }
    const close = (e: MouseEvent) => {
      if (
        !(e.target as HTMLElement).closest(`[data-download-btn="${videoId}"]`) &&
        !(e.target as HTMLElement).closest("[data-download-menu]")
      ) onClose()
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [videoId, onClose])

  if (typeof window === "undefined") return null

  return createPortal(
    <motion.div
      data-download-menu
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.12 }}
      style={{ position: "absolute", top: pos.top, left: pos.left, zIndex: 9999 }}
      className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden min-w-[148px]"
    >
      <button
        onClick={() => onDownload(videoId, "audio")}
        className="w-full px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700 text-left transition-colors flex items-center gap-2"
      >
        <Volume2 className="w-3.5 h-3.5 text-zinc-400" /> M4A (audio)
      </button>
      <div className="border-t border-zinc-700" />
      <button
        onClick={() => onDownload(videoId, "video")}
        className="w-full px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-700 text-left transition-colors flex items-center gap-2"
      >
        <Play className="w-3.5 h-3.5 text-zinc-400" /> MP4 (video)
      </button>
    </motion.div>,
    document.body
  )
}

function SkeletonCard() {
  return (
    <div className="bg-zinc-900 rounded-xl p-3 animate-pulse border border-zinc-800">
      <div className="w-full h-32 bg-zinc-800 rounded-lg mb-3" />
      <div className="h-3 bg-zinc-800 rounded w-4/5 mb-2" />
      <div className="h-3 bg-zinc-800 rounded w-1/2" />
    </div>
  )
}

export default function VideoPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [videos, setVideos] = useState<Video[]>([])
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(false)
  const [playlist, setPlaylist] = useState<Video[]>([])
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(-1)
  const [autoPlayTimer, setAutoPlayTimer] = useState<NodeJS.Timeout | null>(null)
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true)
  const [downloadMenuFor, setDownloadMenuFor] = useState<string | null>(null)
  const [titleExpanded, setTitleExpanded] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [pageTokens, setPageTokens] = useState<{ [key: number]: string }>({})
  const resultsPerPage = 10

  // Persist playlist
  useEffect(() => {
    const saved = localStorage.getItem("rvp-playlist")
    if (saved) { try { setPlaylist(JSON.parse(saved)) } catch {} }
  }, [])
  useEffect(() => { localStorage.setItem("rvp-playlist", JSON.stringify(playlist)) }, [playlist])

  const getYouTubeEmbedUrl = (videoId: string, autoplay: boolean) => {
    const params = new URLSearchParams({
      playsinline: "1", rel: "0", modestbranding: "1",
      origin: window.location.origin, enablejsapi: "1", fs: "1", iv_load_policy: "3",
    })
    if (autoplay) params.append("autoplay", "1")
    return `https://www.youtube.com/embed/${videoId}?${params}`
  }

  const playNextVideo = useCallback(() => {
    if (!playlist.length) return null
    const nextIndex = (currentPlaylistIndex + 1) % playlist.length
    setCurrentVideo(playlist[nextIndex])
    setCurrentPlaylistIndex(nextIndex)
    return playlist[nextIndex]
  }, [currentPlaylistIndex, playlist])

  const searchVideos = async (page = 1, pageToken?: string) => {
    if (!searchQuery.trim()) return
    setLoading(true)
    try {
      let url = `/api/search?q=${encodeURIComponent(searchQuery)}&page=${page}`
      if (pageToken) url += `&pageToken=${pageToken}`
      const res = await fetch(url)
      const data = await res.json()
      setVideos(data.videos || [])
      setTotalResults(data.totalResults || 0)
      setNextPageToken(data.nextPageToken || null)
      setCurrentPage(page)
      if (data.nextPageToken) setPageTokens(prev => ({ ...prev, [page + 1]: data.nextPageToken }))
    } catch {
      toast.error("Error al buscar videos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!currentVideo && playlist.length > 0) { setCurrentVideo(playlist[0]); setCurrentPlaylistIndex(0) }
  }, [currentVideo, playlist])

  useEffect(() => {
    if (!currentVideo?.duration || !autoPlayEnabled || currentPlaylistIndex === -1) return
    const parse = (d: string) => {
      const m = d.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
      if (!m) return 0
      return ((parseInt(m[1]) || 0) * 3600 + (parseInt(m[2]) || 0) * 60 + (parseInt(m[3]) || 0)) * 1000
    }
    const ms = parse(currentVideo.duration)
    if (ms > 0) {
      const t = setTimeout(() => playNextVideo(), ms)
      setAutoPlayTimer(t)
      return () => clearTimeout(t)
    }
  }, [currentVideo, currentPlaylistIndex, playlist, playNextVideo, autoPlayEnabled])

  // Keyboard shortcuts
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return
      if (e.key === "ArrowRight") handlePlayNextInPlaylist()
      if (e.key === "ArrowLeft") handlePlayPreviousInPlaylist()
    }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [])

  const playVideo = (video: Video, isFromPlaylist = false, index = -1) => {
    if (autoPlayTimer) { clearTimeout(autoPlayTimer); setAutoPlayTimer(null) }
    setCurrentVideo(video)
    setCurrentPlaylistIndex(isFromPlaylist ? index : -1)
    setTitleExpanded(false)
  }

  const handleAddToPlaylist = (video: Video) => {
    if (playlist.some(v => v.id === video.id)) { toast.info("Ya está en la playlist"); return }
    setPlaylist(prev => [...prev, video])
    toast.success("Agregado a la playlist")
  }

  const handleRemoveFromPlaylist = (videoId: string) => {
    setPlaylist(prev => prev.filter(v => v.id !== videoId))
    if (currentVideo?.id === videoId) { setCurrentVideo(null); setCurrentPlaylistIndex(-1) }
    toast("Eliminado", { icon: "🗑️" })
  }

  const handlePlayNextInPlaylist = useCallback(() => {
    if (!playlist.length) return
    const next = (currentPlaylistIndex + 1) % playlist.length
    setCurrentVideo(playlist[next]); setCurrentPlaylistIndex(next)
  }, [playlist, currentPlaylistIndex])

  const handlePlayPreviousInPlaylist = useCallback(() => {
    if (!playlist.length) return
    const prev = (currentPlaylistIndex - 1 + playlist.length) % playlist.length
    setCurrentVideo(playlist[prev]); setCurrentPlaylistIndex(prev)
  }, [playlist, currentPlaylistIndex])

  const handleDownload = (videoId: string, format: "audio" | "video") => {
    const a = document.createElement("a")
    a.href = `/api/download?videoId=${videoId}&format=${format}`
    a.click()
    setDownloadMenuFor(null)
    toast.success(`Descargando ${format === "audio" ? "M4A" : "MP4"}...`)
  }

  const fmt = (duration: string) => {
    if (!duration) return ""
    const m = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
    if (!m) return ""
    const h = m[1] ? parseInt(m[1]) : 0, min = m[2] ? parseInt(m[2]) : 0, s = m[3] ? parseInt(m[3]) : 0
    return h > 0 ? `${h}:${String(min).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${min}:${String(s).padStart(2,"0")}`
  }

  const fmtViews = (count: string) => {
    const n = parseInt(count)
    if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`
    if (n >= 1e3) return `${(n/1e3).toFixed(0)}K`
    return `${n}`
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <Play className="w-4 h-4 text-black fill-black" />
            </div>
            <span className="font-bold text-base sm:text-lg tracking-tight">Radio Player</span>
          </div>
          {/* Search bar + button — full width on mobile, flex-1 on sm+ */}
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar videos en YouTube..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && searchVideos()}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>
            <button
              onClick={() => searchVideos()}
              disabled={loading}
              className="bg-green-500 text-black text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-green-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8">

          {/* Left: Player + Results */}
          <div className="space-y-8">
            {/* Player */}
            <AnimatePresence mode="wait">
              {currentVideo ? (
                <motion.div key={currentVideo.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                  <div className="rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800">
                    <div className="aspect-[16/10]">
                      <iframe
                        src={getYouTubeEmbedUrl(currentVideo.id, autoPlayEnabled)}
                        title={currentVideo.title}
                        className="w-full h-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    </div>
                    <div className="p-5">
                      <h2
                        onClick={() => setTitleExpanded(v => !v)}
                        title={currentVideo.title}
                        className={`font-semibold text-lg leading-snug mb-1 cursor-pointer select-none transition-all duration-200 ${titleExpanded ? "" : "truncate"}`}
                      >
                        {currentVideo.title}
                      </h2>
                      <p className="text-zinc-400 text-sm mb-4">{currentVideo.channelTitle}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={handlePlayPreviousInPlaylist}
                          disabled={!playlist.length}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <SkipBack className="w-3.5 h-3.5" /><span className="hidden sm:inline">Anterior</span>
                        </button>
                        <button
                          onClick={handlePlayNextInPlaylist}
                          disabled={!playlist.length}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <span className="hidden sm:inline">Siguiente</span><SkipForward className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setAutoPlayEnabled(!autoPlayEnabled)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            autoPlayEnabled ? "bg-green-500 text-black hover:bg-green-400" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                          }`}
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{autoPlayEnabled ? "Auto ON" : "Auto OFF"}</span>
                        </button>
                        <div>
                          <button
                            data-download-btn={currentVideo.id}
                            onClick={() => setDownloadMenuFor(downloadMenuFor === currentVideo.id ? null : currentVideo.id)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Descargar</span>
                          </button>
                          <AnimatePresence>
                            {downloadMenuFor === currentVideo.id && (
                              <DownloadDropdown videoId={currentVideo.id} onDownload={handleDownload} onClose={() => setDownloadMenuFor(null)} />
                            )}
                          </AnimatePresence>
                        </div>
                        <button
                          onClick={() => handleAddToPlaylist(currentVideo)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Playlist</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl bg-zinc-900 border border-zinc-800 aspect-[16/10] flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                      <Play className="w-7 h-7 text-zinc-600" />
                    </div>
                    <p className="text-zinc-500 text-sm">Selecciona un video para reproducir</p>
                    <p className="text-zinc-700 text-xs mt-1 flex items-center justify-center gap-1">
                      <Keyboard className="w-3 h-3" /> ← → para navegar la playlist
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Search results */}
            <div>
              {(videos.length > 0 || loading) && (
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Resultados</h3>
                    {totalResults > 0 && <p className="text-zinc-500 text-xs mt-0.5">{totalResults.toLocaleString()} videos encontrados · Página {currentPage}</p>}
                  </div>
                  {videos.length > 0 && !loading && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setPageTokens({}); searchVideos(1) }} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Primera</button>
                      <button onClick={() => searchVideos(currentPage - 1, pageTokens[currentPage - 1])} disabled={currentPage === 1} className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                      <button onClick={() => searchVideos(currentPage + 1, nextPageToken!)} disabled={!nextPageToken} className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              )}

              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : videos.length === 0 ? (
                <div className="text-center py-16 text-zinc-600">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>Busca algo para empezar</p>
                </div>
              ) : (
                <motion.div
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
                  initial="hidden" animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.04 } }, hidden: {} }}
                >
                  {videos.map(video => (
                    <motion.div
                      key={video.id}
                      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                      className="group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors"
                    >
                      <div className="relative cursor-pointer" onClick={() => playVideo(video)}>
                        <img src={video.thumbnail || "/placeholder.svg"} alt={video.title} className="w-full h-32 object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <Play className="w-5 h-5 text-white fill-white" />
                          </div>
                        </div>
                        {video.duration && (
                          <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded-md font-mono">
                            {fmt(video.duration)}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <h4 className="text-white text-xs font-medium line-clamp-2 leading-snug mb-1">{video.title}</h4>
                        <p className="text-zinc-500 text-xs line-clamp-1">{video.channelTitle}</p>
                        <div className="flex items-center justify-between mt-2.5">
                          {video.viewCount ? (
                            <span className="text-zinc-600 text-xs flex items-center gap-1">
                              <Eye className="w-3 h-3" />{fmtViews(video.viewCount)}
                            </span>
                          ) : <span />}
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => playVideo(video)} className="p-1 rounded-lg hover:bg-zinc-800 transition-colors">
                              <Play className="w-3.5 h-3.5 text-zinc-400 hover:text-white" />
                            </button>
                            <button onClick={() => handleAddToPlaylist(video)} className="p-1 rounded-lg hover:bg-zinc-800 transition-colors">
                              <Plus className="w-3.5 h-3.5 text-zinc-400 hover:text-white" />
                            </button>
                            <div>
                              <button
                                data-download-btn={video.id}
                                onClick={e => { e.stopPropagation(); setDownloadMenuFor(downloadMenuFor === video.id ? null : video.id) }}
                                className="p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5 text-zinc-400 hover:text-white" />
                              </button>
                              <AnimatePresence>
                                {downloadMenuFor === video.id && (
                                  <DownloadDropdown videoId={video.id} onDownload={handleDownload} onClose={() => setDownloadMenuFor(null)} />
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          {/* Right: Playlist */}
          <div className="xl:sticky xl:top-24 xl:h-[calc(100vh-6rem)] xl:overflow-y-auto">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-zinc-400" />
                  <span className="font-semibold text-sm">Playlist</span>
                </div>
                <span className="text-zinc-500 text-xs">{playlist.length} video{playlist.length !== 1 ? "s" : ""}</span>
              </div>

              {playlist.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <ListMusic className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">Playlist vacía</p>
                  <p className="text-zinc-700 text-xs mt-1">Agrega videos con el botón +</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  <AnimatePresence>
                    {playlist.map((video, index) => (
                      <motion.div
                        key={video.id}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => playVideo(video, true, index)}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/60 transition-colors group ${currentPlaylistIndex === index ? "bg-zinc-800 border-l-2 border-green-500" : ""}`}
                      >
                        <div className="relative flex-shrink-0">
                          <img src={video.thumbnail} alt={video.title} className="w-14 h-10 object-cover rounded-lg" />
                          {currentPlaylistIndex === index && (
                            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium line-clamp-2 leading-snug ${currentPlaylistIndex === index ? "text-white" : "text-zinc-300"}`}>
                            {video.title}
                          </p>
                          <p className="text-zinc-600 text-xs mt-0.5 line-clamp-1">{video.channelTitle}</p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleRemoveFromPlaylist(video.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-zinc-700 transition-all flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5 text-zinc-400" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
