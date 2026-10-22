
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const MODEL = "claude-sonnet-5";

if (typeof fetch !== "function") {
  console.log("Your Node.js is too old.");
  process.exit(1);
}

function readApiKey() {
  try {
    const key = process.env.ANTHROPIC_API_KEY || fs.readFileSync(
      path.join(__dirname, "api-key.txt"), "utf8"
    ).trim();
    return !key || key.startsWith("PASTE") ? "" : key;
  } catch {
    return "";
  }
}

const WIKI = "https://en.wikipedia.org/w/api.php";
const WIKI_HEADERS = {
  "User-Agent": "TravelStoryHelper/0.1 (personal learning project)"
};

async function wikiSearch(place) {
  const url = `${WIKI}?action=query&list=search&srsearch=${encodeURIComponent(place)}&srlimit=3&format=json`;
  const res = await fetch(url, { headers: WIKI_HEADERS });
  if (!res.ok) throw new Error("Wikipedia search failed");
  const data = await res.json();
  return (data.query?.search || []).map(s => s.title);
}

async function wikiExtract(title) {
  const url = `${WIKI}?action=query&prop=extracts|info&inprop=url&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}&format=json`;
  const res = await fetch(url, { headers: WIKI_HEADERS });
  if (!res.ok) throw new Error("Wikipedia page fetch failed");
  const data = await res.json();
  const page = Object.values(data.query.pages)[0];
  return {
    title: page.title,
    url: page.fullurl,
    text: (page.extract || "").slice(0, 8000)
  };
}

async function gatherSources(place) {
  const titles = await wikiSearch(place);
  const sources = [];
  for (const title of titles) {
    try {
      const source = await wikiExtract(title);
      if (source.text.length > 200) sources.push(source);
    } catch {}
  }
  return sources;
}

async function writeStory(place, sources, apiKey, previousStories = [], chapter = 1) {
  const sourceText = sources
    .map((s, i) => `SOURCE ${i + 1}: ${s.title} (${s.url})\n${s.text}`)
    .join("\n\n-----\n\n");

  const continuation = previousStories.length > 0;
  const priorText = previousStories
    .map((story, i) => `PART ${i + 1}: ${story}`)
    .join("\n\n");

  const chapterDirections = chapter === 1
    ? "CHAPTER 1: approximately 50–55 words (25 seconds). Lead with a compelling verified detail."
    : chapter === 2
    ? "CHAPTER 2: approximately 80–90 words (40 seconds). Continue with new sourced history, without repetition."
    : "CHAPTER 3: approximately 38–45 words (20 seconds). Finish with an interesting fact and satisfying conclusion.";

  const system =
    "You are a gifted presenter of a polished BBC-style historical travel documentary. " +
    "Use ONLY facts in the supplied sources. Never invent historical details. " +
    "Write natural spoken narration without headings. " +
    chapterDirections + " " +
    (continuation
      ? "Continue the documentary, avoiding repetition. Earlier chapters are supplied below. "
      : "Open with a compelling source-supported hook. ") +
    "If more sourced material remains, include a brief natural teaser. " +
    'Reply ONLY with JSON: {"story":"narration","sources_used":[],"note":""}';

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages: [{
        role: "user",
        content: `Place: ${place}\n\nEarlier chapters:\n${priorText}\n\nSources:\n${sourceText}`
      }]
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || "Claude API error");
  }

  const text = data.content.map(b => b.text || "").join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) {
    throw new Error("Unexpected response format");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function sendJson(res, status, obj) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 10000) {
        reject(new Error("Request too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const storyHistory = new Map();

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  // Serve the actual app on the iPhone.
  if (req.method === "GET" && req.url === "/") {
    let html;
    try {
      html = fs.readFileSync(
        path.join(__dirname, "index.html"), "utf8"
      );
    } catch {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      return res.end("index.html is missing.");
    }

    // Replace localhost API calls with relative URLs.
    html = html
      .replace(/http:\/\/localhost:3000\/story/g, "/story")
      .replace(/http:\/\/127\.0\.0\.1:3000\/story/g, "/story");

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    });
    return res.end(html);
  }

  if (req.method === "POST" && req.url === "/story") {
    try {
      const body = JSON.parse(await readBody(req));
      const place = String(body.place || "").trim();

      if (!place || place.length > 100) {
        return sendJson(res, 400, {
          error: "Please enter a place name (up to 100 characters)."
        });
      }

      const apiKey = readApiKey();
      if (!apiKey) {
        return sendJson(res, 500, {
          error: "No API key found."
        });
      }

      console.log("Looking up:", place);
      const sources = await gatherSources(place);

      if (sources.length === 0) {
        return sendJson(res, 404, {
          error: "No reliable information found for that place."
        });
      }

      const placeKey = place.toLocaleLowerCase("en-GB");
      const requestedReset =
        body.reset === true || body.mode === "intro";

      const previousStories = requestedReset
        ? []
        : (storyHistory.get(placeKey) || []);

      const chapter = Math.min(previousStories.length + 1, 3);

      if (previousStories.length >= 3) {
        return sendJson(res, 200, {
          story: "That brings our story to a close. Choose another place to discover its history.",
          sources: [],
          note: "complete",
          complete: true
        });
      }

      const result = await writeStory(
        place, sources, apiKey, previousStories, chapter
      );

      if (result.story) {
        storyHistory.set(placeKey, [
          ...previousStories,
          result.story
        ].slice(-8));
      }

      const used = (result.sources_used || [])
        .map(n => sources[n - 1])
        .filter(Boolean)
        .map(s => ({ title: s.title, url: s.url }));

      console.log(
        "Done. Sources used:",
        used.map(s => s.title).join(", ") || "none"
      );

      return sendJson(res, 200, {
        story: result.story || "",
        sources: used,
        note: result.note || "",
        chapter,
        complete: chapter === 3
      });
    } catch (e) {
      console.log("Error:", e.message);
      return sendJson(res, 500, { error: e.message });
    }
  }

  sendJson(res, 404, { error: "Not found" });
});

// Allow the iPhone to connect over home Wi-Fi.
server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Travel Storyteller is running at http://localhost:${PORT}`
  );
  console.log(
    `On your iPhone: http://192.168.40.38:${PORT}`
  );
  console.log("Leave this window open. Press Control+C to stop it.");
});
// Password protection for Travel Storyteller
const originalListeners = server.listeners("request");

server.removeAllListeners("request");

server.on("request", (req, res) => {
  const password = process.env.APP_PASSWORD;

  if (!password) {
    res.writeHead(503, { "Content-Type": "text/plain" });
    return res.end("APP_PASSWORD has not been configured.");
  }

  const expected = "Basic " + Buffer.from(
    "traveller:" + password
  ).toString("base64");

  if (req.headers.authorization !== expected) {
    res.writeHead(401, {
      "WWW-Authenticate": 'Basic realm="Travel Storyteller"',
      "Content-Type": "text/plain"
    });
    return res.end("Username and password required.");
  }

  for (const listener of originalListeners) {
    listener.call(server, req, res);
  }
});
