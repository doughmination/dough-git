<!-- src/routes/[owner]/[name=repo]/tree/[...path]/+page.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import Meta from "#lib/components/Meta.svelte";
  import RepoNav from "#lib/components/RepoNav.svelte";
  import RevPicker from "#lib/components/RevPicker.svelte";

  let { data } = $props();

  const base = $derived(`/${data.owner}/${data.name}`);
  const up = $derived(data.path.split("/").slice(0, -1).join("/"));

  function child(name: string): string {
    return data.path ? `${data.path}/${name}` : name;
  }
</script>

<Meta
  title="{data.owner}/{data.name} tree"
  description="Files in {data.owner}/{data.name}{data.path ? ` at ${data.path}` : ''}."
/>

<div class="page">
  <div class="page-head">
    <p class="eyebrow">tree{data.path ? ` · /${data.path}` : ""}</p>
    <h1>{data.owner}/{data.name}</h1>
  </div>

  <RepoNav owner={data.owner} name={data.name} active="tree" query={data.query} />
  <RevPicker refs={data.refs} rev={data.rev} />

  <div class="table-wrap">
    <table>
      <tbody>
        {#if data.path}
          <tr>
            <td class="mono"></td>
            <td>
              <iconsax-icon name="arrow-up-01" type="bulk" size="14"></iconsax-icon>
              <a href="{base}/tree/{up}{data.query}">../</a>
            </td>
            <td></td>
          </tr>
        {/if}
        {#each data.entries as entry (entry.name)}
          <tr>
            <td class="mono">{entry.mode}</td>
            <td>
              {#if entry.type === "tree"}
                <iconsax-icon name="folder-2" type="bulk" size="14"></iconsax-icon>
                <a href="{base}/tree/{child(entry.name)}{data.query}">{entry.name}/</a>
              {:else}
                <iconsax-icon name="document-text" type="bulk" size="14"></iconsax-icon>
                <a href="{base}/blob/{child(entry.name)}{data.query}">{entry.name}</a>
              {/if}
            </td>
            <td class="mono right">{entry.size}</td>
          </tr>
        {:else}
          <tr><td colspan="3" class="empty">empty</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
