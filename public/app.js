// ============ STATE ============
let currentUser = null;

// ============ API HELPERS ============
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'エラーが発生しました');
  return data;
}

// ============ AUTH ============
async function checkAuth() {
  try {
    currentUser = await api('/api/auth/me');
    showMainScreen();
  } catch {
    showAuthScreen();
  }
}

function showAuthScreen() {
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('main-screen').classList.remove('active');
}

function showMainScreen() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('main-screen').classList.add('active');
  document.getElementById('user-display-name').textContent = currentUser.display_name;

  if (currentUser.role === 'admin') {
    document.getElementById('admin-nav-btn').style.display = '';
  }

  navigateTo('restaurants');
}

// Auth tabs
document.querySelectorAll('.auth-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach((f) => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}-form`).classList.add('active');
  });
});

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  try {
    currentUser = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('login-username').value,
        password: document.getElementById('login-password').value,
      }),
    });
    showMainScreen();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// Register
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('register-error');
  errorEl.textContent = '';
  try {
    currentUser = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        invite_code: document.getElementById('register-invite').value.trim().toUpperCase(),
        username: document.getElementById('register-username').value,
        display_name: document.getElementById('register-displayname').value,
        password: document.getElementById('register-password').value,
      }),
    });
    showMainScreen();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  showAuthScreen();
});

// ============ NAVIGATION ============
function navigateTo(page) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

  document.getElementById(`page-${page}`).classList.add('active');
  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (page === 'restaurants') loadRestaurants();
  if (page === 'favorites') loadFavorites();
  if (page === 'invite') loadInvitations();
  if (page === 'admin') loadAdmin();
}

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

// ============ RESTAURANTS ============
async function loadRestaurants() {
  const params = new URLSearchParams();
  const search = document.getElementById('search-input').value;
  const category = document.getElementById('filter-category').value;
  const area = document.getElementById('filter-area').value;
  const sort = document.getElementById('sort-select').value;

  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (area) params.set('area', area);
  if (sort) params.set('sort', sort);

  const restaurants = await api(`/api/restaurants?${params}`);
  renderRestaurantGrid('restaurant-list', restaurants);
  loadFilters();
}

async function loadFilters() {
  const [categories, areas] = await Promise.all([api('/api/categories'), api('/api/areas')]);

  const catSelect = document.getElementById('filter-category');
  const currentCat = catSelect.value;
  catSelect.innerHTML = '<option value="">すべてのジャンル</option>';
  categories.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    if (c === currentCat) opt.selected = true;
    catSelect.appendChild(opt);
  });

  const areaSelect = document.getElementById('filter-area');
  const currentArea = areaSelect.value;
  areaSelect.innerHTML = '<option value="">すべてのエリア</option>';
  areas.forEach((a) => {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    if (a === currentArea) opt.selected = true;
    areaSelect.appendChild(opt);
  });
}

function renderRestaurantGrid(containerId, restaurants) {
  const container = document.getElementById(containerId);
  if (restaurants.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <p>お店が見つかりませんでした</p>
      </div>`;
    return;
  }

  container.innerHTML = restaurants
    .map((r) => {
      const stars = renderStars(r.avg_rating);
      const imageHtml = r.image_url
        ? `<img src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.name)}" onerror="this.parentElement.innerHTML='<div class=card-image-placeholder>&#127860;</div>'">`
        : '<div class="card-image-placeholder">&#127860;</div>';
      const favBadge = r.is_favorite ? '<div class="card-favorite-badge">&#9829;</div>' : '';

      return `
        <div class="restaurant-card" onclick="showDetail('${r.id}')">
          <div class="card-image">
            ${imageHtml}
            <div class="card-category-badge">${escapeHtml(r.category)}</div>
            ${favBadge}
          </div>
          <div class="card-body">
            <div class="card-name">${escapeHtml(r.name)}</div>
            <div class="card-meta">
              <div class="card-rating">
                <span class="stars">${stars}</span>
                <span>${Number(r.avg_rating).toFixed(1)}</span>
                <span>(${r.review_count}件)</span>
              </div>
              <span>${escapeHtml(r.area)}</span>
            </div>
            ${r.description ? `<div class="card-description">${escapeHtml(r.description)}</div>` : ''}
          </div>
          <div class="card-footer">
            <span>${escapeHtml(r.budget || '')}</span>
            <span>by ${escapeHtml(r.posted_by_name)}</span>
          </div>
        </div>`;
    })
    .join('');
}

