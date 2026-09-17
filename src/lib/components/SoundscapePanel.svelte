<script lang="ts">
	// The [nodes] pad: five environment zones at the patch's own coordinates,
	// a draggable puck mixing them by proximity, and a "follow pulse" mode
	// where the heartbeat steers the puck through the landscape.
	import { Soundscape, SOUNDSCAPE_NODES, positionForBpm } from '$lib/audio/soundscape';
	import { pulseState } from '$lib/stores/pulse-state.svelte';
	import Meter from './Meter.svelte';
	import Fader from './Fader.svelte';

	let {
		soundscape,
		oncreate
	}: { soundscape: Soundscape | null; oncreate: () => void } = $props();

	let padEl = $state<HTMLDivElement | null>(null);
	let pos = $state({ x: 0.5, y: 0.5 });
	let weights = $state<number[]>([0, 0, 0, 0, 0]);
	let dragging = $state(false);
	let followPulse = $state(false);

	// Mirror engine weights + drive follow-pulse easing on one light clock.
	$effect(() => {
		if (!soundscape) return;
		const sc = soundscape;
		const id = setInterval(() => {
			weights = [...sc.weights];
			if (followPulse && !dragging) {
				const target = positionForBpm(pulseState.bpm);
				// Ease toward the target — the puck drifts, never teleports.
				const x = pos.x + (target.x - pos.x) * 0.12;
				const y = pos.y + (target.y - pos.y) * 0.12;
				pos = { x, y };
				sc.setPosition(x, y, 150);
			}
		}, 120);
		return () => clearInterval(id);
	});

	function positionFromEvent(e: PointerEvent): { x: number; y: number } {
		const rect = padEl!.getBoundingClientRect();
		return {
			x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
			y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
		};
	}

	function onDown(e: PointerEvent) {
		if (!soundscape || !padEl) return;
		dragging = true;
		followPulse = false; // a hand on the pad overrides the heart
		padEl.setPointerCapture(e.pointerId);
		movePuck(e);
	}

	function onMove(e: PointerEvent) {
		if (dragging) movePuck(e);
	}

	function onUp() {
		dragging = false;
	}

	function movePuck(e: PointerEvent) {
		pos = positionFromEvent(e);
		soundscape?.setPosition(pos.x, pos.y, 100);
	}
</script>

<section>
	<h2>soundscape · nodes</h2>

	{#if !soundscape}
		<div class="row">
			<button class="create" onclick={oncreate}>start environments</button>
			<span class="hint">five placeholder layers until real recordings arrive</span>
		</div>
	{:else}
		<div
			class="pad"
			bind:this={padEl}
			role="application"
			aria-label="soundscape mix position — drag to move between environments"
			onpointerdown={onDown}
			onpointermove={onMove}
			onpointerup={onUp}
		>
			{#each SOUNDSCAPE_NODES as node, i (node.name)}
				<div
					class="node"
					style:left="{node.x * 100}%"
					style:top="{node.y * 100}%"
					style:width="{node.radius * 100}%"
					style:opacity={0.25 + weights[i] * 0.75}
				>
					<span>{node.name}</span>
				</div>
			{/each}
			<div class="puck" class:pulse-driven={followPulse} style:left="{pos.x * 100}%" style:top="{pos.y * 100}%"></div>
		</div>

		<div class="row">
			<label class="follow">
				<input type="checkbox" bind:checked={followPulse} />
				follow pulse ({pulseState.bpm} bpm)
			</label>
		</div>

		<Fader param={soundscape.masterGain.gain} label="level" initialDb={-4.4} />
		<Meter analyser={soundscape.analyser} label="out" />
	{/if}
</section>

<style>
	section {
		background: #121a15;
		border: 1px solid #22382c;
		border-radius: 10px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	h2 {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--dim);
		margin: 0;
	}
	.row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}
	button {
		background: #1c2c22;
		color: #e8e6e3;
		border: 1px solid #2e4a38;
		border-radius: 7px;
		padding: 0.45rem 0.9rem;
		font-size: 0.85rem;
		cursor: pointer;
	}
	button:hover {
		background: #24382c;
	}
	.create {
		border-color: #4a9d6f;
	}
	.pad {
		position: relative;
		width: 100%;
		aspect-ratio: 1.6;
		background: #0c120e;
		border: 1px solid #22382c;
		border-radius: 10px;
		overflow: hidden;
		touch-action: none;
		cursor: crosshair;
	}
	.node {
		position: absolute;
		transform: translate(-50%, -50%);
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(122, 186, 141, 0.35), rgba(122, 186, 141, 0.05) 70%);
		border: 1px solid rgba(122, 186, 141, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		transition: opacity 150ms linear;
	}
	.node span {
		font-size: 0.65rem;
		color: #cfe6d5;
		text-align: center;
		text-shadow: 0 1px 2px #000;
	}
	.puck {
		position: absolute;
		transform: translate(-50%, -50%);
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #e8e6e3;
		box-shadow: 0 0 10px rgba(232, 230, 227, 0.6);
		pointer-events: none;
	}
	.puck.pulse-driven {
		background: #d1748f;
		box-shadow: 0 0 12px rgba(209, 116, 143, 0.8);
	}
	.follow {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		color: var(--dim);
	}
	.follow input {
		accent-color: #d1748f;
	}
	.hint {
		color: var(--dim);
		font-size: 0.72rem;
	}
</style>
