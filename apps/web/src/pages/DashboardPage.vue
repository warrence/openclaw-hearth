<template>
  <div class="dashboard-page">
    <div class="dashboard-shell">
      <GatewayStatus />

      <template v-if="isOwner">
        <ModelPresetSettings />
        <ReminderSettings />
        <ProfileManagement />
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAppShell } from 'src/lib/appShell'
import GatewayStatus from 'src/components/settings/GatewayStatus.vue'
import ModelPresetSettings from 'src/components/settings/ModelPresetSettings.vue'
import ReminderSettings from 'src/components/settings/ReminderSettings.vue'
import ProfileManagement from 'src/components/settings/ProfileManagement.vue'

const { currentUser } = useAppShell()
const isOwner = computed(() => currentUser.value?.role === 'owner')
</script>

<style scoped lang="scss">
.dashboard-page {
  height: 100dvh;
  overflow-y: auto;
  overflow-x: clip;
  padding: 0;
}

.dashboard-shell {
  max-width: 1100px;
  margin: 0 auto;
  min-width: 0;
  padding: 0 28px 28px;
}

@media (max-width: 640px) {
  .dashboard-page {
    padding: 0;
  }

  .dashboard-shell {
    padding: 0 14px 28px;
  }
}
</style>
