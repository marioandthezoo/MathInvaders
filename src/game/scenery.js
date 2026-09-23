import * as THREE from 'three';
import { glowTexture } from './textures';

// Shared GLSL value-noise + fbm
const NOISE_GLSL = /* glsl */ `
float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
                   mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                   mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.03;
        a *= 0.5;
    }
    return v;
}
`;

const PLANET_TYPE = { TERRAN: 0, LAVA: 1, ICE: 2, GAS: 3, TOXIC: 4 };

// Each mission takes place in a different region of space. The ship jumps
// to the next sector through hyperspace after every mission.
export const SECTORS = [
    {
        name: 'Home Orbit',
        sky: { a: '#4d1261', b: '#0a3361', c: '#f2733f', seed: [0, 0, 0], tilt: 0.35, dust: 0.7 },
        fog: '#050814', hemiSky: '#3a4a7a', hemiGround: '#0a0610', sun: '#fff1dc', rim: '#5f8cff',
        planet: {
            type: PLANET_TYPE.TERRAN, radius: 120, pos: [-270, -110, -640], tilt: 0.35, seed: 0,
            colors: ['#01081a', '#05193a', '#1a290d', '#473820'], atmo: '#4d8cff',
        },
        moon: { pos: [140, 55, -600], radius: 10, color: '#8d8a86' },
    },
    {
        name: 'Crimson Nebula',
        sky: { a: '#6b0f1a', b: '#5a2208', c: '#ffb347', seed: [7.3, 2.1, 4.4], tilt: -0.5, dust: 0.85 },
        fog: '#120406', hemiSky: '#7a3a2a', hemiGround: '#100404', sun: '#ffc9a0', rim: '#ff6a3a',
        planet: {
            type: PLANET_TYPE.LAVA, radius: 95, pos: [230, -60, -600], tilt: -0.2, seed: 3.7,
            colors: ['#1a1210', '#ff4a0a', '#ffcc33', '#000000'], atmo: '#ff5a1f',
        },
        moon: { pos: [-170, 70, -650], radius: 14, color: '#5a4a44' },
    },
    {
        name: 'Frozen Reach',
        sky: { a: '#0b3a52', b: '#1d1a5c', c: '#b8f4ff', seed: [3.3, 8.8, 1.2], tilt: 0.1, dust: 0.5 },
        fog: '#03101a', hemiSky: '#4f8aa8', hemiGround: '#050a12', sun: '#e8f6ff', rim: '#7fe0ff',
        planet: {
            type: PLANET_TYPE.ICE, radius: 110, pos: [-240, -40, -620], tilt: 0.45, seed: 9.1,
            colors: ['#d8eef8', '#8fc4e0', '#3b6f99', '#ffffff'], atmo: '#9fe8ff',
            ring: { inner: 1.4, outer: 2.3, color: '#cfe8f5' },
        },
        moon: null,
    },
    {
        name: 'Giant\'s Rim',
        sky: { a: '#4a3010', b: '#2a1640', c: '#ffd98a', seed: [5.5, 5.5, 9.9], tilt: 0.6, dust: 0.65 },
        fog: '#0d0904', hemiSky: '#7a6a4a', hemiGround: '#0a0604', sun: '#ffe7c2', rim: '#ffb870',
        planet: {
            type: PLANET_TYPE.GAS, radius: 190, pos: [260, -30, -720], tilt: -0.3, seed: 1.9,
            colors: ['#c89a62', '#7a4a26', '#efe0c0', '#b0452a'], atmo: '#ffcc88',
            ring: { inner: 1.35, outer: 2.2, color: '#d8b98a' },
        },
        moon: { pos: [-120, 40, -560], radius: 9, color: '#b0a89a' },
    },
    {
        name: 'Emerald Drift',
        sky: { a: '#0b4a2a', b: '#0a2a4a', c: '#c8ff6a', seed: [1.1, 6.6, 3.3], tilt: -0.2, dust: 0.75 },
        fog: '#03100a', hemiSky: '#3a7a5a', hemiGround: '#04100a', sun: '#f0ffe0', rim: '#5aff9a',
        planet: {
            type: PLANET_TYPE.TOXIC, radius: 105, pos: [-230, -80, -600], tilt: 0.15, seed: 6.2,
            colors: ['#0a2a10', '#1f5a18', '#4a5a10', '#8a7a20'], atmo: '#9aff5a',
        },
        moon: { pos: [180, 80, -680], radius: 12, color: '#7a8a70' },
    },
    {
        name: 'The Deep Void',
        sky: { a: '#1a0a3a', b: '#050a20', c: '#ffffff', seed: [9.4, 0.7, 7.7], tilt: 0.9, dust: 0.35 },
        fog: '#020208', hemiSky: '#2a2a5a', hemiGround: '#020208', sun: '#d8dcff', rim: '#8a7aff',
        planet: {
            type: PLANET_TYPE.GAS, radius: 150, pos: [-280, -120, -700], tilt: 0.5, seed: 4.2,
            colors: ['#2a3a8a', '#141c4a', '#7a9aff', '#4a2a8a'], atmo: '#6a8aff',
            ring: { inner: 1.5, outer: 2.6, color: '#8a9acc' },
        },
        moon: { pos: [160, 30, -560], radius: 8, color: '#6a6a80' },
    },
];

