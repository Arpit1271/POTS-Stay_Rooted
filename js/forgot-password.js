document.addEventListener('DOMContentLoaded', async () => {
    // Redirect if already authenticated
    await Auth.redirectIfAuth();

    const resetForm = document.getElementById('reset-form');
    const emailInput = document.getElementById('email');
    const resetBtn = document.getElementById('reset-btn');
    const btnText = document.getElementById('btn-text');
    const btnIcon = document.getElementById('btn-icon');
    const btnSpinner = document.getElementById('btn-spinner');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    const successMessage = document.getElementById('success-message');
    const sentEmailSpan = document.getElementById('sent-email');
    const resendBtn = document.getElementById('resend-btn');

    async function handleReset(email) {
        // Reset states
        errorMessage.classList.add('hidden');
        resetBtn.disabled = true;
        resetBtn.classList.add('btn-loading');
        btnText.textContent = 'Sending...';
        btnIcon.classList.add('hidden');
        btnSpinner.classList.remove('hidden');

        try {
            await Auth.resetPassword(email);
            
            // Show success
            if (sentEmailSpan) sentEmailSpan.textContent = email;
            resetForm.classList.add('hidden');
            successMessage.classList.remove('hidden');
        } catch (error) {
            console.error('Password reset error:', error);
            errorText.textContent = error.message || 'Failed to send reset link. Please try again.';
            errorMessage.classList.remove('hidden');

            // Restore button state
            resetBtn.disabled = false;
            resetBtn.classList.remove('btn-loading');
            btnText.textContent = 'Send Reset Link';
            btnIcon.classList.remove('hidden');
            btnSpinner.classList.add('hidden');
        }
    }

    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            if (email) {
                await handleReset(email);
            }
        });
    }

    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            const email = sentEmailSpan.textContent;
            if (email) {
                // Temporarily show reset form to allow re-submission or handle directly
                await handleReset(email);
            }
        });
    }
});
