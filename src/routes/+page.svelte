<!-- src/routes/+page.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import Meta from "#lib/components/Meta.svelte";
  import RepoTable from "#lib/components/RepoTable.svelte";

  let { data } = $props();
</script>

<Meta title={data.site.title} />

<div class="page">
  <div class="page-head">
    <p class="eyebrow">git mirror</p>
    <h1>Repositories</h1>
  </div>

  <RepoTable repos={data.repos} showOwner empty="no repositories visible" />
</div>
