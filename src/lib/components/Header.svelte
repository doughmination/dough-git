<!-- src/lib/components/Header.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import IcAddCircle from "~icons/ic/outline-add-circle";
  import IcLogin from "~icons/ic/outline-login";
  import IcLogout from "~icons/ic/outline-logout";
  import IcSettings from "~icons/ic/outline-settings";
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
        <IcAddCircle class="icon nav-icon" width="24" height="24" />New
      </a>
      <a href="/settings">
        <IcSettings class="icon nav-icon" width="24" height="24" />Settings
      </a>
      <form method="post" action="/auth/logout" class="inline">
        <button type="submit" class="nav-button">
          <IcLogout class="icon nav-icon" width="24" height="24" />Sign out
        </button>
      </form>
    {:else}
      <a href="/auth/login">
        <IcLogin class="icon nav-icon" width="24" height="24" />Sign in
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
