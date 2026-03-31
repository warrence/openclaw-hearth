function valueOrFallback(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return ''
}

export function contractForMessage(message) {
  return message?.contract_json || message?.contract || message?.metadata_json?.app_channel || message?.metadata?.app_channel || null
}

export function normalizeAppChannelMessage(message) {
  const contract = contractForMessage(message)
  const role = valueOrFallback(contract?.role, message?.role, 'assistant')
  const sentAt = valueOrFallback(contract?.sentAt, message?.sent_at, message?.created_at, null)
  const content = valueOrFallback(contract?.text, message?.content, '')
  const recordId = valueOrFallback(message?.id, '')
  const messageId = valueOrFallback(contract?.messageId, contract?.channelMessageId, message?.channel_message_id, recordId)
  const attachments = message?.attachments || message?.metadata_json?.attachments || message?.metadata?.attachments || []

  return {
    ...message,
    id: messageId,
    recordId,
    role,
    content,
    displayContent: valueOrFallback(message?.displayContent, content),
    sentAt,
    contract,
    attachments,
    meta: {
      ...(message?.meta || {}),
      contractEvent: valueOrFallback(message?.contract_event, contract?.event, ''),
      personIdentity: valueOrFallback(contract?.personIdentity, message?.person_identity, message?.metadata_json?.person_identity, ''),
      agentId: valueOrFallback(contract?.agentId, message?.agent_id, ''),
      replyToMessageId: valueOrFallback(contract?.replyToMessageId, message?.reply_to_message_id, ''),
      model: valueOrFallback(contract?.metadata?.model, message?.model, ''),
      usage: contract?.metadata?.usage || message?.metadata_json?.usage || null,
      openclawSessionId: valueOrFallback(contract?.metadata?.openclawSessionId, message?.metadata_json?.openclaw_session_id, ''),
      openclawSessionKey: valueOrFallback(contract?.metadata?.openclawSessionKey, message?.metadata_json?.openclaw_session_key, ''),
      attachments,
    },
  }
}

export function normalizeContractStatus(payload = {}) {
  const contract = payload?.contract || payload
  const state = valueOrFallback(contract?.status, payload?.state, '')
  const phase = valueOrFallback(contract?.phase, payload?.phase, '')
  const elapsedMs = contract?.elapsedMs ?? payload?.elapsed_ms ?? payload?.elapsedMs ?? 0

  return {
    state,
    phase,
    elapsedMs,
    label: valueOrFallback(payload?.label, buildStatusLabel(state, phase), state || 'Working'),
    note: payload?.note || '',
    contract,
    streamMode: valueOrFallback(payload?.stream_mode, contract?.metadata?.streamMode, ''),
    partialAvailable: payload?.partial_available,
  }
}

export function normalizeContractError(payload = {}) {
  const contract = payload?.contract || payload

  return {
    message: valueOrFallback(contract?.message, payload?.message, 'Message run failed.'),
    code: valueOrFallback(contract?.code, payload?.code, ''),
    retryable: contract?.retryable ?? payload?.retryable ?? null,
    elapsedMs: contract?.elapsedMs ?? payload?.elapsed_ms ?? payload?.elapsedMs ?? 0,
    contract,
  }
}

export function buildStatusLabel(state, phase) {
  const phaseLabel = phase ? phase.replace(/_/g, ' ') : ''

  switch (state) {
    case 'queued':
      return phaseLabel ? `Queued · ${phaseLabel}` : 'Queued'
    case 'running':
      return phaseLabel ? `Working · ${phaseLabel}` : 'Working'
    case 'completed':
      return phaseLabel ? `Completed · ${phaseLabel}` : 'Completed'
    case 'error':
      return phaseLabel ? `Error · ${phaseLabel}` : 'Error'
    case 'blocked':
      return phaseLabel ? `Blocked · ${phaseLabel}` : 'Blocked'
    default:
      return phaseLabel || state || 'Working'
  }
}
