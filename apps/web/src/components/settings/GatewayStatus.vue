<template>
  <div>
    <div class="dashboard-topbar">
      <div class="dashboard-topbar__copy">
        <q-btn
          v-if="isMobile"
          flat
          round
          dense
          icon="menu"
          :aria-label="t('dashboard.openDrawerAria')"
          class="dashboard-menu-btn"
          @click="openMobileDrawer"
        />
        <div>
          <div class="hero-eyebrow">{{ t('dashboard.eyebrow') }}</div>
          <div class="dashboard-topbar__title">{{ t('dashboard.topbarTitle') }}</div>
        </div>
      </div>
      <q-btn color="primary" unelevated no-caps rounded icon="refresh" :label="t('dashboard.refreshButton')" :loading="loading" @click="loadGatewayStatus" />
    </div>

    <div class="dashboard-hero">
      <div class="hero-title">{{ t('dashboard.heroTitle') }}</div>
      <div class="hero-subtitle">{{ t('dashboard.heroSubtitle') }}</div>

      <div class="dashboard-hero__chips q-mt-md">
        <q-chip class="dashboard-chip" square icon="person">{{ activeProfile?.name || t('dashboard.noProfileSelected') }}</q-chip>
        <q-chip class="dashboard-chip" square icon="forum">{{ activeConversation?.title || t('dashboard.noChatSelected') }}</q-chip>
      </div>
    </div>

    <div class="dashboard-grid">
      <div v-for="card in cards" :key="card.title" class="dashboard-card">
        <div class="dashboard-card__label">{{ card.title }}</div>
        <div class="dashboard-card__value">{{ card.value }}</div>
        <div class="dashboard-card__caption">{{ card.caption }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { getGatewayStatus } from 'src/lib/api'
import { useAppShell } from 'src/lib/appShell'

const $q = useQuasar()
const { t } = useI18n({ useScope: 'global' })
const { isMobile, openMobileDrawer, activeProfile, activeConversation, activeConversations } = useAppShell()
const loading = ref(false)

const gateway = ref({
  status: 'unknown',
  base_url: '—',
  default_agent_id: 'main',
  default_model: '—',
  last_checked_at: null,
  last_error: null,
  agents: [],
})

const cards = computed(() => [
  {
    title: t('dashboard.cards.gateway'),
    value: gateway.value.status,
    caption: gateway.value.base_url,
  },
  {
    title: t('dashboard.cards.activeChats'),
    value: activeConversations.value.length,
    caption: activeProfile.value
      ? t('dashboard.cards.activeChatsWithProfile', { name: activeProfile.value.name })
      : t('dashboard.cards.activeChatsNoProfile'),
  },
])

onMounted(() => {
  loadGatewayStatus()
})

async function loadGatewayStatus() {
  loading.value = true

  try {
    gateway.value = await getGatewayStatus()
  } catch (error) {
    gateway.value = {
      ...gateway.value,
      status: 'offline',
      last_error: error.message,
    }
    $q.notify({ type: 'negative', message: error.message })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.dashboard-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--hearth-bg, #0f1117);
  padding: 20px 28px 16px;
  margin-left: -28px;
  margin-right: -28px;
}

.dashboard-topbar__copy {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dashboard-topbar__title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #f8fafc;
}

.dashboard-menu-btn {
  color: var(--hearth-text-muted);
}

.dashboard-hero {
  background: color-mix(in srgb, var(--hearth-surface) 88%, transparent);
  border: 1px solid var(--hearth-border);
  border-radius: 28px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  padding: 28px;
  margin-bottom: 16px;
}

.hero-eyebrow {
  color: var(--hearth-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.72rem;
  font-weight: 700;
}

.hero-title {
  font-size: 2rem;
  line-height: 1.15;
  font-weight: 700;
  margin-top: 8px;
  max-width: 700px;
  color: #f8fafc;
}

.hero-subtitle {
  color: var(--hearth-text-muted);
  font-size: 0.96rem;
  margin-top: 10px;
  max-width: 760px;
  line-height: 1.7;
}

.dashboard-hero__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dashboard-chip {
  background: var(--hearth-surface-elevated);
  color: var(--hearth-text);
  border: 1px solid var(--hearth-border);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.dashboard-card {
  background: color-mix(in srgb, var(--hearth-surface) 88%, transparent);
  border: 1px solid var(--hearth-border);
  border-radius: 28px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  padding: 20px;
}

.dashboard-card__label {
  color: var(--hearth-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.72rem;
  font-weight: 700;
}

.dashboard-card__value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #f8fafc;
  margin-top: 10px;
}

.dashboard-card__caption {
  color: var(--hearth-text-muted);
  font-size: 0.96rem;
  margin-top: 10px;
  line-height: 1.7;
}

@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .dashboard-topbar {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px 14px 12px;
    margin-left: -14px;
    margin-right: -14px;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .hero-title {
    font-size: 1.5rem;
  }

  .dashboard-hero {
    padding-left: 16px;
    padding-right: 16px;
  }

  .dashboard-card {
    padding-left: 16px;
    padding-right: 16px;
  }
}
</style>
