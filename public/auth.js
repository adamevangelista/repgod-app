const userID = localStorage.getItem('liftLogicUserID');
const userName = localStorage.getItem('liftLogicUserName');

if (!userID || !userName) {
    window.location.href = '/login';
}

function logout() {
    localStorage.removeItem('liftLogicUserID');
    localStorage.removeItem('liftLogicUserName');
    localStorage.removeItem('liftLogicAuth');
    window.location.href = '/login';
}