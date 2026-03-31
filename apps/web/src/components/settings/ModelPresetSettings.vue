<template>
  <div class="tts-card q-mt-md">
    <div class="tts-card__header tts-card__header--clickable" @click="modelsExpanded = !modelsExpanded">
      <div>
        <div class="dashboard-card__label">Models</div>
        <div class="tts-card__title">Fast and Deep presets</div>
      </div>
      <q-icon :name="modelsExpanded ? 'expand_less' : 'expand_more'" size="24px" />
    </div>

    <div v-show="modelsExpanded">
      <div v-if="modelPresetLoading" class="profiles-card__empty q-mt-md">
        <q-spinner color="primary" size="24px" />
      </div>

      <div v-else class="tts-card__body q-mt-md">
        <div class="dashboard-card__caption">
          This is an OpenClaw-first bridge. Hearth stores Fast and Deep choices, but available model ids and control metadata come from the OpenClaw-facing catalog layer instead of a separate Hearth registry.
        </div>

        <div class="model-preset-grid q-mt-md">
          <div v-for="preset in ['fast', 'deep']" :key="preset" class="tts-provider-panel">
            <div class="tts-provider-panel__header">
              <div>
                <div class="tts-provider-panel__title">{{ preset === 'fast' ? 'Fast preset' : 'Deep preset' }}</div>
                <div class="tts-provider-panel__caption">
                  {{ modelCapabilitySummary(selectedModelOption(preset)) }}
                </div>
              </div>
              <q-chip dense square class="dashboard-chip">
                {{ selectedModelOption(preset)?.provider || 'unknown' }}
              </q-chip>
            </div>

            <q-select
              v-model="modelPresetForm[preset].modelId"
              :options="modelOptionItems"
              option-value="value"
              option-label="label"
              option-caption="caption"
              emit-value
              map-options
              label="Model"
              dense
              dark
              outlined
              class="q-mt-md"
              @update:model-value="normalizePresetControls(preset)"
            />

            <q-select
              v-if="selectedModelCapabilities(preset).supports_think_level"
              v-model="modelPresetForm[preset].thinkLevel"
              :options="thinkLevelOptions(preset)"
              option-value="value"
              option-label="label"
              emit-value
              map-options
              clearable
              label="Think level"
              dense
              dark
              outlined
              class="q-mt-md"
            />

            <q-toggle
              v-if="selectedModelCapabilities(preset).supports_reasoning_toggle"
              v-model="modelPresetForm[preset].reasoningEnabled"
              checked-icon="psychology"
              unchecked-icon="psychology_alt"
              color="primary"
              class="q-mt-md"
              label="Reasoning enabled"
            />

            <div class="tts-provider-panel__saved q-mt-md">
              Saved: {{ modelPresetSettings.presets?.[preset]?.model_id || 'Not configured' }}
            </div>
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
          label="Save model settings"
          size="sm"
          :loading="modelPresetSaving"
          @click="saveModelPresetSettings"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { getModelPresetSettings, getOpenClawModelOptions, updateModelPresetSettings } from 'src/lib/api'

const $q = useQuasar()
const modelsExpanded = ref(false)
const modelPresetLoading = ref(false)
const modelPresetSaving = ref(false)

function createDefaultModelCatalog() {
  return { catalog_source: 'openclaw-bridge', models: [] }
}

function createDefaultModelPresetSettings() {
  return {
    catalog_source: 'openclaw-bridge',
    presets: {
      fast: { model_id: '', think_level: null, reasoning_enabled: null, capabilities: { supports_think_level: false, supports_reasoning_toggle: false, think_levels: [] } },
      deep: { model_id: '', think_level: null, reasoning_enabled: null, capabilities: { supports_think_level: false, supports_reasoning_toggle: false, think_levels: [] } },
    },
    updated_at: null,
  }
}

function createDefaultModelPresetForm() {
  return {
    fast: { modelId: '', thinkLevel: null, reasoningEnabled: null },
    deep: { modelId: '', thinkLevel: null, reasoningEnabled: null },
  }
}

