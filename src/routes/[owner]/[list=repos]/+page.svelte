<!-- src/routes/[owner]/[list=repos]/+page.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import { displayName } from "#lib";
  import Meta from "#lib/components/Meta.svelte";
  import OwnerHead from "#lib/components/OwnerHead.svelte";
  import RepoTable from "#lib/components/RepoTable.svelte";

  let { data } = $props();

  const name = $derived(data.profile ? displayName(data.profile) : data.owner);
</script>

<Meta
  title="{name} repositories"
  description="Repositories owned by {name} (@{data.owner}) on {data.site.title}."
  noindex={!data.repos.some((r) => r.isPublic)}
/>

<div class="page">
  <OwnerHead owner={data.owner} profile={data.profile} active="repos" />

  <h2 class="section-title">Repositories</h2>
  <RepoTable repos={data.repos} showOwner={false} empty="nothing here yet" />
</div>
