import test from 'node:test'
import assert from 'node:assert/strict'

process.env.VITE_API_BASE_URL = 'http://localhost:3001/api'
process.env.VITE_NEST_API_BASE_URL = 'http://nest.test'
process.env.VITE_NEST_READS_ENABLED = 'true'
process.env.VITE_NEST_CONVERSATION_CREATE_ENABLED = 'false'
process.env.VITE_NEST_CONVERSATION_WRITES_ENABLED = 'false'

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => payload,
  }
}

function blobResponse(payload, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    blob: async () => new Blob([payload], { type: headers['Content-Type'] || 'audio/mpeg' }),
    json: async () => {
      throw new Error('Blob response should not be parsed as JSON')
    },
  }
}

function emptyResponse(status = 204) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => {
      throw new Error('Empty response should not be parsed as JSON')
    },
  }
}

function sseResponse() {
  const encoder = new TextEncoder()

  return {
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('event: done\ndata: {"ok":true}\n\n'))
        controller.close()
      },
    }),
    json: async () => {
      throw new Error('SSE response should not be parsed as JSON')
    },
  }
}

async function loadApiModule({
  readsEnabled = true,
  createEnabled = false,
  writesEnabled = false,
} = {}) {
  process.env.VITE_NEST_READS_ENABLED = readsEnabled ? 'true' : 'false'
  process.env.VITE_NEST_CONVERSATION_CREATE_ENABLED = createEnabled ? 'true' : 'false'
  process.env.VITE_NEST_CONVERSATION_WRITES_ENABLED = writesEnabled ? 'true' : 'false'

  return import(`./api.js?test=${Date.now()}-${Math.random()}`)
}

test('routes getMe to Nest auth instead of legacy auth', async () => {
  const calls = []
  const { getMe } = await loadApiModule()

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/auth/me') {
      return jsonResponse({ id: 7, name: 'Tester' })
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  const user = await getMe()

  assert.equal(user.id, 7)
  assert.deepEqual(
    calls.map(({ url }) => url),
    ['http://nest.test/auth/me'],
  )
  assert.equal(calls[0].options.credentials, 'include')
})

test('routes listUsers to Nest without legacy fallback', async () => {
  const calls = []
  const { listUsers } = await loadApiModule()

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/users') {
      return jsonResponse([{ id: 7, name: 'Tester', has_pin: true }])
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  const users = await listUsers()

  assert.equal(users[0].id, 7)
  assert.deepEqual(
    calls.map(({ url }) => url),
    ['http://nest.test/users'],
  )
  assert.equal(calls[0].options.credentials, 'include')
})

test('routes owner profile management calls to Nest with cookie credentials', async () => {
  const calls = []
  const {
    listProfiles,
    createProfile,
    updateProfile,
    setProfilePin,
    resetProfilePin,
  } = await loadApiModule()

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/profiles') {
      if (options.method === 'POST') {
        return jsonResponse({ id: 9, name: 'Alex', role: 'member' }, 201)
      }

      return jsonResponse([{ id: 7, name: 'Owner', has_pin: true }])
    }

    if (url === 'http://nest.test/profiles/9') {
      return jsonResponse({ id: 9, name: 'Alex', role: 'owner' })
    }

    if (url === 'http://nest.test/profiles/9/set-pin') {
      return jsonResponse({ ok: true, pin_set_at: '2026-03-25T01:02:03.000Z' })
    }

    if (url === 'http://nest.test/profiles/9/reset-pin') {
      return jsonResponse({ ok: true })
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  await listProfiles()
  await createProfile({ name: 'Alex', role: 'member' })
  await updateProfile(9, { role: 'owner' })
  await setProfilePin(9, '1234')
  await resetProfilePin(9)

  assert.deepEqual(
    calls.map(({ url }) => url),
    [
      'http://nest.test/profiles',
      'http://nest.test/profiles',
      'http://nest.test/profiles/9',
      'http://nest.test/profiles/9/set-pin',
      'http://nest.test/profiles/9/reset-pin',
    ],
  )
  assert.ok(calls.every(({ options }) => options.credentials === 'include'))
  assert.equal(calls[1].options.method, 'POST')
  assert.equal(calls[2].options.method, 'PATCH')
  assert.equal(calls[3].options.method, 'POST')
  assert.equal(calls[4].options.method, 'POST')
})

