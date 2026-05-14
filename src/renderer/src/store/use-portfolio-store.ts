import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AssetProfile } from '@shared/types/market'
import type { Holding, HoldingAssetType, HoldingSaleTarget, PortfolioSnapshot } from '@shared/types/portfolio'
import { canAllocateSaleTargetAmount, executeHoldingSaleTargets, getReservedSaleTargetAmount, type ExecutedHoldingSaleTarget } from '@renderer/services/portfolio-sale-target-service'
import { createId } from '@renderer/utils/id'

interface AddHoldingInput {
  asset: AssetProfile
  assetType: HoldingAssetType
  amount: number
  averageCost?: number
}

interface AddCashHoldingInput {
  currency: 'TRY' | 'USD' | 'EUR'
  amount: number
}

interface SaleTargetInput {
  holdingId: string
  targetPrice: number
  amount: number
}

interface UpdateSaleTargetInput extends SaleTargetInput {
  targetId: string
}

interface PortfolioStore {
  holdings: Holding[]
  snapshots: PortfolioSnapshot[]
  addHolding: (input: AddHoldingInput) => void
  addCashHolding: (input: AddCashHoldingInput) => void
  removeHolding: (holdingId: string) => void
  addSaleTarget: (input: SaleTargetInput) => void
  updateSaleTarget: (input: UpdateSaleTargetInput) => void
  removeSaleTarget: (holdingId: string, targetId: string) => void
  executeEligibleSaleTargets: (input: {
    holdingId: string
    currentPrice: number
    currentPriceTry: number
  }) => ExecutedHoldingSaleTarget[]
  upsertDailySnapshot: (snapshot: Omit<PortfolioSnapshot, 'id'>) => void
  hydratePortfolio: (input: {
    holdings: Holding[]
    snapshots: PortfolioSnapshot[]
  }) => void
}

const startOfDayKey = (value: string): string => new Date(value).toISOString().slice(0, 10)
const SNAPSHOT_REFRESH_INTERVAL_MS = 1000 * 60 * 15
const SNAPSHOT_VALUE_EPSILON = 1

const CASH_LABELS: Record<AddCashHoldingInput['currency'], { name: string; symbol: string }> = {
  TRY: { name: 'Türk Lirası', symbol: 'TRY' },
  USD: { name: 'ABD Doları', symbol: 'USD' },
  EUR: { name: 'Euro', symbol: 'EUR' }
}

const mergeAverageCost = (
  existing: Holding,
  amount: number,
  nextAverageCost?: number
): number | undefined => {
  if (existing.averageCost === undefined && nextAverageCost === undefined) {
    return undefined
  }

  if (existing.averageCost === undefined) {
    return nextAverageCost
  }

  if (nextAverageCost === undefined) {
    return existing.averageCost
  }

  const totalAmount = existing.amount + amount
  if (totalAmount <= 0) {
    return nextAverageCost
  }

  return (
    (existing.averageCost * existing.amount + nextAverageCost * amount) /
    totalAmount
  )
}

const normalizeSaleTargets = (targets?: HoldingSaleTarget[]): HoldingSaleTarget[] =>
  (targets ?? []).filter(
    (target) =>
      Number.isFinite(target.targetPrice) &&
      target.targetPrice > 0 &&
      Number.isFinite(target.amount) &&
      target.amount > 0
  )

const normalizeHolding = (holding: Holding): Holding => ({
  ...holding,
  saleTargets: normalizeSaleTargets(holding.saleTargets)
})

