import * as THREE from 'three';
import { glowTexture, hullTextures } from './textures';

export const GREEN = new THREE.Color('#39ff14');
export const RED = new THREE.Color('#ff2255');
const CYAN = new THREE.Color('#00e5ff');

// ---------- Shared materials ----------

function hullMaterial(color, repeat = 1, metalness = 0.75) {
    const { map, bump } = hullTextures();
    const m = map.clone();
    const b = bump.clone();
    m.repeat.set(repeat, repeat);
    b.repeat.set(repeat, repeat);
    return new THREE.MeshStandardMaterial({
        color,
        map: m,
        bumpMap: b,
        bumpScale: 1.5,
        metalness,
        roughness: 0.38,
    });
}

function glowMaterial(color, intensity) {
    return new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: color,
        emissiveIntensity: intensity,
        metalness: 0,
        roughness: 1,
    });
}

export function glowSprite(color, scale, intensity = 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(),
        color: color.clone().multiplyScalar(intensity),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
    }));
    s.scale.setScalar(scale);
    return s;
}

// Engine exhaust: additive cone that fades from white-hot core to coloured tail
function flameMaterial(color) {
    return new THREE.ShaderMaterial({
        uniforms: { uColor: { value: color }, uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            uniform float uTime;
            varying vec2 vUv;
            void main() {
                float t = vUv.y; // 0 at nozzle, 1 at tip
                float flicker = 0.85 + 0.15 * sin(uTime * 60.0 + vUv.x * 30.0);
                vec3 col = mix(vec3(1.0, 0.95, 0.9) * 1.6, uColor * 1.8, smoothstep(0.0, 0.3, t));
                float a = pow(1.0 - t, 1.6) * flicker;
                gl_FragColor = vec4(col * a, a);
            }`,
    });
}

// ---------- Player ship ----------

export function createPlayerShip() {
    const ship = new THREE.Group();
    const body = new THREE.Group(); // tilted for banking
    ship.add(body);

    const hull = hullMaterial('#d5dce6', 1.5);
    const dark = new THREE.MeshStandardMaterial({ color: '#2b313a', metalness: 0.85, roughness: 0.3 });
    const accent = glowMaterial(CYAN, 3);

    // Fuselage (lathe, nose toward -z)
    const profile = [
        [0, -1.15], [0.26, -1.1], [0.38, -0.7], [0.37, 0.1], [0.26, 0.75], [0.1, 1.25], [0, 1.35],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const fuselageGeo = new THREE.LatheGeometry(profile, 32);
    fuselageGeo.rotateX(-Math.PI / 2);
    fuselageGeo.scale(1, 0.72, 1);
    body.add(new THREE.Mesh(fuselageGeo, hull));

    // Cockpit canopy
    const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(1, 32, 16),
        new THREE.MeshPhysicalMaterial({
            color: '#0b2a3a', metalness: 0.3, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02,
            emissive: '#0a4f66', emissiveIntensity: 0.6, envMapIntensity: 2.5,
        })
    );
    canopy.scale.set(0.2, 0.17, 0.5);
    canopy.position.set(0, 0.2, -0.3);
    body.add(canopy);

    // Swept delta wings
    const w = new THREE.Shape();
    w.moveTo(0, 0.55);
    w.lineTo(1.35, -0.45);
    w.lineTo(1.5, -0.85);
    w.lineTo(0, -0.7);
    w.lineTo(-1.5, -0.85);
    w.lineTo(-1.35, -0.45);
    w.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(w, {
        depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 2,
    });
    wingGeo.translate(0, 0, -0.025);
    wingGeo.rotateX(-Math.PI / 2);
    const wings = new THREE.Mesh(wingGeo, hull);
    wings.position.set(0, -0.06, 0.1);
    body.add(wings);

    // Glowing accent strips on the wings
    for (const s of [-1, 1]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.05), accent);
        strip.position.set(s * 0.85, 0.02, 0.35);
        strip.rotation.y = s * 0.62;
        body.add(strip);

        // Wingtip fins with nav lights
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 0.45), hull);
        fin.position.set(s * 1.45, 0.12, 0.75);
        body.add(fin);
        const nav = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 12, 8),
            glowMaterial(s < 0 ? RED : GREEN, 4)
        );
        nav.position.set(s * 1.45, 0.3, 0.6);
        body.add(nav);
        const navGlow = glowSprite(s < 0 ? RED : GREEN, 0.35, 1.0);
        navGlow.position.copy(nav.position);
        body.add(navGlow);
    }

    // Twin engines + exhaust
    const flames = [];
    for (const s of [-1, 1]) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.9, 20), dark);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(s * 0.42, -0.02, 0.8);
        body.add(pod);

        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), glowMaterial(new THREE.Color('#7fd4ff'), 2.5));
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(s * 0.42, -0.02, 1.26);
        body.add(nozzle);

        const flameGeo = new THREE.ConeGeometry(0.14, 1.4, 16, 1, true);
        flameGeo.rotateX(Math.PI / 2);
        flameGeo.translate(0, 0, 0.7);
        const flame = new THREE.Mesh(flameGeo, flameMaterial(new THREE.Color('#2a7fff')));
        flame.position.set(s * 0.42, -0.02, 1.28);
        body.add(flame);
        flames.push(flame);

        const g = glowSprite(new THREE.Color('#5ab8ff'), 0.7, 0.7);
        g.position.set(s * 0.42, -0.02, 1.4);
        body.add(g);
    }

    // Shield bubble (flashes when hit)
    const shield = new THREE.Mesh(
        new THREE.SphereGeometry(1.8, 32, 16),
        new THREE.ShaderMaterial({
            uniforms: { uStrength: { value: 0 }, uColor: { value: new THREE.Color('#4fc3ff') } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: /* glsl */ `
                varying vec3 vN;
                varying vec3 vV;
                void main() {
                    vN = normalize(normalMatrix * normal);
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    vV = normalize(-mv.xyz);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */ `
                uniform float uStrength;
                uniform vec3 uColor;
                varying vec3 vN;
                varying vec3 vV;
                void main() {
                    float f = pow(1.0 - abs(dot(vN, vV)), 2.5);
                    gl_FragColor = vec4(uColor * f * uStrength * 3.0, 1.0);
                }`,
        })
    );
    shield.scale.set(1, 0.55, 1.1);
    shield.visible = false;
    ship.add(shield);

    return { group: ship, body, flames, shield };
}

// ---------- Aliens ----------

const alienGeo = {};
function geos() {
    if (alienGeo.ready) return alienGeo;

    // Jellyfish bell
    alienGeo.bell = new THREE.SphereGeometry(0.9, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    alienGeo.bell.scale(1, 0.85, 1);
    alienGeo.core = new THREE.IcosahedronGeometry(0.38, 2);
    alienGeo.rim = new THREE.TorusGeometry(0.8, 0.06, 8, 40);
    alienGeo.rim.rotateX(Math.PI / 2);
    alienGeo.tentacles = [];
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const r = 0.55;
        const pts = [];
        for (let k = 0; k <= 6; k++) {
            const t = k / 6;
            pts.push(new THREE.Vector3(
                Math.cos(a) * r * (1 - t * 0.4) + Math.sin(t * 5 + a) * 0.12,
                -0.1 - t * 1.5,
                Math.sin(a) * r * (1 - t * 0.4) + Math.cos(t * 5 + a) * 0.12
            ));
        }
        const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.06, 6);
        // taper toward tip
        const pos = tube.attributes.position;
        const center = new THREE.Vector3();
        const p = new THREE.Vector3();
        const curve = new THREE.CatmullRomCurve3(pts);
        for (let j = 0; j < pos.count; j++) {
            const seg = Math.floor(j / 7) / 16;
            curve.getPoint(seg, center);
            p.fromBufferAttribute(pos, j).sub(center).multiplyScalar(1 - seg * 0.85).add(center);
            pos.setXYZ(j, p.x, p.y, p.z);
        }
        tube.computeVertexNormals();
        alienGeo.tentacles.push(tube);
    }

    // Armoured crab drone
    alienGeo.carapace = new THREE.IcosahedronGeometry(0.75, 1);
    alienGeo.carapace.scale(1.35, 0.62, 1.05);
    alienGeo.eye = new THREE.SphereGeometry(0.12, 16, 8);
    alienGeo.arm = new THREE.CylinderGeometry(0.09, 0.12, 0.8, 8);
    alienGeo.pincer = new THREE.ConeGeometry(0.13, 0.55, 8);
    alienGeo.spike = new THREE.ConeGeometry(0.1, 0.5, 6);

    // Saucer
    const saucerProfile = [
        [0, -0.28], [0.55, -0.32], [1.15, -0.1], [1.28, 0], [1.15, 0.1], [0.6, 0.24], [0, 0.26],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    alienGeo.saucer = new THREE.LatheGeometry(saucerProfile, 48);
    alienGeo.dome = new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    alienGeo.bulb = new THREE.SphereGeometry(0.07, 10, 6);

    alienGeo.ready = true;
    return alienGeo;
}

const alienMats = new Map();
function mats(positive) {
    if (alienMats.has(positive)) return alienMats.get(positive);
    const color = positive ? GREEN : RED;
    const m = {
        color,
        body: hullMaterial(positive ? '#7fa58a' : '#a87880', 1, 0.45),
        accent: glowMaterial(color, 3.2),
        organic: new THREE.MeshPhysicalMaterial({
            color: positive ? '#6dff9a' : '#ff6d8a',
            emissive: color,
            emissiveIntensity: 0.12,
            roughness: 0.15,
            metalness: 0,
            clearcoat: 1,
            transparent: true,
            opacity: 0.78,
            side: THREE.DoubleSide,
        }),
        glass: new THREE.MeshPhysicalMaterial({
            color: positive ? '#0f3a1a' : '#3a0f18',
            emissive: color,
            emissiveIntensity: 0.25,
            roughness: 0.05,
            metalness: 0.2,
            clearcoat: 1,
            envMapIntensity: 2,
        }),
    };
    alienMats.set(positive, m);
    return m;
}

// Returns { group, spin } where spin is the sub-object animated each frame
export function createAlien(type, positive) {
    const g = geos();
    const m = mats(positive);
    const group = new THREE.Group();
    let spin;

    if (type === 0) {
        const bell = new THREE.Mesh(g.bell, m.organic);
        const core = new THREE.Mesh(g.core, m.accent);
        core.position.y = 0.15;
        const rim = new THREE.Mesh(g.rim, m.accent);
        rim.position.y = -0.12;
        spin = new THREE.Group();
        g.tentacles.forEach((t) => spin.add(new THREE.Mesh(t, m.organic)));
        group.add(core, bell, rim, spin);
        group.position.y = 0.4;
    } else if (type === 1) {
        const shell = new THREE.Mesh(g.carapace, m.body);
        group.add(shell);
        for (const s of [-1, 1]) {
            const eye = new THREE.Mesh(g.eye, m.accent);
            eye.position.set(s * 0.28, 0.12, 0.72);
            group.add(eye);

            const arm = new THREE.Mesh(g.arm, m.body);
            arm.rotation.set(Math.PI / 2, 0, s * -0.6);
            arm.position.set(s * 1.1, -0.05, 0.35);
            group.add(arm);
            for (const k of [-1, 1]) {
                const pincer = new THREE.Mesh(g.pincer, m.body);
                pincer.rotation.set(Math.PI / 2, 0, k * 0.35);
                pincer.position.set(s * 1.3 + k * 0.1, -0.05, 0.85);
                group.add(pincer);
            }
        }
        for (let i = 0; i < 3; i++) {
            const spike = new THREE.Mesh(g.spike, m.accent);
            spike.position.set((i - 1) * 0.35, 0.45, -0.2);
            spike.rotation.x = -0.4;
            group.add(spike);
        }
        spin = shell;
    } else {
        const saucer = new THREE.Mesh(g.saucer, m.body);
        const dome = new THREE.Mesh(g.dome, m.glass);
        dome.position.y = 0.2;
        spin = new THREE.Group();
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const bulb = new THREE.Mesh(g.bulb, m.accent);
            bulb.position.set(Math.cos(a) * 1.18, 0, Math.sin(a) * 1.18);
            spin.add(bulb);
        }
        const beam = glowSprite(m.color, 1.8, 0.8);
        beam.position.y = -0.45;
        group.add(saucer, dome, spin, beam);
    }

    const halo = glowSprite(m.color, 3.2, 0.25);
    group.add(halo);
    return { group, spin };
}

