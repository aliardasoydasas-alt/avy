import { describe, expect, it } from 'vitest'
import { canAllocateSaleTargetAmount, executeHoldingSaleTargets, getReservedSaleTargetAmount } from '@renderer/services/portfolio-sale-target-service'
import type { Holding } from '@shared/types/portfolio'

const buildHolding = (): Holding => ({
  id: 'holding-btc',
  assetId: 'binance:BTCUSDT',
  assetType: 'crypto',
  assetClass: 'crypto',
  assetName: 'Bitcoin',
  assetSymbol: 'BTC',
  assetCurrency: 'USDT',
  amount: 1.2,
  averageCost: 68000,
  saleTargets: [
    {
      id: 'target-a',
      targetPrice: 72000,
      amount: 0.4,
      createdAt: '2026-05-10T08:00:00.000Z',
      updatedAt: '2026-05-10T08:00:00.000Z'
    },
    {
      id: 'target-b',
      targetPrice: 74000,
      amount: 0.3,
      createdAt: '2026-05-10T08:00:00.000Z',
      updatedAt: '2026-05-10T08:00:00.000Z'
    }
  ],
  createdAt: '2026-05-10T08:00:00.000Z',
  updatedAt: '2026-05-10T08:00:00.000Z'
})

describe('portfolio-sale-target-service', () => {
  it('tracks reserved target amount and enforces remaining capacity', () => {
    const holding = buildHolding()

    expect(getReservedSaleTargetAmount(holding)).toBeCloseTo(0.7)
    expect(canAllocateSaleTargetAmount(holding, 0.5)).toBe(true)
    expect(canAllocateSaleTargetAmount(holding, 0.6)).toBe(false)
    expect(canAllocateSaleTargetAmount(holding, 0.6, 'target-b')).toBe(true)
  })

  it('executes all eligible targets and converts proceeds into TRY cash', () => {
    const holding = buildHolding()
    const execution = executeHoldingSaleTargets({
      holdings: [holding],
      holdingId: holding.id,
      currentPrice: 75000,
      currentPriceTry: 2_925_000,
      executedAt: '2026-05-12T10:00:00.000Z'
    })

    expect(execution.executed).toHaveLength(2)
    expect(execution.executed[0]?.amount).toBeCloseTo(0.4)
    expect(execution.executed[1]?.amount).toBeCloseTo(0.3)

    const remainingHolding = execution.holdings.find((item) => item.id === holding.id)
    expect(remainingHolding?.amount).toBeCloseTo(0.5)
    expect(remainingHolding?.saleTargets).toEqual([])

    const tryCashHolding = execution.holdings.find((item) => item.assetId === 'cash:TRY')
    expect(tryCashHolding?.amount).toBeCloseTo(0.7 * 2_925_000)
  })
})
