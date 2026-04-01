<template>
  <div class="chat-page">
    <section class="chat-panel">
      <header class="chat-header">
        <div class="chat-toolbar">
          <q-btn
            v-if="isMobile"
            flat
            round
            dense
            icon="menu"
            aria-label="Open app drawer"
            class="mobile-sidebar-toggle"
            @click="openMobileDrawer"
          />

          <q-chip v-if="isArchivedConversation" class="archive-chip" square icon="inventory_2">
            Archived
          </q-chip>

          <div class="chat-title-area">
            <span v-if="activeConversation" class="chat-title-text">{{ activeConversation.title || 'Chat' }}</span>
          </div>

          <div class="chat-toolbar-actions">
          <q-select
            v-if="activeConversation"
            v-model="selectedModelPreset"
            dense
            outlined
            emit-value
            map-options
            options-dense
            behavior="menu"
            options-dark
            menu-anchor="bottom end"
            menu-self="top end"
            popup-content-class="model-select-menu"
            dropdown-icon="expand_more"
            class="model-select chat-header-model-select model-pill-select"
            :options="modelPresetOptions"
          />

          <q-btn
            v-if="activeConversation"
            flat
            round
            dense
            icon="more_horiz"
            class="chat-menu-btn"
            aria-label="Chat options"
          >
            <q-menu
              anchor="bottom end"
              self="top end"
              class="chat-actions-menu"
            >
              <q-list style="min-width: 220px;">
                <q-item clickable v-close-popup @click="handleChatShare">
                  <q-item-section avatar><q-icon name="share" /></q-item-section>
                  <q-item-section>Share</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="promptRenameConversation(activeConversation)">
                  <q-item-section avatar><q-icon name="edit" /></q-item-section>
                  <q-item-section>Rename</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="openViewFilesDialog">
                  <q-item-section avatar><q-icon name="attach_file" /></q-item-section>
                  <q-item-section>View files in chat</q-item-section>
                </q-item>
                <q-item v-if="!isArchivedConversation" clickable v-close-popup @click="promptArchiveConversation(activeConversation)">
                  <q-item-section avatar><q-icon name="archive" /></q-item-section>
                  <q-item-section>Archive</q-item-section>
                </q-item>
                <q-separator />
                <q-item clickable v-close-popup class="text-negative" @click="handleChatDelete">
                  <q-item-section avatar><q-icon name="delete_outline" color="red-4" /></q-item-section>
                  <q-item-section>Delete</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
          </div>
        </div>
      </header>

      <div v-if="isArchivedConversation" class="chat-notice">
        This chat is archived. You can still read it, rename it, and restore it when you want it back in the active list.
      </div>

      <div v-if="conversationError && !showConversationLoadState" class="chat-notice chat-notice--error">
        <div>{{ conversationError }}</div>
      </div>

      <div ref="conversationBodyRef" class="conversation-body" @scroll.passive="handleConversationScroll">
        <q-inner-loading :showing="messagesLoading" class="conversation-loading-overlay">
          <div class="conversation-loading-overlay__content">
            <q-spinner color="primary" size="32px" />
          </div>
        </q-inner-loading>

        <div v-if="showConversationLoadState" class="conversation-failure-state">
          <div class="conversation-failure-card">
            <div class="conversation-failure-card__badge">
              <q-icon name="wifi_off" size="18px" />
              <span>Connection lost</span>
            </div>
            <div class="conversation-failure-card__title">This chat did not load</div>
            <div class="conversation-failure-card__body">
              We couldn&apos;t reach this conversation just now. Check your connection and try again.
            </div>
            <div class="conversation-failure-card__detail">
              {{ activeConversationLoadError }}
            </div>
            <div class="conversation-failure-card__actions">
              <q-btn
                color="primary"
                unelevated
                no-caps
                icon="refresh"
                label="Retry"
                class="conversation-failure-card__primary"
                :loading="retryingConversationLoad"
                @click="retryConversationLoad"
              />
              <q-btn
                flat
                no-caps
                icon="west"
                label="Back to chats"
                class="conversation-failure-card__secondary"
                @click="returnToChatList"
              />
            </div>
          </div>
        </div>

        <div v-else-if="activeMessages.length" ref="messageStackRef" class="message-stack">
          <div
            v-for="message in activeMessages"
            :key="message.id"
            class="message-row"
            :class="[
              message.role === 'user' ? 'message-row--user' : 'message-row--assistant',
              { 'message-row--search-hit': highlightedMessageId === String(message.id) },
            ]"
            :data-message-id="String(message.id)"
            :data-message-record-id="message.recordId ? String(message.recordId) : undefined"
          >
            <div
              v-if="message.meta?.isTypingRow || message.meta?.isGeneratingImage"
              class="typing-row"
              :class="{ 'typing-row--generating': message.meta?.isGeneratingImage }"
            >
              <div class="typing-row__label">{{ message.meta?.isGeneratingImage ? 'Generating image…' : AGENT_DISPLAY_NAME }}</div>
              <div class="typing-row__dots" :aria-label="message.meta?.isGeneratingImage ? 'Generating image' : `${AGENT_DISPLAY_NAME} is thinking`">
                <span></span><span></span><span></span>
              </div>
            </div>

            <div v-else class="message-card" :class="messageCardClass(message)">
              <div v-if="messageAttachments(message).length" class="message-attachments">
                <div
                  v-if="imageAttachments(message).length"
                  class="message-attachment-grid"
                  :class="{ 'message-attachment-grid--single': imageAttachments(message).length === 1 }"
                >
                  <button
                    v-for="attachment in imageAttachments(message)"
                    :key="attachment.id || attachment.url || attachment.name"
                    type="button"
                    class="message-attachment-image-link"
                    @click="openAttachmentLightbox(attachment)"
                  >
                    <img
                      :src="attachment.url"
                      :alt="attachment.name"
                      class="message-attachment-image"
                      @load="handleConversationAssetLoad"
                    >
                  </button>
                </div>

                <div v-if="fileAttachments(message).length" class="message-file-list">
                  <a
                    v-for="attachment in fileAttachments(message)"
                    :key="attachment.id || attachment.url || attachment.name"
                    :href="attachment.url"
                    target="_blank"
                    rel="noreferrer"
                    class="message-file-chip"
                  >
                    <q-icon :name="attachmentIcon(attachment)" size="18px" />
                    <span class="message-file-chip__label">{{ attachment.name }}</span>
                    <span class="message-file-chip__meta">{{ attachmentExtensionLabel(attachment) }}</span>
                  </a>
                </div>
              </div>

              <div
                v-if="messageDisplayText(message) && message.role === 'assistant'"
                class="message-content message-content--markdown"
                v-html="renderedMarkdown(messageDisplayText(message))"
              />
              <div
                v-else-if="messageDisplayText(message)"
                class="message-content"
              >{{ messageDisplayText(message) }}</div>

              <div
                v-if="message.role === 'assistant' && message.meta?.isError && message.meta?.statusLabel"
                class="message-footnote text-negative"
              >
                {{ message.meta.statusLabel }}
              </div>

              <div v-if="!message.meta?.isTypingRow && message.role === 'assistant'" class="message-card__footer">
                <div class="message-card__actions">
                  <q-btn
                    flat
                    round
                    dense
                    icon="content_copy"
                    class="message-action-btn"
                    aria-label="Copy message"
                    @click="copyMessage(message)"
                  >
                    <q-tooltip anchor="top middle" self="bottom middle" :offset="[0, 4]">Copy</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    round
                    dense
                    :icon="speakingMessageId === message.id ? 'volume_off' : 'volume_up'"
                    :class="['message-action-btn', { 'message-action-btn--speaking': speakingMessageId === message.id }]"
                    aria-label="Speak message"
                    @click="speakMessage(message)"
                  >
                    <q-tooltip anchor="top middle" self="bottom middle" :offset="[0, 4]">{{ speakingMessageId === message.id ? 'Stop' : 'Speak' }}</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    round
                    dense
                    icon="share"
                    class="message-action-btn"
                    aria-label="Share message"
                    @click="shareMessage(message)"
                  >
                    <q-tooltip anchor="top middle" self="bottom middle" :offset="[0, 4]">Share</q-tooltip>
                  </q-btn>
                </div>
              </div>
            </div>
          </div>

          <div v-if="showActiveThinkingIndicator" class="message-row message-row--assistant">
            <div class="typing-row">
              <div class="typing-row__label">{{ AGENT_DISPLAY_NAME }}</div>
              <div v-if="activePendingReplyState?.status?.label && activePendingReplyState.status.label !== 'Sending…' && activePendingReplyState.status.label !== 'Queued for OpenClaw'" class="typing-row__tool-label">
                {{ activePendingReplyState.status.label }}
              </div>
              <div v-else class="typing-row__dots" aria-label="Agent is thinking">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>


          <div ref="conversationEndRef" class="conversation-end-anchor" aria-hidden="true"></div>
        </div>

        <button v-if="!activeConversation && !messagesLoading" type="button" class="empty-state empty-state--tappable" @click="focusComposerInput">
          <div class="empty-state__eyebrow">Ready</div>
          <div class="empty-state__title">What's on your mind?</div>
          <div class="empty-state__body">Tap here or the text box below to start.</div>
        </button>

        <transition name="scroll-latest">
          <button
            v-if="showScrollToLatest"
            type="button"
            class="scroll-latest-btn"
            @click="scrollToLatest"
          >
            <q-icon name="south" size="18px" />
            <span>Latest</span>
          </button>
        </transition>
      </div>

      <footer v-if="!showConversationLoadState" class="composer-shell">
        <div class="composer-card">
          <input
            ref="fileInputRef"
            type="file"
            class="composer-file-input"
            accept="image/*,.pdf,.txt,.md,.json,.csv,text/plain,text/markdown,application/json,text/csv"
            multiple
            @change="handleAttachmentSelection"
          >

          <div v-if="pendingAttachments.length" class="composer-attachments">
            <div class="composer-attachments__header">
              <div>
                <div class="composer-attachments__title">
                  {{ pendingAttachments.length }} attachment{{ pendingAttachments.length === 1 ? '' : 's' }} ready
                </div>
                <div class="composer-attachments__hint">Images, PDFs, and text files up to 12 MB each</div>
              </div>
              <div class="composer-attachments__count">{{ pendingAttachments.length }}/8</div>
            </div>

            <div class="composer-attachment-list">
              <div
                v-for="attachment in pendingAttachments"
                :key="attachment.localId"
                class="composer-attachment-chip"
                :class="{ 'composer-attachment-chip--image': attachment.category === 'image' }"
              >
                <button
                  v-if="attachment.previewUrl"
                  type="button"
                  class="composer-attachment-chip__thumb composer-attachment-chip__thumb--button"
                  @click="openPendingAttachmentPreview(attachment)"
                >
                  <img :src="attachment.previewUrl" :alt="attachment.name">
                </button>
                <div v-else class="composer-attachment-chip__icon">
                  <q-icon :name="attachmentIcon(attachment)" size="18px" />
                </div>

                <div class="composer-attachment-chip__body">
                  <div class="composer-attachment-chip__name">{{ attachment.name }}</div>
                  <div class="composer-attachment-chip__meta">
                    {{ attachmentExtensionLabel(attachment) }} · {{ formatAttachmentSize(attachment.sizeBytes) }}
                  </div>
                </div>

                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="close"
                  color="grey-5"
                  aria-label="Remove attachment"
                  @click="removePendingAttachment(attachment.localId)"
                />
              </div>
            </div>
          </div>

          <div v-if="isImageEditMode" class="composer-edit-mode">
            <div class="composer-edit-mode__banner">
              <div class="composer-edit-mode__eyebrow">Editing attached image</div>
              <div class="composer-edit-mode__body">Use the image as source and describe what you want changed.</div>
            </div>

            <div class="composer-edit-mode__chips">
              <q-btn
                v-for="option in imageEditQuickPrompts"
                :key="option.label"
                flat
                no-caps
                dense
                class="composer-edit-mode__chip"
                :label="option.label"
                @click="applyImageEditPrompt(option.prompt)"
              />
            </div>
          </div>

          <div class="composer-row">
            <q-btn
              flat
              round
              dense
              icon="attach_file"
              class="composer-plus-btn"
              aria-label="Add attachment"
              :disable="isArchivedConversation || sendingMessage || uploadingAttachments"
              @click="openAttachmentPicker"
            />

            <div class="composer-input-wrap">
              <q-input
                ref="composerInputRef"
                v-model="draft"
                autogrow
                borderless
                type="textarea"
                rows="1"
                max-rows="6"
                :placeholder="isImageEditMode ? 'Describe what you want changed…' : `Message ${AGENT_DISPLAY_NAME}…`"
                input-class="composer-input"
                :disable="isArchivedConversation || sendingMessage || uploadingAttachments"
                @focus="handleComposerFocus"
                @blur="handleComposerBlur"
                @keyup.enter.exact.prevent="handleSendMessage"
              />
              <div v-if="uploadingAttachments" class="composer-uploading">
                Uploading attachment{{ pendingAttachments.length === 1 ? '' : 's' }}…
              </div>
            </div>

            <q-btn
              v-if="isArchivedConversation"
              color="primary"
              no-caps
              unelevated
              icon="unarchive"
              label="Restore"
              class="composer-restore-btn"
              :loading="restoreLoading"
              @click="handleRestoreConversation(activeConversation)"
            />
            <q-btn
              v-else-if="activePendingReplyState?.pending && !sendingMessage"
              color="grey-7"
              round
              unelevated
              icon="stop"
              class="composer-send-btn composer-send-btn--stop"
              @click="handleStopReply"
            />
            <q-btn
              v-else
              color="primary"
              round
              unelevated
              icon="north_east"
              class="composer-send-btn"
              :disable="!canSendMessage"
              :loading="sendingMessage"
              @click="handleSendMessage"
            />
          </div>

          <div v-if="activeConversation && $q.platform.is.desktop" class="composer-build-marker">
            v{{ appVersionLabel }}
          </div>
        </div>
      </footer>

      <q-dialog v-model="viewFilesDialogOpen">
        <q-card class="chat-files-card">
          <q-card-section class="chat-files-card__header">
            <div class="chat-files-card__title">Files in this chat</div>
            <q-btn flat round dense icon="close" color="grey-5" v-close-popup />
          </q-card-section>

          <q-card-section v-if="chatFiles.length" class="chat-files-card__list">
            <a
              v-for="file in chatFiles"
              :key="file.id || file.url || file.name"
              :href="file.url"
              target="_blank"
              rel="noreferrer"
              class="chat-file-row"
              @click.prevent="openChatFile(file)"
            >
              <q-icon :name="attachmentIcon(file)" size="18px" class="chat-file-row__icon" />
              <div class="chat-file-row__name">{{ file.name }}</div>
              <span class="chat-file-row__ext">{{ attachmentExtensionLabel(file) }}</span>
            </a>
          </q-card-section>

          <q-card-section v-else class="chat-files-card__empty">
            No files have been shared in this chat yet.
          </q-card-section>
        </q-card>
      </q-dialog>

      <q-dialog v-model="imageLightboxOpen" persistent maximized transition-show="fade" transition-hide="fade">
        <div class="image-lightbox">
          <q-btn
            flat
            round
            dense
            icon="close"
            color="white"
            class="image-lightbox__close"
            aria-label="Close image preview"
            @click="closeImageLightbox"
          />

          <div
            ref="lightboxViewportRef"
            class="image-lightbox__viewport"
            :class="{ 'image-lightbox__viewport--zoomed': isLightboxZoomed }"
            @click="handleLightboxViewportClick"
            @pointerdown="handleLightboxPointerDown"
            @pointermove="handleLightboxPointerMove"
            @pointerup="handleLightboxPointerEnd"
            @pointercancel="handleLightboxPointerEnd"
            @lostpointercapture="handleLightboxPointerEnd"
          >
            <img
              v-if="activeLightboxImage"
              ref="lightboxImageRef"
              :src="activeLightboxImage.url"
              :alt="activeLightboxImage.name"
              class="image-lightbox__image"
              :style="lightboxImageStyle"
              draggable="false"
              @dragstart.prevent
              @load="handleLightboxImageLoad"
            >
          </div>

          <div class="image-lightbox__actions" @pointerdown.stop @pointermove.stop @pointerup.stop @pointercancel.stop>
            <q-btn
              flat
              no-caps
              color="white"
              icon="edit"
              label="Edit with this"
              class="image-lightbox__action"
              @click="handleLightboxEditWithThis"
            />
            <q-btn
              flat
              no-caps
              color="white"
              icon="share"
              label="Share"
              class="image-lightbox__action"
              @click="handleLightboxShare"
            />
            <q-btn
              flat
              no-caps
              color="white"
              icon="download"
              label="Save"
              class="image-lightbox__action"
              @click="handleLightboxSave"
            />
          </div>
        </div>
      </q-dialog>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import {
  deleteConversation,
  getConversation,

  speakText,
  streamConversationMessage,
  uploadConversationAttachment,
  updateConversation,
} from 'src/lib/api'
import {
  normalizeContractError,
  normalizeContractStatus,
} from 'src/lib/appChannel'
import { useAppShell } from 'src/lib/appShell'
import { renderMarkdown } from 'src/lib/markdown'
import {
  enqueueMessage,
  getPendingMessages,
  removeQueuedMessage,
  incrementRetry,
  onOnline,
  getIsOnline,
} from 'src/lib/offline-queue'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()

