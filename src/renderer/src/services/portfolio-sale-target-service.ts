import type { Holding, HoldingSaleTarget } from '@shared/types/portfolio'

export interface ExecutedHoldingSaleTarget {
  targetId: string
  amount: number
  targetPrice: number
  executedPrice: number
  proceedsTry: number
}

interface ExecuteHoldingSaleTargetsInput {
  holdings: Holding[]
  holdingId: string
  currentPrice: number
  currentPriceTry: number
  executedAt: string
}

const HOLDING_EPSILON = 0.0000001

const sanitizeSaleTargets = (targets?: HoldingSaleTarget[]): HoldingSaleTarget[] =>
  (targets ?? []).filter(
    (target) => Number.isFinite(target.targetPrice) && target.targetPrice > 0 && Number.isFinite(target.amount) && target.amount > 0
  )

export const getReservedSaleTargetAmount = (
  holding: Holding,
  excludeTargetId?: string
): number =>
  sanitizeSaleTargets(holding.saleTargets).reduce((sum, target) => {
    if (excludeTargetId && target.id === excludeTargetId) {
      return sum
    }

    return sum + target.amount
  }, 0)

export const canAllocateSaleTargetAmount = (
  holding: Holding,
  amount: number,
  excludeTargetId?: string
): boolean => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return false
  }

  return getReservedSaleTargetAmount(holding, excludeTargetId) + amount <= holding.amount + HOLDING_EPSILON
}

const upsertTryCashHolding = (holdings: Holding[], proceedsTry: number, executedAt: string): Holding[] => {
  if (proceedsTry <= 0) {
    return holdings
  }

  const existingCash = holdings.find(
    (holding) => holding.assetType === 'cash' && holding.assetCurrency === 'TRY'
  )

  if (existingCash) {
    return holdings.map((holding) =>
      holding.id === existingCash.id
        ? {
            ...holding,
            amount: holding.amount + proceedsTry,
            updatedAt: executedAt
          }
        : holding
    )
  }

  const nextCashHolding: Holding = {
    id: `cash-sale:${executedAt}`,
    assetId: 'cash:TRY',
    assetType: 'cash',
    assetClass: 'cash',
    assetName: 'Turk Lirasi',
    assetSymbol: 'TRY',
    assetCurrency: 'TRY',
    amount: proceedsTry,
    createdAt: executedAt,
    updatedAt: executedAt
  }

  return [nextCashHolding, ...holdings]
}

export const executeHoldingSaleTargets = ({
  holdings,
  holdingId,
  currentPrice,
  currentPriceTry,
  executedAt
}: ExecuteHoldingSaleTargetsInput): {
  holdings: Holding[]
  executed: ExecutedHoldingSaleTarget[]
} => {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !Number.isFinite(currentPriceTry) || currentPriceTry <= 0) {
    return {
      holdings,
      executed: []
    }
  }

  const holding = holdings.find((item) => item.id === holdingId)

  if (!holding || holding.assetType === 'cash') {
    return {
      holdings,
      executed: []
    }
  }

  const eligibleTargets = sanitizeSaleTargets(holding.saleTargets)
    .filter((target) => currentPrice >= target.targetPrice)
    .sort((left, right) => left.targetPrice - right.targetPrice)

  if (!eligibleTargets.length) {
    return {
      holdings,
      executed: []
    }
  }

  let remainingAmount = holding.amount
  let proceedsTry = 0
  const executed: ExecutedHoldingSaleTarget[] = []
  const executedTargetIds = new Set<string>()

  eligibleTargets.forEach((target) => {
    if (remainingAmount <= HOLDING_EPSILON) {
      return
    }

    const executedAmount = Math.min(target.amount, remainingAmount)

    if (executedAmount <= HOLDING_EPSILON) {
      return
    }

    remainingAmount -= executedAmount
    proceedsTry += executedAmount * currentPriceTry
    executedTargetIds.add(target.id)
    executed.push({
      targetId: target.id,
      amount: executedAmount,
      targetPrice: target.targetPrice,
      executedPrice: currentPrice,
      proceedsTry: executedAmount * currentPriceTry
    })
  })

  if (!executed.length) {
    return {
      holdings,
      executed: []
    }
  }

  const nextHoldings = holdings.reduce<Holding[]>((accumulator, item) => {
    if (item.id !== holding.id) {
      accumulator.push(item)
      return accumulator
    }

    if (remainingAmount <= HOLDING_EPSILON) {
      return accumulator
    }

    accumulator.push({
      ...item,
      amount: remainingAmount,
      saleTargets: sanitizeSaleTargets(item.saleTargets).filter((target) => !executedTargetIds.has(target.id)),
      updatedAt: executedAt
    })

    return accumulator
  }, [])

  return {
    holdings: upsertTryCashHolding(nextHoldings, proceedsTry, executedAt),
    executed
  }
}
