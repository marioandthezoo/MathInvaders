import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundManager } from './sound';
import { Scenery } from './scenery';
import { Explosions } from './effects';
import { createPlayerShip, createAlien, createBoss, glowSprite, GREEN, RED } from './models';
import { labelTexture, glowTexture } from './textures';

// World layout: the ship flies along z = 0 and moves on x. Aliens approach from -z.
const SPAWN_Z = -75;
const DESPAWN_Z = 16;
const BOSS_Z = -48;
const BULLET_SPEED = 75;
const ALIEN_SPEED = 5;     // units/sec per original px/frame
const SHIP_SPEED = 16;
const HIT_RADIUS = 1.25;
const SHIP_HALF_WIDTH = 1.3;
const MAX_ALIENS = 18;
const WARP_TIME = 3.4;     // seconds for a full hyperspace jump
const WARP_SWAP = 1.7;     // moment (under the flash) when the new sector appears
// Chase-cam for wide screens; a steeper, higher view for tall phone screens
const CAM_WIDE = { offset: new THREE.Vector3(0, 6.5, 12), target: new THREE.Vector3(0, 0, -16) };
const CAM_TALL = { offset: new THREE.Vector3(0, 11, 14), target: new THREE.Vector3(0, 0, -15) };

export class GameEngine {
    constructor(container, onUpdate) {
        this.container = container;
        this.onUpdate = onUpdate;
        this.sounds = new SoundManager();

        this.level = 1;
        this.missionsCompleted = 0;
        this.score = 0;
        this.target = this.generateTarget();
        this.currentNum = 0;
        this.lives = 3;
        this.status = 'START';

        this.player = { x: 0, targetX: null, movingLeft: false, movingRight: false, bank: 0 };
        this.fieldHalfWidth = 8;
        this.aliens = [];
        this.bullets = [];
        this.shake = 0;
        this.shieldFlash = 0;
        this.clock = new THREE.Clock();
        this.time = 0;

        // Boss related
        this.isBossLevel = false;
        this.bossHP = 100;
        this.bossMaxHP = 100;
        this.bossX = 0;
        this.bossZ = -140;
        this.bossDir = 1;
        this.bossHitFlash = 0;

        // Hyperspace jump between missions (null when not jumping)
        this.warpT = null;
        this.warpSwapped = false;
        this.warpAmount = 0;

        this.setupRenderer();
        this.setupScene();
        this.setupListeners();
        this.renderer.setAnimationLoop(() => this.frame());
    }

    generateTarget() {
        // Level 1 starts with 15-25, Level 2 starts with 30-50, etc.
        const base = 15 + (this.missionsCompleted * 15);
        const variancy = 10 + (this.missionsCompleted * 10);
        return Math.floor(Math.random() * variancy) + base;
    }

    // ---------- Setup ----------

    setupRenderer() {
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.touchAction = 'none';
        this.container.appendChild(renderer.domElement);
        this.renderer = renderer;
        this.canvas = renderer.domElement;
    }

    setupScene() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#010205');
        scene.fog = new THREE.FogExp2('#050814', 0.0035);
        this.scene = scene;

        // Image-based lighting for believable metal reflections
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 0.35;
        pmrem.dispose();

