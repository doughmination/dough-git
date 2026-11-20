<!-- src/routes/[owner]/[name=repo]/+page.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import type { Component } from "svelte";
  import IcArrowDownward from "~icons/ic/outline-arrow-downward";
  import IcArrowUpward from "~icons/ic/outline-arrow-upward";
  import IcCancel from "~icons/ic/outline-cancel";
  import IcCheckCircle from "~icons/ic/outline-check-circle";
  import IcDelete from "~icons/ic/outline-delete";
  import IcDescription from "~icons/ic/outline-description";
  import IcDownload from "~icons/ic/outline-download";
  import IcHelpOutline from "~icons/ic/outline-help-outline";
  import IcHome from "~icons/ic/outline-home";
  import IcLock from "~icons/ic/outline-lock";
  import IcLockOpen from "~icons/ic/outline-lock-open";
  import IcOpenInNew from "~icons/ic/outline-open-in-new";
  import IcPeople from "~icons/ic/outline-people";
  import IcPerson from "~icons/ic/outline-person";
  import IcPersonAdd from "~icons/ic/outline-person-add";
  import IcPersonRemove from "~icons/ic/outline-person-remove";
  import IcPublic from "~icons/ic/outline-public";
  import IcRefresh from "~icons/ic/outline-refresh";
  import IcSave from "~icons/ic/outline-save";
  import IcSettings from "~icons/ic/outline-settings";
  import IcStickyNote2 from "~icons/ic/outline-sticky-note-2";
  import IcStorage from "~icons/ic/outline-storage";
  import IcWarning from "~icons/ic/outline-warning";
  import { fmtDate } from "#lib";
  import Meta from "#lib/components/Meta.svelte";
  import RepoNav from "#lib/components/RepoNav.svelte";
  import RevPicker from "#lib/components/RevPicker.svelte";
  import Visibility from "#lib/components/Visibility.svelte";
  import ConfirmForm from "#lib/components/ConfirmForm.svelte";

  let { data } = $props();

  // The glyph names src/lib/server/mirrorview.ts hands out
  const MIRROR_GLYPHS: Record<string, Component> = {
    "check-circle": IcCheckCircle,
    "arrow-upward": IcArrowUpward,
    "arrow-downward": IcArrowDownward,
    warning: IcWarning,
    lock: IcLock,
    cancel: IcCancel,
    "help-outline": IcHelpOutline,
  };

  const title = $derived(`${data.owner}/${data.name}`);
</script>

<Meta {title} description={data.metaDescription} noindex={!data.isPublic} />

