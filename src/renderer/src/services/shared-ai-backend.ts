import { getSocialBackendClient } from '@renderer/services/social-backend'
import { getSocialRuntimeConfig, isSocialConfigReady } from '@renderer/services/social-runtime-config'
import type { AssetAiChatRequest, AssetAiChatResponse } from '@shared/types/ai-chat'

const ASSET_AI_FUNCTION_NAME = 'asset-ai-chat'
const ASSET_AI_TIMEOUT_MS = 18_000
const ASSET_AI_RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504])

const coerceMessage = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (typeof value === 'object' && value !== null && 'message' in value) {
    const nested = (value as { message?: unknown }).message

    if (typeof nested === 'string' && nested.trim()) {
      return nested.trim()
    }
  }

  return ''
}

const normalizeFunctionError = (error: unknown): Error => {
  const message = coerceMessage(error)

  if (!message) {
    return new Error('AVY AI şu an yanıt veremiyor. Birazdan tekrar dene.')
  }

  if (
    message.includes('FunctionsFetchError') ||
    message.includes('Failed to send a request to the Edge Function') ||
    message.includes('Edge Function returned a non-2xx status code') ||
    message.includes('404') ||
    message.includes('Requested function was not found') ||
    message.includes('function was not found')
  ) {
    return new Error('AVY AI bulut servisi şu an hazır değil.')
  }

  if (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('JWT') ||
    message.includes('yetkisiz')
  ) {
    return new Error('AVY AI isteği yetkilendirilemedi. Birazdan tekrar dene.')
  }

  if (
    message.includes('AVY_SHARED_AI_NOT_CONFIGURED') ||
    message.includes('OPENAI_API_KEY') ||
    message.includes('shared AI not configured') ||
    message.includes('invalid_api_key') ||
    message.includes('Incorrect API key provided')
  ) {
    return new Error('AVY AI bulut ayarı şu an eksik.')
  }

  if (
    message.includes('insufficient_quota') ||
    message.includes('You exceeded your current quota') ||
    message.includes('billing details')
  ) {
    return new Error('AVY AI bulut yorumu şu an geçici olarak kullanılamıyor.')
  }

  return new Error(message)
}

const normalizeResponse = (payload: unknown): AssetAiChatResponse => {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'text' in payload &&
    typeof payload.text === 'string' &&
    payload.text.trim()
  ) {
    return {
      text: payload.text.trim(),
      model:
        typeof (payload as { model?: unknown }).model === 'string' &&
        (payload as { model?: string }).model?.trim()
          ? (payload as { model: string }).model.trim()
          : 'gpt-5.2',
      source: 'openai'
    }
  }

  throw new Error('AVY AI yanıtı boş geldi.')
}

const invokeSharedAi = async (
  supabaseUrl: string,
  supabaseAnonKey: string,
  request: AssetAiChatRequest
): Promise<Response> => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), ASSET_AI_TIMEOUT_MS)

  try {
    return await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/${ASSET_AI_FUNCTION_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey
      },
      body: JSON.stringify(request),
      signal: controller.signal
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('AVY AI yanıtı beklenenden uzun sürdü.')
    }

    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export const createSharedAssetAiReply = async (
  request: AssetAiChatRequest
): Promise<AssetAiChatResponse> => {
  const config = getSocialRuntimeConfig()

  if (!isSocialConfigReady(config)) {
    throw new Error('AI sohbet altyapısı bağlanamadı. Supabase bağlantısı eksik görünüyor.')
  }

  getSocialBackendClient(config)
  let response = await invokeSharedAi(config.supabaseUrl, config.supabaseAnonKey, request)

  if (!response.ok && ASSET_AI_RETRYABLE_STATUS.has(response.status)) {
    await new Promise((resolve) => window.setTimeout(resolve, 650))
    response = await invokeSharedAi(config.supabaseUrl, config.supabaseAnonKey, request)
  }

  if (!response.ok) {
    let payload: unknown = null

    try {
      payload = await response.json()
    } catch {
      try {
        payload = {
          message: await response.text()
        }
      } catch {
        payload = {
          message: ''
        }
      }
    }

    throw normalizeFunctionError({
      message: coerceMessage(payload) || `${response.status} ${response.statusText}`.trim()
    })
  }

  return normalizeResponse(await response.json())
}
