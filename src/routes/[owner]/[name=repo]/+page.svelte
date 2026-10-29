<!-- src/routes/[owner]/[name=repo]/+page.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import { fmtDate } from "#lib";
  import Meta from "#lib/components/Meta.svelte";
  import RepoNav from "#lib/components/RepoNav.svelte";
  import RevPicker from "#lib/components/RevPicker.svelte";
  import Visibility from "#lib/components/Visibility.svelte";
  import ConfirmForm from "#lib/components/ConfirmForm.svelte";

  let { data } = $props();

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
        <span class="badge accent"><iconsax-icon name="export-arrow-01" type="bulk" size="12"></iconsax-icon> you can push</span>
      {/if}
    </p>
  </div>

  <RepoNav owner={data.owner} name={data.name} active="summary" query={data.query} />

  {#if data.canPush}
    <form method="post" action="?/description" class="panel row">
      <label class="field-label with-icon" for="repo-description">
        <iconsax-icon name="note-2" type="bulk" size="16"></iconsax-icon>description
      </label>
      <input
        id="repo-description"
        type="text"
        name="description"
        maxlength="300"
        value={data.rawDescription}
        placeholder="what this repository is for"
      />
      <button type="submit"><iconsax-icon name="save-2" type="bulk" size="16"></iconsax-icon>save</button>
    </form>
  {:else if data.rawDescription}
    <p class="muted">{data.rawDescription}</p>
  {/if}

  <RevPicker refs={data.refs} rev={data.rev} />

  <section class="panel">
    <span class="field-label with-icon"><iconsax-icon name="import-arrow-01" type="bulk" size="16"></iconsax-icon>clone</span>
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
    <h2 class="section-title"><iconsax-icon name="driver" type="bulk" size="20"></iconsax-icon>External mirrors</h2>

    {#if data.mirrors.length > 0}
      <section class="panel mirrors">
        {#each data.mirrors as mirror (mirror.kind)}
          <div class="mirror-row">
            <a class="with-icon" href={mirror.url} rel="nofollow noopener noreferrer">
              <iconsax-icon name="global" type="bulk" size="16"></iconsax-icon>{mirror.slug}
            </a>
            <span class="{mirror.cls} with-icon">
              <iconsax-icon name={mirror.glyph} type="bulk" size="16"></iconsax-icon>{mirror.label}
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
            <span class="with-icon"><iconsax-icon name="home-2" type="bulk" size="16"></iconsax-icon>local</span>
            <span class="empty">this repository</span>
            <span class="mono">{data.localSha.slice(0, 7)}</span>
            <span></span>
          </div>
        {/if}

        {#if data.canCheckMirrors}
          <form method="post" action="?/check">
            <button type="submit"><iconsax-icon name="refresh-arrow-01" type="bulk" size="16"></iconsax-icon>check now</button>
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
              <iconsax-icon name="global" type="bulk" size="16"></iconsax-icon>{mirror.kind}
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
          <button type="submit"><iconsax-icon name="save-2" type="bulk" size="16"></iconsax-icon>save mirrors</button>
        </div>
      </form>
    {/if}
  {/if}

  {#if data.readme}
    <h2 class="section-title"><iconsax-icon name="document-text" type="bulk" size="20"></iconsax-icon>{data.readme.path}</h2>
    <article class="readme">{@html data.readme.html}</article>
  {:else if !data.empty}
    <h2 class="section-title"><iconsax-icon name="document-text" type="bulk" size="20"></iconsax-icon>Readme</h2>
    <p class="empty">No ReadMe was found, commit one to add a summary</p>
  {/if}

  {#if data.isOwner && data.collaborators}
    <h2 class="section-title"><iconsax-icon name="setting-2" type="bulk" size="20"></iconsax-icon>Manage</h2>
    <div class="buttons">
      <form method="post" action="?/visibility">
        <input type="hidden" name="public" value={data.isPublic ? "" : "on"} />
        <button type="submit">
          <iconsax-icon name={data.isPublic ? "lock" : "unlock"} type="bulk" size="16"></iconsax-icon>
          make {data.isPublic ? "private" : "public"}
        </button>
      </form>
      <ConfirmForm action="?/delete" prompt="Delete {title}? It moves to Recently Deleted.">
        <button type="submit" class="danger"><iconsax-icon name="trash" type="bulk" size="16"></iconsax-icon>delete repository</button>
      </ConfirmForm>
    </div>

    <h2 class="section-title"><iconsax-icon name="people" type="bulk" size="20"></iconsax-icon>Collaborators</h2>
    <p class="muted">
      People here can see this repository even while it is private. <code>write</code> also lets them push to it.
    </p>
    <form method="post" action="?/collaborator" class="panel row">
      <label class="field-label with-icon" for="collab-slug"><iconsax-icon name="user" type="bulk" size="16"></iconsax-icon>username</label>
      <input id="collab-slug" type="text" name="slug" placeholder="their handle" pattern="[A-Za-z0-9._\-]+" required />
      <select name="level" aria-label="access level">
        <option value="read">read</option>
        <option value="write">write</option>
      </select>
      <button type="submit"><iconsax-icon name="user-add" type="bulk" size="16"></iconsax-icon>add</button>
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
              <td><iconsax-icon name="user" type="bulk" size="14"></iconsax-icon> <a href="/{person.slug}">{person.slug}</a></td>
              <td class="mono">{person.level}</td>
              <td class="mono">{fmtDate(person.added_at)}</td>
              <td>
                <form method="post" action="?/uncollaborate">
                  <input type="hidden" name="slug" value={person.slug} />
                  <button type="submit" class="small"><iconsax-icon name="user-minus" type="bulk" size="14"></iconsax-icon>remove</button>
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
