<script setup lang="ts">
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <RouterView />
    <Toaster position="top-center" rich-colors close-button closeButtonPosition="top-right" />
  </TooltipProvider>
</template>