        this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);

        const sunDir = new THREE.Vector3(-0.55, 0.65, 0.35).normalize();
        const sun = new THREE.DirectionalLight('#fff1dc', 3.2);
        sun.position.copy(sunDir).multiplyScalar(50);
        scene.add(sun);
        const rim = new THREE.DirectionalLight('#5f8cff', 1.6); // cool back-light from deep space
        rim.position.set(3, 2, -10);
        scene.add(rim);
        const hemi = new THREE.HemisphereLight('#3a4a7a', '#0a0610', 0.6);
        scene.add(hemi);

        this.scenery = new Scenery(scene, sunDir, { sun, rim, hemi });
        this.explosions = new Explosions(scene);

        this.ship = createPlayerShip();
        scene.add(this.ship.group);

        this.boss = createBoss();
        this.boss.group.visible = false;
        scene.add(this.boss.group);

        // Shared bullet visuals
        this.bulletGeo = new THREE.CapsuleGeometry(0.07, 1.1, 4, 8);
        this.bulletGeo.rotateX(Math.PI / 2);
        this.bulletMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9ff6ff').multiplyScalar(4) });

        // Composer: scene -> bloom -> tone mapping / sRGB
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.45, 0.88);
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());

        this.precompile();

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
        this.resize();
    }

    // Compile every alien shader variant up front so the first spawn doesn't stutter
    precompile() {
        const temp = [];
        for (const positive of [true, false]) {
            for (let type = 0; type < 3; type++) {
                const m = createAlien(type, positive);
                m.group.position.set(0, 0, -30);
                temp.push(m.group);
                this.scene.add(m.group);
            }
        }
        this.boss.group.visible = true;
        this.renderer.compile(this.scene, this.camera);
        this.boss.group.visible = false;
        temp.forEach((g) => this.scene.remove(g));
    }

    setupListeners() {
        this.onKeyDown = (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') this.player.movingLeft = true;
            if (e.key === 'ArrowRight' || e.key === 'd') this.player.movingRight = true;
            if (this.player.movingLeft || this.player.movingRight) this.player.targetX = null;
            if (e.key === ' ' && this.status === 'PLAYING') {
                e.preventDefault();
                if (!e.repeat) this.shoot();
            }
        };
        this.onKeyUp = (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') this.player.movingLeft = false;
            if (e.key === 'ArrowRight' || e.key === 'd') this.player.movingRight = false;
        };
        // Touch / mouse: ship follows the finger, each press fires
        this.pointerDown = false;
        this.onPointerDown = (e) => {
            e.preventDefault();
            this.pointerDown = true;
            this.handlePointer(e);
            if (this.status === 'PLAYING') this.shoot();
        };
        this.onPointerMove = (e) => {
            if (this.pointerDown) this.handlePointer(e);
        };
        this.onPointerUp = () => {
            this.pointerDown = false;
        };

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        this.canvas.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('pointercancel', this.onPointerUp);
    }

    handlePointer(e) {
        // Project the pointer onto the ship's flight plane (y = 0)
        const rect = this.canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, this.camera);
        const hit = new THREE.Vector3();
        if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) {
            this.player.targetX = THREE.MathUtils.clamp(hit.x, -this.fieldHalfWidth, this.fieldHalfWidth);
        }
    }

    resize() {
        const { width, height } = this.container.getBoundingClientRect();
        if (!width || !height) return;
        const aspect = width / height;
        this.renderer.setSize(width, height, false);
        this.composer.setSize(width, height);
        this.bloom.resolution.set(width / 2, height / 2);

        // Blend between camera rigs by aspect, then pull back so the playfield stays wide enough
        const cam = this.camera;
        const tall = THREE.MathUtils.smoothstep(aspect, 0.55, 1.2);
        const offset = CAM_TALL.offset.clone().lerp(CAM_WIDE.offset, tall);
        this.camTarget = CAM_TALL.target.clone().lerp(CAM_WIDE.target, tall);
        cam.fov = THREE.MathUtils.lerp(56, 50, tall);
        this.baseFov = cam.fov;
        cam.aspect = aspect;
        const baseDist = offset.length();
        const halfTan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
        const wantHalfWidth = 5.2;
        const dist = Math.max(baseDist, wantHalfWidth / (halfTan * aspect));
        this.camScale = dist / baseDist;
        this.camBase = offset.multiplyScalar(this.camScale);
        cam.position.copy(this.camBase);
        cam.lookAt(this.camTarget);
        cam.updateProjectionMatrix();

        const visibleHalf = dist * 0.96 * halfTan * aspect;
        this.fieldHalfWidth = THREE.MathUtils.clamp(visibleHalf - 1.3, 3.5, 9);
        this.player.x = THREE.MathUtils.clamp(this.player.x, -this.fieldHalfWidth, this.fieldHalfWidth);
    }

    // ---------- Game flow (API used by GameCanvas) ----------

    init() {
        this.onUpdate({
            target: this.target,
            current: this.currentNum,
            lives: this.lives,
            status: this.status,
            level: this.level,
            score: this.score,
            missionsCompleted: this.missionsCompleted,
            bossHP: this.isBossLevel ? this.bossHP : null,
            bossMaxHP: this.bossMaxHP,
            sector: this.scenery.sector.name,
        });
    }

    start() {
        this.sounds.resume();
        this.sounds.startAmbience();
        this.status = 'PLAYING';
        this.onUpdate({ status: this.status, sectorAt: Date.now() });
    }

    stop() {
        this.renderer.setAnimationLoop(null);
    }

    revive() {
        this.status = 'PLAYING';
        this.lives = 1;
        // Clear anything about to ram the ship so the revive isn't wasted
        for (let i = this.aliens.length - 1; i >= 0; i--) {
            if (this.aliens[i].z > -20) this.destroyAlien(i, true);
        }
        this.sounds.playRevive();
        this.onUpdate({ status: this.status, lives: this.lives });
    }

    gameOver() {
        this.status = 'GAMEOVER';
        this.explosions.spawn(this.ship.group.position, new THREE.Color('#ff8a2a'), 2.5);
        this.ship.group.visible = false;
        this.sounds.stopAmbience();
        this.sounds.playExplosion(2.2, this.pan(this.player.x), 1.2);
        this.onUpdate({ status: 'GAMEOVER' });
    }

    // Stereo position (-1 left .. 1 right) for a point on the playfield
    pan(x) {
        return x / this.fieldHalfWidth;
    }

    shoot() {
        const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
        const glow = glowSprite(new THREE.Color('#5ff0ff'), 1.3, 1.2);
        mesh.add(glow);
        const x = this.player.x;
        mesh.position.set(x, 0.05, -1.3);
        this.scene.add(mesh);
        this.bullets.push({ x, z: -1.3, prevZ: -1.3, mesh });
        this.sounds.playShoot(this.pan(x));
    }

    // ---------- Aliens ----------

    addAlien(x, z, value, speed, type) {
        const positive = value > 0;
        const model = createAlien(type, positive);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({
            map: labelTexture(value),
            color: new THREE.Color(0.82, 0.82, 0.82), // keep under the bloom threshold
            depthTest: false,
            fog: false,
            transparent: true,
        }));
        const ls = 1.1 * Math.pow(this.camScale, 0.9);
        label.scale.set(2.6 * ls, 1.3 * ls, 1);
        label.position.y = 2.1;
        label.renderOrder = 10;
        model.group.add(label);
        model.group.position.set(x, 0, z);
        model.group.scale.setScalar(0.01);
        this.scene.add(model.group);
        this.aliens.push({
            x, z, value, speed, type,
            model,
            phase: Math.random() * Math.PI * 2,
            grow: 0,
        });
    }

    spawnAlien(dt) {
        if (this.isBossLevel) return; // No random spawns during Boss
        if (this.warpT !== null) return; // Nothing spawns mid-jump

        // Original chance was per 60fps frame; convert to a per-second rate
        const spawnChance = (0.01 + (this.level * 0.005)) * 60 * dt;
        if (Math.random() < spawnChance && this.aliens.length < 5 + this.level) {
            const isPositive = Math.random() > 0.4;
            const value = Math.floor(Math.random() * (9 + this.level)) + 1;
            const x = (Math.random() * 2 - 1) * this.fieldHalfWidth;
            const speed = (1 + Math.random() + (this.missionsCompleted * 0.3)) * ALIEN_SPEED;
            this.addAlien(x, SPAWN_Z, isPositive ? value : -value, speed, Math.floor(Math.random() * 3));
        }
    }

    spawnBossMinion(val) {
        if (this.aliens.length >= MAX_ALIENS) return;
        this.addAlien(
            this.bossX + (Math.random() * 3 - 1.5),
            this.bossZ + 7,
            val,
            (0.5 + Math.random() * 0.5) * ALIEN_SPEED,
            2
        );
    }

    removeAlien(i) {
        const a = this.aliens[i];
        this.scene.remove(a.model.group);
        a.model.group.traverse((o) => { if (o.isSprite) o.material.dispose(); });
        this.aliens.splice(i, 1);
    }

    destroyAlien(i, big = false) {
        const a = this.aliens[i];
        this.explosions.spawn(a.model.group.position, a.value > 0 ? GREEN : RED, big ? 1.4 : 1);
        this.removeAlien(i);
    }

    removeBullet(i) {
        const b = this.bullets[i];
        this.scene.remove(b.mesh);
        b.mesh.children.forEach((c) => c.material.dispose());
        this.bullets.splice(i, 1);
    }

    // ---------- Update ----------

    update(dt) {
        if (this.status !== 'PLAYING') return;

        // Boss movement: fly in (once we've arrived in the sector), then strafe side to side
        if (this.isBossLevel && this.warpT === null) {
            if (this.bossZ < BOSS_Z) this.bossZ = Math.min(BOSS_Z, this.bossZ + 25 * dt);
            const speed = (5 + this.missionsCompleted * 0.3) * dt;
            this.bossX += speed * this.bossDir;
            const limit = Math.max(1, this.fieldHalfWidth - 1);
            if (this.bossX > limit || this.bossX < -limit) {
                this.bossX = THREE.MathUtils.clamp(this.bossX, -limit, limit);
                this.bossDir *= -1;
            }
        }

        // Ship movement
        const p = this.player;
        const prevX = p.x;
        if (p.targetX !== null) {
            p.x += (p.targetX - p.x) * Math.min(1, dt * 14);
        } else {
            if (p.movingLeft) p.x -= SHIP_SPEED * dt;
            if (p.movingRight) p.x += SHIP_SPEED * dt;
        }
        p.x = THREE.MathUtils.clamp(p.x, -this.fieldHalfWidth, this.fieldHalfWidth);
        const vx = dt > 0 ? (p.x - prevX) / dt : 0;
        p.bank += (THREE.MathUtils.clamp(-vx * 0.05, -0.7, 0.7) - p.bank) * Math.min(1, dt * 8);

        // Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.prevZ = b.z;
            b.z -= BULLET_SPEED * dt;
            b.mesh.position.z = b.z;
            if (b.z < SPAWN_Z - 30) {
                this.removeBullet(i);
                continue;
            }

            // Boss hit detection
            if (this.isBossLevel && this.bossZ >= BOSS_Z - 5 &&
                Math.abs(b.x - this.bossX) < 5.5 && b.z <= this.bossZ + 6 && b.prevZ > this.bossZ - 6) {
                this.bossHP--;
                this.removeBullet(i);
                this.sounds.playBossHit(this.pan(b.x));
                this.bossHitFlash = 1;
                this.explosions.spawn(
                    new THREE.Vector3(b.x, 0.5, this.bossZ + 5),
                    new THREE.Color('#ff7a2a'),
                    0.6
                );

                // Release BOTH red and green aliens slowly
                const diff = this.target - this.currentNum;
                if (diff !== 0) {
                    this.spawnBossMinion(Math.floor(Math.random() * 5) + 1);
                    this.spawnBossMinion(-(Math.floor(Math.random() * 5) + 1));
                }

                this.onUpdate({ bossHP: this.bossHP });
                if (this.bossHP <= 0) {
                    this.explosions.spawn(new THREE.Vector3(this.bossX, 0, this.bossZ), new THREE.Color('#ff5a1a'), 5);
                    this.sounds.playExplosion(2.5, this.pan(this.bossX), 1.3);
                    this.winMission();
                    return;
                }
            }
        }

        // Aliens
        this.spawnAlien(dt);
        for (let i = this.aliens.length - 1; i >= 0; i--) {
            const a = this.aliens[i];
            const prevZ = a.z;
            a.z += a.speed * dt;

            // Collision with player (only at the ship's depth, so aliens can pass beside it)
            if (a.z > -0.9 && prevZ < 0.9 && Math.abs(a.x - p.x) < SHIP_HALF_WIDTH) {
                this.destroyAlien(i);
                this.lives--;
                this.shake = 1;
                this.shieldFlash = 1;
                this.sounds.playLose();
                this.onUpdate({ lives: this.lives, hitAt: Date.now() });
                if (this.lives <= 0) {
                    this.status = 'REVIVE';
                    this.onUpdate({ status: 'REVIVE' });
                }
                continue;
            }

            // Collision with bullets (swept along z so fast bullets can't tunnel through)
            let hit = false;
            for (let j = this.bullets.length - 1; j >= 0; j--) {
                const b = this.bullets[j];
                if (Math.abs(b.x - a.x) < HIT_RADIUS && b.z <= a.z + HIT_RADIUS && b.prevZ >= a.z - HIT_RADIUS) {
                    this.currentNum += a.value;
                    this.score += 100 * this.level;
                    this.destroyAlien(i);
                    this.removeBullet(j);
                    this.sounds.playHit(this.pan(a.x));
                    this.onUpdate({ current: this.currentNum, score: this.score });

                    if (this.currentNum === this.target) {
                        this.winMission();
                        return;
                    }
                    hit = true;
                    break;
                }
            }

            if (!hit && a.z > DESPAWN_Z) {
                this.removeAlien(i);
            }
        }
    }

    winMission() {
        this.sounds.playWin();
        this.missionsCompleted++;

        const wasBoss = this.isBossLevel;
        this.isBossLevel = !wasBoss && (this.missionsCompleted % 3 === 0);

        if (this.isBossLevel) {
            this.bossHP = 100 + (this.missionsCompleted * 10);
            this.bossMaxHP = this.bossHP;
            this.bossZ = -160;
            this.bossX = 0;
            this.target = Math.floor(Math.random() * 50) + 50;
            this.msg = "BOSS ENCOUNTER!";
        } else {
            this.level = Math.floor(this.missionsCompleted / 2) + 1;
            this.target = this.generateTarget();
            this.msg = `MISSION ${this.missionsCompleted} COMPLETE!`;
        }

        this.currentNum = 0;

        this.onUpdate({
            missionsCompleted: this.missionsCompleted,
            level: this.level,
            target: this.target,
            current: this.currentNum,
            score: this.score,
            msg: this.msg,
            isBoss: this.isBossLevel,
            bossHP: this.isBossLevel ? this.bossHP : null,
            bossMaxHP: this.bossMaxHP,
        });

        // Everything left on the field goes out with a bang
        for (let i = this.aliens.length - 1; i >= 0; i--) this.destroyAlien(i);

        // Jump to the next sector of space
        this.warpT = 0;
        this.warpSwapped = false;
        this.sounds.playWarp();

        clearTimeout(this.msgTimer);
        this.msgTimer = setTimeout(() => {
            this.onUpdate({ msg: '' });
        }, 2500);
    }

    // ---------- Per-frame visuals ----------

    animate(dt) {
        const t = this.time;
        const p = this.player;

        // Ship: bank into turns, gentle hover
        const ship = this.ship;
        const w = this.warpAmount;
        ship.group.position.set(p.x, Math.sin(t * 2) * 0.08, -w * 1.5);
        ship.body.rotation.z = p.bank;
        ship.body.rotation.y = p.bank * 0.25;
        ship.body.rotation.x = Math.sin(t * 1.4) * 0.03;
        const thrust = (this.status === 'PLAYING' ? 1 : 0.6) + w * 2.5;
        ship.flames.forEach((f, i) => {
            f.material.uniforms.uTime.value = t + i;
            f.scale.set(1, 1, thrust * (0.85 + Math.random() * 0.3));
        });
        this.shieldFlash = Math.max(0, this.shieldFlash - dt * 1.5);
        ship.shield.visible = this.shieldFlash > 0;
        ship.shield.material.uniforms.uStrength.value = this.shieldFlash;

        // Aliens: pop in, bob, spin
        for (const a of this.aliens) {
            const g = a.model.group;
            a.grow = Math.min(1, a.grow + dt * 2.5);
            g.scale.setScalar(THREE.MathUtils.smootherstep(a.grow, 0, 1));
            g.position.set(a.x, Math.sin(t * 2 + a.phase) * 0.25, a.z);
            g.rotation.z = Math.sin(t * 1.3 + a.phase) * 0.12;
            if (a.type === 0) {
                a.model.spin.rotation.y += dt * 0.6;
                a.model.spin.scale.y = 1 + Math.sin(t * 4 + a.phase) * 0.12;
            } else if (a.type === 1) {
                g.rotation.y = Math.sin(t * 1.7 + a.phase) * 0.35;
            } else {
                a.model.spin.rotation.y += dt * 3;
                g.rotation.x = 0.25;
            }
        }

        // Boss
        const boss = this.boss;
        boss.group.visible = this.isBossLevel && (this.warpT === null || this.warpSwapped);
        if (this.isBossLevel) {
            boss.group.position.set(this.bossX, 2 + Math.sin(t * 0.8) * 0.4, this.bossZ);
            boss.group.rotation.z = -this.bossDir * 0.06;
            boss.ring.rotation.y += dt * 0.5;
            this.bossHitFlash = Math.max(0, this.bossHitFlash - dt * 6);
            boss.eyeMat.emissiveIntensity = 3 + Math.sin(t * 4) * 1.2 + this.bossHitFlash * 6;
            boss.hullMat.emissive.setRGB(this.bossHitFlash * 0.6, this.bossHitFlash * 0.15, 0);
        }

        // Camera: slight follow + damage shake
        const cam = this.camera;
        this.shake = Math.max(0, this.shake - dt * 2.5);
        const s = this.shake * this.shake * 0.6 + w * 0.12;
        cam.position.set(
            this.camBase.x + p.x * 0.25 + (Math.random() - 0.5) * s,
            this.camBase.y + (Math.random() - 0.5) * s,
            this.camBase.z
        );
        cam.lookAt(this.camTarget.x + p.x * 0.2, this.camTarget.y, this.camTarget.z);
        // Hyperspace: widen the lens and push the glow
        const fov = this.baseFov + w * 24;
        if (Math.abs(cam.fov - fov) > 0.01) {
            cam.fov = fov;
            cam.updateProjectionMatrix();
        }
        this.bloom.strength = 0.7 + w * 0.6;

        this.scenery.update(dt, t, (this.status === 'PLAYING' ? 45 : 20) + w * 450, w);
        this.explosions.update(dt);
    }

    updateWarp(dt) {
        if (this.warpT === null) {
            this.warpAmount = 0;
            return;
        }
        this.warpT += dt;
        const t = this.warpT;
        const up = THREE.MathUtils.smoothstep(t, 0.2, 1.4);
        const down = 1 - THREE.MathUtils.smoothstep(t, 2.0, WARP_TIME);
        this.warpAmount = Math.min(up, down);

        if (!this.warpSwapped && t >= WARP_SWAP) {
            this.warpSwapped = true;
            this.scenery.setSector(this.missionsCompleted);
            const now = Date.now();
            this.onUpdate({ sector: this.scenery.sector.name, sectorAt: now, warpFlashAt: now });
        }
        if (t >= WARP_TIME) this.warpT = null;
    }

    frame() {
        const dt = Math.min(this.clock.getDelta(), 0.05);
        this.time += dt;
        this.updateWarp(dt);
        this.update(dt);
        this.animate(dt);
        this.composer.render();
    }

    dispose() {
        this.stop();
        clearTimeout(this.msgTimer);
        this.resizeObserver.disconnect();
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        this.canvas.removeEventListener('pointerdown', this.onPointerDown);
        window.removeEventListener('pointermove', this.onPointerMove);
        window.removeEventListener('pointerup', this.onPointerUp);
        window.removeEventListener('pointercancel', this.onPointerUp);
        this.sounds.dispose();
        this.composer.dispose();
        this.renderer.dispose();
        this.canvas.remove();
    }
}

// Keep the glow texture warm so the first explosion doesn't hitch
glowTexture();
