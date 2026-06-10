document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Guard
    const session = await Auth.requireAuth();
    if (!session) return;
    const userId = session.user.id;

    // 2. Initialize Navigation & Sidebar
    await Nav.init('following');

    // 3. Elements
    const feedContainer = document.getElementById('feed-container');
    const feedLoading = document.getElementById('feed-loading');
    const feedEmpty = document.getElementById('feed-empty');

    // Compose Elements (Modal)
    const modalAvatar = document.getElementById('modal-avatar');
    const modalTextarea = document.getElementById('modal-textarea');
    const modalImageBtn = document.getElementById('modal-image-btn');
    const modalImageInput = document.getElementById('modal-image-input');
    const modalImagePreviewContainer = document.getElementById('modal-image-preview-container');
    const modalImagePreview = document.getElementById('modal-image-preview');
    const modalImageRemove = document.getElementById('modal-image-remove');
    const modalPlantBtn = document.getElementById('modal-plant-btn');
    const newPotModal = document.getElementById('new-pot-modal');

    // Sidebar search
    const sidebarSearch = document.getElementById('sidebar-search');

    // Update avatars
    const userProfile = Nav.currentUser;
    if (userProfile && modalAvatar) {
        modalAvatar.src = userProfile.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=User';
    }

    // 4. Modal Image Upload Preview Helpers
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

    let currentOffset = 0;
    const PAGE_SIZE = 15;
    let isEndOfFeed = false;

    // 5. Load Feed Pots for Followed Users
    async function loadFollowingFeed(isLoadMore = false) {
        if (!isLoadMore) {
            currentOffset = 0;
            isEndOfFeed = false;
            if (feedLoading) feedLoading.classList.remove('hidden');
            if (feedEmpty) feedEmpty.classList.add('hidden');
            if (feedContainer) feedContainer.innerHTML = '';
            const existingBtn = document.getElementById('load-more-btn-following');
            if (existingBtn) existingBtn.remove();
        } else {
            const btn = document.getElementById('load-more-btn-following');
            if (btn) btn.textContent = 'Loading...';
        }

        try {
            // Get profiles we follow
            const { data: follows, error: followsError } = await window.db
                .from('follows')
                .select('following_id')
                .eq('follower_id', userId);

            if (followsError) throw followsError;

            const followingIds = (follows || []).map(f => f.following_id);

            if (followingIds.length === 0) {
                if (!isLoadMore && feedLoading) feedLoading.classList.add('hidden');
                if (!isLoadMore && feedEmpty) feedEmpty.classList.remove('hidden');
                isEndOfFeed = true;
                const btn = document.getElementById('load-more-btn-following');
                if (btn) btn.remove();
                return;
            }

            // Fetch pots from followed growers
            const query = window.db
                .from('pots_with_details')
                .select('*')
                .in('user_id', followingIds)
                .order('created_at', { ascending: false })
                .range(currentOffset, currentOffset + PAGE_SIZE - 1);

            const pots = await fetchPotsWithState(query);

            if (!isLoadMore && feedLoading) feedLoading.classList.add('hidden');

            if (!pots || pots.length === 0) {
                if (!isLoadMore && feedEmpty) feedEmpty.classList.remove('hidden');
                isEndOfFeed = true;
                const btn = document.getElementById('load-more-btn-following');
                if (btn) btn.remove();
                return;
            }

            pots.forEach(pot => {
                // Render flat style card
                const postHtml = renderPotCard(pot, userId, { cardStyle: 'flat' });
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = postHtml.trim();
                const cardElement = tempDiv.firstChild;
                feedContainer.appendChild(cardElement);
            });

            if (pots.length < PAGE_SIZE) {
                isEndOfFeed = true;
            }

            let loadMoreBtn = document.getElementById('load-more-btn-following');
            if (isEndOfFeed) {
                if (loadMoreBtn) loadMoreBtn.remove();
            } else {
                if (!loadMoreBtn) {
                    loadMoreBtn = document.createElement('button');
                    loadMoreBtn.id = 'load-more-btn-following';
                    loadMoreBtn.className = 'w-full py-4 text-primary font-bold hover:bg-surface-container transition-colors border-t border-surface-container';
                    loadMoreBtn.addEventListener('click', () => {
                        currentOffset += PAGE_SIZE;
                        loadFollowingFeed(true);
                    });
                    feedContainer.parentNode.insertBefore(loadMoreBtn, feedContainer.nextSibling);
                }
                loadMoreBtn.textContent = 'Load More';
            }

        } catch (error) {
            console.error('Error loading following feed:', error);
            if (!isLoadMore && feedLoading) feedLoading.classList.add('hidden');
            const btn = document.getElementById('load-more-btn-following');
            if (btn) btn.textContent = 'Load More';
            showToast('Failed to load feed.');
        }
    }

    // 6. Handle Plant Post Submission from Modal
    async function handleModalPlantSubmit() {
        const text = modalTextarea.value.trim();
        const file = modalImageInput.files[0];

        if (!text && !file) {
            showToast('Please type a thought or select an image.');
            return;
        }

        modalPlantBtn.disabled = true;
        modalPlantBtn.textContent = 'Planting...';

        try {
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
                
                const { data, error: uploadError } = await window.db.storage
                    .from('pot-images')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = window.db.storage
                    .from('pot-images')
                    .getPublicUrl(fileName);
                
                imageUrl = publicUrl;
            }

            const { error: insertError } = await window.db
                .from('pots')
                .insert({
                    user_id: userId,
                    content: text,
                    image_url: imageUrl
                });

            if (insertError) throw insertError;

            modalTextarea.value = '';
            modalImageInput.value = '';
            modalImagePreviewContainer.classList.add('hidden');
            
            showToast('Post planted successfully!');
            newPotModal.classList.remove('active');

            await loadFollowingFeed();

        } catch (error) {
            console.error('Error posting pot:', error);
            showToast(error.message || 'Failed to plant pot. Please try again.');
        } finally {
            modalPlantBtn.disabled = false;
            modalPlantBtn.textContent = 'Plant';
        }
    }

    if (modalPlantBtn) {
        modalPlantBtn.addEventListener('click', handleModalPlantSubmit);
    }

    // 7. Load Suggested Growers (Grow Your Network)
    async function loadSuggestedGrowers() {
        const growList = document.getElementById('grow-network-list');
        if (!growList) return;

        try {
            const { data: followingData } = await window.db
                .from('follows')
                .select('following_id')
                .eq('follower_id', userId);

            const followingIds = (followingData || []).map(f => f.following_id);
            followingIds.push(userId); // exclude ourselves

            const { data: suggestions, error } = await window.db
                .from('profiles')
                .select('*')
                .not('id', 'in', `(${followingIds.join(',')})`)
                .limit(3);

            if (error) throw error;

            if (!suggestions || suggestions.length === 0) {
                growList.innerHTML = `<p class="text-xs text-on-surface-variant">No new suggestions.</p>`;
                return;
            }

            growList.innerHTML = suggestions.map(prof => {
                const avatar = prof.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${prof.display_name || 'U'}`;
                return `
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3 cursor-pointer" onclick="window.location.href='profile.html?id=${prof.id}'">
                            <img alt="${prof.display_name}" class="w-10 h-10 rounded-full object-cover border border-surface-container" src="${avatar}">
                            <div class="min-w-0 max-w-[140px]">
                                <div class="font-bold text-sm text-on-surface truncate hover:underline">${prof.display_name}</div>
                                <div class="text-xs text-on-surface-variant truncate">@${prof.username}</div>
                            </div>
                        </div>
                        <button class="bg-primary text-on-primary px-4 py-1.5 rounded-full text-sm font-bold hover:bg-primary/90 transition-all active:scale-95 shrink-0" onclick="handleFollowToggle('${prof.id}', this)">Follow</button>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Error loading suggestions:', error);
        }
    }

    window.handleFollowToggle = async (targetId, btn) => {
        btn.disabled = true;
        await toggleFollow(targetId, btn);
        btn.disabled = false;
        // Reload following feed to include newly followed user's pots
        await loadFollowingFeed();
    };

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

    // 8. Initial Load
    await loadFollowingFeed();
    await loadSuggestedGrowers();
});
