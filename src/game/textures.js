import * as THREE from 'three';

let glow = null;
export function glowTexture() {
    if (glow) return glow;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.15, 'rgba(255,255,255,0.8)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    glow = new THREE.CanvasTexture(c);
    return glow;
}

// Greebled hull plating: returns { map, bump } drawn from the same canvas
let hull = null;
export function hullTextures() {
    if (hull) return hull;
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#8c949e';
    g.fillRect(0, 0, size, size);

    // Panels of slightly varying tone
    for (let i = 0; i < 90; i++) {
        const w = 24 + Math.random() * 140;
        const h = 24 + Math.random() * 140;
        const x = Math.floor(Math.random() * size / 8) * 8;
        const y = Math.floor(Math.random() * size / 8) * 8;
        const t = 120 + Math.floor(Math.random() * 40);
        g.fillStyle = `rgb(${t},${t + 4},${t + 10})`;
        g.fillRect(x, y, w, h);
        g.strokeStyle = 'rgba(20,24,30,0.9)';
        g.lineWidth = 2;
        g.strokeRect(x + 0.5, y + 0.5, w, h);
    }
    // Rivets
    g.fillStyle = 'rgba(40,44,50,0.8)';
    for (let i = 0; i < 400; i++) {
        g.beginPath();
        g.arc(Math.random() * size, Math.random() * size, 1.3, 0, Math.PI * 2);
        g.fill();
    }
    // Grime
    for (let i = 0; i < 1500; i++) {
        g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
        g.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 10, 2 + Math.random() * 10);
    }

    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    const bump = new THREE.CanvasTexture(c);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    hull = { map, bump };
    return hull;
}

// Number badge shown above each alien
const labelCache = new Map();
export function labelTexture(value) {
    const key = String(value);
    if (labelCache.has(key)) return labelCache.get(key);

    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d');
    const positive = value > 0;
    const text = positive ? `+${value}` : `${value}`;

    // Pill backing
    const r = 50;
    g.beginPath();
    g.roundRect(18, 14, 220, 100, r);
    g.fillStyle = positive ? 'rgba(4,40,10,0.78)' : 'rgba(50,4,14,0.78)';
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = positive ? '#39ff14' : '#ff2255';
    g.stroke();

    const font = '700 66px Orbitron, "Segoe UI", Arial, sans-serif';
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#000';
    g.strokeText(text, 128, 66);
    g.fillStyle = '#fff';
    g.fillText(text, 128, 66);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    // Only cache once the web font is ready, so early badges get redrawn in Orbitron
    if (!document.fonts || document.fonts.check(font)) labelCache.set(key, tex);
    return tex;
}
