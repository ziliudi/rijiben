import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';

type Bindings = {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();
app.use('/api/*', cors());

// 鉴权中间件
const authMiddleware = async (c: any, next: any) => {
  const cookie = c.req.header('Cookie') || '';
  const token = cookie.split('; ').find((row: string) => row.startsWith('auth_token='))?.split('=')[1];
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  try {
    await verify(token, c.env.JWT_SECRET);
    await next();
  } catch (e) {
    return c.json({ error: 'Invalid token' }, 401);
  }
};

// 登录接口
app.post('/api/login', async (c) => {
  const { password } = await c.req.json();
  if (password !== c.env.ADMIN_PASSWORD) return c.json({ error: 'Wrong password' }, 401);
  const token = await sign({ role: 'admin', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 }, c.env.JWT_SECRET);
  c.header('Set-Cookie', `auth_token=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=86400`);
  return c.json({ success: true });
});

// 获取文章列表（公开）
app.get('/api/posts', async (c) => {
  const tag = c.req.query('tag');
  let query = `SELECT p.* FROM posts p WHERE p.published = 1`;
  let params = [];
  if (tag) {
    query += ` AND p.id IN (SELECT post_id FROM post_tags pt JOIN tags t ON pt.tag_id = t.id WHERE t.slug = ?)`;
    params.push(tag);
  }
  query += ` ORDER BY p.created_at DESC`;
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json(results);
});

// 获取单篇文章（公开，通过自定义 slug）
app.get('/api/posts/:slug', async (c) => {
  const slug = c.req.param('slug');
  const post = await c.env.DB.prepare('SELECT * FROM posts WHERE slug = ?').bind(slug).first();
  if (!post) return c.json({ error: 'Not found' }, 404);
  const { results: tags } = await c.env.DB.prepare(
    'SELECT t.name, t.slug FROM tags t JOIN post_tags pt ON t.id = pt.tag_id WHERE pt.post_id = ?'
  ).bind(post.id).all();
  return c.json({ ...post, tags });
});

// 获取所有标签（公开）
app.get('/api/tags', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM tags ORDER BY id DESC').all();
  return c.json(results);
});

// 后台：发布/编辑文章（需鉴权）
app.post('/api/admin/posts', authMiddleware, async (c) => {
  const { title, slug, content, created_at, tags } = await c.req.json();
  const existing = await c.env.DB.prepare('SELECT id FROM posts WHERE slug = ?').bind(slug).first();
  
  let postId;
  if (existing) {
    await c.env.DB.prepare('UPDATE posts SET title=?, content=?, created_at=? WHERE slug=?').bind(title, content, created_at, slug).run();
    postId = existing.id;
    await c.env.DB.prepare('DELETE FROM post_tags WHERE post_id=?').bind(postId).run();
  } else {
    const res = await c.env.DB.prepare('INSERT INTO posts (title, slug, content, created_at) VALUES (?, ?, ?, ?)').bind(title, slug, content, created_at).run();
    postId = res.meta.last_row_id;
  }
  
  // 处理标签
  if (tags && tags.length > 0) {
    for (const tagName of tags) {
      const tagSlug = tagName.toLowerCase().replace(/\s+/g, '-');
      await c.env.DB.prepare('INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)').bind(tagName, tagSlug).run();
      const tagRecord = await c.env.DB.prepare('SELECT id FROM tags WHERE slug = ?').bind(tagSlug).first();
      await c.env.DB.prepare('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)').bind(postId, tagRecord.id).run();
    }
  }
  return c.json({ success: true });
});

export const onRequest = app.fetch;
