<!-- src/routes/settings/deleted/+page.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import { fmtDate } from "#lib";
  import Meta from "#lib/components/Meta.svelte";
  import ConfirmForm from "#lib/components/ConfirmForm.svelte";

  let { data } = $props();

  const nowSec = Math.floor(Date.now() / 1000);

  function daysLeft(deletedAt: number): number {
    return Math.ceil((deletedAt + data.retentionDays * 86400 - nowSec) / 86400);
  }
</script>

<Meta title="recently deleted" description="Recover deleted repositories." noindex />

<h2 class="section-title"><iconsax-icon name="trash" type="bulk" size="20"></iconsax-icon>Recently deleted</h2>
<p class="muted">
  {data.retentionDays > 0
    ? `Deleted repositories are kept for ${data.retentionDays} days, then purged the next time you open this page.`
    : "Deleted repositories are kept indefinitely — nothing is purged unless you do it here."}
  A deleted repository keeps its name reserved, so nothing new can take it until it is restored or purged.
</p>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>repository</th>
        <th>deleted</th>
        <th>by</th>
        <th>retention</th>
        <th></th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each data.entries as entry (entry.entry)}
        <tr>
          <td>
            <iconsax-icon name="hierarchy" type="bulk" size="14"></iconsax-icon>
            {entry.name}
            {#if entry.degraded}
              <br /><small class="warn">
                recovery metadata unreadable — restorable, but collaborators will need re-adding
              </small>
            {:else if entry.grants.length}
              <br /><small class="muted">
                {entry.grants.length} collaborator{entry.grants.length === 1 ? "" : "s"} will be restored
              </small>
            {/if}
          </td>
          <td class="mono">{fmtDate(entry.deletedAt)}</td>
          <td class="muted">{entry.deletedBy}</td>
          <td>
            {#if data.retentionDays <= 0}
              <span class="empty">kept until purged</span>
            {:else if daysLeft(entry.deletedAt) <= 0}
              <span class="bad">purged on next visit</span>
            {:else}
              <span class={daysLeft(entry.deletedAt) <= 3 ? "bad" : "empty"}>{daysLeft(entry.deletedAt)}d left</span>
            {/if}
          </td>
          <td>
            <form method="post" action="?/restore">
              <input type="hidden" name="entry" value={entry.entry} />
              <button type="submit" class="small"><iconsax-icon name="rotate-left" type="bulk" size="14"></iconsax-icon>restore</button>
            </form>
          </td>
          <td>
            <ConfirmForm
              action="?/purge"
              prompt="Permanently delete {entry.name}? This destroys the git data and cannot be undone."
            >
              <input type="hidden" name="entry" value={entry.entry} />
              <button type="submit" class="small danger"><iconsax-icon name="trash" type="bulk" size="14"></iconsax-icon>delete permanently</button>
            </ConfirmForm>
          </td>
        </tr>
      {:else}
        <tr><td colspan="6" class="empty">nothing deleted</td></tr>
      {/each}
    </tbody>
  </table>
</div>
