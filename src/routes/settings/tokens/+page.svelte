<!-- src/routes/settings/tokens/+page.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import { fmtDate } from "#lib";
  import Meta from "#lib/components/Meta.svelte";

  let { data, form } = $props();

  const remote = $derived(
    form?.newToken ? data.baseUrl.replace("://", `://${data.slug}:${form.newToken}@`) + `/${data.slug}/<repo>.git` : "",
  );
</script>

<Meta title="access tokens" description="Manage git access tokens." noindex />

<h2 class="section-title"><iconsax-icon name="key" type="bulk" size="20"></iconsax-icon>Access tokens</h2>
<p class="muted">
  These tokens act as <code>{data.slug}</code>: use that as the git <strong>username</strong> and the token as the
  <strong>password</strong>. They can only push to repositories under <code>{data.slug}/</code>.
</p>

{#if form?.newToken}
  <section class="panel">
    <p><strong>New token — copy it now, it won't be shown again:</strong></p>
    <code>{form.newToken}</code>
    <p class="muted">Ready-to-use remote:<br /><code>git remote add mirror {remote}</code></p>
  </section>
{/if}

<form method="post" action="?/create" class="panel row">
  <label class="field-label with-icon" for="token-label"><iconsax-icon name="tag" type="bulk" size="16"></iconsax-icon>label</label>
  <input id="token-label" type="text" name="label" placeholder="laptop, backup cron, ..." />
  <button type="submit" class="primary"><iconsax-icon name="add" type="bulk" size="16"></iconsax-icon>create token</button>
</form>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>label</th>
        <th>id</th>
        <th>created</th>
        <th>last used</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each data.tokens as token (token.id)}
        <tr>
          <td>{token.label}</td>
          <td class="mono">{token.id}</td>
          <td class="mono">{fmtDate(token.created_at)}</td>
          <td class="mono">{token.last_used ? fmtDate(token.last_used) : "never"}</td>
          <td>
            <form method="post" action="?/revoke">
              <input type="hidden" name="id" value={token.id} />
              <button type="submit" class="small danger"><iconsax-icon name="close-circle" type="bulk" size="14"></iconsax-icon>revoke</button>
            </form>
          </td>
        </tr>
      {:else}
        <tr><td colspan="5" class="empty">no tokens yet</td></tr>
      {/each}
    </tbody>
  </table>
</div>
