import { createI18n } from 'vue-i18n'
import en from './messages/en'
import ms from './messages/ms'
import zhCN from './messages/zh-CN'

export const DEFAULT_LOCALE = 'en'
export const SUPPORTED_LOCALES = ['en', 'ms', 'zh-CN']
export const LOCALE_STORAGE_KEY = 'hearth.locale'

const messages = {
  en,
  ms,
  'zh-CN': zhCN,
}

function normalizeLocale(input) {
  if (!input) {
    return null
  }

  const raw = String(input).trim()
  if (!raw) {
    return null
  }

  if (SUPPORTED_LOCALES.includes(raw)) {
    return raw
  }

  const lower = raw.toLowerCase()

  if (lower.startsWith('zh')) {
    return 'zh-CN'
  }

  if (lower.startsWith('ms')) {
    return 'ms'
  }

  if (lower.startsWith('en')) {
    return 'en'
  }

  return null
}

function readStoredLocale() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY))
  } catch {
    return null
  }
}

function detectBrowserLocale() {
  if (typeof navigator === 'undefined') {
    return null
  }

  const candidates = [...(navigator.languages || []), navigator.language]

  for (const locale of candidates) {
    const normalized = normalizeLocale(locale)

    if (normalized) {
      return normalized
    }
  }

  return null
}

export function resolveInitialLocale() {
  return readStoredLocale() || detectBrowserLocale() || DEFAULT_LOCALE
}

function persistLocale(locale) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // best effort
  }
}

export function syncDocumentLanguage(locale) {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.setAttribute('lang', locale || DEFAULT_LOCALE)
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: resolveInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages,
  missingWarn: false,
  fallbackWarn: false,
})

export function setLocale(nextLocale) {
  const locale = normalizeLocale(nextLocale) || DEFAULT_LOCALE
  i18n.global.locale.value = locale
  persistLocale(locale)
  syncDocumentLanguage(locale)
  return locale
}
