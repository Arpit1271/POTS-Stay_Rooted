document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Guard
    const session = await Auth.requireAuth();
    if (!session) return;
    const userId = session.user.id;

    // 2. Initialize Navigation & Sidebar
    await Nav.init('home');

    // 3. Elements
    const feedContainer = document.getElementById('feed-container');
    const feedLoading = document.getElementById('feed-loading');
    const feedEmpty = document.getElementById('feed-empty');
    
    // Compose Elements (Main Feed)
    const composeAvatar = document.getElementById('compose-avatar');
    const composeTextarea = document.getElementById('compose-textarea');
    const composeImageBtn = document.getElementById('compose-image-btn');
    const composeImageInput = document.getElementById('compose-image-input');
    const composeImagePreviewContainer = document.getElementById('compose-image-preview-container');
    const composeImagePreview = document.getElementById('compose-image-preview');
    const composeImageRemove = document.getElementById('compose-image-remove');
    const composePlantBtn = document.getElementById('compose-plant-btn');

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
    if (userProfile) {
        const avatarUrl = userProfile.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=User';
        if (composeAvatar) composeAvatar.src = avatarUrl;
        if (modalAvatar) modalAvatar.src = avatarUrl;
    }

    // 4. File Upload Preview Helpers
    function wireImagePreview(btn, input, previewContainer, previewImg, removeBtn) {
        if (!btn || !input) return;
        btn.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    previewImg.src = event.target.result;
                    previewContainer.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        });
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                input.value = '';
                previewContainer.classList.add('hidden');
                previewImg.src = '';
            });
        }
    }

    wireImagePreview(composeImageBtn, composeImageInput, composeImagePreviewContainer, composeImagePreview, composeImageRemove);
    wireImagePreview(modalImageBtn, modalImageInput, modalImagePreviewContainer, modalImagePreview, modalImageRemove);

    let currentOffset = 0;
    const PAGE_SIZE = 15;
    let isEndOfFeed = false;

    // 5. Load Feed Pots
    async function loadFeed(isLoadMore = false) {
        if (!isLoadMore) {
            currentOffset = 0;
            isEndOfFeed = false;
            if (feedLoading) feedLoading.classList.remove('hidden');
            if (feedEmpty) feedEmpty.classList.add('hidden');
            if (feedContainer) feedContainer.innerHTML = '';
            const existingBtn = document.getElementById('load-more-btn-home');
            if (existingBtn) existingBtn.remove();
        } else {
            const btn = document.getElementById('load-more-btn-home');
            if (btn) btn.textContent = 'Loading...';
        }

        try {
            // Fetch pots with detail view from Supabase
            const query = window.db
                .from('pots_with_details')
                .select('*')
                .order('created_at', { ascending: false })
                .range(currentOffset, currentOffset + PAGE_SIZE - 1);

            const pots = await fetchPotsWithState(query);

            if (!isLoadMore && feedLoading) feedLoading.classList.add('hidden');

            if (!pots || pots.length === 0) {
                if (!isLoadMore && feedEmpty) feedEmpty.classList.remove('hidden');
                isEndOfFeed = true;
                const btn = document.getElementById('load-more-btn-home');
                if (btn) btn.remove();
                return;
            }

            pots.forEach(pot => {
                const postHtml = renderPotCard(pot, userId);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = postHtml.trim();
                const cardElement = tempDiv.firstChild;

                // Add redirect on click to detail view or profile
                cardElement.addEventListener('click', (e) => {
                    // Prevent navigation click triggering main click
                    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('img')) {
                        return;
                    }
                    // For MVP, click on pot takes to comment section or does nothing. We can redirect to profile or focus details
                });

                feedContainer.appendChild(cardElement);
            });

            if (pots.length < PAGE_SIZE) {
                isEndOfFeed = true;
            }

            // Extract and update trending hashtags
            if (!isLoadMore) {
                updateTrendingRoots(pots);
            }

            let loadMoreBtn = document.getElementById('load-more-btn-home');
            if (isEndOfFeed) {
                if (loadMoreBtn) loadMoreBtn.remove();
            } else {
                if (!loadMoreBtn) {
                    loadMoreBtn = document.createElement('button');
                    loadMoreBtn.id = 'load-more-btn-home';
                    loadMoreBtn.className = 'w-full py-4 text-primary font-bold hover:bg-surface-container transition-colors border-t border-surface-container';
                    loadMoreBtn.addEventListener('click', () => {
                        currentOffset += PAGE_SIZE;
                        loadFeed(true);
                    });
                    feedContainer.parentNode.insertBefore(loadMoreBtn, feedContainer.nextSibling);
                }
                loadMoreBtn.textContent = 'Load More';
            }

        } catch (error) {
            console.error('Error loading feed:', error);
            if (!isLoadMore && feedLoading) feedLoading.classList.add('hidden');
            const btn = document.getElementById('load-more-btn-home');
            if (btn) btn.textContent = 'Load More';
            showToast('Failed to load feed.');
        }
    }

    // 6. Handle Plant Post Submission
    async function handlePlantSubmit(textarea, fileInput, previewContainer, submitBtn, modalToClose = null) {
        const text = textarea.value.trim();
        const file = fileInput.files[0];

        if (!text && !file) {
            showToast('Please type a thought or select an image.');
            return;
        }

        // Set button loading
        submitBtn.disabled = true;
        submitBtn.textContent = 'Planting...';

        try {
            let imageUrl = null;

            // Upload image if present
            if (file) {
                try {
                    window.validateImageFile(file);
                } catch (validationError) {
                    showToast(validationError.message);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Plant';
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

            // Insert pot
            const { error: insertError } = await window.db
                .from('pots')
                .insert({
                    user_id: userId,
                    content: text,
                    image_url: imageUrl
                });

            if (insertError) throw insertError;

            // Reset compose inputs
            textarea.value = '';
            fileInput.value = '';
            if (previewContainer) previewContainer.classList.add('hidden');
            
            showToast('Post planted successfully!');

            if (modalToClose) {
                modalToClose.classList.remove('active');
            }

            // Reload feed
            await loadFeed();

        } catch (error) {
            console.error('Error posting pot:', error);
            showToast(error.message || 'Failed to plant pot. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Plant';
        }
    }

    if (composePlantBtn) {
        composePlantBtn.addEventListener('click', () => {
            handlePlantSubmit(composeTextarea, composeImageInput, composeImagePreviewContainer, composePlantBtn);
        });
    }



    // 7. Load Trending Roots List
    function updateTrendingRoots(pots) {
        const trendingList = document.getElementById('trending-roots-list');
        if (!trendingList) return;

        const hashtagCounts = {};
        pots.forEach(p => {
            const tags = p.content.match(/#[a-zA-Z0-9_]+/g) || [];
            tags.forEach(t => {
                hashtagCounts[t] = (hashtagCounts[t] || 0) + 1;
            });
        });

        // Convert to array and sort
        let trending = Object.keys(hashtagCounts).map(tag => ({
            tag,
            count: hashtagCounts[tag]
        })).sort((a, b) => b.count - a.count).slice(0, 3);

        // Fallbacks if not enough dynamic hashtags
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
    }

    // 8. Load Suggested Growers (Grow Your Network)
    async function loadSuggestedGrowers() {
        const growList = document.getElementById('grow-network-list');
        if (!growList) return;

        try {
            // Get profiles we already follow
            const { data: followingData } = await window.db
                .from('follows')
                .select('following_id')
                .eq('follower_id', userId);

            const followingIds = (followingData || []).map(f => f.following_id);
            followingIds.push(userId); // exclude ourselves

            // Query profiles we are not following
            const { data: suggestions, error } = await window.db
                .from('profiles')
                .select('*')
                .not('id', 'in', `(${followingIds.join(',')})`)
                .limit(2);

            if (error) throw error;

            if (!suggestions || suggestions.length === 0) {
                growList.innerHTML = `<p class="text-xs text-on-surface-variant">No new suggestions. Your network is growing!</p>`;
                return;
            }

            growList.innerHTML = suggestions.map(prof => {
                const avatar = prof.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${prof.display_name || 'U'}`;
                return `
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3 cursor-pointer" onclick="window.location.href='profile.html?id=${prof.id}'">
                            <img alt="${prof.display_name}" class="w-10 h-10 rounded-full object-cover border border-surface-container" src="${avatar}">
                            <div class="min-w-0 max-w-[120px]">
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
            growList.innerHTML = `<p class="text-xs text-error">Failed to load suggestions.</p>`;
        }
    }

    // Global toggle follow for suggestions
    window.handleFollowToggle = async (targetId, btn) => {
        btn.disabled = true;
        await toggleFollow(targetId, btn);
        btn.disabled = false;
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

    // 9. Initial Load
    await loadFeed();
    await loadSuggestedGrowers();
});
