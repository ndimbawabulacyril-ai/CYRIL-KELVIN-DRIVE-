import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// --- CONFIGURATION SUPABASE AUTO-CONFIGURÉE ---
const SUPABASE_URL = 'https://rxglpuqsvllkhngcosvy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Z2xwdXFzdmxsa2huZ2Nvc3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzg4OTAsImV4cCI6MjEwMTk1NDg5MH0.pfs-5CDXJANcOWxASXGs_43ixi7IIRd8EEYnWFPMzvc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- INITIALISATION 3D (Background) ---
const canvas = document.querySelector('#bg-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.z = 30;

const particlesGeometry = new THREE.BufferGeometry();
const posArray = new Float32Array(1500 * 3);
for(let i=0; i < 4500; i++) posArray[i] = (Math.random() - 0.5) * 100;
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMesh = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({ size: 0.08, color: 0xd4af37, transparent: true, opacity: 0.8 }));
scene.add(particlesMesh);

function animate() {
    requestAnimationFrame(animate);
    particlesMesh.rotation.y += 0.001;
    particlesMesh.rotation.x += 0.0005;
    renderer.render(scene, camera);
}
animate();

// --- LOGIQUE DRIVE ---
let currentVault = null;
lucide.createIcons();

const vaultGrid = document.getElementById('vault-grid');
const modalCreate = document.getElementById('modal-create');

// Charger les coffres au démarrage
async function loadVaults() {
    const { data, error } = await supabase.from('vaults').select('*').order('created_at', { ascending: false });
    if (error) console.error("Erreur chargement:", error);
    else renderVaults(data);
}

function renderVaults(vaults) {
    vaultGrid.innerHTML = '';
    vaults.forEach(v => {
        const div = document.createElement('div');
        div.className = 'vault-card';
        div.innerHTML = `<i data-lucide="lock"></i><h3>${v.name}</h3>`;
        div.onclick = () => openVault(v);
        vaultGrid.appendChild(div);
    });
    lucide.createIcons();
}

// Créer un coffre
window.handleCreateVault = async () => {
    const name = document.getElementById('new-vault-name').value;
    const pass = document.getElementById('new-vault-pass').value;

    if(!name || !pass) return alert("Remplis tous les champs");

    const { error } = await supabase.from('vaults').insert([{ name, password: pass }]);
    
    if (error) alert("Erreur : " + error.message);
    else {
        closeModals();
        loadVaults();
        document.getElementById('new-vault-name').value = '';
        document.getElementById('new-vault-pass').value = '';
    }
}

// Ouvrir un coffre
async function openVault(vault) {
    const pass = prompt(`Mot de passe pour "${vault.name}" :`);
    if(pass === vault.password) {
        currentVault = vault;
        document.getElementById('vault-view').style.display = 'flex';
        document.getElementById('current-vault-title').innerText = currentVault.name;
        loadFiles();
    } else {
        alert("Accès refusé.");
    }
}

// Charger les fichiers
async function loadFiles() {
    const { data, error } = await supabase.from('files').select('*').eq('vault_id', currentVault.id);
    if (error) return;
    
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '';
    data.forEach(file => {
        const { data: { publicUrl } } = supabase.storage.from('vault-assets').getPublicUrl(file.storage_path);
        const div = document.createElement('div');
        div.className = 'file-item';
        if(file.file_type.includes('image')) {
            div.innerHTML = `<img src="${publicUrl}" loading="lazy">`;
        } else {
            div.innerHTML = `<video src="${publicUrl}" controls></video>`;
        }
        grid.appendChild(div);
    });
}

// Upload vers Storage
window.handleFileUpload = async (event) => {
    const files = event.target.files;
    for(let file of files) {
        const filePath = `${currentVault.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('vault-assets').upload(filePath, file);

        if (!uploadError) {
            await supabase.from('files').insert([{
                vault_id: currentVault.id,
                file_name: file.name,
                storage_path: filePath,
                file_type: file.type
            }]);
        }
    }
    loadFiles();
}

// Téléchargement ZIP
window.downloadAllFiles = async () => {
    const { data: files } = await supabase.from('files').select('*').eq('vault_id', currentVault.id);
    if(!files || files.length === 0) return alert("Coffre vide");

    const zip = new JSZip();
    for(let file of files) {
        const { data: { publicUrl } } = supabase.storage.from('vault-assets').getPublicUrl(file.storage_path);
        const response = await fetch(publicUrl);
        const blob = await response.blob();
        zip.file(file.file_name, blob);
    }
    const content = await zip.generateAsync({type:"blob"});
    saveAs(content, `${currentVault.name}.zip`);
}

window.closeModals = () => modalCreate.style.display = 'none';
window.closeVaultView = () => document.getElementById('vault-view').style.display = 'none';
document.getElementById('btn-create-vault').onclick = () => modalCreate.style.display = 'flex';

loadVaults();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
