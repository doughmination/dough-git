<!-- src/routes/[owner]/[name=repo]/commit/[sha]/+page.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import IcCommit from "~icons/ic/outline-commit";
  import IcPerson from "~icons/ic/outline-person";
  import IcSchedule from "~icons/ic/outline-schedule";
  import { fmtDate } from "#lib";
  import Meta from "#lib/components/Meta.svelte";
  import RepoNav from "#lib/components/RepoNav.svelte";

  let { data } = $props();

  const commit = $derived(data.commit);
</script>

<Meta
  title={commit.subject}
  description="{commit.subject} — {commit.author} in {data.owner}/{data.name}."
  image={data.ownerPicture}
/>

<div class="page">
  <div class="page-head">
    <p class="eyebrow">commit</p>
    <h1>{commit.subject}</h1>
  </div>

  <RepoNav owner={data.owner} name={data.name} active="log" query={data.query} />

  <dl class="panel commit-meta">
    <dt class="with-icon"><IcCommit class="icon" width="14" height="14" />commit</dt>
    <dd class="mono">{commit.hash}</dd>
    <dt class="with-icon"><IcPerson class="icon" width="14" height="14" />author</dt>
    <dd>{commit.author} &lt;{commit.email}&gt;</dd>
    <dt class="with-icon"><IcSchedule class="icon" width="14" height="14" />date</dt>
    <dd>{fmtDate(commit.time)}</dd>
  </dl>

  {#if commit.body}
    <pre class="code">{commit.body}</pre>
  {/if}
  {#if commit.diffTruncated}
    <p class="muted">This diff is too large to show in full. Clone the repository to read all of it.</p>
  {/if}
  <pre class="code"><code>{commit.diff}</code></pre>
</div>

<style>
  .commit-meta {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.4rem 1.25rem;
    margin: 0;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
</style>
