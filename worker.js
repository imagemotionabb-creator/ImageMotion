const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    };

    // ==============================
    // CORS
    // ==============================

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    try {

      // ==============================
      // ACCUEIL
      // ==============================

      if (url.pathname === "/") {
        return jsonResponse(
          {
            success: true,
            application: "Briack AI 5",
            service: "Briack AI 5 API",
            status: "online",
            version: "3.1.0",
            workersAI: Boolean(env.AI)
          },
          corsHeaders
        );
      }


      // ==============================
      // HEALTH
      // ==============================

      if (url.pathname === "/health") {
        return jsonResponse(
          {
            success: true,
            status: "healthy",
            workersAI: Boolean(env.AI),
            timestamp: new Date().toISOString()
          },
          corsHeaders
        );
      }


      // ==============================
      // VERIFICATION DU BINDING
      // ==============================

      if (!env.AI) {
        return jsonResponse(
          {
            success: false,
            error: "Le binding Workers AI 'AI' est introuvable."
          },
          corsHeaders,
          500
        );
      }


      // ==============================
      // TEST WORKERS AI
      // ==============================

      if (url.pathname === "/test-ai") {

        if (request.method !== "POST") {
          return jsonResponse(
            {
              success: false,
              error: "Cette route utilise POST."
            },
            corsHeaders,
            405
          );
        }

        let body = {};

        try {
          body = await request.json();
        } catch {
          body = {};
        }

        const prompt =
          typeof body.prompt === "string" &&
          body.prompt.trim()
            ? body.prompt.trim()
            : "Réponds uniquement : Briack AI 5 fonctionne.";

        const result = await env.AI.run(
          TEXT_MODEL,
          {
            prompt: prompt,
            max_tokens: 100
          }
        );

        return jsonResponse(
          {
            success: true,
            message: "Workers AI fonctionne.",
            model: TEXT_MODEL,
            response: result?.response || "",
            raw: result
          },
          corsHeaders
        );
      }


      // ==============================
      // CHAT IA
      // ==============================

      if (url.pathname === "/chat") {

        if (request.method !== "POST") {
          return jsonResponse(
            {
              success: false,
              error: "Cette route utilise POST."
            },
            corsHeaders,
            405
          );
        }

        let body;

        try {
          body = await request.json();
        } catch {
          return jsonResponse(
            {
              success: false,
              error: "Le corps de la requête doit être un JSON valide."
            },
            corsHeaders,
            400
          );
        }

        const message =
          typeof body?.message === "string"
            ? body.message.trim()
            : "";

        if (!message) {
          return jsonResponse(
            {
              success: false,
              error: "Le message est obligatoire."
            },
            corsHeaders,
            400
          );
        }

        if (message.length > 12000) {
          return jsonResponse(
            {
              success: false,
              error: "Le message est trop long."
            },
            corsHeaders,
            400
          );
        }

        const result = await env.AI.run(
          TEXT_MODEL,
          {
            prompt:
              "Tu es Briack AI 5, un assistant créatif " +
              "professionnel et honnête. " +
              "Tu aides l'utilisateur à créer des images, " +
              "vidéos, scripts, voix, musiques et projets créatifs. " +
              "Tu ne prétends jamais qu'une fonction fonctionne " +
              "si elle n'est pas réellement disponible. " +
              "Réponds dans la langue de l'utilisateur.\n\n" +
              "Utilisateur :\n" +
              message,
            max_tokens: 700,
            temperature: 0.7
          }
        );

        return jsonResponse(
          {
            success: true,
            model: TEXT_MODEL,
            response: result?.response || "",
            raw: result
          },
          corsHeaders
        );
      }


      // ==============================
      // GENERATION DE SCRIPT
      // ==============================

      if (url.pathname === "/generate-script") {

        if (request.method !== "POST") {
          return jsonResponse(
            {
              success: false,
              error: "Cette route utilise POST."
            },
            corsHeaders,
            405
          );
        }

        let body;

        try {
          body = await request.json();
        } catch {
          return jsonResponse(
            {
              success: false,
              error: "JSON invalide."
            },
            corsHeaders,
            400
          );
        }

        const subject =
          typeof body?.prompt === "string"
            ? body.prompt.trim()
            : "";

        if (!subject) {
          return jsonResponse(
            {
              success: false,
              error: "Le sujet du script est obligatoire."
            },
            corsHeaders,
            400
          );
        }

        if (subject.length > 12000) {
          return jsonResponse(
            {
              success: false,
              error: "Le sujet est trop long."
            },
            corsHeaders,
            400
          );
        }

        const result = await env.AI.run(
          TEXT_MODEL,
          {
            prompt:
              "Tu es le moteur de génération de scripts " +
              "de Briack AI 5.\n\n" +
              "Crée un script captivant, naturel, " +
              "bien structuré et adapté au sujet suivant.\n\n" +
              "Sujet :\n" +
              subject,
            max_tokens: 1500,
            temperature: 0.8
          }
        );

        return jsonResponse(
          {
            success: true,
            model: TEXT_MODEL,
            script: result?.response || "",
            raw: result
          },
          corsHeaders
        );
      }


      // ==============================
      // GENERATION D'IMAGE
      // ==============================

      if (url.pathname === "/generate-image") {

        if (request.method !== "POST") {
          return jsonResponse(
            {
              success: false,
              error: "Cette route utilise POST."
            },
            corsHeaders,
            405
          );
        }

        let body;

        try {
          body = await request.json();
        } catch {
          return jsonResponse(
            {
              success: false,
              error: "Le corps de la requête doit être un JSON valide."
            },
            corsHeaders,
            400
          );
        }

        const prompt =
          typeof body?.prompt === "string"
            ? body.prompt.trim()
            : "";

        if (!prompt) {
          return jsonResponse(
            {
              success: false,
              error: "Le prompt est obligatoire."
            },
            corsHeaders,
            400
          );
        }

        if (prompt.length > 2048) {
          return jsonResponse(
            {
              success: false,
              error: "Le prompt est trop long. Maximum : 2048 caractères."
            },
            corsHeaders,
            400
          );
        }

        try {

          const result = await env.AI.run(
            IMAGE_MODEL,
            {
              prompt: prompt,
              steps: 4
            }
          );

          if (
            !result ||
            typeof result.image !== "string" ||
            result.image.length === 0
          ) {

            console.error(
              "Réponse FLUX invalide :",
              result
            );

            return jsonResponse(
              {
                success: false,
                error: "FLUX n'a pas renvoyé d'image."
              },
              corsHeaders,
              500
            );
          }

          let binaryString;

          try {

            binaryString = atob(result.image);

          } catch (error) {

            console.error(
              "Erreur de décodage Base64 :",
              error
            );

            return jsonResponse(
              {
                success: false,
                error: "L'image FLUX reçue est invalide."
              },
              corsHeaders,
              500
            );
          }

          const imageBytes = Uint8Array.from(
            binaryString,
            character => character.charCodeAt(0)
          );

          if (imageBytes.length === 0) {

            return jsonResponse(
              {
                success: false,
                error: "FLUX a renvoyé une image vide."
              },
              corsHeaders,
              500
            );
          }

          return new Response(
            imageBytes,
            {
              status: 200,
              headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "no-store",
                ...corsHeaders
              }
            }
          );

        } catch (error) {

          console.error(
            "Erreur FLUX :",
            error
          );

          return jsonResponse(
            {
              success: false,
              error: "La génération de l'image a échoué.",
              details: String(
                error?.message ||
                error ||
                "Erreur inconnue"
              )
            },
            corsHeaders,
            500
          );
        }
      }


      // ==============================
      // VIDEO — PREPARATION
      // ==============================

      if (
        url.pathname === "/generate-video" ||
        url.pathname === "/video-status" ||
        url.pathname === "/video-result"
      ) {

        return jsonResponse(
          {
            success: false,
            available: false,
            service: "video",
            error:
              "Le moteur vidéo n'est pas encore connecté."
          },
          corsHeaders,
          501
        );
      }


      // ==============================
      // VOIX — PREPARATION
      // ==============================

      if (
        url.pathname === "/generate-voice" ||
        url.pathname === "/voice-status" ||
        url.pathname === "/voice-result"
      ) {

        return jsonResponse(
          {
            success: false,
            available: false,
            service: "voice",
            error:
              "Le moteur vocal n'est pas encore connecté."
          },
          corsHeaders,
          501
        );
      }


      // ==============================
      // MUSIQUE — PREPARATION
      // ==============================

      if (url.pathname === "/generate-music") {

        return jsonResponse(
          {
            success: false,
            available: false,
            service: "music",
            error:
              "Le moteur musical n'est pas encore connecté."
          },
          corsHeaders,
          501
        );
      }


      // ==============================
      // ROUTE INCONNUE
      // ==============================

      return jsonResponse(
        {
          success: false,
          error: "Route introuvable.",
          path: url.pathname
        },
        corsHeaders,
        404
      );

    } catch (error) {

      console.error(
        "Erreur générale du Worker :",
        error
      );

      return jsonResponse(
        {
          success: false,
          error: "Erreur interne du Worker.",
          details: String(
            error?.message ||
            error ||
            "Erreur inconnue"
          )
        },
        corsHeaders,
        500
      );
    }
  }
};


// ========================================
// FONCTION REPONSE JSON
// ========================================

function jsonResponse(
  data,
  corsHeaders,
  status = 200
) {

  return new Response(
    JSON.stringify(data),
    {
      status: status,
      headers: {
        "Content-Type":
          "application/json; charset=UTF-8",
        ...corsHeaders
      }
    }
  );
}
