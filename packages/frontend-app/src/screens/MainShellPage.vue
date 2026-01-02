<script lang="ts" setup>
import TimelineTab from '../tabs/TimelineTab.vue';
import NotificationsTab from '../tabs/NotificationsTab.vue';
import ComposeTab from '../tabs/ComposeTab.vue';
import ProfileTab from '../tabs/ProfileTab.vue';
import SettingsTab from '../tabs/SettingsTab.vue';
</script>

<template>
  <Page>
    <ActionBar title="Misskey" />
    <TabView>
      <TabViewItem title="Timeline">
        <GridLayout>
          <TimelineTab />
        </GridLayout>
      </TabViewItem>
      <TabViewItem title="Notifications">
        <GridLayout>
          <NotificationsTab />
        </GridLayout>
      </TabViewItem>
      <TabViewItem title="Compose">
        <GridLayout>
          <ComposeTab />
        </GridLayout>
      </TabViewItem>
      <TabViewItem title="Profile">
        <GridLayout>
          <ProfileTab />
        </GridLayout>
      </TabViewItem>
      <TabViewItem title="Settings">
        <GridLayout>
          <SettingsTab />
        </GridLayout>
      </TabViewItem>
    </TabView>
  </Page>
</template>
