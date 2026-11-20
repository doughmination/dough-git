<!-- src/routes/settings/+layout.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import IcDelete from "~icons/ic/outline-delete";
  import IcKey from "~icons/ic/outline-key";
  import IcPerson from "~icons/ic/outline-person";
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
        icon: IcPerson,
        href: "/settings",
      },
      {
        id: "tokens",
        label: "tokens",
        icon: IcKey,
        href: "/settings/tokens",
      },
      {
        id: "deleted",
        label: "recently deleted",
        icon: IcDelete,
        href: "/settings/deleted",
      },
    ]}
  />

  {@render children()}
</div>