export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set) => ({
      holdings: [],
      snapshots: [],

      addHolding: ({ asset, assetType, amount, averageCost }) =>
        set((state) => {
          const existing = state.holdings.find((holding) => holding.assetId === asset.id)

          if (existing) {
            const nextAmount = existing.amount + amount

            return {
              holdings: state.holdings.map((holding) =>
                holding.id === existing.id
                  ? {
                      ...holding,
                      amount: nextAmount,
                      averageCost: mergeAverageCost(existing, amount, averageCost),
                      updatedAt: new Date().toISOString()
                    }
                  : holding
              )
            }
          }

          const nextHolding: Holding = {
            id: createId('holding'),
            assetId: asset.id,
            assetType,
            assetClass: asset.class,
            assetName: asset.name,
            assetSymbol: asset.symbol,
            assetCurrency: asset.currency,
            amount,
            averageCost,
            saleTargets: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }

          return {
            holdings: [nextHolding, ...state.holdings]
          }
        }),

      addCashHolding: ({ currency, amount }) =>
        set((state) => {
          const existing = state.holdings.find(
            (holding) => holding.assetType === 'cash' && holding.assetCurrency === currency
          )

          if (existing) {
            return {
              holdings: state.holdings.map((holding) =>
                holding.id === existing.id
                  ? {
                      ...holding,
                      amount: holding.amount + amount,
                      updatedAt: new Date().toISOString()
                    }
                  : holding
              )
            }
          }

          const cashMeta = CASH_LABELS[currency]
          const nextHolding: Holding = {
            id: createId('holding'),
            assetId: `cash:${currency}`,
            assetType: 'cash',
            assetClass: 'cash',
            assetName: cashMeta.name,
            assetSymbol: cashMeta.symbol,
            assetCurrency: currency,
            amount,
            saleTargets: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }

          return {
            holdings: [nextHolding, ...state.holdings]
          }
        }),

      removeHolding: (holdingId) =>
        set((state) => ({
          holdings: state.holdings.filter((holding) => holding.id !== holdingId)
        })),

      addSaleTarget: ({ holdingId, targetPrice, amount }) =>
        set((state) => ({
          holdings: state.holdings.map((holding) => {
            if (holding.id !== holdingId || holding.assetType === 'cash') {
              return holding
            }

            if (!canAllocateSaleTargetAmount(holding, amount)) {
              return holding
            }

            return {
              ...holding,
              saleTargets: [
                ...normalizeSaleTargets(holding.saleTargets),
                {
                  id: createId('sale-target'),
                  targetPrice,
                  amount,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
              ],
              updatedAt: new Date().toISOString()
            }
          })
        })),

      updateSaleTarget: ({ holdingId, targetId, targetPrice, amount }) =>
        set((state) => ({
          holdings: state.holdings.map((holding) => {
            if (holding.id !== holdingId || holding.assetType === 'cash') {
              return holding
            }

            if (!canAllocateSaleTargetAmount(holding, amount, targetId)) {
              return holding
            }

            return {
              ...holding,
              saleTargets: normalizeSaleTargets(holding.saleTargets).map((target) =>
                target.id === targetId
                  ? {
                      ...target,
                      targetPrice,
                      amount,
                      updatedAt: new Date().toISOString()
                    }
                  : target
              ),
              updatedAt: new Date().toISOString()
            }
          })
        })),

      removeSaleTarget: (holdingId, targetId) =>
        set((state) => ({
          holdings: state.holdings.map((holding) =>
            holding.id === holdingId
              ? {
                  ...holding,
                  saleTargets: normalizeSaleTargets(holding.saleTargets).filter((target) => target.id !== targetId),
                  updatedAt: new Date().toISOString()
                }
              : holding
          )
        })),

      executeEligibleSaleTargets: ({ holdingId, currentPrice, currentPriceTry }) => {
        let executed: ExecutedHoldingSaleTarget[] = []

        set((state) => {
          const execution = executeHoldingSaleTargets({
            holdings: state.holdings.map(normalizeHolding),
            holdingId,
            currentPrice,
            currentPriceTry,
            executedAt: new Date().toISOString()
          })

          executed = execution.executed

          if (!execution.executed.length) {
            return state
          }

          return {
            holdings: execution.holdings.map(normalizeHolding)
          }
        })

        return executed
      },

      upsertDailySnapshot: (snapshot) =>
        set((state) => {
          const dayKey = startOfDayKey(snapshot.capturedAt)
          const existing = state.snapshots.find(
            (item) => startOfDayKey(item.capturedAt) === dayKey
          )

          if (existing) {
            const elapsed =
              Math.abs(new Date(snapshot.capturedAt).getTime() - new Date(existing.capturedAt).getTime())
            const totalValueDelta = Math.abs(existing.totalValueTry - snapshot.totalValueTry)
            const dailyValueDelta = Math.abs(
              existing.dailyChangeValueTry - snapshot.dailyChangeValueTry
            )
            const dailyPercentDelta = Math.abs(
              existing.dailyChangePercent - snapshot.dailyChangePercent
            )

            if (
              elapsed < SNAPSHOT_REFRESH_INTERVAL_MS &&
              totalValueDelta < SNAPSHOT_VALUE_EPSILON &&
              dailyValueDelta < SNAPSHOT_VALUE_EPSILON &&
              dailyPercentDelta < 0.05
            ) {
              return state
            }

            return {
              snapshots: state.snapshots.map((item) =>
                item.id === existing.id
                  ? {
                      ...item,
                      ...snapshot
                    }
                  : item
              )
            }
          }

          return {
            snapshots: [
              ...state.snapshots,
              {
                ...snapshot,
                id: createId('portfolio-snapshot')
              }
            ]
              .sort(
                (left, right) =>
                  new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime()
              )
              .slice(-365)
          }
        }),

      hydratePortfolio: ({ holdings, snapshots }) =>
        set(() => ({
          holdings: holdings.map(normalizeHolding),
          snapshots
        }))
    }),
    {
      name: 'avy-portfolio-store',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState) => {
        const state = persistedState as Partial<PortfolioStore> | undefined

        if (!state) {
          return state
        }

        return {
          ...state,
          holdings: (state.holdings ?? []).map(normalizeHolding),
          snapshots: state.snapshots ?? []
        }
      }
    }
  )
)
