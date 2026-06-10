document.addEventListener('DOMContentLoaded', async () => {
    // Redirect if already authenticated
    await Auth.redirectIfAuth();

    const signupForm = document.getElementById('signup-form');
    const displayNameInput = document.getElementById('display-name');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const passwordIcon = document.getElementById('password-icon');
    const matchIcon = document.getElementById('match-icon');
    const signupBtn = document.getElementById('signup-btn');
    const btnText = signupBtn?.querySelector('#btn-text');
    const btnIcon = signupBtn?.querySelector('#btn-icon');
    const btnSpinner = signupBtn?.querySelector('#btn-spinner');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    const successMessage = document.getElementById('success-message');

    // Toggle password visibility
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            confirmPasswordInput.setAttribute('type', isPassword ? 'text' : 'password');
            passwordIcon.textContent = isPassword ? 'visibility' : 'visibility_off';
        });
    }

    // Password strength check
    if (passwordInput) {
        passwordInput.addEventListener('input', () => {
            const val = passwordInput.value;
            let score = 0;
            if (val.length >= 6) score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            const bars = [
                document.getElementById('str-1'),
                document.getElementById('str-2'),
                document.getElementById('str-3'),
                document.getElementById('str-4')
            ];
            const strengthText = document.getElementById('strength-text');

            // Reset
            bars.forEach(b => {
                if (b) {
                    b.className = 'flex-1 strength-bar bg-surface-container-high rounded-full';
                }
            });

            if (val.length === 0) {
                if (strengthText) strengthText.innerHTML = '&nbsp;';
                return;
            }

            const colors = ['bg-error', 'bg-warning', 'bg-tertiary', 'bg-primary'];
            const labels = ['Weak', 'Fair', 'Good', 'Strong'];

            for (let i = 0; i < score; i++) {
                if (bars[i]) {
                    bars[i].className = `flex-1 strength-bar ${colors[score - 1]} rounded-full`;
                }
            }
            if (strengthText) {
                strengthText.textContent = labels[score - 1];
                strengthText.className = `text-xs mt-1 ml-1 font-semibold text-${colors[score - 1].replace('bg-', '')}`;
            }
        });
    }

    // Real-time password matching check
    function checkPasswordsMatch() {
        if (!confirmPasswordInput || !passwordInput || !matchIcon) return;
        
        const pw = passwordInput.value;
        const cpw = confirmPasswordInput.value;

        if (cpw.length === 0) {
            matchIcon.classList.add('hidden');
            return;
        }

        matchIcon.classList.remove('hidden');
        if (pw === cpw) {
            matchIcon.textContent = 'check_circle';
            matchIcon.className = 'absolute right-3 top-1/2 -translate-y-1/2 text-xl text-primary animate-check';
        } else {
            matchIcon.textContent = 'cancel';
            matchIcon.className = 'absolute right-3 top-1/2 -translate-y-1/2 text-xl text-error animate-check';
        }
    }

    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', checkPasswordsMatch);
    }
    if (passwordInput) {
        passwordInput.addEventListener('input', checkPasswordsMatch);
    }

    // Handle Signup Form Submit
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Reset error
            errorMessage.classList.add('hidden');

            const displayName = displayNameInput.value.trim();
            const username = usernameInput.value.trim().toLowerCase();
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            // Simple validation
            if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
                showError('Username must be 3-20 characters and contain only letters, numbers, or underscores.');
                return;
            }

            if (password.length < 6) {
                showError('Password must be at least 6 characters.');
                return;
            }

            if (password !== confirmPassword) {
                showError('Passwords do not match.');
                return;
            }

            // Set loading state
            signupBtn.disabled = true;
            signupBtn.classList.add('btn-loading');
            btnText.textContent = 'Creating Account...';
            btnIcon.classList.add('hidden');
            btnSpinner.classList.remove('hidden');

            try {
                await Auth.signUp(email, password, username, displayName);
                // Show success message and hide form
                signupForm.classList.add('hidden');
                successMessage.classList.remove('hidden');
            } catch (error) {
                console.error('Signup error:', error);
                showError(error.message || 'Failed to create account. Please try again.');
                
                // Reset button state
                signupBtn.disabled = false;
                signupBtn.classList.remove('btn-loading');
                btnText.textContent = 'Create Account';
                btnIcon.classList.remove('hidden');
                btnSpinner.classList.add('hidden');
            }
        });
    }

    function showError(msg) {
        errorText.textContent = msg;
        errorMessage.classList.remove('hidden');
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});
