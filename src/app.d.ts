// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

// Ambient globals for the pulse module's hardware APIs (Chromium-only):
/// <reference types="web-bluetooth" />
/// <reference types="w3c-web-serial" />
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
