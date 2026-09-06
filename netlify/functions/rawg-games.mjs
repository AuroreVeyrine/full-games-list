const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' }
});

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Netlify.env.get('RAWG_API_KEY');
  if (!apiKey) return json({ error: 'RAWG_API_KEY is not configured in Netlify.' }, 500);

  const incoming = new URL(request.url);
  const gameId = incoming.searchParams.get('id');
  const page = Math.max(1, Number.parseInt(incoming.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(40, Math.max(1, Number.parseInt(incoming.searchParams.get('page_size') || '40', 10)));
  if (gameId && !/^\d+$/.test(gameId)) return json({ error: 'Invalid game id' }, 400);
  const rawgUrl = new URL(gameId ? `https://api.rawg.io/api/games/${gameId}` : 'https://api.rawg.io/api/games');
  rawgUrl.searchParams.set('key', apiKey);
  if (!gameId) {
    rawgUrl.searchParams.set('page', String(page));
    rawgUrl.searchParams.set('page_size', String(pageSize));
    rawgUrl.searchParams.set('ordering', '-added');
  }

  try {
    const response = await fetch(rawgUrl);
    const data = await response.json();
    if (!response.ok) return json({ error: 'RAWG request failed', details: data }, response.status);
    return json(data);
  } catch {
    return json({ error: 'RAWG is temporarily unavailable.' }, 502);
  }
};
