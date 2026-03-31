<template>
  <div class="tts-card q-mt-md">
    <div class="tts-card__header tts-card__header--clickable" @click="imagesExpanded = !imagesExpanded">
      <div>
        <div class="dashboard-card__label">Images</div>
        <div class="tts-card__title">Provider settings</div>
      </div>
      <q-icon :name="imagesExpanded ? 'expand_less' : 'expand_more'" size="24px" />
    </div>

    <div v-show="imagesExpanded">
      <div v-if="imageSettingsLoading" class="profiles-card__empty q-mt-md">
        <q-spinner color="primary" size="24px" />
      </div>

      <div v-else class="tts-card__body q-mt-md">
        <div class="dashboard-card__caption">
          This only configures the backend-owned image provider foundation for later generate and edit flows. Saved API keys stay masked after write.
        </div>

        <q-select
          v-model="imageSettingsForm.activeProvider"
          :options="imageProviderOptions"
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
                <div class="tts-provider-panel__title">Disabled</div>
                <div class="tts-provider-panel__caption">No backend image provider will be used until a provider is selected and configured.</div>
              </div>
              <q-chip dense square class="dashboard-chip">Safe default</q-chip>
            </div>
          </div>

          <div class="tts-provider-panel">
            <div class="tts-provider-panel__header">
              <div>
                <div class="tts-provider-panel__title">OpenAI</div>
                <div class="tts-provider-panel__caption">
                  {{ imageProviderStatus('openai') }}
                </div>
              </div>
              <q-chip dense square class="dashboard-chip">
                {{ imageSettings.providers.openai.has_api_key ? 'Configured' : 'Not configured' }}
              </q-chip>
            </div>

            <q-input
              v-model="imageSettingsForm.openaiApiKey"
              type="password"
              label="OpenAI API key"
              dense
              dark
              outlined
              autocomplete="off"
              class="q-mt-md"
              hint="Leave blank to keep the saved key."
            />

            <div v-if="imageSettings.providers.openai.api_key_masked" class="tts-provider-panel__saved q-mt-sm">
              Saved key: {{ imageSettings.providers.openai.api_key_masked }}
            </div>

            <q-input
              v-model="imageSettingsForm.openaiDefaultModel"
              label="Default image model"
              dense
              dark
              outlined
              class="q-mt-md"
              hint="Optional. Example: gpt-image-1"
            />

            <div class="image-provider-defaults-grid q-mt-md">
              <q-select
                v-model="imageSettingsForm.openaiDefaultSize"
                :options="imageSizeOptions"
                option-value="value"
                option-label="label"
                emit-value
                map-options
                label="Default size"
                dense
                dark
                outlined
                hint="Choose the default image shape for generated images."
              />

              <q-select
                v-model="imageSettingsForm.openaiDefaultQuality"
                :options="imageQualityOptions"
                option-value="value"
                option-label="label"
                emit-value
                map-options
                label="Default quality"
                dense
                dark
                outlined
                hint="Higher quality can improve detail, but may be slower or cost more."
              />
            </div>

            <q-btn
              flat
              no-caps
              color="warning"
              icon="delete"
              label="Clear saved OpenAI key"
              class="q-mt-sm"
              :disable="!imageSettings.providers.openai.has_api_key"
              @click="clearImageProviderKey('openai')"
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
          label="Save image settings"
          size="sm"
          :loading="imageSettingsSaving"
          @click="saveImageSettings"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { getImageProviderSettings, updateImageProviderSettings } from 'src/lib/api'

const $q = useQuasar()
const imagesExpanded = ref(false)
const imageSettingsLoading = ref(false)
const imageSettingsSaving = ref(false)

const imageProviderOptions = [
  { label: 'Disabled', value: 'disabled' },
  { label: 'OpenAI', value: 'openai' },
]

const imageSizeOptions = [
  { label: 'Square · 1024 × 1024', value: '1024x1024' },
  { label: 'Landscape · 1536 × 1024', value: '1536x1024' },
  { label: 'Portrait · 1024 × 1536', value: '1024x1536' },
]

const imageQualityOptions = [
  { label: 'Auto · recommended balance', value: 'auto' },
  { label: 'High · sharper details, slower / higher cost', value: 'high' },
  { label: 'Medium · faster / lower cost', value: 'medium' },
]

function createDefaultImageSettings() {
  return {
    active_provider: 'disabled',
    enabled: false,
    providers: {
      disabled: { configured: true },
      openai: {
        configured: false,
        enabled: false,
        has_api_key: false,
        api_key_masked: null,
        default_model: 'gpt-image-1',
        default_size: '1024x1024',
        default_quality: 'auto',
      },
    },
    updated_at: null,
  }
}

function createDefaultImageSettingsForm() {
  return {
    activeProvider: 'disabled',
    openaiApiKey: '',
    openaiDefaultModel: 'gpt-image-1',
    openaiDefaultSize: '1024x1024',
    openaiDefaultQuality: 'auto',
    clearOpenaiKey: false,
  }
}

const imageSettings = ref(createDefaultImageSettings())
const imageSettingsForm = ref(createDefaultImageSettingsForm())

onMounted(() => {
  loadImageSettings()
})

async function loadImageSettings() {
  imageSettingsLoading.value = true

  try {
    const payload = await getImageProviderSettings()
    imageSettings.value = payload
    hydrateImageSettingsForm(payload)
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  } finally {
    imageSettingsLoading.value = false
  }
}

function hydrateImageSettingsForm(payload) {
  imageSettingsForm.value = {
    activeProvider: payload.active_provider || 'disabled',
    openaiApiKey: '',
    openaiDefaultModel: payload.providers?.openai?.default_model || 'gpt-image-1',
    openaiDefaultSize: payload.providers?.openai?.default_size || '1024x1024',
    openaiDefaultQuality: payload.providers?.openai?.default_quality || 'auto',
    clearOpenaiKey: false,
  }
}

function clearImageProviderKey(provider) {
  if (provider === 'openai') {
    imageSettingsForm.value.openaiApiKey = ''
    imageSettingsForm.value.clearOpenaiKey = true
  }
}

function imageProviderStatus(provider) {
  const config = imageSettings.value.providers?.[provider]

  if (!config?.has_api_key) {
    return 'No backend credential saved yet.'
  }

  return `Saved key ${config.api_key_masked} • model ${config.default_model} • size ${config.default_size} • quality ${config.default_quality}`
}

async function saveImageSettings() {
  if (imageSettingsSaving.value) return

  imageSettingsSaving.value = true

  const payload = {
    active_provider: imageSettingsForm.value.activeProvider,
    openai_default_model: imageSettingsForm.value.openaiDefaultModel,
    openai_default_size: imageSettingsForm.value.openaiDefaultSize,
    openai_default_quality: imageSettingsForm.value.openaiDefaultQuality,
  }

  if (imageSettingsForm.value.openaiApiKey.trim()) {
    payload.openai_api_key = imageSettingsForm.value.openaiApiKey.trim()
  } else if (imageSettingsForm.value.clearOpenaiKey) {
    payload.openai_api_key = ''
  }

  try {
    const response = await updateImageProviderSettings(payload)
    imageSettings.value = response
    hydrateImageSettingsForm(response)
    $q.notify({ type: 'positive', message: 'Image provider settings updated.' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  } finally {
    imageSettingsSaving.value = false
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

.image-provider-defaults-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
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

  .image-provider-defaults-grid {
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
