document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Guard
    const session = await Auth.requireAuth();
    if (!session) return;
    const userId = session.user.id;

    // 2. Initialize Navigation & Sidebar
    await Nav.init('notifications');

    // 3. Elements
    const notifContainer = document.getElementById('notif-container');
    const notifLoading = document.getElementById('notif-loading');
    const notifEmpty = document.getElementById('notif-empty');
    const tabsContainer = document.getElementById('notif-tabs');
    const sidebarSearch = document.getElementById('sidebar-search');

    // Update modal trigger avatar
    const modalAvatar = document.getElementById('modal-avatar');
    if (modalAvatar && Nav.currentUser) {
        modalAvatar.src = Nav.currentUser.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=User';
    }

    let activeFilter = 'all';

    // 4. Load Notifications
    async function loadNotifications() {
        if (notifLoading) notifLoading.classList.remove('hidden');
        if (notifEmpty) notifEmpty.classList.add('hidden');
        if (notifContainer) notifContainer.innerHTML = '';

        try {
            // Build query
            let query = window.db
                .from('notifications')
                .select('*, actor:actor_id(id, username, display_name, avatar_url), pot:pot_id(content)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            // Apply filter
            if (activeFilter === 'likes') {
                query = query.in('type', ['like', 'repost']);
            } else if (activeFilter === 'follows') {
                query = query.eq('type', 'follow');
            } else if (activeFilter === 'replies') {
                query = query.eq('type', 'reply');
            }

            const { data: notifications, error } = await query;
            
            if (error) throw error;

            if (notifLoading) notifLoading.classList.add('hidden');

            if (!notifications || notifications.length === 0) {
                if (notifEmpty) notifEmpty.classList.remove('hidden');
                return;
            }

            // Split into New (unread) and Earlier (read)
            const unread = notifications.filter(n => !n.read);
            const read = notifications.filter(n => n.read);

            let html = '';

            if (unread.length > 0) {
                html += `<div class="px-6 py-3 bg-surface-container/30 text-xs font-bold text-primary tracking-wider uppercase">New</div>`;
                unread.forEach(n => {
                    html += renderNotifItem(n);
                });
            }

            if (read.length > 0) {
                html += `<div class="px-6 py-3 bg-surface-container/30 text-xs font-bold text-on-surface-variant/80 tracking-wider uppercase">Earlier</div>`;
                read.forEach(n => {
                    html += renderNotifItem(n);
                });
            }

            if (notifContainer) notifContainer.innerHTML = html;

            // 5. Mark all unread notifications as read
            if (unread.length > 0) {
                await window.db
                    .from('notifications')
                    .update({ read: true })
                    .eq('user_id', userId)
                    .eq('read', false);
                
                // Clear the unread count in Nav header state
                Nav.unreadCount = 0;
                Nav.renderSidebar();
                Nav.renderBottomNav();
            }

        } catch (error) {
            console.error('Error fetching notifications:', error);
            if (notifLoading) notifLoading.classList.add('hidden');
            showToast('Failed to load notifications.');
        }
    }

    // 6. Helper: Render Notification Item HTML
    function renderNotifItem(n) {
        const actor = n.actor || { display_name: 'Someone', username: 'someone', avatar_url: '' };
        const avatarUrl = actor.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${actor.display_name}`;
        
        let icon = 'notifications';
        let badgeColor = 'bg-surface-container-high text-on-surface-variant';
        let actionText = '';
        let preview = '';

        if (n.type === 'like') {
            icon = 'favorite';
            badgeColor = 'bg-error-container text-error';
            actionText = 'liked your pot';
            if (n.pot?.content) {
                preview = `<div class="text-xs text-on-surface-variant mt-1 italic p-2 bg-surface-container-low/40 rounded-lg truncate">"${escapeHtml(n.pot.content)}"</div>`;
            }
        } else if (n.type === 'repost') {
            icon = 'repeat';
            badgeColor = 'bg-secondary-container text-on-secondary-container';
            actionText = 'reposted your pot';
            if (n.pot?.content) {
                preview = `<div class="text-xs text-on-surface-variant mt-1 italic p-2 bg-surface-container-low/40 rounded-lg truncate">"${escapeHtml(n.pot.content)}"</div>`;
            }
        } else if (n.type === 'follow') {
            icon = 'person_add';
            badgeColor = 'bg-primary-container text-on-primary-container';
            actionText = 'started growing with you';
        } else if (n.type === 'reply') {
            icon = 'chat_bubble';
            badgeColor = 'bg-surface-container-high text-on-surface-variant';
            actionText = 'replied to your pot';
            if (n.pot?.content) {
                preview = `<div class="text-xs text-on-surface-variant mt-1 italic p-2 bg-surface-container-low/40 rounded-lg truncate">"${escapeHtml(n.pot.content)}"</div>`;
            }
        }

        const unreadClass = !n.read ? 'unread bg-surface-container-low' : '';

        return `
            <div class="notification-item ${unreadClass} p-4 flex gap-4 hover:bg-surface-container-low/30 transition-all cursor-pointer" onclick="window.location.href='profile.html?id=${actor.id}'">
                <div class="relative shrink-0">
                    <img class="w-10 h-10 rounded-full object-cover border border-surface-container" src="${avatarUrl}" alt="${actor.display_name}" />
                    <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border border-surface-bright shadow-sm ${badgeColor}">
                        <span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1;">${icon}</span>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <p class="text-sm text-on-surface leading-normal">
                            <span class="font-bold hover:underline">${actor.display_name}</span>
                            <span class="text-on-surface-variant">@${actor.username}</span>
                            <span>${actionText}</span>
                        </p>
                        <span class="text-xs text-on-surface-variant shrink-0 font-medium">${timeAgo(n.created_at)}</span>
                    </div>
                    ${preview}
                </div>
            </div>
        `;
    }

    // 7. Filter Click Event Handler
    if (tabsContainer) {
        tabsContainer.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            // Remove active style from all
            const buttons = tabsContainer.querySelectorAll('button');
            buttons.forEach(b => {
                b.className = 'px-4 py-2 bg-surface-container-high text-on-surface-variant rounded-full hover:bg-surface-container-highest transition-all';
            });

            // Set active style
            btn.className = 'px-4 py-2 bg-primary text-on-primary rounded-full transition-all';
            activeFilter = btn.dataset.filter;

            await loadNotifications();
        });
    }

    // 8. Sidebar Trending Roots
    async function loadTrendingRoots() {
        const trendingList = document.getElementById('trending-roots-list');
        if (!trendingList) return;

        try {
            const { data: pots } = await window.db
                .from('pots')
                .select('content')
                .order('created_at', { ascending: false })
                .limit(20);

            const hashtagCounts = {};
            (pots || []).forEach(p => {
                const tags = p.content.match(/#[a-zA-Z0-9_]+/g) || [];
                tags.forEach(t => {
                    hashtagCounts[t] = (hashtagCounts[t] || 0) + 1;
                });
            });

            let trending = Object.keys(hashtagCounts).map(tag => ({
                tag,
                count: hashtagCounts[tag]
            })).sort((a, b) => b.count - a.count).slice(0, 3);

            const fallbacks = [
                { tag: '#MonsteraMonday', count: 125, category: 'Botany' },
                { tag: '#UrbanJungle', count: 82, category: 'Gardening' },
                { tag: '#WateringSchedule', count: 51, category: 'Care Tips' }
            ];

            while (trending.length < 3 && fallbacks.length > 0) {
                const next = fallbacks.shift();
                if (!trending.find(t => t.tag === next.tag)) {
                    trending.push(next);
                }
            }

            trendingList.innerHTML = trending.map(item => {
                const countStr = item.count >= 100 ? `${(item.count / 10).toFixed(1)}k` : `${item.count}`;
                const category = item.category || 'Trending';
                return `
                    <a class="group block" href="explore.html?q=${encodeURIComponent(item.tag)}">
                        <div class="text-xs text-on-surface-variant mb-1">Trending in ${category}</div>
                        <div class="font-bold text-on-surface group-hover:text-primary transition-colors">${item.tag}</div>
                        <div class="text-xs text-on-surface-variant mt-1">${countStr} pots</div>
                    </a>
                `;
            }).join('');
        } catch (e) {
            console.error(e);
        }
    }

    // Sidebar search navigation
    if (sidebarSearch) {
        sidebarSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const val = sidebarSearch.value.trim();
                if (val) {
                    window.location.href = `explore.html?q=${encodeURIComponent(val)}`;
                }
            }
        });
    }

    // 9. Initial Load
    await loadNotifications();
    await loadTrendingRoots();
});