const {
  isMobile,
  openMobileDrawer,
  activeConversation,
  activeMessages,
  messagesByConversation,
  messagesLoading,
  restoreLoading,
  isArchivedConversation,
  handleRestoreConversation,
  handleCreateConversation,
  promptRenameConversation,
  promptArchiveConversation,
  ensureMessagesLoaded,
  messageLoadErrors,
  currentUser,
  handleSelectProfile,
  upsertMessage,
  removeMessage,
  updateConversationRecord,
  removeConversationRecord,
  notifyAssistantReply,
} = useAppShell()

const modelPresetOptions = [
  { label: 'Fast', value: 'fast' },
  { label: 'Deep', value: 'deep' },
]
const appVersionLabel = process.env.VITE_APP_VERSION || '0.0.48'
const { agentDisplayName } = useAppShell()
const AGENT_DISPLAY_NAME = computed(() => agentDisplayName?.value || 'Assistant')

const imageEditQuickPrompts = [
  {
    label: 'Product photo',
    prompt: 'Use the attached image as the source. Turn it into a clean product photo while preserving the subject and core composition.',
  },
  {
    label: 'Remove background',
    prompt: 'Use the attached image as the source. Remove the background while preserving the main subject, edges, and proportions.',
  },
  {
    label: 'Improve lighting',
    prompt: 'Use the attached image as the source. Improve the lighting and overall clarity while keeping the subject, pose, and composition consistent.',
  },
  {
    label: 'Stylize',
    prompt: 'Use the attached image as the source. Apply a stylized look while preserving the original subject, framing, and recognizable details.',
  },
]

const draft = ref('')
const sendingMessage = ref(false)
const isStreamingReply = ref(false)
const uploadingAttachments = ref(false)
const selectedModelPreset = ref('fast')
const composerInputRef = ref(null)
const fileInputRef = ref(null)
const conversationBodyRef = ref(null)
const conversationEndRef = ref(null)
const messageStackRef = ref(null)
const syncingModelPreset = ref(false)
const currentStreamController = ref(null)
const currentStreamingConversationId = ref(null)
const pendingReplyStateByConversation = ref({})
const pendingAttachments = ref([])
const imageEditModeAttachmentId = ref('')
const imageLightboxOpen = ref(false)
const activeLightboxImage = ref(null)
const speakingMessageId = ref(null)
const viewFilesDialogOpen = ref(false)
const retryingConversationLoad = ref(false)
const lightboxViewportRef = ref(null)
const lightboxImageRef = ref(null)
const lightboxTransform = ref({ scale: 1, x: 0, y: 0 })
const userNearConversationBottom = ref(true)
const composerFocused = ref(false)
const highlightedMessageId = ref('')
const remoteSpeechAudio = ref(null)
const revealTimers = new Map()
const activeLightboxPointers = new Map()
let remoteSpeechUrl = ''
let speechRequestToken = 0
let scrollSettleTimer = null
let scrollSettleRunId = 0
let keyboardSyncFrame = null
let messageHighlightTimer = null
const keyboardSyncTimeouts = new Set()
const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 120
const KEYBOARD_INSET_ACTIVATION_PX = 16
const lightboxGesture = {
  mode: 'idle',
  activePointerId: null,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
  pinchStartDistance: 0,
  pinchStartScale: 1,
  pinchContentX: 0,
  pinchContentY: 0,
  moved: false,
}
const acceptedAttachmentExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'md', 'json', 'csv'])
const lightboxImageStyle = computed(() => ({
  transform: `translate3d(${lightboxTransform.value.x}px, ${lightboxTransform.value.y}px, 0) scale(${lightboxTransform.value.scale})`,
}))
const isLightboxZoomed = computed(() => lightboxTransform.value.scale > 1.01)
const showScrollToLatest = computed(() => activeMessages.value.length > 0 && !userNearConversationBottom.value)
const activePendingReplyState = computed(() => {
  const conversationId = activeConversation.value?.id

  if (!conversationId) {
    return null
  }

  return pendingReplyStateByConversation.value[conversationId] || null
})
const showActiveThinkingIndicator = computed(() => {
  if (!activePendingReplyState.value?.pending) {
    return false
  }

  return !activeMessages.value.some((message) => (
    message.role === 'assistant'
      && (message.meta?.isPlaceholder || message.meta?.isTypingRow || message.meta?.isRevealing)
  ))
})
const conversationError = computed(() => activePendingReplyState.value?.error || '')
const activeConversationLoadError = computed(() => {
  const conversationId = activeConversation.value?.id

  if (!conversationId) {
    return ''
  }

  return messageLoadErrors.value?.[conversationId] || ''
})
const showConversationLoadState = computed(() => (
  Boolean(activeConversation.value)
  && !messagesLoading.value
  && !activeMessages.value.length
  && Boolean(activeConversationLoadError.value)
))
const chatFiles = computed(() => {
  const files = []
  const seen = new Set()

  for (const message of activeMessages.value) {
    for (const attachment of messageAttachments(message)) {
      const key = attachment.url || attachment.name

      if (key && !seen.has(key)) {
        seen.add(key)
        files.push(attachment)
      }
    }
  }

  return files
})
const isImageEditMode = computed(() => (
  Boolean(imageEditModeAttachmentId.value)
  && pendingAttachments.value.some((attachment) => attachment.localId === imageEditModeAttachmentId.value && attachment.category === 'image')
))
const canSendMessage = computed(() => (
  !isArchivedConversation.value
  && !sendingMessage.value
  && !uploadingAttachments.value
  && (draft.value.trim() !== '' || pendingAttachments.value.length > 0)
  && Boolean(currentUser.value) // must be logged in
))

function emptyConversationStatus() {
  return { state: '', label: '', elapsedMs: 0, note: '' }
}

function normalizePendingReplyState(state = {}) {
  return {
    pending: state.pending === true,
    interrupted: state.interrupted === true,
    needsReconcile: state.needsReconcile === true,
    error: typeof state.error === 'string' ? state.error : '',
    status: {
      ...emptyConversationStatus(),
      ...(state.status || {}),
    },
  }
}

function shouldPersistPendingReplyState(state) {
  return Boolean(
    state
    && (state.pending || state.needsReconcile || state.interrupted || state.error || state.status?.state || state.status?.label),
  )
}

function serializePendingReplyState(state) {
  return normalizePendingReplyState(state)
}

function conversationMessages(conversationId) {
  if (!conversationId) {
    return []
  }

  return messagesByConversation.value[conversationId] || []
}

function findPendingAssistantMessage(conversationId) {
  return [...conversationMessages(conversationId)]
    .reverse()
    .find((message) => message.role === 'assistant' && message.meta?.isPlaceholder)
}

function findOptimisticUserMessage(conversationId) {
  return [...conversationMessages(conversationId)]
    .reverse()
    .find((message) => message.role === 'user' && message.meta?.isOptimistic)
}

function hasCompletedAssistantReply(conversationId) {
  const settledMessages = conversationMessages(conversationId).filter((message) => !message.meta?.isPlaceholder)
  const latestMessage = settledMessages[settledMessages.length - 1]
  return latestMessage?.role === 'assistant'
}

function loadPendingConversationIds() {
  try {
    const raw = window.sessionStorage.getItem('pending-reply-state-by-conversation')
    const parsed = raw ? JSON.parse(raw) : {}

    pendingReplyStateByConversation.value = Object.fromEntries(
      Object.entries(parsed)
        .map(([conversationId, state]) => [Number(conversationId), normalizePendingReplyState(state)])
        .filter(([, state]) => state),
    )
  } catch {
    pendingReplyStateByConversation.value = {}
  }
}

function savePendingConversationIds() {
  const persisted = Object.fromEntries(
    Object.entries(pendingReplyStateByConversation.value)
      .filter(([, state]) => shouldPersistPendingReplyState(state))
      .map(([conversationId, state]) => [conversationId, serializePendingReplyState(state)]),
  )

  window.sessionStorage.setItem('pending-reply-state-by-conversation', JSON.stringify(persisted))
}

function setPendingReplyState(conversationId, patch) {
  if (!conversationId) {
    return
  }

  const normalizedConversationId = Number(conversationId)
  const current = pendingReplyStateByConversation.value[normalizedConversationId] || normalizePendingReplyState()
  const next = normalizePendingReplyState({
    ...current,
    ...patch,
    status: {
      ...emptyConversationStatus(),
      ...(current.status || {}),
      ...(patch?.status || {}),
    },
  })

  pendingReplyStateByConversation.value = {
    ...pendingReplyStateByConversation.value,
    [normalizedConversationId]: next,
  }
  savePendingConversationIds()
}

function clearPendingReplyState(conversationId) {
  if (!conversationId || !pendingReplyStateByConversation.value[Number(conversationId)]) {
    return
  }

  const next = { ...pendingReplyStateByConversation.value }
  delete next[Number(conversationId)]
  pendingReplyStateByConversation.value = next
  savePendingConversationIds()
}

