// Security headers for every response (C85). The CSP allows exactly what the built app/index.html loads today:
// its own inline <script>/<style> (one file, by design), Google Fonts, the cdnjs QR library (until C04 vendors
// it, then drop cdnjs), map tiles from TILE_URL's origin, and data:/blob: images (photo clips, canvas).
// CSP_EXTRA appends sources, e.g. CSP_EXTRA="img-src https://tiles.example.com; connect-src https://x.ingest.sentry.io".
'use strict';

function originOf(u) { try { return new URL(u.replace(/\{[a-z]\}/g, '0')).origin; } catch (e) { return ''; } }

function buildCsp({ tileUrl = '', extra = '' } = {}) {
  const tiles = originOf(tileUrl);
  const d = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
    'img-src': ["'self'", 'data:', 'blob:', ...(tiles ? [tiles] : [])],
    'connect-src': ["'self'", ...(tiles ? [tiles] : [])],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  for (const part of String(extra).split(';').map(x => x.trim()).filter(Boolean)) {
    const [k, ...v] = part.split(/\s+/); if (!d[k]) d[k] = []; for (const x of v) if (!d[k].includes(x)) d[k].push(x);
  }
  return Object.entries(d).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');
}

// secure: the public URL is https (Render terminates TLS), so HSTS is safe to send.
function securityHeaders({ secure = false, tileUrl = '', extra = '' } = {}) {
  const h = {
    'content-security-policy': buildCsp({ tileUrl, extra }),
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin', // still sends the origin the OSM tile policy asks for
    'permissions-policy': 'geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()',
    'x-frame-options': 'DENY',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
  };
  if (secure) h['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
  return h;
}

module.exports = { securityHeaders, buildCsp, originOf };
