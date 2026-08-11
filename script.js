import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// --- CONFIGURATION SUPABASE ---
const SUPABASE_URL = 'https://rxglpuqsvllkhngcosvy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Z2xwdXFzdmxsa2huZ2Nvc3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzg4OTAsImV4cCI6MjEwMTk1NDg5MH0.pfs-5CDXJANcOWxASXGs_43ixi7IIRd8EEYnWFPMzvc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 3D BACKGROUND ---
const canvas = document.querySelector('#bg-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.z = 30;

const particlesGeo = new THREE.BufferGeometry();
const posArray = new Float32Array(1500 * 3);
for(let i=0; i < 4500; i++) posArray[i] = (Math.random() - 0.5) * 100;
particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMat = new THREE.PointsMaterial({size: 0.05, color: 0xd4af37, transparent: true});
const particles = new THREE.Points(particlesGeo, particlesMat);
scene.add(particles);

function animate() { requestAnimationFrame(animate); particles.rotation.y += 0.0008; renderer.render(scene, camera); }
animate();

window.change3DColor = (hex) => { particlesMat.color.setHex(hex); };

// --- NAVIGATION & COFFRES ---
let currentVault = null;
let allFiles = []; 
let currentMediaIndex = 0;

window.enterApp = () => {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    loadVaults();
};

window.closeModals = () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');

window.sendRecoveryWhatsApp = () => {
    const nom = document.getElementById('recup-nom').value;
    const vault = document.getElementById('recup-vault').value;
    const msg = `🚨 RÉCUPÉRATION DRIVE\nNom: ${nom}\nCoffre: ${vault}`;
    window.open(`https://wa.me/243970709671?text=${encodeURIComponent(msg)}`, '_blank');
    window.closeModals();
};

async function loadVaults() {
    const { data } = await supabase.from('vaults').select('*').order('created_at', { ascending: false });
    const grid = document.getElementById('vault-grid');
    grid.innerHTML = '';
    data?.forEach(v => {
        grid.innerHTML += `<div class="vault-card" onclick='openVault(${JSON.stringify(v)})'><i data-lucide="lock"></i><h3>${v.name}</h3></div>`;
    });
    lucide.createIcons();
}

window.handleCreateVault = async () => {
    const name = document.getElementById('new-vault-name').value;
    const pass = document.getElementById('new-vault-pass').value;
    if(!name || !pass) return;
    await supabase.from('vaults').insert([{ name, password: pass }]);
    window.closeModals(); loadVaults();
};

window.openVault = async (vault) => {
    const pass = prompt(`Mot de passe pour "${vault.name}" :`);
    if(pass === vault.password) {
        currentVault = vault;
        document.getElementById('vault-view').style.display = 'flex';
        document.getElementById('current-vault-title').innerText = vault.name;
        loadFiles();
    } else if (pass !== null) alert("Faux.");
};

window.closeVaultView = () => { document.getElementById('vault-view').style.display = 'none'; currentVault = null; };

// --- RECHERCHE & AFFICHAGE ---
window.filterFiles = () => {
    const term = document.getElementById('search-input').value.toLowerCase();
    const filtered = allFiles.filter(f => f.file_name.toLowerCase().includes(term));
    renderFileGrid(filtered);
};

async function loadFiles() {
    const { data } = await supabase.from('files').select('*').eq('vault_id', currentVault.id).order('created_at', {ascending: false});
    allFiles = data || [];
    renderFileGrid(allFiles);
}

function renderFileGrid(files) {
    const container = document.getElementById('file-sections');
    container.innerHTML = '';
    const cats = {
        '🖼️ Images': files.filter(f => f.file_type.startsWith('image')),
        '🎥 Vidéos': files.filter(f => f.file_type.startsWith('video')),
        '📂 Documents': files.filter(f => !f.file_type.startsWith('image') && !f.file_type.startsWith('video'))
    };

    for (const [name, list] of Object.entries(cats)) {
        if(list.length === 0) continue;
        const section = document.createElement('div');
        section.className = 'file-category';
        section.innerHTML = `<h3 class="category-title">${name} (${list.length})</h3><div class="file-grid"></div>`;
        const grid = section.querySelector('.file-grid');

        list.forEach(file => {
            const { data: { publicUrl } } = supabase.storage.from('vault-assets').getPublicUrl(file.storage_path);
            const item = document.createElement('div');
            item.className = 'file-item';
            let media = `<div onclick="viewMedia(${allFiles.indexOf(file)})" style="padding:20px;text-align:center"><i data-lucide="file-text"></i></div>`;
            if(file.file_type.startsWith('image')) media = `<img src="${publicUrl}" onclick="viewMedia(${allFiles.indexOf(file)})">`;
            if(file.file_type.startsWith('video')) media = `<video src="${publicUrl}" onclick="viewMedia(${allFiles.indexOf(file)})"></video>`;
            
            item.innerHTML = `${media}<button class="btn-delete" onclick="deleteFile('${file.id}','${file.storage_path}')">×</button>`;
            grid.appendChild(item);
        });
        container.appendChild(section);
    }
    lucide.createIcons();
}

// --- LECTEUR DIAPORAMA ---
window.viewMedia = (idx) => {
    currentMediaIndex = idx;
    const file = allFiles[idx];
    const { data: { publicUrl } } = supabase.storage.from('vault-assets').getPublicUrl(file.storage_path);
    
    const viewer = document.getElementById('media-viewer');
    const img = document.getElementById('viewer-img');
    const vid = document.getElementById('viewer-vid');
    
    img.style.display = vid.style.display = 'none';
    if(file.file_type.startsWith('image')) { img.src = publicUrl; img.style.display = 'block'; }
    else { vid.src = publicUrl; vid.style.display = 'block'; }
    
    document.getElementById('viewer-download-btn').onclick = () => downloadFile(publicUrl, file.file_name);
    document.getElementById('viewer-share-btn').onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent('Regarde ce fichier CK Drive : '+publicUrl)}`);
    viewer.style.display = 'flex';
};

window.nextMedia = () => { if(currentMediaIndex < allFiles.length - 1) viewMedia(currentMediaIndex + 1); };
window.prevMedia = () => { if(currentMediaIndex > 0) viewMedia(currentMediaIndex - 1); };

// --- UPLOAD & DOWNLOAD ---
window.handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    const bar = document.getElementById('upload-progress-container');
    const fill = document.getElementById('progress-bar-fill');
    bar.style.display = 'block';
    let count = 0;

    const tasks = files.map(async (file) => {
        const path = `${currentVault.id}/${Date.now()}_${file.name}`;
        await supabase.storage.from('vault-assets').upload(path, file);
        await supabase.from('files').insert([{ vault_id: currentVault.id, file_name: file.name, storage_path: path, file_type: file.type }]);
        count++;
        fill.style.width = (count/files.length * 100) + '%';
        document.getElementById('upload-percentage').innerText = Math.round(count/files.length*100) + '%';
    });

    await Promise.all(tasks);
    setTimeout(() => { bar.style.display='none'; fill.style.width='0%'; }, 2000);
    loadFiles();
};

window.downloadFile = async (url, name) => {
    const blob = await fetch(url).then(r => r.blob());
    saveAs(blob, name);
};

window.deleteFile = async (id, path) => {
    if(confirm("Supprimer ?")) {
        await supabase.storage.from('vault-assets').remove([path]);
        await supabase.from('files').delete().eq('id', id);
        loadFiles();
    }
};

window.downloadAllFiles = async () => {
    const zip = new JSZip();
    for(let f of allFiles) {
        const { data: { publicUrl } } = supabase.storage.from('vault-assets').getPublicUrl(f.storage_path);
        const blob = await fetch(publicUrl).then(r => r.blob());
        zip.file(f.file_name, blob);
    }
    zip.generateAsync({type:"blob"}).then(c => saveAs(c, "Mon_Drive.zip"));
};
