<!-- src/lib/components/RoleBadge.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import IcShield from "~icons/ic/outline-shield";
  import IcVerified from "~icons/ic/outline-verified";
  import type { SiteRole } from "#lib";

  let { role }: { role: SiteRole | null | undefined } = $props();
</script>

{#if role === "owner"}
  <span class="badge accent" title="site owner"><IcVerified class="icon" width="12" height="12" /> owner</span>
{:else if role === "mod"}
  <span class="badge" title="site moderator"><IcShield class="icon" width="12" height="12" /> mod</span>
{/if}
