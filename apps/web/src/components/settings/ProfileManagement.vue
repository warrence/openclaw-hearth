<template>
  <div>
    <div class="profiles-card q-mt-md">
      <div class="profiles-card__header tts-card__header--clickable" @click="profilesExpanded = !profilesExpanded">
        <div>
          <div class="dashboard-card__label">{{ t('profiles.sectionLabel') }}</div>
          <div class="profiles-card__title">{{ t('profiles.sectionTitle') }}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <q-btn
            color="primary"
            unelevated
            no-caps
            rounded
            icon="person_add"
            :label="t('profiles.addProfileButton')"
            size="sm"
            @click.stop="openAddDialog"
          />
          <q-icon :name="profilesExpanded ? 'expand_less' : 'expand_more'" size="24px" />
        </div>
      </div>

      <div v-show="profilesExpanded">
        <div v-if="profilesLoading" class="profiles-card__empty q-mt-md">
          <q-spinner color="primary" size="24px" />
        </div>

        <div v-else-if="allProfiles.length === 0" class="dashboard-card__caption q-mt-md">
          {{ t('profiles.noneFound') }}
        </div>

        <div v-else class="profiles-list q-mt-md">
          <div v-for="profile in allProfiles" :key="profile.id" class="profile-row">
            <q-avatar size="38px" class="profile-row__avatar">
              {{ profile.name.charAt(0).toUpperCase() }}
            </q-avatar>

            <div class="profile-row__info">
              <div class="profile-row__name">{{ profile.name }}</div>
              <div class="profile-row__badges">
                <q-chip
                  dense
                  square
                  size="xs"
                  :class="profile.role === 'owner' ? 'badge-owner' : 'badge-member'"
                >
                  {{ profile.role === 'owner' ? t('profiles.roleOwner') : t('profiles.roleMember') }}
                </q-chip>
                <q-chip
                  dense
                  square
                  size="xs"
                  :class="profile.is_active ? 'badge-active' : 'badge-inactive'"
                >
                  {{ profile.is_active ? t('common.active') : t('common.inactive') }}
                </q-chip>
                <q-chip
                  dense
                  square
                  size="xs"
                  class="badge-pin"
                  :icon="profile.has_pin ? 'lock' : 'lock_open'"
                >
                  {{ profile.has_pin ? t('profiles.pinSet') : t('profiles.noPin') }}
                </q-chip>
              </div>
            </div>

            <div class="profile-row__actions">
              <q-btn flat round dense icon="edit" size="sm" @click="openEditDialog(profile)">
                <q-tooltip>{{ t('profiles.editProfileTooltip') }}</q-tooltip>
              </q-btn>
              <q-btn flat round dense icon="pin" size="sm" @click="openSetPinDialog(profile)">
                <q-tooltip>{{ t('profiles.setPinTooltip') }}</q-tooltip>
              </q-btn>
              <q-btn
                v-if="profile.has_pin"
                flat
                round
                dense
                icon="lock_reset"
                size="sm"
                color="warning"
                @click="promptResetPin(profile)"
              >
                <q-tooltip>{{ t('profiles.clearPinTooltip') }}</q-tooltip>
              </q-btn>
              <q-btn
                flat
                round
                dense
                icon="delete_outline"
                size="sm"
                color="negative"
                @click="promptDeleteProfile(profile)"
              >
                <q-tooltip>{{ t('profiles.deleteProfileTooltip') }}</q-tooltip>
              </q-btn>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add / Edit profile dialog -->
    <q-dialog v-model="profileDialog.open" persistent>
      <q-card class="dialog-card">
        <q-card-section class="dialog-card__header">
          <div class="dialog-card__title">{{ profileDialog.isEdit ? t('profiles.dialogs.editProfileTitle') : t('profiles.dialogs.addProfileTitle') }}</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="profileDialog.name"
            :label="t('profiles.dialogs.nameField')"
            dense
            dark
            outlined
            class="q-mb-sm"
            :error="!!profileDialog.errors.name"
            :error-message="profileDialog.errors.name"
          />

          <q-select
            v-model="profileDialog.role"
            :options="roleOptions"
            option-value="value"
            option-label="label"
            emit-value
            map-options
            :label="t('profiles.dialogs.roleField')"
            dense
            dark
            outlined
            class="q-mb-sm"
          />

          <q-toggle
            v-model="profileDialog.isActive"
            :label="t('profiles.dialogs.activeField')"
            color="primary"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" color="grey-5" v-close-popup />
          <q-btn
            unelevated
            no-caps
            rounded
            :label="profileDialog.isEdit ? t('common.save') : t('common.create')"
            color="primary"
            :loading="profileDialog.loading"
            @click="submitProfileDialog"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Set PIN dialog -->
    <q-dialog v-model="pinDialog.open" persistent>
      <q-card class="dialog-card">
        <q-card-section class="dialog-card__header">
          <div class="dialog-card__title">{{ t('profiles.dialogs.setPinTitle', { name: pinDialog.profile?.name }) }}</div>
          <div class="dialog-card__subtitle">{{ t('profiles.dialogs.setPinSubtitle') }}</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="pinDialog.pin"
            :label="t('profiles.dialogs.newPinField')"
            type="password"
            inputmode="numeric"
            dense
            dark
            outlined
            :error="!!pinDialog.error"
            :error-message="pinDialog.error"
            @keyup.enter="submitSetPin"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" color="grey-5" v-close-popup />
          <q-btn
            unelevated
            no-caps
            rounded
            :label="t('profiles.dialogs.setPinButton')"
            color="primary"
            :loading="pinDialog.loading"
            @click="submitSetPin"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Delete profile confirm dialog -->
    <q-dialog v-model="deleteProfileDialog.open" persistent>
      <q-card class="dialog-card">
        <q-card-section class="dialog-card__header">
          <div class="dialog-card__title">{{ t('profiles.dialogs.deleteTitle', { name: deleteProfileDialog.profile?.name }) }}</div>
          <div class="dialog-card__subtitle">
            {{ t('profiles.dialogs.deleteSubtitle') }}
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" color="grey-5" v-close-popup />
          <q-btn
            unelevated
            no-caps
            rounded
            :label="t('profiles.dialogs.deleteButton')"
            color="negative"
            :loading="deleteProfileDialog.loading"
            @click="submitDeleteProfile"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Reset PIN confirm dialog -->
    <q-dialog v-model="resetPinDialog.open">
      <q-card class="dialog-card">
        <q-card-section class="dialog-card__header">
          <div class="dialog-card__title">{{ t('profiles.dialogs.clearPinTitle', { name: resetPinDialog.profile?.name }) }}</div>
          <div class="dialog-card__subtitle">{{ t('profiles.dialogs.clearPinSubtitle') }}</div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('common.cancel')" color="grey-5" v-close-popup />
          <q-btn
            unelevated
            no-caps
            rounded
            :label="t('profiles.dialogs.clearPinButton')"
            color="warning"
            :loading="resetPinDialog.loading"
            @click="submitResetPin"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import {
  createProfile,
  deleteProfile,
  listProfiles,
  resetProfilePin,
  setProfilePin,
  updateProfile,
} from 'src/lib/api'

