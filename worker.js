/**
 * ============================================================
 * BRIACK AI 5 — BACKEND WORKER
 * ============================================================
 *
 * Routes :
 *
 * GET  /health
 * POST /chat
 * POST /generate-script
 * POST /generate-image
 * POST /generate-audio
 * POST /generate-video
 * GET  /video-status?id=...
 *
 * Cloudflare Workers AI :
 *   env.AI
 *
 * Secrets :
 *   REPLICATE_API_TOKEN
 *
 * ============================================================
 */

const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

const REPLICATE_API =
  "https://api.replicate.com/v1/models/wan-video/wan-2.7-i2v/predictions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};


/* ============================================================
   UTILITAIRES
   ============================================================ */

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS
    }
  });
}


function error(message, status = 400, details = null) {
  return json({
    success: false,
    error: message,
    ...(details ? { details } : {})
  }, status);
}


async function readJSON(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}


function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}


/* ============================================================
   OPTIONS / CORS
   ============================================================ */

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}


/* ============================================================
   HEALTH
   ============================================================ */

async function health(env) {
  return json({
    success: true,
    app: "Briack AI 5",
    status: "online",
    workersAI: !!env.AI,
    textModel: TEXT_MODEL,
    imageModel: IMAGE_MODEL,
    timestamp: new Date().toISOString()
  });
}


/* ============================================================
   CHAT — ASSISTANT IA
   ============================================================ */

async function chat(request, env) {

  if (!env.AI) {
    return error(
      "La liaison Workers AI n'est pas configurée.",
      500
    );
  }

  const body = await readJSON(request);

  if (!body) {
    return error("JSON invalide.");
  }

  const message =
    typeof body.message === "string"
      ? body.message.trim()
      : "";

  if (!message) {
    return error("Le message est obligatoire.");
  }

  if (message.length > 12000) {
    return error(
      "Le message est trop long. Maximum 12000 caractères."
    );
  }

  const language =
    typeof body.language === "string"
      ? body.language
      : "fr";

  const history =
    Array.isArray(body.history)
      ? body.history
      : [];

  const safeHistory = history
    .filter(item =>
      item &&
      typeof item.role === "string" &&
      typeof item.content === "string"
    )
    .slice(-12)
    .map(item => ({
      role:
        item.role === "assistant"
          ? "assistant"
          : "user",
      content:
        item.content.slice(0, 6000)
    }));


  const systemPrompt = `
Tu es Briack AI 5, un assistant IA professionnel intégré
dans une plateforme mondiale de création.

Ta mission est d'aider l'utilisateur à :
- créer des images
- créer des vidéos
- transformer des images en vidéos
- écrire des scripts
- créer des voix
- créer des projets multimédias
- trouver des idées
- améliorer des prompts
- organiser des projets créatifs
- comprendre les fonctionnalités de Briack AI 5
- résoudre des problèmes techniques simples

IDENTITÉ :
Tu es professionnel, calme, précis, créatif et honnête.

IMPORTANT :
Tu ne dois jamais prétendre avoir exécuté une action si le backend
ne l'a pas réellement exécutée.

Si l'utilisateur demande une génération d'image, vidéo, audio,
script ou autre fonction qui nécessite un outil spécialisé,
explique brièvement ce qui doit être lancé par l'application.

Ne dis jamais :
"c'est fait"
si aucune génération réelle n'a été exécutée.

LANGUE :
Réponds principalement dans la langue de l'utilisateur.

Langue demandée :
${language}

STYLE :
- réponses naturelles
- pas de réponses artificiellement longues
- explications claires
- priorité à l'action
- pas de jargon inutile
- si plusieurs étapes sont nécessaires, utilise une liste numérotée

BRIACK AI 5 doit être présenté comme une plateforme de création
IA sérieuse, et non comme un simple chatbot.

Tu peux aussi aider l'utilisateur à construire ses propres projets
d'applications, jeux, vidéos et systèmes IA.
`;


  const messages = [
    {
      role: "system",
      content: systemPrompt
    },
    ...safeHistory,
    {
      role: "user",
      content: message
    }
  ];


  try {

    const result = await env.AI.run(
      TEXT_MODEL,
      {
        messages,
        max_tokens: 1200,
        temperature: 0.7
      }
    );


    let answer = "";

    if (typeof result === "string") {
      answer = result;
    } else if (
      result &&
      typeof result.response === "string"
    ) {
      answer = result.response;
    } else if (
      result &&
      typeof result.text === "string"
    ) {
      answer = result.text;
    } else {
      answer = JSON.stringify(result);
    }


    return json({
      success: true,
      type: "chat",
      model: TEXT_MODEL,
      message: answer,
      response: answer
    });

  } catch (err) {

    return error(
      "Erreur lors de la génération de la réponse IA.",
      502,
      err instanceof Error
        ? err.message
        : String(err)
    );
  }
}


