<!-- src/routes/settings/+layout.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import { page } from "$app/state";
  import Tabs from "#lib/components/Tabs.svelte";

  let { children } = $props();

  const active = $derived(
    page.url.pathname.startsWith("/settings/tokens")
      ? "tokens"
      : page.url.pathname.startsWith("/settings/deleted")
        ? "deleted"
        : "account",
  );
</script>

<div class="page">
  <div class="page-head">
    <p class="eyebrow">git mirror</p>
    <h1>Settings</h1>
  </div>

  <Tabs
    {active}
    items={[
      {
        id: "account",
        label: "account",
        icon: "user",
        href: "/settings",
      },
      {
        id: "tokens",
        label: "tokens",
        icon: "key",
        href: "/settings/tokens",
      },
      {
        id: "deleted",
        label: "recently deleted",
        icon: "trash",
        href: "/settings/deleted",
      },
    ]}
  />

  {@render children()}
</div>