const $q = useQuasar()
const { t } = useI18n({ useScope: 'global' })
const profilesExpanded = ref(false)
const profilesLoading = ref(false)
const allProfiles = ref([])

const roleOptions = computed(() => ([
  { label: t('profiles.roleOptions.member'), value: 'member' },
  { label: t('profiles.roleOptions.owner'), value: 'owner' },
]))

const profileDialog = ref({
  open: false,
  isEdit: false,
  profileId: null,
  name: '',
  role: 'member',
  isActive: true,
  loading: false,
  errors: {},
})

const pinDialog = ref({
  open: false,
  profile: null,
  pin: '',
  error: '',
  loading: false,
})

const resetPinDialog = ref({
  open: false,
  profile: null,
  loading: false,
})

const deleteProfileDialog = ref({
  open: false,
  profile: null,
  loading: false,
})

onMounted(() => {
  loadProfiles()
})

async function loadProfiles() {
  profilesLoading.value = true

  try {
    allProfiles.value = await listProfiles()
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  } finally {
    profilesLoading.value = false
  }
}

function openAddDialog() {
  profileDialog.value = {
    open: true,
    isEdit: false,
    profileId: null,
    name: '',
    role: 'member',
    isActive: true,
    loading: false,
    errors: {},
  }
}

function openEditDialog(profile) {
  profileDialog.value = {
    open: true,
    isEdit: true,
    profileId: profile.id,
    name: profile.name,
    role: profile.role,
    isActive: profile.is_active,
    loading: false,
    errors: {},
  }
}

async function submitProfileDialog() {
  if (profileDialog.value.loading) return

  profileDialog.value.loading = true
  profileDialog.value.errors = {}

  const isEdit = profileDialog.value.isEdit

  try {
    const payload = {
      name: profileDialog.value.name,
      role: profileDialog.value.role,
      is_active: profileDialog.value.isActive,
    }

    if (isEdit) {
      await updateProfile(profileDialog.value.profileId, payload)
    } else {
      await createProfile(payload)
    }

    profileDialog.value.open = false
    await loadProfiles()
    $q.notify({ type: 'positive', message: isEdit ? t('profiles.notifications.profileUpdated') : t('profiles.notifications.profileCreated') })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  } finally {
    profileDialog.value.loading = false
  }
}

