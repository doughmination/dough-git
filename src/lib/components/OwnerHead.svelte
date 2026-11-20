<!-- src/lib/components/OwnerHead.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import IcForkRight from "~icons/ic/outline-fork-right";
  import IcPerson from "~icons/ic/outline-person";
  import { displayName, fmtDate, type SiteRole } from "#lib";
  import Avatar from "#lib/components/Avatar.svelte";
  import RoleBadge from "#lib/components/RoleBadge.svelte";
  import Tabs from "#lib/components/Tabs.svelte";

  type Profile = {
    slug: string;
    name: string | null;
    username: string | null;
    picture: string | null;
    createdAt: number;
    role: SiteRole | null;
  };

  let {
    owner,
    profile,
    active,
  }: {
    owner: string;
    profile: Profile | null;
    active: "profile" | "repos";
  } = $props();

  const handle = $derived(profile?.username && profile.username !== profile.slug ? profile.username : null);
  const shown = $derived(
    profile ?? {
      name: owner,
      username: null,
      picture: null,
    },
  );
</script>

<section class="owner-head">
  <Avatar profile={shown} size="lg" />
  <div>
    <h1>{displayName(shown)} <RoleBadge role={profile?.role} /></h1>
    {#if profile}
      <p class="muted">
        @{profile.slug}{#if handle}&nbsp;&middot; {handle}{/if} &middot; joined {fmtDate(profile.createdAt).slice(0, 10)}
      </p>
    {:else}
      <p class="muted">@{owner} &middot; no account on this instance</p>
    {/if}
  </div>
</section>

<Tabs
  {active}
  items={[
    {
      id: "profile",
      label: "profile",
      icon: IcPerson,
      href: `/${owner}`,
    },
    {
      id: "repos",
      label: "repositories",
      icon: IcForkRight,
      href: `/${owner}/+repos`,
    },
  ]}
/>

<style>
  .owner-head {
    display: flex;
    gap: 1.25rem;
    align-items: center;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.75rem, 5vw, 2.5rem);
    letter-spacing: -0.02em;
  }

  p {
    margin: 0;
  }
</style>
