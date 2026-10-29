<!-- src/routes/[owner]/[name=repo]/log/+page.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import { fmtDate } from "#lib";
  import Meta from "#lib/components/Meta.svelte";
  import RepoNav from "#lib/components/RepoNav.svelte";
  import RevPicker from "#lib/components/RevPicker.svelte";

  let { data } = $props();

  const title = $derived(`${data.owner}/${data.name}`);
</script>

<Meta title="{title} log" description="Commit history for {title} on {data.rev}." />

<div class="page">
  <div class="page-head">
    <p class="eyebrow">log</p>
    <h1>{title}</h1>
  </div>

  <RepoNav owner={data.owner} name={data.name} active="log" query={data.query} />
  <RevPicker refs={data.refs} rev={data.rev} />

  <div class="table-wrap">
    <table>
      <tbody>
        {#each data.commits as commit (commit.hash)}
          <tr>
            <td class="mono">{fmtDate(commit.time)}</td>
            <td>
              <iconsax-icon name="record-circle" type="bulk" size="14"></iconsax-icon>
              <a href="/{data.owner}/{data.name}/commit/{commit.hash}{data.query}">{commit.subject}</a>
            </td>
            <td class="muted">{commit.author}</td>
            <td class="mono">{commit.hash.slice(0, 10)}</td>
          </tr>
        {:else}
          <tr><td class="empty">no commits</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
