import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// --- 1. CONFIGURATION SUPABASE (Utilise tes identifiants) ---
const SUPABASE_URL = 'https://rxglpuqsvllkhngcosvy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Z2xwdXFzdmxsa2huZ2Nvc3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzg4OTAsImV4cCI6MjEwMTk1NDg5MH0.pfs-5CDXJANcOWxASXGs_43ixi7IIRd8EEYnWFPMzvc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. INITIALISATION 3D (Background Premium) ---
const canvas = document.querySelector('#bg-canvas');
let scene, camera, renderer, particlesMesh;

function init3D() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.position.z = 30;

    // Création de particules d'or
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 2000;
    const posArray = new Float32Array(particlesCount * 3);

    for(let i=0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 100;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xd4af37, // Couleur Or
        transparent: true,
        opacity: 0.7
    });

    particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    function animate() {
        requestAnimationFrame(animate);
        particlesMesh.rotation.y += 0.001;
        particlesMesh.rotation.x += 0.0005;
        renderer.render(scene, camera);
    }
    animate();
}

// --- 3. GESTION DES COFFRES (DATABASE) ---
let currentVault = null;

// Charger les coffres depuis Supabase
async function loadVaults() {
    console.log("Chargement des coffres...");
    const { data, error } = await supabase
        .from('vaults')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erreur de chargement:", error.message);
        return;
    }
    renderVaults(data);
}

// Afficher les coffres dans la grille
function renderVaults(vaults) {
    const vaultGrid = document.getElementById('vault-grid');
    vaultGrid.innerHTML = '';

    vaults.forEach(v => {
        const div = document.createElement('div');
        div.className = 'vault-card';
        div.innerHTML = `
            <i data-lucide="lock"></i>
            <h3>${v.name}</h3>
        `;
        div.onclick = () => openVault(v);
        vaultGrid.appendChild(div);
    });
    lucide.createIcons();
}

// Créer un nouveau coffre
window.handleCreateVault = async () => {
    const name = document.getElementById('new-vault-name').value;
    const pass = document.getElementById('new-vault-pass').value;

    if (!name || !pass) {
        alert("Veuillez remplir le nom et le mot de passe !");
        return;
    }

    const { data, error } = await supabase
        .from('vaults')
        .insert([{ name: name, password: pass }])
        .select();

    if (error) {
        alert("Erreur lors de la création : " + error.message);
    } else {
        console.log("Coffre créé !");
        window.closeModals();
        document.getElementById('new-vault-name').value = '';
        document.getElementById('new-vault-pass').value = '';
        loadVaults();
    }
};

// Vérifier le mot de passe et ouvrir
async function openVault(vault) {
    const pass = prompt(`Mot de passe pour le coffre "${vault.name}" :`);
    
    if (pass === vault.password) {
        currentVault = vault;
        document.getElementById('vault-view').style.display = 'flex';
        document.getElementById('current-vault-title').innerText = vault.name;
        loadFiles();
    } else if (pass !== null) {
        alert("Accès refusé : Mot de passe incorrect.");
    }
}

// --- 4. GESTION DES FICHIERS (STORAGE) ---

// Charger les fichiers du coffre ouvert
async function loadFiles() {
    const grid = document.getElementById('file-grid');
    grid.innerHTML = '<p style="color: gold;">Chargement des fichiers...</p>';

    const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('vault_id', currentVault.id);

    if (error) {
        grid.innerHTML = "Erreur lors du chargement des fichiers.";
        return;
    }

    grid.innerHTML = '';
    data.forEach(file => {
        // Récupérer l'URL publique du fichier dans le Storage
        const { data: { publicUrl } } = supabase.storage
            .from('vault-assets')
            .getPublicUrl(file.storage_path);

        const div = document.createElement('div');
        div.className = 'file-item';
        
        if (file.file_type.includes('image')) {
            div.innerHTML = `<img src="${publicUrl}" alt="${file.file_name}" loading="lazy">`;
        } else {
            div.innerHTML = `<video src="${publicUrl}" controls></video>`;
        }
        grid.appendChild(div);
    });
}

// Uploader un fichier
window.handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    for (let file of files) {
        // On crée un chemin unique : ID_COFFRE / TIMESTAMP _ NOM_FICHIER
        const filePath = `${currentVault.id}/${Date.now()}_${file.name}`;
        
        // 1. Envoyer le fichier au Bucket Supabase
        const { error: uploadError } = await supabase.storage
            .from('vault-assets')
            .upload(filePath, file);

        if (uploadError) {
            console.error("Erreur Storage:", uploadError.message);
            continue;
        }

        // 2. Enregistrer l'info dans la table 'files'
        await supabase.from('files').insert([{
            vault_id: currentVault.id,
            file_name: file.name,
            storage_path: filePath,
            file_type: file.type,
            size: file.size
        }]);
    }
    loadFiles(); // Rafraîchir l'affichage
};

// Télécharger tout en ZIP
window.downloadAllFiles = async () => {
    const { data: files } = await supabase
        .from('files')
        .select('*')
        .eq('vault_id', currentVault.id);

    if (!files || files.length === 0) {
        alert("Ce coffre est vide.");
        return;
    }

    const zip = new JSZip();
    alert("Création du ZIP en cours... veuillez patienter.");

    for (let file of files) {
        const { data: { publicUrl } } = supabase.storage.from('vault-assets').getPublicUrl(file.storage_path);
        const response = await fetch(publicUrl);
        const blob = await response.blob();
        zip.file(file.file_name, blob);
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${currentVault.name}_Drive.zip`);
};

// --- 5. INTERFACE ET INITIALISATION ---

window.closeModals = () => {
    document.getElementById('modal-create').style.display = 'none';
};

window.closeVaultView = () => {
    document.getElementById('vault-view').style.display = 'none';
    currentVault = null;
};

// Au démarrage
document.addEventListener('DOMContentLoaded', () => {
    // Bouton pour ouvrir le modal
    document.getElementById('btn-create-vault').onclick = () => {
        document.getElementById('modal-create').style.display = 'flex';
    };

    init3D();
    loadVaults();
});

// Redimensionner la 3D si on change la taille de fenêtre
window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});