// Search & Filter event listeners
let searchTimeout;
document.getElementById('search-input').addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadRestaurants, 300);
});

document.getElementById('filter-category').addEventListener('change', loadRestaurants);
document.getElementById('filter-area').addEventListener('change', loadRestaurants);
document.getElementById('sort-select').addEventListener('change', loadRestaurants);

// ============ RESTAURANT DETAIL ============
async function showDetail(id) {
  const data = await api(`/api/restaurants/${id}`);
  const container = document.getElementById('restaurant-detail');
  const stars = renderStars(data.avg_rating);
  const isOwner = data.posted_by === currentUser.id || currentUser.role === 'admin';

  const imageHtml = data.image_url
    ? `<img src="${escapeHtml(data.image_url)}" alt="${escapeHtml(data.name)}" onerror="this.parentElement.innerHTML='<div class=detail-image-placeholder>&#127860;</div>'">`
    : '<div class="detail-image-placeholder">&#127860;</div>';

  container.innerHTML = `
    <div class="detail-back">
      <button class="btn btn-ghost" onclick="navigateTo('restaurants')">&larr; お店一覧に戻る</button>
    </div>
    <div class="detail-header">
      <div class="detail-image">${imageHtml}</div>
      <div class="detail-info">
        <span class="detail-category">${escapeHtml(data.category)}</span>
        <h2 class="detail-name">${escapeHtml(data.name)}</h2>
        <div class="detail-rating">
          <span class="stars">${stars}</span>
          <strong>${Number(data.avg_rating).toFixed(1)}</strong>
          <span class="count">(${data.review_count}件のレビュー)</span>
        </div>
        <div class="detail-meta-grid">
          ${data.area ? `<span class="detail-meta-label">エリア</span><span>${escapeHtml(data.area)}</span>` : ''}
          ${data.budget ? `<span class="detail-meta-label">予算</span><span>${escapeHtml(data.budget)}</span>` : ''}
          ${data.address ? `<span class="detail-meta-label">住所</span><span>${escapeHtml(data.address)}</span>` : ''}
          ${data.phone ? `<span class="detail-meta-label">電話</span><span>${escapeHtml(data.phone)}</span>` : ''}
          <span class="detail-meta-label">投稿者</span><span>${escapeHtml(data.posted_by_name)}</span>
        </div>
        <div class="detail-actions">
          <button class="btn ${data.is_favorite ? 'btn-danger' : 'btn-primary'}" onclick="toggleFavorite('${data.id}')">
            ${data.is_favorite ? '&#9829; お気に入り解除' : '&#9825; お気に入り'}
          </button>
          <button class="btn btn-ghost" onclick="openReviewModal('${data.id}')">&#9998; レビューを書く</button>
          ${isOwner ? `
            <button class="btn btn-ghost" onclick="editRestaurant('${data.id}')">編集</button>
            <button class="btn btn-ghost" onclick="deleteRestaurant('${data.id}')">削除</button>
          ` : ''}
        </div>
      </div>
    </div>
    ${data.description ? `
      <div class="detail-description">
        <h3>お店について</h3>
        ${escapeHtml(data.description)}
      </div>
    ` : ''}
    <div class="reviews-section">
      <div class="reviews-header">
        <h3>レビュー (${data.reviews.length}件)</h3>
      </div>
      ${data.reviews.length === 0 ? '<p class="text-muted">まだレビューがありません。最初のレビューを書いてみましょう!</p>' : ''}
      ${data.reviews.map((rv) => {
        const rvStars = renderStars(rv.rating);
        const canDelete = rv.user_id === currentUser.id || currentUser.role === 'admin';
        return `
          <div class="review-card">
            <div class="review-header">
              <div class="review-user">
                <div class="review-avatar">${escapeHtml(rv.user_name.charAt(0))}</div>
                <div class="review-user-info">
                  <div class="review-name">${escapeHtml(rv.user_name)}</div>
                  <div class="review-date">${rv.visit_date ? `訪問: ${rv.visit_date}` : ''} ${formatDate(rv.created_at)}</div>
                </div>
              </div>
              <div>
                <span class="review-stars">${rvStars}</span>
                ${canDelete ? `<button class="review-delete" onclick="deleteReview('${rv.id}', '${data.id}')">削除</button>` : ''}
              </div>
            </div>
            <div class="review-title">${escapeHtml(rv.title)}</div>
            <div class="review-comment">${escapeHtml(rv.comment)}</div>
          </div>`;
      }).join('')}
    </div>
  `;

  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.getElementById('page-detail').classList.add('active');
}

