/**
 * BRIACK AI 5 — CLOUDFLARE WORKER
 * Backend principal
 *
 * Fonctions :
 *  GET  /health
 *  GET  /test-ai
 *  POST /chat
 *  POST /generate-script
 *  POST /generate-image
 *  POST /generate-audio
 *  POST /generate-video
 *  GET  /video-status?id=...
 *
 * Binding Cloudflare Workers AI :
 *   AI
 *
 * Secret :
 *   REPLICATE_API_TOKEN
 */

const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

const REPLICATE_VIDEO_URL =
  "https://api.replicate.com/v1/models/wan-video/wan-2.7-i2v/predictions";

const AUDIO_MODEL = "@cf/deepgram/aura-2-en";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function text(data, status = 200, contentType = "text/plain") {
  return new Response(data, {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": contentType,
    },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function cleanString(value, maxLength = 12000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

/* =========================================================
   HEALTH
========================================================= */

async function health(env) {
  return json({
    success: true,
    app: "Briack AI 5",
    service: "Cloudflare Worker",
    workersAI: !!env.AI,
    imageModel: IMAGE_MODEL,
    chatModel: AI_MODEL,
    audioModel: AUDIO_MODEL,
    videoProvider: "Replicate",
    time: new Date().toISOString(),
  });
}

/* =========================================================
   TEST AI
========================================================= */

async function testAI(env) {
  if (!env.AI) {
    return json(
      {
        success: false,
        error: "Le binding Workers AI nommé AI est absent.",
      },
      500
    );
  }

  try {
    const result = await env.AI.run(AI_MODEL, {
      messages: [
        {
          role: "system",
          content:
            "Tu es Briack AI 5, un assistant IA professionnel. Réponds brièvement en français.",
        },
        {
          role: "user",
          content: "Dis simplement : Briack AI 5 est opérationnel.",
        },
      ],
      max_tokens: 100,
      temperature: 0.3,
    });

    return json({
      success: true,
      model: AI_MODEL,
      result,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: "Erreur Workers AI.",
        details: error?.message || String(error),
      },
      500
    );
  }
}

/* =========================================================
   CHAT IA
========================================================= */

async function chat(request, env) {
  if (!env.AI) {
    return json(
      {
        success: false,
        error: "Le binding Workers AI nommé AI est absent.",
      },
      500
    );
  }

  const body = await readJson(request);

  if (!body) {
    return json(
      {
        success: false,
        error: "JSON invalide.",
      },
      400
    );
  }

  const message = cleanString(body.message, 12000);

  if (!message) {
    return json(
      {
        success: false,
        error: "Le champ message est obligatoire.",
      },
      400
    );
  }

  let language = cleanString(body.language, 30) || "français";

  let history = Array.isArray(body.history)
    ? body.history.slice(-12)
    : [];

  const safeHistory = history
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string"
    )
    .map((item) => ({
      role: item.role,
      content: item.content.slice(0, 6000),
    }));

  const systemPrompt = `
Tu es Briack AI 5, l'assistant central d'une plateforme mondiale de création avec intelligence artificielle.

Ton rôle :
- aider l'utilisateur à créer ;
- expliquer clairement ;
- aider pour les images ;
- aider pour les vidéos ;
- aider pour les scripts ;
- aider pour la voix ;
- aider pour la musique et l'audio lorsque ces fonctions seront disponibles ;
- aider à organiser des projets ;
- proposer des idées créatives ;
- être honnête sur les capacités réellement disponibles ;
- ne jamais prétendre avoir effectué une action qui n'a pas réellement été exécutée.

Tu ne dois pas dire qu'une image, vidéo ou audio a été généré si le serveur ne l'a pas réellement généré.

Langue demandée par l'utilisateur : ${language}.

Réponds de manière professionnelle, naturelle, utile et concise.
`;

  try {
    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...safeHistory,
      {
        role: "user",
        content: message,
      },
    ];

    const result = await env.AI.run(AI_MODEL, {
      messages,
      max_tokens: 1200,
      temperature: 0.7,
    });

    let response = "";

    if (typeof result === "string") {
      response = result;
    } else if (result?.response) {
      response = result.response;
    } else if (result?.result?.response) {
      response = result.result.response;
    } else if (result?.choices?.[0]?.message?.content) {
      response = result.choices[0].message.content;
    } else {
      response = JSON.stringify(result);
    }

    return json({
      success: true,
      type: "chat",
      model: AI_MODEL,
      language,
      response,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: "Impossible de contacter le modèle IA.",
        details: error?.message || String(error),
      },
      500
    );
  }
}

/* =========================================================
   GENERATE SCRIPT
========================================================= */

async function generateScript(request, env) {
  if (!env.AI) {
    return json(
      {
        success: false,
        error: "Le binding Workers AI nommé AI est absent.",
      },
      500
    );
  }

  const body = await readJson(request);

  if (!body) {
    return json(
      {
        success: false,
        error: "JSON invalide.",
      },
      400
    );
  }

  const topic = cleanString(body.topic, 6000);

  if (!topic) {
    return json(
      {
        success: false,
        error: "Le champ topic est obligatoire.",
      },
      400
    );
  }

  const language = cleanString(body.language, 30) || "français";
  const duration = cleanString(body.duration, 50) || "60 secondes";
  const style = cleanString(body.style, 200) || "documentaire réaliste";

  const prompt = `
Crée un script professionnel pour une vidéo.

Sujet :
${topic}

Langue :
${language}

Durée approximative :
${duration}

Style :
${style}

Structure :
1. Accroche forte
2. Introduction
3. Développement
4. Informations principales
5. Conclusion
6. Phrase finale adaptée à une vidéo

Le résultat doit être directement exploitable pour une future génération vidéo et voix.
N'invente pas de faits présentés comme certains lorsque le sujet exige une vérification.
`;

  try {
    const result = await env.AI.run(AI_MODEL, {
      messages: [
        {
          role: "system",
          content:
            "Tu es un scénariste professionnel spécialisé dans les vidéos documentaires et créatives.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 2500,
      temperature: 0.75,
    });

    let script = "";

    if (typeof result === "string") {
      script = result;
    } else if (result?.response) {
      script = result.response;
    } else if (result?.choices?.[0]?.message?.content) {
      script = result.choices[0].message.content;
    } else {
      script = JSON.stringify(result);
    }

    return json({
      success: true,
      type: "script",
      language,
      duration,
      style,
      topic,
      script,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: "Erreur pendant la génération du script.",
        details: error?.message || String(error),
      },
      500
    );
  }
}

/* =========================================================
   GENERATE IMAGE
========================================================= */

async function generateImage(request, env) {
  if (!env.AI) {
    return json(
      {
        success: false,
        error: "Le binding Workers AI nommé AI est absent.",
      },
      500
    );
  }

  const body = await readJson(request);

  if (!body) {
    return json(
      {
        success: false,
        error: "JSON invalide.",
      },
      400
    );
  }

  const prompt = cleanString(body.prompt, 6000);

  if (!prompt) {
    return json(
      {
        success: false,
        error: "Le champ prompt est obligatoire.",
      },
      400
    );
  }

  try {
    const result = await env.AI.run(IMAGE_MODEL, {
      prompt,
    });

    if (!result?.image) {
      return json(
        {
          success: false,
          error: "Le modèle image n'a pas retourné d'image.",
          result,
        },
        500
      );
    }

    return json({
      success: true,
      type: "image",
      model: IMAGE_MODEL,
      prompt,
      image: "data:image/jpeg;base64," + result.image,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: "Erreur pendant la génération de l'image.",
        details: error?.message || String(error),
      },
      500
    );
  }
}

/* =========================================================
   GENERATE AUDIO / TTS
========================================================= */

async function generateAudio(request, env) {
  if (!env.AI) {
    return json(
      {
        success: false,
        error: "Le binding Workers AI nommé AI est absent.",
      },
      500
    );
  }

  const body = await readJson(request);

  if (!body) {
    return json(
      {
        success: false,
        error: "JSON invalide.",
      },
      400
    );
  }

  const inputText = cleanString(body.text, 10000);

  if (!inputText) {
    return json(
      {
        success: false,
        error: "Le champ text est obligatoire.",
      },
      400
    );
  }

  const speaker = cleanString(body.speaker, 50) || "luna";

  try {
    const audio = await env.AI.run(
      AUDIO_MODEL,
      {
        text: inputText,
        speaker,
        encoding: "mp3",
      },
      {
        returnRawResponse: true,
      }
    );

    const arrayBuffer = await audio.arrayBuffer();

    const bytes = new Uint8Array(arrayBuffer);

    let binary = "";

    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(
        i,
        Math.min(i + chunkSize, bytes.length)
      );

      binary += String.fromCharCode(...chunk);
    }

    const base64 = btoa(binary);

    return json({
      success: true,
      type: "audio",
      model: AUDIO_MODEL,
      speaker,
      audio: "data:audio/mpeg;base64," + base64,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: "Erreur pendant la génération audio.",
        details: error?.message || String(error),
      },
      500
    );
  }
}

/* =========================================================
   GENERATE VIDEO
========================================================= */

async function generateVideo(request, env) {
  const body = await readJson(request);

  if (!body) {
    return json(
      {
        success: false,
        error: "JSON invalide.",
      },
      400
    );
  }

  const prompt = cleanString(body.prompt, 6000);

  if (!prompt) {
    return json(
      {
        success: false,
        error: "Le champ prompt est obligatoire.",
      },
      400
    );
  }

  if (!env.REPLICATE_API_TOKEN) {
    return json(
      {
        success: false,
        error: "REPLICATE_API_TOKEN est absent.",
      },
      500
    );
  }

  const duration = Number(body.duration || 5);

  const allowedDurations = [2, 3, 4, 5, 6, 8, 10, 12, 15];

  const finalDuration = allowedDurations.includes(duration)
    ? duration
    : 5;

  const resolution =
    body.resolution === "1080p"
      ? "1080p"
      : "720p";

  try {
    const replicateResponse = await fetch(
      REPLICATE_VIDEO_URL,
      {
        method: "POST",
        headers: {
          Authorization:
            "Bearer " + env.REPLICATE_API_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            prompt,
            duration: finalDuration,
            resolution,
          },
        }),
      }
    );

    const result = await replicateResponse.json();

    if (!replicateResponse.ok) {
      return json(
        {
          success: false,
          error: "Replicate a refusé la génération vidéo.",
          details: result,
        },
        replicateResponse.status
      );
    }

    return json({
      success: true,
      type: "video",
      provider: "Replicate",
      id: result.id,
      status: result.status,
      prompt,
      duration: finalDuration,
      resolution,
      urls: {
        get: result.urls?.get || null,
        cancel: result.urls?.cancel || null,
      },
      output: result.output || null,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: "Erreur de connexion à Replicate.",
        details: error?.message || String(error),
      },
      500
    );
  }
}

