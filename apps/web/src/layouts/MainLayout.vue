<template>
  <transition name="app-boot-fade">
    <div v-if="!authChecked" class="app-boot-overlay" aria-hidden="true">
      <div class="app-boot-overlay__spinner">
        <q-spinner color="primary" size="36px" />
      </div>
    </div>
  </transition>

  <!-- OpenClaw status banner -->
  <div v-if="authChecked && openclawStatus !== 'connected' && openclawStatus !== 'unknown'" class="openclaw-status-banner">
    <div v-if="openclawStatus === 'not_configured'" class="openclaw-status-banner__content">
      <span class="openclaw-status-banner__icon">⚠️</span>
      <div>
        <strong>AI model not configured</strong>
        <p>Run <code>openclaw setup</code> on your server to configure your AI provider, then restart Hearth.</p>
      </div>
    </div>
    <div v-else-if="openclawStatus === 'disconnected'" class="openclaw-status-banner__content">
      <span class="openclaw-status-banner__icon">🔌</span>
      <div>
        <strong>OpenClaw is not running</strong>
        <p>Start OpenClaw with <code>openclaw gateway start</code> on your server.</p>
      </div>
    </div>
    <div v-else-if="openclawStatus === 'no_model'" class="openclaw-status-banner__content">
      <span class="openclaw-status-banner__icon">🤖</span>
      <div>
        <strong>AI model not set up</strong>
        <p>Run <code>openclaw setup</code> on your server to configure your AI provider and model.</p>
      </div>
    </div>
  </div>

  <div class="app-layout">
    <aside
      class="app-sidebar"
      :class="{
        'app-sidebar--mobile': isMobile,
        'app-sidebar--mobile-open': isMobile && mobileDrawerOpen,
      }"
    >
      <div class="app-sidebar__top">
        <div class="app-sidebar__toolbar">
          <q-input
            v-model="sidebarSearch"
            dense
            borderless
            clearable
            standout="false"
            placeholder="Search chats"
            class="app-sidebar__search"
          >
            <template #prepend>
              <q-icon name="search" size="18px" />
            </template>
          </q-input>

          <q-btn
            round
            unelevated
            color="primary"
            icon="add"
            class="app-sidebar__new-chat-btn"
            :loading="creatingConversation"
            :disable="!activeProfile"
            @click="handleCreateConversation"
          >
            <q-tooltip>New chat</q-tooltip>
          </q-btn>
        </div>

        <div class="app-sidebar__subtoolbar">
          <span class="app-sidebar__section-caption">
            {{ sidebarSectionCaption }}
          </span>

          <div class="app-sidebar__mobile-actions">
            <q-btn v-if="isMobile" flat round dense icon="close" @click="closeMobileDrawer" />
          </div>
        </div>

        <!-- Update banner removed — replaced by blocking dialog below -->

        <div
          v-if="showNotificationBanner"
          class="app-install-banner app-install-banner--notification"
        >
          <div class="app-install-banner__content">
            <div class="app-install-banner__title">Enable notifications</div>
            <div class="app-install-banner__body">
              Get alerted when the agent finishes replying while the app is in the background.
            </div>
          </div>

          <div class="app-install-banner__actions">
            <q-btn
              flat
              dense
              round
              icon="close"
              color="grey-5"
              aria-label="Dismiss notification prompt"
              @click="dismissNotificationBanner"
            />
            <q-btn
              color="primary"
              no-caps
              unelevated
              class="app-install-banner__button"
              :loading="pushSubscriptionSyncing"
              label="Enable"
              @click="requestNotificationPermission"
            />
          </div>
        </div>

        <div
          v-if="showInstallBanner"
          class="app-install-banner"
        >
          <div class="app-install-banner__content">
            <div class="app-install-banner__title">Install app</div>
            <div class="app-install-banner__body">
              {{ installBannerText }}
            </div>
          </div>

          <div class="app-install-banner__actions">
            <q-btn
              flat
              dense
              round
              icon="close"
              color="grey-5"
              aria-label="Dismiss install prompt"
              @click="dismissInstallBanner"
            />
            <q-btn
              color="primary"
              no-caps
              unelevated
              class="app-install-banner__button"
              :label="installPromptAvailable ? 'Install' : 'How to install'"
              @click="handleInstallApp"
            />
          </div>
        </div>

        <div v-if="showDebugPanel" class="app-debug-card">
          <div class="app-debug-card__title">PWA debug</div>
          <div class="app-debug-card__rows">
            <div v-for="row in debugStatusRows" :key="row.label" class="app-debug-card__row">
              <span class="app-debug-card__label">{{ row.label }}</span>
              <span class="app-debug-card__value">{{ row.value }}</span>
            </div>
          </div>
        </div>

        <div v-if="profilesLoading" class="app-sidebar__state app-sidebar__state--compact">
          <q-spinner color="primary" size="24px" />
        </div>
        <div v-else-if="profilesError" class="app-sidebar__state app-sidebar__state--compact text-body2">
          {{ friendlyProfilesErrorDetail || 'Connection lost' }}
        </div>
      </div>

      <section class="app-sidebar__section app-sidebar__section--conversations">
        <div v-if="conversationsLoading" class="app-sidebar__state">
          <q-spinner color="primary" size="28px" />
        </div>

        <template v-else>
          <div v-if="sidebarSearchLoading" class="app-sidebar__search-state">
            <q-spinner color="primary" size="18px" />
            <span>Searching full history…</span>
          </div>
          <div v-else-if="sidebarSearchError" class="app-sidebar__search-state app-sidebar__search-state--error">
            {{ sidebarSearchError }}
          </div>

          <div v-if="filteredActiveConversations.length" class="app-sidebar__conversation-list">
            <button
              v-for="chat in filteredActiveConversations"
              :key="chat.id"
              type="button"
              class="app-sidebar__conversation-link"
              :class="{ 'app-sidebar__conversation-link--active': Number(selectedConversationId) === Number(chat.id) }"
              @click="handleSelectConversation(chat.id, { matchedMessageId: chat.search_match?.message_id, matchedMessageAt: chat.search_match?.message_created_at })"
            >
              <div class="app-sidebar__conversation-main">
                <div class="app-sidebar__conversation-title">{{ chat.title }}</div>
                <div
                  v-if="shouldShowConversationPreview(chat)"
                  class="app-sidebar__conversation-preview"
                  :class="{ 'app-sidebar__conversation-preview--matched': isMatchedMessagePreview(chat) }"
                >
                  {{ conversationPreviewLine(chat) }}
                </div>
              </div>
              <div v-if="shouldUseRemoteSidebarSearch" class="app-sidebar__conversation-meta">
                <div v-if="conversationSearchMetaLabel(chat)" class="app-sidebar__match-pill">
                  {{ conversationSearchMetaLabel(chat) }}
                </div>
                <div v-if="isMatchedMessagePreview(chat)" class="app-sidebar__match-jump">
                  Jump to match
                </div>
              </div>
            </button>
          </div>

          <div v-else-if="activeConversationLoadError" class="app-sidebar__state text-body2 text-negative">
            {{ activeConversationLoadError }}
          </div>
          <div v-else-if="activeProfile && !activeProfileConversationsLoaded" class="app-sidebar__empty">
            Loading chats…
          </div>
          <div v-else-if="activeProfile" class="app-sidebar__empty">
            {{ sidebarSearch ? 'No chats match your search.' : 'No active chats yet.' }}
          </div>
          <div v-else class="app-sidebar__empty">
            Sign in to see your chats.
          </div>

        </template>
      </section>

      <footer class="app-sidebar__footer">
        <button
          v-if="activeProfile"
          type="button"
          class="app-sidebar__profile-row"
          @click="settingsOpen = true"
        >
          <q-avatar size="36px" class="app-sidebar__footer-avatar">
            {{ activeProfile.name.charAt(0) }}
          </q-avatar>
          <span class="app-sidebar__footer-name">{{ activeProfile.name }}</span>
        </button>
      </footer>
    </aside>

    <button
      v-if="isMobile"
      type="button"
      class="app-shell-backdrop"
      :class="{ 'app-shell-backdrop--visible': mobileDrawerOpen }"
      aria-label="Close app drawer"
      :aria-hidden="!mobileDrawerOpen"
      :tabindex="mobileDrawerOpen ? 0 : -1"
      @click="closeMobileDrawer"
    />

    <div
      class="app-page-container"
      :class="{ 'app-page-container--drawer-open': isMobile && mobileDrawerOpen }"
    >
      <div
        class="app-page-shell"
        :class="{ 'app-page-shell--drawer-open': isMobile && mobileDrawerOpen }"
        :data-drawer-open="isMobile && mobileDrawerOpen ? 'true' : 'false'"
      >
        <router-view />
      </div>
    </div>

    <q-dialog v-model="renameDialog.open">
      <q-card class="overlay-card" style="min-width: 360px; max-width: 92vw">
        <q-card-section>
          <div class="text-h6">Rename chat</div>
          <div class="text-body2 text-grey-7 q-mt-xs">Keep it short and easy to find later.</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="renameDialog.title" autofocus outlined maxlength="120" label="Chat title" @keyup.enter="submitRenameConversation" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn color="primary" no-caps label="Save" :loading="renameDialog.loading" @click="submitRenameConversation" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="archiveDialog.open">
      <q-card class="overlay-card" style="min-width: 360px; max-width: 92vw">
        <q-card-section>
          <div class="text-h6">Archive chat?</div>
          <div class="text-body2 text-grey-7 q-mt-xs">
            {{ archiveDialog.conversation?.title || 'This chat' }} will disappear from the active sidebar list but stay in the database.
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn color="primary" no-caps label="Archive" :loading="archiveDialog.loading" @click="submitArchiveConversation" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="settingsOpen" position="bottom" full-width class="settings-sheet" @hide="onSettingsClose">
      <q-card class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__title">Settings</div>
          <q-btn flat round dense icon="close" color="grey-5" class="settings-card__close-btn" @click="settingsOpen = false" />
        </div>

        <div class="settings-card__profile-hero">
          <q-avatar size="72px" class="settings-card__hero-avatar">
            {{ activeProfile?.name?.charAt(0) || '?' }}
          </q-avatar>
          <div class="settings-card__hero-name">{{ activeProfile?.name || 'Profile' }}</div>
          <div class="settings-card__hero-sub">Edit profile</div>
        </div>

        <div class="settings-card__body">
          <div v-if="currentUser?.role === 'owner'" class="settings-card__account-card">
            <div class="settings-card__agent-name-row">
              <q-icon name="smart_toy" size="20px" />
              <div class="settings-card__agent-name-group">
                <div class="settings-card__agent-name-label">Agent name</div>
                <q-input
                  v-model="agentNameInput"
                  dense
                  dark
                  outlined
                  :placeholder="`Default: ${agentDefaultName}`"
                  class="settings-card__agent-name-input"
                  @blur="saveAgentDisplayName"
                  @keyup.enter="saveAgentDisplayName"
                />
              </div>
            </div>
          </div>

          <div v-if="currentUser?.role === 'owner'" class="settings-card__account-card">
            <button type="button" class="settings-card__account-row" @click="handleSettingsDashboard">
              <q-icon name="space_dashboard" size="20px" />
              <span>Dashboard</span>
              <q-icon name="chevron_right" size="18px" class="settings-card__account-row-chevron" />
            </button>
          </div>

          <div class="settings-card__account-card">
            <button
              type="button"
              class="settings-card__account-row"
              :disabled="!archivedConversations.length"
              @click="settingsArchivedOpen = !settingsArchivedOpen"
            >
              <q-icon name="inventory_2" size="20px" />
              <span>Archived chats</span>
              <span v-if="archivedConversations.length" class="settings-card__count-badge">{{ archivedConversations.length }}</span>
              <q-icon :name="settingsArchivedOpen ? 'expand_less' : 'expand_more'" size="18px" class="settings-card__account-row-chevron" />
            </button>

            <div v-if="settingsArchivedOpen && archivedConversations.length" class="settings-card__archived-list">
              <button
                v-for="chat in archivedConversations"
                :key="chat.id"
                type="button"
                class="settings-card__archived-item"
                @click="handleSelectConversationFromSettings(chat.id)"
              >
                <div class="settings-card__archived-item-title">{{ chat.title }}</div>
                <div class="settings-card__archived-item-time">{{ formatConversationTime(chat.last_message_at || chat.updated_at) }}</div>
              </button>
            </div>
          </div>

          <div class="settings-card__account-card">
            <button
              type="button"
              class="settings-card__account-row"
              :disabled="pushSubscriptionSyncing || notificationPermission === 'denied'"
              @click="pushSubscriptionActive ? handleDisableNotifications() : handleEnableNotifications()"
            >
              <q-icon :name="pushSubscriptionActive ? 'notifications_active' : 'notifications_off'" size="20px" />
              <span>{{ pushSubscriptionActive ? 'Notifications on' : 'Enable notifications' }}</span>
            </button>
          </div>

          <div class="settings-card__account-card">
            <button
              v-if="currentUser"
              type="button"
              class="settings-card__account-row settings-card__account-row--danger"
              @click="handleSettingsLogout"
            >
              <q-icon name="logout" size="20px" />
              <span>Sign out</span>
            </button>
          </div>

          <div class="settings-card__version-label">v{{ appVersionLabel }}</div>
        </div>
      </q-card>
    </q-dialog>

    <q-dialog v-model="loginDialogOpen" persistent :maximized="isMobile">
      <q-card class="login-card">
        <div v-if="loginStep === 'profile'" class="login-card__step">
          <div class="login-card__header">
            <div class="login-card__title">Who's there?</div>
          </div>

          <div v-if="profilesLoading" class="login-card__state">
            <q-spinner color="primary" size="28px" />
          </div>
          <div v-else-if="profilesError" class="login-failure-state">
            <div class="login-failure-card">
              <div class="login-failure-card__badge" :class="{ 'login-failure-card__badge--auth': isProfilesAuthError }">
                <q-icon :name="isProfilesAuthError ? 'lock_reset' : 'wifi_off'" size="18px" />
                <span>{{ isProfilesAuthError ? 'Session expired' : 'Connection lost' }}</span>
              </div>
              <div class="login-failure-card__title">{{ isProfilesAuthError ? 'Please sign in again' : 'We couldn\'t reach Hearth' }}</div>
              <div class="login-failure-card__body">
                {{ isProfilesAuthError
                  ? 'Your session is no longer valid. Choose your profile again to continue.'
                  : 'We couldn\'t load the household profiles just now. Check your connection and try again.' }}
              </div>
              <div v-if="friendlyProfilesErrorDetail" class="login-failure-card__detail">{{ friendlyProfilesErrorDetail }}</div>
              <div class="login-failure-card__actions">
                <q-btn
                  color="primary"
                  unelevated
                  no-caps
                  :icon="isProfilesAuthError ? 'person' : 'refresh'"
                  :label="isProfilesAuthError ? 'Sign in again' : 'Retry'"
                  class="login-failure-card__primary"
                  @click="retryLoginRecovery()"
                />
              </div>
            </div>
          </div>
          <div v-else class="login-card__profiles">
            <button
              v-for="profile in profiles"
              :key="profile.id"
              type="button"
              class="login-card__profile-btn"
              @click="selectLoginProfile(profile)"
            >
              <q-avatar size="40px" class="login-card__avatar">{{ profile.name.charAt(0) }}</q-avatar>
              <span class="login-card__profile-name">{{ profile.name }}</span>
            </button>
          </div>
        </div>

        <div v-else-if="loginStep === 'pin'" class="login-card__step">
          <div class="login-card__header login-card__header--pin">
            <q-btn flat round dense icon="arrow_back" color="grey-5" @click="loginStep = 'profile'; loginPin = ''; loginError = ''" />
            <q-avatar size="36px" class="login-card__avatar">{{ loginSelectedProfile?.name?.charAt(0) }}</q-avatar>
            <div class="login-card__title">{{ loginSelectedProfile?.name }}</div>
          </div>

          <div class="login-card__pin-form">
            <q-input
              v-model="loginPin"
              type="password"
              outlined
              autofocus
              label="Enter PIN"
              inputmode="numeric"
              :error="!!loginError"
              :error-message="loginError"
              class="login-card__pin-input"
              @keyup.enter="submitLogin"
            />
            <q-btn
              color="primary"
              unelevated
              no-caps
              class="login-card__submit-btn"
              label="Sign in"
              :loading="loginLoading"
              :disable="!loginPin"
              @click="submitLogin"
            />
          </div>
        </div>
      </q-card>
    </q-dialog>
    <!-- Blocking update dialog — user must reload -->
    <q-dialog :model-value="showUpdateBanner" persistent no-esc-dismiss no-backdrop-dismiss>
      <q-card class="update-dialog-card" dark>
        <q-card-section class="text-center q-pt-lg">
          <q-icon name="system_update" size="48px" color="primary" />
          <div class="text-h6 q-mt-md">Update Available</div>
          <div class="text-body2 text-grey-5 q-mt-sm">
            A new version of Hearth is ready. Please reload to continue.
          </div>
        </q-card-section>
        <q-card-actions align="center" class="q-pb-lg">
          <q-btn
            color="primary"
            unelevated
            no-caps
            rounded
            label="Reload Now"
            icon="refresh"
            :loading="applyingUpdate"
            @click="applyAppUpdate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import {
  archiveConversation,
  createConversation,
  deletePushSubscription,
  getMe,
  getPushPublicKey,
  listConversations,
  listMessages,
  listUsers,
  login,
  createUserEventStream,
  getAgentSettings,
  getHealthStatus,
  updateAgentDisplayName,
  logout,
  restoreConversation,
  savePushSubscription,
  updateConversation,
  updatePushPresence,
} from 'src/lib/api'
import { normalizeAppChannelMessage } from 'src/lib/appChannel'
import { APP_SHELL_KEY } from 'src/lib/appShell'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const appVersionLabel = process.env.VITE_APP_VERSION || '0.0.81'

