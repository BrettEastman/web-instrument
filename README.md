# Web Instrument

A live-electronics instrument that runs in your web browser. You play into a microphone (flute, voice, anything), and the instrument records you, loops you, slows you down, plays you backwards, and scatters your sound into clouds of tiny fragments. Meanwhile, your **heartbeat** steers you through a landscape of nature sounds: river, waves, thunder, rain and wind.

It began as a browser reimagining of *Internal External*, a piece for flute and electronics originally built in Max/MSP, in which a performer's pulse, read by an Arduino heart-rate sensor, chose the environment they performed inside.

No installs and no audio software: open the page in Chrome, click **Begin**, and play.

---

## What you need

- **Google Chrome or Microsoft Edge** on a laptop or desktop. The Bluetooth and Arduino heart-rate features use browser APIs that only Chromium browsers support. The core instrument works elsewhere, but Chrome is the target.
- **A microphone.** Your laptop's built-in mic works; an audio interface sounds better.
- **Headphones**, recommended whenever the mic is live, to avoid feedback.
- **Optional:** a way to measure your pulse. Pick any one:
  - nothing at all: tap along with your pulse on screen
  - a Bluetooth heart-rate strap or watch (Polar, Garmin, Wahoo and similar)
  - an Arduino with a PulseSensor (see [Using an Arduino pulse sensor](#using-an-arduino-pulse-sensor))

---

## Quick start

```sh
pnpm install
pnpm dev --open
```

Then in the browser:

1. Click **Begin**. Browsers only allow sound after you click something.
2. Click **start environments** and drag the dot around the soundscape pad to hear the five landscapes blend.
3. Click **enable mic** and allow microphone access. This reveals the loopers, the granular engine and the score.
4. Press **space** to step through the score, and play along with whatever the instrument does.

---

## The panels, top to bottom

### Master
Overall output level and a level meter. Everything you hear passes through here.

### FX bus
Effects applied to everything:

- **EQ**: one filter with a choice of shapes (lowpass, highpass, peaking and others). Sweep **freq** to brighten or darken the whole mix.
- **Flanger**: a slow, swooshing jet-plane sweep. Raise **wet** to hear it; **regen** makes it more metallic.
- **Reverb**: **send** places everything in a large, echoing room.

### Soundscape
A pad holding five nature environments, each in its own zone:

| Zone | Sound |
|---|---|
| river | flowing water |
| waves | slow ocean swells |
| thunder | deep rolling rumble |
| thunder + rain | rain over distant thunder |
| wind | gusts sweeping past |

Drag the dot to move through the landscape. Zones nearer the dot get louder, and overlapping zones blend. Turn on **follow pulse** and the dot drifts on its own to wherever your heart rate points (see the table under Pulse). Grabbing the pad again gives control back to your hand.

> The current environment sounds are synthesized stand-ins. Real field recordings will replace them.

### Mic
Your input level, plus a **monitor** fader that plays your mic straight to the speakers. It starts muted on purpose: a live mic next to speakers can howl with feedback. Wear headphones before turning it up.

### Pulse
Where your heartbeat enters the instrument. Choose a source:

- **tap**: tap the big button in time with your pulse (finger on your neck or wrist). It settles after a few taps.
- **bluetooth strap**: pick your heart-rate strap or watch from Chrome's device list.
- **arduino**: pick your Arduino's USB port from Chrome's port list (details below).

The big number is the current BPM, refreshed twice a second. The highlighted chip shows which environment your heart rate belongs to:

| Heart rate (BPM) | Environment |
|---|---|
| 40–69 | river (a resting heart; the default is 67) |
| 70–89 | waves |
| 90–110 | thunder |
| 111–130 | thunder + rain |
| 131–179 | wind |

Other controls:

- **freeze** holds the current reading and lets go of the sensor, which is handy when you need your hands for playing.
- **manual** lets you type a BPM directly, for example one measured beforehand on another device.
- **pulse paces the grain cloud** sets the granular engine (below) to pulse in time with your heartbeat.

### Score
The piece's running order, shown as a large section number with a list of timed cues. Each section tells the instrument what to do and when: start recording, fade a loop in, slow something to a stop. Dots fill in as cues fire, and countdowns show what's coming.

| Key | Action |
|---|---|
| **space** or **→** | next section |
| **←** | previous section |
| **0** | back to the start (silence) |

The built-in demo score runs through seven sections: *neutral → environment → first capture → half-speed shadow → plode → reverse tide → coda*. Recording cues capture whatever you're playing at that moment, so the machine runs the score and you play against it. You choose when to advance.

Moving to a new section cancels any cues the previous section hadn't reached yet, so the score always does what the current section says.

### Loopers 1–3
Three independent loop recorders, holding up to 4, 8 and 12 seconds.

- **record** captures your mic; press again to stop (or it stops itself at its maximum length).
- **play loop** repeats the recording; **reverse** plays it backwards.
- **speed** changes playback speed. Slower is lower and darker; faster is higher and brighter, like a tape machine.
- **Gestures** are pre-shaped moves:
  - **slow to stop**: grinds the loop to a halt over 10 seconds
  - **into reverse**: slows down, turns around, and speeds back up the other way over 4 seconds
  - **back to speed**: glides back to the speed slider's setting

### Granular · plode
Turns a recording into a cloud of tiny overlapping fragments ("grains"), from a soft shimmer to a dense swarm.

1. **record source**: capture up to 25 seconds of playing.
2. **start grains**: the cloud begins.
3. Shape it with the range sliders. Each grain picks a random value between the two handles:
   - **start**: which part of the recording grains come from
   - **length**: how long each grain lasts
   - **pitch**: how far grains are shifted up or down, in semitones
   - **interval** and **jitter**: how often grains fire, and how irregular the rhythm is

Try a narrow **start** range on an attack, long grains, low pitch and a slow interval for a slow, low drift. Then squeeze **interval** down to about 20 ms for a dense storm.

---

## Using an Arduino pulse sensor

The instrument reads heart rate from an Arduino running a [PulseSensor Playground](https://github.com/WorldFamousElectronics/PulseSensorPlayground) sketch, the same setup the original Max/MSP piece used.

1. Upload your PulseSensor sketch to the Arduino and plug it in. USB-C adapters and hubs are fine.
2. **Close the Arduino IDE's Serial Monitor and Serial Plotter.** Only one program can use the port at a time.
3. In the Pulse panel, check that the baud rate matches `Serial.begin(...)` in your sketch (usually 115200), click **arduino**, and choose your board. On a Mac it appears as `cu.usbmodem…`.
4. Wait about 2 seconds (the Arduino restarts when connected) and rest your finger on the sensor.

The panel shows what the board is sending in real time ("receiving: …"), with counts of lines received and BPM readings found. The instrument understands the common PulseSensor output styles (Serial Plotter, `BPM: 72`, and the Processing Visualizer format) and works out the column order on its own.

**If the BPM isn't updating:**

| What you see | What it means |
|---|---|
| Error about opening the port | Another program (usually the Arduino IDE) has the port. Close it and try again. |
| "waiting for data…" never changes | Wrong port chosen, or the sketch isn't running. |
| Garbled characters | Baud rate mismatch. Change the dropdown to match your sketch. |
| Lines arrive, BPM readings stay at 0 | The sensor hasn't detected a beat yet. Adjust finger pressure, or lower `THRESHOLD` in the sketch. |

---

## For developers

Built with SvelteKit 5, TypeScript and the Web Audio API, with no audio libraries.

```sh
pnpm dev      # dev server
pnpm check    # type-check
pnpm build    # production build
```

| Where | What |
|---|---|
| `src/lib/audio/engine.ts` | audio context, master chain, `ramp()` helper |
| `src/lib/audio/fx.ts` | EQ, flanger, reverb |
| `src/lib/audio/soundscape.ts` | the five-zone environment pad |
| `src/lib/audio/looper.ts`, `recorder.ts` | loop recording and varispeed playback |
| `src/lib/audio/granular.ts` | grain scheduler |
| `src/lib/audio/cues.ts`, `score.ts` | cue engine and the demo score (**compose here**) |
| `src/lib/audio/pulse/` | tap, Bluetooth and Arduino heart-rate sources |
| `src/lib/components/` | UI panels |
