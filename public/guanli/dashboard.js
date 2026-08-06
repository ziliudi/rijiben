let quill = null;
let currentPostId = null;

document.addEventListener('DOMContentLoaded', () => {
  quill = new Quill('#editor', { theme: 'snow', placeholder: '撰写文章内容...' });
  loadPosts();
});

async function loadPosts() {
  const res = await fetch('/api/posts?status=all');
  if (!res.ok) return alert('加载失败');
  const posts = await res.json();
  const container = document.getElementById('post-list-admin');
  if (!posts.length) {
    container.innerHTML = '<p style="color:#999;">暂无文章</p>';
    return;
  }
  container.innerHTML = posts.map(p => `
    <div class="post-item">
      <div>
        <span class="title">${p.title}</span>
        <span class="info">（${p.status}） ${new Date(p.created_at).toLocaleString('zh-CN')}</span>
      </div>
      <div class="actions">
        <button class="btn btn-primary" onclick="editPost(${p.id})">编辑</button>
        <button class="btn btn-danger" onclick="deletePost(${p.id})">删除</button>
      </div>
    </div>
  `).join('');
}

function newPost() {
  currentPostId = null;
  document.getElementById('editorTitle').textContent = '新建文章';
  document.getElementById('editTitle').value = '';
  document.getElementById('editSubtitle').value = '';
  document.getElementById('editSlug').value = '';
  document.getElementById('editCategory').value = '随笔';
  document.getElementById('editTags').value = '';
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('editCreatedAt').value = local;
  document.getElementById('editStatus').value = 'draft';
  quill.setContents([]);
  document.getElementById('editorArea').style.display = 'block';
}

async function editPost(id) {
  const res = await fetch(`/api/posts/${id}`);
  if (!res.ok) return alert('加载失败');
  const post = await res.json();
  currentPostId = id;
  document.getElementById('editorTitle').textContent = '编辑文章';
  document.getElementById('editTitle').value = post.title;
  document.getElementById('editSubtitle').value = post.subtitle || '';
  document.getElementById('editSlug').value = post.slug;
  document.getElementById('editCategory').value = post.category || '随笔';
  document.getElementById('editTags').value = (post.tags ? JSON.parse(post.tags) : []).join(', ');
  const date = new Date(post.created_at);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('editCreatedAt').value = local;
  document.getElementById('editStatus').value = post.status;
  quill.setContents(quill.clipboard.convert(post.content));
  document.getElementById('editorArea').style.display = 'block';
}

async function savePost() {
  const data = {
    title: document.getElementById('editTitle').value.trim(),
    subtitle: document.getElementById('editSubtitle').value.trim(),
    slug: document.getElementById('editSlug').value.trim() || generateSlug(document.getElementById('editTitle').value),
    content: quill.root.innerHTML,
    category: document.getElementById('editCategory').value.trim() || '随笔',
    tags: document.getElementById('editTags').value.split(',').map(s => s.trim()).filter(Boolean),
    status: document.getElementById('editStatus').value,
    created_at: document.getElementById('editCreatedAt').value
  };
  if (!data.title) return alert('标题不能为空');
  if (!data.content || data.content === '<p><br></p>') return alert('正文不能为空');

  const url = currentPostId ? `/api/posts/${currentPostId}` : '/api/posts';
  const method = currentPostId ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (res.ok) {
    alert('保存成功！');
    document.getElementById('editorArea').style.display = 'none';
    loadPosts();
  } else {
    const err = await res.text();
    alert('保存失败：' + err);
  }
}

function cancelEdit() {
  document.getElementById('editorArea').style.display = 'none';
}

async function deletePost(id) {
  if (!confirm('确定删除吗？')) return;
  const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
  if (res.ok) loadPosts();
  else alert('删除失败');
}

function logout() {
  document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  window.location.href = '/guanli/login.html';
}

function generateSlug(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '');
}
