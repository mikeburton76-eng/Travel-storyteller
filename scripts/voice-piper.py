"""Generate one story offline, then exit to release model memory."""
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


def generate(request, emit=None):
    text, name, speed = request["text"], request["voice"], request["speed"]
    config = json.loads((ROOT / "voice-config.json").read_text())
    if not isinstance(text, str) or not text.strip() or len(text) > 1800:
        raise ValueError("Invalid narration length.")
    if name not in config["voices"]:
        raise ValueError("Unsupported narrator.")
    if not isinstance(speed, (int, float)) or not 0.5 <= speed <= 2:
        raise ValueError("Invalid narration speed.")
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


if __name__ == "__main__":
    try:
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
