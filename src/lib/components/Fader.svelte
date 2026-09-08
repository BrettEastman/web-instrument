<script lang="ts">
	// A dB fader (patch: live.gain~, -70..+6 dB) driving a GainNode's
	// AudioParam through the ramp() helper so moves are click-free.
	import { dbToGain, ramp } from '$lib/audio/engine';

	let {
		param,
		label = '',
		initialDb = -6,
		min = -70,
		max = 6
	}: {
		param: AudioParam;
		label?: string;
		initialDb?: number;
		min?: number;
		max?: number;
	} = $props();

	let db = $state(initialDb);

	function onInput(e: Event) {
		db = Number((e.target as HTMLInputElement).value);
		ramp(param, dbToGain(db), 30);
	}
</script>

<label class="fader">
	<span class="label">{label}</span>
	<input type="range" {min} {max} step="0.5" value={db} oninput={onInput} />
	<span class="value">{db <= -70 ? '-inf' : db.toFixed(1)} dB</span>
</label>

<style>
	.fader {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.label {
		font-size: 0.7rem;
		color: var(--dim);
		min-width: 3.5rem;
	}
	input {
		flex: 1;
		accent-color: #90bec6;
	}
	.value {
		font-size: 0.7rem;
		color: var(--dim);
		min-width: 4rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
