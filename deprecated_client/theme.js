// Theme management for Oblivn
// Handles dark/light mode toggle functionality

console.log('Theme.js DOMContentLoaded event triggered');

// Theme toggle functionality  
const toggleTheme = () => {
    const body = document.body;
    const themeToggle = document.getElementById('theme-toggle');
    
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        if (themeToggle) {
            themeToggle.textContent = '🌙';
        }
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
        if (themeToggle) {
            themeToggle.textContent = '☀️';
        }
        localStorage.setItem('theme', 'dark');
    }
};

// Load saved theme or default to dark
const loadTheme = () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const body = document.body;
    const themeToggle = document.getElementById('theme-toggle');
    
    if (savedTheme === 'light') {
        body.classList.add('light-theme');
        body.classList.remove('dark-theme');
        if (themeToggle) {
            themeToggle.textContent = '🌙';
        }
    } else {
        body.classList.add('dark-theme');
        body.classList.remove('light-theme');
        if (themeToggle) {
            themeToggle.textContent = '☀️';
        }
    }
};

// Initialize theme on DOM load
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
});

// 🆕 PHASE 2: ES6 Module Exports
export { toggleTheme, loadTheme };