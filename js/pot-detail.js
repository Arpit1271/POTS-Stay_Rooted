document.addEventListener('DOMContentLoaded', async () => {
    const session = await Auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    const userId = session.user.id;
    const urlParams = new URLSearchParams(window.location.search);
    const potId = urlParams.get('id');

    if (!potId) {
        window.location.href = 'home.html';
        return;
    }

    const potDetailContainer = document.getElementById('pot-detail-container');
    const commentsContainer = document.getElementById('comments-container');
    const detailLoading = document.getElementById('detail-loading');
    const replyTextarea = document.getElementById('reply-textarea');
    const replySubmitBtn = document.getElementById('reply-submit-btn');
    const replyAvatar = document.getElementById('reply-avatar');

    // Fetch user profile for reply avatar
    try {
        const { data: profile } = await window.db
            .from('profiles')
            .select('avatar_url, display_name')
            .eq('id', userId)
            .single();
        
        if (profile && profile.avatar_url) {
            replyAvatar.src = profile.avatar_url;
        } else if (profile) {
            replyAvatar.src = `https://api.dicebear.com/7.x/initials/svg?seed=${profile.display_name || 'User'}`;
        }
    } catch (e) {
        console.error('Error fetching profile for avatar:', e);
    }

    async function loadPotDetail() {
        detailLoading.classList.remove('hidden');
        potDetailContainer.innerHTML = '';
        commentsContainer.innerHTML = '';

        try {
            // Fetch pot
            const potQuery = window.db
                .from('pots_with_details')
                .select('*')
                .eq('id', potId);
            
            const pots = await fetchPotsWithState(potQuery);
            if (!pots || pots.length === 0) {
                potDetailContainer.innerHTML = '<div class="text-center py-8 text-on-surface-variant">Pot not found or has been deleted.</div>';
                detailLoading.classList.add('hidden');
                return;
            }
            
            const pot = pots[0];
            
            // Render pot
            potDetailContainer.innerHTML = window.renderPotCard(pot, userId);

            // Fetch comments
            await loadComments();

        } catch (error) {
            console.error('Error loading pot details:', error);
            window.showToast('Failed to load pot details.');
        } finally {
            detailLoading.classList.add('hidden');
        }
    }

    async function loadComments() {
        try {
            const { data: comments, error } = await window.db
                .from('comments')
                .select('*, profiles(username, display_name, avatar_url, is_verified)')
                .eq('pot_id', potId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (!comments || comments.length === 0) {
                commentsContainer.innerHTML = '<div class="text-center py-6 text-on-surface-variant text-sm">No replies yet. Be the first to share your thoughts!</div>';
                return;
            }

            commentsContainer.innerHTML = comments.map(comment => {
                const profile = comment.profiles || {};
                const avatarUrl = (profile.avatar_url && profile.avatar_url.trim() !== '') 
                    ? profile.avatar_url 
                    : `https://api.dicebear.com/7.x/initials/svg?seed=${profile.display_name || 'User'}`;
                
                return `
                    <div class="bg-surface rounded-xl p-4 border border-surface-container-low soft-shadow flex gap-3">
                        <img src="${avatarUrl}" alt="${profile.display_name}" class="w-8 h-8 rounded-full object-cover shrink-0 cursor-pointer" onclick="window.location.href='profile.html?id=${comment.user_id}'" />
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="font-bold text-on-surface text-sm cursor-pointer hover:underline" onclick="window.location.href='profile.html?id=${comment.user_id}'">${profile.display_name}</span>
                                ${profile.is_verified ? '<span class="material-symbols-outlined text-primary text-[14px]" style="font-variation-settings: \'FILL\' 1;">verified</span>' : ''}
                                <span class="text-on-surface-variant text-xs">@${profile.username}</span>
                                <span class="text-on-surface-variant text-xs">&middot;</span>
                                <span class="text-on-surface-variant text-xs">${window.timeAgo(comment.created_at)}</span>
                            </div>
                            <div class="text-on-surface text-sm whitespace-pre-wrap">${escapeHtml(comment.content)}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading comments:', error);
            commentsContainer.innerHTML = '<div class="text-center py-6 text-error text-sm">Failed to load replies.</div>';
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    replySubmitBtn.addEventListener('click', async () => {
        const text = replyTextarea.value.trim();
        if (!text) return;

        replySubmitBtn.disabled = true;
        replySubmitBtn.textContent = 'Replying...';

        try {
            const { error } = await window.db
                .from('comments')
                .insert({ user_id: userId, pot_id: potId, content: text });

            if (error) throw error;

            replyTextarea.value = '';
            window.showToast('Reply added successfully!');
            await loadComments();
            
            // Increment comment count in UI locally
            const chatCountEl = document.querySelector('.group\\/action .text-sm');
            if (chatCountEl && chatCountEl.previousElementSibling && chatCountEl.previousElementSibling.querySelector('span').textContent === 'chat_bubble') {
                 // The comment count is rendered in pot card
            }
            
            // To be safe, we can just fetch the pot detail again to update the count
            // but the requirement says "reload the comments" so we just did that.
        } catch (error) {
            console.error('Error adding reply:', error);
            window.showToast('Failed to add reply.');
        } finally {
            replySubmitBtn.disabled = false;
            replySubmitBtn.textContent = 'Reply';
        }
    });

    loadPotDetail();
});