const currentUser = ref(null)
const authChecked = ref(false)
const openclawStatus = ref('unknown') // 'connected' | 'disconnected' | 'not_configured' | 'unknown'
const loginDialogOpen = ref(false)
const loginStep = ref('profile') // 'profile' | 'pin'
const loginSelectedProfile = ref(null)
const loginPin = ref('')
const loginLoading = ref(false)
const loginError = ref('')
const profiles = ref([])
const profilesLoading = ref(false)
const agentDisplayName = ref('Assistant')
const agentDefaultName = ref('Assistant')  // OpenClaw's agent name — used as placeholder
const agentNameInput = ref('')
let eventSource = null

function connectEventStream(userId) {
  if (eventSource) { eventSource.close(); eventSource = null }
  if (!userId) return

  try {
    eventSource = createUserEventStream(userId)

    eventSource.addEventListener('message.created', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.conversationId && data.message) {
          // Refresh the conversation list to show new message
          refreshConversationList()
          // If viewing this conversation, add the message
          if (Number(selectedConversationId.value) === Number(data.conversationId)) {
            ensureMessagesLoaded(data.conversationId, { force: true, quiet: true })
          }
        }
      } catch { /* ignore */ }
    })

    eventSource.addEventListener('conversation.created', () => {
      try { refreshConversationList() } catch { /* ignore */ }
    })

    eventSource.addEventListener('conversation.updated', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.conversation) {
          updateConversationInList(data.conversation)
        } else {
          refreshConversationList()
        }
      } catch { /* ignore */ }
    })

    eventSource.onerror = () => {
      // Reconnect after 5s on error
      setTimeout(() => {
        if (currentUser.value?.id) connectEventStream(currentUser.value.id)
      }, 5000)
    }
  } catch { /* ignore */ }
}

function disconnectEventStream() {
  if (eventSource) { eventSource.close(); eventSource = null }
}

