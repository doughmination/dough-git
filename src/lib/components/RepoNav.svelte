<!-- src/lib/components/RepoNav.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import IcCommit from "~icons/ic/outline-commit";
  import IcDescription from "~icons/ic/outline-description";
  import IcFolder from "~icons/ic/outline-folder";
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
      icon: IcDescription,
      href: `${base}${query}`,
    },
    {
      id: "log",
      label: "log",
      icon: IcCommit,
      href: `${base}/log${query}`,
    },
    {
      id: "tree",
      label: "tree",
      icon: IcFolder,
      href: `${base}/tree${query}`,
    },
  ]}
/>
