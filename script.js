document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loginModal = document.getElementById('loginModal');
    const openLoginBtn = document.getElementById('openLoginBtn');
    const closeModal = document.getElementById('closeModal');
    
    // Steps
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    
    // Forms
    const detailsForm = document.getElementById('detailsForm');
    const otpForm = document.getElementById('otpForm');
    
    // User Data
    let userData = {};

    // Open Modal
    openLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginModal.classList.add('active');
        // Reset to step 1
        step1.classList.add('active-step');
        step2.classList.remove('active-step');
        step3.classList.remove('active-step');
        detailsForm.reset();
        otpForm.reset();
    });

    // Close Modal
    const closeModalFn = () => {
        loginModal.classList.remove('active');
    };
    
    closeModal.addEventListener('click', closeModalFn);
    document.getElementById('closeSuccess').addEventListener('click', closeModalFn);
    
    // Close on outside click
    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            closeModalFn();
        }
    });

    // Step 1: Submit Details
    detailsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        userData = {
            fullName: document.getElementById('fullName').value,
            email: document.getElementById('email').value,
            occupancy: document.getElementById('occupancy').value,
            mobile: document.getElementById('mobile').value
        };
        
        // Update Step 2 UI
        document.getElementById('displayMobile').textContent = '+91 ' + userData.mobile;
        
        // Switch to Step 2
        step1.classList.remove('active-step');
        step2.classList.add('active-step');
        
        // Focus first OTP input
        setTimeout(() => document.querySelector('.otp-input').focus(), 100);
    });

    // OTP Input Auto-focus Logic
    const otpInputs = document.querySelectorAll('.otp-input');
    
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            // Only allow numbers
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            
            // Auto focus next input
            if (e.target.value !== '' && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });
        
        input.addEventListener('keydown', (e) => {
            // Auto focus previous input on backspace
            if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });

    // Step 2: Submit OTP
    otpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Check if all OTP fields are filled
        let isValid = true;
        otpInputs.forEach(input => {
            if (input.value === '') isValid = false;
        });
        
        if (!isValid) {
            alert('Please enter the complete 4-digit OTP');
            return;
        }
        
        // Here you would normally verify the OTP with a backend API
        // For frontend simulation, we just proceed to Step 3
        
        // Update Step 3 UI
        document.getElementById('displayName').textContent = userData.fullName.split(' ')[0]; // First name
        
        // Change login button text to show user is logged in
        openLoginBtn.textContent = 'Dashboard';
        
        // Switch to Step 3
        step2.classList.remove('active-step');
        step3.classList.add('active-step');
    });

    // Resend OTP Simulation
    document.getElementById('resendOtp').addEventListener('click', (e) => {
        const btn = e.target;
        btn.textContent = 'OTP Sent!';
        btn.style.color = '#10b981'; // Success green
        
        // Reset after 3 seconds
        setTimeout(() => {
            btn.textContent = 'Resend OTP';
            btn.style.color = '';
        }, 3000);
    });
});
