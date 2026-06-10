// ============================================
// POTS — Shared Navigation Component
// Injects sidebar (desktop) + bottom nav (mobile)
// ============================================

const Nav = {
    currentPage: '',
    currentUser: null,
    unreadCount: 0,

    async init(pageName) {
        this.currentPage = pageName;
        this.currentUser = await Auth.getCurrentProfile();
        await this.loadUnreadCount();
        this.renderSidebar();
        this.renderBottomNav();
        this.renderMobileTopBar();
        window.initNewPotModal();
    },

    async loadUnreadCount() {
        const session = await Auth.getSession();
        if (!session) return;

        const { count } = await window.db
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id)
            .eq('read', false);

        this.unreadCount = count || 0;
    },

    getNavItems() {
        return [
            { name: 'Home', icon: 'home', href: 'home.html', page: 'home' },
            { name: 'Explore', icon: 'search', href: 'explore.html', page: 'explore' },
            { name: 'Notifications', icon: 'notifications', href: 'notifications.html', page: 'notifications', badge: true },
            { name: 'Profile', icon: 'person', href: 'profile.html', page: 'profile' },
            { name: 'Following', icon: 'groups', href: 'following.html', page: 'following' }
        ];
    },

    renderSidebar() {
        const nav = document.getElementById('sidebar-nav');
        if (!nav) return;

        const items = this.getNavItems();
        const user = this.currentUser;
        const avatarUrl = user?.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=User';

        nav.innerHTML = `
            <div class="flex items-center gap-4 px-4">
                <div class="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-headline font-bold text-xl shrink-0">
                    <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">eco</span>
                </div>
                <div>
                    <h1 class="text-2xl font-headline font-bold text-primary leading-none">POTS</h1>
                    <p class="text-xs text-on-surface-variant mt-1 font-medium tracking-wide uppercase">Stay Rooted</p>
                </div>
            </div>

            <div class="flex-1 flex flex-col gap-2 mt-6">
                ${items.map(item => {
                    const isActive = item.page === this.currentPage;
                    const activeClasses = isActive
                        ? 'bg-primary-container/30 text-primary font-bold border-l-4 border-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high';

                    return `
                        <a class="flex items-center gap-4 px-4 py-3 rounded-xl ${activeClasses} transition-colors group" href="${item.href}">
                            <div class="relative">
                                <span class="material-symbols-outlined text-[28px] group-hover:scale-110 transition-transform" ${isActive ? 'style="font-variation-settings: \'FILL\' 1;"' : ''}>${item.icon}</span>
                                ${item.badge && this.unreadCount > 0 ? `<span class="absolute -top-1 -right-1 w-5 h-5 bg-tertiary text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-surface">${this.unreadCount > 9 ? '9+' : this.unreadCount}</span>` : ''}
                            </div>
                            <span class="font-body text-body-md ${isActive ? 'font-bold' : 'font-medium'}">${item.name}</span>
                        </a>
                    `;
                }).join('')}
            </div>

            <div class="mt-auto pt-6 border-t border-surface-container">
                <button onclick="document.getElementById('new-pot-modal')?.classList.add('active'); document.getElementById('new-pot-modal') || window.location.href='home.html'" class="w-full bg-primary text-on-primary font-bold py-3.5 px-6 rounded-xl shadow-sm hover:bg-primary/90 hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined">add</span>
                    New Pot
                </button>
                <div class="flex items-center gap-3 mt-6 px-2 cursor-pointer group" onclick="window.location.href='profile.html'">
                    <img alt="User avatar" class="w-10 h-10 rounded-full object-cover border-2 border-surface-container-high" src="${avatarUrl}" />
                    <div class="flex-1 overflow-hidden">
                        <p class="font-medium text-sm text-on-surface truncate group-hover:text-primary transition-colors">${user?.display_name || 'User'}</p>
                        <p class="text-xs text-on-surface-variant truncate">@${user?.username || 'user'}</p>
                    </div>
                    <div class="relative">
                        <span class="material-symbols-outlined text-on-surface-variant text-sm cursor-pointer hover:text-primary" onclick="event.stopPropagation(); document.getElementById('user-menu').classList.toggle('hidden')">more_horiz</span>
                        <div id="user-menu" class="hidden absolute bottom-full right-0 mb-2 bg-surface-bright rounded-xl shadow-lg border border-surface-container-low py-2 w-48 z-50">
                            <a href="profile.html" class="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-high transition-colors">
                                <span class="material-symbols-outlined text-[18px]">person</span>
                                View Profile
                            </a>
                            <button onclick="Auth.signOut()" class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error-container/30 transition-colors">
                                <span class="material-symbols-outlined text-[18px]">logout</span>
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Close user menu on outside click
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('user-menu');
            if (menu && !e.target.closest('#user-menu') && !e.target.closest('[onclick*="user-menu"]')) {
                menu.classList.add('hidden');
            }
        });
    },

    renderBottomNav() {
        const nav = document.getElementById('bottom-nav');
        if (!nav) return;

        const mobileItems = [
            { name: 'Home', icon: 'home', href: 'home.html', page: 'home' },
            { name: 'Explore', icon: 'search', href: 'explore.html', page: 'explore' },
            { name: 'Alerts', icon: 'notifications', href: 'notifications.html', page: 'notifications', badge: true },
            { name: 'Profile', icon: 'person', href: 'profile.html', page: 'profile' }
        ];

        nav.innerHTML = mobileItems.map(item => {
            const isActive = item.page === this.currentPage;
            const activeClasses = isActive
                ? 'bg-primary-container text-on-primary-container'
                : 'text-on-surface-variant hover:bg-primary-container/50';

            return `
                <a class="flex flex-col items-center justify-center ${activeClasses} p-2 rounded-xl transition-all active:scale-95 w-16" href="${item.href}">
                    <div class="relative">
                        <span class="material-symbols-outlined text-[24px]" ${isActive ? 'style="font-variation-settings: \'FILL\' 1;"' : ''}>${item.icon}</span>
                        ${item.badge && this.unreadCount > 0 ? `<span class="absolute -top-1 -right-1 w-4 h-4 bg-tertiary text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-surface-container">${this.unreadCount > 9 ? '9+' : this.unreadCount}</span>` : ''}
                    </div>
                    <span class="font-label text-[10px] mt-1 ${isActive ? 'font-bold' : 'font-medium'}">${item.name}</span>
                </a>
            `;
        }).join('');
    },

    renderMobileTopBar() {
        const topBar = document.getElementById('mobile-top-bar');
        if (!topBar) return;

        topBar.innerHTML = `
            <div class="text-xl font-headline font-bold text-primary">POTS</div>
            <button onclick="window.location.href='home.html'" class="bg-primary text-on-primary font-bold py-2 px-4 rounded-xl hover:opacity-90 transition-opacity text-sm">New Pot</button>
        `;
    }
};

// Utility: Show toast notification
function showToast(message, duration = 3000) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

// Utility: Format relative time
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Utility: Render a post card HTML
function renderPotCard(pot, currentUserId, options = {}) {
    const isLiked = pot.user_liked;
    const isReposted = pot.user_reposted;
    const isBookmarked = pot.user_bookmarked;
    const avatarUrl = (pot.avatar_url && pot.avatar_url.trim() !== '') ? pot.avatar_url : `https://api.dicebear.com/7.x/initials/svg?seed=${pot.display_name || 'U'}`;

    return `
        <article onclick="window.location.href='pot-detail.html?id=${pot.id}'" class="${options.cardStyle === 'flat' ? 'p-6 hover:bg-surface-container-low/50 transition-colors cursor-pointer' : 'bg-surface-bright rounded-xl p-6 soft-shadow border border-surface-container-low cursor-pointer hover:bg-surface-container-low/10 transition-colors'}" data-pot-id="${pot.id}">
            <div class="flex gap-4">
                <img alt="${pot.display_name}" class="w-12 h-12 rounded-full object-cover border-2 border-surface-container shrink-0 cursor-pointer" src="${avatarUrl}" onclick="event.stopPropagation(); window.location.href='profile.html?id=${pot.user_id}'" />
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center gap-2 truncate">
                            <span class="font-bold text-on-surface hover:underline cursor-pointer" onclick="event.stopPropagation(); window.location.href='profile.html?id=${pot.user_id}'">${pot.display_name || pot.username}</span>
                            ${pot.is_verified ? '<span class="material-symbols-outlined text-[16px] text-tertiary" style="font-variation-settings: \'FILL\' 1;">verified</span>' : ''}
                            <span class="text-on-surface-variant text-sm truncate">@${pot.username}</span>
                            <span class="text-on-surface-variant text-sm shrink-0">· ${timeAgo(pot.created_at)}</span>
                        </div>
                        <div class="relative">
                            <button class="text-on-surface-variant hover:text-primary transition-colors" onclick="event.stopPropagation(); this.nextElementSibling.classList.toggle('hidden')">
                                <span class="material-symbols-outlined">more_horiz</span>
                            </button>
                            <div class="hidden absolute right-0 mt-2 w-32 bg-surface-bright rounded-xl shadow-lg border border-surface-container-low py-1 z-10" onclick="event.stopPropagation()">
                                ${pot.user_id === currentUserId ? `
                                <button onclick="window.deletePot('${pot.id}', this)" class="w-full text-left px-4 py-2 text-sm text-error hover:bg-error-container/30 transition-colors flex items-center gap-2">
                                    <span class="material-symbols-outlined text-[18px]">delete</span>
                                    Delete
                                </button>
                                ` : ''}
                                <button onclick="showToast('Reported')" class="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-2">
                                    <span class="material-symbols-outlined text-[18px]">flag</span>
                                    Report
                                </button>
                            </div>
                        </div>
                    </div>
                    <p class="text-on-surface leading-relaxed text-[15px] mb-3">${escapeHtml(pot.content)}</p>
                    ${pot.image_url ? `
                        <div class="rounded-xl overflow-hidden mb-3 border border-surface-container">
                            <img alt="Post image" class="w-full h-auto object-cover max-h-[400px]" src="${pot.image_url}" loading="lazy" />
                        </div>
                    ` : ''}
                    <div class="flex items-center justify-between text-on-surface-variant pr-8 max-w-md">
                        <button class="flex items-center gap-2 hover:text-primary transition-colors group/action" onclick="event.stopPropagation()">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center group-hover/action:bg-primary/10">
                                <span class="material-symbols-outlined text-[20px]">chat_bubble</span>
                            </div>
                            <span class="text-sm">${pot.comments_count || 0}</span>
                        </button>
                        <button class="flex items-center gap-2 hover:text-secondary transition-colors group/action ${isReposted ? 'text-secondary' : ''}" onclick="event.stopPropagation(); toggleRepost('${pot.id}', this)">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center group-hover/action:bg-secondary/10">
                                <span class="material-symbols-outlined text-[20px]">repeat</span>
                            </div>
                            <span class="text-sm repost-count">${pot.reposts_count || 0}</span>
                        </button>
                        <button class="flex items-center gap-2 hover:text-error transition-colors group/action ${isLiked ? 'text-error' : ''}" onclick="event.stopPropagation(); toggleLike('${pot.id}', this)">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center group-hover/action:bg-error/10">
                                <span class="material-symbols-outlined text-[20px]" ${isLiked ? 'style="font-variation-settings: \'FILL\' 1;"' : ''}>favorite</span>
                            </div>
                            <span class="text-sm like-count">${pot.likes_count || 0}</span>
                        </button>
                        <button class="flex items-center gap-2 hover:text-primary transition-colors group/action ${isBookmarked ? 'text-primary' : ''}" onclick="event.stopPropagation(); toggleBookmark('${pot.id}', this)">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center group-hover/action:bg-primary/10">
                                <span class="material-symbols-outlined text-[20px]" ${isBookmarked ? 'style="font-variation-settings: \'FILL\' 1;"' : ''}>${options.showShare ? 'share' : 'bookmark'}</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </article>
    `;
}

