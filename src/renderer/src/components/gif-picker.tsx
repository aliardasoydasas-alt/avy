import { useMemo, useState } from 'react'
import { ImagePlus, Search, X } from 'lucide-react'
import { SOCIAL_GIF_CATALOG } from '@renderer/services/social-gif-catalog'

interface GifPickerProps {
  gifUrl?: string
  onChange: (gifUrl?: string) => void
}

const GIF_CATEGORIES = ['Tümü', 'Popüler', 'Kutlama', 'Tepki', 'Komik'] as const

export const GifPicker = ({ gifUrl, onChange }: GifPickerProps) => {
  const [isExpanded, setIsExpanded] = useState(Boolean(gifUrl))
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof GIF_CATEGORIES)[number]>('Tümü')

  const visibleGifs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')

    return SOCIAL_GIF_CATALOG.filter((gif) => {
      const matchesCategory = category === 'Tümü' ? true : gif.category === category

      if (!normalizedQuery) {
        return matchesCategory
      }

      const haystack = `${gif.label} ${gif.tags.join(' ')}`.toLocaleLowerCase('tr-TR')
      return matchesCategory && haystack.includes(normalizedQuery)
    })
  }, [category, query])

  return (
    <div className="gif-picker">
      <div className="inline-form">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setIsExpanded((current) => !current)}
        >
          <ImagePlus size={16} />
          GIF ekle
        </button>
        {gifUrl ? (
          <button type="button" className="text-button" onClick={() => onChange(undefined)}>
            <X size={14} />
            Temizle
          </button>
        ) : null}
      </div>

      {isExpanded ? (
        <div className="list-stack">
          <label className="field-stack">
            <span>Hazır GIF galerisi</span>
            <div className="search-input">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="GIF ara"
              />
            </div>
          </label>

          <div className="filter-chip-row">
            {GIF_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? 'chip chip--active' : 'chip'}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="gif-picker__grid">
            {visibleGifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                className={gifUrl === gif.url ? 'gif-picker__card gif-picker__card--active' : 'gif-picker__card'}
                onClick={() => onChange(gif.url)}
              >
                <img src={gif.url} alt={gif.label} loading="lazy" />
                <span>{gif.label}</span>
              </button>
            ))}
          </div>

          {!visibleGifs.length ? (
            <p className="hero-card__helper">Bu aramada eşleşen hazır GIF bulunamadı.</p>
          ) : null}

          {gifUrl ? <img src={gifUrl} alt="GIF önizleme" className="social-gif-preview" /> : null}
        </div>
      ) : null}
    </div>
  )
}