function setComposerKeyboardInset(value) {
  const inset = Math.max(0, value)
  document.documentElement.style.setProperty('--composer-keyboard-offset', `${inset}px`)
}

function currentViewportHeight() {
  if (typeof window === 'undefined') {
    return 0
  }

  const viewport = window.visualViewport

  if (viewport) {
    return viewport.height + viewport.offsetTop
  }

  return window.innerHeight || document.documentElement.clientHeight || 0
}

function currentLayoutViewportHeight() {
  if (typeof window === 'undefined') {
    return 0
  }

  return window.innerHeight || document.documentElement.clientHeight || 0
}

function clearKeyboardSyncTimers() {
  if (keyboardSyncFrame !== null) {
    window.cancelAnimationFrame(keyboardSyncFrame)
    keyboardSyncFrame = null
  }

  for (const timeoutId of keyboardSyncTimeouts) {
    window.clearTimeout(timeoutId)
  }

  keyboardSyncTimeouts.clear()
}

function requestKeyboardInsetSync() {
  if (typeof window === 'undefined' || keyboardSyncFrame !== null) {
    return
  }

  keyboardSyncFrame = window.requestAnimationFrame(() => {
    keyboardSyncFrame = null
    syncKeyboardInset()
  })
}

function scheduleKeyboardInsetSync(delays = [0]) {
  if (typeof window === 'undefined') {
    return
  }

  for (const delay of delays) {
    if (delay <= 0) {
      requestKeyboardInsetSync()
      continue
    }

    const timeoutId = window.setTimeout(() => {
      keyboardSyncTimeouts.delete(timeoutId)
      requestKeyboardInsetSync()
    }, delay)

    keyboardSyncTimeouts.add(timeoutId)
  }
}

function syncKeyboardInset() {
  if (typeof window === 'undefined') {
    return
  }

  const viewport = window.visualViewport
  const layoutViewportHeight = currentLayoutViewportHeight()

  if (!viewport) {
    setComposerKeyboardInset(0)
    return
  }

  const viewportBottom = currentViewportHeight()
  const keyboardInset = Math.max(0, layoutViewportHeight - viewportBottom)

  if (!composerFocused.value) {
    setComposerKeyboardInset(0)
    return
  }

  setComposerKeyboardInset(keyboardInset > KEYBOARD_INSET_ACTIVATION_PX ? keyboardInset : 0)
}

function handleComposerFocus() {
  composerFocused.value = true
  clearKeyboardSyncTimers()
  scheduleKeyboardInsetSync([0, 80, 180, 320])
}

function handleComposerBlur() {
  composerFocused.value = false
  setComposerKeyboardInset(0)
  clearKeyboardSyncTimers()
  scheduleKeyboardInsetSync([40, 120, 240])
}

function handleKeyboardViewportChange() {
  requestKeyboardInsetSync()
}

onMounted(() => {
  loadPendingConversationIds()
  syncKeyboardInset()
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handleWindowFocus)
  window.addEventListener('resize', handleLightboxViewportResize)
  window.addEventListener('resize', handleKeyboardViewportChange)
  window.visualViewport?.addEventListener('resize', handleKeyboardViewportChange)
  window.visualViewport?.addEventListener('scroll', handleKeyboardViewportChange)
  reconcileInterruptedConversation()

  // Flush offline queue when connectivity is restored
  onOnline(() => {
    setTimeout(() => flushOfflineQueue(), 1500)
  })
})

onBeforeUnmount(() => {
  stopSpeaking()
  clearKeyboardSyncTimers()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('focus', handleWindowFocus)
  window.removeEventListener('resize', handleLightboxViewportResize)
  window.removeEventListener('resize', handleKeyboardViewportChange)
  window.visualViewport?.removeEventListener('resize', handleKeyboardViewportChange)
  window.visualViewport?.removeEventListener('scroll', handleKeyboardViewportChange)
  setComposerKeyboardInset(0)

  for (const messageId of revealTimers.keys()) {
    clearRevealTimer(messageId)
  }

  clearConversationScrollSettle()
  clearMessageHighlight()
  clearPendingAttachments()
})

watch(activeConversation, async (conversation, previousConversation) => {
  stopSpeaking()
  clearPendingAttachments()
  clearMessageHighlight()
  syncingModelPreset.value = true
  selectedModelPreset.value = conversation?.model_preset || 'fast'
  await nextTick()
  syncingModelPreset.value = false

  if (!conversation?.id) {
    draft.value = ''
    setTimeout(() => focusComposerInput(), 100)
    return
  }

  // Restore any unsent draft for this conversation
  const saved = restoreDraft(conversation.id)
  if (saved && conversation.id !== previousConversation?.id) {
    draft.value = saved
  } else if (conversation.id !== previousConversation?.id) {
    draft.value = ''
  }

  await ensureMessagesLoaded(conversation.id, { quiet: true })
  queueConversationScrollToBottom({ attempts: 10, force: conversation.id !== previousConversation?.id })
}, { immediate: true })

watch(activeMessages, () => {
  if (route.query.message) {
    return
  }

  // Don't auto-scroll while streaming — let user read from the top of the reply
  if (isStreamingReply.value) {
    return
  }

  queueConversationScrollToBottom()
})

watch(messagesLoading, (loading) => {
  if (!loading && activeConversation.value?.id && !route.query.message) {
    queueConversationScrollToBottom({ attempts: 10 })
  }
})

watch(
  () => [activeConversation.value?.id || null, messagesLoading.value, route.query.message?.toString() || '', route.query.messageAt?.toString() || ''],
  async ([conversationId, loading, messageId, messageAt]) => {
    if (!conversationId || loading || (!messageId && !messageAt)) {
      return
    }

    const found = await scrollToMessage({ messageId, messageAt })

    if (!found) {
      return
    }

    const nextQuery = { ...route.query }
    delete nextQuery.message
    delete nextQuery.messageAt
    await router.replace({ query: nextQuery })
  },
  { immediate: true },
)

watch(imageLightboxOpen, async (isOpen) => {
  if (isOpen) {
    resetImageLightboxTransform()
    await nextTick()
    handleLightboxViewportResize()
    return
  }

  activeLightboxImage.value = null
  resetImageLightboxTransform()
})

// Draft persistence — save/restore per conversation
const DRAFT_KEY_PREFIX = 'hearth_draft_'

function draftStorageKey(conversationId) {
  return `${DRAFT_KEY_PREFIX}${conversationId}`
}

function saveDraft(conversationId, text) {
  if (!conversationId) return
  try {
    if (text && text.trim()) {
      localStorage.setItem(draftStorageKey(conversationId), text)
    } else {
      localStorage.removeItem(draftStorageKey(conversationId))
    }
  } catch { /* ignore */ }
}

function restoreDraft(conversationId) {
  if (!conversationId) return ''
  try {
    return localStorage.getItem(draftStorageKey(conversationId)) || ''
  } catch { return '' }
}

function clearDraft(conversationId) {
  if (!conversationId) return
  try { localStorage.removeItem(draftStorageKey(conversationId)) } catch { /* ignore */ }
}

let draftSaveTimer = null
watch(draft, async (value) => {
  if (!value) {
    await resetComposerHeight()
  }
  // Debounced save to localStorage
  if (draftSaveTimer) clearTimeout(draftSaveTimer)
  draftSaveTimer = setTimeout(() => {
    if (activeConversation.value?.id) {
      saveDraft(activeConversation.value.id, value)
    }
  }, 400)
})

watch(sendingMessage, async (isSending) => {
  if (!isSending) {
    await resetComposerHeight()
  }
})

watch(selectedModelPreset, async (preset) => {
  if (syncingModelPreset.value || !activeConversation.value?.id) {
    return
  }

  const previousPreset = activeConversation.value.model_preset || 'fast'

  if (preset === previousPreset) {
    return
  }

  syncingModelPreset.value = true

  try {
    updateConversationRecord({
      ...activeConversation.value,
      model_preset: preset,
    })
    await updateConversation(activeConversation.value.id, { model_preset: preset })
  } catch (error) {
    selectedModelPreset.value = previousPreset
    updateConversationRecord({
      ...activeConversation.value,
      model_preset: previousPreset,
    })
    setPendingReplyState(activeConversation.value.id, {
      error: error?.message || 'Unable to update model selection.',
    })
  } finally {
    syncingModelPreset.value = false
  }
})

function isInterruptedStreamError(error) {
  return error?.name === 'AbortError' || error === 'app-hidden' || error === 'page-unload'
}

function updatePendingAssistantInterrupted(conversationId) {
  const pendingAssistant = findPendingAssistantMessage(conversationId)

  if (!pendingAssistant) {
    return
  }

  upsertMessage(conversationId, {
    ...pendingAssistant,
    displayContent: pendingAssistant.displayContent || 'Reply may still be in progress…',
    meta: {
      ...pendingAssistant.meta,
      isInterrupted: true,
      isTypingRow: false,
      statusLabel: 'App was backgrounded. Checking again when you return…',
    },
  })
}

async function reconcileInterruptedConversation() {
  const ids = Object.entries(pendingReplyStateByConversation.value)
    .filter(([, state]) => state?.pending || state?.needsReconcile)
    .map(([conversationId]) => Number(conversationId))

  for (const conversationId of ids) {
    await ensureMessagesLoaded(conversationId, { force: true, quiet: true })

    if (hasCompletedAssistantReply(conversationId)) {
      clearPlaceholderAssistants(conversationId)
      clearPendingReplyState(conversationId)

      if (activeConversation.value?.id === conversationId) {
        queueConversationScrollToBottom({ attempts: 10, force: true })
      }

      continue
    }

    setPendingReplyState(conversationId, {
      pending: true,
      interrupted: true,
      needsReconcile: false,
      error: '',
      status: {
        state: 'reconnecting',
        label: 'Checking for reply…',
        elapsedMs: 0,
        note: '',
      },
    })
    updatePendingAssistantInterrupted(conversationId)

    if (activeConversation.value?.id === conversationId) {
      queueConversationScrollToBottom({ attempts: 10, force: true })
    }
  }
}

function handleVisibilityChange() {
  syncKeyboardInset()

  if (document.visibilityState === 'hidden' && sendingMessage.value) {
    const conversationId = currentStreamingConversationId.value

    if (conversationId) {
      setPendingReplyState(conversationId, {
        pending: true,
        interrupted: true,
        needsReconcile: true,
        error: '',
        status: {
          state: 'interrupted',
          label: 'Reply may still be in progress',
          elapsedMs: 0,
          note: '',
        },
      })
      updatePendingAssistantInterrupted(conversationId)
    }

    return
  }

  if (document.visibilityState === 'visible') {
    reconcileInterruptedConversation()
  }
}

function handleWindowFocus() {
  reconcileInterruptedConversation()
}

function handleConversationAssetLoad() {
  if (activeConversation.value?.id) {
    queueConversationScrollToBottom({ attempts: 6 })
  }
}

function distanceFromConversationBottom() {
  const element = conversationBodyRef.value?.$el || conversationBodyRef.value

  if (!element) {
    return 0
  }

  return Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop)
}

function isNearConversationBottom() {
  return distanceFromConversationBottom() <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX
}

function updateConversationBottomAffinity() {
  userNearConversationBottom.value = isNearConversationBottom()
}

function handleConversationScroll() {
  updateConversationBottomAffinity()
}

function scrollToLatest() {
  queueConversationScrollToBottom({ attempts: 10, force: true })
}

async function retryConversationLoad() {
  if (!activeConversation.value?.id || retryingConversationLoad.value) {
    return
  }

  retryingConversationLoad.value = true
  setPendingReplyState(activeConversation.value.id, { error: '' })

  try {
    await ensureMessagesLoaded(activeConversation.value.id, { force: true, quiet: true })
  } finally {
    retryingConversationLoad.value = false
  }
}

function returnToChatList() {
  if (!activeConversation.value?.user_id) {
    return
  }

  handleSelectProfile(activeConversation.value.user_id)
}