/* =========================================================
   VIDEO STATUS
========================================================= */

async function videoStatus(request, env) {
  const url = new URL(request.url);

  const id = url.searchParams.get("id");

  if (!id) {
    return json(
      {
        success: false,
        error: "Le paramètre id est obligatoire.",
      },
      400
    );
  }

  if (!env.REPLICATE_API_TOKEN) {
    return json(
      {
        success: false,
        error: "REPLICATE_API_TOKEN est absent.",
      },
      500
    );
  }

  try {
    const response = await fetch(
      "https://api.replicate.com/v1/predictions/" +
        encodeURIComponent(id),
      {
        headers: {
          Authorization:
            "Bearer " + env.REPLICATE_API_TOKEN,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return json(
        {
          success: false,
          error: "Impossible de récupérer le statut vidéo.",
          details: result,
        },
        response.status
      );
    }

    return json({
      success: true,
      id: result.id,
      status: result.status,
      output: result.output || null,
      error: result.error || null,
      logs: result.logs || null,
      created_at: result.created_at || null,
      started_at: result.started_at || null,
      completed_at: result.completed_at || null,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: "Erreur pendant la récupération du statut.",
        details: error?.message || String(error),
      },
      500
    );
  }
}

/* =========================================================
   MAIN ROUTER
========================================================= */
async function generateChat(request, env) {
  try {
    if (request.method !== "POST") {
      return jsonResponse(
        { success: false, error: "Méthode POST requise." },
        405
      );
    }

    const body = await request.json();
    const message = String(body.message || "").trim();

    if (!message) {
      return jsonResponse(
        { success: false, error: "Le message est vide." },
        400
      );
    }

    const result = await env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct-fast",
      {
        messages: [
          {
            role: "system",
            content:
              "Tu es Briack AI 5, un assistant IA professionnel, utile, honnête et précis. Réponds dans la langue utilisée par l'utilisateur."
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 1024
      }
    );

    return jsonResponse({
      success: true,
      reply: result.response || ""
    });

  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: "Erreur lors de la génération de la réponse.",
        details: error.message
      },
      500
    );
  }
  }
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === "GET" && path === "/") {
        return text(
          "Briack AI 5 API — Worker opérationnel.",
          200
        );
      }

      if (request.method === "GET" && path === "/health") {
        return await health(env);
      }

      if (request.method === "GET" && path === "/test-ai") {
        return await testAI(env);
      }

      if (
        request.method === "POST" &&
        path === "/chat"
      ) {
        return await chat(request, env);
      }

      if (
        request.method === "POST" &&
        path === "/generate-script"
      ) {
        return await generateScript(request, env);
      }

      if (
        request.method === "POST" &&
        path === "/generate-image"
      ) {
        return await generateImage(request, env);
      }

      if (
        request.method === "POST" &&
        path === "/generate-audio"
      ) {
        return await generateAudio(request, env);
      }

      if (
        request.method === "POST" &&
        path === "/generate-video"
      ) {
        return await generateVideo(request, env);
      }

      if (
        request.method === "GET" &&
        path === "/video-status"
      ) {
        return await videoStatus(request, env);
      }

      return json(
        {
          success: false,
          error: "Route inconnue.",
          path,
        },
        if (url.pathname === "/chat" && request.method === "POST") {
  return generateChat(request, env);
      }
        404
      );
    } catch (error) {
      return json(
        {
          success: false,
          error: "Erreur interne du Worker.",
          details: error?.message || String(error),
        },
        500
      );
    }
  },
};
