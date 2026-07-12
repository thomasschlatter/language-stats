// A tiny in-memory rate limiter (per client IP + path). Enough to blunt
// brute-force/abuse on sensitive endpoints; for multi-instance deploys use a
// shared store (Redis) instead.

const buckets = new Map();

export function rateLimit({ windowMs = 15 * 60 * 1000, max = 20 } = {}) {
  return (req, res, next) => {
    const id = `${req.ip || req.socket?.remoteAddress || '?'}:${req.path}`;
    const now = Date.now();
    let b = buckets.get(id);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(id, b);
    }
    b.count += 1;
    if (b.count > max) {
      const retry = Math.ceil((b.resetAt - now) / 1000);
      res.set('Retry-After', String(retry));
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }
    next();
  };
}

// Occasionally drop expired buckets so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
}, 10 * 60 * 1000).unref?.();