async function handleStopReply() {
  const conversationId = activeConversation.value?.id
  if (!conversationId) return
  try {
    await fetch(`/nest-api/conversations/${conversationId}/messages/abort`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // best effort
  }
  // Optimistically clear the pending state
  setPendingReplyState(conversationId, { pending: false, error: null })
}

async function handleSendMessage() {
  const content = draft.value.trim()
  const attachmentsForSend = pendingAttachments.value.map((attachment) => attachment.token).filter(Boolean)

  if (sendingMessage.value || isArchivedConversation.value || uploadingAttachments.value) {
    return
  }

  if (!content && attachmentsForSend.length === 0) {
    return
  }

  // If no active conversation, create one now (lazy creation)
  if (!activeConversation.value) {
    await handleCreateConversation()
    await nextTick() // wait for computed activeConversation to update
    if (!activeConversation.value) return // creation failed
  }

  const conversationId = activeConversation.value.id
  const conversationSnapshot = { ...activeConversation.value }
  const sendStartedAt = new Date().toISOString()
  const optimisticUserMessageId = `optimistic-user-${Date.now()}`
  const placeholderId = `pending-assistant-local-${Date.now()}`
  const streamPlaceholderId = `pending-assistant-stream-${Date.now()}`
  let assistantReplySettled = false
  let receivedStreamingDeltas = false

  sendingMessage.value = true
  // Clear draft immediately on send — will be restored if send fails
  clearDraft(conversationId)
  draft.value = ''

  upsertMessage(conversationId, {
    id: optimisticUserMessageId,
    role: 'user',
    content,
    displayContent: content,
    created_at: sendStartedAt,
    attachments: pendingAttachments.value.map((attachment) => ({
      id: attachment.localId,
      name: attachment.name,
      url: attachment.previewUrl || '',
      extension: attachment.extension,
      category: attachment.category,
      mime_type: attachment.mimeType,
      size_bytes: attachment.sizeBytes,
    })),
    meta: {
      isOptimistic: true,
    },
  })

  setPendingReplyState(conversationId, {
    pending: true,
    interrupted: false,
    needsReconcile: false,
    error: '',
    status: {
      state: 'queued',
      label: 'Sending…',
      elapsedMs: 0,
      note: '',
    },
  })
  queueConversationScrollToBottom({ attempts: 10, force: true })

  try {
    currentStreamController.value = new AbortController()
    currentStreamingConversationId.value = conversationId

    await streamConversationMessage(conversationId, { content, attachments: attachmentsForSend }, {
      signal: currentStreamController.value.signal,
      onUserMessage(message) {
        const optimisticUserMessage = findOptimisticUserMessage(conversationId)

        if (optimisticUserMessage) {
          removeMessage(conversationId, optimisticUserMessage.id)
        }

        clearPendingAttachments()
        upsertMessage(conversationId, message)
      },
      onAssistantPlaceholder(message) {
        if (assistantReplySettled) {
          return
        }

        removeMessage(conversationId, placeholderId)
        const isImageGeneration = message?.metadata?.kind === 'image_generation'
        upsertMessage(conversationId, {
          id: streamPlaceholderId,
          role: 'assistant',
          content: isImageGeneration ? 'Generating image…' : '',
          created_at: new Date().toISOString(),
          meta: {
            isPlaceholder: true,
            isTypingRow: !isImageGeneration,
            isGeneratingImage: isImageGeneration,
            elapsedMs: 0,
            statusLabel: isImageGeneration ? 'Generating image…' : '',
          },
        })
      },
      onAssistantDelta(payload) {
        if (assistantReplySettled) {
          return
        }
        if (!receivedStreamingDeltas) {
          // Haptic feedback on first token — like ChatGPT
          navigator.vibrate?.(10)
        }
        receivedStreamingDeltas = true
        isStreamingReply.value = true

        const pendingAssistant = findPendingAssistantMessage(conversationId)

        const assistantShell = pendingAssistant || {
          id: streamPlaceholderId,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
          meta: {
            isPlaceholder: true,
            isTypingRow: true,
            elapsedMs: 0,
          },
        }

        upsertMessage(conversationId, {
          ...assistantShell,
          displayContent: payload?.text || assistantShell.displayContent || assistantShell.content || '',
          meta: {
            ...assistantShell.meta,
            isTypingRow: false,
            elapsedMs: payload?.elapsed_ms || payload?.elapsedMs || assistantShell.meta?.elapsedMs || 0,
          },
        })
      },
      onAssistantMessage(message, payload) {
        assistantReplySettled = true
        isStreamingReply.value = false
        clearPendingReplyState(conversationId)

        const clearPendingPlaceholder = () => {
          removeMessage(conversationId, placeholderId)

          window.requestAnimationFrame(() => {
            clearPlaceholderAssistants(conversationId)
          })
        }

        if (payload?.stream_mode === 'responses-http-sse') {
          const finalMessage = {
            ...message,
            displayContent: message.content || '',
            meta: {},
          }
          upsertMessage(conversationId, finalMessage)
          clearPendingPlaceholder()
          nextTick(() => {
            const msgEl = document.querySelector(`[data-message-id="${message.id}"]`)
            if (msgEl) {
              msgEl.scrollIntoView({ block: 'start', behavior: 'smooth' })
            }
          })
          notifyAssistantReply(conversationId, finalMessage)
          return
        }

        if (receivedStreamingDeltas) {
          // Already streamed token-by-token — just finalize the message with full content
          upsertMessage(conversationId, {
            ...message,
            displayContent: message.content || '',
            meta: {},
          })
          clearPendingPlaceholder()
          nextTick(() => {
            const msgEl = document.querySelector(`[data-message-id="${message.id}"]`)
            if (msgEl) {
              msgEl.scrollIntoView({ block: 'start', behavior: 'smooth' })
            }
          })
        } else {
          // No streaming — use reveal animation
          upsertMessage(conversationId, {
            ...message,
            displayContent: '',
            meta: {
              revealPending: true,
            },
          })
          clearPendingPlaceholder()

          nextTick(() => {
            const msgEl = document.querySelector(`[data-message-id="${message.id}"]`)
            if (msgEl) {
              msgEl.scrollIntoView({ block: 'start', behavior: 'smooth' })
            } else {
              queueConversationScrollToBottom({ attempts: 6, force: true })
            }
          })

          animateAssistantReveal(conversationId, message.id, message.content || '')
        }
      },
      onStatus(status) {
        if (assistantReplySettled) {
          return
        }

        // Stream has started — release the send button so stop button can show
        if (sendingMessage.value) {
          sendingMessage.value = false
        }

        const normalizedStatus = normalizeContractStatus(status)
        setPendingReplyState(conversationId, {
          pending: true,
          error: '',
          status: {
            state: normalizedStatus.state || '',
            label: normalizedStatus.label || 'Working',
            elapsedMs: normalizedStatus.elapsedMs || 0,
            note: '',
          },
        })
        updatePendingAssistantStatus(conversationId, normalizedStatus)
      },
      onProgress(progress) {
        if (assistantReplySettled) {
          return
        }

        const normalizedProgress = normalizeContractStatus(progress)
        setPendingReplyState(conversationId, {
          pending: true,
          error: '',
          status: {
            state: normalizedProgress.state || 'running',
            label: normalizedProgress.label || 'Working',
            elapsedMs: normalizedProgress.elapsedMs || 0,
            note: '',
          },
        })
        updatePendingAssistantStatus(conversationId, normalizedProgress)
      },
      onDone(payload) {
        if (!assistantReplySettled && pendingReplyStateByConversation.value[conversationId]?.status?.state !== 'error') {
          clearPendingReplyState(conversationId)
        }

        if (payload?.conversation) {
          updateConversationRecord(payload.conversation)
        } else {
          updateConversationRecord({
            ...conversationSnapshot,
            last_message_at: new Date().toISOString(),
          })
        }

        // Re-fetch conversation after delay to pick up async title generation
        const currentTitle = conversationSnapshot?.title
        if (!currentTitle || currentTitle === 'New Chat') {
          setTimeout(async () => {
            try {
              const updated = await getConversation(conversationId)
              if (updated?.title && updated.title !== 'New Chat') {
                updateConversationRecord(updated)
              }
            } catch { /* best effort */ }
          }, 8000)
        }
      },
      onConversationUpdated(payload) {
        if (payload?.id && payload?.title) {
          updateConversationRecord({ id: payload.id, title: payload.title })
        }
      },
      onErrorEvent(payload) {
        if (assistantReplySettled) {
          return
        }

        const normalizedError = normalizeContractError(payload)
        setPendingReplyState(conversationId, {
          pending: false,
          interrupted: false,
          needsReconcile: false,
          error: normalizedError.message,
          status: {
            state: 'error',
            label: 'Something went wrong',
            elapsedMs: normalizedError.elapsedMs || 0,
            note: '',
          },
        })
        updatePendingAssistantError(conversationId, normalizedError.message)
      },
    })

  } catch (error) {
    if (isInterruptedStreamError(error)) {
      setPendingReplyState(conversationId, {
        pending: true,
        interrupted: true,
        needsReconcile: true,
        error: '',
        status: {
          state: 'running',
          label: 'Reply may still be in progress',
          elapsedMs: 0,
          note: '',
        },
      })
      updatePendingAssistantInterrupted(conversationId)
    } else {
      const isNetworkError = !getIsOnline() || error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch')

      if (isNetworkError && content && conversationId) {
        // Queue for retry when back online
        try {
          await enqueueMessage({
            conversationId,
            content,
            attachments: attachmentsForSend,
            profileId: activeConversation.value?.user_id,
          })
          clearDraft(conversationId)
          setPendingReplyState(conversationId, {
            pending: false,
            interrupted: false,
            needsReconcile: false,
            error: 'Offline — message queued. Will send when reconnected.',
            status: { state: 'error', label: 'Queued (offline)', elapsedMs: 0, note: '' },
          })
        } catch {
          // Queue failed — restore draft
          if (content) { draft.value = content; saveDraft(conversationId, content) }
          setPendingReplyState(conversationId, {
            pending: false, interrupted: false, needsReconcile: false,
            error: error.message,
            status: { state: 'error', label: 'Something went wrong', elapsedMs: 0, note: '' },
          })
        }
      } else {
        // Restore the draft so user doesn't lose their message on failure
        if (content) {
          draft.value = content
          saveDraft(conversationId, content)
        }
        setPendingReplyState(conversationId, {
          pending: false,
          interrupted: false,
          needsReconcile: false,
          error: error.message,
          status: {
            state: 'error',
            label: 'Something went wrong',
            elapsedMs: 0,
            note: '',
          },
        })
        updatePendingAssistantError(conversationId, error.message)
      }
    }
  } finally {
    currentStreamController.value = null
    currentStreamingConversationId.value = null
    sendingMessage.value = false
    isStreamingReply.value = false
  }
}

async function flushOfflineQueue() {
  try {
    const pending = await getPendingMessages()
    if (!pending.length) return

    for (const item of pending) {
      try {
        await streamConversationMessage(
          item.conversationId,
          { content: item.content, attachments: item.attachments || [] },
          {
            onAssistantMessage(message) {
              upsertMessage(item.conversationId, { ...message, displayContent: message.content || '' })
            },
            onDone() {
              clearPendingReplyState(item.conversationId)
            },
            onErrorEvent() { /* handled below */ },
          }
        )
        await removeQueuedMessage(item.id)
      } catch {
        await incrementRetry(item.id)
      }
    }
  } catch { /* best effort */ }
}

function openAttachmentPicker() {
  fileInputRef.value?.click()
}

async function handleAttachmentSelection(event) {
  const files = Array.from(event?.target?.files || [])
  event.target.value = ''

  if (!activeConversation.value?.id || files.length === 0) {
    return
  }

  const remainingSlots = Math.max(0, 8 - pendingAttachments.value.length)

  if (remainingSlots === 0) {
    $q.notify({ type: 'warning', message: 'You can attach up to 8 files at once.' })
    return
  }

  const selectedFiles = files.slice(0, remainingSlots)
  uploadingAttachments.value = true
  const skippedFiles = []

  try {
    for (const file of selectedFiles) {
      if (pendingAttachments.value.some((attachment) => attachment.fingerprint === attachmentFingerprint(file))) {
        skippedFiles.push(`${file.name} is already attached.`)
        continue
      }

      try {
        validateSelectedFile(file)

        const response = await uploadConversationAttachment(activeConversation.value.id, file)
        const uploaded = response?.attachment

        pendingAttachments.value = [
          ...pendingAttachments.value,
          {
            localId: createLocalAttachmentId(),
            fingerprint: attachmentFingerprint(file),
            token: uploaded.token,
            name: uploaded.name || file.name,
            mimeType: uploaded.mime_type || file.type || 'application/octet-stream',
            sizeBytes: uploaded.size_bytes ?? file.size ?? 0,
            extension: uploaded.extension || fileExtension(file.name),
            category: uploaded.category || detectAttachmentCategory(uploaded.mime_type || file.type, file.name),
            previewUrl: buildPreviewUrl(file, uploaded.category || detectAttachmentCategory(uploaded.mime_type || file.type, file.name)),
          },
        ]
      } catch (error) {
        skippedFiles.push(error?.message ? `${file.name}: ${error.message}` : `${file.name}: upload failed`)
      }
    }

    if (skippedFiles.length) {
      $q.notify({
        type: 'warning',
        message: skippedFiles.join(' '),
        timeout: 4200,
      })
    }
  } finally {
    uploadingAttachments.value = false
  }
}

function removePendingAttachment(localId) {
  const attachment = pendingAttachments.value.find((item) => item.localId === localId)

  if (attachment?.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl)
  }

  pendingAttachments.value = pendingAttachments.value.filter((item) => item.localId !== localId)

  if (imageEditModeAttachmentId.value === localId) {
    imageEditModeAttachmentId.value = ''
  }
}

function clearPendingAttachments() {
  pendingAttachments.value.forEach((attachment) => {
    if (attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl)
    }
  })

  pendingAttachments.value = []
  imageEditModeAttachmentId.value = ''

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function createLocalAttachmentId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function attachmentFingerprint(file) {
  return [file.name, file.size, file.lastModified].join(':')
}

