<script lang="ts">
	// Draw a recorded buffer's waveform on a canvas (patch: waveform~).
	let { samples }: { samples: Float32Array | null } = $props();

	let canvas: HTMLCanvasElement;

	$effect(() => {
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		const g = canvas.getContext('2d')!;
		g.scale(dpr, dpr);
		g.clearRect(0, 0, w, h);
		g.fillStyle = '#141a1f';
		g.fillRect(0, 0, w, h);
		if (!samples || samples.length === 0) return;

		g.strokeStyle = '#90bec6';
		g.lineWidth = 1;
		g.beginPath();
		const step = Math.max(1, Math.floor(samples.length / w));
		for (let x = 0; x < w; x++) {
			// min/max per pixel column for a filled-looking waveform
			let lo = 1,
				hi = -1;
			const start = x * step;
			for (let i = start; i < start + step && i < samples.length; i++) {
				if (samples[i] < lo) lo = samples[i];
				if (samples[i] > hi) hi = samples[i];
			}
			const yLo = h / 2 - lo * (h / 2) * 0.9;
			const yHi = h / 2 - hi * (h / 2) * 0.9;
			g.moveTo(x + 0.5, yLo);
			g.lineTo(x + 0.5, yHi);
		}
		g.stroke();
	});
</script>

<canvas bind:this={canvas}></canvas>

<style>
	canvas {
		width: 100%;
		height: 64px;
		border-radius: 6px;
		display: block;
	}
</style>
