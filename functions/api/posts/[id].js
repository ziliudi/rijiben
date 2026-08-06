export async function onRequest(context) {
  const { request, env, params } = context;
  const id = params.id;

  const isAuth = await checkAuth(request);
  if (!isAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  if (request.method === 'GET') {
    let row;
    if (!isNaN(id)) {
      row = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
    } else {
      row = await env.DB.prepare('SELECT * FROM posts WHERE slug = ?').bind(id).first();
    }
    if (!row) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }
    return new Response(JSON.stringify(row), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'PUT') {
    const { title, subtitle, slug, content, category, tags, status, created_at } = await request.json();
    await env.DB.prepare(
      `UPDATE posts SET title=?, subtitle=?, slug=?, content=?, category=?, tags=?, status=?, created_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).bind(title, subtitle, slug, content, category, JSON.stringify(tags), status, created_at, id).run();
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
    return new Response(JSON.stringify({ success: true }), {
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
