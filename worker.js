const TEXT_MODEL = "@cf/meta/llama-3.1-8b-fast-v2";
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    try {

      /* ================================
         TEST VOCAL HTTPS
         ================================ */

      if (url.pathname === "/test-voice") {

        const html = `<!DOCTYPE html>
<html lang="fr">
<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>Briack AI 5 — Test vocal</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  padding: 20px;

  background:
    radial-gradient(
      circle at top,
      #18245c,
      #080b18 50%,
      #03040a
    );

  color: white;
  font-family: Arial, sans-serif;

  display: flex;
  justify-content: center;
  align-items: center;
}

.card {
  width: 100%;
  max-width: 520px;
  padding: 28px;

  border-radius: 24px;

  background:
    rgba(15, 20, 45, 0.90);

  border:
    1px solid
    rgba(120, 140, 255, 0.30);

  box-shadow:
    0 20px 60px
    rgba(0, 0, 0, 0.50);

  backdrop-filter:
    blur(18px);
}

h1 {
  margin-top: 0;
  text-align: center;
  font-size: 28px;
}

.subtitle {
  text-align: center;
  color: #aeb7d9;
  margin-bottom: 25px;
}

button {
  width: 100%;
  padding: 16px;
  margin-top: 12px;

  border: none;
  border-radius: 14px;

  font-size: 16px;
  font-weight: bold;

  cursor: pointer;
}

#start {
  background:
    linear-gradient(
      135deg,
      #6366f1,
      #06b6d4
    );

  color: white;
}

#stop {
  background: #252b45;
  color: white;
}

#clear {
  background: #151a30;
  color: #c9d2f5;
}

textarea {
  width: 100%;
  min-height: 180px;

  margin-top: 20px;
  padding: 16px;

  border-radius: 14px;

  border:
    1px solid
    rgba(150, 160, 220, 0.25);

  background:
    rgba(0, 0, 0, 0.30);

  color: white;

  font-size: 16px;

  outline: none;

  resize: vertical;
}

#status {
  margin-top: 18px;
  padding: 14px;

  border-radius: 12px;

  background:
    rgba(0, 0, 0, 0.30);

  text-align: center;

  line-height: 1.5;

  color: #c9d2f5;
}

.info {
  margin-top: 18px;

  font-size: 13px;
  line-height: 1.5;

  color: #929bc0;

  text-align: center;
}

</style>

</head>

<body>

<main class="card">

<h1>🎤 Briack AI 5</h1>

<div class="subtitle">
Test de reconnaissance vocale HTTPS
</div>

<button id="start">
🎙️ COMMENCER À PARLER
</button>

<button id="stop">
⏹️ ARRÊTER
</button>

<button id="clear">
🗑️ EFFACER
</button>

<textarea
  id="text"
  placeholder="Le texte reconnu apparaîtra ici..."
></textarea>

<div id="status">
Préparation...
</div>

<div class="info">
Appuyez sur « Commencer à parler »,
autorisez le microphone si Chrome
le demande, puis parlez normalement.
</div>

</main>

<script>

const startButton =
  document.getElementById("start");

const stopButton =
  document.getElementById("stop");

const clearButton =
  document.getElementById("clear");

const textBox =
  document.getElementById("text");

const statusBox =
  document.getElementById("status");


const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;


let recognition = null;

let isListening = false;


/* ================================
   VÉRIFICATION
   ================================ */

if (!SpeechRecognition) {

  statusBox.textContent =
    "❌ La reconnaissance vocale n'est pas disponible dans ce navigateur.";

  startButton.disabled = true;

  stopButton.disabled = true;

} else {

  recognition =
    new SpeechRecognition();


  recognition.lang =
    "fr-FR";


  recognition.continuous =
    false;


  recognition.interimResults =
    true;


  recognition.maxAlternatives =
    1;


  /* ================================
     DÉBUT
     ================================ */

  recognition.onstart =
    function() {

      isListening = true;

      statusBox.textContent =
        "🎙️ MICROPHONE ACTIF — PARLEZ MAINTENANT";

      startButton.textContent =
        "🔴 ÉCOUTE EN COURS";

    };


  /* ================================
     RÉSULTAT
     ================================ */

  recognition.onresult =
    function(event) {

      let finalText = "";

      let interimText = "";


      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {

        const transcript =
          event.results[i][0].transcript;


        if (
          event.results[i].isFinal
        ) {

          finalText += transcript;

        } else {

          interimText += transcript;

        }

      }


      textBox.value =
        finalText || interimText;

    };


  /* ================================
     ERREUR
     ================================ */

  recognition.onerror =
    function(event) {

      isListening = false;


      console.error(
        "Erreur vocale :",
        event.error
      );


      let message =
        "❌ Erreur : " +
        event.error;


      if (
        event.error === "not-allowed"
      ) {

        message =
          "❌ Microphone refusé. Autorisez le microphone pour Chrome dans les paramètres Android.";

      }


      if (
        event.error === "service-not-allowed"
      ) {

        message =
          "❌ Le service de reconnaissance vocale est bloqué.";

      }


      if (
        event.error === "audio-capture"
      ) {

        message =
          "❌ Aucun microphone disponible.";

      }


      if (
        event.error === "no-speech"
      ) {

        message =
          "⚠️ Aucune parole détectée.";

      }


      if (
        event.error === "network"
      ) {

        message =
          "❌ Problème réseau avec le service de reconnaissance vocale.";

      }


      if (
        event.error === "aborted"
      ) {

        message =
          "ℹ️ Écoute arrêtée.";

      }


      statusBox.textContent =
        message;


      startButton.textContent =
        "🎙️ COMMENCER À PARLER";

    };


  /* ================================
     FIN
     ================================ */

  recognition.onend =
    function() {

      isListening = false;


      statusBox.textContent =
        "✅ Écoute terminée.";


      startButton.textContent =
        "🎙️ COMMENCER À PARLER";

    };


  /* ================================
     DÉMARRER
     ================================ */

  startButton.onclick =
    function() {

      if (isListening) {

        return;

      }


      try {

        textBox.value = "";


        statusBox.textContent =
          "⏳ Démarrage du microphone...";


        recognition.start();

      } catch(error) {

        console.error(error);


        statusBox.textContent =
          "⚠️ Impossible de démarrer : " +
          error.message;

      }

    };


  /* ================================
     ARRÊTER
     ================================ */

  stopButton.onclick =
    function() {

      if (!recognition) {

        return;

      }


      try {

        recognition.stop();

      } catch(error) {

        console.error(error);

      }

    };


  /* ================================
     EFFACER
     ================================ */

  clearButton.onclick =
    function() {

      textBox.value = "";

      statusBox.textContent =
        "✅ Zone de texte effacée.";

    };


  statusBox.textContent =
    "✅ Reconnaissance vocale détectée. Appuyez sur le bouton.";

}


/* =====================================================
   FIN DU SCRIPT VOCAL
   ===================================================== */

</script>

</body>

</html>`;

        return new Response(
          html,
          {
            status: 200,

            headers: {
              "Content-Type":
                "text/html; charset=UTF-8",

              "Cache-Control":
                "no-store",

              ...corsHeaders
            }
          }
        );
      }


      /* ================================
         API PRINCIPALE
         ================================ */

      if (url.pathname === "/") {

        return jsonResponse(
          {
            success: true,
            application: "Briack AI 5",
            service: "Briack AI 5 API",
            status: "online",
            version: "3.2.0",
            workersAI: Boolean(env.AI)
          },
          corsHeaders
        );

      }


      /* ================================
         HEALTH
         ================================ */

      if (url.pathname === "/health") {

        return jsonResponse(
          {
            success: true,
            status: "healthy",
            workersAI: Boolean(env.AI),
            timestamp:
              new Date().toISOString()
          },
          corsHeaders
        );

      }


      /* ================================
         WORKERS AI
         ================================ */

      if (!env.AI) {

        return jsonResponse(
          {
            success: false,
            error:
              "Le binding Workers AI 'AI' est introuvable."
          },
          corsHeaders,
          500
        );

      }


      /* ================================
         TEST AI
         ================================ */

      if (url.pathname === "/test-ai") {

        if (request.method !== "POST") {

          return jsonResponse(
            {
              success: false,
              error:
                "Cette route utilise POST."
            },
            corsHeaders,
            405
          );

        }


        let body = {};


        try {

          body =
            await request.json();

        } catch {

          body = {};

        }


        const prompt =
          typeof body.prompt === "string" &&
          body.prompt.trim()

            ? body.prompt.trim()

            : "Réponds uniquement : Briack AI 5 fonctionne.";


        const result =
          await env.AI.run(
            TEXT_MODEL,
            {
              prompt:
                prompt,

              max_tokens:
                100
            }
          );


        return jsonResponse(
          {
            success: true,
            message:
              "Workers AI fonctionne.",
            model:
              TEXT_MODEL,
            response:
              result?.response || "",
            raw:
              result
          },
          corsHeaders
        );

      }


      /* ================================
         CHAT
         ================================ */

      if (url.pathname === "/chat") {

        if (request.method !== "POST") {

          return jsonResponse(
            {
              success: false,
              error:
                "Cette route utilise POST."
            },
            corsHeaders,
            405
          );

        }


        let body;


        try {

          body =
            await request.json();

        } catch {

          return jsonResponse(
            {
              success: false,
              error:
                "Le corps de la requête doit être un JSON valide."
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
              error:
                "Le message est obligatoire."
            },
            corsHeaders,
            400
          );

        }


        if (message.length > 12000) {

          return jsonResponse(
            {
              success: false,
              error:
                "Le message est trop long."
            },
            corsHeaders,
            400
          );

        }


        const result =
          await env.AI.run(
            TEXT_MODEL,
            {
              prompt:
                "Tu es Briack AI 5, un assistant créatif professionnel et honnête. " +
                "Tu aides l'utilisateur à créer des images, vidéos, scripts, voix, musiques et projets créatifs. " +
                "Tu ne prétends jamais qu'une fonction fonctionne si elle n'est pas réellement disponible. " +
                "Réponds dans la langue de l'utilisateur.\n\n" +
                "Utilisateur :\n" +
                message,

              max_tokens:
                700,

              temperature:
                0.7
            }
          );


        return jsonResponse(
          {
            success: true,
            model:
              TEXT_MODEL,
            response:
              result?.response || "",
            raw:
              result
          },
          corsHeaders
        );

      }


      /* ================================
         SCRIPT
         ================================ */

      if (
        url.pathname ===
        "/generate-script"
      ) {

        if (request.method !== "POST") {

          return jsonResponse(
            {
              success: false,
              error:
                "Cette route utilise POST."
            },
            corsHeaders,
            405
          );

        }


        let body;


        try {

          body =
            await request.json();

        } catch {

          return jsonResponse(
            {
              success: false,
              error:
                "JSON invalide."
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
              error:
                "Le sujet du script est obligatoire."
            },
            corsHeaders,
            400
          );

        }


        const result =
          await env.AI.run(
            TEXT_MODEL,
            {
              prompt:
                "Tu es le moteur de génération de scripts de Briack AI 5.\n\n" +
                "Crée un script captivant, naturel, bien structuré et adapté au sujet suivant.\n\n" +
                "Sujet :\n" +
                subject,

              max_tokens:
                1500,

              temperature:
                0.8
            }
          );


        return jsonResponse(
          {
            success: true,
            model:
              TEXT_MODEL,
            script:
              result?.response || "",
            raw:
              result
          },
          corsHeaders
        );

      }


      /* ================================
         IMAGE
         ================================ */

      if (
        url.pathname ===
        "/generate-image"
      ) {

        if (request.method !== "POST") {

          return jsonResponse(
            {
              success: false,
              error:
                "Cette route utilise POST."
            },
            corsHeaders,
            405
          );

        }


        let body;


        try {

          body =
            await request.json();

        } catch {

          return jsonResponse(
            {
              success: false,
              error:
                "Le corps de la requête doit être un JSON valide."
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
              error:
                "Le prompt est obligatoire."
            },
            corsHeaders,
            400
          );

        }


        if (prompt.length > 2048) {

          return jsonResponse(
            {
              success: false,
              error:
                "Le prompt est trop long. Maximum : 2048 caractères."
            },
            corsHeaders,
            400
          );

        }


        try {

          const result =
            await env.AI.run(
              IMAGE_MODEL,
              {
                prompt:
                  prompt,

                steps:
                  4
              }
            );


          if (
            !result ||
            typeof result.image !== "string" ||
            result.image.length === 0
          ) {

            return jsonResponse(
              {
                success: false,
                error:
                  "FLUX n'a pas renvoyé d'image."
              },
              corsHeaders,
              500
            );

          }


          let binaryString;


          try {

            binaryString =
              atob(result.image);

          } catch {

            return jsonResponse(
              {
                success: false,
                error:
                  "L'image FLUX reçue est invalide."
              },
              corsHeaders,
              500
            );

          }


          const imageBytes =
            Uint8Array.from(
              binaryString,
              character =>
                character.charCodeAt(0)
            );


          if (
            imageBytes.length === 0
          ) {

            return jsonResponse(
              {
                success: false,
                error:
                  "FLUX a renvoyé une image vide."
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
                "Content-Type":
                  "image/jpeg",

                "Cache-Control":
                  "no-store",

                ...corsHeaders
              }
            }
          );


        } catch (error) {

          return jsonResponse(
            {
              success: false,
              error:
                "La génération de l'image a échoué.",
              details:
                String(
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


      /* ================================
         VIDÉO
         ================================ */

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


      /* ================================
         VOIX IA
         ================================ */

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
              "Le moteur vocal IA n'est pas encore connecté."
          },
          corsHeaders,
          501
        );

      }


      /* ================================
         MUSIQUE
         ================================ */

      if (
        url.pathname === "/generate-music"
      ) {

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


      /* ================================
         404
         ================================ */

      return jsonResponse(
        {
          success: false,
          error:
            "Route introuvable.",
          path:
            url.pathname
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
          error:
            "Erreur interne du Worker.",
          details:
            String(
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


/* =====================================================
   JSON RESPONSE
   ===================================================== */

function jsonResponse(
  data,
  corsHeaders,
  status = 200
) {

  return new Response(
    JSON.stringify(data),
    {
      status:
        status,

      headers: {
        "Content-Type":
          "application/json; charset=UTF-8",

        ...corsHeaders
      }
    }
  );

}