async function saveAgentDisplayName() {
  const name = agentNameInput.value.trim()
  if (name === agentDisplayName.value) return
  try {
    // Empty name = reset to default from OpenClaw
    const result = await updateAgentDisplayName(name)
    if (result?.agentDisplayName) {
      agentDisplayName.value = result.agentDisplayName
      agentNameInput.value = result.agentDisplayName
    }
  } catch { /* best effort */ }
}
const profilesError = ref('')
const selectedProfileId = ref(null)
const conversationsByUser = ref({})
const conversationsLoadedByUser = ref({})
const conversationLoadErrors = ref({})
const conversationsLoading = ref(false)
const selectedConversationId = ref(null)
const messagesByConversation = ref({})
const messagesLoading = ref(false)
const creatingConversation = ref(false)
const restoreLoading = ref(false)
const settingsArchivedOpen = ref(false)
const sidebarSearch = ref('')
const sidebarSearchLoading = ref(false)
const sidebarSearchResults = ref([])
const sidebarSearchResolvedQuery = ref('')
const sidebarSearchError = ref('')
const mobileDrawerOpen = ref(false)
const settingsOpen = ref(false)

function onSettingsClose() {
  // Quasar dialogs can leave scroll locked on the wrong element on iOS.
  // Force-restore normal scrolling on the sidebar after settings close.
  nextTick(() => {
    const sidebar = document.querySelector('.app-sidebar')
    if (sidebar) {
      sidebar.style.overflowY = ''
      sidebar.style.touchAction = ''
    }
    document.body.style.overflow = ''
    document.body.style.position = ''
  })
}
const renameDialog = ref({ open: false, loading: false, conversation: null, title: '' })
const archiveDialog = ref({ open: false, loading: false, conversation: null })
const deferredInstallPrompt = ref(null)
const installPromptAvailable = ref(false)
const installBannerDismissed = ref(false)
const isStandaloneApp = ref(false)
const isIosInstallFlow = ref(false)
const updateRegistration = ref(null)
const updateBannerDismissed = ref(false)
const applyingUpdate = ref(false)
const notificationPermission = ref('default')
const notificationBannerDismissed = ref(false)
const pushSubscriptionActive = ref(false)
const pushSubscriptionSyncing = ref(false)
const serviceWorkerReady = ref(false)
const notificationApiAvailable = ref(false)
const pushManagerAvailable = ref(false)
const lastPresencePayload = ref('—')
const lastPresenceResult = ref('—')
const lastPresenceAt = ref('—')
const lastPresenceError = ref('—')
const notifiedReplyIds = new Set()
let controllerChangeHandled = false
let updateCheckTimer = null
let activeConversationRefreshTimer = null
let presenceSyncTimer = null
let sidebarSearchTimer = null
let sidebarSearchRequestId = 0
let lastPresenceSignature = ''
const MOBILE_DRAWER_TRANSITION_MS = 220

const isMobile = computed(() => $q.screen.width < 768)
const isDashboardRoute = computed(() => route.path.startsWith('/dashboard'))
const activeProfile = computed(() => profiles.value.find((profile) => profile.id === selectedProfileId.value) || null)
const activeConversationLoadError = computed(() => conversationLoadErrors.value[selectedProfileId.value] || '')
const activeProfileConversationsLoaded = computed(() => Boolean(selectedProfileId.value && conversationsLoadedByUser.value[selectedProfileId.value]))
const profileConversations = computed(() => conversationsByUser.value[selectedProfileId.value] || [])
const activeConversations = computed(() => profileConversations.value.filter((conversation) => conversation.status !== 'archived'))
const archivedConversations = computed(() => profileConversations.value.filter((conversation) => conversation.status === 'archived'))
const normalizedSidebarSearch = computed(() => String(sidebarSearch.value || '').trim().toLowerCase())
const shouldUseRemoteSidebarSearch = computed(() => normalizedSidebarSearch.value.length > 0)
const showDebugPanel = computed(() => route.query.debug === '1')
const filteredConversationSource = computed(() => {
  if (!shouldUseRemoteSidebarSearch.value) {
    return profileConversations.value
  }

  if (sidebarSearchResolvedQuery.value === normalizedSidebarSearch.value) {
    return sidebarSearchResults.value
  }

  return []
})
const filteredActiveConversations = computed(() => filteredConversationSource.value.filter((conversation) => conversation.status !== 'archived'))
const filteredArchivedConversations = computed(() => filteredConversationSource.value.filter((conversation) => conversation.status === 'archived'))
const activeConversation = computed(() => profileConversations.value.find((conversation) => Number(conversation.id) === Number(selectedConversationId.value)) || null)
const activeMessages = computed(() => messagesByConversation.value[selectedConversationId.value] || [])
const messageLoadErrors = ref({})
const isArchivedConversation = computed(() => activeConversation.value?.status === 'archived')
const showUpdateBanner = computed(() => !updateBannerDismissed.value && !!updateRegistration.value)
const showNotificationBanner = computed(() => !!activeProfile.value && !pushSubscriptionActive.value && notificationPermission.value !== 'denied' && !notificationBannerDismissed.value)
const showInstallBanner = computed(() => !installBannerDismissed.value && !showUpdateBanner.value && !showNotificationBanner.value && !isStandaloneApp.value && (installPromptAvailable.value || isIosInstallFlow.value))
const debugStatusRows = computed(() => ([
  { label: 'Version', value: appVersionLabel },
  { label: 'Standalone app', value: isStandaloneApp.value ? 'yes' : 'no' },
  { label: 'iPhone/iPad detected', value: isIosInstallFlow.value ? 'yes' : 'no' },
  { label: 'Notification API', value: notificationApiAvailable.value ? 'yes' : 'no' },
  { label: 'PushManager', value: pushManagerAvailable.value ? 'yes' : 'no' },
  { label: 'Service worker ready', value: serviceWorkerReady.value ? 'yes' : 'no' },
  { label: 'Notification permission', value: notificationPermission.value },
  { label: 'Push subscription', value: pushSubscriptionActive.value ? 'active' : 'missing' },
  { label: 'Active profile', value: activeProfile.value?.name || 'none' },
  { label: 'Selected chat', value: selectedConversationId.value || 'none' },
  { label: 'Last presence payload', value: lastPresencePayload.value },
  { label: 'Last presence result', value: lastPresenceResult.value },
  { label: 'Last presence at', value: lastPresenceAt.value },
  { label: 'Last presence error', value: lastPresenceError.value },
]))
const installBannerText = computed(() => (
  installPromptAvailable.value
    ? 'Add this chat app to your home screen for one-tap access.'
    : 'On iPhone or iPad, tap Share and choose Add to Home Screen.'
))
const isProfilesAuthError = computed(() => {
  const normalized = String(profilesError.value || '').trim().toLowerCase()

  return normalized === 'unauthenticated.'
    || normalized === 'unauthenticated'
    || normalized === 'unauthorized'
    || normalized.includes('session expired')
})
const friendlyProfilesErrorDetail = computed(() => {
  const message = String(profilesError.value || '').trim()

  if (!message) {
    return ''
  }

  const normalized = message.toLowerCase()
  const genericMessages = new Set([
    'load failed',
    'network error',
    'failed to fetch',
    'fetch failed',
    'request failed',
    'the string did not match the expected pattern.',
    'the string did not match the expected pattern',
    'unauthenticated.',
    'unauthenticated',
    'unauthorized',
  ])

  if (genericMessages.has(normalized)) {
    return ''
  }

  return message
})
const sidebarSectionCaption = computed(() => {
  if (!activeProfile.value) {
    return 'No profile selected'
  }

  if (!activeProfileConversationsLoaded.value) {
    return conversationsLoading.value ? 'Loading chats…' : 'Checking chats…'
  }

  if (!normalizedSidebarSearch.value) {
    return `${filteredActiveConversations.value.length} chats`
  }

  if (sidebarSearchLoading.value || sidebarSearchResolvedQuery.value !== normalizedSidebarSearch.value) {
    return 'Searching…'
  }

  const totalMatches = filteredActiveConversations.value.length + filteredArchivedConversations.value.length

  return `${totalMatches} match${totalMatches === 1 ? '' : 'es'}`
})

onMounted(async () => {
  syncInstallState()
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
  window.addEventListener('pwa-update-ready', handlePwaUpdateReady)
  window.addEventListener('message', handleWindowMessage)
  window.addEventListener('focus', handleAppForeground)
  window.addEventListener('blur', syncServiceWorkerClientState)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  navigator.serviceWorker?.addEventListener?.('controllerchange', handleServiceWorkerControllerChange)
  syncServiceWorkerClientState()
  await checkForAppUpdates()
  startUpdateCheckTimer()
  await bootApp()
})

onBeforeUnmount(() => {
  disconnectEventStream()
  stopUpdateCheckTimer()
  stopActiveConversationRefreshTimer()
  clearSidebarSearchTimer()
  if (presenceSyncTimer !== null) {
    window.clearTimeout(presenceSyncTimer)
    presenceSyncTimer = null
  }
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.removeEventListener('appinstalled', handleAppInstalled)
  window.removeEventListener('pwa-update-ready', handlePwaUpdateReady)
  window.removeEventListener('message', handleWindowMessage)
  window.removeEventListener('focus', handleAppForeground)
  window.removeEventListener('blur', syncServiceWorkerClientState)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  navigator.serviceWorker?.removeEventListener?.('controllerchange', handleServiceWorkerControllerChange)
})

watch(isMobile, (mobile) => {
  if (!mobile) {
    mobileDrawerOpen.value = false
  }
})

watch(selectedProfileId, async (userId) => {
  lastPresenceSignature = ''
  resetSidebarSearchState()

  if (!userId) {
    return
  }

  await loadConversations(userId)
  await syncPushSubscription(userId)
})

watch(selectedConversationId, async (conversationId) => {
  syncServiceWorkerClientState()
  queuePushPresenceSync(150)
  restartActiveConversationRefreshTimer()

  if (!conversationId) {
    return
  }

  await ensureMessagesLoaded(conversationId, { quiet: true })
})

watch([selectedProfileId, normalizedSidebarSearch], ([userId, search]) => {
  scheduleSidebarSearch(userId, search)
})

