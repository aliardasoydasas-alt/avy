import { useEffect } from 'react'
import { sendDesktopNotification } from '@renderer/services/notification-service'
import type { PortfolioSummary } from '@renderer/services/portfolio-service'
import { usePortfolioStore } from '@renderer/store/use-portfolio-store'
import { useTerminalStore } from '@renderer/store/use-terminal-store'
import { formatCurrency } from '@renderer/utils/format'

interface UseHoldingSaleTargetsOptions {
  summary: PortfolioSummary
}

const formatQuantity = (value: number): string =>
  new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: value >= 1 ? 0 : 2,
    maximumFractionDigits: value >= 1 ? 4 : 8
  }).format(value)

export const useHoldingSaleTargets = ({ summary }: UseHoldingSaleTargetsOptions): void => {
  useEffect(() => {
    if (!summary.holdings.length) {
      return
    }

    summary.holdings.forEach((item) => {
      if (item.holding.assetType === 'cash' || !item.holding.saleTargets?.length || item.price <= 0 || item.priceTry <= 0) {
        return
      }

      const executed = usePortfolioStore.getState().executeEligibleSaleTargets({
        holdingId: item.holding.id,
        currentPrice: item.price,
        currentPriceTry: item.priceTry
      })

      if (!executed.length) {
        return
      }

      const soldAmount = executed.reduce((sum, target) => sum + target.amount, 0)
      const proceedsTry = executed.reduce((sum, target) => sum + target.proceedsTry, 0)
      const targetLabels = executed.map((target) => formatCurrency(target.targetPrice, item.holding.assetCurrency)).join(', ')
      const message = `${item.holding.assetSymbol} icin ${formatQuantity(soldAmount)} adet hedefe geldi. ${formatCurrency(proceedsTry, 'TRY', 0)} TRY nakde gecildi.`
      const pushed = useTerminalStore.getState().pushNotification({
        title: `${item.holding.assetSymbol} satis hedefi calisti`,
        message,
        timestamp: new Date().toISOString(),
        scope: 'system',
        dedupeKey: `system:sale-target:${item.holding.id}:${targetLabels}:${executed.length}`,
        assetId: item.holding.assetId,
        assetSymbol: item.holding.assetSymbol,
        assetName: item.holding.assetName,
        assetClass: item.holding.assetClass === 'cash' ? undefined : item.holding.assetClass
      })

      if (pushed) {
        void sendDesktopNotification(`${item.holding.assetSymbol} satis hedefi`, message)
      }
    })
  }, [summary])
}
