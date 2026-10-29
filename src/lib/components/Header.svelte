<!-- src/lib/components/Header.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import "#lib/styles/header.css";
  import { page } from "$app/state";
  import { displayName } from "#lib";
  import Avatar from "#lib/components/Avatar.svelte";

  const site = $derived(page.data.site);
  const user = $derived(page.data.user);
</script>

<!-- Fixed-height page backdrop, so every page gets the same amount of background -->
<div class="backdrop" aria-hidden="true"></div>

<header>
  <a class="brand" href="/">
    {#if site.favicon}
      <img src={site.favicon} alt="" width="32" height="32" />
    {/if}
    <span>{site.title}</span>
  </a>

  <nav>
    {#if user}
      <a href="/{user.slug}">
        <Avatar profile={user} size="sm" />{displayName(user)}
      </a>
      <a href="/new">
        <iconsax-icon name="add-circle" type="bulk" size="24" class="nav-icon"></iconsax-icon>New
      </a>
      <a href="/settings">
        <iconsax-icon name="setting-2" type="bulk" size="24" class="nav-icon"></iconsax-icon>Settings
      </a>
      <form method="post" action="/auth/logout" class="inline">
        <button type="submit" class="nav-button">
          <iconsax-icon name="logout-01" type="bulk" size="24" class="nav-icon"></iconsax-icon>Sign out
        </button>
      </form>
    {:else}
      <a href="/auth/login">
        <iconsax-icon name="login-01" type="bulk" size="24" class="nav-icon"></iconsax-icon>Sign in
      </a>
    {/if}
  </nav>
</header>

<style>
  nav {
    flex-wrap: wrap;
    align-items: center;
  }

  /* A form button that reads as one of the header's links */
  .nav-button {
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: inherit;
  }

  .nav-button:hover:not(:disabled) {
    color: var(--text);
  }
</style>
