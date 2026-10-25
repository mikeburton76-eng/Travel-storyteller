import io
import json
from pathlib import Path
import resource
import time
import wave

started = time.monotonic()
import onnxruntime as ort
ort.disable_telemetry_events()
from piper import PiperVoice
from piper.config import PiperConfig

root = Path(__file__).resolve().parents[1]
model = root / ".piper-model/en_GB-southern_english_female-low.onnx"
options = ort.SessionOptions()
options.intra_op_num_threads = 1
options.inter_op_num_threads = 1
voice = PiperVoice(session=ort.InferenceSession(str(model), options, providers=["CPUExecutionProvider"]),
                   config=PiperConfig.from_dict(json.loads(Path(str(model) + ".json").read_text())))
load_seconds = time.monotonic() - started
text = ("Welcome to Buxton, a spa town in the Derbyshire hills. Beneath its elegant "
        "Georgian buildings lies a fascinating history, shaped by ancient springs, "
        "Roman visitors, and centuries of travellers. Today, we will explore the "
        "stories behind the places around you, beginning with the Crescent and its "
        "remarkable setting in the heart of the town.")
results = []
for repetition in range(2):
    output = io.BytesIO()
    begin, cpu = time.monotonic(), time.process_time()
    with wave.open(output, "wb") as wav:
        voice.synthesize_wav(text, wav)
    with wave.open(io.BytesIO(output.getvalue()), "rb") as wav:
        duration = wav.getnframes() / wav.getframerate()
    results.append({"pass": repetition + 1, "audio_seconds": round(duration, 3),
                    "generation_seconds": round(time.monotonic() - begin, 3),
                    "cpu_seconds": round(time.process_time() - cpu, 3),
                    "peak_rss_mib": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1)})
(root / ".piper-model/test-passage.wav").write_bytes(output.getvalue())
print(json.dumps({"engine": "piper-tts", "voice": "en_GB-southern_english_female-low",
                  "load_seconds": round(load_seconds, 3), "results": results}))