watch(
  () => route.fullPath,
  () => {
    mobileDrawerOpen.value = false
  },
)

provide(APP_SHELL_KEY, {
  isMobile,
  mobileDrawerOpen,
  openMobileDrawer,
  closeMobileDrawer,
  currentUser,
  handleLogout,
  profiles,
  profilesLoading,
  profilesError,
  selectedProfileId,
  activeProfile,
  conversationsLoading,
  selectedConversationId,
  activeConversation,
  activeConversations,
  archivedConversations,
  activeMessages,
  messagesLoading,
  messageLoadErrors,
  messagesByConversation,
  creatingConversation,
  restoreLoading,
  isArchivedConversation,
  handleSelectProfile,
  handleSelectConversation,
  handleCreateConversation,
  handleRestoreConversation,
  promptRenameConversation,
  promptArchiveConversation,
  ensureMessagesLoaded,
  setConversationMessages,
  upsertMessage,
  removeMessage,
  updateConversationRecord,
  removeConversationRecord,
  notifyAssistantReply,
  chatPreview,
  formatConversationTime,
  agentDisplayName,
})

async function loadProfiles() {
  profilesLoading.value = true
  profilesError.value = ''

  try {
    const data = await listUsers()
    profiles.value = data
  } catch (error) {
    profilesError.value = error.message
  } finally {
    profilesLoading.value = false
  }
}

async function retryLoginRecovery() {
  await loadProfiles()

  if (profilesError.value) {
    return
  }

  loginDialogOpen.value = true
  loginStep.value = 'profile'
  loginSelectedProfile.value = null
  loginPin.value = ''
  loginError.value = ''
}

function enterLoginState() {
  currentUser.value = null
  selectedProfileId.value = null
  selectedConversationId.value = null
  conversationsByUser.value = {}
  conversationsLoadedByUser.value = {}
  conversationLoadErrors.value = {}
  messagesByConversation.value = {}
  loginStep.value = 'profile'
  loginSelectedProfile.value = null
  loginPin.value = ''
  loginError.value = ''
  loginDialogOpen.value = true
}

async function bootApp() {
  authChecked.value = false
  recordLastActiveAt()

  // Check OpenClaw health
  try {
    const health = await getHealthStatus()
    if (health?.openclaw?.status === 'not_configured') {
      openclawStatus.value = 'not_configured'
    } else if (health?.openclaw?.status === 'disconnected') {
      openclawStatus.value = 'disconnected'
    } else if (health?.openclaw?.status === 'no_model') {
      openclawStatus.value = 'no_model'
    } else {
      openclawStatus.value = 'connected'
    }
  } catch {
    openclawStatus.value = 'unknown'
  }

  // Fetch agent display name from OpenClaw config
  try {
    const agentConfig = await getAgentSettings()
    if (agentConfig?.agentDisplayName) {
      agentDisplayName.value = agentConfig.agentDisplayName
      agentNameInput.value = agentConfig.agentDisplayName
      // Store the OpenClaw default for placeholder
      const openClawDefault = agentConfig.availableAgents?.find?.(
        (a) => a.id === agentConfig.hearthAgentId
      )?.name || agentConfig.agentDisplayName
      agentDefaultName.value = openClawDefault
    }
  } catch { /* fallback to default */ }

  // Always load profiles (public endpoint — needed for login chooser + switch menu)
  await loadProfiles()

  try {
    const user = await getMe()
    currentUser.value = user
    selectedProfileId.value = user.id
    // watch(selectedProfileId) triggers loadConversations automatically
    await syncPushSubscription(user.id)
    connectEventStream(user.id)
  } catch {
    // Not authenticated — show login dialog
    enterLoginState()
  } finally {
    authChecked.value = true
  }
}

function handleSettingsLogout() {
  settingsOpen.value = false
  handleLogout()
}

function handleSettingsDashboard() {
  settingsOpen.value = false
  router.push(isDashboardRoute.value ? '/' : '/dashboard')
}

function handleSelectConversationFromSettings(conversationId) {
  settingsOpen.value = false
  settingsArchivedOpen.value = false
  handleSelectConversation(conversationId)
}

async function handleLogout() {
  try {
    await logout()
  } catch {
    // best effort
  }

  enterLoginState()
}

function selectLoginProfile(profile) {
  loginSelectedProfile.value = profile
  loginStep.value = 'pin'
  loginPin.value = ''
  loginError.value = ''
}

async function submitLogin() {
  if (!loginSelectedProfile.value || !loginPin.value || loginLoading.value) {
    return
  }

  loginLoading.value = true
  loginError.value = ''

  try {
    const user = await login(loginSelectedProfile.value.id, loginPin.value)
    currentUser.value = user
    loginDialogOpen.value = false
    loginPin.value = ''
    loginStep.value = 'profile'
    loginSelectedProfile.value = null
    selectedProfileId.value = user.id
    // watch(selectedProfileId) triggers loadConversations automatically
    await syncPushSubscription(user.id)

  } catch (error) {
    loginError.value = error.message || 'Incorrect PIN. Try again.'
  } finally {
    loginLoading.value = false
  }
}

async function refreshConversationList() {
  if (selectedProfileId.value) {
    await loadConversations(selectedProfileId.value)
  }
}

function updateConversationInList(conversation) {
  if (!conversation?.id || !selectedProfileId.value) return
  const userId = selectedProfileId.value
  const existing = conversationsByUser.value[userId] ?? []
  const idx = existing.findIndex((c) => Number(c.id) === Number(conversation.id))
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...conversation }
    conversationsByUser.value = { ...conversationsByUser.value, [userId]: [...existing] }
  }
}

async function loadConversations(userId) {
  conversationsLoading.value = true

  try {
    const data = await listConversations(userId)
    conversationsLoadedByUser.value = {
      ...conversationsLoadedByUser.value,
      [userId]: true,
    }
    conversationLoadErrors.value = {
      ...conversationLoadErrors.value,
      [userId]: '',
    }
    mergeConversationRecords(userId, data, { replace: true })

    const requestedConversationId = route.query.chat ? Number(route.query.chat) : null
    const nextConversation = (requestedConversationId && data.find((conversation) => Number(conversation.id) === requestedConversationId))
      || data.find((conversation) => Number(conversation.id) === Number(selectedConversationId.value))
      || data.find((conversation) => conversation.status !== 'archived')
      || data[0]
      || null

    selectedConversationId.value = nextConversation?.id ?? null
    syncRouteQuery({ profile: userId, chat: nextConversation?.id || undefined })
  } catch (error) {
    const status = Number(error?.status || 0)
    const message = error?.message || 'Unable to load conversations.'

    conversationsLoadedByUser.value = {
      ...conversationsLoadedByUser.value,
      [userId]: false,
    }
    conversationLoadErrors.value = {
      ...conversationLoadErrors.value,
      [userId]: message,
    }

    if (status === 401) {
      enterLoginState()
      $q.notify({ type: 'warning', message: 'Session expired. Please sign in again.' })
      return
    }

    if (status === 403 && currentUser.value?.id && Number(userId) !== Number(currentUser.value.id)) {
      selectedProfileId.value = currentUser.value.id
      $q.notify({ type: 'warning', message: 'This profile is not available in the current Nest session. Switched back to your signed-in profile.' })
      return
    }

    $q.notify({ type: 'negative', message })
  } finally {
    conversationsLoading.value = false
  }
}

function clearSidebarSearchTimer() {
  if (sidebarSearchTimer !== null) {
    window.clearTimeout(sidebarSearchTimer)
    sidebarSearchTimer = null
  }
}

function clearConversationSearchMetadata(userId = selectedProfileId.value) {
  if (!userId) {
    return
  }

  const current = conversationsByUser.value[userId] || []

  conversationsByUser.value = {
    ...conversationsByUser.value,
    [userId]: current.map((conversation) => {
      if (!conversation?.search_match) {
        return conversation
      }

      return {
        ...conversation,
        search_match: null,
      }
    }),
  }
}

function resetSidebarSearchState() {
  sidebarSearchResults.value = []
  sidebarSearchResolvedQuery.value = ''
  sidebarSearchError.value = ''
  sidebarSearchLoading.value = false
  clearSidebarSearchTimer()
  clearConversationSearchMetadata()
}

function scheduleSidebarSearch(userId, search) {
  clearSidebarSearchTimer()

  if (!userId || !search) {
    sidebarSearchRequestId += 1
    sidebarSearchLoading.value = false
    sidebarSearchResults.value = []
    sidebarSearchResolvedQuery.value = ''
    sidebarSearchError.value = ''
    clearConversationSearchMetadata(userId)
    return
  }

  sidebarSearchTimer = window.setTimeout(() => {
    sidebarSearchTimer = null
    runSidebarSearch(userId, search)
  }, 180)
}

async function runSidebarSearch(userId, search) {
  const requestId = ++sidebarSearchRequestId
  sidebarSearchLoading.value = true
  sidebarSearchError.value = ''

  try {
    const results = await listConversations(userId, {
      search,
      limit: 40,
    })

    if (requestId !== sidebarSearchRequestId) {
      return
    }

    sidebarSearchResults.value = results
    mergeConversationRecords(userId, results)
    sidebarSearchResolvedQuery.value = search
  } catch (error) {
    if (requestId !== sidebarSearchRequestId) {
      return
    }

    sidebarSearchError.value = error?.message || 'Search failed.'
    sidebarSearchResolvedQuery.value = ''
  } finally {
    if (requestId === sidebarSearchRequestId) {
      sidebarSearchLoading.value = false
    }
  }
}