function isImageGenerationStatus(label) {
  if (!label) return false
  const l = label.toLowerCase()
  return l.includes('generat') && (l.includes('image') || l.includes('photo') || l.includes('picture'))
    || l.includes('image_generate')
    || l.includes('editing image')
    || l.includes('edit image')
}

function updatePendingAssistantStatus(conversationId, status) {
  const pendingAssistant = findPendingAssistantMessage(conversationId)

  if (!pendingAssistant) {
    return
  }

  const hasStreamedText = Boolean((pendingAssistant.displayContent || '').trim())
  // Auto-detect image generation from status label if not already flagged
  const isGeneratingImage = pendingAssistant.meta?.isGeneratingImage
    || isImageGenerationStatus(status.label)
    || isImageGenerationStatus(status.phase)

  upsertMessage(conversationId, {
    ...pendingAssistant,
    displayContent: hasStreamedText ? pendingAssistant.displayContent : (isGeneratingImage ? 'Generating image…' : ''),
    meta: {
      ...pendingAssistant.meta,
      isGeneratingImage,
      isTypingRow: isGeneratingImage ? false : !hasStreamedText,
      elapsedMs: status.elapsedMs || 0,
      phase: status.phase || '',
      statusLabel: isGeneratingImage ? status.label || 'Generating image…' : pendingAssistant.meta?.statusLabel,
    },
  })
}

function updatePendingAssistantError(conversationId, message) {
  const pendingAssistant = findPendingAssistantMessage(conversationId)

  if (!pendingAssistant) {
    return
  }

  upsertMessage(conversationId, {
    ...pendingAssistant,
    displayContent: pendingAssistant.meta?.isGeneratingImage
      ? 'Sorry, I couldn\'t generate that image.'
      : 'Sorry — the reply failed before it could be returned.',
    meta: {
      ...pendingAssistant.meta,
      statusLabel: message,
      isError: true,
    },
  })
}

function animateAssistantReveal(conversationId, messageId, finalText) {
  clearRevealTimer(messageId)

  const chunks = splitIntoRevealChunks(finalText)
  let index = 0

  const step = () => {
    const message = conversationMessages(conversationId).find((item) => item.id === messageId)

    if (!message) {
      clearRevealTimer(messageId)
      return
    }

    const nextDisplay = chunks.slice(0, index + 1).join('')
    upsertMessage(conversationId, {
      ...message,
      displayContent: nextDisplay,
      meta: {
        ...message.meta,
        isRevealing: index < chunks.length - 1,
        statusLabel: index < chunks.length - 1 ? 'Rendering final reply…' : 'Reply received from OpenClaw',
      },
    })

    if (index >= chunks.length - 1) {
      notifyAssistantReply(conversationId, {
        ...message,
        displayContent: nextDisplay,
      })
      clearRevealTimer(messageId)

      if (pendingReplyStateByConversation.value[conversationId]?.status?.state !== 'error') {
        clearPendingReplyState(conversationId)
      }

      return
    }

    index += 1
    const timer = window.setTimeout(step, Math.min(70, Math.max(18, Math.floor(1600 / Math.max(chunks.length, 1)))))
    revealTimers.set(messageId, timer)
  }

  step()
}

function clearRevealTimer(messageId) {
  const timer = revealTimers.get(messageId)

  if (timer) {
    window.clearTimeout(timer)
    revealTimers.delete(messageId)
  }
}

function splitIntoRevealChunks(text) {
  if (!text) {
    return ['']
  }

  return text.match(/.{1,6}(\s|$)|\S+/g) || [text]
}

function clearPlaceholderAssistants(conversationId) {
  conversationMessages(conversationId)
    .filter((message) => message.role === 'assistant' && message.meta?.isPlaceholder)
    .forEach((message) => removeMessage(conversationId, message.id))
}

function renderedMarkdown(text) {
  return renderMarkdown(text)
}

function messageDisplayText(message) {
  if (message.displayContent || message.content) {
    return message.displayContent || message.content
  }

  if (message.meta?.isPlaceholder) {
    return message.meta?.isGeneratingImage ? 'Generating image…' : `${AGENT_DISPLAY_NAME.value} is thinking…`
  }

  return ''
}

function messageAttachments(message) {
  return Array.isArray(message?.attachments) ? message.attachments : []
}

function imageAttachments(message) {
  return messageAttachments(message).filter((attachment) => attachment.category === 'image' && attachment.url)
}

function fileAttachments(message) {
  return messageAttachments(message).filter((attachment) => attachment.category !== 'image' && attachment.url)
}

function openAttachmentLightbox(attachment) {
  resetImageLightboxTransform()
  activeLightboxImage.value = attachment
  imageLightboxOpen.value = true
}

function openPendingAttachmentPreview(attachment) {
  if (!attachment?.previewUrl) {
    return
  }

  openAttachmentLightbox({
    url: attachment.previewUrl,
    name: attachment.name,
  })
}

function closeImageLightbox() {
  imageLightboxOpen.value = false
}

async function focusComposerInput() {
  await nextTick()

  const composer = composerInputRef.value

  if (typeof composer?.focus === 'function') {
    composer.focus()
    composerFocused.value = true
    scheduleKeyboardInsetSync([0, 80, 180, 320])
    return
  }

  const root = composer?.$el || composer
  const textarea = root?.querySelector?.('textarea')
  if (textarea) {
    textarea.focus()
    composerFocused.value = true
    scheduleKeyboardInsetSync([0, 80, 180, 320])
  }
}

async function fetchAttachmentAsFile(attachment) {
  if (!attachment?.url) {
    throw new Error('No image is available to use.')
  }

  const response = await fetch(attachment.url, { credentials: 'include' })

  if (!response.ok) {
    throw new Error('Unable to load the image.')
  }

  const blob = await response.blob()
  const name = attachment.name || `image-${Date.now()}.png`
  const mimeType = attachment.mime_type || attachment.mimeType || blob.type || 'image/png'

  return new File([blob], name, { type: mimeType })
}

async function reattachLightboxImageForEdit(attachment) {
  if (!activeConversation.value?.id) {
    throw new Error('No conversation is active.')
  }

  const file = await fetchAttachmentAsFile(attachment)
  const response = await uploadConversationAttachment(activeConversation.value.id, file)
  const uploaded = response?.attachment

  if (!uploaded?.token) {
    throw new Error('Unable to prepare the image for editing.')
  }

  const nextAttachment = {
    localId: createLocalAttachmentId(),
    fingerprint: attachmentFingerprint(file),
    token: uploaded.token,
    name: uploaded.name || file.name,
    mimeType: uploaded.mime_type || file.type || 'application/octet-stream',
    sizeBytes: uploaded.size_bytes ?? file.size ?? 0,
    extension: uploaded.extension || fileExtension(file.name),
    category: uploaded.category || detectAttachmentCategory(uploaded.mime_type || file.type, file.name),
    previewUrl: buildPreviewUrl(file, uploaded.category || detectAttachmentCategory(uploaded.mime_type || file.type, file.name)),
  }

  pendingAttachments.value = [
    ...pendingAttachments.value,
    nextAttachment,
  ]
  imageEditModeAttachmentId.value = nextAttachment.localId
}

function applyImageEditPrompt(prompt) {
  draft.value = prompt
  focusComposerInput()
}

async function handleLightboxEditWithThis() {
  const attachment = activeLightboxImage.value

  if (!attachment) {
    return
  }

  closeImageLightbox()

  try {
    await reattachLightboxImageForEdit(attachment)
    await focusComposerInput()
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message || 'Unable to reuse this image for editing.' })
  }
}

async function shareLightboxImage(attachment) {
  if (!attachment?.url) {
    return
  }

  const title = attachment.name || 'Image'
  const url = attachment.url

  if (navigator.share) {
    try {
      await navigator.share({ title, url })
      return
    } catch (err) {
      if (err?.name !== 'AbortError') {
        throw err
      }

      return
    }
  }

  try {
    await navigator.clipboard.writeText(url)
    $q.notify({ type: 'positive', message: 'Image link copied to clipboard.' })
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

async function handleLightboxShare() {
  const attachment = activeLightboxImage.value

  if (!attachment) {
    return
  }

  try {
    await shareLightboxImage(attachment)
  } catch {
    $q.notify({ type: 'negative', message: 'Share failed.' })
  }
}

async function saveLightboxImage(attachment) {
  if (!attachment?.url) {
    return
  }

  const file = await fetchAttachmentAsFile(attachment)

  const downloadUrl = URL.createObjectURL(file)

  try {
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = file.name || attachment.name || 'image'
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (error) {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: attachment.name || 'Image',
        })
        return
      } catch (err) {
        if (err?.name !== 'AbortError') {
          throw err
        }

        return
      }
    }

    throw error
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
  }
}

async function handleLightboxSave() {
  const attachment = activeLightboxImage.value

  if (!attachment) {
    return
  }

  try {
    await saveLightboxImage(attachment)
  } catch {
    if (attachment.url) {
      window.open(attachment.url, '_blank', 'noopener,noreferrer')
      return
    }

    $q.notify({ type: 'negative', message: 'Save failed.' })
  }
}

function handleLightboxImageLoad() {
  handleLightboxViewportResize()
}

function handleLightboxViewportResize() {
  if (!imageLightboxOpen.value) {
    return
  }

  updateLightboxTransform(lightboxTransform.value.scale, lightboxTransform.value.x, lightboxTransform.value.y)
}

function handleLightboxViewportClick(event) {
  if (event.target !== event.currentTarget || activeLightboxPointers.size > 0) {
    return
  }

  if (lightboxGesture.moved) {
    lightboxGesture.moved = false
    return
  }

  if (!isLightboxZoomed.value) {
    closeImageLightbox()
  }
}

function handleLightboxPointerDown(event) {
  if (!activeLightboxImage.value) {
    return
  }

  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  activeLightboxPointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY,
  })

  event.currentTarget?.setPointerCapture?.(event.pointerId)

  if (activeLightboxPointers.size === 1 && isLightboxZoomed.value) {
    beginLightboxPan(event)
    return
  }

  if (activeLightboxPointers.size === 2) {
    beginLightboxPinch()
  }
}

function handleLightboxPointerMove(event) {
  if (!activeLightboxPointers.has(event.pointerId)) {
    return
  }

  activeLightboxPointers.set(event.pointerId, {
    clientX: event.clientX,
    clientY: event.clientY,
  })

  if (lightboxGesture.mode === 'pinch' && activeLightboxPointers.size >= 2) {
    updateLightboxPinch()
    return
  }

  if (lightboxGesture.mode === 'pan' && event.pointerId === lightboxGesture.activePointerId) {
    updateLightboxPan(event)
  }
}

function handleLightboxPointerEnd(event) {
  if (!activeLightboxPointers.has(event.pointerId)) {
    return
  }

  activeLightboxPointers.delete(event.pointerId)

  if (lightboxGesture.mode === 'pinch' && activeLightboxPointers.size >= 2) {
    beginLightboxPinch()
    return
  }

  if (activeLightboxPointers.size === 1 && isLightboxZoomed.value) {
    const [remainingPointer] = activeLightboxPointers.entries()

    if (remainingPointer) {
      const [pointerId, point] = remainingPointer
      beginLightboxPan({
        pointerId,
        clientX: point.clientX,
        clientY: point.clientY,
      })
      return
    }
  }

  lightboxGesture.mode = 'idle'
  lightboxGesture.activePointerId = null
}

function beginLightboxPan(pointer) {
  lightboxGesture.mode = 'pan'
  lightboxGesture.activePointerId = pointer.pointerId
  lightboxGesture.startX = pointer.clientX
  lightboxGesture.startY = pointer.clientY
  lightboxGesture.originX = lightboxTransform.value.x
  lightboxGesture.originY = lightboxTransform.value.y
}

function updateLightboxPan(pointer) {
  if (!isLightboxZoomed.value) {
    return
  }

  const deltaX = pointer.clientX - lightboxGesture.startX
  const deltaY = pointer.clientY - lightboxGesture.startY

  markLightboxGestureMoved(deltaX, deltaY)
  updateLightboxTransform(
    lightboxTransform.value.scale,
    lightboxGesture.originX + deltaX,
    lightboxGesture.originY + deltaY,
  )
}

function beginLightboxPinch() {
  const pointers = [...activeLightboxPointers.values()]

  if (pointers.length < 2) {
    return
  }

  const metrics = getLightboxMetrics()

  if (!metrics) {
    return
  }

  const [first, second] = pointers
  const midpointX = ((first.clientX + second.clientX) / 2) - metrics.rect.left - metrics.centerX
  const midpointY = ((first.clientY + second.clientY) / 2) - metrics.rect.top - metrics.centerY

  lightboxGesture.mode = 'pinch'
  lightboxGesture.activePointerId = null
  lightboxGesture.pinchStartDistance = Math.max(1, pointerDistance(first, second))
  lightboxGesture.pinchStartScale = lightboxTransform.value.scale
  lightboxGesture.pinchContentX = (midpointX - lightboxTransform.value.x) / lightboxTransform.value.scale
  lightboxGesture.pinchContentY = (midpointY - lightboxTransform.value.y) / lightboxTransform.value.scale
}

