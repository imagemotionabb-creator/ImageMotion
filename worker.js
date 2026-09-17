const CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const VOICE_MODEL = "@cf/myshell-ai/melotts";

const REPLICATE_VIDEO_URL =
  "https://api.replicate.com/v1/models/wan-video/wan-2.7-i2v/predictions";

const ALLOWED_ORIGINS = "*";

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS === "*" ? "*" : origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

function json(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...corsHeaders(origin)
    }
  });
}

function text(data, status = 200, origin = "*") {
  return new Response(data, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      ...corsHeaders(origin)
    }
  });
}

function error(message, status = 500, origin = "*") {
  return json(
    {
      success: false,
      error: message
    },
    status,
    origin
  );
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;
    const origin = request.headers.get("Origin") || "*";

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    /* =========================
       HEALTH
    ========================= */

    if (pathname === "/health" && method === "GET") {
      return json({
        success: true,
        app: "Briack AI 5",
        backend: "Cloudflare Worker",
        statut: "en ligne",
        workersIA: !!env.AI,
        replicateConfigured: !!env.REPLICATE_API_TOKEN,
        routes: [
          "/health",
          "/chat",
          "/chat-test",
          "/generate-image",
          "/generate-video",
          "/video-status",
          "/generate-voice",
          "/test-voice"
        ],
        modeles: {
          chat: CHAT_MODEL,
          image: IMAGE_MODEL,
          voice: VOICE_MODEL,
          video: "Replicate / Wan 2.7 I2V"
        }
      }, 200, origin);
    }

    /* =========================
       CHAT
    ========================= */

    if (pathname === "/chat" && method === "POST") {
      if (!env.AI) {
        return error("Workers AI n'est pas configuré.", 500, origin);
      }

      const body = await readJson(request);

      if (!body) {
        return error("JSON invalide.", 400, origin);
      }

      const message =
        typeof body.message === "string"
          ? body.message.trim()
          : "";

      if (!message) {
        return error("Le champ 'message' est obligatoire.", 400, origin);
      }

      const history = Array.isArray(body.history)
        ? body.history
        : [];

      const messages = [
        {
          role: "system",
          content:
            "Tu es Briack AI 5, un assistant IA professionnel, intelligent, clair et utile. Réponds dans la langue utilisée par l'utilisateur. Donne des réponses précises et naturelles."
        }
      ];

      for (const item of history.slice(-20)) {
        if (
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string"
        ) {
          messages.push({
            role: item.role,
            content: item.content
          });
        }
      }

      messages.push({
        role: "user",
        content: message
      });

      try {
        const result = await env.AI.run(CHAT_MODEL, {
          messages,
          max_tokens: 1024,
          temperature: 0.7
        });

        return json({
          success: true,
          model: CHAT_MODEL,
          response:
            result?.response ||
            result?.result?.response ||
            "",
          raw: result
        }, 200, origin);

      } catch (err) {
        return error(
          "Erreur Workers AI : " +
            (err?.message || String(err)),
          500,
          origin
        );
      }
    }

    /* =========================
       CHAT TEST
    ========================= */

    if (pathname === "/chat-test" && method === "GET") {
      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Briack AI 5 — Test Chat</title>

<style>
body {
  margin: 0;
  padding: 20px;
  font-family: Arial, sans-serif;
  background: #0b1020;
  color: white;
}

.container {
  max-width: 600px;
  margin: auto;
}

h1 {
  text-align: center;
}

textarea {
  width: 100%;
  min-height: 120px;
  box-sizing: border-box;
  padding: 15px;
  border-radius: 12px;
  border: 1px solid #39405c;
  background: #151b31;
  color: white;
  font-size: 16px;
}

button {
  width: 100%;
  margin-top: 12px;
  padding: 15px;
  border: 0;
  border-radius: 12px;
  background: #5865f2;
  color: white;
  font-size: 17px;
  font-weight: bold;
}

#result {
  margin-top: 20px;
  padding: 15px;
  background: #151b31;
  border-radius: 12px;
  white-space: pre-wrap;
  min-height: 80px;
}

.status {
  margin-top: 10px;
  color: #9aa4c7;
}
</style>
</head>

<body>

<div class="container">

<h1>🤖 Briack AI 5</h1>

<p>Test réel de la route /chat</p>

<textarea id="message">Bonjour Briack AI 5. Présente-toi en une phrase.</textarea>

<button id="send">Tester le chat</button>

<div class="status" id="status"></div>

<div id="result">La réponse apparaîtra ici.</div>

</div>

<script>

const button = document.getElementById("send");
const message = document.getElementById("message");
const result = document.getElementById("result");
const status = document.getElementById("status");

button.addEventListener("click", async () => {

  const text = message.value.trim();

  if (!text) {
    result.textContent = "Écris un message.";
    return;
  }

  button.disabled = true;
  status.textContent = "Connexion à Briack AI 5...";
  result.textContent = "";

  try {

    const response = await fetch("/chat", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        message: text
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error || "Erreur inconnue."
      );
    }

    status.textContent = "✅ Chat fonctionnel";

    result.textContent =
      data.response || "Aucune réponse reçue.";

  } catch (error) {

    status.textContent = "❌ Erreur";

    result.textContent =
      error.message || String(error);

  } finally {

    button.disabled = false;

  }

});