// Utility: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- Interaction Handlers ---

async function toggleLike(potId, btn) {
    const session = await Auth.getSession();
    if (!session) return;

    const userId = session.user.id;
    const isLiked = btn.classList.contains('text-error');
    const countEl = btn.querySelector('.like-count');
    const iconEl = btn.querySelector('.material-symbols-outlined');
    let count = parseInt(countEl.textContent) || 0;

    if (isLiked) {
        btn.classList.remove('text-error');
        iconEl.style.fontVariationSettings = '';
        countEl.textContent = Math.max(0, count - 1);
        try {
            const { error } = await window.db.from('likes').delete().eq('user_id', userId).eq('pot_id', potId);
            if (error) throw error;
        } catch (e) {
            btn.classList.add('text-error');
            iconEl.style.fontVariationSettings = "'FILL' 1";
            countEl.textContent = count;
            showToast('Action failed');
        }
    } else {
        btn.classList.add('text-error');
        iconEl.style.fontVariationSettings = "'FILL' 1";
        countEl.textContent = count + 1;
        try {
            const { error } = await window.db.from('likes').insert({ user_id: userId, pot_id: potId });
            if (error) throw error;
        } catch (e) {
            btn.classList.remove('text-error');
            iconEl.style.fontVariationSettings = '';
            countEl.textContent = count;
            showToast('Action failed');
        }
    }
}

