<!-- src/lib/components/ConfirmForm.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import type { Snippet } from "svelte";

  // A POST form that asks first. Without scripting it just submits
  let {
    action,
    prompt,
    children,
  }: {
    action: string;
    prompt: string;
    children: Snippet;
  } = $props();

  function onsubmit(event: SubmitEvent) {
    if (!window.confirm(prompt)) event.preventDefault();
  }
</script>

<form method="post" {action} {onsubmit}>
  {@render children()}
</form>
