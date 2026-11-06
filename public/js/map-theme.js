document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('theme-toggle');
    const body = document.body;

    // Cargar preferencia guardada en el navegador
    if (localStorage.getItem('safemap_theme') === 'dark') {
        body.classList.add('dark-mode');
        if (themeBtn) themeBtn.innerHTML = '☀️';
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            const isDark = body.classList.contains('dark-mode');
            themeBtn.innerHTML = isDark ? '☀️' : '🌙';
            localStorage.setItem('safemap_theme', isDark ? 'dark' : 'light');
        });
    }
});