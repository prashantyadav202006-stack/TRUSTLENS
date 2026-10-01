document.addEventListener('DOMContentLoaded', () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const chooseFileBtn = document.getElementById('chooseFileBtn');
    
    // UI Elements to update upon file selection
    const dropzoneTitle = document.getElementById('dropzoneTitle');
    const dropzoneText = document.getElementById('dropzoneText');
    const dropzoneIcon = document.getElementById('dropzoneIcon');
    const fileLimitText = document.getElementById('fileLimitText');

    // 1. Open file dialog when "Choose CSV File" button is clicked
    chooseFileBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // 2. Handle file selection via the input dialog
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // 3. Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // 4. Highlight dropzone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        dropzone.style.borderColor = '#2563eb';
        dropzone.style.backgroundColor = '#eff6ff';
    }

    function unhighlight(e) {
        dropzone.style.borderColor = '#cbd5e1';
        dropzone.style.backgroundColor = '#f8fafc';
    }

    // 5. Handle dropped files
    dropzone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            handleFile(files[0]);
        }
    }

    // 6. Process the selected file
    function handleFile(file) {
        // Validate file type
        if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
            alert('Please upload a valid .csv file.');
            fileInput.value = ''; // Reset input
            return;
        }

        // Validate file size (e.g., limit to 50MB)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('File is too large. Maximum size is 50 MB.');
            fileInput.value = ''; // Reset input
            return;
        }

        // Update UI to show selected file
        updateUIWithFile(file);
        uploadToBackend(file);
    }

    let backendData = null;
    function uploadToBackend(file) {
        const formData = new FormData();
        formData.append('file', file);
        fetch('http://localhost:5000/upload', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if(data.error) {
                console.error(data.error);
            } else {
                backendData = data;
                localStorage.setItem('uploadResults', JSON.stringify(data));
            }
        })
        .catch(err => console.error("Upload error:", err));
    }

    // 7. Change the UI to show processing animation
    function updateUIWithFile(file) {
        // Hide upload UI
        dropzone.style.display = 'none';
        document.getElementById('divider').style.display = 'none';
        document.getElementById('cloudImports').style.display = 'none';
        
        // Show processing UI
        const processingContainer = document.getElementById('processingContainer');
        const progressBar = document.getElementById('progressBar');
        const processingLogs = document.getElementById('processingLogs');
        const processingStatus = document.getElementById('processingStatus');
        
        processingContainer.style.display = 'block';
        processingStatus.textContent = 'Scanning: ' + file.name;
        
        // Simulation steps
        const steps = [
            { progress: 10, msg: "Initializing scanner...", delay: 500 },
            { progress: 30, msg: "Reading file structure and encoding...", delay: 1500 },
            { progress: 50, msg: "Validating column headers...", delay: 2500 },
            { progress: 75, msg: "Checking for missing values & data types...", delay: 3500 },
            { progress: 100, msg: "Analysis complete! Preparing profile...", delay: 5000 }
        ];
        
        let currentLi = null;

        steps.forEach((step, index) => {
            setTimeout(() => {
                // Update progress bar
                progressBar.style.width = step.progress + '%';
                
                // Mark previous step as success
                if (currentLi) {
                    currentLi.classList.add('success');
                    currentLi.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ${steps[index-1].msg.replace('...', '')} - Done
                    `;
                }
                
                // Add new log entry with spinner
                const li = document.createElement('li');
                if (step.progress === 100) {
                    li.classList.add('success');
                    li.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ${step.msg}
                    `;
                    progressBar.classList.add('success');
                    processingStatus.textContent = 'Ready for Profiling!';
                    processingStatus.style.color = '#10b981';
                    
                    // Show toast popup
                    const toast = document.getElementById('toast');
                    toast.classList.add('show');
                    setTimeout(() => {
                        toast.classList.remove('show');
                    }, 4000);
                    
                    // Move stepper line to 100%
                    document.getElementById('line1').style.width = '100%';
                    
                    // Move stepper to step 2 after a short delay
                    setTimeout(() => {
                        const stepsElements = document.querySelectorAll('.stepper .step');
                        stepsElements[0].classList.remove('active');
                        stepsElements[0].querySelector('.step-circle').style.background = '#10b981';
                        stepsElements[0].querySelector('.step-circle').style.color = '#fff';
                        stepsElements[0].querySelector('.step-circle').style.boxShadow = 'none';
                        stepsElements[0].querySelector('.step-circle').innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                        
                        stepsElements[1].classList.add('active');
                        
                        // Proceed to accomplish all remaining steps automatically
                        simulateRemainingSteps(stepsElements);
                    }, 1000);
                } else {
                    li.innerHTML = `
                        <div class="spinner"></div>
                        ${step.msg}
                    `;
                    currentLi = li;
                }
                
                processingLogs.appendChild(li);
                
            }, step.delay);
        });
    }

    // Function to simulate the remaining stepper animations
    function simulateRemainingSteps(stepsElements) {
        const delays = [2000, 2000, 2000]; // Delays before finishing each step
        const statuses = ["Profiling dataset...", "Cleaning messy data...", "Validating data integrity..."];
        const lineIds = ['line2', 'line3', 'line4'];
        
        const processingStatus = document.getElementById('processingStatus');
        const processingLogs = document.getElementById('processingLogs');
        const progressBar = document.getElementById('progressBar');
        
        let currentStep = 1; // Currently active is index 1 (Profile)
        
        function runNextStep() {
            if (currentStep >= 4) {
                // Reached the Dashboard step
                processingStatus.textContent = 'Dashboard Ready!';
                
                // Show final toast
                const toast = document.getElementById('toast');
                document.getElementById('toastMsg').textContent = 'All processing complete! Redirecting...';
                toast.classList.add('show');
                setTimeout(() => {
                    toast.classList.remove('show');
                    window.location.href = 'results.html';
                }, 2000);
                
                return;
            }
            
            // Update status text and add a new spinner log
            processingStatus.textContent = statuses[currentStep - 1];
            processingStatus.style.color = '#2563eb'; // blue
            
            // Reset progress bar slightly for visual effect
            progressBar.classList.remove('success');
            progressBar.style.width = '0%';
            
            setTimeout(() => {
                progressBar.style.width = '100%';
            }, 100);
            
            const li = document.createElement('li');
            li.innerHTML = `<div class="spinner"></div> ${statuses[currentStep - 1]}`;
            processingLogs.appendChild(li);
            
            setTimeout(() => {
                // Mark current log as success
                li.classList.add('success');
                li.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> ${statuses[currentStep - 1].replace('...', '')} - Done`;
                progressBar.classList.add('success');
                
                // Complete current step in stepper
                stepsElements[currentStep].classList.remove('active');
                const circle = stepsElements[currentStep].querySelector('.step-circle');
                circle.style.background = '#10b981';
                circle.style.color = '#fff';
                circle.style.boxShadow = 'none';
                circle.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                
                // Fill connecting line
                document.getElementById(lineIds[currentStep - 1]).style.width = '100%';
                
                // Activate next step
                currentStep++;
                stepsElements[currentStep].classList.add('active');
                
                // Go to next
                setTimeout(runNextStep, 500);
            }, delays[currentStep - 1]);
        }
        
        // Start sequence after a brief pause
        setTimeout(runNextStep, 1000);
    }
});