async function toggleRepost(potId, btn) {
    const session = await Auth.getSession();
    if (!session) return;

    const userId = session.user.id;
    const isReposted = btn.classList.contains('text-secondary');
    const countEl = btn.querySelector('.repost-count');
    let count = parseInt(countEl.textContent) || 0;

    if (isReposted) {
        btn.classList.remove('text-secondary');
        countEl.textContent = Math.max(0, count - 1);
        try {
            const { error } = await window.db.from('reposts').delete().eq('user_id', userId).eq('pot_id', potId);
            if (error) throw error;
        } catch (e) {
            btn.classList.add('text-secondary');
            countEl.textContent = count;
            showToast('Action failed');
        }
    } else {
        btn.classList.add('text-secondary');
        countEl.textContent = count + 1;
        try {
            const { error } = await window.db.from('reposts').insert({ user_id: userId, pot_id: potId });
            if (error) throw error;
        } catch (e) {
            btn.classList.remove('text-secondary');
            countEl.textContent = count;
            showToast('Action failed');
        }
    }
}

async function toggleBookmark(potId, btn) {
    const session = await Auth.getSession();
    if (!session) return;

    const userId = session.user.id;
    const isBookmarked = btn.classList.contains('text-primary');
    const iconEl = btn.querySelector('.material-symbols-outlined');

    if (isBookmarked) {
        btn.classList.remove('text-primary');
        iconEl.style.fontVariationSettings = '';
        try {
            const { error } = await window.db.from('bookmarks').delete().eq('user_id', userId).eq('pot_id', potId);
            if (error) throw error;
            showToast('Removed from bookmarks');
        } catch (e) {
            btn.classList.add('text-primary');
            iconEl.style.fontVariationSettings = "'FILL' 1";
            showToast('Action failed');
        }
    } else {
        btn.classList.add('text-primary');
        iconEl.style.fontVariationSettings = "'FILL' 1";
        try {
            const { error } = await window.db.from('bookmarks').insert({ user_id: userId, pot_id: potId });
            if (error) throw error;
            showToast('Added to bookmarks');
        } catch (e) {
            btn.classList.remove('text-primary');
            iconEl.style.fontVariationSettings = '';
            showToast('Action failed');
        }
    }
}