const modelCatalog = ref(createDefaultModelCatalog())
const modelPresetSettings = ref(createDefaultModelPresetSettings())
const modelPresetForm = ref(createDefaultModelPresetForm())

onMounted(() => {
  loadModelSettingsFoundation()
})

async function loadModelSettingsFoundation() {
  modelPresetLoading.value = true

  try {
    const [optionsPayload, settingsPayload] = await Promise.all([
      getOpenClawModelOptions(),
      getModelPresetSettings(),
    ])

    modelCatalog.value = optionsPayload
    modelPresetSettings.value = settingsPayload
    hydrateModelPresetForm(settingsPayload)
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  } finally {
    modelPresetLoading.value = false
  }
}

function hydrateModelPresetForm(payload) {
  modelPresetForm.value = {
    fast: {
      modelId: payload.presets?.fast?.model_id || '',
      thinkLevel: payload.presets?.fast?.think_level ?? null,
      reasoningEnabled: payload.presets?.fast?.reasoning_enabled ?? null,
    },
    deep: {
      modelId: payload.presets?.deep?.model_id || '',
      thinkLevel: payload.presets?.deep?.think_level ?? null,
      reasoningEnabled: payload.presets?.deep?.reasoning_enabled ?? null,
    },
  }

  normalizePresetControls('fast')
  normalizePresetControls('deep')
}

const modelOptionItems = computed(() =>
  (modelCatalog.value.models || []).map((model) => ({
    label: `${model.label} (${model.id})`,
    value: model.id,
    caption: `${model.provider} • ${model.source}`,
  })),
)

function selectedModelOption(preset) {
  return (modelCatalog.value.models || []).find((model) => model.id === modelPresetForm.value[preset].modelId) || null
}

function selectedModelCapabilities(preset) {
  return selectedModelOption(preset)?.capabilities || {
    supports_think_level: false,
    supports_reasoning_toggle: false,
    think_levels: [],
  }
}

function thinkLevelOptions(preset) {
  return selectedModelCapabilities(preset).think_levels.map((level) => ({
    label: level.charAt(0).toUpperCase() + level.slice(1),
    value: level,
  }))
}

function normalizePresetControls(preset) {
  const capabilities = selectedModelCapabilities(preset)
  const form = modelPresetForm.value[preset]

  if (!capabilities.supports_think_level) {
    form.thinkLevel = null
  } else if (form.thinkLevel && !capabilities.think_levels.includes(form.thinkLevel)) {
    form.thinkLevel = null
  }

  if (!capabilities.supports_reasoning_toggle) {
    form.reasoningEnabled = null
  }
}

function modelCapabilitySummary(model) {
  if (!model) return 'No OpenClaw model selected yet.'

  const parts = []

  if (model.capabilities?.supports_think_level) {
    parts.push(`think: ${model.capabilities.think_levels.join(', ')}`)
  }

  if (model.capabilities?.supports_reasoning_toggle) {
    parts.push('reasoning toggle')
  }

  return parts.length ? parts.join(' • ') : 'No extra Hearth controls exposed for this model yet.'
}

async function saveModelPresetSettings() {
  if (modelPresetSaving.value) return

  normalizePresetControls('fast')
  normalizePresetControls('deep')
  modelPresetSaving.value = true

  const payload = {
    presets: {
      fast: {
        model_id: modelPresetForm.value.fast.modelId,
        think_level: modelPresetForm.value.fast.thinkLevel,
        reasoning_enabled: modelPresetForm.value.fast.reasoningEnabled,
      },
      deep: {
        model_id: modelPresetForm.value.deep.modelId,
        think_level: modelPresetForm.value.deep.thinkLevel,
        reasoning_enabled: modelPresetForm.value.deep.reasoningEnabled,
      },
    },
  }

  try {
    const response = await updateModelPresetSettings(payload)
    modelPresetSettings.value = response
    hydrateModelPresetForm(response)
    $q.notify({ type: 'positive', message: 'Model preset settings updated.' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  } finally {
    modelPresetSaving.value = false
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

.model-preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
  .model-preset-grid {
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
