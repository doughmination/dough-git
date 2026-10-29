<!-- src/lib/components/RevPicker.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  type Refs = {
    branches: string[];
    tags: string[];
  };

  let { refs, rev }: { refs: Refs; rev: string } = $props();

  const all = $derived([...refs.branches, ...refs.tags]);
  const shown = $derived(all.length > 0 && !(all.length < 2 && all.includes(rev)));
  const detached = $derived(!all.includes(rev));
</script>

{#if shown}
  <form method="get" class="rev-picker">
    <label class="field-label with-icon" for="rev-picker">
      <iconsax-icon name="hierarchy" type="bulk" size="16"></iconsax-icon>revision
    </label>
    <!-- Picking a revision is the whole form; the button stays for no-JS -->
    <select id="rev-picker" name="h" value={rev} onchange={(event) => event.currentTarget.form?.submit()}>
      {#if detached}
        <option value={rev}>{rev.slice(0, 10)}</option>
      {/if}
      {#if refs.branches.length}
        <optgroup label="branches">
          {#each refs.branches as name (name)}
            <option value={name}>{name}</option>
          {/each}
        </optgroup>
      {/if}
      {#if refs.tags.length}
        <optgroup label="tags">
          {#each refs.tags as name (name)}
            <option value={name}>{name}</option>
          {/each}
        </optgroup>
      {/if}
    </select>
    <button type="submit"><iconsax-icon name="arrow-right-01" type="bulk" size="16"></iconsax-icon>go</button>
  </form>
{/if}

<style>
  .rev-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
  }

  select {
    width: auto;
    min-width: 12rem;
  }
</style>
