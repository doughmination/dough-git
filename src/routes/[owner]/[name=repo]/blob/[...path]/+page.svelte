<!-- src/routes/[owner]/[name=repo]/blob/[...path]/+page.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import { fmtBytes } from "#lib";
  import Meta from "#lib/components/Meta.svelte";
  import RepoNav from "#lib/components/RepoNav.svelte";

  let { data } = $props();

  const up = $derived(data.path.split("/").slice(0, -1).join("/"));
  const size = $derived(fmtBytes(data.bytes));
</script>

<Meta title={data.path} description="{data.path} in {data.owner}/{data.name}." />

<div class="page">
  <div class="page-head">
    <p class="eyebrow">{data.owner}/{data.name}</p>
    <h1 class="path">{data.path}</h1>
  </div>

  <RepoNav owner={data.owner} name={data.name} active="tree" query={data.query} />

  <p class="muted">
    <a class="with-icon" href="/{data.owner}/{data.name}/tree/{up}{data.query}">
      <iconsax-icon name="arrow-left-01" type="bulk" size="16"></iconsax-icon>back to {up || "tree"}
    </a>
  </p>

  {#if data.binary}
    <p class="muted">binary file not shown ({size})</p>
  {:else}
    {#if data.truncated}
      <p class="muted">Showing the first part of a {size} file. Clone the repository to read all of it.</p>
    {/if}
    <pre class="code"><code>{data.text}</code></pre>
  {/if}
</div>

<style>
  .path {
    font-size: clamp(1.4rem, 4vw, 2rem);
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
  }
</style>
