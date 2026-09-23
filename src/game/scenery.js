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

// Deep-space nebula skydome
function createSky() {
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: /* glsl */ `
            varying vec3 vDir;
            void main() {
                vDir = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`,
        fragmentShader: /* glsl */ `
            precision highp float;
            varying vec3 vDir;
            ${NOISE_GLSL}
            void main() {
                vec3 d = normalize(vDir);
                float band = exp(-pow((d.y - 0.12 + 0.35 * d.x) * 2.2, 2.0));
                float n1 = fbm(d * 2.6);
                float n2 = fbm(d * 5.5 + vec3(5.2, 1.3, 2.1));
                float n3 = fbm(d * 11.0 + vec3(1.7, 9.2, 3.3));
                vec3 col = vec3(0.004, 0.006, 0.016);
                col += vec3(0.30, 0.07, 0.38) * pow(n1, 3.0) * 1.4 * (0.35 + band);
                col += vec3(0.04, 0.20, 0.38) * pow(n2, 3.5) * 1.8 * (0.25 + band);
                col += vec3(0.95, 0.45, 0.25) * pow(n3, 6.0) * band * 0.9;
                // dark dust lanes
                col *= mix(1.0, smoothstep(0.35, 0.6, fbm(d * 7.0 + 3.0)), band * 0.7);
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

// Procedural Earth-like planet with clouds, night lights and atmosphere
function createPlanet(sunDir) {
    const group = new THREE.Group();
    const surface = new THREE.ShaderMaterial({
        uniforms: { uSun: { value: sunDir }, uTime: { value: 0 } },
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
            varying vec3 vObjN;
            varying vec3 vWorldN;
            varying vec3 vView;
            ${NOISE_GLSL}
            void main() {
                vec3 p = vObjN;
                float h = fbm(p * 2.2 + vec3(4.0));
                float lat = abs(p.y);
                vec3 ocean = mix(vec3(0.005, 0.03, 0.09), vec3(0.02, 0.10, 0.22), smoothstep(0.3, 0.52, h));
                vec3 land = mix(vec3(0.10, 0.16, 0.05), vec3(0.28, 0.22, 0.12), smoothstep(0.55, 0.72, h + fbm(p * 9.0) * 0.15));
                float isLand = smoothstep(0.52, 0.535, h);
                vec3 col = mix(ocean, land, isLand);
                col = mix(col, vec3(0.85, 0.9, 0.95), smoothstep(0.78, 0.9, lat + fbm(p * 6.0) * 0.12));
                float clouds = smoothstep(0.5, 0.78, fbm(p * 4.0 + vec3(uTime * 0.01, 0.0, 0.0)));
                float diff = dot(normalize(vWorldN), uSun);
                float day = smoothstep(-0.15, 0.25, diff);
                vec3 lit = col * max(diff, 0.0) * 1.6;
                lit = mix(lit, vec3(1.0) * max(diff, 0.0) * 1.4, clouds * 0.85);
                // specular glint on oceans
                vec3 hv = normalize(uSun + vView);
                lit += (1.0 - isLand) * (1.0 - clouds) * pow(max(dot(normalize(vWorldN), hv), 0.0), 60.0) * 0.8;
                // city lights on the night side
                float cities = isLand * smoothstep(0.62, 0.75, fbm(p * 30.0)) * (1.0 - clouds);
                vec3 night = vec3(1.0, 0.65, 0.3) * cities * 0.9;
                float fres = pow(1.0 - max(dot(normalize(vWorldN), vView), 0.0), 3.0);
                lit += vec3(0.3, 0.6, 1.0) * fres * day * 0.7;
                gl_FragColor = vec4(mix(night, lit, day), 1.0);
            }`,
    });
    const R = 120;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), surface);
    planet.rotation.z = 0.35;
    group.add(planet);

    const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.06, 96, 48),
        new THREE.ShaderMaterial({
            uniforms: { uSun: { value: sunDir } },
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
                varying vec3 vN;
                varying vec3 vView;
                void main() {
                    // back faces: dot is 0 at the outer edge, ~-0.33 where the shell meets the planet
                    float glow = pow(smoothstep(0.0, 0.34, -dot(vN, vView)), 1.6);
                    float lit = smoothstep(-0.3, 0.5, dot(vN, uSun));
                    gl_FragColor = vec4(vec3(0.25, 0.55, 1.2) * glow * (0.08 + lit), 1.0);
                }`,
        })
    );
    group.add(atmosphere);

    return { group, planet, surface };
}

export class Scenery {
    constructor(scene, sunDir) {
        this.sky = createSky();
        this.stars = createStars();
        this.dust = new SpaceDust();
        this.planet = createPlanet(sunDir);
        this.planet.group.position.set(-270, -110, -640);

        // A small distant moon
        this.moon = new THREE.Mesh(
            new THREE.SphereGeometry(10, 48, 24),
            new THREE.MeshStandardMaterial({ color: '#8d8a86', roughness: 0.95, metalness: 0, fog: false })
        );
        this.moon.position.set(140, 55, -600);

        scene.add(this.sky, this.stars, this.dust.points, this.planet.group, this.moon);
    }

    update(dt, time, speed) {
        this.dust.update(dt, speed);
        this.planet.planet.rotation.y += dt * 0.01;
        this.planet.surface.uniforms.uTime.value = time;
    }
}