async function ensureMessagesLoaded(conversationId, options = {}) {
  const force = options.force === true
  const quiet = options.quiet === true

  if (!force && messagesByConversation.value[conversationId]) {
    return { ok: true, cached: true }
  }

  if (!messagesByConversation.value[conversationId]) {
    messagesLoading.value = true
  }

  try {
    const data = await listMessages(conversationId)
    messageLoadErrors.value = {
      ...messageLoadErrors.value,
      [conversationId]: '',
    }
    setConversationMessages(conversationId, data.map(normalizeMessage))
    return { ok: true, data }
  } catch (error) {
    const message = error?.message || 'Unable to load this conversation.'
    messageLoadErrors.value = {
      ...messageLoadErrors.value,
      [conversationId]: message,
    }

    if (!quiet) {
      $q.notify({ type: 'negative', message })
    }

    return { ok: false, error: message }
  } finally {
    if (!messagesByConversation.value[conversationId] || !force) {
      messagesLoading.value = false
    }
  }
}

async function refreshConversation(conversationId = selectedConversationId.value) {
  if (!conversationId) {
    return
  }

  await ensureMessagesLoaded(conversationId, { force: true, quiet: true })
}

function restartActiveConversationRefreshTimer() {
  stopActiveConversationRefreshTimer()

  if (typeof window === 'undefined' || document.visibilityState !== 'visible' || !selectedConversationId.value) {
    return
  }

  activeConversationRefreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && selectedConversationId.value) {
      refreshConversation(selectedConversationId.value)
    }
  }, 5000)
}

function stopActiveConversationRefreshTimer() {
  if (activeConversationRefreshTimer !== null) {
    window.clearInterval(activeConversationRefreshTimer)
    activeConversationRefreshTimer = null
  }
}

function syncInstallState() {
  if (typeof window === 'undefined') {
    return
  }

  isStandaloneApp.value = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  isIosInstallFlow.value = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
  notificationApiAvailable.value = typeof Notification !== 'undefined'
  pushManagerAvailable.value = 'PushManager' in window
  notificationPermission.value = notificationApiAvailable.value ? Notification.permission : 'denied'
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const normalized = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(normalized)

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault()
  deferredInstallPrompt.value = event
  installPromptAvailable.value = true
  installBannerDismissed.value = false
  syncInstallState()
}

function handleAppInstalled() {
  deferredInstallPrompt.value = null
  installPromptAvailable.value = false
  installBannerDismissed.value = true
  syncInstallState()
  $q.notify({ type: 'positive', message: 'App installed.' })
}

function handlePwaUpdateReady(event) {
  updateRegistration.value = event.detail?.registration || null
  updateBannerDismissed.value = false
}

function waitForWaitingServiceWorker(registration, timeoutMs = 2500) {
  if (!registration || registration.waiting) {
    return Promise.resolve(registration?.waiting || null)
  }

  return new Promise((resolve) => {
    let settled = false
    let timeoutId = null
    let installingWorker = registration.installing || null

    const finish = (worker = registration.waiting || null) => {
      if (settled) {
        return
      }

      settled = true
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      registration.removeEventListener('updatefound', handleUpdateFound)
      installingWorker?.removeEventListener('statechange', handleStateChange)
      resolve(worker)
    }

    const handleStateChange = () => {
      if (installingWorker?.state === 'installed') {
        finish(registration.waiting || installingWorker)
      }
    }

    const watchInstallingWorker = (worker) => {
      if (!worker) {
        return
      }

      installingWorker?.removeEventListener('statechange', handleStateChange)
      installingWorker = worker
      installingWorker.addEventListener('statechange', handleStateChange)
      handleStateChange()
    }

    const handleUpdateFound = () => {
      watchInstallingWorker(registration.installing)
    }

    timeoutId = window.setTimeout(() => finish(), timeoutMs)
    registration.addEventListener('updatefound', handleUpdateFound)
    watchInstallingWorker(installingWorker)
  })
}

async function checkForAppUpdates() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()

    if (!registration) {
      return
    }

    await Promise.race([
      registration.update(),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('update timeout')), 3000)),
    ]).catch(() => { /* timeout is fine — keep going */ })

    if (!registration.waiting) {
      await waitForWaitingServiceWorker(registration)
    }

    if (registration.waiting) {
      updateRegistration.value = registration
      updateBannerDismissed.value = false
    }
  } catch {
    // quiet on purpose; update polling should be low-drama
  }
}

function startUpdateCheckTimer() {
  stopUpdateCheckTimer()
  updateCheckTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdates()
    }
  }, 3 * 60 * 1000)
}

function stopUpdateCheckTimer() {
  if (updateCheckTimer !== null) {
    window.clearInterval(updateCheckTimer)
    updateCheckTimer = null
  }
}

function queuePushPresenceSync(delay = 250) {
  if (typeof window === 'undefined') {
    return
  }

  if (presenceSyncTimer !== null) {
    window.clearTimeout(presenceSyncTimer)
  }

  presenceSyncTimer = window.setTimeout(() => {
    presenceSyncTimer = null
    syncPushPresence()
  }, delay)
}

const IDLE_NEW_CHAT_MS = 30 * 60 * 1000 // 30 minutes
const IDLE_STORAGE_KEY = 'hearth_last_active_at'

function recordLastActiveAt() {
  try { localStorage.setItem(IDLE_STORAGE_KEY, String(Date.now())) } catch { /* ignore */ }
}

function getLastActiveAt() {
  try { return parseInt(localStorage.getItem(IDLE_STORAGE_KEY) || '0', 10) } catch { return 0 }
}

async function maybeStartNewChatAfterIdle() {
  if (!selectedProfileId.value) return
  const lastActive = getLastActiveAt()
  if (!lastActive) return // first launch — no record yet
  const idleMs = Date.now() - lastActive
  if (idleMs < IDLE_NEW_CHAT_MS) return // not idle long enough — resume normally
  // Idle threshold passed: clear selection — chat will be created on first send
  selectedConversationId.value = null
  syncRouteQuery({ profile: selectedProfileId.value, chat: undefined })
}

async function handleAppForeground() {
  syncServiceWorkerClientState()
  queuePushPresenceSync(150)
  await maybeStartNewChatAfterIdle()
  restartActiveConversationRefreshTimer()
  await refreshConversation()
  checkForAppUpdates()
  recordLastActiveAt()
}

async function handleVisibilityChange() {
  syncServiceWorkerClientState()
  queuePushPresenceSync(150)

  if (document.visibilityState === 'visible') {
    await maybeStartNewChatAfterIdle()
    restartActiveConversationRefreshTimer()
    await refreshConversation()
    checkForAppUpdates()
    recordLastActiveAt()
    return
  }

  // App going to background — record the time
  recordLastActiveAt()
  stopActiveConversationRefreshTimer()
}

function handleServiceWorkerControllerChange() {
  if (controllerChangeHandled) {
    return
  }

  if (window.sessionStorage.getItem('applying-update') !== 'true') {
    return
  }

  controllerChangeHandled = true
  window.sessionStorage.removeItem('applying-update')
  window.location.reload()
}

function syncServiceWorkerClientState() {
  if (typeof window === 'undefined' || !navigator.serviceWorker?.controller) {
    return
  }

  navigator.serviceWorker.controller.postMessage({
    type: 'CLIENT_STATE',
    conversationId: selectedConversationId.value || null,
    visible: document.visibilityState === 'visible',
  })
}

async function handleWindowMessage(event) {
  if (event.data?.type === 'open-url' && event.data?.url) {
    const target = new URL(event.data.url)
    const targetChat = target.searchParams.get('chat')
    await router.push({ path: target.pathname, query: Object.fromEntries(target.searchParams.entries()) })

    if (targetChat) {
      await refreshConversation(targetChat)
    }

    return
  }
}

async function applyAppUpdate() {
  const registration = updateRegistration.value
  const waitingWorker = registration?.waiting

  if (!waitingWorker) {
    updateRegistration.value = null
    updateBannerDismissed.value = true
    return
  }

  applyingUpdate.value = true
  window.sessionStorage.setItem('applying-update', 'true')
  waitingWorker.postMessage({ type: 'SKIP_WAITING' })
}

// dismissUpdateBanner removed — update dialog is now blocking (no dismiss)

async function handleInstallApp() {
  if (deferredInstallPrompt.value) {
    const prompt = deferredInstallPrompt.value
    deferredInstallPrompt.value = null
    installPromptAvailable.value = false
    await prompt.prompt()
    await prompt.userChoice.catch(() => null)
    syncInstallState()
    return
  }

  if (isIosInstallFlow.value) {
    $q.notify({
      type: 'info',
      message: 'Use Safari Share → Add to Home Screen to install this app.',
      timeout: 3500,
    })
  }
}

function dismissInstallBanner() {
  installBannerDismissed.value = true
}

function dismissNotificationBanner() {
  notificationBannerDismissed.value = true
}

async function syncPushSubscription(userId = selectedProfileId.value) {
  if (!userId || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    serviceWorkerReady.value = false
    pushSubscriptionActive.value = false
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    serviceWorkerReady.value = true
    const subscription = await registration.pushManager.getSubscription()
    pushSubscriptionActive.value = Boolean(subscription)

    if (subscription) {
      await syncPushPresence(userId, subscription)
    }
  } catch {
    serviceWorkerReady.value = false
    pushSubscriptionActive.value = false
  }
}

async function syncPushPresence(userId = selectedProfileId.value, subscription = null) {
  if (!userId || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    lastPresenceError.value = 'unsupported environment'
    return
  }

  const isVisible = document.visibilityState === 'visible'
  const conversationId = selectedConversationId.value || null

  if (isVisible && !conversationId) {
    lastPresencePayload.value = JSON.stringify({ userId, conversationId, isVisible })
    lastPresenceResult.value = 'skipped: visible without chat'
    return
  }

  const signature = JSON.stringify({ userId, conversationId, isVisible })
  lastPresencePayload.value = signature

  if (signature === lastPresenceSignature) {
    lastPresenceResult.value = 'skipped: unchanged'
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const activeSubscription = subscription || await registration.pushManager.getSubscription()

    if (!activeSubscription) {
      lastPresenceResult.value = 'skipped: no subscription'
      return
    }

    const response = await updatePushPresence(userId, {
      endpoint: activeSubscription.endpoint,
      conversation_id: conversationId,
      is_visible: isVisible,
    })

    lastPresenceSignature = signature
    lastPresenceResult.value = response?.debug ? JSON.stringify(response.debug) : 'ok'
    lastPresenceAt.value = new Date().toLocaleTimeString()
    lastPresenceError.value = '—'
  } catch (error) {
    lastPresenceError.value = error?.message || 'presence sync failed'
    lastPresenceResult.value = 'failed'
  }
}

