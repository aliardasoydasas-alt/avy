import type { AssetClass } from '@shared/types/market'

interface AssetBadgeProps {
  symbol: string
  assetClass?: AssetClass
  size?: 'sm' | 'md'
}

const toneByClass: Record<AssetClass, string> = {
  crypto: 'asset-badge--crypto',
  stock: 'asset-badge--stock',
  index: 'asset-badge--index',
  commodity: 'asset-badge--commodity'
}

export const AssetBadge = ({
  symbol,
  assetClass = 'stock',
  size = 'md'
}: AssetBadgeProps) => (
  <span className={`asset-badge ${toneByClass[assetClass]} asset-badge--${size}`}>
    {symbol.slice(0, size === 'sm' ? 2 : 3).toUpperCase()}
  </span>
)