</script>

</body>
</html>`;

      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
          ...corsHeaders(origin)
        }
      });
    }

    /* =========================
       GENERATE IMAGE
    ========================= */

    if (pathname === "/generate-image" && method === "POST") {
      if (!env.AI) {
        return error("Workers AI n'est pas configuré.", 500, origin);
      }

      const body = await readJson(request);

      if (!body) {
        return error("JSON invalide.", 400, origin);
      }

      const prompt =
        typeof body.prompt === "string"
          ? body.prompt.trim()
          : "";

      if (!prompt) {
        return error("Le champ 'prompt' est obligatoire.", 400, origin);
      }

      try {
        const result = await env.AI.run(IMAGE_MODEL, {
          prompt
        });

        return new Response(result, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            ...corsHeaders(origin)
          }
        });

      } catch (err) {
        return error(
          "Erreur génération image : " +
            (err?.message || String(err)),
          500,
          origin
        );
      }
    }

    /* =========================
       GENERATE VIDEO
    ========================= */

    if (pathname === "/generate-video" && method === "POST") {
      if (!env.REPLICATE_API_TOKEN) {
        return error(
          "Replicate n'est pas encore configuré.",
          503,
          origin
        );
      }

      const body = await readJson(request);

      if (!body) {
        return error("JSON invalide.", 400, origin);
      }

      const image =
        typeof body.image === "string"
          ? body.image
          : "";

      const prompt =
        typeof body.prompt === "string"
          ? body.prompt
          : "";

      if (!image) {
        return error(
          "Une image est nécessaire pour la génération vidéo.",
          400,
          origin
        );
      }

      try {
        const replicateResponse = await fetch(
          REPLICATE_VIDEO_URL,
          {
            method: "POST",

            headers: {
              "Authorization":
                `Bearer ${env.REPLICATE_API_TOKEN}`,
              "Content-Type": "application/json"
            },

            body: JSON.stringify({
              input: {
                image,
                prompt
              }
            })
          }
        );

        const data = await replicateResponse.json();

        return json({
          success: replicateResponse.ok,
          provider: "Replicate",
          data
        }, replicateResponse.status, origin);

      } catch (err) {
        return error(
          "Erreur Replicate : " +
            (err?.message || String(err)),
          500,
          origin
        );
      }
    }

    /* =========================
       VIDEO STATUS
    ========================= */

    if (pathname === "/video-status" && method === "GET") {
      const id = url.searchParams.get("id");

      if (!id) {
        return error(
          "Le paramètre 'id' est obligatoire.",
          400,
          origin
        );
      }

      if (!env.REPLICATE_API_TOKEN) {
        return error(
          "Replicate n'est pas encore configuré.",
          503,
          origin
        );
      }

      try {
        const response = await fetch(
          `https://api.replicate.com/v1/predictions/${encodeURIComponent(id)}`,
          {
            headers: {
              "Authorization":
                `Bearer ${env.REPLICATE_API_TOKEN}`
            }
          }
        );

        const data = await response.json();

        return json({
          success: response.ok,
          data
        }, response.status, origin);

      } catch (err) {
        return error(
          "Erreur statut vidéo : " +
            (err?.message || String(err)),
          500,
          origin
        );
      }
    }

    /* =========================
       GENERATE VOICE
    ========================= */

    if (pathname === "/generate-voice" && method === "POST") {
      if (!env.AI) {
        return error("Workers AI n'est pas configuré.", 500, origin);
      }

      const body = await readJson(request);

      if (!body) {
        return error("JSON invalide.", 400, origin);
      }

      const textInput =
        typeof body.text === "string"
          ? body.text.trim()
          : "";

      if (!textInput) {
        return error(
          "Le champ 'text' est obligatoire.",
          400,
          origin
        );
      }

      try {
        const result = await env.AI.run(VOICE_MODEL, {
          text: textInput
        });

        return new Response(result, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            ...corsHeaders(origin)
          }
        });

      } catch (err) {
        return error(
          "Erreur génération voix : " +
            (err?.message || String(err)),
          500,
          origin
        );
      }
    }

    /* =========================
       TEST VOICE
    ========================= */

    if (pathname === "/test-voice" && method === "GET") {

      const html = `<!DOCTYPE html>
<html lang="fr">

<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>Briack AI 5 - Test vocal</title>

<style>

body {
  margin: 0;
  padding: 25px;
  background: #0b1020;
  color: white;
  font-family: Arial, sans-serif;
}

.container {
  max-width: 600px;
  margin: auto;
  text-align: center;
}

button {
  padding: 15px 25px;
  border: none;
  border-radius: 12px;
  background: #5865f2;
  color: white;
  font-size: 18px;
}

#status {
  margin-top: 20px;
}

#text {
  margin-top: 20px;
  padding: 20px;
  background: #151b31;
  border-radius: 12px;
  min-height: 100px;
}

</style>

</head>

<body>

<div class="container">

<h1>🎤 Briack AI 5</h1>

<button id="start">
Commencer à parler
</button>

<div id="status">
Appuie sur le bouton puis parle.
</div>

<div id="text">
Ton texte apparaîtra ici.
</div>

</div>

<script>

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

const start =
  document.getElementById("start");

const status =
  document.getElementById("status");

const text =
  document.getElementById("text");

if (!SpeechRecognition) {

  status.textContent =
    "La reconnaissance vocale n'est pas disponible dans ce navigateur.";

} else {

  const recognition =
    new SpeechRecognition();

  recognition.lang = "fr-FR";

  recognition.continuous = false;

  recognition.interimResults = true;

  recognition.onstart = () => {

    status.textContent =
      "🎤 Écoute en cours...";

  };

  recognition.onresult = event => {

    let result = "";

    for (
      let i = event.resultIndex;
      i < event.results.length;
      i++
    ) {

      result +=
        event.results[i][0].transcript;

    }

    text.textContent = result;

  };

  recognition.onerror = event => {

    status.textContent =
      "Erreur : " + event.error;

  };

  recognition.onend = () => {

    status.textContent =
      "✅ Reconnaissance terminée.";

  };

  start.onclick = () => {

    recognition.start();

  };

}

</script>

</body>
</html>`;

      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
          ...corsHeaders(origin)
        }
      });
    }

    /* =========================
       404
    ========================= */

    return json({
      success: false,
      error: "Route introuvable.",
      path: pathname
    }, 404, origin);
  }
};
