document.addEventListener('DOMContentLoaded', async () => {
    // Redirect if already authenticated
    await Auth.redirectIfAuth();

    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const passwordIcon = document.getElementById('password-icon');
    const signinBtn = document.getElementById('signin-btn');
    const btnText = document.getElementById('btn-text');
    const btnIcon = document.getElementById('btn-icon');
    const btnSpinner = document.getElementById('btn-spinner');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    // Toggle password visibility
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            passwordIcon.textContent = isPassword ? 'visibility' : 'visibility_off';
        });
    }

    // Handle Form Submit
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Reset states
            errorMessage.classList.add('hidden');
            signinBtn.disabled = true;
            signinBtn.classList.add('btn-loading');
            btnText.textContent = 'Signing In...';
            btnIcon.classList.add('hidden');
            btnSpinner.classList.remove('hidden');

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            try {
                await Auth.signIn(email, password);
                window.location.href = 'home.html';
            } catch (error) {
                console.error('Login error:', error);
                errorText.textContent = error.message || 'Failed to sign in. Please check your credentials.';
                errorMessage.classList.remove('hidden');
                
                // Restore button state
                signinBtn.disabled = false;
                signinBtn.classList.remove('btn-loading');
                btnText.textContent = 'Sign In';
                btnIcon.classList.remove('hidden');
                btnSpinner.classList.add('hidden');
            }
        });
    }
});
