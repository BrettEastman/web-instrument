<script lang="ts">
	// The on-stage score display: big section counter (the patch's giant
	// teal number box), section name, elapsed clock, and the cue sheet with
	// fired / pending status per step.
	import type { CueEngine, StepStatus } from '$lib/audio/cues';

	let { engine }: { engine: CueEngine } = $props();

	let current = $state(0);
	let name = $state('');
	let elapsed = $state(0);
	let steps = $state<StepStatus[]>([]);

	$effect(() => {
		const id = setInterval(() => {
			current = engine.current;
			name = engine.section.name;
			elapsed = engine.elapsedMs;
			steps = engine.status();
		}, 120);
		return () => clearInterval(id);
	});
</script>

<section>
	<div class="head">
		<div class="counter">{current}</div>
		<div class="titles">
			<h2>score</h2>
			<div class="name">{name}</div>
			<div class="clock">{(elapsed / 1000).toFixed(1)} s</div>
		</div>
		<div class="transport">
			<button onclick={() => engine.prev()} disabled={current === 0}>‹ prev</button>
			<button class="go" onclick={() => engine.next()} disabled={current >= engine.sections.length - 1}>
				next ›
			</button>
			<button onclick={() => engine.reset()}>0</button>
		</div>
	</div>

	<ul class="cues">
		{#each steps as step (step.description)}
			<li class:fired={step.fired}>
				<span class="dot">{step.fired ? '●' : '○'}</span>
				<span class="at">{(step.atMs / 1000).toFixed(1)}s</span>
				<span class="desc">{step.description}</span>
				{#if !step.fired && step.atMs > elapsed}
					<span class="countdown">in {((step.atMs - elapsed) / 1000).toFixed(1)}s</span>
				{/if}
			</li>
		{/each}
	</ul>

	<p class="hint">keys: space / → next · ← prev · 0 reset</p>
</section>

<style>
	section {
		background: #10181a;
		border: 1px solid #1f3a35;
		border-radius: 10px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.counter {
		font-size: 3.4rem;
		font-weight: 700;
		line-height: 1;
		color: #90bec6; /* the patch's teal number box */
		font-variant-numeric: tabular-nums;
		min-width: 3.2rem;
		text-align: center;
	}
	.titles {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	h2 {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--dim);
		margin: 0;
	}
	.name {
		font-size: 1.05rem;
		font-weight: 600;
	}
	.clock {
		font-size: 0.75rem;
		color: var(--dim);
		font-variant-numeric: tabular-nums;
	}
	.transport {
		display: flex;
		gap: 0.4rem;
	}
	button {
		background: #223039;
		color: #e8e6e3;
		border: 1px solid #33454f;
		border-radius: 7px;
		padding: 0.45rem 0.8rem;
		font-size: 0.85rem;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		background: #2b3d48;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.go {
		background: #2c4a45;
		border-color: #4a9d8f;
	}
	.cues {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--dim);
	}
	li.fired {
		color: #e8e6e3;
	}
	.dot {
		color: #4a9d8f;
		font-size: 0.7rem;
	}
	.at {
		font-variant-numeric: tabular-nums;
		min-width: 2.6rem;
		text-align: right;
		font-size: 0.75rem;
	}
	.desc {
		flex: 1;
	}
	.countdown {
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		color: #e2b04a;
	}
	.hint {
		color: var(--dim);
		font-size: 0.72rem;
		margin: 0;
	}
</style>
