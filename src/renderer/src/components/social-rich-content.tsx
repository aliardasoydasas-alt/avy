interface SocialRichContentViewProps {
  text: string
  gifUrl?: string
  imageUrl?: string
  className?: string
}

export const SocialRichContentView = ({
  text,
  gifUrl,
  imageUrl,
  className
}: SocialRichContentViewProps) => (
  <div className={className ?? 'social-rich-content'}>
    {text ? <p>{text}</p> : null}
    {gifUrl ? <img src={gifUrl} alt="GIF içerik" className="social-rich-content__gif" /> : null}
    {!gifUrl && imageUrl ? <img src={imageUrl} alt="Görsel içerik" className="social-rich-content__gif" /> : null}
  </div>
)
