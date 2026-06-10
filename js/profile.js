document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Guard
    const session = await Auth.requireAuth();
    if (!session) return;
    const currentUserId = session.user.id;

    // 2. Determine Profile Owner ID
    const urlParams = new URLSearchParams(window.location.search);
    const profileId = urlParams.get('id') || currentUserId;
    const isOwnProfile = profileId === currentUserId;

    // 3. Initialize Navigation & Sidebar
    await Nav.init('profile');

    // 4. Elements
    const profileCover = document.getElementById('profile-cover');
    const profileAvatar = document.getElementById('profile-avatar');
    const profileActions = document.getElementById('profile-actions');
    const profileDisplayName = document.getElementById('profile-display-name');
    const profileUsername = document.getElementById('profile-username');
    const profileVerifiedBadge = document.getElementById('profile-verified-badge');
    const profileBio = document.getElementById('profile-bio');
    const profileLocationWrap = document.getElementById('profile-location-wrap');
    const profileLocation = document.getElementById('profile-location');
    const profileJoinedDate = document.getElementById('profile-joined-date');
    
    const countGrowers = document.getElementById('profile-growers-count');
    const countFollowing = document.getElementById('profile-following-count');
    const countPots = document.getElementById('profile-pots-count');

    // Tabs
    const tabPots = document.getElementById('tab-pots');
    const tabReplies = document.getElementById('tab-replies');
    const tabMedia = document.getElementById('tab-media');
    const postsContainer = document.getElementById('profile-posts');
    const postsLoading = document.getElementById('profile-loading');

    // Edit Profile Modal
    const editModal = document.getElementById('edit-profile-modal');
    const editForm = document.getElementById('edit-profile-form');
    const editClose = document.getElementById('edit-profile-close');
    const editCancel = document.getElementById('edit-profile-cancel');
    const editDisplayName = document.getElementById('edit-display-name');
    const editBio = document.getElementById('edit-bio');
    const editLocation = document.getElementById('edit-location');
    
    const editCoverBtn = document.getElementById('edit-profile-cover-btn');
    const editCoverInput = document.getElementById('edit-profile-cover-input');
    const editCoverPreview = document.getElementById('edit-profile-cover-preview');
    const editAvatarBtn = document.getElementById('edit-profile-avatar-btn');
    const editAvatarInput = document.getElementById('edit-profile-avatar-input');
    const editAvatarPreview = document.getElementById('edit-profile-avatar-preview');

    let currentProfileData = null;
    let activeTab = 'pots';

    // Update modal trigger avatar
    const modalAvatar = document.getElementById('modal-avatar');
    if (modalAvatar && Nav.currentUser) {
        modalAvatar.src = Nav.currentUser.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=User';
    }

    // 5. Fetch and Render Profile Metadata
    async function loadProfileHeader() {
        try {
            // Get profile details
            const { data: profile, error } = await window.db
                .from('profiles')
                .select('*')
                .eq('id', profileId)
                .single();

            if (error || !profile) {
                showToast('Grower profile not found.');
                window.location.href = 'home.html';
                return;
            }

            currentProfileData = profile;

            // Render text elements
            profileDisplayName.textContent = profile.display_name || profile.username;
            profileUsername.textContent = `@${profile.username}`;
            profileBio.textContent = profile.bio || 'No bio yet.';
            
            if (profile.is_verified) {
                profileVerifiedBadge.classList.remove('hidden');
            } else {
                profileVerifiedBadge.classList.add('hidden');
            }

            if (profile.location) {
                profileLocation.textContent = profile.location;
                profileLocationWrap.classList.remove('hidden');
            } else {
                profileLocationWrap.classList.add('hidden');
            }

            // Joined date formatting
            const date = new Date(profile.created_at);
            const formattedDate = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            profileJoinedDate.textContent = formattedDate;

            // Images
            profileAvatar.src = profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.display_name || 'U'}`;
            if (profile.cover_url) {
                profileCover.src = profile.cover_url;
            } else {
                // High quality fallback cover image
                profileCover.src = 'https://lh3.googleusercontent.com/aida-public/AB6AXuARhXM-FI8OcIiivrg0wuBFqwQnTyPZurXyWxNX42fAcZH_Xs2pp3tXH0qMoOb6rADurYOv3E1UiwHqlx04cvCmw-WOwNzEI7Z-9-bX_6cQn-oskbZ5MfwpmEUwUIKclNBEnlWlqHbXJgQ6NOkrl9HBpMmzEb4SzAHmGmcpVw6w1UEj0yt11rAteI2gs1sz2F7EXbBUXxYf0R6mrTUGy71NVc7TZI0h0uIVbRZlokjP3MjL2Vmk3pf1gGYuE_thDJwFA_fFiG2VV-E';
            }

            // Action buttons
            profileActions.innerHTML = '';
            if (isOwnProfile) {
                const editBtn = document.createElement('button');
                editBtn.className = 'px-5 py-2 rounded-xl border border-primary text-primary hover:bg-primary/5 transition-colors font-bold text-sm';
                editBtn.textContent = 'Edit Profile';
                editBtn.addEventListener('click', openEditModal);
                profileActions.appendChild(editBtn);
            } else {
                // Message button
                const msgBtn = document.createElement('button');
                msgBtn.className = 'w-10 h-10 rounded-full border border-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors shrink-0';
                msgBtn.innerHTML = `<span class="material-symbols-outlined text-[20px]">mail</span>`;
                msgBtn.onclick = () => showToast('Messaging feature coming soon!');
                profileActions.appendChild(msgBtn);

                // Follow/Following Button
                const followBtn = document.createElement('button');
                followBtn.className = 'bg-primary text-on-primary px-5 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all active:scale-95 shrink-0';
                followBtn.textContent = 'Follow';
                followBtn.addEventListener('click', async () => {
                    followBtn.disabled = true;
                    await toggleFollow(profileId, followBtn);
                    followBtn.disabled = false;
                    await loadProfileStats(); // refresh followers count
                });
                profileActions.appendChild(followBtn);

                // Check follow status
                const { data: followCheck } = await window.db
                    .from('follows')
                    .select('*')
                    .eq('follower_id', currentUserId)
                    .eq('following_id', profileId)
                    .maybeSingle();

                if (followCheck) {
                    followBtn.textContent = 'Following';
                    followBtn.className = 'bg-surface-container-high text-on-surface px-5 py-2 rounded-xl text-sm font-bold hover:bg-surface-container transition-colors active:scale-95 shrink-0';
                }
            }

            await loadProfileStats();

        } catch (error) {
            console.error('Error fetching profile metadata:', error);
            showToast('Failed to load profile details.');
        }
    }

    async function loadProfileStats() {
        try {
            // Followers count
            const { count: followers } = await window.db
                .from('follows')
                .select('*', { count: 'exact', head: true })
                .eq('following_id', profileId);

            // Following count
            const { count: following } = await window.db
                .from('follows')
                .select('*', { count: 'exact', head: true })
                .eq('follower_id', profileId);

            // Pots count
            const { count: pots } = await window.db
                .from('pots')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', profileId);

            countGrowers.textContent = (followers || 0).toLocaleString();
            countFollowing.textContent = (following || 0).toLocaleString();
            countPots.textContent = (pots || 0).toLocaleString();
        } catch (e) {
            console.error('Stats error:', e);
        }
    }

    let currentOffset = 0;
    const PAGE_SIZE = 15;
    let isEndOfFeed = false;

    // 6. Fetch and Render Tab Contents
    async function loadTabContent(isLoadMore = false) {
        if (!isLoadMore) {
            currentOffset = 0;
            isEndOfFeed = false;
            if (postsLoading) postsLoading.classList.remove('hidden');
            if (postsContainer) postsContainer.innerHTML = '';
            const existingBtn = document.getElementById('load-more-btn-profile');
            if (existingBtn) existingBtn.remove();
        } else {
            const btn = document.getElementById('load-more-btn-profile');
            if (btn) btn.textContent = 'Loading...';
        }

        try {
            if (activeTab === 'pots') {
                const query = window.db
                    .from('pots_with_details')
                    .select('*')
                    .eq('user_id', profileId)
                    .order('created_at', { ascending: false })
                    .range(currentOffset, currentOffset + PAGE_SIZE - 1);

                const pots = await fetchPotsWithState(query);
                if (!isLoadMore) postsLoading.classList.add('hidden');

                if (!pots || pots.length === 0) {
                    if (!isLoadMore) {
                        postsContainer.innerHTML = `
                            <div class="empty-state py-12">
                                <span class="material-symbols-outlined icon">potted_plant</span>
                                <h3>No pots planted yet</h3>
                                <p>This grower hasn't shared any thoughts yet.</p>
                            </div>
                        `;
                    }
                    isEndOfFeed = true;
                    const btn = document.getElementById('load-more-btn-profile');
                    if (btn) btn.remove();
                    return;
                }

                pots.forEach(pot => {
                    postsContainer.innerHTML += renderPotCard(pot, currentUserId, { cardStyle: 'flat' });
                });

                if (pots.length < PAGE_SIZE) isEndOfFeed = true;

            } else if (activeTab === 'replies') {
                // Fetch replies (comments table joined with pot details/profile details)
                const { data: comments, error } = await window.db
                    .from('comments')
                    .select('*, pots(content, user_id, profiles(username, display_name))')
                    .eq('user_id', profileId)
                    .order('created_at', { ascending: false })
                    .range(currentOffset, currentOffset + PAGE_SIZE - 1);

                if (!isLoadMore) postsLoading.classList.add('hidden');

                if (error || !comments || comments.length === 0) {
                    if (!isLoadMore) {
                        postsContainer.innerHTML = `
                            <div class="empty-state py-12">
                                <span class="material-symbols-outlined icon">chat</span>
                                <h3>No replies yet</h3>
                                <p>This grower hasn't commented on any pots yet.</p>
                            </div>
                        `;
                    }
                    isEndOfFeed = true;
                    const btn = document.getElementById('load-more-btn-profile');
                    if (btn) btn.remove();
                    return;
                }

                comments.forEach(c => {
                    const authorName = c.pots?.profiles?.display_name || c.pots?.profiles?.username || 'someone';
                    const relativeTime = timeAgo(c.created_at);
                    postsContainer.innerHTML += `
                        <div class="p-6 hover:bg-surface-container-low/50 transition-colors">
                            <div class="flex items-center gap-2 text-xs text-on-surface-variant font-medium mb-2">
                                <span class="material-symbols-outlined text-[16px]">reply</span>
                                <span>Replied to ${authorName} · ${relativeTime}</span>
                            </div>
                            <div class="pl-6 border-l-2 border-primary/20">
                                <p class="text-on-surface leading-relaxed text-[15px] font-body">${escapeHtml(c.content)}</p>
                                <p class="text-xs text-on-surface-variant/80 mt-2 font-medium bg-surface-container/40 p-2 rounded-lg truncate">Original: "${escapeHtml(c.pots?.content || '')}"</p>
                            </div>
                        </div>
                    `;
                });

                if (comments.length < PAGE_SIZE) isEndOfFeed = true;

            } else if (activeTab === 'media') {
                const query = window.db
                    .from('pots_with_details')
                    .select('*')
                    .eq('user_id', profileId)
                    .not('image_url', 'is', null)
                    .order('created_at', { ascending: false })
                    .range(currentOffset, currentOffset + PAGE_SIZE - 1);

                const pots = await fetchPotsWithState(query);
                if (!isLoadMore) postsLoading.classList.add('hidden');

                if (!pots || pots.length === 0) {
                    if (!isLoadMore) {
                        postsContainer.innerHTML = `
                            <div class="empty-state py-12">
                                <span class="material-symbols-outlined icon">image</span>
                                <h3>No media posts</h3>
                                <p>This grower hasn't posted any plant photos yet.</p>
                            </div>
                        `;
                    }
                    isEndOfFeed = true;
                    const btn = document.getElementById('load-more-btn-profile');
                    if (btn) btn.remove();
                    return;
                }

                pots.forEach(pot => {
                    postsContainer.innerHTML += renderPotCard(pot, currentUserId, { cardStyle: 'flat' });
                });

                if (pots.length < PAGE_SIZE) isEndOfFeed = true;
            }

            let loadMoreBtn = document.getElementById('load-more-btn-profile');
            if (isEndOfFeed) {
                if (loadMoreBtn) loadMoreBtn.remove();
            } else {
                if (!loadMoreBtn) {
                    loadMoreBtn = document.createElement('button');
                    loadMoreBtn.id = 'load-more-btn-profile';
                    loadMoreBtn.className = 'w-full py-4 text-primary font-bold hover:bg-surface-container transition-colors border-t border-surface-container';
                    loadMoreBtn.addEventListener('click', () => {
                        currentOffset += PAGE_SIZE;
                        loadTabContent(true);
                    });
                    postsContainer.parentNode.insertBefore(loadMoreBtn, postsContainer.nextSibling);
                }
                loadMoreBtn.textContent = 'Load More';
            }

        } catch (err) {
            console.error('Error fetching tab data:', err);
            if (!isLoadMore) postsLoading.classList.add('hidden');
            const btn = document.getElementById('load-more-btn-profile');
            if (btn) btn.textContent = 'Load More';
        }
    }

    // Tab Navigation handlers
    function switchTab(tabName, activeEl, inactiveEls) {
        activeTab = tabName;
        activeEl.className = 'flex-1 py-3 border-b-2 border-primary text-primary text-center cursor-pointer';
        inactiveEls.forEach(el => {
            el.className = 'flex-1 py-3 border-b-2 border-transparent text-on-surface-variant hover:text-on-surface text-center cursor-pointer';
        });
        loadTabContent();
    }

    if (tabPots && tabReplies && tabMedia) {
        tabPots.addEventListener('click', () => switchTab('pots', tabPots, [tabReplies, tabMedia]));
        tabReplies.addEventListener('click', () => switchTab('replies', tabReplies, [tabPots, tabMedia]));
        tabMedia.addEventListener('click', () => switchTab('media', tabMedia, [tabPots, tabReplies]));
    }

    // 7. Edit Profile Modal Logic
    function openEditModal() {
        if (!currentProfileData) return;
        editDisplayName.value = currentProfileData.display_name || '';
        editBio.value = currentProfileData.bio || '';
        editLocation.value = currentProfileData.location || '';
        
        editAvatarPreview.src = currentProfileData.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=User';
        editCoverPreview.src = currentProfileData.cover_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuARhXM-FI8OcIiivrg0wuBFqwQnTyPZurXyWxNX42fAcZH_Xs2pp3tXH0qMoOb6rADurYOv3E1UiwHqlx04cvCmw-WOwNzEI7Z-9-bX_6cQn-oskbZ5MfwpmEUwUIKclNBEnlWlqHbXJgQ6NOkrl9HBpMmzEb4SzAHmGmcpVw6w1UEj0yt11rAteI2gs1sz2F7EXbBUXxYf0R6mrTUGy71NVc7TZI0h0uIVbRZlokjP3MjL2Vmk3pf1gGYuE_thDJwFA_fFiG2VV-E';

        editModal.classList.add('active');
    }

    function closeEditModal() {
        editModal.classList.remove('active');
        // Reset file inputs
        editAvatarInput.value = '';
        editCoverInput.value = '';
    }

    if (editClose) editClose.addEventListener('click', closeEditModal);
    if (editCancel) editCancel.addEventListener('click', closeEditModal);

    // Cover Change Trigger
    if (editCoverBtn && editCoverInput) {
        editCoverBtn.addEventListener('click', () => editCoverInput.click());
        editCoverInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    editCoverPreview.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Avatar Change Trigger
    if (editAvatarBtn && editAvatarInput) {
        editAvatarBtn.addEventListener('click', () => editAvatarInput.click());
        editAvatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    editAvatarPreview.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Form Save Submit
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const saveBtn = document.getElementById('edit-profile-save');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';

            const displayName = editDisplayName.value.trim();
            const bio = editBio.value.trim();
            const location = editLocation.value.trim();

            try {
                let avatarUrl = currentProfileData.avatar_url;
                let coverUrl = currentProfileData.cover_url;

                // 1. Upload new avatar if selected
                const avatarFile = editAvatarInput.files[0];
                if (avatarFile) {
                    try {
                        window.validateImageFile(avatarFile, 2);
                    } catch (validationError) {
                        showToast(validationError.message);
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Save Changes';
                        return;
                    }
                    const ext = avatarFile.name.split('.').pop();
                    const path = `${currentUserId}/${Date.now()}.${ext}`;

                    const { error: avatarError } = await window.db.storage
                        .from('avatars')
                        .upload(path, avatarFile, { upsert: true });

                    if (avatarError) throw avatarError;

                    const { data: { publicUrl } } = window.db.storage
                        .from('avatars')
                        .getPublicUrl(path);
                    avatarUrl = publicUrl;
                }

                // 2. Upload new cover if selected
                const coverFile = editCoverInput.files[0];
                if (coverFile) {
                    try {
                        window.validateImageFile(coverFile, 5);
                    } catch (validationError) {
                        showToast(validationError.message);
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Save Changes';
                        return;
                    }
                    const ext = coverFile.name.split('.').pop();
                    const path = `${currentUserId}/${Date.now()}.${ext}`;

                    const { error: coverError } = await window.db.storage
                        .from('covers')
                        .upload(path, coverFile, { upsert: true });

                    if (coverError) throw coverError;

                    const { data: { publicUrl } } = window.db.storage
                        .from('covers')
                        .getPublicUrl(path);
                    coverUrl = publicUrl;
                }

                // 3. Update profiles table
                const { error: updateError } = await window.db
                    .from('profiles')
                    .update({
                        display_name: displayName,
                        bio: bio,
                        location: location,
                        avatar_url: avatarUrl,
                        cover_url: coverUrl
                    })
                    .eq('id', currentUserId);

                if (updateError) throw updateError;

                showToast('Profile updated successfully!');
                closeEditModal();
                
                // Refresh headers
                await loadProfileHeader();
                
                // Also reload navigation component to sync nav avatar
                await Nav.init('profile');

            } catch (err) {
                console.error('Profile update error:', err);
                showToast(err.message || 'Failed to update profile.');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Changes';
            }
        });
    }

    // 8. Initial Load
    await loadProfileHeader();
    await loadTabContent();
});
