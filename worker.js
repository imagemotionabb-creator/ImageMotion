const CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const VOICE_MODEL = "@cf/myshell-ai/melotts";

const REPLICATE_VIDEO_MODEL = "wan-video/wan-2.7-i2v";
const REPLICATE_VIDEO_ENDPOINT =
  "https://api.replicate.com/v1/models/wan-video/wan-2.7-i2v/predictions";


function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}


function json(data, status = 200, origin = "*") {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "application/json; charset=UTF-8"
      }
    }
  );
}


function error(message, status = 400, origin = "*", extra = {}) {
  return json(
    {
      success: false,
      error: message,
      ...extra
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


function normalizeOrigin(request) {
  return request.headers.get("Origin") || "*";
}


function getVideoOutput(output) {
  if (!output) {
    return null;
  }

  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item.url === "string") {
        return item.url;
      }
    }
  }

  if (output && typeof output.url === "string") {
    return output.url;
  }

  return null;
}


export default {
  async fetch(request, env) {
    const origin = normalizeOrigin(request);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }


    /* =========================================================
       HEALTH
       ========================================================= */

    if (url.pathname === "/health" && request.method === "GET") {
      return json(
        {
          success: true,
          service: "Briack AI 5",
          worker: "imagemotion",
          status: "online",

          routes: {
            health: true,
            chat: true,
            chatTest: true,
            generateImage: true,
            imageTest: true,
            generateVideo: true,
            videoStatus: true,
            videoTest: true,
            generateVoice: true,
            testVoice: true
          },

          replicateConfigured:
            Boolean(env.REPLICATE_API_TOKEN),

          models: {
            chat: CHAT_MODEL,
            image: IMAGE_MODEL,
            voice: VOICE_MODEL,
            video: REPLICATE_VIDEO_MODEL
          }
        },
        200,
        origin
      );
    }


    /* =========================================================
       CHAT
       ========================================================= */

    if (url.pathname === "/chat" && request.method === "POST") {
      const body = await readJson(request);

      if (!body) {
        return error(
          "JSON invalide.",
          400,
          origin
        );
      }

      const message =
        typeof body.message === "string"
          ? body.message.trim()
          : "";

      if (!message) {
        return error(
          "Le message est obligatoire.",
          400,
          origin
        );
      }

      if (message.length > 10000) {
        return error(
          "Le message est trop long.",
          413,
          origin
        );
      }

      let history = [];

      if (Array.isArray(body.history)) {
        history = body.history
          .filter(
            item =>
              item &&
              typeof item.role === "string" &&
              typeof item.content === "string"
          )
          .slice(-20)
          .map(item => ({
            role:
              item.role === "assistant"
                ? "assistant"
                : "user",
            content: item.content.slice(0, 10000)
          }));
      }

      const messages = [
        {
          role: "system",
          content:
            "Tu es Briack AI 5, un assistant IA professionnel, " +
            "intelligent, clair, utile et naturel. " +
            "Réponds dans la langue utilisée par l'utilisateur. " +
            "Ne prétends jamais avoir effectué une action que tu n'as pas effectuée."
        },

        ...history,

        {
          role: "user",
          content: message
        }
      ];

      try {
        const result = await env.AI.run(
          CHAT_MODEL,
          {
            messages,
            max_tokens: 1024,
            temperature: 0.7
          }
        );

        return json(
          {
            success: true,
            model: CHAT_MODEL,
            response:
              result?.response ||
              result?.text ||
              ""
          },
          200,
          origin
        );
      } catch (err) {
        return error(
          `Erreur chat : ${err?.message || err}`,
          500,
          origin
        );
      }
    }


    /* =========================================================
       CHAT TEST
       ========================================================= */

    if (
      url.pathname === "/chat-test" &&
      request.method === "GET"
    ) {
      return new Response(
        `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport"
      content="width=device-width,initial-scale=1.0">
<title>Briack AI 5 - Test Chat</title>

<style>
body{
  font-family:Arial,sans-serif;
  background:#111827;
  color:white;
  padding:20px;
}

textarea{
  width:100%;
  min-height:120px;
  box-sizing:border-box;
  padding:12px;
  border-radius:10px;
  border:1px solid #374151;
  background:#1f2937;
  color:white;
}

button{
  margin-top:12px;
  padding:14px 20px;
  border:0;
  border-radius:10px;
  background:#2563eb;
  color:white;
  font-size:16px;
}

#result{
  margin-top:20px;
  padding:15px;
  background:#1f2937;
  border-radius:10px;
  white-space:pre-wrap;
}
</style>
</head>

<body>

<h1>Test réel de la route /chat</h1>

<textarea id="message">
Bonjour Briack AI 5. Présente-toi en une phrase.
</textarea>

<br>

<button onclick="testChat()">
Tester le chat
</button>

<div id="result">
Résultat...
</div>

<script>
async function testChat(){

  const result =
    document.getElementById("result");

  result.textContent =
    "Connexion à Briack AI 5...";

  try{

    const response =
      await fetch("/chat",{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          message:
            document.getElementById("message").value
        })
      });

    const data =
      await response.json();

    if(data.success){

      result.textContent =
        "✅ Chat fonctionnel\\n\\n" +
        data.response;

    }else{

      result.textContent =
        "❌ Échec\\n\\n" +
        (data.error || "Erreur inconnue");
    }

  }catch(error){

    result.textContent =
      "❌ Erreur réseau : " +
      error.message;
  }
}
</script>

</body>
</html>`,
        {
          status: 200,
          headers: {
            ...corsHeaders(origin),
            "Content-Type":
              "text/html; charset=UTF-8"
          }
        }
      );
    }


    /* =========================================================
       GENERATE IMAGE
       ========================================================= */

    if (
      url.pathname === "/generate-image" &&
      request.method === "POST"
    ) {
      const body = await readJson(request);

      if (!body) {
        return error(
          "JSON invalide.",
          400,
          origin
        );
      }

      const prompt =
        typeof body.prompt === "string"
          ? body.prompt.trim()
          : "";

      if (!prompt) {
        return error(
          "Le prompt image est obligatoire.",
          400,
          origin
        );
      }

      if (prompt.length > 2048) {
        return error(
          "Le prompt est trop long.",
          413,
          origin
        );
      }

      const steps =
        Number.isInteger(body.steps) &&
        body.steps >= 1 &&
        body.steps <= 8
          ? body.steps
          : 4;

      try {
        const result =
          await env.AI.run(
            IMAGE_MODEL,
            {
              prompt,
              steps
            }
          );

        if (!result || !result.image) {
          return error(
            "Le modèle n'a pas retourné d'image.",
            500,
            origin
          );
        }

        return json(
          {
            success: true,
            model: IMAGE_MODEL,
            mimeType: "image/jpeg",
            image: result.image,
            dataURI:
              `data:image/jpeg;base64,${result.image}`
          },
          200,
          origin
        );

      } catch (err) {

        return error(
          `Erreur génération image : ${
            err?.message || err
          }`,
          500,
          origin
        );
      }
    }


    /* =========================================================
       IMAGE TEST
       ========================================================= */

    if (
      url.pathname === "/image-test" &&
      request.method === "GET"
    ) {
      return new Response(
        `<!DOCTYPE html>
<html lang="fr">

<head>
<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width,initial-scale=1.0">

<title>Briack AI 5 - Test Image</title>

<style>

body{
  font-family:Arial,sans-serif;
  background:#111827;
  color:white;
  padding:20px;
}

textarea{
  width:100%;
  min-height:130px;
  box-sizing:border-box;
  padding:12px;
  border-radius:10px;
  border:1px solid #374151;
  background:#1f2937;
  color:white;
}

button{
  margin-top:12px;
  padding:14px 20px;
  border:0;
  border-radius:10px;
  background:#2563eb;
  color:white;
  font-size:16px;
}

#status{
  margin-top:15px;
  white-space:pre-wrap;
}

img{
  display:block;
  width:100%;
  max-width:700px;
  margin-top:20px;
  border-radius:12px;
}

</style>

</head>

<body>

<h1>Test génération d'image</h1>

<textarea id="prompt">Une ville futuriste ultra réaliste au coucher du soleil, gratte-ciels modernes, voitures électriques, lumière cinématographique, détails très réalistes.</textarea>

<br>

<button onclick="generateImage()">
Générer l'image
</button>

<div id="status"></div>

<img id="image"
     style="display:none">

<script>

async function generateImage(){

  const status =
    document.getElementById("status");

  const image =
    document.getElementById("image");

  image.style.display="none";

  status.textContent =
    "⏳ Génération en cours...";

  try{

    const response =
      await fetch("/generate-image",{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          prompt:
            document.getElementById("prompt").value,
          steps:4
        })
      });

    const data =
      await response.json();

    if(!data.success){

      status.textContent =
        "❌ Échec de génération.\\n" +
        (data.error || "Erreur inconnue");

      return;
    }

    image.src =
      data.dataURI;

    image.style.display =
      "block";

    status.textContent =
      "✅ Image générée avec succès.";

  }catch(error){

    status.textContent =
      "❌ Erreur réseau : " +
      error.message;
  }
}

</script>

</body>
</html>`,
        {
          status: 200,
          headers: {
            ...corsHeaders(origin),
            "Content-Type":
              "text/html; charset=UTF-8"
          }
        }
      );
    }


    /* =========================================================
       GENERATE VIDEO
       ========================================================= */

    if (
      url.pathname === "/generate-video" &&
      request.method === "POST"
    ) {

      if (!env.REPLICATE_API_TOKEN) {
        return error(
          "REPLICATE_API_TOKEN n'est pas configuré.",
          500,
          origin
        );
      }

      const body = await readJson(request);

      if (!body) {
        return error(
          "JSON invalide.",
          400,
          origin
        );
      }

      /*
       * first_frame doit être une URL accessible par Replicate.
       * Exemple :
       * https://.../image.jpg
       */

      const firstFrame =
        typeof body.first_frame === "string"
          ? body.first_frame.trim()
          : (
              typeof body.image === "string"
                ? body.image.trim()
                : ""
            );

      const prompt =
        typeof body.prompt === "string"
          ? body.prompt.trim()
          : "";

      if (!firstFrame) {
        return error(
          "L'image de départ first_frame est obligatoire.",
          400,
          origin
        );
      }

      if (!prompt) {
        return error(
          "Le prompt de mouvement est obligatoire.",
          400,
          origin
        );
      }

      if (firstFrame.length > 10000) {
        return error(
          "L'URL de l'image est trop longue.",
          413,
          origin
        );
      }

      if (prompt.length > 5000) {
        return error(
          "Le prompt vidéo est trop long.",
          413,
          origin
        );
      }

      const duration =
        Number.isInteger(body.duration) &&
        body.duration >= 2 &&
        body.duration <= 15
          ? body.duration
          : 5;

      const resolution =
        body.resolution === "1080p"
          ? "1080p"
          : "720p";

      const negativePrompt =
        typeof body.negative_prompt === "string"
          ? body.negative_prompt.trim()
          : "";

      const enablePromptExpansion =
        typeof body.enable_prompt_expansion === "boolean"
          ? body.enable_prompt_expansion
          : false;

      const input = {
        first_frame: firstFrame,
        prompt,
        duration,
        resolution,
        enable_prompt_expansion:
          enablePromptExpansion
      };

      if (negativePrompt) {
        input.negative_prompt =
          negativePrompt;
      }

      /*
       * Seed facultatif.
       * Nous ne l'envoyons que si l'utilisateur
       * fournit un entier valide.
       */

      if (
        Number.isInteger(body.seed) &&
        body.seed >= 0
      ) {
        input.seed = body.seed;
      }

      try {

        const replicateResponse =
          await fetch(
            REPLICATE_VIDEO_ENDPOINT,
            {
              method: "POST",

              headers: {
                "Authorization":
                  `Bearer ${env.REPLICATE_API_TOKEN}`,

                "Content-Type":
                  "application/json",

                "Prefer":
                  "wait"
              },

              body: JSON.stringify({
                input
              })
            }
          );

        const text =
          await replicateResponse.text();

        let data;

        try {
          data = JSON.parse(text);
        } catch {
          data = {
            raw: text
          };
        }

        if (!replicateResponse.ok) {

          return error(
            "Replicate a refusé la génération vidéo.",
            replicateResponse.status,
            origin,
            {
              provider: "replicate",
              details: data
            }
          );
        }

        const videoUrl =
          getVideoOutput(data.output);

        return json(
          {
            success: true,

            provider: "replicate",

            model:
              REPLICATE_VIDEO_MODEL,

            predictionId:
              data.id || null,

            status:
              data.status || "starting",

            video:
              videoUrl,

            output:
              data.output ?? null,

            urls:
              data.urls || null,

            message:
              videoUrl
                ? "Vidéo générée."
                : "Génération vidéo lancée. Utilisez /video-status avec predictionId."
          },
          200,
          origin
        );

      } catch (err) {

        return error(
          `Erreur connexion Replicate : ${
            err?.message || err
          }`,
          500,
          origin
        );
      }
    }


    /* =========================================================
       VIDEO STATUS
       ========================================================= */

    if (
      url.pathname === "/video-status" &&
      request.method === "GET"
    ) {

      if (!env.REPLICATE_API_TOKEN) {
        return error(
          "REPLICATE_API_TOKEN n'est pas configuré.",
          500,
          origin
        );
      }

      const predictionId =
        url.searchParams.get("id");

      if (!predictionId) {
        return error(
          "Le paramètre id est obligatoire.",
          400,
          origin
        );
      }

      /*
       * Protection simple contre les caractères
       * inattendus dans l'identifiant.
       */

      if (
        !/^[a-zA-Z0-9_-]+$/.test(
          predictionId
        )
      ) {
        return error(
          "Identifiant de prédiction invalide.",
          400,
          origin
        );
      }

      const endpoint =
        `https://api.replicate.com/v1/predictions/${encodeURIComponent(predictionId)}`;

      try {

        const replicateResponse =
          await fetch(
            endpoint,
            {
              method: "GET",

              headers: {
                "Authorization":
                  `Bearer ${env.REPLICATE_API_TOKEN}`
              }
            }
          );

        const text =
          await replicateResponse.text();

        let data;

        try {
          data = JSON.parse(text);
        } catch {
          data = {
            raw: text
          };
        }

        if (!replicateResponse.ok) {

          return error(
            "Impossible de récupérer le statut Replicate.",
            replicateResponse.status,
            origin,
            {
              provider: "replicate",
              details: data
            }
          );
        }

        const videoUrl =
          getVideoOutput(data.output);

        return json(
          {
            success: true,

            provider: "replicate",

            predictionId:
              data.id || predictionId,

            status:
              data.status || null,

            video:
              videoUrl,

            output:
              data.output ?? null,

            error:
              data.error || null,

            logs:
              data.logs || "",

            urls:
              data.urls || null,

            completed:
              data.status === "succeeded",

            failed:
              data.status === "failed" ||
              data.status === "canceled"
          },
          200,
          origin
        );

      } catch (err) {

        return error(
          `Erreur statut vidéo : ${
            err?.message || err
          }`,
          500,
          origin
        );
      }
    }


    /* =========================================================
       VIDEO TEST
       ========================================================= */

    if (
      url.pathname === "/video-test" &&
      request.method === "GET"
    ) {

      return new Response(
        `<!DOCTYPE html>
<html lang="fr">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width,initial-scale=1.0">

<title>Briack AI 5 - Image vers Vidéo</title>

<style>

body{
  font-family:Arial,sans-serif;
  background:#111827;
  color:white;
  padding:20px;
}

input,
textarea,
select{
  width:100%;
  box-sizing:border-box;
  margin-top:8px;
  margin-bottom:14px;
  padding:12px;
  border-radius:10px;
  border:1px solid #374151;
  background:#1f2937;
  color:white;
}

textarea{
  min-height:130px;
}

button{
  width:100%;
  margin-top:8px;
  padding:15px;
  border:0;
  border-radius:10px;
  background:#2563eb;
  color:white;
  font-size:16px;
}

#status{
  margin-top:20px;
  padding:15px;
  background:#1f2937;
  border-radius:10px;
  white-space:pre-wrap;
}

video{
  width:100%;
  margin-top:20px;
  border-radius:12px;
  display:none;
}

.small{
  color:#9ca3af;
  font-size:13px;
  line-height:1.5;
}

</style>

</head>

<body>

<h1>🎬 Image → Vidéo</h1>

<p class="small">
Ce test utilise une image accessible publiquement
comme première image. Replicate doit pouvoir
accéder à cette image.
</p>

<label>
URL de l'image de départ
</label>

<input
id="image"
value="https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg"
>

<label>
Mouvement demandé
</label>

<textarea id="prompt">La caméra avance lentement vers le paysage, les arbres bougent doucement avec le vent, les nuages se déplacent naturellement, mouvement cinématographique réaliste, caméra stable.</textarea>

<label>
Durée
</label>

<select id="duration">

<option value="2">2 secondes</option>
<option value="3">3 secondes</option>
<option value="4">4 secondes</option>
<option value="5" selected>5 secondes</option>
<option value="6">6 secondes</option>
<option value="8">8 secondes</option>
<option value="10">10 secondes</option>
<option value="15">15 secondes</option>

</select>

<label>
Résolution
</label>

<select id="resolution">

<option value="720p" selected>
720p
</option>

<option value="1080p">
1080p
</option>

</select>

<button onclick="generateVideo()">
🎬 Générer la vidéo
</button>

<button onclick="checkStatus()">
🔄 Vérifier le statut
</button>

<div id="status">
En attente...
</div>

<video
id="video"
controls
playsinline>
</video>

<script>

let predictionId = null;


async function generateVideo(){

  const status =
    document.getElementById("status");

  const video =
    document.getElementById("video");

  video.style.display =
    "none";

  predictionId = null;

  status.textContent =
    "⏳ Envoi de la génération vidéo à Replicate...";

  try{

    const response =
      await fetch("/generate-video",{

        method:"POST",

        headers:{
          "Content-Type":
            "application/json"
        },

        body:JSON.stringify({

          first_frame:
            document.getElementById("image").value,

          prompt:
            document.getElementById("prompt").value,

          duration:
            Number(
              document.getElementById("duration").value
            ),

          resolution:
            document.getElementById("resolution").value,

          enable_prompt_expansion:
            false

        })

      });

    const data =
      await response.json();

    if(!data.success){

      status.textContent =
        "❌ Échec\\n\\n" +
        JSON.stringify(
          data,
          null,
          2
        );

      return;
    }

    predictionId =
      data.predictionId;

    status.textContent =
      "✅ Demande vidéo acceptée.\\n\\n" +
      "ID : " +
      predictionId +
      "\\n\\n" +
      "Statut : " +
      data.status +
      "\\n\\n" +
      "La génération peut prendre du temps. " +
      "Appuie sur « Vérifier le statut ».";

    if(data.video){

      video.src =
        data.video;

      video.style.display =
        "block";

      status.textContent +=
        "\\n\\n🎉 Vidéo déjà disponible !";
    }

  }catch(error){

    status.textContent =
      "❌ Erreur réseau : " +
      error.message;
  }
}


async function checkStatus(){

  const status =
    document.getElementById("status");

  const video =
    document.getElementById("video");

  if(!predictionId){

    status.textContent =
      "⚠️ Aucune génération n'a encore été lancée.";

    return;
  }

  status.textContent =
    "🔄 Vérification du statut...";

  try{

    const response =
      await fetch(
        "/video-status?id=" +
        encodeURIComponent(predictionId)
      );

    const data =
      await response.json();

    if(!data.success){

      status.textContent =
        "❌ Erreur\\n\\n" +
        JSON.stringify(
          data,
          null,
          2
        );

      return;
    }

    status.textContent =
      "Statut : " +
      data.status;

    if(data.status === "starting" ||
       data.status === "processing"){

      status.textContent +=
        "\\n\\n⏳ La vidéo est encore en cours de génération. " +
        "Attends un peu puis appuie de nouveau sur « Vérifier le statut ».";

      return;
    }

    if(data.status === "succeeded"){

      if(data.video){

        video.src =
          data.video;

        video.style.display =
          "block";

        status.textContent =
          "🎉 VIDÉO TERMINÉE !\\n\\n" +
          "La vidéo est maintenant disponible.";
      }else{

        status.textContent =
          "⚠️ La génération est terminée, " +
          "mais aucune URL vidéo n'a été trouvée.";
      }

      return;
    }

    if(
      data.status === "failed" ||
      data.status === "canceled"
    ){

      status.textContent =
        "❌ Génération terminée avec une erreur.\\n\\n" +
        (data.error || "Erreur inconnue.");

      return;
    }

    status.textContent +=
      "\\n\\nRéessaie dans quelques secondes.";

  }catch(error){

    status.textContent =
      "❌ Erreur réseau : " +
      error.message;
  }
}

</script>

</body>

</html>`,
        {
          status: 200,
          headers: {
            ...corsHeaders(origin),
            "Content-Type":
              "text/html; charset=UTF-8"
          }
        }
      );
    }


    /* =========================================================
       GENERATE VOICE
       ========================================================= */

    if (
      url.pathname === "/generate-voice" &&
      request.method === "POST"
    ) {

      const body =
        await readJson(request);

      if (!body) {
        return error(
          "JSON invalide.",
          400,
          origin
        );
      }

      const text =
        typeof body.text === "string"
          ? body.text.trim()
          : "";

      if (!text) {
        return error(
          "Le texte est obligatoire.",
          400,
          origin
        );
      }

      try {

        const result =
          await env.AI.run(
            VOICE_MODEL,
            {
              text
            }
          );

        return new Response(
          result,
          {
            status:200,
            headers:{
              ...corsHeaders(origin),
              "Content-Type":
                "audio/mpeg"
            }
          }
        );

      } catch(err){

        return error(
          `Erreur génération voix : ${
            err?.message || err
          }`,
          500,
          origin
        );
      }
    }


    /* =========================================================
       TEST VOICE
       ========================================================= */

    if (
      url.pathname === "/test-voice" &&
      request.method === "GET"
    ) {

      return new Response(
        `<!DOCTYPE html>
<html lang="fr">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width,initial-scale=1.0">

<title>Test Voice - Briack AI 5</title>

<style>

body{
  font-family:Arial,sans-serif;
  background:#111827;
  color:white;
  padding:20px;
}

button{
  padding:15px 20px;
  border:0;
  border-radius:10px;
  background:#2563eb;
  color:white;
  font-size:16px;
}

#result{
  margin-top:20px;
  padding:15px;
  background:#1f2937;
  border-radius:10px;
  min-height:50px;
}

</style>

</head>

<body>

<h1>🎤 Test reconnaissance vocale</h1>

<button onclick="startRecognition()">
🎤 Parler
</button>

<div id="result">
Appuie sur « Parler », puis parle.
</div>

<script>

function startRecognition(){

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  const result =
    document.getElementById("result");

  if(!SpeechRecognition){

    result.textContent =
      "❌ Reconnaissance vocale non disponible dans ce navigateur.";

    return;
  }

  const recognition =
    new SpeechRecognition();

  recognition.lang =
    "fr-FR";

  recognition.interimResults =
    true;

  recognition.continuous =
    false;

  recognition.onstart =
    function(){

      result.textContent =
        "🎤 Je t'écoute...";
    };

  recognition.onresult =
    function(event){

      let text = "";

      for(
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ){

        text +=
          event.results[i][0].transcript;
      }

      result.textContent =
        text;
    };

  recognition.onerror =
    function(event){

      result.textContent =
        "❌ Erreur : " +
        event.error;
    };

  recognition.onend =
    function(){

      if(
        !result.textContent ||
        result.textContent ===
          "🎤 Je t'écoute..."
      ){

        result.textContent =
          "Aucun texte détecté.";
      }
    };

  recognition.start();
}

</script>

</body>

</html>`,
        {
          status:200,
          headers:{
            ...corsHeaders(origin),
            "Content-Type":
              "text/html; charset=UTF-8"
          }
        }
      );
    }
// =========================================================
// VOICE TEST — MELOTTS
// =========================================================

if (path === "/voice-test" && method === "GET") {
  const result = await env.AI.run(VOICE_MODEL, {
    prompt:
      "Bienvenue dans Briack AI 5. Ceci est un test réel de génération vocale. La voix est produite par notre moteur de synthèse vocale.",
    lang: "fr",
  });

  if (result instanceof ReadableStream) {
    return new Response(result, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "audio/mpeg",
        "Content-Disposition":
          'inline; filename="briack-voice-test.mp3"',
        "Cache-Control": "no-store",
      },
    });
  }

  if (result instanceof ArrayBuffer) {
    return new Response(result, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "audio/mpeg",
        "Content-Disposition":
          'inline; filename="briack-voice-test.mp3"',
        "Cache-Control": "no-store",
      },
    });
  }

  return json({
    success: true,
    model: VOICE_MODEL,
    language: "fr",
    result,
  });
  }

    /* =========================================================
       404
       ========================================================= */

    return json(
      {
        success: false,
        error: "Route introuvable.",
        path: url.pathname
      },
      404,
      origin
    );
  }
};
