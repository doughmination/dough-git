<!-- src/routes/settings/moderation/+page.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import IcHistory from "~icons/ic/outline-history";
  import IcPerson from "~icons/ic/outline-person";
  import IcPersonAdd from "~icons/ic/outline-person-add";
  import IcPersonRemove from "~icons/ic/outline-person-remove";
  import IcShield from "~icons/ic/outline-shield";
  import { fmtDate } from "#lib";
  import Meta from "#lib/components/Meta.svelte";
  import RoleBadge from "#lib/components/RoleBadge.svelte";

  let { data } = $props();
</script>

<Meta title="moderation" description="Manage site moderators." noindex />

<h2 class="section-title"><IcShield class="icon" width="20" height="20" />Moderators</h2>
<p class="muted">
  Moderators get a <RoleBadge role="mod" /> badge everywhere their name shows. You, <code>{data.owner}</code>, always
  carry <RoleBadge role="owner" />.
</p>

<form method="post" action="?/add" class="panel row">
  <label class="field-label with-icon" for="mod-slug"><IcPerson class="icon" width="16" height="16" />username</label>
  <input id="mod-slug" type="text" name="slug" placeholder="their handle" pattern="[A-Za-z0-9._\-]+" required />
  <button type="submit"><IcPersonAdd class="icon" width="16" height="16" />add moderator</button>
</form>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>user</th>
        <th>added</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each data.mods as mod (mod.slug)}
        <tr>
          <td><IcPerson class="icon" width="14" height="14" /> <a href="/{mod.slug}">{mod.slug}</a></td>
          <td class="mono">{fmtDate(mod.added_at)}</td>
          <td>
            <form method="post" action="?/remove">
              <input type="hidden" name="slug" value={mod.slug} />
              <button type="submit" class="small"><IcPersonRemove class="icon" width="14" height="14" />remove</button>
            </form>
          </td>
        </tr>
      {:else}
        <tr><td colspan="3" class="empty">no moderators yet</td></tr>
      {/each}
    </tbody>
  </table>
</div>

<h2 class="section-title"><IcHistory class="icon" width="20" height="20" />Log</h2>
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>when</th>
        <th>who</th>
        <th>what</th>
      </tr>
    </thead>
    <tbody>
      {#each data.log as entry (entry.id)}
        <tr>
          <td class="mono">{fmtDate(entry.at)}</td>
          <td><a href="/{entry.actor}">{entry.actor}</a></td>
          <td>{entry.action} <a href="/{entry.target}">{entry.target}</a></td>
        </tr>
      {:else}
        <tr><td colspan="3" class="empty">nothing logged yet</td></tr>
      {/each}
    </tbody>
  </table>
</div>
