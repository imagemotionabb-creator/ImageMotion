/*
===========================================================
 BRIACK AI 5 — BACKEND WORKER
===========================================================

Routes actuellement disponibles :

GET  /health
POST /chat
POST /generate-image
POST /generate-audio
POST /generate-video
GET  /video-status?id=...

===========================================================
ENVIRONMENT / CLOUDFLARE
===========================================================

Required binding:

AI = Workers AI

Required secret for video:

REPLICATE_API_TOKEN

===========================================================
*/

const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

const CHAT_MODEL =
  "@cf/meta/llama-3.1-8b-instruct-fast";

const AUDIO_MODEL =
  "@cf/deepgram/aura-1";

const REPLICATE_VIDEO_URL =
  "https://api.replicate.com/v1/models/wan-video/wan-2.7-i2v/predictions";


/* =========================================================
   CORS
========================================================= */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}


/* =========================================================
   JSON RESPONSE
========================================================= */

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        ...corsHeaders()
      }
    }
  );
}


/* =========================================================
   TEXT RESPONSE
========================================================= */

function textResponse(text, status = 200) {
  return new Response(text, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      ...corsHeaders()
    }
  });
}


/* =========================================================
   OPTIONS
========================================================= */

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}


/* =========================================================
   SAFE JSON BODY
========================================================= */

async function readJson(request) {

  try {

    return await request.json();

  } catch (error) {

    throw new Error(
      "Le corps de la requête doit être un JSON valide."
    );

  }

}


/* =========================================================
   CHAT — BRIACK AI 5
========================================================= */