/* ============================================================
   SCRIPT → TEXTE
   ============================================================ */

async function generateScript(request, env) {

  if (!env.AI) {
    return error(
      "La liaison Workers AI n'est pas configurée.",
      500
    );
  }

  const body = await readJSON(request);

  if (!body) {
    return error("JSON invalide.");
  }

  const topic =
    typeof body.topic === "string"
      ? body.topic.trim()
      : "";

  if (!topic) {
    return error("Le sujet du script est obligatoire.");
  }

  if (topic.length > 8000) {
    return error("Sujet trop long.");
  }

  const language =
    typeof body.language === "string"
      ? body.language
      : "fr";

  const duration =
    body.duration || "60 secondes";

  const style =
    body.style || "documentaire réaliste";


  const prompt = `
Crée un script vidéo professionnel.

Sujet :
${topic}

Langue :
${language}

Durée souhaitée :
${duration}

Style :
${style}

Structure :
1. Accroche forte
2. Introduction
3. Développement
4. Informations importantes
5. Conclusion
6. Appel à l'action naturel

Le script doit être fluide et adapté à une narration vidéo.
Ne fabrique pas de faits présentés comme certains.
`;


  try {

    const result = await env.AI.run(
      TEXT_MODEL,
      {
        prompt,
        max_tokens: 1800,
        temperature: 0.7
      }
    );


    const script =
      typeof result === "string"
        ? result
        : result?.response ||
          result?.text ||
          JSON.stringify(result);


    return json({
      success: true,
      type: "script",
      model: TEXT_MODEL,
      script
    });

  } catch (err) {

    return error(
      "Erreur pendant la génération du script.",
      502,
      err instanceof Error
        ? err.message
        : String(err)
    );
  }
}


/* ============================================================
   IMAGE IA
   ============================================================ */

async function generateImage(request, env) {

  if (!env.AI) {
    return error(
      "La liaison Workers AI n'est pas configurée.",
      500
    );
  }

  const body = await readJSON(request);

  if (!body) {
    return error("JSON invalide.");
  }

  const prompt =
    typeof body.prompt === "string"
      ? body.prompt.trim()
      : "";

  if (!prompt) {
    return error("Le prompt image est obligatoire.");
  }

  if (prompt.length > 8000) {
    return error("Prompt trop long.");
  }


  try {

    const result = await env.AI.run(
      IMAGE_MODEL,
      {
        prompt
      }
    );


    if (!result) {
      return error(
        "Le modèle image n'a retourné aucun résultat.",
        502
      );
    }


    let imageBase64 = null;


    if (typeof result === "string") {
      imageBase64 = result;
    }


    if (
      result &&
      typeof result.image === "string"
    ) {
      imageBase64 = result.image;
    }


    if (!imageBase64) {
      return json({
        success: true,
        type: "image",
        model: IMAGE_MODEL,
        result
      });
    }


    const imageData =
      imageBase64.startsWith("data:")
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;


    return json({
      success: true,
      type: "image",
      model: IMAGE_MODEL,
      image: imageData
    });

  } catch (err) {

    return error(
      "Erreur pendant la génération de l'image.",
      502,
      err instanceof Error
        ? err.message
        : String(err)
    );
  }
}


/* ============================================================
   AUDIO / TTS
   ============================================================ */

async function generateAudio(request, env) {

  if (!env.AI) {
    return error(
      "La liaison Workers AI n'est pas configurée.",
      500
    );
  }

  const body = await readJSON(request);

  if (!body) {
    return error("JSON invalide.");
  }

  const text =
    typeof body.text === "string"
      ? body.text.trim()
      : "";

  if (!text) {
    return error(
      "Le texte à convertir en audio est obligatoire."
    );
  }

  if (text.length > 10000) {
    return error(
      "Texte audio trop long. Maximum 10000 caractères."
    );
  }


  /*
   * Modèle TTS Cloudflare.
   *
   * On garde la route prête et séparée afin de pouvoir
   * changer le modèle TTS sans toucher à l'application.
   */

  const model =
    typeof body.model === "string" &&
    body.model.trim()
      ? body.model.trim()
      : "@cf/myshell-ai/melotts";


  try {

    const input = {
      text
    };


    const result = await env.AI.run(
      model,
      input
    );


    /*
     * Certains modèles audio retournent :
     *
     * { audio: "base64..." }
     *
     * ou directement une chaîne.
     */

    let audio = null;


    if (
      result &&
      typeof result.audio === "string"
    ) {
      audio = result.audio;
    }


    if (typeof result === "string") {
      audio = result;
    }


    if (!audio) {

      return json({
        success: true,
        type: "audio",
        model,
        result
      });
    }


    return json({
      success: true,
      type: "audio",
      model,
      audio
    });

  } catch (err) {

    return error(
      "Erreur pendant la génération audio.",
      502,
      err instanceof Error
        ? err.message
        : String(err)
    );
  }
}


