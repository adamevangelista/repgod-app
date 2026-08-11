(function applyTheme() {
    const saved = localStorage.getItem('liftLogicTheme');
    if (saved === 'dark' || saved === 'light') {
        document.documentElement.setAttribute('data-theme', saved);
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('liftLogicTheme', next);
        });
    }
});

window.logout = async function() {
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (e) {}
    localStorage.removeItem('liftLogicUserID');
    localStorage.removeItem('liftLogicFirstName');
    localStorage.removeItem('liftLogicUserName');
    window.location.href = '/login';
};

(async function checkAuth() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('login') || currentPath.includes('signup')) return;

    try {
        const response = await fetch('/api/me');
        if (!response.ok) {
            localStorage.removeItem('liftLogicUserID');
            localStorage.removeItem('liftLogicFirstName');
            localStorage.removeItem('liftLogicUserName');
            window.location.href = '/login';
            return;
        }
        const user = await response.json();
        localStorage.setItem('liftLogicUserID', user.user_id);
        localStorage.setItem('liftLogicFirstName', user.first_name);
    } catch (e) {
        window.location.href = '/login';
    }
})();
