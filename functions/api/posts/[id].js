// functions/api/posts/[id].js

export async function onRequest(context) {
    const { request, env, params } = context;
    const { id } = params;          // 可能是数字 id，也可能是 slug 字符串

    // 仅支持 GET 请求（获取单篇文章）
    if (request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const db = env.DB;

    try {
        let post;

        // 判断 id 是否为纯数字
        const isNumeric = /^\d+$/.test(id);
        if (isNumeric) {
            // 按数字 ID 查询
            post = await db.prepare('SELECT * FROM posts WHERE id = ?').bind(Number(id)).first();
        } else {
            // 按 slug 查询
            post = await db.prepare('SELECT * FROM posts WHERE slug = ?').bind(id).first();
        }

        if (!post) {
            return new Response('Not Found', { status: 404 });
        }

        return new Response(JSON.stringify(post), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error(error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