function openSetPinDialog(profile) {
  pinDialog.value = {
    open: true,
    profile,
    pin: '',
    error: '',
    loading: false,
  }
}

async function submitSetPin() {
  if (pinDialog.value.loading || !pinDialog.value.pin) return

  pinDialog.value.loading = true
  pinDialog.value.error = ''

  const profileName = pinDialog.value.profile.name

  try {
    await setProfilePin(pinDialog.value.profile.id, pinDialog.value.pin)
    pinDialog.value.open = false
    await loadProfiles()
    $q.notify({ type: 'positive', message: t('profiles.notifications.pinSetFor', { name: profileName }) })
  } catch (error) {
    pinDialog.value.error = error.message
  } finally {
    pinDialog.value.loading = false
  }
}

function promptResetPin(profile) {
  resetPinDialog.value = { open: true, profile, loading: false }
}

async function submitResetPin() {
  if (resetPinDialog.value.loading) return

  resetPinDialog.value.loading = true

  const profileName = resetPinDialog.value.profile.name

  try {
    await resetProfilePin(resetPinDialog.value.profile.id)
    resetPinDialog.value.open = false
    await loadProfiles()
    $q.notify({ type: 'positive', message: t('profiles.notifications.pinClearedFor', { name: profileName }) })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  } finally {
    resetPinDialog.value.loading = false
  }
}

function promptDeleteProfile(profile) {
  deleteProfileDialog.value = { open: true, profile, loading: false }
}

async function submitDeleteProfile() {
  if (deleteProfileDialog.value.loading) return

  deleteProfileDialog.value.loading = true

  const profileName = deleteProfileDialog.value.profile.name

  try {
    await deleteProfile(deleteProfileDialog.value.profile.id)
    deleteProfileDialog.value.open = false
    await loadProfiles()
    $q.notify({ type: 'positive', message: t('profiles.notifications.profileDeletedWithData', { name: profileName }) })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
    deleteProfileDialog.value.loading = false
  }
}
</script>

<style scoped lang="scss">
.profiles-card {
  background: color-mix(in srgb, var(--hearth-surface) 88%, transparent);
  border: 1px solid var(--hearth-border);
  border-radius: 28px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  padding: 22px;
}

.profiles-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tts-card__header--clickable {
  cursor: pointer;
  user-select: none;
}

.profiles-card__title {
  margin-top: 8px;
  font-size: 1.3rem;
  font-weight: 700;
  color: #f8fafc;
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
  line-height: 1.7;
}

.profiles-card__empty {
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.profiles-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  transition: background 0.15s;

  &:hover {
    background: color-mix(in srgb, var(--hearth-surface-elevated) 88%, transparent);
  }
}

.profile-row__avatar {
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  color: #fff;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
}

.profile-row__info {
  flex: 1;
  min-width: 0;
}

.profile-row__name {
  color: var(--hearth-text);
  font-weight: 600;
  font-size: 0.96rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-row__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.badge-owner {
  background: color-mix(in srgb, var(--hearth-primary) 22%, transparent) !important;
  color: var(--hearth-text) !important;
}

.badge-member {
  background: var(--hearth-surface-elevated) !important;
  color: var(--hearth-text-muted) !important;
}

.badge-active {
  background: color-mix(in srgb, var(--hearth-secondary) 22%, transparent) !important;
  color: var(--hearth-text) !important;
}

.badge-inactive {
  background: color-mix(in srgb, var(--hearth-danger) 22%, transparent) !important;
  color: var(--hearth-text) !important;
}

.badge-pin {
  background: var(--hearth-surface-elevated) !important;
  color: var(--hearth-text-muted) !important;
}

.profile-row__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

// --- Dialogs ---

.dialog-card {
  background: var(--hearth-surface);
  border: 1px solid var(--hearth-border);
  border-radius: 20px;
  min-width: 340px;
}

.dialog-card__header {
  padding-bottom: 8px;
}

.dialog-card__title {
  color: var(--hearth-text);
  font-size: 1.1rem;
  font-weight: 700;
}

.dialog-card__subtitle {
  color: var(--hearth-text-muted);
  font-size: 0.88rem;
  margin-top: 6px;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .profiles-card {
    padding-left: 16px;
    padding-right: 16px;
  }

  .profiles-card__header {
    align-items: stretch;
  }

  .profiles-card__header .q-btn {
    width: 100%;
  }

  .dialog-card {
    min-width: 0;
    width: 100%;
  }
}
</style>
