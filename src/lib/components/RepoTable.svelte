<!-- src/lib/components/RepoTable.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import { fmtDate } from "#lib";
  import Visibility from "#lib/components/Visibility.svelte";

  type Repo = {
    owner: string;
    name: string;
    description: string;
    isPublic: boolean;
    lastCommit: number | null;
    shared?: boolean;
  };

  let {
    repos,
    showOwner,
    empty,
  }: {
    repos: Repo[];
    showOwner: boolean;
    empty: string;
  } = $props();
</script>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>repository</th>
        <th>description</th>
        <th>visibility</th>
        <th>updated</th>
      </tr>
    </thead>
    <tbody>
      {#each repos as repo (`${repo.owner}/${repo.name}`)}
        <tr>
          <td class="repo-name">
            <iconsax-icon name="hierarchy" type="bulk" size="16"></iconsax-icon>
            {#if showOwner}
              <a class="muted" href="/{repo.owner}">{repo.owner}</a>/{/if}<a href="/{repo.owner}/{repo.name}">{repo.name}</a>
            {#if repo.shared}
              <span class="badge"><iconsax-icon name="people" type="bulk" size="12"></iconsax-icon> shared</span>
            {/if}
          </td>
          <td class="muted">{repo.description}</td>
          <td class="mono"><Visibility isPublic={repo.isPublic} /></td>
          <td class="mono">{fmtDate(repo.lastCommit)}</td>
        </tr>
      {:else}
        <tr>
          <td colspan="4" class="empty">{empty}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .repo-name {
    font-weight: 600;
    white-space: nowrap;
  }

  .repo-name a {
    text-decoration: none;
  }

  .repo-name a:hover {
    color: var(--accent);
  }
</style>
