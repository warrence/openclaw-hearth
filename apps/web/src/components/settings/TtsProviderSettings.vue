<template>
  <div class="tts-card q-mt-md">
    <div class="tts-card__header tts-card__header--clickable" @click="ttsExpanded = !ttsExpanded">
      <div>
        <div class="dashboard-card__label">Text to speech</div>
        <div class="tts-card__title">Provider settings</div>
      </div>
      <q-icon :name="ttsExpanded ? 'expand_less' : 'expand_more'" size="24px" />
    </div>

    <div v-show="ttsExpanded">
      <div v-if="ttsLoading" class="profiles-card__empty q-mt-md">
        <q-spinner color="primary" size="24px" />
      </div>

      <div v-else class="tts-card__body q-mt-md">
        <div class="dashboard-card__caption">
          Credentials stay backend-owned. Saved API keys only come back as masked status metadata after save.
        </div>

        <q-select
          v-model="ttsForm.activeProvider"
          :options="ttsProviderOptions"
          option-value="value"
          option-label="label"
          emit-value
          map-options
          label="Active provider"
          dense
          dark
          outlined
          class="q-mt-md"
        />

        <div class="tts-provider-grid q-mt-md">
          <div class="tts-provider-panel">
            <div class="tts-provider-panel__header">
              <div>
                <div class="tts-provider-panel__title">Browser</div>
                <div class="tts-provider-panel__caption">Uses the client device speech engine. No server credential required.</div>
              </div>
              <q-chip dense square class="dashboard-chip">Local only</q-chip>
            </div>
          </div>

          <div class="tts-provider-panel">
            <div class="tts-provider-panel__header">
              <div>
                <div class="tts-provider-panel__title">OpenAI</div>
                <div class="tts-provider-panel__caption">
                  {{ ttsProviderStatus('openai') }}
                </div>
              </div>
              <q-chip dense square class="dashboard-chip">
                {{ ttsSettings.providers.openai.has_api_key ? 'Configured' : 'Not configured' }}
              </q-chip>
            </div>

            <q-input
              v-model="ttsForm.openaiApiKey"
              type="password"
              label="OpenAI API key"
              dense
              dark
              outlined
              autocomplete="off"
              class="q-mt-md"
              hint="Leave blank to keep the saved key."
            />

            <div v-if="ttsSettings.providers.openai.api_key_masked" class="tts-provider-panel__saved q-mt-sm">
              Saved key: {{ ttsSettings.providers.openai.api_key_masked }}
            </div>

            <q-input
              v-model="ttsForm.openaiDefaultVoice"
              label="Default OpenAI voice"
              dense
              dark
              outlined
              class="q-mt-md"
              hint="Optional. Example: alloy"
            />

            <q-btn
              flat
              no-caps
              color="warning"
              icon="delete"
              label="Clear saved OpenAI key"
              class="q-mt-sm"
              :disable="!ttsSettings.providers.openai.has_api_key"
              @click="clearProviderKey('openai')"
            />
          </div>

          <div class="tts-provider-panel">
            <div class="tts-provider-panel__header">
              <div>
                <div class="tts-provider-panel__title">ElevenLabs</div>
                <div class="tts-provider-panel__caption">
                  {{ ttsProviderStatus('elevenlabs') }}
                </div>
              </div>
              <q-chip dense square class="dashboard-chip">
                {{ ttsSettings.providers.elevenlabs.has_api_key ? 'Configured' : 'Not configured' }}
              </q-chip>
            </div>

            <q-input
              v-model="ttsForm.elevenlabsApiKey"
              type="password"
              label="ElevenLabs API key"
              dense
              dark
              outlined
              autocomplete="off"
              class="q-mt-md"
              hint="Leave blank to keep the saved key."
            />

            <div v-if="ttsSettings.providers.elevenlabs.api_key_masked" class="tts-provider-panel__saved q-mt-sm">
              Saved key: {{ ttsSettings.providers.elevenlabs.api_key_masked }}
            </div>

            <q-input
              v-model="ttsForm.elevenlabsDefaultVoice"
              label="Default ElevenLabs voice"
              dense
              dark
              outlined
              class="q-mt-md"
              hint="Optional. Store a voice id or name."
            />

            <q-btn
              flat
              no-caps
              color="warning"
              icon="delete"
              label="Clear saved ElevenLabs key"
              class="q-mt-sm"
              :disable="!ttsSettings.providers.elevenlabs.has_api_key"
              @click="clearProviderKey('elevenlabs')"
            />
          </div>
        </div>
      </div>

      <div class="q-mt-md q-px-md q-pb-md">
        <q-btn
          color="primary"
          unelevated
          no-caps
          rounded
          icon="save"
          label="Save TTS settings"
          size="sm"
          :loading="ttsSaving"
          @click="saveTtsSettings"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { getTtsSettings, updateTtsSettings } from 'src/lib/api'

const $q = useQuasar()
const ttsExpanded = ref(false)
const ttsLoading = ref(false)
const ttsSaving = ref(false)

const ttsProviderOptions = [
  { label: 'Browser', value: 'browser' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'ElevenLabs', value: 'elevenlabs' },
]