async function generateChat(request, env) {

  const body = await readJson(request);

  const message =
    typeof body.message === "string"
      ? body.message.trim()
      : "";

  const history =
    Array.isArray(body.history)
      ? body.history
      : [];

  const language =
    typeof body.language === "string"
      ? body.language
      : "fr";

  if (!message) {

    return jsonResponse(
      {
        success: false,
        error: "Le message est vide."
      },
      400
    );

  }


  /*
  ---------------------------------------------------------
  Limite raisonnable côté Worker.
  ---------------------------------------------------------
  */

  const cleanHistory = history
    .slice(-12)
    .map(item => {

      const role =
        item && item.role === "assistant"
          ? "assistant"
          : "user";

      const content =
        item && typeof item.content === "string"
          ? item.content.slice(0, 8000)
          : "";

      return {
        role,
        content
      };

    })
    .filter(item => item.content);


  /*
  ---------------------------------------------------------
  SYSTEM PROMPT
  ---------------------------------------------------------
  */

  const systemPrompt = `
Tu es l'assistant officiel de Briack AI 5.

Briack AI 5 est une plateforme de création utilisant
l'intelligence artificielle.

Tu dois être :

- intelligent
- clair
- honnête
- professionnel
- utile
- naturel
- concis quand la question est simple
- détaillé quand la tâche le nécessite

Tu peux aider l'utilisateur à :

- créer des images
- créer des vidéos
- transformer une image en vidéo
- écrire des scripts
- préparer des projets vidéo
- créer des textes
- préparer des voix
- préparer des idées musicales
- organiser des créations
- expliquer les fonctions de Briack AI 5
- résoudre des problèmes techniques

IMPORTANT :

Ne prétends jamais avoir effectué une action si le backend
ne l'a pas réellement effectuée.

Si une fonction n'est pas encore disponible, dis-le
clairement.

Ne prétends pas avoir généré une image, une vidéo ou un
audio si aucune génération réelle n'a été effectuée.

Réponds dans la langue demandée par l'utilisateur.

Langue préférée actuelle :
${language}

Tu es un assistant de création, pas seulement un chatbot.
Aide l'utilisateur à transformer ses idées en projets
réalisables.
`;


  /*
  ---------------------------------------------------------
  Messages
  ---------------------------------------------------------
  */

  const messages = [

    {
      role: "system",
      content: systemPrompt
    },

    ...cleanHistory,

    {
      role: "user",
      content: message
    }

  ];


  /*
  ---------------------------------------------------------
  Workers AI
  ---------------------------------------------------------
  */

  try {

    const result = await env.AI.run(
      CHAT_MODEL,
      {
        messages,

        max_tokens: 700,

        temperature: 0.7,

        repetition_penalty: 1.05
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
      result.result &&
      typeof result.result.response === "string"
    ) {

      answer = result.result.response;

    }


    if (!answer) {

      return jsonResponse(
        {
          success: false,
          error:
            "Le modèle IA n'a pas renvoyé de texte.",
          raw: result
        },
        502
      );

    }


    return jsonResponse({
      success: true,
      type: "chat",
      model: CHAT_MODEL,
      answer
    });


  } catch (error) {

    return jsonResponse(
      {
        success: false,
        error:
          "Erreur pendant la génération du chat.",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      },
      502
    );

  }

}


/* =========================================================
   IMAGE
========================================================= */

async function generateImage(request, env) {

  const body = await readJson(request);

  const prompt =
    typeof body.prompt === "string"
      ? body.prompt.trim()
      : "";

  if (!prompt) {

    return jsonResponse(
      {
        success: false,
        error: "Le prompt image est vide."
      },
      400
    );

  }


  try {

    const result = await env.AI.run(
      IMAGE_MODEL,
      {
        prompt
      }
    );


    if (
      !result ||
      !result.image
    ) {

      return jsonResponse(
        {
          success: false,
          error:
            "Le modèle image n'a pas renvoyé d'image."
        },
        502
      );

    }


    return jsonResponse({

      success: true,

      type: "image",

      model: IMAGE_MODEL,

      image:
        "data:image/jpeg;base64," +
        result.image

    });


  } catch (error) {

    return jsonResponse(
      {
        success: false,
        error:
          "Erreur pendant la génération de l'image.",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      },
      502
    );

  }

}


/* =========================================================
   AUDIO / TEXT TO SPEECH
========================================================= */

async function generateAudio(request, env) {

  const body = await readJson(request);

  const text =
    typeof body.text === "string"
      ? body.text.trim()
      : "";

  if (!text) {

    return jsonResponse(
      {
        success: false,
        error: "Le texte audio est vide."
      },
      400
    );

  }


  if (text.length > 5000) {

    return jsonResponse(
      {
        success: false,
        error:
          "Le texte audio est trop long. Maximum : 5000 caractères."
      },
      400
    );

  }


  try {

    const audioResponse = await env.AI.run(
      AUDIO_MODEL,
      {
        text
      },
      {
        returnRawResponse: true
      }
    );


    /*
    -------------------------------------------------------
    Cloudflare peut retourner directement une Response.
    -------------------------------------------------------
    */

    if (audioResponse instanceof Response) {

      const contentType =
        audioResponse.headers.get(
          "content-type"
        ) ||
        "audio/wav";


      const buffer =
        await audioResponse.arrayBuffer();


      const bytes =
        new Uint8Array(buffer);


      let binary = "";

      const chunkSize = 0x8000;


      for (
        let i = 0;
        i < bytes.length;
        i += chunkSize
      ) {

        const chunk =
          bytes.subarray(
            i,
            Math.min(
              i + chunkSize,
              bytes.length
            )
          );

        binary += String.fromCharCode(
          ...chunk
        );

      }


      const base64 =
        btoa(binary);


      return jsonResponse({

        success: true,

        type: "audio",

        model: AUDIO_MODEL,

        mimeType: contentType,

        audio:
          "data:" +
          contentType +
          ";base64," +
          base64

      });

    }


    /*
    -------------------------------------------------------
    Cas où le modèle retourne un objet.
    -------------------------------------------------------
    */

    return jsonResponse({

      success: true,

      type: "audio",

      model: AUDIO_MODEL,

      result: audioResponse

    });


  } catch (error) {

    return jsonResponse(
      {
        success: false,
        error:
          "Erreur pendant la génération audio.",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      },
      502
    );

  }

}


/* =========================================================
   VIDEO
========================================================= */

async function generateVideo(request, env) {

  const body = await readJson(request);

  const prompt =
    typeof body.prompt === "string"
      ? body.prompt.trim()
      : "";

  const image =
    typeof body.image === "string"
      ? body.image
      : null;

  const duration =
    Number(body.duration || 5);

  const resolution =
    typeof body.resolution === "string"
      ? body.resolution
      : "720p";


  if (!prompt && !image) {

    return jsonResponse(
      {
        success: false,
        error:
          "Un prompt ou une image est nécessaire."
      },
      400
    );

  }


  if (!env.REPLICATE_API_TOKEN) {

    return jsonResponse(
      {
        success: false,
        error:
          "REPLICATE_API_TOKEN n'est pas configuré."
      },
      500
    );

  }


  const safeDuration =
    Math.min(
      Math.max(
        Math.round(duration),
        2
      ),
      15
    );


  const safeResolution =
    resolution === "1080p"
      ? "1080p"
      : "720p";


  const input = {

    prompt:
      prompt ||
      "Animate this image naturally.",

    duration:
      safeDuration,

    resolution:
      safeResolution

  };


  /*
  ---------------------------------------------------------
  Image optionnelle.
  ---------------------------------------------------------
  */

  if (image) {

    input.image = image;

  }


  try {

    const response =
      await fetch(
        REPLICATE_VIDEO_URL,
        {

          method: "POST",

          headers: {

            "Authorization":
              "Bearer " +
              env.REPLICATE_API_TOKEN,

            "Content-Type":
              "application/json",

            "Prefer":
              "wait"

          },

          body:
            JSON.stringify({
              input
            })

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      return jsonResponse(
        {
          success: false,
          error:
            "Replicate a refusé la génération vidéo.",
          details: data
        },
        response.status
      );

    }


    return jsonResponse({

      success: true,

      type: "video",

      id: data.id || null,

      status:
        data.status || "starting",

      output:
        data.output || null,

      urls: {

        get:
          data.urls &&
          data.urls.get
            ? data.urls.get
            : null,

        cancel:
          data.urls &&
          data.urls.cancel
            ? data.urls.cancel
            : null

      }

    });


  } catch (error) {

    return jsonResponse(
      {
        success: false,
        error:
          "Erreur de connexion au service vidéo.",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      },
      502
    );

  }

}


/* =========================================================
   VIDEO STATUS
========================================================= */

async function videoStatus(request, env) {

  const url =
    new URL(request.url);

  const id =
    url.searchParams.get("id");


  if (!id) {

    return jsonResponse(
      {
        success: false,
        error:
          "Paramètre id manquant."
      },
      400
    );

  }


  if (!env.REPLICATE_API_TOKEN) {

    return jsonResponse(
      {
        success: false,
        error:
          "REPLICATE_API_TOKEN n'est pas configuré."
      },
      500
    );

  }


  try {

    const response =
      await fetch(
        "https://api.replicate.com/v1/predictions/" +
        encodeURIComponent(id),
        {

          method: "GET",

          headers: {

            "Authorization":
              "Bearer " +
              env.REPLICATE_API_TOKEN,

            "Content-Type":
              "application/json"

          }

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      return jsonResponse(
        {
          success: false,
          error:
            "Impossible de récupérer le statut vidéo.",
          details: data
        },
        response.status
      );

    }


    return jsonResponse({

      success: true,

      id: data.id,

      status:
        data.status || null,

      output:
        data.output || null,

      error:
        data.error || null,

      logs:
        data.logs || null,

      created_at:
        data.created_at || null,

      started_at:
        data.started_at || null,

      completed_at:
        data.completed_at || null

    });


  } catch (error) {

    return jsonResponse(
      {
        success: false,
        error:
          "Erreur pendant la vérification vidéo.",
        details:
          error instanceof Error
            ? error.message
            : String(error)
      },
      502
    );

  }

}


/* =========================================================
   HEALTH CHECK
========================================================= */

async function healthCheck(env) {

  return jsonResponse({

    success: true,

    service:
      "Briack AI 5 Backend",

    status:
      "online",

    workersAI:
      !!env.AI,

    replicate:
      !!env.REPLICATE_API_TOKEN,

    routes: [

      "/health",

      "/chat",

      "/generate-image",

      "/generate-audio",

      "/generate-video",

      "/video-status"

    ],

    models: {

      chat:
        CHAT_MODEL,

      image:
        IMAGE_MODEL,

      audio:
        AUDIO_MODEL

    },

    timestamp:
      new Date().toISOString()

  });

}


/* =========================================================
   MAIN FETCH
========================================================= */

export default {

  async fetch(request, env) {

    try {

      if (
        request.method === "OPTIONS"
      ) {

        return handleOptions();

      }


      const url =
        new URL(request.url);

      const path =
        url.pathname;


      /*
      -------------------------------------------------------
      HEALTH
      -------------------------------------------------------
      */

      if (
        path === "/health" &&
        request.method === "GET"
      ) {

        return healthCheck(env);

      }


      /*
      -------------------------------------------------------
      CHAT
      -------------------------------------------------------
      */

      if (
        path === "/chat" &&
        request.method === "POST"
      ) {

        return generateChat(
          request,
          env
        );

      }


      /*
      -------------------------------------------------------
      IMAGE
      -------------------------------------------------------
      */

      if (
        path === "/generate-image" &&
        request.method === "POST"
      ) {

        return generateImage(
          request,
          env
        );

      }


      /*
      -------------------------------------------------------
      AUDIO
      -------------------------------------------------------
      */

      if (
        path === "/generate-audio" &&
        request.method === "POST"
      ) {

        return generateAudio(
          request,
          env
        );

      }


      /*
      -------------------------------------------------------
      VIDEO
      -------------------------------------------------------
      */

      if (
        path === "/generate-video" &&
        request.method === "POST"
      ) {

        return generateVideo(
          request,
          env
        );

      }


      /*
      -------------------------------------------------------
      VIDEO STATUS
      -------------------------------------------------------
      */

      if (
        path === "/video-status" &&
        request.method === "GET"
      ) {

        return videoStatus(
          request,
          env
        );

      }


      /*
      -------------------------------------------------------
      404
      -------------------------------------------------------
      */

      return jsonResponse(
        {
          success: false,
          error:
            "Route introuvable.",
          path
        },
        404
      );


    } catch (error) {

      return jsonResponse(
        {
          success: false,
          error:
            "Erreur interne du Worker.",
          details:
            error instanceof Error
              ? error.message
              : String(error)
        },
        500
      );

    }

  }

};
