import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Play, ListPlus, Eye } from "lucide-react"

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

export async function SuggestionsList() {
  // Obtener sugerencias directamente desde la API
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/suggestions`, {
    next: { revalidate: 30 } // Revalidar cada 30 segundos
  })
  const { suggestions } = await response.json()

  if (!suggestions || suggestions.length === 0) {
    return <div className="text-center text-gray-500">No hay sugerencias disponibles</div>
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Sugerencias de la comunidad</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {suggestions.map((suggestion: Video) => (
          <Card key={suggestion.id} className="overflow-hidden">
            <div className="relative">
              <img
                src={suggestion.thumbnail}
                alt={suggestion.title}
                className="w-full h-40 object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <button className="bg-white bg-opacity-90 rounded-full p-2 mr-2">
                  <Play className="h-5 w-5 text-black" />
                </button>
                <button className="bg-white bg-opacity-90 rounded-full p-2">
                  <ListPlus className="h-5 w-5 text-black" />
                </button>
              </div>
            </div>
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-medium line-clamp-2">{suggestion.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-center text-xs text-gray-500">
                <span>{suggestion.channelTitle}</span>
                {suggestion.suggestedBy && (
                  <span className="ml-2 flex items-center">
                    <Eye className="h-3 w-3 mr-1" />
                    {suggestion.suggestedBy}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
