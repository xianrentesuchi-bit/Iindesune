document.addEventListener('DOMContentLoaded', () => {
    // 開閉サイドバーの動作
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    
    // ローカルストレージから状態を復元
    if (localStorage.getItem('sidebar-collapsed') === 'true') {
        sidebar.classList.add('collapsed');
    }

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
        });
    }

    const currentUser = JSON.parse(localStorage.getItem('user'));
    const path = window.location.pathname;

    // ガード処理
    if (!currentUser && path !== '/') {
        window.location.href = '/';
        return;
    }

    // ログアウト処理
    const logoutBtn = document.getElementById('logoutBtn');
    if (currentUser && logoutBtn) {
        logoutBtn.classList.remove('hidden');
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('user');
            window.location.href = '/';
        });
    }

    // 1. ホーム画面の制御
    if (document.getElementById('authSection')) {
        const authSection = document.getElementById('authSection');
        const mainSection = document.getElementById('mainSection');
        const msgInput = document.getElementById('msgInput');
        const charCount = document.getElementById('charCount');
        const postBtn = document.getElementById('postBtn');
        let isLoginMode = true;

        if (currentUser) {
            authSection.classList.add('hidden');
            mainSection.classList.remove('hidden');
            fetchTimeline();
        }

        const toggleAuth = document.getElementById('toggleAuth');
        if (toggleAuth) {
            toggleAuth.addEventListener('click', () => {
                isLoginMode = !isLoginMode;
                document.getElementById('authTitle').innerText = isLoginMode ? 'ログイン' : 'アカウント新規登録';
                toggleAuth.innerText = isLoginMode ? '新規登録はこちら' : 'ログインはこちら';
            });
        }

        document.getElementById('authSubmit').addEventListener('click', async () => {
            const username = document.getElementById('authUser').value;
            const password = document.getElementById('authPass').value;
            const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();

                if (data.success) {
                    const userSession = {
                        username: data.username,
                        userId: data.userId,
                        display_name: data.username,
                        avatar_url: 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png'
                    };
                    localStorage.setItem('user', JSON.stringify(userSession));
                    window.location.reload();
                } else {
                    alert(data.message);
                }
            } catch (e) {
                alert('認証処理に失敗しました。');
            }
        });

        if (msgInput) {
            msgInput.addEventListener('input', () => {
                const len = msgInput.value.length;
                charCount.textContent = `${len} / 140`;
                postBtn.disabled = (len > 140 || len === 0);
            });
        }

        if (postBtn) {
            postBtn.addEventListener('click', async () => {
                if (!msgInput.value.trim()) return;
                postBtn.disabled = true;

                await fetch('/api/tweets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        display_name: currentUser.display_name,
                        username: currentUser.username,
                        avatar_url: currentUser.avatar_url,
                        message: msgInput.value
                    })
                });

                msgInput.value = '';
                charCount.textContent = '0 / 140';
                fetchTimeline();
            });
        }
    }

    // 2. プロフィール画面の制御
    if (path === '/profile') {
        const pImg = document.getElementById('profImg');
        const pDisplay = document.getElementById('profDisplay');
        const pUser = document.getElementById('profUser');
        const eDisplay = document.getElementById('editDisplay');
        const eAvatar = document.getElementById('editAvatar');

        pImg.src = currentUser.avatar_url;
        pDisplay.innerText = currentUser.display_name;
        pUser.innerText = `@${currentUser.username}`;
        eDisplay.value = currentUser.display_name;
        eAvatar.value = currentUser.avatar_url;

        document.getElementById('saveProfile').addEventListener('click', () => {
            currentUser.display_name = eDisplay.value;
            currentUser.avatar_url = eAvatar.value;
            localStorage.setItem('user', JSON.stringify(currentUser));
            window.location.reload();
        });
    }

    // 3. 通知画面の制御
    if (path === '/notifications') {
        fetch(`/api/notifications/${currentUser.username}`)
            .then(res => res.json())
            .then(notifications => {
                const list = document.getElementById('notificationList');
                if (notifications.length === 0) {
                    list.innerHTML = '<p style="padding:20px; color:var(--text-muted);">通知はまだありません。</p>';
                    return;
                }
                list.innerHTML = notifications.map(n => `
                    <div class="notification-card">
                        <span class="material-icons notification-icon">alternate_email</span>
                        <div>
                            <div style="font-weight:bold;">${escapeHTML(n.from_display_name)} さんからメンション</div>
                            <div style="font-size:14px; color:var(--text-muted); margin-top:4px;">${n.message}</div>
                        </div>
                    </div>
                `).join('');
            });
    }

    async function fetchTimeline() {
        const response = await fetch('/api/tweets');
        const tweets = await response.json();
        const timeline = document.getElementById('timeline');
        if (!timeline) return;

        timeline.innerHTML = tweets.map(t => `
            <div class="tweet">
                <img class="avatar" src="${t.avatar_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png'}">
                <div class="tweet-content">
                    <div class="tweet-meta">
                        <span class="display-name">${escapeHTML(t.display_name)}</span>
                        <span class="username">@${escapeHTML(t.username)}</span>
                    </div>
                    <p class="tweet-text">${escapeHTML(t.message)}</p>
                </div>
            </div>
        `).join('');
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
    }
});
