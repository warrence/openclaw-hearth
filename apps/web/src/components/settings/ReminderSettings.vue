<template>
  <div class="tts-card q-mt-md">
    <div class="tts-card__header tts-card__header--clickable" @click="expanded = !expanded">
      <div>
        <div class="dashboard-card__label">Reminders</div>
        <div class="tts-card__title">Critical reminder settings</div>
      </div>
      <q-icon :name="expanded ? 'expand_less' : 'expand_more'" size="24px" />
    </div>

    <div v-show="expanded">
      <div v-if="loading" class="q-pa-md text-center">
        <q-spinner color="primary" size="24px" />
      </div>

      <div v-else class="tts-card__body q-mt-md">
        <div class="tts-card__section">
          <q-toggle
            v-model="form.enabled"
            label="Enable critical reminders"
            dark
            color="primary"
          />
          <div class="text-caption text-grey-6 q-mt-xs">
            Critical reminders repeat until the user responds to the chat.
          </div>
        </div>

        <div v-if="form.enabled" class="tts-card__section q-mt-md">
          <div class="tts-card__section-label">Repeat interval (minutes)</div>
          <q-input
            v-model.number="form.intervalMinutes"
            type="number"
            outlined
            dense
            dark
            :min="1"
            :max="30"
            hint="How often to re-send the reminder (1-30 minutes)"
          />
        </div>

        <div v-if="form.enabled" class="tts-card__section q-mt-md">
          <div class="tts-card__section-label">Max repeats</div>
          <q-input
            v-model.number="form.maxRepeats"
            type="number"
            outlined
            dense
            dark
            :min="1"
            :max="100"
            hint="Stop after this many repeats even if not acknowledged"
          />
        </div>

        <div class="q-mt-md q-px-md q-pb-md">
          <q-btn
            color="primary"
            unelevated
            no-caps
            rounded
            icon="save"
            label="Save"
            size="sm"
            :loading="saving"
            @click="save"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const expanded = ref(false)
const loading = ref(false)
const saving = ref(false)

const form = ref({
  enabled: true,
  intervalMinutes: 1,
  maxRepeats: 30,
})

const NEST_API_BASE = String(import.meta.env.VITE_NEST_API_BASE_URL || '/nest-api').trim()

async function load() {
  loading.value = true
  try {
    const res = await fetch(`${NEST_API_BASE}/reminder-settings`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      form.value = {
        enabled: data.critical?.enabled ?? true,
        intervalMinutes: data.critical?.intervalMinutes ?? 1,
        maxRepeats: data.critical?.maxRepeats ?? 30,
      }
    }
  } catch { /* use defaults */ }
  finally { loading.value = false }
}

async function save() {
  saving.value = true
  try {
    const res = await fetch(`${NEST_API_BASE}/reminder-settings`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ critical: form.value }),
    })
    if (res.ok) {
      $q.notify({ type: 'positive', message: 'Reminder settings saved.' })
    }
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to save.' })
  } finally { saving.value = false }
}

onMounted(load)
</script>

<style scoped lang="scss">
.tts-card { background: var(--hearth-surface); border-radius: 14px; padding: 0 18px; }
.tts-card__header { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; }
.tts-card__header--clickable { cursor: pointer; user-select: none; }
.tts-card__title { font-size: 1rem; font-weight: 600; color: var(--hearth-text); }
.tts-card__body { padding: 0 0 8px; }
.tts-card__section-label { font-size: 0.82rem; color: var(--hearth-text-muted); margin-bottom: 6px; }
.dashboard-card__label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px; color: var(--hearth-text-muted); font-weight: 600; }
</style>
