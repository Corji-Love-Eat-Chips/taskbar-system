<template>
  <router-view />
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useReminder } from '@/composables/useReminder'

const { start, stop } = useReminder()

onMounted(start)
onUnmounted(stop)
</script>