async function toggleFollow(userId, btn) {
    const session = await Auth.getSession();
    if (!session) return;

    const followerId = session.user.id;
    const isFollowing = btn.textContent.trim() === 'Following';

    if (isFollowing) {
        btn.textContent = 'Follow';
        btn.className = btn.className.replace('bg-surface-container-high text-on-surface', 'bg-primary text-on-primary');
        try {
            const { error } = await window.db.from('follows').delete().eq('follower_id', followerId).eq('following_id', userId);
            if (error) throw error;
        } catch (e) {
            btn.textContent = 'Following';
            btn.className = btn.className.replace('bg-primary text-on-primary', 'bg-surface-container-high text-on-surface');
            showToast('Action failed');
        }
    } else {
        btn.textContent = 'Following';
        btn.className = btn.className.replace('bg-primary text-on-primary', 'bg-surface-container-high text-on-surface');
        try {
            const { error } = await window.db.from('follows').insert({ follower_id: followerId, following_id: userId });
            if (error) throw error;
        } catch (e) {
            btn.textContent = 'Follow';
            btn.className = btn.className.replace('bg-surface-container-high text-on-surface', 'bg-primary text-on-primary');
            showToast('Action failed');
        }
    }
}

// Fetch pots with user interaction state
async function fetchPotsWithState(query) {
    const session = await Auth.getSession();
    const userId = session?.user?.id;

    const { data: pots, error } = await query;
    if (error || !pots) return [];

    if (!userId) return pots.map(p => ({ ...p, user_liked: false, user_reposted: false, user_bookmarked: false }));

    const potIds = pots.map(p => p.id);

    const [likesRes, repostsRes, bookmarksRes] = await Promise.all([
        window.db.from('likes').select('pot_id').eq('user_id', userId).in('pot_id', potIds),
        window.db.from('reposts').select('pot_id').eq('user_id', userId).in('pot_id', potIds),
        window.db.from('bookmarks').select('pot_id').eq('user_id', userId).in('pot_id', potIds)
    ]);

    const likedIds = new Set((likesRes.data || []).map(l => l.pot_id));
    const repostedIds = new Set((repostsRes.data || []).map(r => r.pot_id));
    const bookmarkedIds = new Set((bookmarksRes.data || []).map(b => b.pot_id));

    return pots.map(p => ({
        ...p,
        user_liked: likedIds.has(p.id),
        user_reposted: repostedIds.has(p.id),
        user_bookmarked: bookmarkedIds.has(p.id)
    }));
}