async function toggleFavorite(id) {
  await api(`/api/restaurants/${id}/favorite`, { method: 'POST' });
  showDetail(id);
}

async function deleteRestaurant(id) {
  if (!confirm('このお店を削除しますか?')) return;
  await api(`/api/restaurants/${id}`, { method: 'DELETE' });
  navigateTo('restaurants');
}

async function deleteReview(reviewId, restaurantId) {
  if (!confirm('このレビューを削除しますか?')) return;
  await api(`/api/reviews/${reviewId}`, { method: 'DELETE' });
  showDetail(restaurantId);
}

// ============ ADD/EDIT RESTAURANT ============
document.getElementById('add-restaurant-btn').addEventListener('click', () => {
  document.getElementById('form-restaurant-id').value = '';
  document.getElementById('form-title').textContent = 'お店を追加';
  document.getElementById('restaurant-form').reset();

  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.getElementById('page-restaurant-form').classList.add('active');
});

document.getElementById('form-back-btn').addEventListener('click', () => {
  navigateTo('restaurants');
});

async function editRestaurant(id) {
  const data = await api(`/api/restaurants/${id}`);
  document.getElementById('form-restaurant-id').value = id;
  document.getElementById('form-title').textContent = 'お店を編集';
  document.getElementById('form-name').value = data.name;
  document.getElementById('form-category').value = data.category;
  document.getElementById('form-area').value = data.area;
  document.getElementById('form-budget').value = data.budget || '';
  document.getElementById('form-address').value = data.address || '';
  document.getElementById('form-phone').value = data.phone || '';
  document.getElementById('form-image-url').value = data.image_url || '';
  document.getElementById('form-description').value = data.description || '';

  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.getElementById('page-restaurant-form').classList.add('active');
}

