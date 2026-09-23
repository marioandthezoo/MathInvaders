import * as THREE from 'three';
import { glowTexture, hullTextures } from './textures';

const PARTICLES = 70;
const DEBRIS = 8;
const LIFE = 1.1;

class Explosion {
    constructor(scene) {
        this.active = false;
        this.age = 0;

        const positions = new Float32Array(PARTICLES * 3);
        const colors = new Float32Array(PARTICLES * 3);
        this.velocities = new Float32Array(PARTICLES * 3);
        this.geo = new THREE.BufferGeometry();
        this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.sparkMat = new THREE.PointsMaterial({
            size: 0.55,
            map: glowTexture(),
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        this.sparks = new THREE.Points(this.geo, this.sparkMat);
        this.sparks.frustumCulled = false;

        this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
        }));

        this.ring = new THREE.Mesh(
            new THREE.RingGeometry(0.85, 1, 48),
            new THREE.MeshBasicMaterial({
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            })
        );
        this.ring.rotation.x = -Math.PI / 2;

        const { map } = hullTextures();
        this.debrisMat = new THREE.MeshStandardMaterial({
            color: '#666', map, metalness: 0.8, roughness: 0.4,
            emissive: '#ff5a1a', emissiveIntensity: 1.5, transparent: true,
        });
        this.debris = [];
        const debrisGeo = new THREE.TetrahedronGeometry(0.22);
        for (let i = 0; i < DEBRIS; i++) {
            const d = new THREE.Mesh(debrisGeo, this.debrisMat);
            d.userData.vel = new THREE.Vector3();
            d.userData.spin = new THREE.Vector3();
            this.debris.push(d);
        }

        this.root = new THREE.Group();
        this.root.add(this.sparks, this.flash, this.ring, ...this.debris);
        this.root.visible = false;
        scene.add(this.root);
    }

    fire(position, color, scale) {
        this.active = true;
        this.age = 0;
        this.scale = scale;
        this.root.position.copy(position);
        this.root.visible = true;

        const pos = this.geo.attributes.position.array;
        const col = this.geo.attributes.color.array;
        const v = new THREE.Vector3();
        const hot = new THREE.Color('#ffd27a');
        const c = new THREE.Color();
        for (let i = 0; i < PARTICLES; i++) {
            pos[i * 3] = pos[i * 3 + 1] = pos[i * 3 + 2] = 0;
            v.randomDirection().multiplyScalar((3 + Math.random() * 9) * scale);
            this.velocities.set([v.x, v.y * 0.7, v.z], i * 3);
            c.copy(Math.random() < 0.5 ? hot : color).multiplyScalar(2.5);
            col.set([c.r, c.g, c.b], i * 3);
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.color.needsUpdate = true;

        this.flash.material.color.copy(color).lerp(new THREE.Color('#fff'), 0.5).multiplyScalar(4);
        this.ring.material.color.copy(color).multiplyScalar(3);

        for (const d of this.debris) {
            d.position.set(0, 0, 0);
            d.userData.vel.randomDirection().multiplyScalar((2 + Math.random() * 5) * scale);
            d.userData.spin.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
            d.scale.setScalar((0.5 + Math.random()) * scale);
        }
    }

    update(dt) {
        if (!this.active) return;
        this.age += dt;
        const t = this.age / LIFE;
        if (t >= 1) {
            this.active = false;
            this.root.visible = false;
            return;
        }

        const pos = this.geo.attributes.position.array;
        const drag = Math.pow(0.12, dt);
        for (let i = 0; i < PARTICLES * 3; i++) {
            this.velocities[i] *= drag;
            pos[i] += this.velocities[i] * dt;
        }
        this.geo.attributes.position.needsUpdate = true;
        this.sparkMat.opacity = 1 - t;
        this.sparkMat.size = 0.55 * this.scale * (1 - t * 0.6);

        const f = Math.max(0, 1 - t * 4);
        this.flash.scale.setScalar((2 + t * 10) * this.scale);
        this.flash.material.opacity = f;

        this.ring.scale.setScalar((0.5 + t * 7) * this.scale);
        this.ring.material.opacity = Math.max(0, 1 - t * 2);

        for (const d of this.debris) {
            d.position.addScaledVector(d.userData.vel, dt);
            d.rotation.x += d.userData.spin.x * dt;
            d.rotation.y += d.userData.spin.y * dt;
        }
        this.debrisMat.opacity = 1 - t * t;
        this.debrisMat.emissiveIntensity = 1.5 * (1 - t);
    }
}

export class Explosions {
    constructor(scene, count = 10) {
        this.pool = Array.from({ length: count }, () => new Explosion(scene));
        this.next = 0;
    }

    spawn(position, color, scale = 1) {
        const e = this.pool.find((x) => !x.active) || this.pool[this.next++ % this.pool.length];
        e.fire(position, color, scale);
    }

    update(dt) {
        this.pool.forEach((e) => e.update(dt));
    }
}
