"""Offline Piper synthesis; optional worker reuses one model until the parent stops it."""
import hashlib
import base64
import io
import json
from pathlib import Path
import re
import resource
import sys
import time
import wave

started = time.monotonic()
import onnxruntime as ort
ort.disable_telemetry_events()
from piper import PiperVoice, SynthesisConfig
from piper.config import PiperConfig

ROOT = Path(__file__).resolve().parents[1]


def chunks(text, limit=180, opening_limit=None):
    # Keep sentence endings and cap unusually long sentences without dropping text.
    cap = min(limit, opening_limit) if opening_limit else limit
    for sentence in re.findall(r"[^.!?]+[.!?]*", text):
        part = ""
        for word in sentence.split():
            if len(word) > limit:
                raise ValueError("A narration word is too long.")
            if part and len(part) + len(word) + 1 > cap:
                yield part
                part = ""
                cap = limit
            part += (" " if part else "") + word
        if part:
            yield part
            cap = limit


def load_voice(name):
    lock = json.loads((ROOT / "piper-model-lock.json").read_text())
    for filename, expected in lock["files"].items():
        with open(ROOT / ".piper-model" / filename, "rb") as stream:
            actual = hashlib.file_digest(stream, "sha256").hexdigest()
        if actual != expected:
            raise RuntimeError("Narrator checksum mismatch: " + filename)
    model = ROOT / ".piper-model" / (name + ".onnx")
    settings = json.loads(Path(str(model) + ".json").read_text())
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    voice = PiperVoice(session=ort.InferenceSession(str(model), options, providers=["CPUExecutionProvider"]),
                       config=PiperConfig.from_dict(settings))
    return voice, settings


def generate(request, emit=None, prepared=None):
    text, name, speed = request["text"], request["voice"], request["speed"]
    config = json.loads((ROOT / "voice-config.json").read_text())
    if not isinstance(text, str) or not text.strip() or len(text) > 1800:
        raise ValueError("Invalid narration length.")
    if name not in config["voices"]:
        raise ValueError("Unsupported narrator.")
    if not isinstance(speed, (int, float)) or not 0.5 <= speed <= 2:
        raise ValueError("Invalid narration speed.")
    voice, settings = prepared if prepared else load_voice(name)
    result = io.BytesIO()
    with wave.open(result, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(settings["audio"]["sample_rate"])
        for part in chunks(text, opening_limit=100 if emit else None):
            section = io.BytesIO()
            section_wav = wave.open(section, "wb")
            section_wav.setnchannels(1)
            section_wav.setsampwidth(2)
            section_wav.setframerate(settings["audio"]["sample_rate"])
            for audio in voice.synthesize(part, syn_config=SynthesisConfig(length_scale=1 / speed)):
                if emit:
                    section_wav.writeframes(audio.audio_int16_bytes)
                else:
                    wav.writeframes(audio.audio_int16_bytes)
            section_wav.close()
            if emit:
                emit(section.getvalue())
    return result.getvalue()


def run_worker():
    config = json.loads((ROOT / "voice-config.json").read_text())
    name = config["defaultVoice"]
    prepared = load_voice(name)
    print(json.dumps({"ready": True, "load_seconds": round(time.monotonic() - started, 3),
                      "peak_rss_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024}), flush=True)
    while True:
        line = sys.stdin.buffer.readline(12001)
        if not line:
            return
        if len(line) > 12000 or not line.endswith(b"\n"):
            raise ValueError("Voice request is too large.")
        request = json.loads(line)
        task_id = request["id"]
        try:
            if request["voice"] not in config["voices"]:
                raise ValueError("Unsupported narrator.")
            if request["voice"] != name:
                # Retain only the chosen model, even if another voice is added later.
                prepared = None
                name = request["voice"]
                prepared = load_voice(name)
            begin = time.monotonic()
            def emit(section):
                print(json.dumps({"id": task_id, "wav": base64.b64encode(section).decode("ascii")}), flush=True)
            wav = generate(request, emit if request.get("stream") else None, prepared)
            if not request.get("stream"):
                emit(wav)
            print(json.dumps({"id": task_id, "done": True,
                              "peak_rss_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024}), flush=True)
            print(json.dumps({"generation_seconds": round(time.monotonic() - begin, 3),
                              "peak_rss_mib": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1)}), file=sys.stderr, flush=True)
        except Exception as error:
            print(json.dumps({"id": task_id, "error": str(error)}), flush=True)
            raise


if __name__ == "__main__":
    try:
        if "--worker" in sys.argv:
            run_worker()
        else:
            request = json.loads(sys.stdin.buffer.read(12000))
            def emit(section):
                print(json.dumps({"wav": base64.b64encode(section).decode("ascii")}), flush=True)
            wav = generate(request, emit if request.get("stream") else None)
            print(json.dumps({"generation_seconds": round(time.monotonic() - started, 3),
                              "peak_rss_mib": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1)}), file=sys.stderr)
            if request.get("stream"):
                print(json.dumps({"done": True}), flush=True)
            else:
                sys.stdout.buffer.write(wav)
    except Exception as error:
        print("Local voice error: " + str(error), file=sys.stderr)
        sys.exit(1)