document.getElementById('restaurant-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('form-restaurant-id').value;
  const body = {
    name: document.getElementById('form-name').value,
    category: document.getElementById('form-category').value,
    area: document.getElementById('form-area').value,
    budget: document.getElementById('form-budget').value,
    address: document.getElementById('form-address').value,
    phone: document.getElementById('form-phone').value,
    image_url: document.getElementById('form-image-url').value,
    description: document.getElementById('form-description').value,
  };

  if (id) {
    await api(`/api/restaurants/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    showDetail(id);
  } else {
    const result = await api('/api/restaurants', { method: 'POST', body: JSON.stringify(body) });
    showDetail(result.id);
  }
});

// ============ REVIEWS ============
function openReviewModal(restaurantId) {
  document.getElementById('review-restaurant-id').value = restaurantId;
  document.getElementById('review-form').reset();
  document.getElementById('review-rating').value = '';
  document.querySelectorAll('#star-rating .star').forEach((s) => s.classList.remove('active'));
  document.getElementById('review-modal').classList.add('active');
}

// Star rating interaction
document.querySelectorAll('#star-rating .star').forEach((star) => {
  star.addEventListener('click', () => {
    const value = parseInt(star.dataset.value);
    document.getElementById('review-rating').value = value;
    document.querySelectorAll('#star-rating .star').forEach((s) => {
      s.classList.toggle('active', parseInt(s.dataset.value) <= value);
    });
  });
});

document.querySelector('.modal-close').addEventListener('click', () => {
  document.getElementById('review-modal').classList.remove('active');
});

document.getElementById('review-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove('active');
  }
});

document.getElementById('review-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const restaurantId = document.getElementById('review-restaurant-id').value;
  const rating = document.getElementById('review-rating').value;

  if (!rating) {
    alert('評価を選択してください');
    return;
  }

  await api(`/api/restaurants/${restaurantId}/reviews`, {
    method: 'POST',
    body: JSON.stringify({
      rating: parseInt(rating),
      title: document.getElementById('review-title').value,
      comment: document.getElementById('review-comment').value,
      visit_date: document.getElementById('review-visit-date').value || null,
    }),
  });

  document.getElementById('review-modal').classList.remove('active');
  showDetail(restaurantId);
});

// ============ FAVORITES ============
async function loadFavorites() {
  const favorites = await api('/api/favorites');
  const container = document.getElementById('favorites-list');
  const emptyState = document.getElementById('no-favorites');

  if (favorites.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = '';
  } else {
    emptyState.style.display = 'none';
    renderRestaurantGrid('favorites-list', favorites);
  }
}

// ============ INVITATIONS ============
async function loadInvitations() {
  const invitations = await api('/api/invitations');
  const container = document.getElementById('invite-list');

  if (invitations.length === 0) {
    container.innerHTML = '<p class="text-muted">まだ招待コードを発行していません</p>';
    return;
  }

  container.innerHTML = invitations
    .map((inv) => {
      let statusClass = 'available';
      let statusText = '未使用';
      if (inv.used_by) {
        statusClass = 'used';
        statusText = `${inv.used_by_name} が使用`;
      } else if (new Date(inv.expires_at) < new Date()) {
        statusClass = 'expired';
        statusText = '期限切れ';
      }

      return `
        <div class="invite-card">
          <div>
            <div class="invite-code">${escapeHtml(inv.code)}</div>
            <div class="invite-meta">発行: ${formatDate(inv.created_at)} / 期限: ${formatDate(inv.expires_at)}</div>
          </div>
          <span class="invite-status ${statusClass}">${statusText}</span>
        </div>`;
    })
    .join('');
}

document.getElementById('create-invite-btn').addEventListener('click', async () => {
  await api('/api/invitations', { method: 'POST' });
  loadInvitations();
});

// ============ ADMIN ============
async function loadAdmin() {
  if (currentUser.role !== 'admin') return;

  const [users, invitations] = await Promise.all([
    api('/api/admin/users'),
    api('/api/admin/invitations'),
  ]);

  document.getElementById('admin-users').innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>表示名</th>
          <th>ユーザー名</th>
          <th>権限</th>
          <th>招待者</th>
          <th>登録日</th>
        </tr>
      </thead>
      <tbody>
        ${users
          .map(
            (u) => `
          <tr>
            <td>${escapeHtml(u.display_name)}</td>
            <td>${escapeHtml(u.username)}</td>
            <td><span class="role-badge ${u.role}">${u.role === 'admin' ? '管理者' : '会員'}</span></td>
            <td>${u.invited_by_name ? escapeHtml(u.invited_by_name) : '-'}</td>
            <td>${formatDate(u.created_at)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`;

  document.getElementById('admin-invitations').innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>コード</th>
          <th>発行者</th>
          <th>使用者</th>
          <th>期限</th>
          <th>状態</th>
        </tr>
      </thead>
      <tbody>
        ${invitations
          .map((inv) => {
            let status = '未使用';
            let statusClass = 'available';
            if (inv.used_by) {
              status = '使用済';
              statusClass = 'used';
            } else if (new Date(inv.expires_at) < new Date()) {
              status = '期限切れ';
              statusClass = 'expired';
            }
            return `
          <tr>
            <td><code>${escapeHtml(inv.code)}</code></td>
            <td>${escapeHtml(inv.created_by_name)}</td>
            <td>${inv.used_by_name ? escapeHtml(inv.used_by_name) : '-'}</td>
            <td>${formatDate(inv.expires_at)}</td>
            <td><span class="invite-status ${statusClass}">${status}</span></td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
}

// ============ HELPERS ============
function renderStars(rating) {
  const full = Math.round(Number(rating));
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += i <= full ? '&#9733;' : '&#9734;';
  }
  return stars;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============ INIT ============
checkAuth();
