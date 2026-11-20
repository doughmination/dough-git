<!-- src/routes/+error.svelte
     LICENCED DASL-1.0 (c) Clove Twilight
-->

<script lang="ts">
  import IcArrowBack from "~icons/ic/outline-arrow-back";
  import { page } from "$app/state";
  import Meta from "#lib/components/Meta.svelte";

  const notFound = $derived(page.status === 404 && !page.error?.title);
  const title = $derived(page.error?.title ?? (notFound ? "not found" : "something went wrong"));
  const message = $derived(notFound ? "There's nothing at that address." : (page.error?.message ?? ""));
</script>

<Meta {title} description={message} noindex />

<div class="page narrow">
  <section class="panel">
    <p class="eyebrow">Error {page.status}</p>
    <h1>{title}</h1>
    <p class="muted">{message}</p>
    <p>
      <a class="btn" href="/"><IcArrowBack class="icon" width="16" height="16" />all repositories</a>
    </p>
  </section>
</div>

<style>
  h1,
  p {
    margin: 0;
  }
</style>