<div class="page">
  <div class="page-head">
    <p class="eyebrow">repository</p>
    <h1><a class="owner" href="/{data.owner}">{data.owner}</a>/{data.name}</h1>
    <p class="muted meta">
      <Visibility isPublic={data.isPublic} />
      {#if data.canPush && !data.isOwner}
        <span class="badge accent"><IcOpenInNew class="icon" width="12" height="12" /> you can push</span>
      {/if}
    </p>
  </div>

  <RepoNav owner={data.owner} name={data.name} active="summary" query={data.query} />

  {#if data.canPush}
    <form method="post" action="?/description" class="panel row">
      <label class="field-label with-icon" for="repo-description">
        <IcStickyNote2 class="icon" width="16" height="16" />description
      </label>
      <input
        id="repo-description"
        type="text"
        name="description"
        maxlength="300"
        value={data.rawDescription}
        placeholder="what this repository is for"
      />
      <button type="submit"><IcSave class="icon" width="16" height="16" />save</button>
    </form>
  {:else if data.rawDescription}
    <p class="muted">{data.rawDescription}</p>
  {/if}

  <RevPicker refs={data.refs} rev={data.rev} />

  <section class="panel">
    <span class="field-label with-icon"><IcDownload class="icon" width="16" height="16" />clone</span>
    <code>git clone {data.cloneUrl}</code>
  </section>

  {#if data.empty && data.canPush}
    <section class="panel">
      <p><strong>This repository is empty.</strong> Push to get started:</p>
      <pre class="code"><code>git remote add mirror {data.cloneUrl}
git push --mirror mirror</code></pre>
      <p class="muted">
        When prompted, the <strong>username</strong> is <code>{data.pusher}</code> and the
        <strong>password</strong> is a token from <a href="/settings/tokens">settings</a>.
      </p>
    </section>
  {:else if data.empty}
    <p class="panel empty">This repository is empty.</p>
  {/if}

  {#if data.mirrors.length > 0 || data.isOwner}
    <h2 class="section-title"><IcStorage class="icon" width="20" height="20" />External mirrors</h2>

    {#if data.mirrors.length > 0}
      <section class="panel mirrors">
        {#each data.mirrors as mirror (mirror.kind)}
          {@const Glyph = MIRROR_GLYPHS[mirror.glyph] ?? IcHelpOutline}
          <div class="mirror-row">
            <a class="with-icon" href={mirror.url} rel="nofollow noopener noreferrer">
              <IcPublic class="icon" width="16" height="16" />{mirror.slug}
            </a>
            <span class="{mirror.cls} with-icon">
              <Glyph class="icon" width="16" height="16" />{mirror.label}
            </span>
            <span class="mono">{mirror.sha}</span>
            <span class="muted">{mirror.detail}</span>
          </div>
          {#if mirror.note}
            <p class={mirror.noteCls}>{mirror.note}</p>
          {/if}
        {/each}

        {#if data.localSha}
          <div class="mirror-row">
            <span class="with-icon"><IcHome class="icon" width="16" height="16" />local</span>
            <span class="empty">this repository</span>
            <span class="mono">{data.localSha.slice(0, 7)}</span>
            <span></span>
          </div>
        {/if}

        {#if data.canCheckMirrors}
          <form method="post" action="?/check">
            <button type="submit"><IcRefresh class="icon" width="16" height="16" />check now</button>
          </form>
        {/if}
      </section>
    {:else}
      <p class="empty">No mirrors configured.</p>
    {/if}

    {#if data.isOwner}
      <form method="post" action="?/mirrors" class="panel">
        {#each data.mirrorFields as mirror (mirror.kind)}
          <div class="row">
            <label class="field-label with-icon" for="mirror-{mirror.kind}">
              <IcPublic class="icon" width="16" height="16" />{mirror.kind}
            </label>
            <input
              id="mirror-{mirror.kind}"
              type="text"
              name={mirror.kind}
              value={mirror.value}
              placeholder="user/repo"
              pattern={"[^\\s/]+/[^\\s/]+/?"}
              autocapitalize="off"
              spellcheck="false"
            />
            <label class="check">
              <input type="checkbox" name="{mirror.kind}_private" checked={mirror.isPrivate} /> private
            </label>
          </div>
        {/each}
        <p class="muted small">
          Give the <code>user/repo</code> on {data.mirrorHosts} — not a full URL. Mark a mirror <em>private</em> to
          skip status checks — they are anonymous, so a private mirror would otherwise always look unreachable.
          Clear a field to remove it.
        </p>
        <div>
          <button type="submit"><IcSave class="icon" width="16" height="16" />save mirrors</button>
        </div>
      </form>
    {/if}
  {/if}

  {#if data.readme}
    <h2 class="section-title"><IcDescription class="icon" width="20" height="20" />{data.readme.path}</h2>
    <article class="readme">{@html data.readme.html}</article>
  {:else if !data.empty}
    <h2 class="section-title"><IcDescription class="icon" width="20" height="20" />Readme</h2>
    <p class="empty">No ReadMe was found, commit one to add a summary</p>
  {/if}

  {#if data.isOwner && data.collaborators}
    <h2 class="section-title"><IcSettings class="icon" width="20" height="20" />Manage</h2>
    <div class="buttons">
      <form method="post" action="?/visibility">
        <input type="hidden" name="public" value={data.isPublic ? "" : "on"} />
        <button type="submit">
          {#if data.isPublic}
            <IcLock class="icon" width="16" height="16" />
          {:else}
            <IcLockOpen class="icon" width="16" height="16" />
          {/if}
          make {data.isPublic ? "private" : "public"}
        </button>
      </form>
      <ConfirmForm action="?/delete" prompt="Delete {title}? It moves to Recently Deleted.">
        <button type="submit" class="danger"><IcDelete class="icon" width="16" height="16" />delete repository</button>
      </ConfirmForm>
    </div>

    <h2 class="section-title"><IcPeople class="icon" width="20" height="20" />Collaborators</h2>
    <p class="muted">
      People here can see this repository even while it is private. <code>write</code> also lets them push to it.
    </p>
    <form method="post" action="?/collaborator" class="panel row">
      <label class="field-label with-icon" for="collab-slug"><IcPerson class="icon" width="16" height="16" />username</label>
      <input id="collab-slug" type="text" name="slug" placeholder="their handle" pattern="[A-Za-z0-9._\-]+" required />
      <select name="level" aria-label="access level">
        <option value="read">read</option>
        <option value="write">write</option>
      </select>
      <button type="submit"><IcPersonAdd class="icon" width="16" height="16" />add</button>
    </form>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>user</th>
            <th>access</th>
            <th>added</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each data.collaborators as person (person.slug)}
            <tr>
              <td><IcPerson class="icon" width="14" height="14" /> <a href="/{person.slug}">{person.slug}</a></td>
              <td class="mono">{person.level}</td>
              <td class="mono">{fmtDate(person.added_at)}</td>
              <td>
                <form method="post" action="?/uncollaborate">
                  <input type="hidden" name="slug" value={person.slug} />
                  <button type="submit" class="small"><IcPersonRemove class="icon" width="14" height="14" />remove</button>
                </form>
              </td>
            </tr>
          {:else}
            <tr><td colspan="4" class="empty">nobody else has access</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .owner {
    color: var(--muted);
    text-decoration: none;
  }

  .mirrors {
    gap: 0.5rem;
  }

  .mirror-row {
    display: grid;
    grid-template-columns: minmax(10rem, 1.2fr) minmax(9rem, 1fr) 5rem 2fr;
    gap: 0.75rem;
    align-items: center;
  }

  .mirrors p {
    margin: 0;
  }

  @media (max-width: 40rem) {
    .mirror-row {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