function createDefaultTtsSettings() {
  return {
    active_provider: 'browser',
    providers: {
      browser: { configured: true },
      openai: { configured: false, has_api_key: false, api_key_masked: null, default_voice: '' },
      elevenlabs: { configured: false, has_api_key: false, api_key_masked: null, default_voice: '' },
    },
    updated_at: null,
  }
}

function createDefaultTtsForm() {
  return {
    activeProvider: 'browser',
    openaiApiKey: '',
    openaiDefaultVoice: '',
    clearOpenaiKey: false,
    elevenlabsApiKey: '',
    elevenlabsDefaultVoice: '',
    clearElevenlabsKey: false,
  }
}

const ttsSettings = ref(createDefaultTtsSettings())
const ttsForm = ref(createDefaultTtsForm())

onMounted(() => {
  loadTtsSettings()
})

async function loadTtsSettings() {
  ttsLoading.value = true

  try {
    const payload = await getTtsSettings()
    ttsSettings.value = payload
    hydrateTtsForm(payload)
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  } finally {
    ttsLoading.value = false
  }
}

function hydrateTtsForm(payload) {
  ttsForm.value = {
    activeProvider: payload.active_provider || 'browser',
    openaiApiKey: '',
    openaiDefaultVoice: payload.providers?.openai?.default_voice || '',
    clearOpenaiKey: false,
    elevenlabsApiKey: '',
    elevenlabsDefaultVoice: payload.providers?.elevenlabs?.default_voice || '',
    clearElevenlabsKey: false,
  }
}

function clearProviderKey(provider) {
  if (provider === 'openai') {
    ttsForm.value.openaiApiKey = ''
    ttsForm.value.clearOpenaiKey = true
  }

  if (provider === 'elevenlabs') {
    ttsForm.value.elevenlabsApiKey = ''
    ttsForm.value.clearElevenlabsKey = true
  }
}

function ttsProviderStatus(provider) {
  const config = ttsSettings.value.providers?.[provider]

  if (!config?.has_api_key) {
    return 'No backend credential saved yet.'
  }

  return `Saved key ${config.api_key_masked}${config.default_voice ? ` • default voice ${config.default_voice}` : ''}`
}

async function saveTtsSettings() {
  if (ttsSaving.value) return

  ttsSaving.value = true

  const payload = {
    active_provider: ttsForm.value.activeProvider,
    openai_default_voice: ttsForm.value.openaiDefaultVoice,
    elevenlabs_default_voice: ttsForm.value.elevenlabsDefaultVoice,
  }

  if (ttsForm.value.openaiApiKey.trim()) {
    payload.openai_api_key = ttsForm.value.openaiApiKey.trim()
  } else if (ttsForm.value.clearOpenaiKey) {
    payload.openai_api_key = ''
  }

  if (ttsForm.value.elevenlabsApiKey.trim()) {
    payload.elevenlabs_api_key = ttsForm.value.elevenlabsApiKey.trim()
  } else if (ttsForm.value.clearElevenlabsKey) {
    payload.elevenlabs_api_key = ''
  }

  try {
    const response = await updateTtsSettings(payload)
    ttsSettings.value = response
    hydrateTtsForm(response)
    $q.notify({ type: 'positive', message: 'TTS settings updated.' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  } finally {
    ttsSaving.value = false
  }
}
</script>

<style scoped lang="scss">
.tts-card {
  background: color-mix(in srgb, var(--hearth-surface) 88%, transparent);
  border: 1px solid var(--hearth-border);
  border-radius: 28px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  padding: 22px;
}

.tts-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.tts-card__header--clickable {
  cursor: pointer;
  user-select: none;
}

.tts-card__title {
  margin-top: 8px;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--hearth-text);
}

.dashboard-card__label {
  color: var(--hearth-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.72rem;
  font-weight: 700;
}

.dashboard-card__caption {
  color: var(--hearth-text-muted);
  font-size: 0.96rem;
  margin-top: 10px;
  max-width: 760px;
  line-height: 1.7;
}

.dashboard-chip {
  background: var(--hearth-surface-elevated);
  color: var(--hearth-text);
  border: 1px solid var(--hearth-border);
}

.tts-provider-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.tts-provider-panel {
  border: 1px solid var(--hearth-border);
  border-radius: 20px;
  background: color-mix(in srgb, var(--hearth-surface-elevated) 86%, transparent);
  padding: 18px;
  min-width: 0;
  overflow: hidden;
}

.tts-provider-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.tts-provider-panel__header > :first-child {
  flex: 1 1 220px;
  min-width: 0;
}

.tts-provider-panel__title {
  color: var(--hearth-text);
  font-size: 1rem;
  font-weight: 700;
}

.tts-provider-panel__caption,
.tts-provider-panel__saved {
  color: var(--hearth-text-muted);
  font-size: 0.88rem;
  line-height: 1.6;
}

.profiles-card__empty {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

@media (max-width: 1024px) {
  .tts-provider-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .tts-card {
    padding-left: 16px;
    padding-right: 16px;
  }

  .tts-card__header {
    align-items: stretch;
  }

  .tts-card__header .q-btn {
    width: 100%;
  }

  .tts-provider-panel {
    padding: 16px;
  }

  .tts-provider-panel__header .q-chip {
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
  }
}
</style>
