const ENV = import.meta.env || process.env || {}
const API_BASE = ENV.VITE_API_BASE_URL || '/api'
const NEST_READS_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  String(ENV.VITE_NEST_READS_ENABLED || '').trim().toLowerCase(),
)
const NEST_CONVERSATION_CREATE_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  String(ENV.VITE_NEST_CONVERSATION_CREATE_ENABLED || '').trim().toLowerCase(),
)
const NEST_CONVERSATION_WRITES_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  String(ENV.VITE_NEST_CONVERSATION_WRITES_ENABLED || '').trim().toLowerCase(),
)
const NEST_API_BASE = String(ENV.VITE_NEST_API_BASE_URL || '/nest-api').trim()

function getRequestUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

function shouldUseNestReadApi() {
  return NEST_READS_ENABLED && NEST_API_BASE
}

function shouldUseNestConversationCreateApi() {
  return NEST_CONVERSATION_CREATE_ENABLED && NEST_API_BASE
}

function shouldUseNestConversationWriteApi() {
  return NEST_CONVERSATION_WRITES_ENABLED && NEST_API_BASE
}

function shouldUseNestConversationMessageApi() {
  return shouldUseNestReadApi()
}

function requestAuth(path, options = {}) {
  return requestWithBaseUrl(NEST_API_BASE, path, options)
}

function requestJson(baseUrl, path, options = {}, requestConfig = {}) {
  const {
    credentials = 'include',
    headers = {},
  } = requestConfig

  return fetch(getRequestUrl(baseUrl, path), {
    credentials,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
      ...(options.headers || {}),
    },
    ...options,
  })
}

function isConversationRecord(payload) {
  return Boolean(
    payload
    && typeof payload === 'object'
    && Number.isInteger(Number(payload.id))
    && Number.isInteger(Number(payload.user_id)),
  )
}

function isMessageRecord(payload, conversationId) {
  return Boolean(
    payload
    && typeof payload === 'object'
    && Number.isInteger(Number(payload.id))
    && Number(payload.conversation_id) === Number(conversationId)
    && typeof payload.role === 'string'
    && typeof payload.content === 'string',
  )
}

async function requestNestWrite(path, options, validatePayload) {
  const response = await requestJson(NEST_API_BASE, path, options)

  if (!response.ok) {
    throw await parseErrorResponse(response, `Request failed with status ${response.status}`)
  }

  const payload = await response.json()

  if (!validatePayload(payload)) {
    throw new Error('Nest write response shape mismatch')
  }

  return payload
}

async function parseErrorResponse(response, fallbackMessage) {
  let message = fallbackMessage

  try {
    const payload = await response.json()
    message = payload.message || message
  } catch {
    // keep fallback message
  }

  const error = new Error(message)
  error.status = response.status
  error.response = response

  return error
}

async function request(path, options = {}) {
  return requestWithBaseUrl(API_BASE, path, options)
}

