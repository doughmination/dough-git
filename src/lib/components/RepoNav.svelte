<!-- src/lib/components/RepoNav.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import Tabs from "#lib/components/Tabs.svelte";

  let {
    owner,
    name,
    active,
    query,
  }: {
    owner: string;
    name: string;
    active: "summary" | "log" | "tree";
    query: string;
  } = $props();

  const base = $derived(`/${owner}/${name}`);
</script>

<Tabs
  {active}
  items={[
    {
      id: "summary",
      label: "summary",
      icon: "document-text",
      href: `${base}${query}`,
    },
    {
      id: "log",
      label: "log",
      icon: "record-circle",
      href: `${base}/log${query}`,
    },
    {
      id: "tree",
      label: "tree",
      icon: "folder-2",
      href: `${base}/tree${query}`,
    },
  ]}
/>
