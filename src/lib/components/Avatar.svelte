<!-- src/lib/components/Avatar.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import { displayName, type Profile } from "#lib";

  let { profile, size }: { profile: Profile; size: "sm" | "lg" } = $props();

  // A broken picture falls back to the initial underneath it
  let broken = $state(false);

  const initial = $derived(displayName(profile).trim().slice(0, 1).toUpperCase() || "?");
</script>

<span class="avatar {size}">
  {initial}
  {#if profile.picture && !broken}
    <img src={profile.picture} alt="" loading="lazy" onerror={() => (broken = true)} />
  {/if}
</span>

<style>
  .avatar {
    display: inline-grid;
    position: relative;
    flex-shrink: 0;
    place-items: center;
    overflow: hidden;
    border-radius: 50%;
    outline: 1px solid var(--line);
    background: var(--accent-dim);
    color: var(--accent);
    font-weight: 600;
  }

  .sm {
    width: 1.75rem;
    height: 1.75rem;
    font-size: 0.8rem;
  }

  .lg {
    width: 4.5rem;
    height: 4.5rem;
    font-size: 1.75rem;
    box-shadow: 0 0 0 4px var(--accent-dim);
  }

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
