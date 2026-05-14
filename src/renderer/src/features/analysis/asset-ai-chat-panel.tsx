import { useState } from 'react'
import { Bot, RefreshCcw, Send, Trash2 } from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StateCard } from '@renderer/components/state-card'
import type { AiInsight } from '@renderer/services/ai-insight-engine'
import { buildAssetAiChatReply } from '@renderer/services/asset-ai-chat-service'
import { createSharedAssetAiReply } from '@renderer/services/shared-ai-backend'
import { useAssetChatStore } from '@renderer/store/use-asset-chat-store'
import type { AssetChatMessage } from '@renderer/store/use-asset-chat-store'
import { formatDateTime } from '@renderer/utils/format'
import type { IndicatorSnapshot } from '@shared/types/analysis'
import type { AssetSnapshot } from '@shared/types/market'
import type { NewsItem } from '@shared/types/news'
import type { PatternSignal } from '@shared/types/patterns'

interface AssetAiChatPanelProps {
  snapshot: AssetSnapshot
  indicators: IndicatorSnapshot
  patterns: PatternSignal[]
  insight: AiInsight
  news: NewsItem[]
}

const SUGGESTIONS = [
  'Bu varlıkta risk nerede artıyor?',
  'Son hareketi nasıl yorumluyorsun?',
  'Şu an hangi seviyeler önemli?',
  'Haber akışı fiyatı nasıl etkiliyor?'
]

const EMPTY_CONVERSATION: AssetChatMessage[] = []

export const AssetAiChatPanel = ({
  snapshot,
  indicators,
  patterns,
  insight,
  news
}: AssetAiChatPanelProps) => {
  const [draft, setDraft] = useState('')
  const [helperMessage, setHelperMessage] = useState('')
  const [lastErrorMessage, setLastErrorMessage] = useState('')
  const [lastQuestion, setLastQuestion] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const storedConversation = useAssetChatStore((state) => state.conversations[snapshot.profile.id])
  const conversation = storedConversation ?? EMPTY_CONVERSATION
  const addMessage = useAssetChatStore((state) => state.addMessage)
  const clearConversation = useAssetChatStore((state) => state.clearConversation)

  const buildDerivedReply = (
    question: string,
    nextConversation: Array<{ role: 'user' | 'assistant'; text: string }>
  ) =>
    buildAssetAiChatReply({
      question,
      snapshot,
      indicators,
      patterns,
      insight,
      news,
      conversation: nextConversation.map((message) => ({
        id: `${message.role}-${message.text.slice(0, 12)}`,
        role: message.role,
        text: message.text,
        createdAt: new Date().toISOString()
      }))
    })

  const sendQuestion = async (question: string) => {
    const trimmed = question.trim()

    if (!trimmed || isGenerating) {
      return
    }

    const userMessage = addMessage(snapshot.profile.id, 'user', trimmed)
    const nextConversation = [...conversation, userMessage].map((message) => ({
      role: message.role,
      text: message.text
    }))

    setDraft('')
    setHelperMessage('')
    setLastErrorMessage('')
    setLastQuestion(trimmed)
    setIsGenerating(true)

    try {
      const cloudReply = await createSharedAssetAiReply({
        question: trimmed,
        snapshot,
        indicators,
        patterns,
        insight,
        news,
        conversation: nextConversation
      })

      if (!cloudReply?.text?.trim()) {
        throw new Error('AI yanıtı boş geldi.')
      }

      addMessage(snapshot.profile.id, 'assistant', cloudReply.text)
      setHelperMessage('Canlı veri bağlamı ile analiz güncellendi.')
    } catch (error) {
      try {
        const derivedReply = buildDerivedReply(trimmed, nextConversation)
        addMessage(snapshot.profile.id, 'assistant', derivedReply)
        setHelperMessage('Anlık fiyat, teknik, formasyon ve haber verileri birleştirilerek analiz üretildi.')
        setLastErrorMessage(error instanceof Error ? error.message : 'AI analizi üretilemedi.')
      } catch (derivedError) {
        setHelperMessage('')
        setLastErrorMessage(
          derivedError instanceof Error
            ? derivedError.message
            : 'Şu anda analiz üretilemedi. Lütfen birkaç saniye sonra tekrar dene.'
        )
      }
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Panel
      title="AI sohbet"
      subtitle={`${snapshot.profile.symbol} için doğrudan soru sor`}
      action={
        conversation.length ? (
          <button type="button" className="text-button" onClick={() => clearConversation(snapshot.profile.id)}>
            <Trash2 size={14} />
            Temizle
          </button>
        ) : undefined
      }
    >
      <div className="list-stack">
        <div className="filter-chip-row">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="chip"
              disabled={isGenerating}
              onClick={() => void sendQuestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {conversation.length ? (
          <div className="asset-ai-chat">
            {conversation.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === 'assistant'
                    ? 'asset-ai-chat__message asset-ai-chat__message--assistant'
                    : 'asset-ai-chat__message asset-ai-chat__message--user'
                }
              >
                <div className="list-card__header">
                  <strong>{message.role === 'assistant' ? 'AVY AI' : 'Sen'}</strong>
                  <span>{formatDateTime(message.createdAt)}</span>
                </div>
                <p>{message.text}</p>
              </article>
            ))}
          </div>
        ) : (
          <StateCard
            title="Sohbet başlat"
            description="Sorunu net yaz. AVY; fiyat, hacim, indikatör, formasyon ve haber verisini birlikte okuyarak cevap üretir."
          />
        )}

        {isGenerating ? (
          <StateCard
            title="AVY AI düşünüyor"
            description="Seçili varlığın güncel verileri ve son konuşma bağlamı işleniyor."
          />
        ) : null}

        {helperMessage ? <p className="hero-card__helper">{helperMessage}</p> : null}

        {lastErrorMessage && !helperMessage ? (
          <StateCard
            title="Analiz şu an tamamlanamadı"
            description={lastErrorMessage}
            action={
              lastQuestion ? (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={isGenerating}
                  onClick={() => void sendQuestion(lastQuestion)}
                >
                  <RefreshCcw size={14} />
                  Tekrar dene
                </button>
              ) : undefined
            }
          />
        ) : null}

        <div className="inline-form social-composer">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`${snapshot.profile.symbol} hakkında soru sor`}
            disabled={isGenerating}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !isGenerating) {
                event.preventDefault()
                void sendQuestion(draft)
              }
            }}
          />
          <button
            type="button"
            className="primary-button"
            disabled={isGenerating || !draft.trim()}
            onClick={() => void sendQuestion(draft)}
          >
            {isGenerating ? <Bot size={16} /> : <Send size={14} />}
            {isGenerating ? 'Yanıt hazırlanıyor' : 'Gönder'}
          </button>
        </div>
      </div>
    </Panel>
  )
}
