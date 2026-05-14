import { describe, expect, it } from 'vitest'
import {
  localizeFinancialNewsHeadline,
  localizeFinancialNewsSummary,
  translateFinancialNewsText
} from '@renderer/services/news-translation-service'

describe('news translation service', () => {
  it('translates common macro headlines to Turkish-style output', () => {
    const output = translateFinancialNewsText(
      "Asia's stock markets surge, oil falls on hopes for US-Iran talks"
    )

    expect(output).toContain("Asya'nin")
    expect(output).toContain('hisse piyasalari')
    expect(output).toContain('petrol')
    expect(output).toContain('ABD-Iran')
  })

  it('translates common market commentary labels', () => {
    expect(translateFinancialNewsText('Market analysis')).toBe('Piyasa analizi')
    expect(translateFinancialNewsText("What's happening this week in economics?")).toBe(
      'Bu hafta ekonomide neler oluyor?'
    )
  })

  it('falls back to Turkish headline and summary when English remains too strong', () => {
    const headline = localizeFinancialNewsHeadline(
      "Stocks hit records, oil steadies as Trump says Iran war 'close to over'"
    )
    const summary = localizeFinancialNewsSummary(
      "Stocks hit records, oil steadies as Trump says Iran war 'close to over'",
      "Stocks hit records, oil steadies as Trump says Iran war 'close to over'"
    )

    expect(headline).toMatch(/piyasa|Petrol|Jeopolitik|Faiz|Kuresel/i)
    expect(summary).toMatch(/piyasa|Petrol|Jeopolitik|Merkez bankasi/i)
  })

  it('forces Turkish fallback for headline patterns that still contain English connectors', () => {
    const headline = localizeFinancialNewsHeadline(
      'What to watch this week: oil prices and market outlook after Fed meeting'
    )

    expect(headline).not.toMatch(/\bwhat\b|\bwatch\b|\boutlook\b|\bafter\b/i)
    expect(headline).toMatch(/hafta|piyasa|Petrol|Faiz|Kuresel/i)
  })
})
