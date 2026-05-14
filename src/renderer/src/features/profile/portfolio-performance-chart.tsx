import { useEffect, useMemo, useRef } from 'react'
import {
  CandlestickData,
  ColorType,
  LineStyle,
  createChart,
  type AreaData,
  type IChartApi,
  type ISeriesApi,
  type Time
} from 'lightweight-charts'
import type { PortfolioSnapshot } from '@shared/types/portfolio'

interface PortfolioPerformanceChartProps {
  snapshots: PortfolioSnapshot[]
  chartType: 'line' | 'candles'
}

type AreaSeriesApi = ISeriesApi<'Area', Time, AreaData<Time>, AreaData<Time>, AreaData<Time>>
type CandlestickSeriesApi = ISeriesApi<
  'Candlestick',
  Time,
  CandlestickData<Time>,
  CandlestickData<Time>,
  CandlestickData<Time>
>

const toChartTime = (value: string): Time =>
  Math.floor(new Date(value).getTime() / 1000) as Time

export const PortfolioPerformanceChart = ({
  snapshots,
  chartType
}: PortfolioPerformanceChartProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const areaSeriesRef = useRef<AreaSeriesApi | null>(null)
  const candleSeriesRef = useRef<CandlestickSeriesApi | null>(null)

  const data = useMemo<AreaData[]>(
    () =>
      snapshots.map((snapshot) => ({
        time: toChartTime(snapshot.capturedAt),
        value: Number(snapshot.totalValueTry.toFixed(2))
      })),
    [snapshots]
  )

  const candleData = useMemo<CandlestickData[]>(
    () =>
      snapshots.map((snapshot) => {
        const open = Number(
          Math.max(snapshot.totalValueTry - snapshot.dailyChangeValueTry, 0).toFixed(2)
        )
        const close = Number(snapshot.totalValueTry.toFixed(2))
        const dayEnvelope = Math.max(
          Math.abs(snapshot.dailyChangeValueTry) * 0.22,
          snapshot.totalValueTry * Math.max(Math.abs(snapshot.dailyChangePercent), 0.2) * 0.00085
        )
        const high = Number((Math.max(open, close) + dayEnvelope).toFixed(2))
        const low = Number(Math.max(Math.min(open, close) - dayEnvelope, 0).toFixed(2))

        return {
          time: toChartTime(snapshot.capturedAt),
          open,
          high,
          low,
          close
        }
      }),
    [snapshots]
  )

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b1626' },
        textColor: '#A8B3C7'
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' }
      },
      width: containerRef.current.clientWidth,
      height: 380,
      rightPriceScale: {
        borderVisible: false
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        rightOffset: 3
      },
      crosshair: {
        vertLine: { color: '#45618a', style: LineStyle.Dashed },
        horzLine: { color: '#45618a', style: LineStyle.Dashed }
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true
      },
      handleScale: {
        mouseWheel: true,
        pinch: true
      }
    })

    const areaSeries = chart.addAreaSeries({
      lineColor: '#f6c445',
      topColor: 'rgba(246, 196, 69, 0.24)',
      bottomColor: 'rgba(246, 196, 69, 0.02)',
      lineWidth: 3,
      priceLineVisible: false
    }) as AreaSeriesApi
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#38c793',
      downColor: '#f9735b',
      borderVisible: false,
      wickUpColor: '#38c793',
      wickDownColor: '#f9735b',
      priceLineVisible: false
    }) as CandlestickSeriesApi

    chartRef.current = chart
    areaSeriesRef.current = areaSeries
    candleSeriesRef.current = candleSeries

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: containerRef.current?.clientWidth ?? 0 })
    })

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      areaSeriesRef.current = null
      candleSeriesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!areaSeriesRef.current || !candleSeriesRef.current || !chartRef.current) {
      return
    }

    areaSeriesRef.current.applyOptions({
      visible: chartType === 'line'
    })
    candleSeriesRef.current.applyOptions({
      visible: chartType === 'candles'
    })

    areaSeriesRef.current.setData(data)
    candleSeriesRef.current.setData(candleData)

    if (data.length > 1 || candleData.length > 1) {
      chartRef.current.timeScale().fitContent()
    }
  }, [candleData, chartType, data])

  return <div ref={containerRef} className="portfolio-chart" />
}
