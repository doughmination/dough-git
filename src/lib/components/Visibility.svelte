<!-- src/lib/components/Visibility.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  let { isPublic }: { isPublic: boolean } = $props();
</script>

<span class="with-icon">
  <iconsax-icon name={isPublic ? "unlock" : "lock"} type="bulk" size="14"></iconsax-icon>
  {isPublic ? "public" : "private"}
</span>
