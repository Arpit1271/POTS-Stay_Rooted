// ============================================
// POTS — Authentication Logic
// ============================================

const Auth = {
    // Get current session
    async getSession() {
        const { data: { session }, error } = await window.db.auth.getSession();
        return session;
    },

    // Get current user profile
    async getCurrentProfile() {
        const session = await this.getSession();
        if (!session) return null;

        const { data, error } = await window.db
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        return data;
    },

    // Sign up
    async signUp(email, password, username, displayName) {
        const { data, error } = await window.db.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username,
                    display_name: displayName
                }
            }
        });

        if (error) throw error;
        return data;
    },

    // Sign in
    async signIn(email, password) {
        const { data, error } = await window.db.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        return data;
    },

    // Sign out
    async signOut() {
        const { error } = await window.db.auth.signOut();
        if (error) throw error;
        window.location.href = 'index.html';
    },

    // Reset password
    async resetPassword(email) {
        const { data, error } = await window.db.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/index.html'
        });

        if (error) throw error;
        return data;
    },

    // Auth guard — redirect to login if not authenticated
    async requireAuth() {
        const { data: { user }, error } = await window.db.auth.getUser();
        if (error || !user) {
            window.location.href = 'index.html';
            return null;
        }
        const { data: { session } } = await window.db.auth.getSession();
        return session;
    },

    // Redirect away from auth pages if already logged in
    async redirectIfAuth() {
        const session = await this.getSession();
        if (session) {
            window.location.href = 'home.html';
            return true;
        }
        return false;
    },

    // Listen for auth state changes
    onAuthStateChange(callback) {
        window.db.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
    }
};

window.Auth = Auth;
