export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);

    // =========================
    // ACCUEIL API
    // =========================
    if (url.pathname === "/") {
      return json({
        success: true,
        application: "Image Motion",
        service: "Image Motion API",
        status: "online",
        version: "2.1.0",
        ai: !!env.AI
      }, corsHeaders);
    }

    // =========================
    // HEALTH
    // =========================
    if (url.pathname === "/health") {
      return json({
        success: true,
        status: "healthy",
        aiBinding: !!env.AI
      }, corsHeaders);
    }
// =========================
// GENERATION D'IMAGE
// =========================
if (url.pathname === "/generate-image") {

  if (request.method !== "POST") {
    return json({
      success: false,
      error: "Cette route utilise POST."
    }, corsHeaders, 405);
  }

  if (!env.AI) {
    return json({
      success: false,
      error: "La liaison Workers AI 'AI' n'est pas configurée."
    }, corsHeaders, 500);
  }

  try {

    const body = await request.json();

    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";

    if (!prompt) {
      return json({
        success: false,
        error: "Le prompt est obligatoire."
      }, corsHeaders, 400);
    }

    if (prompt.length > 2048) {
      return json({
        success: false,
        error: "Le prompt est trop long."
      }, corsHeaders, 400);
    }

    // =========================
    // FLUX
    // =========================

    const result = await env.AI.run(
      "@cf/black-forest-labs/flux-1-schnell",
      {
        prompt: prompt,
        steps: 4
      }
    );

    // FLUX doit retourner result.image
    if (!result || typeof result.image !== "string") {

      console.error(
        "Réponse FLUX invalide:",
        result
      );

      return json({
        success: false,
        error: "FLUX n'a pas renvoyé d'image."
      }, corsHeaders, 500);
    }

    // =========================
    // BASE64 → BINAIRE
    // =========================

    const binaryString = atob(result.image);

    const imageBytes = Uint8Array.from(
      binaryString,
      character => character.charCodeAt(0)
    );

    if (!imageBytes.length) {

      return json({
        success: false,
        error: "L'image générée est vide."
      }, corsHeaders, 500);
    }

    // =========================
    // IMAGE PNG/JPEG
    // =========================

    return new Response(imageBytes, {
      status: 200,

      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        ...corsHeaders
      }
    });

  } catch (error) {

    console.error(
      "Erreur /generate-image:",
      error
    );

    return json({
      success: false,
      error: "Erreur lors de la génération de l'image.",
      details: String(
        error?.message || error
      )
    }, corsHeaders, 500);
  }
}
    
    // =========================
    // ROUTE INCONNUE
    // =========================
    return json({
      success: false,
      error: "Route introuvable"
    }, corsHeaders, 404);
  }
};


// =========================
// REPONSE JSON
// =========================
function json(data, corsHeaders, status = 200) {

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        ...corsHeaders
      }
    }
  );
}
