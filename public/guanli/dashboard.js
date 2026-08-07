// public/guanli/dashboard.js

// ===== 全局变量 =====
let quill;                  // Quill 编辑器实例
let currentPostId = null;   // 编辑中的文章 ID（null 表示新建）
let allPosts = [];          // 当前列表数据（用于前端筛选/刷新）

// ===== DOM 引用 =====
const postListEl = document.getElementById('postList');
const postForm = document.getElementById('postForm');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const categoryInput = document.getElementById('category');
const tagsInput = document.getElementById('tags');
const statusSelect = document.getElementById('status');
const publishDateInput = document.getElementById('publishDate');
const slugInput = document.getElementById('slug');        // 可能需要自动生成，但保留手动
const editorContainer = document.getElementById('editor');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');

// ===== 初始化 Quill =====
if (editorContainer) {
    quill = new Quill(editorContainer, {
        theme: 'snow',
        placeholder: '写文章内容...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['link', 'image', 'video'],
                ['clean']
            ]
        }
    });
}

// ===== 加载文章列表 =====
function loadPosts() {
    fetch('/api/posts?status=all')
        .then(res => res.json())
        .then(data => {
            // 如果 data 是数组，直接使用；如果是对象且包含 posts 字段，则使用 data.posts
            let posts = Array.isArray(data) ? data : (data.posts || []);
            allPosts = posts;
            renderPostList(posts);
        })
        .catch(err => {
            console.error('加载文章列表失败:', err);
            postListEl.innerHTML = '<p>加载失败，请刷新重试</p>';
        });
}

// ===== 渲染文章列表 =====
function renderPostList(posts) {
    if (!postListEl) return;
    if (!posts || posts.length === 0) {
        postListEl.innerHTML = '<p>暂无文章</p>';
        return;
    }
    let html = '<ul class="post-list">';
    posts.forEach(post => {
        const statusText = post.status === 'published' ? '已发布' : '草稿';
        const dateStr = post.created_at ? new Date(post.created_at).toLocaleDateString('zh-CN') : '';
        html += `
            <li data-id="${post.id}">
                <div class="post-info">
                    <span class="post-title">${post.title || '无标题'}</span>
                    <span class="post-status">${statusText}</span>
                    <span class="post-date">${dateStr}</span>
                </div>
                <div class="post-actions">
                    <button class="edit-btn" data-id="${post.id}">编辑</button>
                    <button class="delete-btn" data-id="${post.id}">删除</button>
                </div>
            </li>
        `;
    });
    html += '</ul>';
    postListEl.innerHTML = html;

    // 绑定事件（事件委托）
    postListEl.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.id);
            editPost(id);
        });
    });
    postListEl.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.dataset.id);
            deletePost(id);
        });
    });
}

// ===== 编辑文章（加载数据到表单） =====
function editPost(id) {
    fetch(`/api/posts/${id}`)
        .then(res => {
            if (!res.ok) throw new Error('文章不存在');
            return res.json();
        })
        .then(post => {
            currentPostId = post.id;
            titleInput.value = post.title || '';
            subtitleInput.value = post.subtitle || '';
            categoryInput.value = post.category || '';
            tagsInput.value = post.tags || '';
            statusSelect.value = post.status || 'draft';
            if (publishDateInput) {
                // 假设 created_at 是 ISO 字符串，取前10位作为日期
                const date = post.created_at ? post.created_at.slice(0, 10) : '';
                publishDateInput.value = date;
            }
            slugInput.value = post.slug || '';
            // 设置编辑器内容
            quill.root.innerHTML = post.content || '';
            // 切换到表单视图（隐藏列表，显示编辑器）
            document.getElementById('listView').style.display = 'none';
            document.getElementById('editorView').style.display = 'block';
            saveBtn.textContent = '更新文章';
        })
        .catch(err => {
            console.error('加载文章数据失败:', err);
            alert('加载文章数据失败');
        });
}

// ===== 删除文章 =====
function deletePost(id) {
    if (!confirm('确认删除此文章？')) return;
    fetch(`/api/posts/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                loadPosts();  // 刷新列表
                alert('删除成功');
            } else {
                alert('删除失败：' + (data.message || '未知错误'));
            }
        })
        .catch(err => {
            console.error('删除失败:', err);
            alert('删除失败');
        });
}

// ===== 保存文章（新建或更新） =====
function savePost() {
    // 收集表单数据
    const title = titleInput.value.trim();
    const subtitle = subtitleInput.value.trim();
    const category = categoryInput.value.trim();
    const tags = tagsInput.value.trim();
    const status = statusSelect.value;
    const publishDate = publishDateInput ? publishDateInput.value : '';
    let slug = slugInput.value.trim();

    // 如果 slug 为空，根据标题生成
    if (!slug && title) {
        slug = title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');
    }

    const content = quill.root.innerHTML;

    // 简单校验
    if (!title) {
        alert('请填写标题');
        return;
    }
    if (!content || content === '<p><br></p>') {
        alert('请填写内容');
        return;
    }

    const postData = {
        title,
        subtitle,
        category,
        tags,
        status,
        publish_date: publishDate || new Date().toISOString().slice(0, 10),
        slug,
        content
    };

    const url = currentPostId ? `/api/posts/${currentPostId}` : '/api/posts';
    const method = currentPostId ? 'PUT' : 'POST';

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
    })
        .then(res => res.json())
        .then(data => {
            if (data.id || data.success) {
                // 保存成功，刷新列表
                loadPosts();
                // 重置表单，关闭编辑器视图
                resetForm();
                document.getElementById('listView').style.display = 'block';
                document.getElementById('editorView').style.display = 'none';
                saveBtn.textContent = '发布文章';
                currentPostId = null;
                alert('保存成功！');
            } else {
                alert('保存失败：' + (data.message || '未知错误'));
            }
        })
        .catch(err => {
            console.error('保存出错:', err);
            alert('保存出错，请重试');
        });
}

// ===== 重置表单 =====
function resetForm() {
    titleInput.value = '';
    subtitleInput.value = '';
    categoryInput.value = '';
    tagsInput.value = '';
    statusSelect.value = 'draft';
    if (publishDateInput) publishDateInput.value = '';
    slugInput.value = '';
    quill.root.innerHTML = '';
    currentPostId = null;
}

// ===== 新建文章（显示编辑器） =====
function newPost() {
    resetForm();
    document.getElementById('listView').style.display = 'none';
    document.getElementById('editorView').style.display = 'block';
    saveBtn.textContent = '发布文章';
    currentPostId = null;
}

// ===== 取消编辑，返回列表 =====
function cancelEdit() {
    document.getElementById('listView').style.display = 'block';
    document.getElementById('editorView').style.display = 'none';
    resetForm();
    currentPostId = null;
    saveBtn.textContent = '发布文章';
}

// ===== 初始化页面 =====
document.addEventListener('DOMContentLoaded', function() {
    // 加载列表
    loadPosts();

    // 新建按钮
    const newBtn = document.getElementById('newPostBtn');
    if (newBtn) newBtn.addEventListener('click', newPost);

    // 保存按钮
    if (saveBtn) saveBtn.addEventListener('click', savePost);

    // 取消按钮
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);

    // 默认显示列表，隐藏编辑器
    if (document.getElementById('listView')) {
        document.getElementById('listView').style.display = 'block';
    }
    if (document.getElementById('editorView')) {
        document.getElementById('editorView').style.display = 'none';
    }
});
