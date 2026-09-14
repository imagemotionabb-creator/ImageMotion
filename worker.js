export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    };

    // =========================
    // CORS PREFLIGHT
    // =========================
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    try {

      // =========================
      // ROUTE PRINCIPALE
      // =========================
      if (url.pathname === "/") {
        return jsonResponse({
          success: true,
          application: "Briack AI 5",
          service: "Briack AI 5 API",
          status: "online",
          version: "3.0.0",
          workersAI: Boolean(env.AI)
        }, corsHeaders);
      }


      // =========================
      // HEALTH CHECK
      // =========================
      if (url.pathname === "/health") {
        return jsonResponse({
          success: true,
          status: "healthy",
          workersAI: Boolean(env.AI),
          timestamp: new Date().toISOString()
        }, corsHeaders);
      }


      // =========================
      // VERIFICATION DU BINDING AI
      // =========================
      if (!env.AI) {
        return jsonResponse({
          success: false,
          error: "Le binding Workers AI 'AI' est introuvable.",
          solution: "Vérifie que ton Worker possède un binding Workers AI nommé AI."
        }, corsHeaders, 500);
      }


      // =========================
      // TEST WORKERS AI
      // =========================
      if (url.pathname === "/test-ai") {

        if (request.method !== "POST") {
          return jsonResponse({
            success: false,
            error: "Cette route utilise POST."
          }, corsHeaders, 405);
        }

        const result = await env.AI.run(
          "@cf/meta/llama-3.1-8b-instruct",
          {
            prompt: "Réponds uniquement : Briack AI 5 fonctionne."
          }
        );

        return jsonResponse({
          success: true,
          message: "Workers AI fonctionne.",
          result: result
        }, corsHeaders);
      }


      // =========================
      // GENERATION D'IMAGE
      // =========================
      if (url.pathname === "/generate-image") {

        if (request.method !== "POST") {
          return jsonResponse({
            success: false,
            error: "Cette route utilise POST."
          }, corsHeaders, 405);
        }

        let body;

        try {
          body = await request.json();
        } catch {
          return jsonResponse({
            success: false,
            error: "Le corps de la requête doit être un JSON valide."
          }, corsHeaders, 400);
        }

        const prompt =
          typeof body?.prompt === "string"
            ? body.prompt.trim()
            : "";

        if (!prompt) {
          return jsonResponse({
            success: false,
            error: "Le prompt est obligatoire."
          }, corsHeaders, 400);
        }

        if (prompt.length > 2048) {
          return jsonResponse({
            success: false,
            error: "Le prompt est trop long. Maximum : 2048 caractères."
          }, corsHeaders, 400);
        }

        try {

          const result = await env.AI.run(
            "@cf/black-forest-labs/flux-1-schnell",
            {
              prompt: prompt,
              steps: 4
            }
          );

          // =========================
          // CAS 1 : REPONSE BASE64
          // =========================
          if (
            result &&
            typeof result.image === "string" &&
            result.image.length > 0
          ) {

            let binaryString;

            try {
              binaryString = atob(result.image);
            } catch (decodeError) {
              console.error(
                "Erreur Base64 FLUX:",
                decodeError
              );

              return jsonResponse({
                success: false,
                error: "FLUX a renvoyé une image Base64 invalide."
              }, corsHeaders, 500);
            }

            const imageBytes = Uint8Array.from(
              binaryString,
              character => character.charCodeAt(0)
            );

            if (!imageBytes.length) {
              return jsonResponse({
                success: false,
                error: "FLUX a renvoyé une image vide."
              }, corsHeaders, 500);
            }

            return new Response(imageBytes, {
              status: 200,
              headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "no-store",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
              }
            });
          }


          // =========================
          // CAS 2 : REPONSE DE TYPE RESPONSE
          // =========================
          if (result instanceof Response) {

            const contentType =
              result.headers.get("content-type") || "";

            if (contentType.startsWith("image/")) {

              const imageData =
                await result.arrayBuffer();

              return new Response(imageData, {
                status: 200,
                headers: {
                  "Content-Type": contentType,
                  "Cache-Control": "no-store",
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                  "Access-Control-Allow-Headers": "Content-Type, Authorization"
                }
              });
            }
          }


          // =========================
          // REPONSE INATTENDUE
          // =========================
          console.error(
            "Réponse FLUX inattendue:",
            result
          );

          return jsonResponse({
            success: false,
            error: "FLUX n'a pas renvoyé une image exploitable."
          }, corsHeaders, 500);

        } catch (error) {

          console.error(
            "Erreur Workers AI FLUX:",
            error
          );

          return jsonResponse({
            success: false,
            error: "La génération d'image a échoué.",
            details: String(
              error?.message ||
              error ||
              "Erreur inconnue"
            )
          }, corsHeaders, 500);
        }
      }


      // =========================
      // GENERATION DE SCRIPT
      // =========================
      if (url.pathname === "/generate-script") {

        if (request.method !== "POST") {
          return jsonResponse({
            success: false,
            error: "Cette route utilise POST."
          }, corsHeaders, 405);
        }

        let body;

        try {
          body = await request.json();
        } catch {
          return jsonResponse({
            success: false,
            error: "JSON invalide."
          }, corsHeaders, 400);
        }

        const prompt =
          typeof body?.prompt === "string"
            ? body.prompt.trim()
            : "";

        if (!prompt) {
          return jsonResponse({
            success: false,
            error: "Le sujet du script est obligatoire."
          }, corsHeaders, 400);
        }

        if (prompt.length > 6000) {
          return jsonResponse({
            success: false,
            error: "Le texte demandé est trop long."
          }, corsHeaders, 400);
        }

        try {

          const result = await env.AI.run(
            "@cf/meta/llama-3.1-8b-instruct",
            {
              prompt:
                "Tu es l'assistant créatif de Briack AI 5. " +
                "Crée un script clair, captivant et structuré. " +
                "Sujet : " +
                prompt
            }
          );

          return jsonResponse({
            success: true,
            script:
              result?.response ||
              result?.text ||
              "",
            raw: result
          }, corsHeaders);

        } catch (error) {

          console.error(
            "Erreur génération script:",
            error
          );

          return jsonResponse({
            success: false,
            error: "La génération du script a échoué.",
            details: String(
              error?.message ||
              error ||
              "Erreur inconnue"
            )
          }, corsHeaders, 500);
        }
      }


      // =========================
      // CHAT IA
      // =========================
      if (url.pathname === "/chat") {

        if (request.method !== "POST") {
          return jsonResponse({
            success: false,
            error: "Cette route utilise POST."
          }, corsHeaders, 405);
        }

        let body;

        try {
          body = await request.json();
        } catch {
          return jsonResponse({
            success: false,
            error: "JSON invalide."
          }, corsHeaders, 400);
        }

        const message =
          typeof body?.message === "string"
            ? body.message.trim()
            : "";

        if (!message) {
          return jsonResponse({
            success: false,
            error: "Le message est obligatoire."
          }, corsHeaders, 400);
        }

        if (message.length > 6000) {
          return jsonResponse({
            success: false,
            error: "Le message est trop long."
          }, corsHeaders, 400);
        }

        try {

          const result = await env.AI.run(
            "@cf/meta/llama-3.1-8b-instruct",
            {
              prompt:
                "Tu es Briack AI 5, un assistant créatif " +
                "utile, honnête et précis. " +
                "Aide l'utilisateur à créer des images, " +
                "vidéos, scripts, voix et projets créatifs. " +
                "Ne prétends jamais qu'une fonction existe " +
                "si elle n'est pas disponible. " +
                "Réponds dans la langue utilisée par l'utilisateur.\n\n" +
                "Utilisateur : " +
                message
            }
          );

          return jsonResponse({
            success: true,
            response:
              result?.response ||
              result?.text ||
              "",
            raw: result
          }, corsHeaders);

        } catch (error) {

          console.error(
            "Erreur chat:",
            error
          );

          return jsonResponse({
            success: false,
            error: "Le chat IA a rencontré une erreur.",
            details: String(
              error?.message ||
              error ||
              "Erreur inconnue"
            )
          }, corsHeaders, 500);
        }
      }


      // =========================
      // VIDEO
      // =========================
      if (
        url.pathname === "/generate-video" ||
        url.pathname === "/video-status" ||
        url.pathname === "/video-result"
      ) {

        return jsonResponse({
          success: false,
          available: false,
          error:
            "La génération vidéo n'est pas encore activée dans cette version du Worker.",
          nextStep:
            "La connexion au moteur vidéo sera ajoutée après validation de l'image."
        }, corsHeaders, 501);
      }


      // =========================
      // VOIX
      // =========================
      if (
        url.pathname === "/generate-voice" ||
        url.pathname === "/voice-status" ||
        url.pathname === "/voice-result"
      ) {

        return jsonResponse({
          success: false,
          available: false,
          error:
            "La génération vocale n'est pas encore activée dans cette version du Worker.",
          nextStep:
            "Le moteur vocal sera connecté après validation des fonctions principales."
        }, corsHeaders, 501);
      }


      // =========================
      // MUSIQUE
      // =========================
      if (url.pathname === "/generate-music") {

        return jsonResponse({
          success: false,
          available: false,
          error:
            "La génération musicale n'est pas encore connectée.",
          nextStep:
            "Un véritable moteur de génération musicale sera ajouté ultérieurement."
        }, corsHeaders, 501);
      }


      // =========================
      // ROUTE INCONNUE
      // =========================
      return jsonResponse({
        success: false,
        error: "Route introuvable.",
        path: url.pathname
      }, corsHeaders, 404);


    } catch (error) {

      // =========================
      // ERREUR GENERALE DU WORKER
      // =========================
      console.error(
        "Erreur générale Worker:",
        error
      );

      return jsonResponse({
        success: false,
        error: "Erreur interne du Worker.",
        details: String(
          error?.message ||
          error ||
          "Erreur inconnue"
        )
      }, corsHeaders, 500);
    }
  }
};


// ==================================================
// REPONSE JSON
// ==================================================

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
        "Content-Type": "application/json; charset=UTF-8",
        ...corsHeaders
      }
    }
  );
}