/* ============================================================
   IMAGE → VIDEO
   ============================================================ */

async function generateVideo(request, env) {

  if (!env.REPLICATE_API_TOKEN) {
    return error(
      "REPLICATE_API_TOKEN n'est pas configuré.",
      500
    );
  }


  const body = await readJSON(request);

  if (!body) {
    return error("JSON invalide.");
  }


  const image =
    typeof body.image === "string"
      ? body.image.trim()
      : "";

  const prompt =
    typeof body.prompt === "string"
      ? body.prompt.trim()
      : "";


  if (!image) {
    return error(
      "Une image est obligatoire pour la génération vidéo."
    );
  }


  const duration = clamp(
    Number(body.duration || 5),
    2,
    15
  );


  const resolution =
    body.resolution === "1080p"
      ? "1080p"
      : "720p";


  const input = {
    image,
    prompt,
    duration,
    resolution
  };


  try {

    const response = await fetch(
      REPLICATE_API,
      {
        method: "POST",

        headers: {
          "Authorization":
            `Bearer ${env.REPLICATE_API_TOKEN}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          input
        })
      }
    );


    const data = await response.json();


    if (!response.ok) {

      return error(
        "Replicate a refusé la génération vidéo.",
        response.status,
        data
      );
    }


    return json({
      success: true,
      type: "video",
      status: data.status,
      id: data.id,
      urls: data.urls || null,
      prediction: data
    });

  } catch (err) {

    return error(
      "Impossible de contacter le service vidéo.",
      502,
      err instanceof Error
        ? err.message
        : String(err)
    );
  }
}


/* ============================================================
   VIDEO STATUS
   ============================================================ */

async function videoStatus(request, env) {

  if (!env.REPLICATE_API_TOKEN) {
    return error(
      "REPLICATE_API_TOKEN n'est pas configuré.",
      500
    );
  }


  const url =
    new URL(request.url);

  const id =
    url.searchParams.get("id");


  if (!id) {
    return error(
      "L'identifiant de la vidéo est obligatoire."
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


    if (!response.ok) {

      return error(
        "Impossible de récupérer le statut vidéo.",
        response.status,
        data
      );
    }


    return json({
      success: true,
      type: "video-status",
      id,
      status: data.status,
      output: data.output || null,
      error: data.error || null,
      prediction: data
    });

  } catch (err) {

    return error(
      "Erreur pendant la vérification vidéo.",
      502,
      err instanceof Error
        ? err.message
        : String(err)
    );
  }
}


/* ============================================================
   ROUTEUR PRINCIPAL
   ============================================================ */

export default {

  async fetch(request, env) {

    if (request.method === "OPTIONS") {
      return handleOptions();
    }


    const url =
      new URL(request.url);

    const path =
      url.pathname;


    try {

      /* ---------------- HEALTH ---------------- */

      if (
        request.method === "GET" &&
        path === "/health"
      ) {
        return await health(env);
      }


      /* ---------------- CHAT ---------------- */

      if (
        request.method === "POST" &&
        path === "/chat"
      ) {
        return await chat(request, env);
      }


      /* ---------------- SCRIPT ---------------- */

      if (
        request.method === "POST" &&
        path === "/generate-script"
      ) {
        return await generateScript(
          request,
          env
        );
      }


      /* ---------------- IMAGE ---------------- */

      if (
        request.method === "POST" &&
        path === "/generate-image"
      ) {
        return await generateImage(
          request,
          env
        );
      }


      /* ---------------- AUDIO ---------------- */

      if (
        request.method === "POST" &&
        path === "/generate-audio"
      ) {
        return await generateAudio(
          request,
          env
        );
      }


      /* ---------------- VIDEO ---------------- */

      if (
        request.method === "POST" &&
        path === "/generate-video"
      ) {
        return await generateVideo(
          request,
          env
        );
      }


      /* ---------------- VIDEO STATUS ---------------- */

      if (
        request.method === "GET" &&
        path === "/video-status"
      ) {
        return await videoStatus(
          request,
          env
        );
      }


      /* ---------------- 404 ---------------- */

      return error(
        "Route introuvable.",
        404
      );

    } catch (err) {

      return error(
        "Erreur interne du Worker.",
        500,
        err instanceof Error
          ? err.message
          : String(err)
      );
    }
  }
};
