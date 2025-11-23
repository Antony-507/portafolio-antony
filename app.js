// Sistema de autenticación básico
const auth = {
    isAuthenticated: false,
    
    login(username, password) {
        if ((username === 'Antony' && password === '507') || 
            (username === 'admin' && password === 'admin123')) {
            
            this.isAuthenticated = true;
            sessionStorage.setItem('usuario', username);

            if (username === 'Antony' || username === 'admin') {
                sessionStorage.setItem('role', 'Manager');
            } else {
                sessionStorage.setItem('role', 'Visitor');
            }
            return true;
        }
        return false;
    },
    
    logout() {
        this.isAuthenticated = false;
        sessionStorage.removeItem('usuario');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('guestMode');
    },
    
    checkAuth() {
        if (this.isAuthenticated) return true;
        const u = sessionStorage.getItem('usuario');
        if (u) {
            this.isAuthenticated = true;
            return true;
        }
        return false;
    }
};


// Protección de contenido
function protectContent() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());

    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
        video.setAttribute('controlslist', 'nodownload');
        video.setAttribute('oncontextmenu', 'return false;');
    });
}


// Cargar galería
function loadGallery() {

    if (!auth.checkAuth()) {  
        return;
    }

    const gallery = document.getElementById('gallery');

    const images = [
        'Recursos/file_00000000640061f5acfd89d3f55d55a3.png',
        'Recursos/Logo2.png'
    ];

    images.forEach(imgSrc => {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'gallery-item';

        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = 'Imagen del portafolio';

        imgContainer.appendChild(img);
        gallery.appendChild(imgContainer);
    });

    protectContent();
}


// Inicializar
window.addEventListener('DOMContentLoaded', loadGallery);