// ---------- Boss mothership ----------

export function createBoss() {
    const group = new THREE.Group();
    const hull = hullMaterial('#8a7a9a', 3, 0.55);
    const dark = new THREE.MeshStandardMaterial({ color: '#1c1a22', metalness: 0.9, roughness: 0.35 });
    const red = new THREE.Color('#ff1a3c');
    const core = glowMaterial(red, 4);
    const lights = glowMaterial(new THREE.Color('#ff6a00'), 4);

    const profile = [
        [0, -1.4], [1.8, -1.6], [4.8, -0.9], [6.4, -0.2], [6.6, 0.1], [5.6, 0.55],
        [3.4, 1.1], [2.0, 1.6], [1.6, 2.0], [0, 2.1],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const saucer = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), hull);
    group.add(saucer);

    // Pulsing red "eye" dome on top
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.5, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), core);
    eye.position.y = 1.9;
    group.add(eye);
    const eyeGlow = glowSprite(red, 7, 1.2);
    eyeGlow.position.y = 2.6;
    group.add(eyeGlow);

    // Rotating outer ring studded with lights
    const ring = new THREE.Group();
    const torus = new THREE.Mesh(new THREE.TorusGeometry(7.3, 0.28, 12, 96), dark);
    torus.rotation.x = Math.PI / 2;
    ring.add(torus);
    for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6), lights);
        b.position.set(Math.cos(a) * 7.3, 0.25, Math.sin(a) * 7.3);
        ring.add(b);
    }
    group.add(ring);

    // Forward cannons
    for (const x of [-3.2, -1.2, 1.2, 3.2]) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 12), dark);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(x, -0.9, 5.2);
        group.add(barrel);
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), core);
        tip.rotation.x = Math.PI / 2;
        tip.position.set(x, -0.9, 6.32);
        group.add(tip);
    }

    // Hangar glow underneath
    const underGlow = glowSprite(red, 12, 0.6);
    underGlow.position.y = -1.8;
    group.add(underGlow);

    group.scale.setScalar(1.15);
    return { group, ring, eye, eyeMat: core, hullMat: hull };
}
