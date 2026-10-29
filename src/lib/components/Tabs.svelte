<!-- src/lib/components/Tabs.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  type Tab = {
    id: string;
    label: string;
    icon: string;
    href: string;
  };

  let { active, items }: { active: string; items: Tab[] } = $props();
</script>

<nav class="tabs">
  {#each items as tab (tab.id)}
    <a class="tab" class:active={tab.id === active} href={tab.href}>
      <iconsax-icon name={tab.icon} type="bulk" size="18"></iconsax-icon>{tab.label}
    </a>
  {/each}
</nav>

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.25rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--raised);
    align-self: flex-start;
  }

  .tab {
    display: inline-flex;
    gap: 0.4em;
    align-items: center;
    padding: 0.3rem 0.9rem;
    border-radius: 999px;
    color: var(--muted);
    font-size: 0.9rem;
    text-decoration: none;
  }

  .tab:hover {
    color: var(--text);
  }

  .active {
    background: var(--accent-dim);
    color: var(--accent);
  }
</style>
