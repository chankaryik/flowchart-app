<script setup lang="ts">
import { Compass } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'

import { Button } from '@/components/ui/button'

const route = useRoute()
</script>

<template>
  <div
    class="flex h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground"
    data-testid="not-found"
  >
    <div
      class="flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 shadow-sm"
    >
      <Compass class="size-8 text-muted-foreground" aria-hidden="true" />
      <p class="text-2xl font-semibold tracking-tight">404</p>
      <div>
        <p class="text-sm font-semibold">Page not found</p>
        <p class="mt-1 text-xs text-muted-foreground">
          We couldn't find anything at
          <span class="font-mono">{{ route.fullPath }}</span
          >.
        </p>
      </div>
      <Button as-child size="sm" data-testid="not-found-home">
        <RouterLink to="/">Back to flow chart</RouterLink>
      </Button>
    </div>
  </div>
</template>
