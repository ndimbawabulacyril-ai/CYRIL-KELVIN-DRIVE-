import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://rxglpuqsvllkhngcosvy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Z2xwdXFzdmxsa2huZ2Nvc3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzg4OTAsImV4cCI6MjEwMTk1NDg5MH0.pfs-5CDXJANcOWxASXGs_43ixi7IIRd8EEYnWFPMzvc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 3D BACKGROUND ---
const canvas = document.querySelector('#bg-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.z = 30;
const particles = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({size: 0.05, color: 0xd4af37}));
scene.add(particles); // Simpifié pour l'exemple

// --- APP LOGIC ---
let currentVault = null;

// Formulaire WhatsApp
window.sendRecoveryWhatsApp = () => {
    const nom = document.getElementById('recup-nom').value;
    const vault = document.getElementById('recup-vault').value;
    const phone = document.getElementById('recup-phone').value;

    if(!nom || !vault || !phone) return alert("Remplissez tout !");

    const message = `Bonjour, j'ai oublié mon mot de passe CK Drive.\nNom: ${nom}\nCoffre: ${vault}\nMon WhatsApp: ${phone}`;
    const url = `https://wa.me/243970709671?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
    alert("Votre demande a été envoyée. Un agent vous contactera par WhatsApp.");
    closeModals();
}

async function loadVaults() {
    const { data } = await supabase.from('vaults').select('*').order('created_at', { ascending: false });
    const grid = document.getElementById('vault-grid');
    grid.innerHTML = '';
    data.forEach(v => {
        const div = document.createElement('div');
        div.className = 'vault-card';
        div.innerHTML = `<i data-lucide="lock"></i><h3>${v.name}</h3>`;
        div.onclick = () => openVault(v);
        grid.appendChild(div);
    });
    lucide.createIcons();
}

async function openVault(vault) {
    const pass = prompt(`Mot de passe pour "${vault.name}" :`);
    if(pass === vault.password) {
        currentVault = vault;
        document.getElementById('vault-view').style.display = 'flex';
        document.getElementById('current-vault-title').innerText = vault.name;
        document.getElementById('welcome-msg').innerText = `Ravi de vous revoir !`;
        loadFiles();
    } else if (pass !== null) alert("Faux !");
}

async function loadFiles() {
    const { data } = await supabase.from('files').select('*').eq('vault_id', currentVault.id);
    const container = document.getElementById('file-sections');
    container.innerHTML = '';

    const categories = {
        'Images': data.filter(f => f.file_type.startsWith('image')),
        'Vidéos': data.filter(f => f.file_type.startsWith('video')),
        'Audio': data.filter(f => f.file_type.startsWith('audio')),
        'Documents': data.filter(f => !f.file_type.startsWith('image') && !f.file_type.startsWith('video') && !f.file_type.startsWith('audio'))
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
            let media = file.file_type.startsWith('image') ? `<img src="${publicUrl}">` : `<video src="${publicUrl}"></video>`;
            if (name === 'Audio') media = `<div style="padding:20px; text-align:center"><i data-lucide="music"></i></div>`;
            if (name === 'Documents') media = `<div style="padding:20px; text-align:center"><i data-lucide="file-text"></i></div>`;

            item.innerHTML = `
                ${media}
                <button class="btn-delete" onclick="deleteFile('${file.id}', '${file.storage_path}')">X</button>
                <div class="file-info">${file.file_name}<br>${date}</div>
            `;
            grid.appendChild(item);
        });
        container.appendChild(section);
    }
    lucide.createIcons();
}

window.deleteFile = async (id, path) => {
    if(!confirm("Supprimer ce fichier ?")) return;
    await supabase.storage.from('vault-assets').remove([path]);
    await supabase.from('files').delete().eq('id', id);
    loadFiles();
}

window.handleFileUpload = async (event) => {
    const files = event.target.files;
    for(let file of files) {
        const path = `${currentVault.id}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('vault-assets').upload(path, file);
        if(!error) {
            await supabase.from('files').insert([{
                vault_id: currentVault.id, file_name: file.name, storage_path: path, file_type: file.type
            }]);
        }
    }
    loadFiles();
}

// ... Autres fonctions (closeModals, handleCreateVault, downloadAllFiles) identiques à avant ...
// N'oublie pas de les inclure ou de garder les fonctions window.xxx du code