async function requestWithBaseUrl(baseUrl, path, options = {}) {
  const response = await requestJson(baseUrl, path, options)

  if (!response.ok) {
    throw await parseErrorResponse(response, `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

async function requestBlobWithBaseUrl(baseUrl, path, options = {}, fallbackMessage = 'Request failed') {
  const response = await fetch(getRequestUrl(baseUrl, path), {
    credentials: 'include',
    headers: {
      Accept: 'audio/mpeg',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    throw await parseErrorResponse(response, fallbackMessage)
  }

  return {
    blob: await response.blob(),
    headers: response.headers,
  }
}

export function listUsers() {
  return requestWithBaseUrl(NEST_API_BASE, '/users')
}

export function listProfiles() {
  return requestWithBaseUrl(NEST_API_BASE, '/profiles')
}

export function createProfile(payload) {
  return requestWithBaseUrl(NEST_API_BASE, '/profiles', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateProfile(profileId, payload) {
  return requestWithBaseUrl(NEST_API_BASE, `/profiles/${profileId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function setProfilePin(profileId, pin) {
  return requestWithBaseUrl(NEST_API_BASE, `/profiles/${profileId}/set-pin`, {
    method: 'POST',
    body: JSON.stringify({ pin }),
  })
}

export function resetProfilePin(profileId) {
  return requestWithBaseUrl(NEST_API_BASE, `/profiles/${profileId}/reset-pin`, {
    method: 'POST',
  })
}

export function deleteProfile(profileId) {
  return requestWithBaseUrl(NEST_API_BASE, `/profiles/${profileId}`, {
    method: 'DELETE',
  })
}

export function getTtsSettings() {
  return requestWithBaseUrl(NEST_API_BASE, '/tts-settings')
}

export function updateTtsSettings(payload) {
  return requestWithBaseUrl(NEST_API_BASE, '/tts-settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getTtsRuntimeSettings() {
  return requestWithBaseUrl(NEST_API_BASE, '/tts-runtime')
}

export function getImageProviderSettings() {
  return requestWithBaseUrl(NEST_API_BASE, '/image-provider-settings')
}

export function updateImageProviderSettings(payload) {
  return requestWithBaseUrl(NEST_API_BASE, '/image-provider-settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getImageProviderRuntimeSettings() {
  return requestWithBaseUrl(NEST_API_BASE, '/image-provider-runtime')
}

export function getOpenClawModelOptions() {
  return requestWithBaseUrl(NEST_API_BASE, '/openclaw-model-options')
}

export function getModelPresetSettings() {
  return requestWithBaseUrl(NEST_API_BASE, '/model-preset-settings')
}

export function updateModelPresetSettings(payload) {
  return requestWithBaseUrl(NEST_API_BASE, '/model-preset-settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function speakText(payload) {
  return requestBlobWithBaseUrl(NEST_API_BASE, '/tts/speak', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Unable to generate speech audio.')
}

export function getMe() {
  return requestAuth('/auth/me')
}

export function login(profileId, pin) {
  return requestAuth('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ profile_id: profileId, pin }),
  })
}

export function logout() {
  return requestAuth('/auth/logout', {
    method: 'POST',
  })
}

// ── WebAuthn / Biometric ────────────────────────────────────────────────────

export function getWebAuthnRegisterOptions() {
  return requestAuth('/auth/webauthn/register-options', { method: 'POST' })
}

export function postWebAuthnRegister(registrationResponse) {
  return requestAuth('/auth/webauthn/register', {
    method: 'POST',
    body: JSON.stringify(registrationResponse),
  })
}

export function getWebAuthnLoginOptions(profileId) {
  return requestAuth(`/auth/webauthn/login-options?profile_id=${profileId}`)
}

export function postWebAuthnLogin(profileId, authResponse) {
  return requestAuth('/auth/webauthn/login', {
    method: 'POST',
    body: JSON.stringify({ profile_id: profileId, response: authResponse }),
  })
}

export function listWebAuthnCredentials() {
  return requestAuth('/auth/webauthn/credentials')
}

export function deleteWebAuthnCredential(credentialId) {
  return requestAuth(`/auth/webauthn/credentials/${encodeURIComponent(credentialId)}`, {
    method: 'DELETE',
  })
}

export async function listConversations(userId, options = {}) {
  const params = new URLSearchParams()

  if (options.scope) {
    params.set('scope', options.scope)
  }

  if (options.search) {
    params.set('search', options.search)
  }

  if (options.limit) {
    params.set('limit', options.limit)
  }

  const query = params.toString()
  const path = `/users/${userId}/conversations${query ? `?${query}` : ''}`

  if (!shouldUseNestReadApi()) {
    return request(path)
  }

  return requestNestWrite(
    path,
    {},
    (payload) => Array.isArray(payload) && payload.every(
      (conversation) => isConversationRecord(conversation) && Number(conversation.user_id) === Number(userId),
    ),
  )
}

export async function createConversation(userId, payload) {
  if (shouldUseNestConversationCreateApi()) {
    return requestNestWrite(
      `/users/${userId}/conversations`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      (responsePayload) => isConversationRecord(responsePayload) && Number(responsePayload.user_id) === Number(userId),
    )
  }

  return request(`/users/${userId}/conversations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getConversation(conversationId) {
  const path = `/conversations/${conversationId}`

  if (!shouldUseNestReadApi()) {
    return request(path)
  }

  return requestNestWrite(path, {}, isConversationRecord)
}

async function requestNestConversationWrite(path, options) {
  if (shouldUseNestConversationWriteApi()) {
    return requestNestWrite(path, options, isConversationRecord)
  }

  return request(path, options)
}

export function updateConversation(conversationId, payload) {
  return requestNestConversationWrite(`/conversations/${conversationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function archiveConversation(conversationId) {
  return requestNestConversationWrite(`/conversations/${conversationId}/archive`, {
    method: 'POST',
  })
}

export function restoreConversation(conversationId) {
  return requestNestConversationWrite(`/conversations/${conversationId}/restore`, {
    method: 'POST',
  })
}

export function deleteConversation(conversationId) {
  return requestNestConversationWrite(`/conversations/${conversationId}`, {
    method: 'DELETE',
  })
}

export async function listMessages(conversationId) {
  const path = `/conversations/${conversationId}/messages`

  if (!shouldUseNestReadApi()) {
    return request(path)
  }

  return requestNestWrite(
    path,
    {},
    (payload) => Array.isArray(payload) && payload.every((message) => isMessageRecord(message, conversationId)),
  )
}

export async function uploadConversationAttachment(conversationId, file) {
  const formData = new FormData()
  formData.append('file', file)

  if (shouldUseNestConversationMessageApi()) {
    const response = await fetch(getRequestUrl(NEST_API_BASE, `/conversations/${conversationId}/attachments`), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
      body: formData,
    })

    if (!response.ok) {
      throw await parseErrorResponse(response, `Unable to upload attachment (${response.status})`)
    }

    return response.json()
  }

  const response = await fetch(`${API_BASE}/conversations/${conversationId}/attachments`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
    body: formData,
  })

  if (!response.ok) {
    throw await parseErrorResponse(response, `Unable to upload attachment (${response.status})`)
  }

  return response.json()
}

export function getGatewayStatus() {
  return requestWithBaseUrl(NEST_API_BASE, '/gateway/status')
}

export function getAgentSettings() {
  return requestWithBaseUrl(NEST_API_BASE, '/agent-settings')
}

export function updateAgentSettings(hearthAgentId) {
  return requestWithBaseUrl(NEST_API_BASE, '/agent-settings', {
    method: 'PUT',
    body: JSON.stringify({ hearthAgentId }),
  })
}

export function updateAgentDisplayName(name) {
  return requestWithBaseUrl(NEST_API_BASE, '/agent-display-name', {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

export function createUserEventStream(userId) {
  const url = `${NEST_API_BASE}/users/${userId}/events`
  return new EventSource(url, { withCredentials: true })
}

export function getPushPublicKey() {
  return requestWithBaseUrl(NEST_API_BASE, '/push/public-key')
}

export function savePushSubscription(userId, payload) {
  return requestWithBaseUrl(NEST_API_BASE, `/users/${userId}/push-subscriptions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updatePushPresence(userId, payload) {
  return requestWithBaseUrl(NEST_API_BASE, `/users/${userId}/push-subscriptions/presence`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deletePushSubscription(userId, endpoint) {
  return requestWithBaseUrl(NEST_API_BASE, `/users/${userId}/push-subscriptions`, {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  })
}

function createSseParser(onEvent) {
  let buffer = ''
  let eventName = 'message'
  let dataLines = []

  const emit = () => {
    if (dataLines.length === 0) {
      eventName = 'message'
      return
    }

    const data = dataLines.join('\n')
    let payload = data

    try {
      payload = JSON.parse(data)
    } catch {
      // non-JSON payloads can pass through as-is
    }

    onEvent({ event: eventName, data: payload })
    eventName = 'message'
    dataLines = []
  }

  return (chunk) => {
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith(':')) {
        continue
      }

      if (line === '') {
        emit()
        continue
      }

      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim() || 'message'
        continue
      }

      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      }
    }
  }
}

export async function streamConversationMessage(conversationId, payload, handlers = {}) {
  const requestUrl = shouldUseNestConversationMessageApi()
    ? getRequestUrl(NEST_API_BASE, `/conversations/${conversationId}/messages`)
    : `${API_BASE}/conversations/${conversationId}/messages`

  const response = await fetch(requestUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      stream: true,
    }),
    signal: handlers.signal,
  })

  if (!response.ok || !response.body) {
    throw await parseErrorResponse(response, `Unable to stream message (${response.status})`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const parse = createSseParser(({ event, data }) => {
    handlers.onEvent?.(event, data)

    if (event === 'message.created') {
      handlers.onUserMessage?.(data.message)
    }

    if (event === 'assistant.placeholder') {
      handlers.onAssistantPlaceholder?.(data.message, data)
    }

    if (event === 'assistant.message') {
      handlers.onAssistantMessage?.(data.message, data)
    }

    if (event === 'assistant.delta') {
      handlers.onAssistantDelta?.(data)
    }

    if (event === 'status') {
      handlers.onStatus?.(data)
    }

    if (event === 'progress') {
      handlers.onProgress?.(data)
    }

    if (event === 'done') {
      handlers.onDone?.(data)
    }

    if (event === 'error') {
      handlers.onErrorEvent?.(data)
    }

    if (event === 'conversation.updated') {
      handlers.onConversationUpdated?.(data)
    }
  })

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    parse(decoder.decode(value, { stream: true }))
  }

  parse(decoder.decode())
}

export async function getHealthStatus() {
  return requestWithBaseUrl(NEST_API_BASE, "/health")
}
