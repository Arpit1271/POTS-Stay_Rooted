document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Guard
    const session = await Auth.requireAuth();
    if (!session) return;
    const userId = session.user.id;

    function sanitizeSearch(term) {
        return term.replace(/[%_.\\,()]/g, '').trim().replace(/\s+/g, '%');
    }

    // 2. Initialize Navigation & Sidebar
    await Nav.init('explore');

    // 3. Elements
    const exploreSearch = document.getElementById('explore-search');
    const trendingSection = document.getElementById('trending-section');
    const searchResults = document.getElementById('search-results');
    const searchLoading = document.getElementById('search-loading');
    const searchProfilesSection = document.getElementById('search-profiles-section');
    const searchProfiles = document.getElementById('search-profiles');
    const searchPotsSection = document.getElementById('search-pots-section');
    const searchPots = document.getElementById('search-pots');
    const searchEmpty = document.getElementById('search-empty');

    // 4. Handle Modal for New Pot (from page top bar button)
    const newPotModal = document.getElementById('new-pot-modal');
    const modalAvatar = document.getElementById('modal-avatar');
    const modalTextarea = document.getElementById('modal-textarea');
    const modalImageBtn = document.getElementById('modal-image-btn');
    const modalImageInput = document.getElementById('modal-image-input');
    const modalImagePreviewContainer = document.getElementById('modal-image-preview-container');
    const modalImagePreview = document.getElementById('modal-image-preview');
    const modalImageRemove = document.getElementById('modal-image-remove');
    const modalPlantBtn = document.getElementById('modal-plant-btn');

    if (modalAvatar && Nav.currentUser) {
        modalAvatar.src = Nav.currentUser.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=User';
    }

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

    if (modalPlantBtn && newPotModal) {
        modalPlantBtn.addEventListener('click', async () => {
            const text = modalTextarea.value.trim();
            const file = modalImageInput.files[0];

            if (!text && !file) {
                showToast('Please type a thought.');
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
                modalImagePreviewContainer.classList.add('hidden');
                
                showToast('Post planted successfully!');
                newPotModal.classList.remove('active');
                
                // Redirect to home feed to see post
                window.location.href = 'home.html';
            } catch (error) {
                console.error('Error posting pot:', error);
                showToast('Failed to plant pot.');
            } finally {
                modalPlantBtn.disabled = false;
                modalPlantBtn.textContent = 'Plant';
            }
        });
    }

    // 5. Search Logic
    let debounceTimeout = null;

    async function performSearch(term) {
        if (!term) {
            trendingSection.classList.remove('hidden');
            searchResults.classList.add('hidden');
            return;
        }

        trendingSection.classList.add('hidden');
        searchResults.classList.remove('hidden');
        searchLoading.classList.remove('hidden');
        searchProfilesSection.classList.add('hidden');
        searchPotsSection.classList.add('hidden');
        searchEmpty.classList.add('hidden');

        try {
            const safeTerm = sanitizeSearch(term);
            if (!safeTerm) return;

            // Search profiles
            const { data: profiles, error: profilesError } = await window.db
                .from('profiles')
                .select('*')
                .or(`username.ilike.%${safeTerm}%,display_name.ilike.%${safeTerm}%`)
                .limit(5);

            if (profilesError) throw profilesError;

            // Search pots (using pots_with_details view)
            const potsQuery = window.db
                .from('pots_with_details')
                .select('*')
                .ilike('content', `%${safeTerm}%`)
                .order('created_at', { ascending: false })
                .limit(15);

            const pots = await fetchPotsWithState(potsQuery);

            searchLoading.classList.add('hidden');

            let hasResults = false;

            // Render Profiles
            if (profiles && profiles.length > 0) {
                hasResults = true;
                searchProfilesSection.classList.remove('hidden');
                searchProfiles.innerHTML = profiles.map(prof => {
                    const avatar = prof.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${prof.display_name || 'U'}`;
                    const isOwn = prof.id === userId;
                    return `
                        <div class="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container transition-colors cursor-pointer" onclick="window.location.href='profile.html?id=${prof.id}'">
                            <div class="flex items-center gap-3">
                                <img src="${avatar}" alt="${prof.display_name}" class="w-10 h-10 rounded-full object-cover border border-surface-container" />
                                <div>
                                    <div class="font-bold text-sm text-on-surface hover:underline">${prof.display_name}</div>
                                    <div class="text-xs text-on-surface-variant">@${prof.username}</div>
                                </div>
                            </div>
                            ${isOwn ? '' : `
                                <button class="bg-primary text-on-primary px-4 py-1.5 rounded-full text-xs font-bold hover:bg-primary/90 transition-all active:scale-95 shrink-0" onclick="event.stopPropagation(); handleSearchFollow('${prof.id}', this)">Follow</button>
                            `}
                        </div>
                    `;
                }).join('');

                // Check follow status for profile search items
                checkSearchFollowStatuses(profiles);
            }

            // Render Pots
            if (pots && pots.length > 0) {
                hasResults = true;
                searchPotsSection.classList.remove('hidden');
                searchPots.innerHTML = '';
                pots.forEach(pot => {
                    const postHtml = renderPotCard(pot, userId, { cardStyle: 'flat' });
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = postHtml.trim();
                    searchPots.appendChild(tempDiv.firstChild);
                });
            }

            if (!hasResults) {
                searchEmpty.classList.remove('hidden');
            }

        } catch (error) {
            console.error('Search error:', error);
            searchLoading.classList.add('hidden');
            showToast('Search failed. Please try again.');
        }
    }

    async function checkSearchFollowStatuses(profiles) {
        try {
            const profileIds = profiles.map(p => p.id).filter(id => id !== userId);
            if (profileIds.length === 0) return;

            const { data: follows } = await window.db
                .from('follows')
                .select('following_id')
                .eq('follower_id', userId)
                .in('following_id', profileIds);

            const followedIds = new Set((follows || []).map(f => f.following_id));

            // Select all buttons inside search results for these profiles
            const buttons = searchProfiles.querySelectorAll('button');
            buttons.forEach((btn, index) => {
                const profId = profileIds[index];
                if (followedIds.has(profId)) {
                    btn.textContent = 'Following';
                    btn.className = btn.className.replace('bg-primary text-on-primary', 'bg-surface-container-high text-on-surface');
                }
            });
        } catch (e) {
            console.error(e);
        }
    }

    window.handleSearchFollow = async (profId, btn) => {
        btn.disabled = true;
        await toggleFollow(profId, btn);
        btn.disabled = false;
    };

    if (exploreSearch) {
        exploreSearch.addEventListener('input', (e) => {
            clearTimeout(debounceTimeout);
            const term = e.target.value.trim();
            debounceTimeout = setTimeout(() => {
                performSearch(term);
            }, 300);
        });
    }

    // 6. Check URL Parameters for Initial Query (e.g. ?q=tag)
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('q');
    if (initialQuery && exploreSearch) {
        exploreSearch.value = initialQuery;
        await performSearch(initialQuery);
    }
});
