export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { password } = await request.json();
  const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'admin123';

  if (password === ADMIN_PASSWORD) {
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Set-Cookie': `admin_token=${password}; Expires=${expires.toUTCString()}; Path=/; HttpOnly; Secure; SameSite=Strict`,
        'Content-Type': 'application/json'
      }
    });
  } else {
    return new Response(JSON.stringify({ success: false, message: '密码错误' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