async function requestNotificationPermission() {
  if (!activeProfile.value?.id) {
    $q.notify({ type: 'warning', message: 'Pick a profile first.' })
    return
  }

  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
    notificationPermission.value = 'denied'
    $q.notify({ type: 'negative', message: 'Push notifications are not supported on this device/browser.' })
    return
  }

  pushSubscriptionSyncing.value = true

  try {
    const permission = await Notification.requestPermission()
    notificationPermission.value = permission

    if (permission !== 'granted') {
      notificationBannerDismissed.value = permission !== 'default'
      return
    }

    const registration = await navigator.serviceWorker.ready
    const { public_key: publicKey } = await getPushPublicKey()
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }

    await savePushSubscription(activeProfile.value.id, subscription.toJSON())
    await syncPushPresence(activeProfile.value.id, subscription)
    pushSubscriptionActive.value = true
    notificationBannerDismissed.value = true
    $q.notify({ type: 'positive', message: 'Push notifications enabled.' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error?.message || 'Unable to enable push notifications.' })
  } finally {
    pushSubscriptionSyncing.value = false
  }
}

async function handleEnableNotifications() {
  // iOS Safari requires the permission prompt to be triggered from a direct
  // user gesture on the main page — not from inside a dialog/modal.
  // Close the settings sheet first, then request permission on next tick.
  settingsOpen.value = false
  await nextTick()
  return requestNotificationPermission()
}

async function handleDisableNotifications() {
  if (!activeProfile.value?.id) return

  pushSubscriptionSyncing.value = true

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      await subscription.unsubscribe()
      await deletePushSubscription(activeProfile.value.id, subscription.endpoint)
    }

    pushSubscriptionActive.value = false
    $q.notify({ type: 'positive', message: 'Push notifications disabled.' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error?.message || 'Unable to disable push notifications.' })
  } finally {
    pushSubscriptionSyncing.value = false
  }
}

function shouldNotifyForBackgroundReply(conversationId) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false
  }

  if (Notification.permission !== 'granted') {
    return false
  }

  const appVisible = document.visibilityState === 'visible' && document.hasFocus()

  if (!appVisible) {
    return true
  }

  return selectedConversationId.value !== conversationId
}

function notifyAssistantReply(conversationId, message) {
  if (pushSubscriptionActive.value) {
    return
  }

  const text = (message?.displayContent || message?.content || '').trim()

  if (!message?.id || !text || notifiedReplyIds.has(message.id) || !shouldNotifyForBackgroundReply(conversationId)) {
    return
  }

  notifiedReplyIds.add(message.id)

  const conversation = profileConversations.value.find((item) => item.id === conversationId)
  const title = conversation?.title || 'Agent replied'
  const body = text.length > 140 ? `${text.slice(0, 137)}...` : text
  const notification = new Notification(title, {
    body,
    tag: `reply-${conversationId}`,
    renotify: true,
  })

  notification.onclick = () => {
    window.focus()
    handleSelectConversation(conversationId)
    notification.close()
  }
}

function openMobileDrawer() {
  mobileDrawerOpen.value = true
}

function closeMobileDrawer() {
  mobileDrawerOpen.value = false
}

async function settleMobileDrawerClose() {
  if (!isMobile.value || !mobileDrawerOpen.value) {
    return
  }

  mobileDrawerOpen.value = false
  await nextTick()
  await new Promise((resolve) => window.setTimeout(resolve, MOBILE_DRAWER_TRANSITION_MS))
}

function buildConversationSelectionQuery(conversationId, matchedMessageId, matchedMessageAt) {
  return {
    ...route.query,
    profile: selectedProfileId.value,
    chat: conversationId,
    message: matchedMessageId,
    messageAt: matchedMessageAt,
  }
}

function handleSelectProfile(userId) {
  selectedProfileId.value = userId
  selectedConversationId.value = null
  syncRouteQuery({ profile: userId, chat: undefined, message: undefined })
  closeMobileDrawer()
}

async function handleSelectConversation(conversationId, options = {}) {
  const matchedMessageId = options.matchedMessageId ? String(options.matchedMessageId) : undefined
  const nextQuery = buildConversationSelectionQuery(conversationId, matchedMessageId)

  selectedConversationId.value = conversationId

  if (route.path !== '/') {
    await settleMobileDrawerClose()
    await router.push({
      path: '/',
      query: nextQuery,
    })
    return
  }

  await syncRouteQuery(nextQuery)
  closeMobileDrawer()
}

function promptRenameConversation(conversation) {
  if (!conversation) {
    return
  }

  renameDialog.value = {
    open: true,
    loading: false,
    conversation,
    title: conversation.title,
  }
}

function promptArchiveConversation(conversation) {
  if (!conversation) {
    return
  }

  archiveDialog.value = {
    open: true,
    loading: false,
    conversation,
  }
}

async function submitRenameConversation() {
  const conversation = renameDialog.value.conversation
  const title = renameDialog.value.title.trim()

  if (!conversation || !title || renameDialog.value.loading) {
    return
  }

  renameDialog.value.loading = true

  try {
    const updated = await updateConversation(conversation.id, { title })
    updateConversationRecord(updated)
    renameDialog.value.open = false
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  } finally {
    renameDialog.value.loading = false
  }
}

async function submitArchiveConversation() {
  const conversation = archiveDialog.value.conversation

  if (!conversation || archiveDialog.value.loading) {
    return
  }

  archiveDialog.value.loading = true

  try {
    const updated = await archiveConversation(conversation.id)
    updateConversationRecord(updated)

    if (selectedConversationId.value === updated.id) {
      const nextConversation = activeConversations.value.find((item) => item.id !== updated.id) || null
      selectedConversationId.value = nextConversation?.id || null
      syncRouteQuery({ profile: selectedProfileId.value, chat: nextConversation?.id })
    }

    archiveDialog.value.open = false
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  } finally {
    archiveDialog.value.loading = false
  }
}

async function handleRestoreConversation(conversation) {
  if (!conversation || restoreLoading.value) {
    return
  }

  restoreLoading.value = true

  try {
    const restored = await restoreConversation(conversation.id)
    updateConversationRecord(restored)
    selectedConversationId.value = restored.id
    syncRouteQuery({ profile: selectedProfileId.value, chat: restored.id })
    $q.notify({ type: 'positive', message: 'Chat restored to active list.' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  } finally {
    restoreLoading.value = false
  }
}

async function handleCreateConversation() {
  if (!activeProfile.value) {
    return
  }

  creatingConversation.value = true

  try {
    const conversation = await createConversation(activeProfile.value.id, {
      title: 'New Chat',
      agent_id: 'main',
    })

    updateConversationRecord(conversation)
    setConversationMessages(conversation.id, [])
    selectedConversationId.value = conversation.id
    syncRouteQuery({ profile: activeProfile.value.id, chat: conversation.id })

    if (route.path !== '/') {
      await settleMobileDrawerClose()
      await router.push({ path: '/', query: { ...route.query, profile: activeProfile.value.id, chat: conversation.id } })
      return
    }

    closeMobileDrawer()
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  } finally {
    creatingConversation.value = false
  }
}

function normalizeMessage(message) {
  return normalizeAppChannelMessage(message)
}

function setConversationMessages(conversationId, messages) {
  messagesByConversation.value = {
    ...messagesByConversation.value,
    [conversationId]: messages.map(normalizeMessage),
  }
}

function upsertMessage(conversationId, message) {
  const normalized = normalizeMessage(message)
  const currentMessages = messagesByConversation.value[conversationId] || []
  const existingIndex = currentMessages.findIndex((item) => item.id === normalized.id)

  if (existingIndex === -1) {
    setConversationMessages(conversationId, [...currentMessages, normalized])
    return
  }

  const nextMessages = [...currentMessages]
  nextMessages.splice(existingIndex, 1, {
    ...nextMessages[existingIndex],
    ...normalized,
    meta: {
      ...(nextMessages[existingIndex]?.meta || {}),
      ...(normalized.meta || {}),
    },
  })
  setConversationMessages(conversationId, nextMessages)
}

function removeMessage(conversationId, messageId) {
  const currentMessages = messagesByConversation.value[conversationId] || []
  setConversationMessages(conversationId, currentMessages.filter((message) => message.id !== messageId))
}

function stripConversationSearchMetadata(conversation) {
  if (!conversation) {
    return conversation
  }

  const nextConversation = { ...conversation }
  delete nextConversation.search_match

  return nextConversation
}

function mergeConversationRecords(userId, conversations, options = {}) {
  if (!userId) {
    return
  }

  const replace = options.replace === true
  const includeSearchMetadata = options.includeSearchMetadata === true
  const current = replace ? [] : [...(conversationsByUser.value[userId] || [])]
  const byId = new Map(current.map((conversation) => [conversation.id, conversation]))

  for (const conversation of conversations || []) {
    if (!conversation?.id) {
      continue
    }

    const normalizedConversation = includeSearchMetadata ? conversation : stripConversationSearchMetadata(conversation)

    byId.set(conversation.id, {
      ...(byId.get(conversation.id) || {}),
      ...normalizedConversation,
    })
  }

  const nextConversations = [...byId.values()]
  nextConversations.sort((a, b) => new Date(b.last_message_at || b.updated_at || 0) - new Date(a.last_message_at || a.updated_at || 0))

  conversationsByUser.value = {
    ...conversationsByUser.value,
    [userId]: nextConversations,
  }
}

function updateConversationRecord(conversation) {
  if (!conversation || !conversation.user_id) {
    return
  }

  mergeConversationRecords(conversation.user_id, [conversation])
}

function removeConversationRecord(conversationId) {
  if (!selectedProfileId.value) return
  const userId = selectedProfileId.value
  conversationsByUser.value = {
    ...conversationsByUser.value,
    [userId]: (conversationsByUser.value[userId] || []).filter((c) => c.id !== conversationId),
  }
  if (selectedConversationId.value === conversationId) {
    selectedConversationId.value = null
    syncRouteQuery({ profile: userId, chat: undefined })
  }
}

function chatPreview(conversationId) {
  const messages = messagesByConversation.value[conversationId] || []
  const latestMessage = messages[messages.length - 1]

  if (latestMessage?.displayContent || latestMessage?.content || latestMessage?.contract?.text) {
    return latestMessage.displayContent || latestMessage.content || latestMessage.contract?.text
  }

  if (latestMessage?.attachments?.length) {
    const [firstAttachment] = latestMessage.attachments
    return `Attachment: ${firstAttachment?.name || `${latestMessage.attachments.length} files`}`
  }

  return 'No messages yet'
}

function shouldShowConversationPreview() {
  return shouldUseRemoteSidebarSearch.value
}

function isMatchedMessagePreview(conversation) {
  if (!shouldUseRemoteSidebarSearch.value) {
    return false
  }

  return Boolean(conversation?.search_match?.message_id && conversation?.search_match?.preview)
}

function conversationPreviewLine(conversation) {
  if (!shouldUseRemoteSidebarSearch.value) {
    return conversation?.title || 'Untitled chat'
  }

  if (isMatchedMessagePreview(conversation)) {
    return conversation.search_match.preview
  }

  const matchedPreview = conversation?.search_match?.preview

  if (matchedPreview) {
    return matchedPreview
  }

  return chatPreview(conversation?.id)
}

function conversationSearchMetaLabel(conversation) {
  if (!shouldUseRemoteSidebarSearch.value) {
    return ''
  }

  const matchedFields = conversation?.search_match?.matched_fields || []

  if (matchedFields.includes('title') && matchedFields.includes('message')) {
    return 'Title + message'
  }

  if (matchedFields.includes('title')) {
    return 'Title'
  }

  if (matchedFields.includes('message')) {
    return 'Message'
  }

  return ''
}

function formatConversationTime(value) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

async function syncRouteQuery(patch) {
  const nextQuery = {
    ...route.query,
    ...patch,
  }

  Object.keys(nextQuery).forEach((key) => {
    if (nextQuery[key] === undefined || nextQuery[key] === null || nextQuery[key] === '') {
      delete nextQuery[key]
    }
  })

  const sameQuery = JSON.stringify(route.query) === JSON.stringify(nextQuery)

  if (!sameQuery) {
    await router.replace({ query: nextQuery })
  }
}
</script>

<style scoped lang="scss">
.openclaw-status-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: #7c3aed;
  color: #fff;
  padding: 12px 20px;
  font-size: 14px;

  &__content {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    max-width: 600px;
    margin: 0 auto;

    p {
      margin: 4px 0 0;
      font-size: 13px;
      opacity: 0.9;
    }

    code {
      background: rgba(255,255,255,0.2);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 12px;
    }
  }

  &__icon {
    font-size: 20px;
    flex-shrink: 0;
  }
}

.app-boot-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--hearth-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-boot-fade-leave-active {
  transition: opacity 260ms ease;
}

.app-boot-fade-leave-to {
  opacity: 0;
}

.app-layout {
  height: 100dvh;
  display: grid;
  grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
  background: var(--hearth-bg);
  overflow: hidden;
}

.app-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: 18px 14px 16px;
  gap: 18px;
  background: var(--hearth-surface);
  border-right: 1px solid var(--hearth-border);
}

