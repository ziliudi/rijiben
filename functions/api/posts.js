export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const isAuth = await checkAuth(request);
  if (request.method !== 'GET' && !isAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  if (request.method === 'GET') {
    const status = url.searchParams.get('status') || 'published';
    let sql = 'SELECT * FROM posts';
    const params = [];
    if (status !== 'all') {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const { results } = await env.DB.prepare(sql).bind(...params).all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'POST') {
    const { title, subtitle, slug, content, category, tags, status, created_at } = await request.json();
    const createdAt = created_at || new Date().toISOString();
    const result = await env.DB.prepare(
      `INSERT INTO posts (title, subtitle, slug, content, category, tags, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(title, subtitle, slug, content, category, JSON.stringify(tags), status, createdAt).run();
    return new Response(JSON.stringify({ id: result.meta.last_row_id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { status: 405 });
}

async function checkAuth(request) {
  const cookie = request.headers.get('Cookie') || '';
  const token = cookie.split('; ').find(c => c.startsWith('admin_token='));
  if (!token) return false;
  const password = token.split('=')[1];
  return password === (process.env.ADMIN_PASSWORD || 'admin123');
}
