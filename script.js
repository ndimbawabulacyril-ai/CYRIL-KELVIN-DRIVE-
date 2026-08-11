import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://rxglpuqsvllkhngcosvy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Z2xwdXFzdmxsa2huZ2Nvc3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzg4OTAsImV4cCI6MjEwMTk1NDg5MH0.pfs-5CDXJANcOWxASXGs_43ixi7IIRd8EEYnWFPMzvc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 3D ---
const canvas = document.querySelector('#bg-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.z = 30;
const particlesGeo = new THREE.BufferGeometry();
const posArray = new Float32Array(1500 * 3);
for(let i=0; i < 4500; i++) posArray[i] = (Math.random() - 0.5) * 100;
particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particles = new THREE.Points(particlesGeo, new THREE.PointsMaterial({size: 0.05, color: 0xd4af37}));
scene.add(particles);
function animate() { requestAnimationFrame(animate); particles.rotation.y += 0.001; renderer.render(scene, camera); }
animate();

let currentVault = null;

window.closeModals = () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');

window.sendRecoveryWhatsApp = () => {
    const nom = document.getElementById('recup-nom').value;
    const vault = document.getElementById('recup-vault').value;
    const phone = document.getElementById('recup-phone').value;
    if(!nom || !vault || !phone) return alert("Remplissez tout !");
    const msg = `🚨 RÉCUPÉRATION DRIVE\nNom: ${nom}\nCoffre: ${vault}\nWhatsApp: ${phone}`;
    window.open(`https://wa.me/243970709671?text=${encodeURIComponent(msg)}`, '_blank');
    window.closeModals();
};

async function loadVaults() {
    const { data } = await supabase.from('vaults').select('*').order('created_at', { ascending: false });
    const grid = document.getElementById('vault-grid');
    grid.innerHTML = '';
    data?.forEach(v => {
        const div = document.createElement('div');
        div.className = 'vault-card';
        div.innerHTML = `<i data-lucide="lock"></i><h3>${v.name}</h3>`;
        div.onclick = () => openVault(v);
        grid.appendChild(div);
    });
    lucide.createIcons();
}

window.handleCreateVault = async () => {
    const name = document.getElementById('new-vault-name').value;
    const pass = document.getElementById('new-vault-pass').value;
    if(!name || !pass) return;
    const { error } = await supabase.from('vaults').insert([{ name, password: pass }]);
    if(!error) { window.closeModals(); loadVaults(); }
};

async function openVault(vault) {
    const pass = prompt(`Mot de passe pour "${vault.name}" :`);
    if(pass === vault.password) {
        currentVault = vault;
        document.getElementById('vault-view').style.display = 'flex';
        document.getElementById('current-vault-title').innerText = vault.name;
        loadFiles();
    } else if (pass !== null) alert("Incorrect.");
}

window.closeVaultView = () => { document.getElementById('vault-view').style.display = 'none'; currentVault = null; };

// FONCTIONS POUR LE LECTEUR ET TÉLÉCHARGEMENT INDIVIDUEL
window.viewMedia = (url, type) => {
    const viewer = document.getElementById('media-viewer');
    const img = document.getElementById('viewer-img');
    const vid = document.getElementById('viewer-vid');
    img.style.display = 'none';
    vid.style.display = 'none';
    if(type.startsWith('image')) {
        img.src = url;
        img.style.display = 'block';
    } else {
        vid.src = url;
        vid.style.display = 'block';
    }
    viewer.style.display = 'flex';
};

window.downloadFile = async (url, name) => {
    const resp = await fetch(url);
    const blob = await resp.blob();
    saveAs(blob, name);
};

async function loadFiles() {
    const { data } = await supabase.from('files').select('*').eq('vault_id', currentVault.id).order('created_at', {ascending: false});
    const container = document.getElementById('file-sections');
    container.innerHTML = '';
    const categories = {
        '🖼️ Images': data.filter(f => f.file_type.startsWith('image')),
        '🎥 Vidéos': data.filter(f => f.file_type.startsWith('video')),
        '📂 Documents': data.filter(f => !f.file_type.startsWith('image') && !f.file_type.startsWith('video'))
    };
    for (const [name, files] of Object.entries(categories)) {
        if(files.length === 0) continue;
        const section = document.createElement('div');
        section.className = 'file-category';
        section.innerHTML = `<h3 class="category-title">${name} (${files.length})</h3><div class="file-grid"></div>`;
        const grid = section.querySelector('.file-grid');
        files.forEach(file => {
            const { data: { publicUrl } } = supabase.storage.from('vault-assets').getPublicUrl(file.storage_path);
            const date = new Date(file.created_at).toLocaleString('fr-FR', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
            const item = document.createElement('div');
            item.className = 'file-item';
            let media = `<div onclick="viewMedia('${publicUrl}', '${file.file_type}')" style="padding:30px; text-align:center"><i data-lucide="file-text"></i></div>`;
            if(file.file_type.startsWith('image')) media = `<img src="${publicUrl}" onclick="viewMedia('${publicUrl}', '${file.file_type}')">`;
            if(file.file_type.startsWith('video')) media = `<video src="${publicUrl}" onclick="viewMedia('${publicUrl}', '${file.file_type}')"></video>`;
            
            item.innerHTML = `
                ${media}
                <button class="btn-download-single" onclick="downloadFile('${publicUrl}', '${file.file_name}')">📥</button>
                <button class="btn-delete" onclick="deleteFile('${file.id}', '${file.storage_path}')">×</button>
                <div class="file-info"><strong>${file.file_name}</strong><br>${date}</div>`;
            grid.appendChild(item);
        });
        container.appendChild(section);
    }
    lucide.createIcons();
}

window.handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    document.getElementById('upload-progress-container').style.display = 'block';
    let count = 0;
    const upload = async (file) => {
        const path = `${currentVault.id}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('vault-assets').upload(path, file);
        if(!error) await supabase.from('files').insert([{ vault_id: currentVault.id, file_name: file.name, storage_path: path, file_type: file.type }]);
        count++;
        const prog = Math.round((count / files.length) * 100);
        document.getElementById('progress-bar-fill').style.width = prog + '%';
        document.getElementById('upload-percentage').innerText = prog + '%';
    };
    await Promise.all(files.map(f => upload(f)));
    setTimeout(() => { document.getElementById('upload-progress-container').style.display = 'none'; }, 2000);
    loadFiles();
};

window.deleteFile = async (id, path) => {
    if(!confirm("Supprimer ?")) return;
    await supabase.storage.from('vault-assets').remove([path]);
    await supabase.from('files').delete().eq('id', id);
    loadFiles();
};

window.downloadAllFiles = async () => {
    const { data: files } = await supabase.from('files').select('*').eq('vault_id', currentVault.id);
    const zip = new JSZip();
    for(let f of files) {
        const { data: { publicUrl } } = supabase.storage.from('vault-assets').getPublicUrl(f.storage_path);
        const blob = await fetch(publicUrl).then(r => r.blob());
        zip.file(f.file_name, blob);
    }
    zip.generateAsync({type:"blob"}).then(c => saveAs(c, `${currentVault.name}.zip`));
};

loadVaults();
