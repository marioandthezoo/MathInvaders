class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playShoot() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playHit() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playWin() {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.1);
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.1 + 0.2);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + i * 0.1);
            osc.stop(this.ctx.currentTime + i * 0.1 + 0.2);
        });
    }

    playLose() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(55, this.ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }
}

export class GameEngine {
    constructor(canvas, onUpdate) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onUpdate = onUpdate;
        this.animationId = null;
        this.sounds = new SoundManager();

        this.player = {
            x: canvas.width / 2,
            y: canvas.height - 60,
            width: 40,
            height: 40,
            speed: 6,
            movingLeft: false,
            movingRight: false,
            bullets: []
        };

        this.aliens = [];
        this.level = 1;
        this.score = 0;
        this.target = this.generateTarget();
        this.currentNum = 0;
        this.lives = 3;
        this.status = 'START';

        this.setupListeners();
    }

    generateTarget() {
        // Range between 25 and 100
        return Math.floor(Math.random() * 76) + 25 + (this.level - 1) * 10;
    }

    setupListeners() {
        // Keyboard Listeners
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.player.movingLeft = true;
            if (e.key === 'ArrowRight') this.player.movingRight = true;
            if (e.key === ' ' && this.status === 'PLAYING') this.shoot();
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft') this.player.movingLeft = false;
            if (e.key === 'ArrowRight') this.player.movingRight = false;
        });

        // Touch Listeners (Mobile)
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleTouch(touch);
            if (this.status === 'PLAYING') this.shoot();
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleTouch(touch);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            this.player.movingLeft = false;
            this.player.movingRight = false;
        }, { passive: false });
    }

    handleTouch(touch) {
        const rect = this.canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;

        // Follow finger horizontally
        this.player.x = Math.max(30, Math.min(this.canvas.width - 30, touchX));
    }

    shoot() {
        this.player.bullets.push({
            x: this.player.x,
            y: this.player.y - 20,
            speed: 10,
            radius: 3
        });
        this.sounds.playShoot();
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.player.x = width / 2;
        this.player.y = height - 110; // Extra clearance for mobile safe areas and menus
    }

    init() {
        this.onUpdate({
            target: this.target,
            current: this.currentNum,
            lives: this.lives,
            status: this.status,
            level: this.level,
            score: this.score
        });
    }

    start() {
        this.status = 'PLAYING';
        this.onUpdate({ status: this.status });
        this.gameLoop();
    }

    stop() {
        cancelAnimationFrame(this.animationId);
    }

    spawnAlien() {
        const spawnChance = 0.01 + (this.level * 0.005);
        if (Math.random() < spawnChance && this.aliens.length < 5 + this.level) {
            const isPositive = Math.random() > 0.4;
            const value = Math.floor(Math.random() * 9) + 1;
            this.aliens.push({
                x: Math.random() * (this.canvas.width - 80) + 40,
                y: -60,
                width: 60,
                height: 60,
                speed: 1 + Math.random() + (this.level * 0.2),
                value: isPositive ? value : -value,
                color: isPositive ? '#39ff14' : '#ff0055',
                type: Math.floor(Math.random() * 3) // Different alien looks
            });
        }
    }

    update() {
        if (this.status !== 'PLAYING') return;

        // Movement
        if (this.player.movingLeft && this.player.x > 30) this.player.x -= this.player.speed;
        if (this.player.movingRight && this.player.x < this.canvas.width - 30) this.player.x += this.player.speed;

        // Bullets
        this.player.bullets.forEach((b, i) => {
            b.y -= b.speed;
            if (b.y < 0) this.player.bullets.splice(i, 1);
        });

        // Aliens
        this.spawnAlien();
        for (let i = this.aliens.length - 1; i >= 0; i--) {
            const a = this.aliens[i];
            a.y += a.speed;

            // Collision with player
            if (a.y + 30 > this.player.y - 20 &&
                Math.abs(a.x - this.player.x) < 50) {
                this.aliens.splice(i, 1);
                this.lives--;
                this.sounds.playLose();
                this.onUpdate({ lives: this.lives });
                if (this.lives <= 0) {
                    this.status = 'REVIVE';
                    this.onUpdate({ status: 'REVIVE' });
                }
                continue;
            }

            // Collision with bullets
            let hit = false;
            for (let j = this.player.bullets.length - 1; j >= 0; j--) {
                const b = this.player.bullets[j];
                if (Math.abs(b.x - a.x) < 30 && Math.abs(b.y - a.y) < 30) {
                    this.currentNum += a.value;
                    this.score += 100 * this.level;
                    this.aliens.splice(i, 1);
                    this.player.bullets.splice(j, 1);
                    this.sounds.playHit();
                    this.onUpdate({ current: this.currentNum, score: this.score });

                    if (this.currentNum === this.target) {
                        this.winMission();
                    }
                    hit = true;
                    break;
                }
            }

            if (!hit && a.y > this.canvas.height + 50) {
                this.aliens.splice(i, 1);
            }
        }
    }

    winMission() {
        this.sounds.playWin();
        this.level++;
        this.target = this.generateTarget();
        this.currentNum = 0;
        this.status = 'WIN';
        this.onUpdate({
            status: 'WIN',
            level: this.level,
            target: this.target,
            current: this.currentNum,
            score: this.score
        });
    }

    drawPlayer() {
        const { x, y } = this.player;
        this.ctx.save();
        this.ctx.translate(x, y);

        // Pixel Art Starship (Retro 80s Style)
        const pixelSize = 4;
        const color = '#00f2ff';
        const darkColor = '#0055ff';
        const highlight = '#ffffff';

        const shipMap = [
            [0, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 1, 3, 3, 1, 0, 0],
            [0, 0, 1, 3, 3, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 0],
            [1, 1, 2, 1, 1, 2, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 1, 0, 0, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 1]
        ];

        shipMap.forEach((row, rIdx) => {
            row.forEach((cell, cIdx) => {
                if (cell === 0) return;
                const px = (cIdx - 4) * pixelSize;
                const py = (rIdx - 4) * pixelSize;

                if (cell === 1) this.ctx.fillStyle = color;
                if (cell === 2) this.ctx.fillStyle = darkColor;
                if (cell === 3) this.ctx.fillStyle = highlight;

                this.ctx.fillRect(px, py, pixelSize, pixelSize);
            });
        });

        // Retro Fire
        if (this.status === 'PLAYING' && Math.random() > 0.5) {
            this.ctx.fillStyle = '#ffaa00';
            this.ctx.fillRect(-6, 16, 4, 8);
            this.ctx.fillRect(2, 16, 4, 8);
        }

        this.ctx.restore();
    }

    drawAlien(a) {
        this.ctx.save();
        this.ctx.translate(a.x, a.y);

        // Pixel Art Alien (High Contrast) - Slightly Larger
        const pixelSize = 6;
        this.ctx.fillStyle = a.color;

        let alienMap = [];
        if (a.type === 0) { // Squid
            alienMap = [
                [0, 0, 1, 1, 1, 1, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 0],
                [1, 1, 0, 1, 1, 0, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [0, 1, 0, 1, 1, 0, 1, 0],
                [1, 0, 1, 0, 0, 1, 0, 1]
            ];
        } else if (a.type === 1) { // Crab
            alienMap = [
                [0, 0, 1, 0, 0, 1, 0, 0],
                [0, 0, 0, 1, 1, 0, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 0],
                [1, 1, 0, 1, 1, 0, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [0, 1, 0, 1, 1, 0, 1, 0],
                [1, 0, 1, 0, 0, 1, 0, 1],
                [0, 1, 0, 0, 0, 0, 1, 0]
            ];
        } else { // Ghost/UFO
            alienMap = [
                [0, 1, 1, 1, 1, 1, 1, 0],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 0, 1, 1, 1, 1, 0, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 0, 1, 0, 1, 0, 1, 0]
            ];
        }

        alienMap.forEach((row, rIdx) => {
            row.forEach((cell, cIdx) => {
                if (cell === 1) {
                    const px = (cIdx - row.length / 2) * pixelSize;
                    const py = (rIdx - alienMap.length / 2) * pixelSize;
                    this.ctx.fillRect(px, py, pixelSize, pixelSize);
                }
            });
        });

        // Alien Number - Pure White with Glow for Contrast - Larger Font
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 4;
        this.ctx.font = 'bold 28px "Courier New"';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        const text = a.value > 0 ? `+${a.value}` : a.value;
        this.ctx.strokeText(text, 0, 0); // Bold black outline
        this.ctx.fillText(text, 0, 0);   // White fill
        this.ctx.shadowBlur = 0;

        this.ctx.restore();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars background
        this.ctx.fillStyle = '#fff';
        for (let i = 0; i < 50; i++) {
            const x = (Math.sin(i * 12345.67) + 1) / 2 * this.canvas.width;
            const y = ((Math.cos(i * 98765.43) + 1) / 2 * this.canvas.height + Date.now() / 20) % this.canvas.height;
            this.ctx.fillRect(x, y, 1, 1);
        }

        // Player
        this.drawPlayer();

        // Bullets
        this.ctx.fillStyle = '#fff';
        this.player.bullets.forEach(b => {
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#fff';
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });

        // Aliens
        this.aliens.forEach(a => this.drawAlien(a));
    }

    gameLoop() {
        this.update();
        this.draw();
        if (this.status === 'PLAYING') {
            this.animationId = requestAnimationFrame(() => this.gameLoop());
        }
    }

    revive() {
        this.status = 'PLAYING';
        this.lives = 1;
        this.onUpdate({ status: this.status, lives: this.lives });
        this.gameLoop();
    }

    gameOver() {
        this.status = 'GAMEOVER';
        this.onUpdate({ status: 'GAMEOVER' });
    }
}