window.Nav = Nav;
window.showToast = showToast;
window.timeAgo = timeAgo;
window.renderPotCard = renderPotCard;
window.toggleLike = toggleLike;
window.toggleRepost = toggleRepost;
window.toggleBookmark = toggleBookmark;
window.toggleFollow = toggleFollow;
window.fetchPotsWithState = fetchPotsWithState;

window.deletePot = async function(potId, btn) {
    if (!confirm('Delete this pot?')) return;
    try {
        const { error } = await window.db.from('pots').delete().eq('id', potId);
        if (error) throw error;
        const article = btn.closest('article');
        if (article) article.remove();
        showToast('Pot deleted');
    } catch (e) {
        console.error('Failed to delete pot', e);
        showToast('Failed to delete pot');
    }
};

window.validateImageFile = function(file, maxSizeMB = 5) {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error('Only JPEG, PNG, GIF, and WebP images are allowed.');
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
        throw new Error(`Image must be under ${maxSizeMB}MB.`);
    }
    return true;
};

window.initNewPotModal = function() {
    const modalTextarea = document.getElementById('modal-textarea');
    const modalImageBtn = document.getElementById('modal-image-btn');
    const modalImageInput = document.getElementById('modal-image-input');
    const modalImagePreviewContainer = document.getElementById('modal-image-preview-container');
    const modalImagePreview = document.getElementById('modal-image-preview');
    const modalImageRemove = document.getElementById('modal-image-remove');
    const modalPlantBtn = document.getElementById('modal-plant-btn');
    const newPotModal = document.getElementById('new-pot-modal');

    if (!modalPlantBtn) return; // Modal not on this page

    // Only attach once
    if (modalPlantBtn.dataset.initialized) return;
    modalPlantBtn.dataset.initialized = 'true';

    // File Preview
    if (modalImageBtn && modalImageInput) {
        modalImageBtn.addEventListener('click', () => modalImageInput.click());
        modalImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    modalImagePreview.src = event.target.result;
                    modalImagePreviewContainer.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        });
    }
    
    if (modalImageRemove) {
        modalImageRemove.addEventListener('click', () => {
            modalImageInput.value = '';
            modalImagePreviewContainer.classList.add('hidden');
            modalImagePreview.src = '';
        });
    }

    // Submit
    modalPlantBtn.addEventListener('click', async () => {
        const text = modalTextarea.value.trim();
        const file = modalImageInput.files[0];

        if (!text && !file) {
            showToast('Please type a thought or select an image.');
            return;
        }

        modalPlantBtn.disabled = true;
        modalPlantBtn.textContent = 'Planting...';

        try {
            const session = await Auth.getSession();
            if (!session) return;
            const userId = session.user.id;

            let imageUrl = null;

            if (file) {
                try {
                    window.validateImageFile(file);
                } catch (validationError) {
                    showToast(validationError.message);
                    modalPlantBtn.disabled = false;
                    modalPlantBtn.textContent = 'Plant';
                    return;
                }
                const fileExt = file.name.split('.').pop();
                const fileName = `${userId}/${Date.now()}.${fileExt}`;
                
                const { error: uploadError } = await window.db.storage
                    .from('pot-images')
                    .upload(fileName, file, { cacheControl: '3600', upsert: true });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = window.db.storage
                    .from('pot-images')
                    .getPublicUrl(fileName);
                
                imageUrl = publicUrl;
            }

            const { error: insertError } = await window.db
                .from('pots')
                .insert({ user_id: userId, content: text, image_url: imageUrl });

            if (insertError) throw insertError;

            modalTextarea.value = '';
            modalImageInput.value = '';
            if (modalImagePreviewContainer) modalImagePreviewContainer.classList.add('hidden');
            
            showToast('Post planted successfully!');

            if (newPotModal) {
                newPotModal.classList.remove('active');
            }

            window.location.reload();

        } catch (error) {
            console.error('Error posting pot:', error);
            showToast(error.message || 'Failed to plant pot. Please try again.');
        } finally {
            modalPlantBtn.disabled = false;
            modalPlantBtn.textContent = 'Plant';
        }
    });
};