test('routes settings, runtime, model catalog, and gateway status calls to Nest with no legacy fallback', async () => {
  const calls = []
  const {
    getTtsSettings,
    updateTtsSettings,
    getTtsRuntimeSettings,
    getImageProviderSettings,
    updateImageProviderSettings,
    getImageProviderRuntimeSettings,
    getOpenClawModelOptions,
    getModelPresetSettings,
    updateModelPresetSettings,
    getGatewayStatus,
  } = await loadApiModule()

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/tts-settings') {
      if (options.method === 'PATCH') {
        return jsonResponse({ active_provider: 'openai' })
      }

      return jsonResponse({ active_provider: 'browser' })
    }

    if (url === 'http://nest.test/tts-runtime') {
      return jsonResponse({ active_provider: 'browser' })
    }

    if (url === 'http://nest.test/image-provider-settings') {
      if (options.method === 'PATCH') {
        return jsonResponse({ active_provider: 'openai', enabled: true })
      }

      return jsonResponse({ active_provider: 'disabled', enabled: false })
    }

    if (url === 'http://nest.test/image-provider-runtime') {
      return jsonResponse({ active_provider: 'openai', enabled: true })
    }

    if (url === 'http://nest.test/openclaw-model-options') {
      return jsonResponse({ catalog_source: 'openclaw-bridge', models: [] })
    }

    if (url === 'http://nest.test/model-preset-settings') {
      if (options.method === 'PATCH') {
        return jsonResponse({ presets: { fast: { model_id: 'openai/gpt-5.4' } } })
      }

      return jsonResponse({ presets: { fast: { model_id: 'openai-codex/gpt-5.4' } } })
    }

    if (url === 'http://nest.test/gateway/status') {
      return jsonResponse({ status: 'online' })
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  await getTtsSettings()
  await updateTtsSettings({ active_provider: 'openai' })
  await getTtsRuntimeSettings()
  await getImageProviderSettings()
  await updateImageProviderSettings({ active_provider: 'openai' })
  await getImageProviderRuntimeSettings()
  await getOpenClawModelOptions()
  await getModelPresetSettings()
  await updateModelPresetSettings({
    presets: {
      fast: { model_id: 'openai/gpt-5.4' },
      deep: { model_id: 'anthropic/claude-sonnet-4-5' },
    },
  })
  await getGatewayStatus()

  assert.deepEqual(
    calls.map(({ url }) => url),
    [
      'http://nest.test/tts-settings',
      'http://nest.test/tts-settings',
      'http://nest.test/tts-runtime',
      'http://nest.test/image-provider-settings',
      'http://nest.test/image-provider-settings',
      'http://nest.test/image-provider-runtime',
      'http://nest.test/openclaw-model-options',
      'http://nest.test/model-preset-settings',
      'http://nest.test/model-preset-settings',
      'http://nest.test/gateway/status',
    ],
  )
  assert.ok(calls.every(({ options }) => options.credentials === 'include'))
  assert.equal(calls[1].options.method, 'PATCH')
  assert.equal(calls[4].options.method, 'PATCH')
  assert.equal(calls[8].options.method, 'PATCH')
})

test('routes push subscription calls to Nest with cookie credentials', async () => {
  const calls = []
  const {
    getPushPublicKey,
    savePushSubscription,
    updatePushPresence,
    deletePushSubscription,
  } = await loadApiModule()

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/push/public-key') {
      return jsonResponse({ public_key: 'public-key' })
    }

    if (url === 'http://nest.test/users/7/push-subscriptions') {
      if (options.method === 'DELETE') {
        return emptyResponse(204)
      }

      return jsonResponse({ id: 11, endpoint: 'https://push.test/sub/1' }, 201)
    }

    if (url === 'http://nest.test/users/7/push-subscriptions/presence') {
      return jsonResponse({ ok: true, debug: { mode: 'exact' } })
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  await getPushPublicKey()
  await savePushSubscription(7, {
    endpoint: 'https://push.test/sub/1',
    keys: { p256dh: 'key', auth: 'auth' },
  })
  await updatePushPresence(7, {
    endpoint: 'https://push.test/sub/1',
    conversation_id: 42,
    is_visible: true,
  })
  await deletePushSubscription(7, 'https://push.test/sub/1')

  assert.deepEqual(
    calls.map(({ url }) => url),
    [
      'http://nest.test/push/public-key',
      'http://nest.test/users/7/push-subscriptions',
      'http://nest.test/users/7/push-subscriptions/presence',
      'http://nest.test/users/7/push-subscriptions',
    ],
  )
  assert.ok(calls.every(({ options }) => options.credentials === 'include'))
  assert.equal(calls[1].options.method, 'POST')
  assert.equal(calls[2].options.method, 'POST')
  assert.equal(calls[3].options.method, 'DELETE')
})

test('routes speakText to Nest and keeps audio headers accessible', async () => {
  const calls = []
  const { speakText } = await loadApiModule()

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/tts/speak') {
      return blobResponse('audio-data', 200, {
        'Content-Type': 'audio/mpeg',
        'X-TTS-Provider': 'openai',
      })
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  const response = await speakText({ text: 'hello' })

  assert.equal(await response.blob.text(), 'audio-data')
  assert.equal(response.headers.get('x-tts-provider'), 'openai')
  assert.deepEqual(
    calls.map(({ url }) => url),
    ['http://nest.test/tts/speak'],
  )
  assert.equal(calls[0].options.credentials, 'include')
  assert.equal(calls[0].options.method, 'POST')
})

