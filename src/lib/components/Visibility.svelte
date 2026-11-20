<!-- src/lib/components/Visibility.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import IcLock from "~icons/ic/outline-lock";
  import IcLockOpen from "~icons/ic/outline-lock-open";

  let { isPublic }: { isPublic: boolean } = $props();
</script>

<span class="with-icon">
  {#if isPublic}
    <IcLockOpen class="icon" width="14" height="14" />
  {:else}
    <IcLock class="icon" width="14" height="14" />
  {/if}
  {isPublic ? "public" : "private"}
</span>
