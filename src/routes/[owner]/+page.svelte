<!-- src/routes/[owner]/+page.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import IcAdd from "~icons/ic/outline-add";
  import IcInsertDriveFile from "~icons/ic/outline-insert-drive-file";
  import { displayName } from "#lib";
  import Meta from "#lib/components/Meta.svelte";
  import OwnerHead from "#lib/components/OwnerHead.svelte";
  import RepoTable from "#lib/components/RepoTable.svelte";

  let { data } = $props();

  const PREVIEW = 6;

  const name = $derived(data.profile ? displayName(data.profile) : data.owner);
  const preview = $derived(data.repos.slice(0, PREVIEW));
  const profileHref = $derived(`/${data.owner}/${data.profileRepo}`);
</script>

<Meta
  title={name}
  description={data.readme?.summary || `${name} (@${data.owner}) on ${data.site.title}.`}
  image={data.profile?.picture}
  noindex={!data.repos.some((r) => r.isPublic) && !data.readme}
/>

<div class="page">
  <OwnerHead owner={data.owner} profile={data.profile} active="profile" />

  {#if data.readme}
    <article class="readme">{@html data.readme.html}</article>
    {#if data.isOwn}
      <p class="muted"><a href={profileHref}>{data.profileRepo}/{data.readme.path}</a></p>
    {/if}
  {:else if data.isOwn && data.hasProfileRepo}
    <p class="panel muted">
      <a href={profileHref}>{data.profileRepo}</a> has no <code>README.md</code> yet. Push one and it shows up here.
    </p>
  {:else if data.isOwn}
    <form method="post" action="/new?/create" class="panel row">
      <input type="hidden" name="name" value={data.profileRepo} />
      <span class="field-label with-icon"><IcInsertDriveFile class="icon" width="16" height="16" />profile readme</span>
      <span class="muted grow">Create <code>{data.profileRepo}</code> and its README.md shows up here.</span>
      <button type="submit" class="primary"><IcAdd class="icon" width="16" height="16" />create</button>
    </form>
  {/if}

  <h2 class="section-title">Repositories</h2>
  <RepoTable repos={preview} showOwner={false} empty="nothing here yet" />

  {#if data.repos.length > preview.length}
    <p class="muted"><a href="/{data.owner}/+repos">all {data.repos.length} repositories &rarr;</a></p>
  {/if}
</div>