function updateLightboxPinch() {
  const pointers = [...activeLightboxPointers.values()]

  if (pointers.length < 2) {
    return
  }

  const metrics = getLightboxMetrics()

  if (!metrics) {
    return
  }

  const [first, second] = pointers
  const distance = pointerDistance(first, second)
  const midpointX = ((first.clientX + second.clientX) / 2) - metrics.rect.left - metrics.centerX
  const midpointY = ((first.clientY + second.clientY) / 2) - metrics.rect.top - metrics.centerY
  const nextScale = clampLightboxScale(
    lightboxGesture.pinchStartScale * (distance / lightboxGesture.pinchStartDistance),
  )
  const nextX = midpointX - (lightboxGesture.pinchContentX * nextScale)
  const nextY = midpointY - (lightboxGesture.pinchContentY * nextScale)

  markLightboxGestureMoved(
    nextScale - lightboxGesture.pinchStartScale,
    distance - lightboxGesture.pinchStartDistance,
  )
  updateLightboxTransform(nextScale, nextX, nextY)
}

function resetImageLightboxTransform() {
  activeLightboxPointers.clear()
  lightboxGesture.mode = 'idle'
  lightboxGesture.activePointerId = null
  lightboxGesture.startX = 0
  lightboxGesture.startY = 0
  lightboxGesture.originX = 0
  lightboxGesture.originY = 0
  lightboxGesture.pinchStartDistance = 0
  lightboxGesture.pinchStartScale = 1
  lightboxGesture.pinchContentX = 0
  lightboxGesture.pinchContentY = 0
  lightboxGesture.moved = false
  lightboxTransform.value = { scale: 1, x: 0, y: 0 }
}

function updateLightboxTransform(scale, x, y) {
  lightboxTransform.value = clampLightboxTransform(scale, x, y)
}

function clampLightboxTransform(scale, x, y) {
  const nextScale = clampLightboxScale(scale)
  const metrics = getLightboxMetrics()

  if (!metrics || nextScale <= 1) {
    return { scale: 1, x: 0, y: 0 }
  }

  const maxX = Math.max(0, ((metrics.imageWidth * nextScale) - metrics.viewportWidth) / 2)
  const maxY = Math.max(0, ((metrics.imageHeight * nextScale) - metrics.viewportHeight) / 2)

  return {
    scale: nextScale,
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  }
}

function clampLightboxScale(scale) {
  return Math.min(4, Math.max(1, scale))
}

function getLightboxMetrics() {
  const viewport = lightboxViewportRef.value
  const image = lightboxImageRef.value

  if (!viewport || !image) {
    return null
  }

  return {
    rect: viewport.getBoundingClientRect(),
    centerX: viewport.clientWidth / 2,
    centerY: viewport.clientHeight / 2,
    viewportWidth: viewport.clientWidth,
    viewportHeight: viewport.clientHeight,
    imageWidth: image.offsetWidth,
    imageHeight: image.offsetHeight,
  }
}

function pointerDistance(first, second) {
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
}

function markLightboxGestureMoved(deltaX, deltaY) {
  if (lightboxGesture.moved) {
    return
  }

  lightboxGesture.moved = Math.hypot(deltaX, deltaY) > 4
}

function attachmentIcon(attachment) {
  if (attachment.category === 'image') {
    return 'image'
  }

  if (attachment.category === 'pdf') {
    return 'picture_as_pdf'
  }

  if (attachment.category === 'text') {
    return 'description'
  }

  return 'attach_file'
}

function attachmentExtensionLabel(attachment) {
  return (attachment.extension || fileExtension(attachment.name || '') || 'file').toUpperCase()
}

function formatAttachmentSize(value) {
  const size = Number(value || 0)

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  if (size >= 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }

  return `${size} B`
}

function buildCopyableMessageText(message) {
  const text = (messageDisplayText(message) || '').trim()
  const attachments = messageAttachments(message)
  const attachmentLines = attachments.map((attachment) => attachment.url ? `${attachment.name}: ${attachment.url}` : attachment.name)

  if (text && attachmentLines.length) {
    return `${text}\n\n${attachmentLines.join('\n')}`
  }

  if (text) {
    return text
  }

  return attachmentLines.join('\n')
}


async function copyMessage(message) {
  const text = buildCopyableMessageText(message)

  if (!text) {
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    $q.notify({ type: 'positive', message: 'Message copied.' })
  } catch {
    $q.notify({ type: 'negative', message: 'Clipboard access failed.' })
  }
}

function revokeRemoteSpeechUrl() {
  if (!remoteSpeechUrl || typeof URL === 'undefined') {
    remoteSpeechUrl = ''
    return
  }

  URL.revokeObjectURL(remoteSpeechUrl)
  remoteSpeechUrl = ''
}

function stopRemoteSpeech() {
  if (remoteSpeechAudio.value) {
    remoteSpeechAudio.value.pause()
    remoteSpeechAudio.value.src = ''
    remoteSpeechAudio.value = null
  }

  revokeRemoteSpeechUrl()
}

function stopBrowserSpeech() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

function stopSpeaking() {
  speechRequestToken += 1
  stopBrowserSpeech()
  stopRemoteSpeech()
  speakingMessageId.value = null
}

function speakWithBrowser(message, text) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    $q.notify({ type: 'warning', message: 'Speech is not supported on this device.' })
    return
  }

  stopRemoteSpeech()
  stopBrowserSpeech()
  speakingMessageId.value = message.id
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1
  utterance.pitch = 1
  utterance.onend = () => { speakingMessageId.value = null }
  utterance.onerror = () => { speakingMessageId.value = null }
  window.speechSynthesis.speak(utterance)
}


async function speakWithBackend(message, text) {
  stopBrowserSpeech()
  stopRemoteSpeech()
  speakingMessageId.value = message.id
  const requestToken = ++speechRequestToken

  try {
    const { blob } = await speakText({ text })

    if (speechRequestToken !== requestToken || speakingMessageId.value !== message.id) {
      return
    }

    remoteSpeechUrl = URL.createObjectURL(blob)
    const audio = new Audio(remoteSpeechUrl)
    remoteSpeechAudio.value = audio
    audio.onended = () => {
      if (speakingMessageId.value === message.id) {
        speakingMessageId.value = null
      }
      stopRemoteSpeech()
    }
    audio.onerror = () => {
      if (speakingMessageId.value === message.id) {
        speakingMessageId.value = null
      }
      stopRemoteSpeech()
      $q.notify({ type: 'negative', message: 'Audio playback failed on this device.' })
    }

    await audio.play()
  } catch (error) {
    if (speechRequestToken === requestToken) {
      speakingMessageId.value = null
      stopRemoteSpeech()
      $q.notify({ type: 'negative', message: error.message || 'Unable to generate speech audio.' })
    }
  }
}

