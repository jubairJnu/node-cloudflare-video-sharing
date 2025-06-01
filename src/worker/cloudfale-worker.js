// cloudflare-worker.js
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // Validate signature and expiry
  if (!validateSignedUrl(url)) {
    return new Response("Unauthorized or expired URL", { status: 401 });
  }

  // Fetch from R2 bucket
  const r2Url = `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com${url.pathname}`;

  const cache = caches.default;
  let response = await cache.match(request);
  if (!response) {
    response = await fetch(r2Url, request);
    // Cache for 1 day
    const cacheControl = "public, max-age=86400";
    response = new Response(response.body, response);
    response.headers.set("Cache-Control", cacheControl);
    event.waitUntil(cache.put(request, response.clone()));
  }

  return response;
}

function validateSignedUrl(url) {
  // same logic as in backend security.service.ts but in JS
  // for brevity, assume implemented here
  return true; // placeholder
}
