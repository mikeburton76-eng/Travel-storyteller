'use strict';
const samples = {
  crescent: "Buxton Crescent is a Grade I listed Georgian landmark designed by John Carr for the fifth Duke of Devonshire. The curved building was the centrepiece of the duke’s plans to develop Buxton as a fashionable spa town. Its original design combined a hotel, an assembly room and five lodging houses. After restoration, the hotel and thermal spa reopened in October 2020.",
  numbers: 'This is a pronunciation test. The year is 1789. The hotel reopened in October 2020. The walk is 400 metres, or 1.5 kilometres. Admission is £12.50. The building dates from the 18th century.'
};
const voices = ['en-GB-Wavenet-F', 'en-GB-Neural2-F'];
function createComparison({ fetchImpl = fetch, readKey = () => process.env.GOOGLE_TTS_API_KEY, now = Date.now } = {}) {
  let busy = false, windowStart = now(), requests = 0;
  return {
    config: () => ({ configured: !!readKey(), samples, voices }),
    async generate(input, signal) {
      if (!input || !Object.hasOwn(samples, input.sample) || !voices.includes(input.voice)) throw Object.assign(Error('Choose one of the test samples and voices.'), {status:400});
      const key = readKey();
      if (!key) throw Object.assign(Error('Google is not connected yet. Add GOOGLE_TTS_API_KEY in Render after enabling Cloud Text-to-Speech and billing in Google Cloud.'), {status:503});
      if (busy) throw Object.assign(Error('Another Google sample is preparing. Please wait.'), {status:429});
      if (now() - windowStart >= 3600000) { windowStart = now(); requests = 0; }
      if (requests >= 20) throw Object.assign(Error('The test limit of 20 Google requests per hour has been reached. Please try later.'), {status:429});
      busy = true; requests++;
      try {
        const response = await fetchImpl('https://texttospeech.googleapis.com/v1/text:synthesize', {
          method:'POST', headers:{'Content-Type':'application/json', 'X-Goog-Api-Key':key},
          body:JSON.stringify({input:{text:samples[input.sample]},voice:{languageCode:'en-GB',name:input.voice},audioConfig:{audioEncoding:'MP3',speakingRate:1}}),
          signal:AbortSignal.any([AbortSignal.timeout(45000), ...(signal ? [signal] : [])])
        });
        if (!response.ok) throw Object.assign(Error(`Google could not prepare audio (HTTP ${response.status}). Check the API key, Text-to-Speech API, billing and quota in Google Cloud.`), {status:502});
        const data = await response.json();
        if (typeof data.audioContent !== 'string' || !data.audioContent.length) throw Error('Google returned no audio.');
        return Buffer.from(data.audioContent, 'base64');
      } finally { busy = false; }
    }
  };
}
module.exports = {createComparison, samples, voices};
