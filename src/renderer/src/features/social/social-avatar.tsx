interface SocialAvatarProps {
  displayName: string
  username: string
  avatarDataUrl?: string
  className?: string
}

const buildInitials = (displayName: string, username: string): string => {
  const seed = displayName || username || 'AVY'
  return seed
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export const SocialAvatar = ({
  displayName,
  username,
  avatarDataUrl,
  className = 'social-avatar'
}: SocialAvatarProps) => (
  <div className={className}>
    {avatarDataUrl ? (
      <img src={avatarDataUrl} alt={`${displayName || username} profil resmi`} />
    ) : (
      <strong>{buildInitials(displayName, username)}</strong>
    )}
  </div>
)
