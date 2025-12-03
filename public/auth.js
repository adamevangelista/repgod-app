window.logout = function() {
    localStorage.removeItem('liftLogicUserID');
    localStorage.removeItem('liftLogicFirstName');
    localStorage.removeItem('liftLogicUserName');
    window.location.href = '/login';
};

const currentPath = window.location.pathname;
const userID = localStorage.getItem('liftLogicUserID');

if (!userID && !currentPath.includes('login') && !currentPath.includes('signup')) {
    window.location.href = '/login';
}