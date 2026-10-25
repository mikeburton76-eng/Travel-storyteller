# Mike's narrator requirements

- Mike selected Piper Southern English Female (`en_GB-southern_english_female-low`) after hearing both Piper candidates.
- Isabella remains backed up, but is no longer the selected narrator.
- Keep switching narrator simple; the approved voices and default are in `voice-config.json`.
- No paid voice API or subscription. Do not enable paid hosting or upgrade a plan without Mike's agreement.
- Keep a reproducible copy of the model, voice and software. Do not follow mutable model versions automatically.
- Kokoro iPhone browser generation failed after five minutes. Generate Piper audio on the server and send standard PCM WAV to the phone.
- Never silently fall back to Daniel or another built-in voice.

# Server experiment

This branch adds `/voice-test`, `/voices` and `/speech`, behind the existing password protection.
It does not change Render settings. Deployment still needs a free-host resource check.
`npm ci` verifies/downloads the fixed Piper voice snapshot; it no longer installs Kokoro or Transformers.js.
Install the pinned Python voice dependencies using `bash scripts/setup-voice.sh` (Python 3.12+).
The model revision and SHA256 checksums are in `piper-model-lock.json`.
The exact voice model/configuration and model card are privately backed up. Requirements are pinned.
The model card credits OpenSLR 83 and identifies its dataset as CC-BY-SA 4.0.
Piper's source and licence: https://github.com/OHF-Voice/piper1-gpl (GPL-3.0).

The first request loads the model. Repeated identical audio is cached (up to 16 MiB).
Only one generation runs at once; an overlapping request gets a retryable error.
Each Python process handles one story and exits. It receives no app API keys or passwords.
Linux seccomp denies networking inside the voice process; ONNX telemetry is also disabled.
The main Node app retains its normal network access for Wikipedia and story generation.

# Measurements and deployment status

Local benchmark: 17–18 seconds of audio in 1.4–1.7 seconds after model load,
peak Python process RSS 247–263 MiB on two sequential passes.
End-to-end authenticated audio endpoint: 4.294 seconds including fresh process/model load;
cached replay 8 ms. These are local measurements, not Render measurements.

The tested local system was Linux, Python 3.12 and Node 24.
The Dockerfile provides Python 3.12 + Node 22 + libseccomp; Docker build itself has not been tested here.
For native deployment the build command is `npm ci && bash scripts/setup-voice.sh` and start is `node server.js`.
Python 3.12+ and libseccomp.so.2 must be available. A failed offline isolation check stops synthesis.
Do not upgrade a hosting plan. Test on a free instance and measure actual waiting time and memory.

Hosting resources remain a practical constraint: free software is not a guarantee of free hosting.
