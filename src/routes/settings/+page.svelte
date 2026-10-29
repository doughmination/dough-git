<!-- src/routes/settings/+page.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import { fmtDate } from "#lib";
  import Meta from "#lib/components/Meta.svelte";
  import ConfirmForm from "#lib/components/ConfirmForm.svelte";

  let { data } = $props();
</script>

<Meta title="settings" description="Account settings." noindex />

{#if data.saved}
  <p class="notice ok" role="status">Saved.</p>
{/if}

<h2 class="section-title"><iconsax-icon name="message-text" type="bulk" size="20"></iconsax-icon>Discord notifications</h2>
<p class="muted">
  Announces repositories being created and deleted, and commits being pushed. Only repositories you own are
  announced, and only to this webhook.
</p>

<section class="panel">
  {#if data.webhook}
    <p class="muted">configured &middot; <code>{data.webhook}</code></p>
  {:else}
    <p class="empty">not configured — repository events are not announced anywhere.</p>
  {/if}

  {#if data.webhookError}
    <p class="bad">
      last delivery failed{data.webhookErrorAt ? ` at ${fmtDate(data.webhookErrorAt)}` : ""}: {data.webhookError}
    </p>
  {/if}

  <form method="post" action="?/discord" class="row">
    <label class="field-label with-icon" for="discord-url">
      <iconsax-icon name="link" type="bulk" size="16"></iconsax-icon>webhook
    </label>
    <input id="discord-url" type="url" name="url" autocomplete="off" placeholder="https://discord.com/api/webhooks/…" />
    <button type="submit" class="primary"><iconsax-icon name="save-2" type="bulk" size="16"></iconsax-icon>save</button>
  </form>

  {#if data.webhook}
    <ConfirmForm action="?/discord" prompt="Remove the Discord webhook? Events will stop being announced.">
      <input type="hidden" name="url" value="" />
      <button type="submit" class="danger"><iconsax-icon name="trash" type="bulk" size="16"></iconsax-icon>remove webhook</button>
    </ConfirmForm>
  {/if}
</section>

<h2 class="section-title"><iconsax-icon name="slider-horizontal" type="bulk" size="20"></iconsax-icon>Preferences</h2>
<form method="post" action="?/prefs" class="panel">
  <label class="check">
    <input type="checkbox" name="default_private" checked={data.defaultPrivate} />
    <span>New repositories start private</span>
  </label>
  <label class="check">
    <input type="checkbox" name="discord_private" checked={data.discordPrivate} />
    <span>
      Announce activity on private repositories
      <br /><small class="muted">
        Off by default: commit subjects and repository names would otherwise leave a private repo for a Discord
        channel.
      </small>
    </span>
  </label>
  <label class="check">
    <input type="checkbox" name="mirror_auto" checked={data.mirrorAuto} />
    <span>
      Check mirror status automatically when viewing a repository
      <br /><small class="muted">Off means mirrors are only checked when you press <em>check now</em>.</small>
    </span>
  </label>
  <div>
    <button type="submit" class="primary">
      <iconsax-icon name="save-2" type="bulk" size="16"></iconsax-icon>save preferences
    </button>
  </div>
</form>

<h2 class="section-title"><iconsax-icon name="user" type="bulk" size="20"></iconsax-icon>Account</h2>
<p class="muted">
  Your name and avatar come from your SSO account and refresh automatically, so there is nothing to edit
  here{#if data.accountUrl}
    — change them on <a href={data.accountUrl}>your SSO account page</a>{/if}. Your owner namespace is
  <code>{data.slug}</code> and never changes.
</p>