function stripMarkdownForSpeech(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' code block ')    // code blocks
    .replace(/`([^`]+)`/g, '$1')                    // inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1')              // bold
    .replace(/\*([^*]+)\*/g, '$1')                  // italic
    .replace(/__([^_]+)__/g, '$1')                  // bold alt
    .replace(/_([^_]+)_/g, '$1')                    // italic alt
    .replace(/~~([^~]+)~~/g, '$1')                  // strikethrough
    .replace(/^#{1,6}\s+/gm, '')                    // headers
    .replace(/^\s*[-*+]\s+/gm, '')                  // list bullets
    .replace(/^\s*\d+\.\s+/gm, '')                  // numbered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')        // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')       // images
    .replace(/^\s*>\s+/gm, '')                      // blockquotes
    .replace(/\|/g, ' ')                            // table pipes
    .replace(/---+/g, '')                           // horizontal rules
    .replace(/\n{3,}/g, '\n\n')                     // excess newlines
    .trim()
}

async function speakMessage(message) {
  const rawText = (messageDisplayText(message) || '').trim()

  if (!rawText) {
    return
  }

  if (speakingMessageId.value === message.id) {
    stopSpeaking()
    return
  }

  const text = stripMarkdownForSpeech(rawText)

  // Try OpenClaw TTS first, fall back to browser speech
  try {
    await speakWithBackend(message, text)
  } catch {
    speakWithBrowser(message, text)
  }
}

async function shareMessage(message) {
  const text = buildCopyableMessageText(message)

  if (!text) {
    return
  }

  if (navigator.share) {
    try {
      await navigator.share({ text })
    } catch (err) {
      if (err.name !== 'AbortError') {
        $q.notify({ type: 'negative', message: 'Share failed.' })
      }
    }
  } else {
    try {
      await navigator.clipboard.writeText(text)
      $q.notify({ type: 'positive', message: 'Copied to clipboard (share not available).' })
    } catch {
      $q.notify({ type: 'negative', message: 'Share not available on this device.' })
    }
  }
}

async function handleChatShare() {
  const conversation = activeConversation.value

  if (!conversation) {
    return
  }

  const title = conversation.title || 'Hearth chat'
  const url = window.location.href

  if (navigator.share) {
    try {
      await navigator.share({ title, url })
    } catch (err) {
      if (err.name !== 'AbortError') {
        $q.notify({ type: 'negative', message: 'Share failed.' })
      }
    }
  } else {
    try {
      await navigator.clipboard.writeText(url)
      $q.notify({ type: 'positive', message: 'Link copied to clipboard.' })
    } catch {
      $q.notify({ type: 'negative', message: 'Share not available on this device.' })
    }
  }
}

function openViewFilesDialog() {
  viewFilesDialogOpen.value = true
}

function openChatFile(file) {
  if (!file?.url) {
    return
  }

  if (file.category === 'image') {
    openAttachmentLightbox(file)
    return
  }

  window.open(file.url, '_blank', 'noopener,noreferrer')
}

function handleChatDelete() {
  if (!activeConversation.value) return

  const conversation = activeConversation.value

  $q.dialog({
    title: 'Delete chat',
    message: `Delete "${conversation.title || 'this chat'}"? This cannot be undone.`,
    ok: { label: 'Delete', color: 'negative', unelevated: true, noCaps: true },
    cancel: { label: 'Cancel', flat: true, noCaps: true },
  }).onOk(async () => {
    try {
      const res = await deleteConversation(conversation.id)
      if (res && !res.ok && res.status !== 204) throw new Error('Delete failed.')
      removeConversationRecord(conversation.id)
      $q.notify({ type: 'positive', message: 'Chat deleted.', timeout: 2000 })
    } catch (err) {
      $q.notify({ type: 'negative', message: err?.message || 'Could not delete chat.', timeout: 3000 })
    }
  })
}

function validateSelectedFile(file) {
  const extension = fileExtension(file.name)
  const category = detectAttachmentCategory(file.type, file.name)

  if (!acceptedAttachmentExtensions.has(extension)) {
    throw new Error('This file type is not supported yet.')
  }

  if (!['image', 'pdf', 'text'].includes(category)) {
    throw new Error('This file type is not supported yet.')
  }

  if ((file.size || 0) > 12 * 1024 * 1024) {
    throw new Error('Attachments must be 12 MB or smaller.')
  }
}

function buildPreviewUrl(file, category) {
  if (category !== 'image') {
    return ''
  }

  return URL.createObjectURL(file)
}

function detectAttachmentCategory(mimeType, name) {
  const normalizedMime = (mimeType || '').toLowerCase()
  const extension = fileExtension(name)

  if (normalizedMime.startsWith('image/')) {
    return 'image'
  }

  if (normalizedMime === 'application/pdf' || extension === 'pdf') {
    return 'pdf'
  }

  if (['txt', 'md', 'json', 'csv'].includes(extension)) {
    return 'text'
  }

  return 'file'
}

function fileExtension(name) {
  const normalized = String(name || '')
  const lastDot = normalized.lastIndexOf('.')

  if (lastDot === -1) {
    return ''
  }

  return normalized.slice(lastDot + 1).toLowerCase()
}

function messageCardClass(message) {
  return {
    'message-card--assistant': message.role === 'assistant',
    'message-card--user': message.role === 'user',
    'message-card--error': message.meta?.isError,
    'message-card--pending': (message.meta?.isPlaceholder || message.meta?.isRevealing) && !message.meta?.isTypingRow,
  }
}

async function resetComposerHeight() {
  await nextTick()
  const root = composerInputRef.value?.$el || composerInputRef.value
  const textarea = root?.querySelector?.('textarea')

  if (!textarea) {
    return
  }

  textarea.style.height = '22px'
  textarea.style.height = `${Math.min(textarea.scrollHeight, 22)}px`
  textarea.scrollTop = 0
}

function clearConversationScrollSettle() {
  if (scrollSettleTimer !== null) {
    window.clearTimeout(scrollSettleTimer)
    scrollSettleTimer = null
  }
}

function queueConversationScrollToBottom(options = {}) {
  const force = options.force === true

  if (!force && !userNearConversationBottom.value && !isNearConversationBottom()) {
    return
  }

  const attempts = Math.max(1, options.attempts || 6)
  const delay = Math.max(16, options.delay || 34)
  const runId = scrollSettleRunId + 1

  scrollSettleRunId = runId
  clearConversationScrollSettle()

  const run = async (remaining) => {
    if (!force && !userNearConversationBottom.value && !isNearConversationBottom()) {
      return
    }

    await scrollConversationToBottom()

    if (runId !== scrollSettleRunId || remaining <= 1) {
      return
    }

    scrollSettleTimer = window.setTimeout(() => {
      scrollSettleTimer = null
      run(remaining - 1)
    }, delay)
  }

  run(attempts)
}

function clearMessageHighlight() {
  if (messageHighlightTimer !== null) {
    window.clearTimeout(messageHighlightTimer)
    messageHighlightTimer = null
  }

  highlightedMessageId.value = ''
}

function flashMessageHighlight(messageId) {
  clearMessageHighlight()
  highlightedMessageId.value = String(messageId)
  messageHighlightTimer = window.setTimeout(() => {
    highlightedMessageId.value = ''
    messageHighlightTimer = null
  }, 2600)
}

async function scrollToMessage({ messageId, messageAt } = {}) {
  await nextTick()
  const element = conversationBodyRef.value?.$el || conversationBodyRef.value

  if (!element || (!messageId && !messageAt)) {
    return false
  }

  let target = null
  const normalizedMessageId = messageId ? String(messageId) : ''

  if (normalizedMessageId) {
    target = element.querySelector(
      `[data-message-id="${normalizedMessageId}"], [data-message-record-id="${normalizedMessageId}"]`,
    )
  }

  if (!target && messageAt) {
    const matchedMessage = activeMessages.value.find((message) => {
      const createdAt = message?.created_at || message?.sent_at || message?.sentAt
      return createdAt && String(createdAt) === String(messageAt)
    })

    if (matchedMessage) {
      const fallbackId = String(matchedMessage.id)
      target = element.querySelector(`[data-message-id="${fallbackId}"]`)
    }
  }

  if (!target) {
    return false
  }

  const highlightMessageId = target.getAttribute('data-message-id') || normalizedMessageId
  target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
  flashMessageHighlight(highlightMessageId)
  updateConversationBottomAffinity()

  return true
}

async function scrollConversationToBottom() {
  await nextTick()
  const element = conversationBodyRef.value?.$el || conversationBodyRef.value
  const anchor = conversationEndRef.value?.$el || conversationEndRef.value
  const stack = messageStackRef.value?.$el || messageStackRef.value

  if (!element) {
    return
  }

  const scrollTop = Math.max(
    element.scrollHeight,
    anchor?.offsetTop || 0,
    stack?.offsetHeight || 0,
  ) + 200

  if (anchor?.scrollIntoView && !stack) {
    anchor.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'auto' })
  }

  element.scrollTo({ top: scrollTop, behavior: 'auto' })
  updateConversationBottomAffinity()
}
</script>

<style scoped lang="scss">
@keyframes typingPulse {
  0%, 80%, 100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-1px);
  }
}

.chat-page {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--hearth-bg);
  position: relative;
}

.chat-header {
  position: sticky;
  top: 0;
  z-index: 8;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: 52px;
  padding: 0 16px;
  background: var(--hearth-surface);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--hearth-border);
}

.chat-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  flex-wrap: nowrap;
}

.chat-title-area {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.chat-title-text {
  font-size: 0.94rem;
  font-weight: 600;
  color: var(--hearth-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.chat-toolbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.chat-header-main {
  flex: 1 1 0;
  min-width: 0;
}

.chat-header-topline {
  min-width: 0;
}

.chat-header-topline {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
}

.empty-state__eyebrow {
  color: var(--hearth-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.68rem;
  font-weight: 700;
}

.empty-state__title {
  color: var(--hearth-text);
}

.chat-subtitle,
.message-footnote,
.empty-state__body,
.composer-hint,
.composer-attachments__hint,
.message-card__timestamp {
  color: var(--hearth-text-muted);
}

.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.archive-chip {
  background: var(--hearth-surface-elevated);
  color: var(--hearth-text);
  border: 1px solid var(--hearth-border);
}

.model-select {
  min-width: 88px;
  max-width: 116px;
  flex-shrink: 0;
}

.chat-header-model-select {
  flex: 0 1 auto;
  min-width: 88px;
  max-width: 116px;
}

.model-pill-select :deep(.q-field) {
  min-width: 0;
}

.model-pill-select :deep(.q-field__control) {
  min-height: 32px;
  height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--hearth-surface-elevated);
  border: 1px solid var(--hearth-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

.model-pill-select :deep(.q-field__native),
.model-pill-select :deep(.q-field__input) {
  color: var(--hearth-text);
  font-size: 0.77rem;
  font-weight: 650;
  padding: 0;
  min-height: 20px;
}

.model-pill-select :deep(.q-field__append) {
  padding: 0 0 0 4px;
  min-height: 20px;
}

.model-pill-select :deep(.q-field__append .q-icon) {
  font-size: 15px;
  color: var(--hearth-text-muted);
}

.model-pill-select :deep(.q-field__marginal) {
  height: auto;
}

.model-pill-select :deep(.q-field__bottom),
.model-pill-select :deep(.q-field__messages),
.model-pill-select :deep(.q-field__counter) {
  display: none;
}

.model-select-menu {
  background: var(--hearth-surface-elevated);
  color: var(--hearth-text);
  border: 1px solid var(--hearth-border);
  border-radius: 16px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.42);
  overflow: hidden;
}

.model-select-menu .q-item {
  min-height: 46px;
  padding-top: 8px;
  padding-bottom: 8px;
  color: var(--hearth-text);
  font-size: 0.94rem;
}

.model-select-menu .q-item.q-item--active {
  background: rgba(109, 93, 252, 0.18);
  color: var(--hearth-text);
}

.message-card__footer {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-top: 4px;
  opacity: 0;
  transition: opacity 140ms ease;
}

.message-card:hover .message-card__footer,
.message-card:focus-within .message-card__footer {
  opacity: 1;
}

.message-card__actions {
  display: flex;
  align-items: center;
  gap: 0;
}

.message-action-btn {
  width: 22px;
  height: 22px;
  min-height: unset;
  min-width: 22px;
  padding: 0;
  color: var(--hearth-text-muted);
  background: transparent !important;
  border-radius: 5px;
}

.message-action-btn :deep(.q-icon) {
  font-size: 14px;
}

.message-action-btn:hover {
  color: var(--hearth-text);
  background: var(--hearth-surface-elevated) !important;
}

.scroll-latest-enter-active,
.scroll-latest-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.scroll-latest-enter-from,
.scroll-latest-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.scroll-latest-btn {
  position: absolute;
  right: 20px;
  bottom: 18px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 0;
  border-radius: 999px;
  background: var(--hearth-surface-elevated);
  color: var(--hearth-text);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.42);
}

.composer-attachments {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.composer-attachments__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.composer-attachments__title {
  color: var(--hearth-text);
  font-size: 0.84rem;
  font-weight: 700;
}

.composer-attachments__hint {
  font-size: 0.74rem;
}

.composer-attachments__count {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(109, 93, 252, 0.18);
  color: var(--hearth-text);
  font-size: 0.76rem;
  font-weight: 700;
}

.composer-attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.composer-attachment-chip__thumb--button {
  border: 0;
  padding: 0;
  background: transparent;
}

.model-select-menu .q-focus-helper {
  background: rgba(148, 163, 184, 0.08) !important;
}

.chat-notice {
  margin: 0 28px 14px;
  border-radius: 16px;
  background: var(--hearth-surface-elevated);
  border: 1px solid var(--hearth-border);
  color: var(--hearth-text-muted);
  padding: 12px 14px;
  font-size: 0.9rem;
}

.chat-notice--error {
  background: rgba(200, 113, 98, 0.12);
  border-color: rgba(200, 113, 98, 0.3);
  color: var(--hearth-danger);
}

.conversation-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 28px 32px;
}



.conversation-loading-overlay {
  background: color-mix(in srgb, var(--hearth-surface) 76%, transparent);
  backdrop-filter: blur(4px);
}

.conversation-loading-overlay__content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 22px;
  background: color-mix(in srgb, var(--hearth-surface-elevated) 88%, transparent);
  border: 1px solid var(--hearth-border);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.16);
}

.conversation-failure-state {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.conversation-failure-card {
  position: relative;
  width: min(100%, 560px);
  padding: 28px 26px;
  border-radius: 28px;
  background:
    radial-gradient(circle at top, rgba(109, 93, 252, 0.16), transparent 55%),
    linear-gradient(180deg, rgba(48, 39, 33, 0.98) 0%, rgba(28, 24, 21, 0.98) 100%);
  border: 1px solid rgba(109, 93, 252, 0.2);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.conversation-failure-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid rgba(255, 255, 255, 0.04);
  pointer-events: none;
}

.conversation-failure-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 8px 12px;
  border-radius: 999px;
  color: var(--hearth-text);
  background: rgba(109, 93, 252, 0.14);
  border: 1px solid rgba(109, 93, 252, 0.24);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.conversation-failure-card__title {
  color: var(--hearth-text);
  font-size: clamp(1.45rem, 2vw, 1.9rem);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.conversation-failure-card__body {
  margin-top: 10px;
  color: var(--hearth-text-muted);
  font-size: 0.98rem;
  line-height: 1.7;
}

.conversation-failure-card__detail {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(242, 224, 207, 0.8);
  font-size: 0.86rem;
  line-height: 1.5;
}

.conversation-failure-card__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 22px;
}

.conversation-failure-card__primary,
.conversation-failure-card__secondary {
  min-height: 42px;
  border-radius: 999px;
  padding-left: 16px;
  padding-right: 16px;
}

.conversation-failure-card__secondary {
  color: var(--hearth-text-muted);
  border: 1px solid var(--hearth-border);
  background: rgba(255, 255, 255, 0.02);
}

.message-stack {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
  /* Push short conversations to the bottom (chat-style anchor) */
  min-height: 100%;
  justify-content: flex-end;
}

.conversation-end-anchor {
  width: 100%;
  height: 1px;
  scroll-margin-bottom: 120px;
}

.message-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  scroll-margin: 120px 0;
}

.message-row--search-hit .message-card {
  position: relative;
}

.message-row--search-hit .message-card::after {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 28px;
  border: 2px solid rgba(109, 93, 252, 0.9);
  box-shadow: 0 0 0 8px rgba(109, 93, 252, 0.16);
  pointer-events: none;
}

.message-row--user {
  justify-content: flex-end;
}

.message-card {
  width: auto;
  max-width: min(760px, 100%);
  padding: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.message-card--assistant {
  max-width: min(720px, 92%);
}

.message-card--user {
  max-width: min(560px, 80%);
  margin-left: auto;
  background: #d0d0d0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 22px;
  padding: 14px 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  color: #1a1a1a;
}

.message-card--pending {
  background: var(--hearth-surface-elevated);
  border: 1px solid var(--hearth-border);
  border-radius: 18px;
  padding: 14px 16px;
}

.message-card--error {
  background: rgba(200, 113, 98, 0.12);
  border: 1px solid rgba(200, 113, 98, 0.28);
  border-radius: 18px;
  padding: 14px 16px;
}

.message-attachments {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}

.message-attachment-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.message-attachment-grid--single {
  grid-template-columns: minmax(0, 1fr);
}

.message-attachment-image-link {
  display: block;
  width: 100%;
  padding: 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--hearth-border);
  background: var(--hearth-surface-elevated);
  appearance: none;
  cursor: zoom-in;
}

.image-lightbox {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 24px 20px 20px;
  background: rgba(0, 0, 0, 0.96);
}

.image-lightbox__close {
  position: absolute;
  top: max(18px, env(safe-area-inset-top));
  right: 18px;
  z-index: 2;
  background: var(--hearth-surface-elevated);
}

.image-lightbox__actions {
  position: absolute;
  left: 50%;
  bottom: max(18px, env(safe-area-inset-bottom));
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  width: min(100%, 640px);
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  background: rgba(16, 18, 20, 0.66);
  backdrop-filter: blur(18px);
  transform: translateX(-50%);
}

.image-lightbox__action {
  min-width: 132px;
}

.image-lightbox__viewport {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.image-lightbox__viewport--zoomed {
  cursor: grab;
}

.image-lightbox__image {
  display: block;
  max-width: min(100%, 1200px);
  max-height: min(100%, calc(100dvh - 132px));
  border-radius: 18px;
  object-fit: contain;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42);
  transform-origin: center center;
  will-change: transform;
}

.message-attachment-image {
  display: block;
  max-width: 100%;
  max-height: 320px;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
}

.message-file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.message-file-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 9px 12px;
  border-radius: 14px;
  text-decoration: none;
  color: var(--hearth-text);
  background: var(--hearth-surface-elevated);
  border: 1px solid var(--hearth-border);
}

.message-file-chip__label {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-file-chip__meta {
  color: var(--hearth-text-muted);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.typing-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 30px;
  color: var(--hearth-text-muted);
  padding: 4px 0;
}

.typing-row__label {
  font-size: 0.92rem;
  font-weight: 600;
}

.typing-row__tool-label {
  font-size: 0.88rem;
  color: var(--hearth-text-muted);
  font-style: italic;
  animation: fadeInUp 0.2s ease;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.typing-row__dots {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.typing-row__dots span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--hearth-text-muted);
  animation: typingPulse 1.1s infinite ease-in-out;
}

.typing-row__dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-row__dots span:nth-child(3) {
  animation-delay: 0.3s;
}

.message-content {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 1rem;
  line-height: 1.8;
  color: var(--hearth-text);
}

.message-content--markdown {
  white-space: normal;

  :deep(p) { margin: 0 0 0.6em; line-height: 1.7; }
  :deep(p:last-child) { margin-bottom: 0; }
  :deep(h1, h2, h3, h4) { font-weight: 700; margin: 0.8em 0 0.3em; line-height: 1.3; }
  :deep(h1) { font-size: 1.3em; }
  :deep(h2) { font-size: 1.15em; }
  :deep(h3) { font-size: 1.05em; }
  :deep(ul, ol) { padding-left: 1.4em; margin: 0.4em 0; }
  :deep(li) { margin-bottom: 0.2em; line-height: 1.6; }
  :deep(li > p) { margin: 0; }
  :deep(strong) { font-weight: 700; }
  :deep(em) { font-style: italic; }
  :deep(del) { text-decoration: line-through; opacity: 0.7; }
  :deep(blockquote) {
    border-left: 3px solid var(--hearth-border, #e0e0e0);
    padding: 0.3em 0.8em;
    margin: 0.5em 0;
    opacity: 0.8;
    font-style: italic;
  }
  :deep(hr) { border: none; border-top: 1px solid var(--hearth-border, #e0e0e0); margin: 0.8em 0; }
  :deep(a) { color: var(--q-primary); text-decoration: underline; }
  :deep(code):not(pre code) {
    background: rgba(130,130,180,0.15);
    border: 1px solid rgba(130,130,180,0.2);
    border-radius: 4px;
    padding: 0.1em 0.35em;
    font-size: 0.88em;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }
  :deep(.hljs-code-block) {
    background: #282c34;
    border-radius: 8px;
    padding: 0.85em 1em;
    padding-top: 2.2em;
    overflow-x: auto;
    margin: 0.6em 0;
    font-size: 0.85em;
    line-height: 1.55;
    border: 1px solid rgba(255,255,255,0.08);
    position: relative;
  }
  :deep(.hljs-code-block code) {
    font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
    background: none;
    padding: 0;
    border-radius: 0;
    color: #abb2bf;
  }
  :deep(.hljs-lang-label) {
    position: absolute;
    top: 0.45em;
    left: 0.85em;
    font-size: 0.75em;
    color: rgba(255,255,255,0.35);
    font-family: 'JetBrains Mono', monospace;
    text-transform: lowercase;
    pointer-events: none;
  }
  :deep(.hljs-copy-btn) {
    position: absolute;
    top: 0.4em;
    right: 0.6em;
    font-size: 0.72em;
    padding: 0.15em 0.55em;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.55);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    font-family: sans-serif;
    &:hover {
      background: rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.9);
    }
  }
  :deep(table) { border-collapse: collapse; width: 100%; margin: 0.5em 0; font-size: 0.92em; }
  :deep(th, td) { border: 1px solid var(--hearth-border, #ddd); padding: 0.4em 0.7em; text-align: left; }
  :deep(th) { background: rgba(0,0,0,0.04); font-weight: 600; }
}

.message-row--assistant .message-content {
  font-size: 1.03rem;
}

.message-row--user .message-content {
  color: #1a1a1a;
}

.composer-shell {
  padding: 8px 28px 12px;
}

.composer-card {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  border: 0;
  background: transparent;
  box-shadow: none;
  padding: 0;
}

.composer-file-input {
  display: none;
}

.composer-edit-mode {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 4px;
}

.composer-edit-mode__banner {
  padding: 12px 14px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--hearth-surface-elevated) 88%, rgba(109, 93, 252, 0.08));
  border: 1px solid rgba(109, 93, 252, 0.2);
}

.composer-edit-mode__eyebrow {
  color: var(--hearth-text);
  font-size: 0.8rem;
  font-weight: 700;
}

.composer-edit-mode__body {
  margin-top: 4px;
  color: var(--hearth-text-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.composer-edit-mode__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.composer-edit-mode__chip {
  border-radius: 999px;
  padding: 0 12px;
  min-height: 32px;
  color: var(--hearth-text);
  background: var(--hearth-surface-elevated);
  border: 1px solid var(--hearth-border);
}

.composer-edit-mode__chip:hover {
  background: color-mix(in srgb, var(--hearth-surface-elevated) 88%, rgba(109, 93, 252, 0.12));
}

.composer-attachments {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 4px;
}

.composer-attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  max-width: 260px;
  width: min(100%, 260px);
  padding: 8px 10px;
  border-radius: 18px;
  background: var(--hearth-surface-elevated);
  border: 1px solid var(--hearth-border);
}

.composer-attachment-chip__thumb,
.composer-attachment-chip__icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--hearth-surface-soft);
  overflow: hidden;
  color: var(--hearth-text-muted);
}

.composer-attachment-chip__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.composer-attachment-chip__body {
  min-width: 0;
}

.composer-attachment-chip__name {
  color: var(--hearth-text);
  font-size: 0.84rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-attachment-chip__meta {
  color: var(--hearth-text-muted);
  font-size: 0.72rem;
}

.composer-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 8px 7px 10px;
  border-radius: 24px;
  background: color-mix(in srgb, var(--hearth-surface) 94%, rgba(12, 10, 9, 0.72));
  border: 1px solid rgba(109, 93, 252, 0.16);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.3);
}

.composer-plus-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  color: var(--hearth-text-muted);
  background: transparent;
  border: 0;
  box-shadow: none;
}

.composer-input-wrap {
  flex: 1;
  min-width: 0;
  padding: 10px 0 8px;
  border: 0;
  background: transparent;
}

.composer-input-wrap :deep(.q-field),
.composer-input-wrap :deep(.q-textarea) {
  width: 100%;
  min-width: 0;
}

.composer-input-wrap :deep(.q-field__control),
.composer-input-wrap :deep(.q-field__control-container),
.composer-input-wrap :deep(.q-field__native),
.composer-input-wrap :deep(textarea.composer-input) {
  min-height: 22px !important;
}

.composer-input-wrap :deep(.q-field__control),
.composer-input-wrap :deep(.q-field__control-container) {
  padding: 0;
}

.composer-input-wrap :deep(.q-field__bottom),
.composer-input-wrap :deep(.q-field__append),
.composer-input-wrap :deep(.q-field__prepend),
.composer-input-wrap :deep(.q-field__shadow) {
  display: none;
}

:deep(.q-field--auto-height),
:deep(.q-field--auto-height .q-field__control),
:deep(.q-field--auto-height .q-field__native),
:deep(.q-textarea .q-field__native) {
  min-height: 20px !important;
  max-height: 120px;
}

:deep(.composer-input) {
  min-height: 20px !important;
  height: 20px;
  max-height: 120px;
  font-size: 0.96rem;
  line-height: 1.4;
  color: var(--hearth-text);
  padding: 1px 0 !important;
  overflow-y: auto;
  resize: none;
}

:deep(.composer-input::placeholder) {
  color: var(--hearth-text-muted);
}

.composer-uploading {
  color: var(--hearth-text-muted);
  font-size: 0.78rem;
  min-height: 18px;
  margin-top: 6px;
}

.composer-hint {
  display: none;
}

.composer-send-btn {
  width: 36px;
  min-width: 36px;
  height: 36px;
  min-height: 36px;
  margin: 0;
  flex-shrink: 0;
  align-self: center;
  box-shadow: none;
  background: linear-gradient(135deg, #7c3aed, #2563eb) !important;
  color: #fff !important;
}

.composer-send-btn--stop {
  transition: background-color 150ms ease;
}

.composer-send-btn--stop:hover {
  background-color: var(--q-negative, #c10015) !important;
}

.composer-restore-btn {
  align-self: center;
  flex-shrink: 0;
}

.composer-build-marker {
  align-self: flex-end;
  padding-right: 6px;
  color: var(--hearth-text-muted);
  font-size: 0.68rem;
  line-height: 1;
  opacity: 0.8;
  user-select: text;
}

.empty-state {
  height: 100%;
  max-width: 520px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 10px;
  padding: 40px 20px;
}

.empty-state--tappable {
  width: 100%;
  background: transparent;
  border: none;
  cursor: text;
  padding: 0;
  color: inherit;
  -webkit-tap-highlight-color: transparent;
}

.empty-state__title {
  font-weight: 700;
  font-size: 1.2rem;
}

.empty-state__body {
  line-height: 1.75;
}

.mobile-sidebar-toggle {
  color: var(--hearth-text-muted);
}

@media (max-width: 1024px) {
  .conversation-body,
  .composer-shell {
    padding-left: 18px;
    padding-right: 18px;
  }

  .chat-header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .composer-footer {
    width: auto;
    justify-content: space-between;
  }
}

@media (max-width: 767px) {
  /*
   * MOBILE LAYOUT — the golden rule:
   * .chat-panel  = fixed-size flex column, overflow:hidden, does NOT scroll
   * .chat-header = flex-shrink:0, stays at top, never moves
   * .conversation-body = flex:1, min-height:0, overflow-y:auto — ONLY this scrolls
   * .composer-shell = flex-shrink:0, stays at bottom, never moves
   *
   * No sticky, no fixed, no transforms. Just a flex column that fills the viewport.
   * The keyboard offset is handled via padding-bottom on conversation-body only.
   */

  .chat-panel {
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--hearth-bg);
    /* dvh tracks the visual viewport — shrinks with keyboard, no JS needed */
    height: 100dvh;
    max-height: 100dvh;
  }

  .chat-header {
    position: static;
    flex-shrink: 0;
    z-index: 10;
  }

  .conversation-body {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .composer-shell {
    position: static;
    flex-shrink: 0;
    z-index: 9;
    padding-top: 6px;
    padding-bottom: max(env(safe-area-inset-bottom), 8px);
    background: var(--hearth-bg);
  }

  .composer-card {
    max-width: none;
    width: 100%;
  }

  .archive-chip {
    display: none;
  }

  .chat-notice {
    margin-left: 18px;
    margin-right: 18px;
  }

  .message-stack {
    gap: 16px;
  }

  .message-row {
    gap: 10px;
  }

  .message-row--assistant {
    flex-direction: column;
  }

  .typing-row {
    width: 100%;
  }

  .message-row--assistant .message-card {
    max-width: 100%;
  }

  .message-row--user .message-card {
    max-width: 82%;
  }

  .composer-plus-btn :deep(.q-icon) {
    font-size: 20px;
  }

  .image-lightbox {
    padding: calc(max(14px, env(safe-area-inset-top))) 10px calc(max(10px, env(safe-area-inset-bottom))) 10px;
  }

  .image-lightbox__close {
    top: max(12px, env(safe-area-inset-top));
    right: 12px;
  }

  .image-lightbox__actions {
    width: calc(100% - 16px);
    gap: 8px;
    padding: 8px;
  }

  .image-lightbox__action {
    min-width: 0;
    flex: 1 1 calc(50% - 8px);
  }

  .image-lightbox__image {
    max-width: 100%;
    max-height: calc(100dvh - 132px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    border-radius: 14px;
  }

  .composer-send-btn {
    width: 36px;
    min-width: 36px;
    height: 36px;
    min-height: 36px;
    box-shadow: none;
  }

  .composer-uploading {
    margin-top: 4px;
  }

  .composer-build-marker {
    display: none;
  }

  /* On touch devices, message actions are always visible (no hover) */
  .message-card__footer {
    opacity: 1;
  }

  .conversation-failure-card {
    padding: 24px 20px;
    border-radius: 24px;
  }

  .conversation-failure-card__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .conversation-failure-card__primary,
  .conversation-failure-card__secondary {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 640px) {
  .composer-hint {
    display: none;
  }
}

// --- Chat header title area ---

.chat-header-title-area {
  flex: 1;
  min-width: 0;
}

// --- Chat-level 3-dots button ---

.chat-menu-btn {
  color: var(--hearth-text-muted);
  flex-shrink: 0;
  margin-top: 0;
  margin-left: 0;
  align-self: center;
}

.chat-menu-btn:hover {
  color: var(--hearth-text);
}

// --- Speak toggle active state ---

.message-action-btn--speaking {
  color: var(--hearth-primary) !important;
}

// --- View files dialog ---

.chat-files-card {
  width: min(480px, 92vw);
  background: var(--hearth-surface);
  color: var(--hearth-text);
  border: 1px solid var(--hearth-border);
  border-radius: 20px;
  overflow: hidden;
}

.chat-files-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
}

.chat-files-card__title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--hearth-text);
}

.chat-files-card__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 12px 16px;
  max-height: 60dvh;
  overflow-y: auto;
}

.chat-files-card__empty {
  padding: 12px 20px 24px;
  color: var(--hearth-text-muted);
  font-size: 0.9rem;
}

.chat-file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 12px;
  text-decoration: none;
  color: var(--hearth-text);
  transition: background 120ms ease;
}

.chat-file-row:hover {
  background: var(--hearth-surface-elevated);
}

.chat-file-row__icon {
  color: var(--hearth-text-muted);
  flex-shrink: 0;
}

.chat-file-row__name {
  flex: 1;
  min-width: 0;
  font-size: 0.88rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-file-row__ext {
  color: var(--hearth-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}
</style>