.app-sidebar__footer {
  margin-top: auto;
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: sticky;
  bottom: 0;
  background: var(--hearth-surface);
  z-index: 1;
  padding-bottom: 2px;
}

.app-page-container {
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-sidebar__top {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.app-install-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), var(--hearth-surface-elevated));
  border: 1px solid rgba(109, 93, 252, 0.22);
}

.app-debug-card {
  padding: 12px;
  border-radius: 16px;
  background: var(--hearth-surface-elevated);
  border: 1px solid var(--hearth-border);
}

.app-debug-card__title {
  color: var(--hearth-text);
  font-size: 0.86rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.app-debug-card__rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.app-debug-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.app-debug-card__label,
.app-debug-card__value {
  font-size: 0.78rem;
}

.app-debug-card__label {
  color: var(--hearth-text-muted);
}

.app-debug-card__value {
  color: var(--hearth-text);
  font-weight: 600;
  text-align: right;
}

.app-install-banner__content {
  min-width: 0;
}

.app-install-banner__title {
  color: var(--hearth-text);
  font-size: 0.92rem;
  font-weight: 700;
}

.app-install-banner__body {
  margin-top: 4px;
  color: var(--hearth-text-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.app-install-banner__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.app-install-banner__button {
  border-radius: 999px;
}

.app-sidebar__toolbar,
.app-sidebar__heading-row,
.app-sidebar__subtoolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.app-sidebar__section-label {
  color: var(--hearth-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.68rem;
  font-weight: 700;
}

.app-sidebar__profile-name,
.app-sidebar__conversation-title {
  color: var(--hearth-text);
}

.app-sidebar__section-caption,
.app-sidebar__conversation-preview,
.app-sidebar__conversation-time,
.app-sidebar__menu-label {
  color: var(--hearth-text-muted);
}

.app-sidebar__search {
  flex: 1;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--hearth-surface-elevated);
  border: 1px solid var(--hearth-border);
  color: var(--hearth-text);
}

.app-sidebar__search :deep(.q-field__control),
.app-sidebar__search :deep(.q-field__marginal),
.app-sidebar__search :deep(.q-field__native),
.app-sidebar__search :deep(input) {
  min-height: 44px;
  color: var(--hearth-text);
}

.app-sidebar__new-chat-btn {
  width: 44px;
  height: 44px;
  min-height: 44px;
  min-width: 44px;
  border-radius: 999px;
  background: linear-gradient(135deg, #7c3aed, #2563eb) !important;
  color: #fff !important;
}

.app-sidebar__context {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-sidebar__conversation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.app-sidebar__search-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
  color: var(--hearth-text-muted);
  font-size: 0.78rem;
}

.app-sidebar__search-state--error {
  color: var(--hearth-danger);
}

.app-sidebar__conversation-link {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  border: 0;
  text-decoration: none;
  text-align: left;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.app-sidebar__section {
  min-height: 0;
}

.app-sidebar__section--conversations {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 12px;
}

.app-sidebar__conversation-link {
  align-items: center;
  justify-content: space-between;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 9px 8px 9px 10px;
}

.app-sidebar__conversation-link:hover {
  background: var(--hearth-surface-elevated);
  border-color: var(--hearth-border);
}

.app-sidebar__conversation-link--active {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(37, 99, 235, 0.15));
  border-color: rgba(124, 58, 237, 0.3);
}

.app-sidebar__profile-avatar {
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  color: #fff;
  border: 1px solid rgba(124, 58, 237, 0.3);
  flex-shrink: 0;
}

.app-sidebar__conversation-main,
.app-sidebar__conversation-meta {
  min-width: 0;
}

.app-sidebar__profile-name,
.app-sidebar__conversation-title {
  font-weight: 600;
}

.app-sidebar__conversation-preview {
  margin-top: 4px;
  font-size: 0.76rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.app-sidebar__conversation-preview--matched {
  color: var(--hearth-text-muted);
}

.app-sidebar__conversation-preview--matched::before {
  content: '“';
}

.app-sidebar__conversation-preview--matched::after {
  content: '”';
}

.app-sidebar__conversation-list {
  overflow-y: auto;
  padding-right: 4px;
}

.app-sidebar__conversation-list--archived {
  max-height: 240px;
}

.app-sidebar__conversation-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.app-sidebar__match-pill {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(109, 93, 252, 0.16);
  color: var(--hearth-text);
  font-size: 0.68rem;
  font-weight: 700;
}

.app-sidebar__match-jump {
  color: var(--hearth-primary);
  font-size: 0.68rem;
  font-weight: 700;
}

.app-sidebar__utility-menu,
:deep(.app-sidebar__conversation-dropdown) {
  background: var(--hearth-surface-elevated) !important;
  color: var(--hearth-text) !important;
  border: 1px solid var(--hearth-border) !important;
  border-radius: 16px !important;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32) !important;
}

:deep(.app-sidebar__conversation-dropdown .q-item) {
  color: var(--hearth-text) !important;
}

:deep(.app-sidebar__conversation-dropdown .q-item__label),
:deep(.app-sidebar__conversation-dropdown .q-item__section),
:deep(.app-sidebar__conversation-dropdown .q-icon) {
  color: inherit !important;
}

:deep(.app-sidebar__utility-menu),
:deep(.app-sidebar__utility-menu .q-menu),
:deep(.app-sidebar__utility-menu .q-menu__content),
:deep(.app-sidebar__utility-menu .q-list),
:deep(.app-sidebar__utility-list) {
  background: var(--hearth-surface-elevated) !important;
  color: var(--hearth-text) !important;
  border: 1px solid var(--hearth-border) !important;
  border-radius: 16px !important;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32) !important;
}

:deep(.app-sidebar__utility-item) {
  color: var(--hearth-text) !important;
}

:deep(.app-sidebar__utility-item .q-item__label),
:deep(.app-sidebar__utility-item .q-item__section),
:deep(.app-sidebar__utility-item .q-icon) {
  color: inherit !important;
}

.app-sidebar__state--compact {
  min-height: 56px;
  padding: 12px;
}

.app-sidebar__conversation-link--archived {
  background: var(--hearth-surface-elevated);
}

.app-sidebar__archived-section {
  border-top: 1px solid var(--hearth-border);
  padding-top: 12px;
}

.app-sidebar__archived-toggle {
  width: 100%;
  background: transparent;
  border: 0;
  padding: 0;
  text-align: left;
}

.app-sidebar__archived-summary {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-sidebar__state,
.app-sidebar__empty {
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--hearth-text-muted);
  border: 1px dashed var(--hearth-border);
  border-radius: 18px;
  background: var(--hearth-surface-elevated);
  padding: 16px;
}

.app-sidebar__count-pill {
  min-width: 28px;
  height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(109, 93, 252, 0.16);
  color: var(--hearth-text);
  font-size: 0.8rem;
  font-weight: 700;
}

.app-sidebar__count-pill--muted {
  background: var(--hearth-surface-soft);
  color: var(--hearth-text-muted);
}

.overlay-card,
:deep(.q-menu) {
  background: var(--hearth-surface-elevated);
  color: var(--hearth-text);
  border: 1px solid var(--hearth-border);
}

:deep(.q-menu .q-item) {
  color: var(--hearth-text);
}

.app-sidebar__mobile-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.app-shell-backdrop {
  display: none;
}

@media (max-width: 767px) {
  .app-layout {
    display: block;
    height: 100dvh;
    overflow: hidden;
  }

  .app-sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 20;
    width: min(86vw, 360px);
    max-width: 360px;
    min-height: 100dvh;
    padding: 18px 16px 24px;
    background: var(--hearth-surface);
    box-shadow: 18px 0 42px rgba(0, 0, 0, 0.4);
    transform: translateX(-104%);
    transition: transform 220ms ease, box-shadow 220ms ease;
    overflow-y: scroll;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    will-change: transform;
  }

  .app-sidebar--mobile-open {
    transform: translateX(0);
  }

  .app-shell-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 10;
    border: 0;
    padding: 0;
    margin: 0;
    background: rgba(0, 0, 0, 0);
    opacity: 0;
    pointer-events: none;
    transition: opacity 220ms ease, background 220ms ease;
  }

  .app-shell-backdrop--visible {
    background: rgba(0, 0, 0, 0.42);
    opacity: 1;
    pointer-events: auto;
    touch-action: none;
  }

  .app-page-container {
    position: fixed;
    inset: 0;
    z-index: 1;
    overflow: hidden;
    transition: transform 220ms ease;
    will-change: transform;
  }

  .app-page-container--drawer-open {
    transform: translateX(min(86vw, 360px));
  }

  .app-page-shell {
    height: 100dvh;
    overflow: hidden;
    transition: filter 220ms ease, opacity 220ms ease;
  }

  .app-page-shell--drawer-open {
    filter: brightness(0.82) saturate(0.88);
    opacity: 0.98;
    overflow: hidden;
    touch-action: none;
    pointer-events: none;
  }

  .app-sidebar__profile-meta,
  .app-sidebar__archive-toggle {
    display: none;
  }
}

.app-sidebar__footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.app-sidebar__profile-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border-radius: 12px;
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  text-align: left;
  transition: background 140ms ease, border-color 140ms ease;
}