test('routes login to Nest auth and preserves cookie-capable credentials', async () => {
  const calls = []
  const { login } = await loadApiModule()

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/auth/login') {
      return jsonResponse({ id: 7, name: 'Tester' })
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  await login(7, '1234')

  assert.deepEqual(
    calls.map(({ url }) => url),
    ['http://nest.test/auth/login'],
  )
  assert.equal(calls[0].options.credentials, 'include')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.body, JSON.stringify({ profile_id: 7, pin: '1234' }))
})

test('routes logout to Nest auth instead of legacy auth', async () => {
  const calls = []
  const { logout } = await loadApiModule()

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/auth/logout') {
      return jsonResponse({ ok: true })
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  const payload = await logout()

  assert.deepEqual(payload, { ok: true })
  assert.deepEqual(
    calls.map(({ url }) => url),
    ['http://nest.test/auth/logout'],
  )
  assert.equal(calls[0].options.credentials, 'include')
  assert.equal(calls[0].options.method, 'POST')
})

test('uses the Nest session for conversation lists without auth bootstrap or x-actor-user-id', async () => {
  const calls = []
  const { listConversations } = await loadApiModule()

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/users/7/conversations?search=tokyo&limit=2') {
      return jsonResponse([
        { id: 42, user_id: 7, title: 'Tokyo' },
      ])
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  const conversations = await listConversations(7, { search: 'tokyo', limit: 2 })

  assert.equal(conversations[0].id, 42)
  assert.deepEqual(
    calls.map(({ url }) => url),
    ['http://nest.test/users/7/conversations?search=tokyo&limit=2'],
  )
  assert.equal(calls[0].options.credentials, 'include')
  assert.equal(calls[0].options.headers['x-actor-user-id'], undefined)
})

test('fails on Nest conversation detail errors instead of silently falling back to legacy', async () => {
  const calls = []
  const { getConversation } = await loadApiModule()

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/conversations/42') {
      return jsonResponse({ message: 'Nest detail failed' }, 502)
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  await assert.rejects(
    () => getConversation(42),
    /Nest detail failed/,
  )

  assert.deepEqual(
    calls.map(({ url }) => url),
    ['http://nest.test/conversations/42'],
  )
})

test('uses Nest create conversation with credentials when the create flag is enabled', async () => {
  const calls = []
  const { createConversation } = await loadApiModule({ createEnabled: true })

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/users/7/conversations') {
      return jsonResponse({ id: 202, user_id: 7, title: 'Nest chat' })
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  const conversation = await createConversation(7, { title: 'Nest chat', agent_id: 'aeris' })

  assert.equal(conversation.id, 202)
  assert.equal(calls[0].options.credentials, 'include')
  assert.equal(calls[0].options.headers['x-actor-user-id'], undefined)
})

test('uses Nest conversation writes with credentials when the writes flag is enabled', async () => {
  const calls = []
  const { updateConversation } = await loadApiModule({ writesEnabled: true })

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/conversations/42') {
      return jsonResponse({ id: 42, user_id: 7, title: 'Renamed chat' })
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  const conversation = await updateConversation(42, { title: 'Renamed chat' })

  assert.equal(conversation.title, 'Renamed chat')
  assert.equal(calls[0].options.credentials, 'include')
})

test('uses Nest for message lists without x-actor-user-id', async () => {
  const calls = []
  const { listMessages } = await loadApiModule()

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/conversations/42/messages') {
      return jsonResponse([{ id: 1, conversation_id: 42, role: 'user', content: 'hello' }])
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  const messages = await listMessages(42)

  assert.equal(messages.length, 1)
  assert.equal(calls[0].options.credentials, 'include')
  assert.equal(calls[0].options.headers['x-actor-user-id'], undefined)
})

test('uses Nest for attachment uploads with cookie credentials', async () => {
  const calls = []
  const { uploadConversationAttachment } = await loadApiModule()

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/conversations/42/attachments') {
      return jsonResponse({ attachment: { id: 9, name: 'hello.txt' } }, 201)
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  const payload = await uploadConversationAttachment(
    42,
    new File(['hello'], 'hello.txt', { type: 'text/plain' }),
  )

  assert.equal(payload.attachment.id, 9)
  assert.equal(calls[0].options.credentials, 'include')
  assert.equal(calls[0].options.headers['x-actor-user-id'], undefined)
})

test('uses Nest for streaming message requests with cookie credentials', async () => {
  const calls = []
  const events = []
  const { streamConversationMessage } = await loadApiModule()

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options })

    if (url === 'http://nest.test/conversations/42/messages') {
      return sseResponse()
    }

    throw new Error(`Unexpected fetch: ${url}`)
  }

  await streamConversationMessage(42, { content: 'hello' }, {
    onDone(payload) {
      events.push(payload)
    },
  })

  assert.deepEqual(events, [{ ok: true }])
  assert.equal(calls[0].options.credentials, 'include')
  assert.equal(calls[0].options.headers['x-actor-user-id'], undefined)
})
