export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 校验认证（POST/PUT/DELETE 需要）
  const isAuth = await checkAuth(request);
  if (request.method !== 'GET' && !isAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // ========== GET ==========
  if (request.method === 'GET') {
    const status = url.searchParams.get('status') || 'published';
    const category = url.searchParams.get('category'); // 分类筛选
    const latest = url.searchParams.get('latest') === 'true'; // 最新模式
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = parseInt(url.searchParams.get('limit')) || 10;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM posts';
    const params = [];
    const whereClauses = [];

    // 状态过滤
    if (status !== 'all') {
      whereClauses.push('status = ?');
      params.push(status);
    }

    // 分类过滤
    if (category) {
      whereClauses.push('category = ?');
      params.push(category);
    }

    if (whereClauses.length) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    // 排序（默认按创建时间降序）
    sql += ' ORDER BY created_at DESC';

    // 最新模式：只取最新 limit 条，不分页
    if (latest) {
      sql += ' LIMIT ?';
      params.push(limit);
      const { results } = await env.DB.prepare(sql).bind(...params).all();
      return new Response(JSON.stringify({ posts: results }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 正常分页
    sql += ' LIMIT ? OFFSET ?';
    const countParams = params.slice(); // 复制参数用于计数
    params.push(limit, offset);

    const { results } = await env.DB.prepare(sql).bind(...params).all();

    // 计数查询（去掉 LIMIT/OFFSET）
    let countSql = 'SELECT COUNT(*) as total FROM posts';
    if (whereClauses.length) {
      countSql += ' WHERE ' + whereClauses.join(' AND ');
    }
    const { results: countResult } = await env.DB.prepare(countSql).bind(...countParams).all();
    const total = countResult[0]?.total || 0;

    return new Response(JSON.stringify({
      posts: results,
      total,
      page,
      limit,
      hasMore: offset + results.length < total
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========== POST ==========
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
