# Mike's narrator requirements

- Use Isabella (`bf_isabella`) by default. Mike prefers her to the robotic browser voices.
- Keep switching narrator simple; the approved voices and default are in `voice-config.json`.
- No paid voice API or subscription. Do not enable paid hosting or upgrade a plan without Mike's agreement.
- Keep a reproducible copy of the model, voice and software. Do not follow mutable model versions automatically.
- iPhone browser generation failed after five minutes. Generate audio on the server and send standard PCM WAV to the phone.
- Never silently fall back to Daniel or another built-in voice.

# Server experiment

This branch adds `/voice-test`, `/voices` and `/speech`, behind the existing password protection.
It does not change Render settings. Deployment still needs a free-host resource check.
`npm ci` installs the pinned dependency tree and verifies/downloads the fixed model snapshot.
The Node CPU build avoids CUDA downloads via `.npmrc`.
The model revision and SHA256 checksums are in `voice-model-lock.json`.
Voice binaries ship inside the exact `kokoro-js@1.2.1` package; npm's lockfile records package integrity.
Keep the model folder and an offline dependency bundle as a private backup before relying on the deployment.

The first request loads the model. Repeated identical audio is cached (up to 16 MiB).
Only one generation runs at once; an overlapping request gets a retryable error.
The worker is released after two minutes idle. It is terminated on timeout/error.

Hosting resources remain a practical constraint: free software is not a guarantee of free hosting.
