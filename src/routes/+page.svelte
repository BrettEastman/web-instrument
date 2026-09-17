<script lang="ts">
	import { initEngine, type MasterChain } from '$lib/audio/engine';
	import { startTestTone, startRiverPlaceholder, type Voice } from '$lib/audio/sources';
	import { enableMic, type MicInput } from '$lib/audio/mic';
	import { ramp } from '$lib/audio/engine';
	import { Looper } from '$lib/audio/looper';
	import { Granular } from '$lib/audio/granular';
	import { CueEngine } from '$lib/audio/cues';
	import { buildDemoScore } from '$lib/audio/score';
	import Meter from '$lib/components/Meter.svelte';
	import Fader from '$lib/components/Fader.svelte';
	import LooperUnit from '$lib/components/LooperUnit.svelte';
	import GranularUnit from '$lib/components/GranularUnit.svelte';
	import CueDisplay from '$lib/components/CueDisplay.svelte';
	import FxPanel from '$lib/components/FxPanel.svelte';

	const LOOPER_COUNT = 3;

	let master = $state<MasterChain | null>(null);
	let tone = $state<Voice | null>(null);
	let river = $state<Voice | null>(null);
	let mic = $state<MicInput | null>(null);
	let micError = $state('');
	let loopers = $state.raw<Looper[]>([]);
	let granular = $state.raw<Granular | null>(null);
	let cueEngine = $state.raw<CueEngine | null>(null);

	// Environment layer for the score: the river placeholder, faded by cues.
	function envUp(ms: number) {
		if (!river) river = startRiverPlaceholder();
		ramp(river.gain.gain, 0.5, ms);
	}
	function envDown(ms: number) {
		if (river) ramp(river.gain.gain, 0, ms);
	}

	// Score keys (patch: keyboard cues, «Press "0" to go back to zero»).
	$effect(() => {
		if (!cueEngine) return;
		const engine = cueEngine;
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement | null;
			if (t && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(t.tagName)) return;
			if (e.code === 'Space' || e.key === 'ArrowRight') {
				e.preventDefault();
				engine.next();
			} else if (e.key === 'ArrowLeft') {
				engine.prev();
			} else if (e.key === '0') {
				engine.reset();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	async function begin() {
		master = await initEngine();
	}

	function toggleTone() {
		if (tone) {
			tone.stop();
			tone = null;
		} else {
			tone = startTestTone();
		}
	}

	function toggleRiver() {
		if (river) {
			river.stop();
			river = null;
		} else {
			river = startRiverPlaceholder();
		}
	}

	async function onEnableMic() {
		micError = '';
		try {
			mic = await enableMic();
			// Different max lengths per looper, echoing the patch's
			// 2555 / 4555 / 9555 ms buffers giving each loop its own scale.
			const lengths = [4, 8, 12];
			loopers = Array.from({ length: LOOPER_COUNT }, (_, i) => new Looper(mic!.source, lengths[i]));
			// The patch's grainrecord1 buffer was 25 s; same here.
			granular = new Granular(mic.source, 25);
			cueEngine = new CueEngine(buildDemoScore({ loopers, granular, env: { up: envUp, down: envDown } }));
		} catch (e) {
			micError = e instanceof Error ? e.message : String(e);
		}
	}
</script>

<main>
	<h1>web instrument</h1>
	<p class="sub">a browser descendant of the pulse-flute Max patch — milestone 7</p>

	{#if !master}
		<button class="begin" onclick={begin}>Begin</button>
		<p class="hint">browsers only start audio after a click — this is our ezdac~ toggle</p>
	{:else}
		<section>
			<h2>master</h2>
			<Fader param={master.masterGain.gain} label="out" initialDb={-6} />
			<Meter analyser={master.analyser} label="main" />
		</section>

		<FxPanel fx={master.fx} />

		<section>
			<h2>sources</h2>
			<div class="row">
				<button onclick={toggleTone}>{tone ? 'stop tone' : 'test tone'}</button>
				<button onclick={toggleRiver}>{river ? 'stop river' : 'river (placeholder)'}</button>
			</div>
			{#if river}
				<Fader param={river.gain.gain} label="river" initialDb={-6} />
			{/if}
		</section>

		<section>
			<h2>mic</h2>
			{#if !mic}
				<div class="row"><button onclick={onEnableMic}>enable mic</button></div>
				{#if micError}<p class="error">{micError}</p>{/if}
			{:else}
				<Meter analyser={mic.analyser} label="input" />
				<Fader param={mic.monitorGain.gain} label="monitor" initialDb={-70} />
				<p class="hint">monitor is muted by default — headphones recommended before raising it</p>
			{/if}
		</section>

		{#if cueEngine}
			<CueDisplay engine={cueEngine} />
		{/if}

		{#each loopers as looper, i (i)}
			<LooperUnit {looper} index={i} />
		{/each}

		{#if granular}
			<GranularUnit {granular} />
		{/if}
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		background: #0e1216;
		color: #e8e6e3;
		font-family: system-ui, sans-serif;
		--dim: #8b98a0;
	}
	main {
		max-width: 640px;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	h1 {
		font-size: 1.4rem;
		font-weight: 600;
		margin: 0;
		letter-spacing: 0.02em;
	}
	h2 {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--dim);
		margin: 0 0 0.75rem;
	}
	.sub {
		color: var(--dim);
		margin: -0.75rem 0 0;
		font-size: 0.85rem;
	}
	section {
		background: #151b21;
		border: 1px solid #222b33;
		border-radius: 10px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	button {
		background: #223039;
		color: #e8e6e3;
		border: 1px solid #33454f;
		border-radius: 7px;
		padding: 0.45rem 0.9rem;
		font-size: 0.85rem;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		background: #2b3d48;
	}
	.begin {
		align-self: flex-start;
		font-size: 1.1rem;
		padding: 0.8rem 2.2rem;
		background: #2c4a45;
		border-color: #4a9d8f;
	}
	.hint {
		color: var(--dim);
		font-size: 0.75rem;
		margin: 0;
	}
	.error {
		color: #d1495b;
		font-size: 0.8rem;
	}
</style>