// Deep-space nebula skydome, recoloured per sector
function createSky() {
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            uColA: { value: new THREE.Color() },
            uColB: { value: new THREE.Color() },
            uColC: { value: new THREE.Color() },
            uSeed: { value: new THREE.Vector3() },
            uTilt: { value: 0.35 },
            uDust: { value: 0.7 },
        },
        vertexShader: /* glsl */ `
            varying vec3 vDir;
            void main() {
                vDir = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: /* glsl */ `
            precision highp float;
            uniform vec3 uColA;
            uniform vec3 uColB;
            uniform vec3 uColC;
            uniform vec3 uSeed;
            uniform float uTilt;
            uniform float uDust;
            varying vec3 vDir;
            ${NOISE_GLSL}
            void main() {
                vec3 d = normalize(vDir);
                vec3 q = d + uSeed;
                float band = exp(-pow((d.y - 0.12 + uTilt * d.x) * 2.2, 2.0));
                float n1 = fbm(q * 2.6);
                float n2 = fbm(q * 5.5 + vec3(5.2, 1.3, 2.1));
                float n3 = fbm(q * 11.0 + vec3(1.7, 9.2, 3.3));
                vec3 col = vec3(0.004, 0.006, 0.016);
                col += uColA * pow(n1, 3.0) * 1.4 * (0.35 + band);
                col += uColB * pow(n2, 3.5) * 1.8 * (0.25 + band);
                col += uColC * pow(n3, 6.0) * band * 0.9;
                // dark dust lanes
                col *= mix(1.0, smoothstep(0.35, 0.6, fbm(q * 7.0 + 3.0)), band * uDust);
                gl_FragColor = vec4(col, 1.0);
            }`,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), material);
    mesh.renderOrder = -10;
    mesh.frustumCulled = false;
    return mesh;
}

// Distant star field with realistic colour temperatures
function createStars(count = 3500) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const temps = [
        new THREE.Color('#9bb0ff'), new THREE.Color('#cad7ff'), new THREE.Color('#ffffff'),
        new THREE.Color('#fff4ea'), new THREE.Color('#ffd2a1'), new THREE.Color('#ffb56c'),
    ];
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
        v.randomDirection().multiplyScalar(600 + Math.random() * 200);
        positions.set([v.x, v.y, v.z], i * 3);
        const c = temps[Math.floor(Math.random() * temps.length)];
        const b = 0.4 + Math.pow(Math.random(), 4) * 2.2; // a few very bright stars
        colors.set([c.r * b, c.g * b, c.b * b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
        size: 3.2,
        map: glowTexture(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return points;
}

// Near-field space dust streaming past to sell forward motion
class SpaceDust {
    constructor(count = 400) {
        this.count = count;
        this.bounds = { x: 45, yMin: -12, yMax: 18, zMin: -160, zMax: 25 };
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) this.respawn(positions, i, true);
        this.geo = new THREE.BufferGeometry();
        this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.points = new THREE.Points(this.geo, new THREE.PointsMaterial({
            size: 0.18,
            color: new THREE.Color(0.55, 0.65, 0.85),
            map: glowTexture(),
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        }));
        this.points.frustumCulled = false;
    }

    respawn(arr, i, anywhere) {
        const b = this.bounds;
        arr[i * 3] = (Math.random() * 2 - 1) * b.x;
        arr[i * 3 + 1] = b.yMin + Math.random() * (b.yMax - b.yMin);
        arr[i * 3 + 2] = anywhere ? b.zMin + Math.random() * (b.zMax - b.zMin) : b.zMin;
    }

    update(dt, speed) {
        const arr = this.geo.attributes.position.array;
        for (let i = 0; i < this.count; i++) {
            arr[i * 3 + 2] += speed * dt;
            if (arr[i * 3 + 2] > this.bounds.zMax) this.respawn(arr, i, false);
        }
        this.geo.attributes.position.needsUpdate = true;
    }
}

// Hyperspace star streaks, only visible while jumping
class WarpStreaks {
    constructor(count = 450) {
        this.count = count;
        this.data = [];
        const positions = new Float32Array(count * 6);
        const colors = new Float32Array(count * 6);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = 4 + Math.pow(Math.random(), 0.6) * 45;
            this.data.push({ x: Math.cos(a) * r, y: 3 + Math.sin(a) * r * 0.7, z: -400 + Math.random() * 420 });
            const tint = Math.random();
            const head = new THREE.Color().setRGB(0.7 + tint * 0.3, 0.8 + tint * 0.2, 1).multiplyScalar(2.2);
            colors.set([head.r, head.g, head.b, 0, 0, 0.05], i * 6);
        }
        this.geo = new THREE.BufferGeometry();
        this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.mat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
        });
        this.lines = new THREE.LineSegments(this.geo, this.mat);
        this.lines.frustumCulled = false;
        this.lines.visible = false;
    }

    update(dt, warp) {
        this.lines.visible = warp > 0.01;
        if (!this.lines.visible) return;
        this.mat.opacity = Math.min(1, warp * 1.4);
        const speed = 120 + warp * 900;
        const len = 2 + warp * 70;
        const pos = this.geo.attributes.position.array;
        for (let i = 0; i < this.count; i++) {
            const s = this.data[i];
            s.z += speed * dt;
            if (s.z > 25) s.z -= 420;
            pos.set([s.x, s.y, s.z, s.x, s.y, s.z - len], i * 6);
        }
        this.geo.attributes.position.needsUpdate = true;
    }
}

// Procedural planet: terran, lava, ice, gas giant or toxic, driven by uniforms
function createPlanet(sunDir) {
    const group = new THREE.Group();
    const surface = new THREE.ShaderMaterial({
        uniforms: {
            uSun: { value: sunDir },
            uTime: { value: 0 },
            uType: { value: 0 },
            uSeed: { value: 0 },
            uColA: { value: new THREE.Color() },
            uColB: { value: new THREE.Color() },
            uColC: { value: new THREE.Color() },
            uColD: { value: new THREE.Color() },
            uAtmo: { value: new THREE.Color() },
        },
        vertexShader: /* glsl */ `
            varying vec3 vObjN;
            varying vec3 vWorldN;
            varying vec3 vView;
            void main() {
                vObjN = normalize(position);
                vWorldN = normalize(mat3(modelMatrix) * normal);
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vView = normalize(cameraPosition - wp.xyz);
                gl_Position = projectionMatrix * viewMatrix * wp;
            }`,
        fragmentShader: /* glsl */ `
            precision highp float;
            uniform vec3 uSun;
            uniform float uTime;
            uniform int uType;
            uniform float uSeed;
            uniform vec3 uColA;
            uniform vec3 uColB;
            uniform vec3 uColC;
            uniform vec3 uColD;
            uniform vec3 uAtmo;
            varying vec3 vObjN;
            varying vec3 vWorldN;
            varying vec3 vView;
            ${NOISE_GLSL}
            void main() {
                vec3 p = vObjN + vec3(uSeed);
                vec3 N = normalize(vWorldN);
                float diff = dot(N, uSun);
                float lambert = max(diff, 0.0);
                float day = smoothstep(-0.15, 0.25, diff);
                vec3 hv = normalize(uSun + vView);
                float spec = pow(max(dot(N, hv), 0.0), 60.0);
                vec3 lit;
                vec3 night = vec3(0.0);

                if (uType == 3) {
                    // Gas giant: turbulent latitude bands and a storm
                    float warp = fbm(p * 3.0 + vec3(uTime * 0.005, 0.0, 0.0));
                    float b = vObjN.y * 11.0 + warp * 3.0;
                    vec3 col = mix(uColA, uColB, 0.5 + 0.5 * sin(b));
                    col = mix(col, uColC, (0.5 + 0.5 * sin(b * 2.3 + 1.7)) * 0.45);
                    float storm = smoothstep(0.18, 0.0, length(vObjN - normalize(vec3(0.6, -0.25, 0.75))));
                    col = mix(col, uColD, storm * (0.6 + 0.4 * fbm(p * 12.0)));
                    lit = col * lambert * 1.5;
                } else if (uType == 1) {
                    // Lava world: dark crust split by glowing rivers
                    float h = fbm(p * 3.0);
                    float ridge = 1.0 - abs(fbm(p * 5.0) * 2.0 - 1.0);
                    float cracks = smoothstep(0.9, 0.98, ridge);
                    vec3 rock = uColA * (0.6 + h * 1.2);
                    vec3 glow = mix(uColB, uColC, cracks * 0.5) * cracks * 1.1;
                    glow += uColB * smoothstep(0.66, 0.78, h) * 0.25; // lava seas
                    lit = rock * lambert * 1.4 + glow;
                    night = glow;
                } else if (uType == 2) {
                    // Ice world: bright sheets with deep blue fractures
                    float h = fbm(p * 4.0);
                    float ridge = 1.0 - abs(fbm(p * 7.0) * 2.0 - 1.0);
                    vec3 col = mix(uColB, uColA, smoothstep(0.35, 0.65, h));
                    col = mix(col, uColC, smoothstep(0.9, 0.98, ridge) * 0.8);
                    lit = col * lambert * 1.3 + spec * 0.6;
                } else {
                    // Terran / toxic: oceans, continents, clouds
                    float h = fbm(p * 2.2 + vec3(4.0));
                    float lat = abs(vObjN.y);
                    vec3 ocean = mix(uColA, uColB, smoothstep(0.3, 0.52, h));
                    vec3 land = mix(uColC, uColD, smoothstep(0.55, 0.72, h + fbm(p * 9.0) * 0.15));
                    float isLand = smoothstep(0.52, 0.535, h);
                    vec3 col = mix(ocean, land, isLand);
                    if (uType == 0) col = mix(col, vec3(0.85, 0.9, 0.95), smoothstep(0.78, 0.9, lat + fbm(p * 6.0) * 0.12));
                    float clouds = smoothstep(0.5, 0.78, fbm(p * 4.0 + vec3(uTime * 0.01, 0.0, 0.0)));
                    vec3 cloudCol = uType == 4 ? mix(uAtmo, vec3(1.0), 0.5) : vec3(1.0);
                    lit = col * lambert * 1.6;
                    lit = mix(lit, cloudCol * lambert * 1.4, clouds * 0.85);
                    lit += (1.0 - isLand) * (1.0 - clouds) * spec * 0.8;
                    if (uType == 0) {
                        float cities = isLand * smoothstep(0.62, 0.75, fbm(p * 30.0)) * (1.0 - clouds);
                        night = vec3(1.0, 0.65, 0.3) * cities * 0.9;
                    }
                }

                float fres = pow(1.0 - max(dot(N, vView), 0.0), 3.0);
                lit += uAtmo * fres * day * 0.7;
                gl_FragColor = vec4(mix(night, lit, day), 1.0);
            }`,
    });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), surface);
    group.add(planet);

    const atmoMat = new THREE.ShaderMaterial({
        uniforms: { uSun: { value: sunDir }, uAtmo: { value: new THREE.Color() } },
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            varying vec3 vN;
            varying vec3 vView;
            void main() {
                vN = normalize(mat3(modelMatrix) * normal);
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vView = normalize(cameraPosition - wp.xyz);
                gl_Position = projectionMatrix * viewMatrix * wp;
            }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uSun;
            uniform vec3 uAtmo;
            varying vec3 vN;
            varying vec3 vView;
            void main() {
                // back faces: dot is 0 at the outer edge, ~-0.33 where the shell meets the planet
                float glow = pow(smoothstep(0.0, 0.34, -dot(vN, vView)), 1.6);
                float lit = smoothstep(-0.3, 0.5, dot(vN, uSun));
                gl_FragColor = vec4(uAtmo * 1.2 * glow * (0.08 + lit), 1.0);
            }`,
    });
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.06, 96, 48), atmoMat);
    group.add(atmosphere);

    // Optional planetary ring
    const ringMat = new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color() },
            uInner: { value: 1.4 },
            uOuter: { value: 2.3 },
            uSun: { value: sunDir },
        },
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
            varying vec3 vLocal;
            varying vec3 vWorldN;
            void main() {
                vLocal = position;
                vWorldN = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            uniform float uInner;
            uniform float uOuter;
            uniform vec3 uSun;
            varying vec3 vLocal;
            varying vec3 vWorldN;
            float h(float x) { return fract(sin(x * 91.7) * 43758.5); }
            void main() {
                float r = length(vLocal.xy);
                float t = (r - uInner) / (uOuter - uInner);
                if (t < 0.0 || t > 1.0) discard;
                float bands = 0.55 + 0.45 * sin(t * 90.0) * sin(t * 23.0 + 1.0);
                float gaps = smoothstep(0.02, 0.05, abs(t - 0.62)) * smoothstep(0.01, 0.03, abs(t - 0.3));
                float edge = smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.9, t);
                float a = bands * gaps * edge * 0.75;
                float light = 0.35 + 0.65 * abs(dot(vWorldN, uSun));
                gl_FragColor = vec4(uColor * light * 1.2, a);
            }`,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1, 3, 128, 1), ringMat);
    ring.rotation.x = -Math.PI / 2 + 0.25;
    group.add(ring);

    return { group, planet, surface, atmoMat, ring, ringMat };
}

export class Scenery {
    constructor(scene, sunDir, lights) {
        this.scene = scene;
        this.lights = lights;
        this.sky = createSky();
        this.stars = createStars();
        this.dust = new SpaceDust();
        this.warp = new WarpStreaks();
        this.planet = createPlanet(sunDir);

        this.moon = new THREE.Mesh(
            new THREE.SphereGeometry(1, 48, 24),
            new THREE.MeshStandardMaterial({ color: '#8d8a86', roughness: 0.95, metalness: 0, fog: false })
        );

        scene.add(this.sky, this.stars, this.dust.points, this.warp.lines, this.planet.group, this.moon);
        this.setSector(0);
    }

    setSector(index) {
        const s = SECTORS[index % SECTORS.length];
        this.sector = s;

        const sky = this.sky.material.uniforms;
        sky.uColA.value.set(s.sky.a);
        sky.uColB.value.set(s.sky.b);
        sky.uColC.value.set(s.sky.c);
        sky.uSeed.value.fromArray(s.sky.seed);
        sky.uTilt.value = s.sky.tilt;
        sky.uDust.value = s.sky.dust;

        const pl = s.planet;
        const u = this.planet.surface.uniforms;
        u.uType.value = pl.type;
        u.uSeed.value = pl.seed;
        [u.uColA, u.uColB, u.uColC, u.uColD].forEach((c, i) => c.value.set(pl.colors[i]));
        u.uAtmo.value.set(pl.atmo);
        this.planet.atmoMat.uniforms.uAtmo.value.set(pl.atmo);
        this.planet.group.position.fromArray(pl.pos);
        this.planet.group.scale.setScalar(pl.radius);
        this.planet.group.rotation.z = pl.tilt;
        this.planet.ring.visible = !!pl.ring;
        if (pl.ring) {
            const r = this.planet.ringMat.uniforms;
            r.uColor.value.set(pl.ring.color);
            r.uInner.value = pl.ring.inner;
            r.uOuter.value = pl.ring.outer;
        }

        this.moon.visible = !!s.moon;
        if (s.moon) {
            this.moon.position.fromArray(s.moon.pos);
            this.moon.scale.setScalar(s.moon.radius);
            this.moon.material.color.set(s.moon.color);
        }

        this.scene.fog.color.set(s.fog);
        this.lights.hemi.color.set(s.hemiSky);
        this.lights.hemi.groundColor.set(s.hemiGround);
        this.lights.sun.color.set(s.sun);
        this.lights.rim.color.set(s.rim);
        this.planetDrift = 0;
    }

    update(dt, time, speed, warp) {
        this.dust.update(dt, speed);
        this.warp.update(dt, warp);
        this.planet.planet.rotation.y += dt * 0.01;
        this.planet.surface.uniforms.uTime.value = time;

        // The ship is flying somewhere: the local planet slowly drifts closer during a mission
        this.planetDrift = Math.min(this.planetDrift + dt * 0.6, 120);
        const base = this.sector.planet.pos;
        this.planet.group.position.z = base[2] + this.planetDrift;
    }
}