.app-sidebar__profile-row:hover {
  background: var(--hearth-surface-elevated);
  border-color: var(--hearth-border);
}

.app-sidebar__footer-avatar {
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  color: #fff;
  border: 1px solid rgba(124, 58, 237, 0.3);
  flex-shrink: 0;
  font-size: 1rem;
  font-weight: 700;
}

.app-sidebar__footer-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--hearth-text);
}

// --- Settings bottom-sheet ---

.settings-sheet :deep(.q-dialog__inner) {
  padding: 0 !important;
  max-height: 100dvh !important;
  height: 100dvh !important;
  top: 0 !important;
}

.settings-card {
  width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  background: var(--hearth-surface);
  color: var(--hearth-text);
  border: 1px solid var(--hearth-border);
  border-bottom: none;
  border-radius: 20px 20px 0 0;
  padding: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.settings-card__header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 16px 16px 10px;
  position: relative;
  flex-shrink: 0;
}

.settings-card__title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1rem;
  font-weight: 700;
  color: var(--hearth-text);
  pointer-events: none;
  white-space: nowrap;
}

.settings-card__close-btn {
  flex-shrink: 0;
}

.settings-card__profile-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 20px 24px;
  flex-shrink: 0;
}

.settings-card__hero-avatar {
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  color: #fff;
  border: 1px solid rgba(124, 58, 237, 0.3);
  font-size: 1.8rem;
  font-weight: 700;
}

.settings-card__hero-name {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--hearth-text);
  margin-top: 4px;
}

.settings-card__hero-sub {
  font-size: 0.82rem;
  color: var(--hearth-text-muted);
  font-weight: 500;
  cursor: pointer;
}

.settings-card__body {
  padding: 0 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.settings-card__account-card {
  background: var(--hearth-surface-elevated);
  border: 1px solid var(--hearth-border);
  border-radius: 16px;
  overflow: hidden;
}

.settings-card__agent-name-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 14px;
  color: var(--hearth-text-muted);
}

.settings-card__agent-name-group {
  flex: 1;
  min-width: 0;
}

.settings-card__agent-name-label {
  font-size: 0.78rem;
  color: var(--hearth-text-muted);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.settings-card__agent-name-input {
  font-size: 0.95rem;
}

.settings-card__agent-name-input :deep(.q-field__control) {
  border-radius: 8px;
  min-height: 36px;
}

.settings-card__account-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 16px;
  background: transparent;
  border: 0;
  cursor: pointer;
  text-align: left;
  color: var(--hearth-text);
  font-size: 0.92rem;
  font-weight: 500;
  transition: background 140ms ease;
}

.settings-card__account-row:hover {
  background: var(--hearth-surface-soft);
}

.settings-card__account-row + .settings-card__account-row {
  border-top: 1px solid var(--hearth-border);
}

.settings-card__account-row-chevron {
  margin-left: auto;
  color: var(--hearth-text-muted);
}

.settings-card__account-row--danger {
  color: var(--hearth-danger);
}

.settings-card__account-row--danger:hover {
  background: rgba(200, 113, 98, 0.1);
}

.settings-card__count-badge {
  margin-left: auto;
  background: var(--hearth-surface-soft);
  color: var(--hearth-text-muted);
  font-size: 0.74rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  line-height: 1.4;
}

.settings-card__archived-list {
  border-top: 1px solid var(--hearth-border);
  max-height: 280px;
  overflow-y: auto;
}

.settings-card__archived-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: 0;
  border-top: 1px solid var(--hearth-border);
  cursor: pointer;
  text-align: left;
  color: var(--hearth-text-muted);
  transition: background 120ms ease;
  gap: 12px;
}

.settings-card__archived-item:first-child {
  border-top: 0;
}

.settings-card__archived-item:hover {
  background: var(--hearth-surface-soft);
  color: var(--hearth-text);
}

.settings-card__archived-item-title {
  font-size: 0.88rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.settings-card__archived-item-time {
  font-size: 0.74rem;
  color: var(--hearth-text-muted);
  flex-shrink: 0;
}

.settings-card__version-label {
  margin-top: auto;
  padding-top: 16px;
  text-align: center;
  color: var(--hearth-text-muted);
  font-size: 0.74rem;
}

.login-card {
  width: min(440px, 92vw);
  background: var(--hearth-surface);
  color: var(--hearth-text);
  border: 1px solid var(--hearth-border);
  border-radius: 24px;
  padding: 32px 28px 28px;
}

.login-card__step {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.login-card__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.login-card__header--pin {
  flex-direction: row;
  align-items: center;
  text-align: left;
  gap: 12px;
}

.login-card__title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--hearth-text);
}

.login-card__profiles {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.login-card__profile-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 12px 14px;
  background: transparent;
  border: 1px solid var(--hearth-border);
  border-radius: 14px;
  cursor: pointer;
  color: var(--hearth-text);
  transition: background 140ms ease, border-color 140ms ease;
}

.login-card__profile-btn:hover {
  background: var(--hearth-surface-elevated);
  border-color: rgba(109, 93, 252, 0.2);
}

.login-card__avatar {
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  color: #fff;
  border: 1px solid rgba(124, 58, 237, 0.3);
  flex-shrink: 0;
  font-size: 1rem;
  font-weight: 700;
}

.login-card__profile-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--hearth-text);
}

.login-card__pin-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-card__pin-input :deep(.q-field__control) {
  background: var(--hearth-surface-elevated);
  border-color: var(--hearth-border);
  color: var(--hearth-text);
}

.login-card__pin-input :deep(.q-field__label),
.login-card__pin-input :deep(.q-field__native) {
  color: var(--hearth-text);
}

.login-card__submit-btn {
  border-radius: 999px;
  min-height: 44px;
}

.login-card__state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  color: var(--hearth-text-muted);
}

.login-card__state--error {
  color: var(--hearth-danger);
  font-size: 0.88rem;
}

.login-failure-state {
  display: flex;
  justify-content: center;
}

.login-failure-card {
  width: 100%;
  padding: 24px;
  border-radius: 24px;
  border: 1px solid var(--hearth-border);
  background: color-mix(in srgb, var(--hearth-surface-elevated) 90%, transparent);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: center;
}

.login-failure-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  align-self: center;
  padding: 8px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--hearth-danger) 16%, transparent);
  color: var(--hearth-danger);
  font-size: 0.8rem;
  font-weight: 700;
}

.login-failure-card__badge--auth {
  background: color-mix(in srgb, var(--hearth-primary) 18%, transparent);
  color: var(--hearth-primary);
}

.login-failure-card__title {
  font-size: 1.18rem;
  font-weight: 700;
  color: var(--hearth-text);
}

.login-failure-card__body {
  color: var(--hearth-text-muted);
  line-height: 1.7;
}

.login-failure-card__detail {
  color: var(--hearth-text-muted);
  font-size: 0.84rem;
  line-height: 1.6;
}

.login-failure-card__actions {
  display: flex;
  justify-content: center;
}

.login-failure-card__primary {
  min-height: 42px;
  border-radius: 999px;
}

@media (max-width: 767px) {
  .login-card {
    width: 100%;
    border-radius: 0;
    min-height: 100dvh;
    padding: 48px 24px 32px;
    border: none;
    justify-content: center;
  }
}
.update-dialog-card {
  min-width: 280px;
  max-width: 340px;
  border-radius: 16px;
  background: var(--hearth-card-bg, #1e1e1e);
}
</style>
