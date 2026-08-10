// --- INITIALISATION 3D (Background) ---
const canvas = document.querySelector('#bg-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.z = 30;

// Particules dorées pour le style premium
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 1500;
const posArray = new Float32Array(particlesCount * 3);

for(let i=0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 100;
}
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMaterial = new THREE.PointsMaterial({ size: 0.05, color: 0xd4af37 });
const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particlesMesh);

function animate() {
    requestAnimationFrame(animate);
    particlesMesh.rotation.y += 0.001;
    particlesMesh.rotation.x += 0.0005;
    renderer.render(scene, camera);
}
animate();

// --- LOGIQUE DE L'APPLICATION ---

let vaults = JSON.parse(localStorage.getItem('ck_vaults')) || [];
let currentVault = null;

// Icônes Lucide
lucide.createIcons();

// DOM Elements
const vaultGrid = document.getElementById('vault-grid');
const modalCreate = document.getElementById('modal-create');
const btnCreateVault = document.getElementById('btn-create-vault');

btnCreateVault.onclick = () => modalCreate.style.display = 'flex';

function closeModals() {
    modalCreate.style.display = 'none';
}

// Créer un coffre
function handleCreateVault() {
    const name = document.getElementById('new-vault-name').value;
    const pass = document.getElementById('new-vault-pass').value;

    if(!name || !pass) return alert("Remplis tous les champs");

    const newVault = {
        id: Date.now(),
        name,
        password: pass,
        files: [] // Stockera des objets {name, data}
    };

    vaults.push(newVault);
    saveVaults();
    renderVaults();
    closeModals();
    document.getElementById('new-vault-name').value = '';
    document.getElementById('new-vault-pass').value = '';
}

function saveVaults() {
    localStorage.setItem('ck_vaults', JSON.stringify(vaults));
}

// Afficher les coffres
function renderVaults() {
    vaultGrid.innerHTML = '';
    vaults.forEach(v => {
        const div = document.createElement('div');
        div.className = 'vault-card';
        div.innerHTML = `
            <i data-lucide="lock"></i>
            <h3>${v.name}</h3>
        `;
        div.onclick = () => openVault(v.id);
        vaultGrid.appendChild(div);
    });
    lucide.createIcons();
}

// Ouvrir un coffre (Mot de passe)
function openVault(id) {
    const v = vaults.find(v => v.id === id);
    const pass = prompt("Entrez le mot de passe pour '" + v.name + "' :");
    
    if(pass === v.password) {
        currentVault = v;
        showVaultContent();
    } else {
        alert("Mot de passe incorrect");
    }
}

function showVaultContent() {
    const view = document.getElementById('vault-view');
    document.getElementById('current-vault-title').innerText = currentVault.name;
    view.style.display = 'flex';
    renderFiles();
}

function closeVaultView() {
    document.getElementById('vault-view').style.display = 'none';
    currentVault = null;
}

// Gestion des fichiers (Base64 pour la simulation)
function handleFileUpload(event) {
    const files = event.target.files;
    for(let file of files) {
        const reader = new FileReader();
        reader.onload = (e) => {
            currentVault.files.push({
                name: file.name,
                type: file.type,
                data: e.target.result
            });
            saveVaults();
            renderFiles();
        };
        reader.readAsDataURL(file);
    }
}

function renderFiles() {
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '';
    currentVault.files.forEach(f => {
        const div = document.createElement('div');
        div.className = 'file-item';
        if(f.type.includes('image')) {
            div.innerHTML = `<img src="${f.data}">`;
        } else {
            div.innerHTML = `<video src="${f.data}" controls></video>`;
        }
        grid.appendChild(div);
    });
}

// Télécharger tout en ZIP
async function downloadAllFiles() {
    if(currentVault.files.length === 0) return alert("Le coffre est vide");
    
    const zip = new JSZip();
    currentVault.files.forEach(f => {
        // Enlever le header Base64
        const base64Data = f.data.split(',')[1];
        zip.file(f.name, base64Data, {base64: true});
    });

    const content = await zip.generateAsync({type:"blob"});
    saveAs(content, `${currentVault.name}_archive.zip`);
}

// Initialisation
renderVaults();

// Resize 3D on window change
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
