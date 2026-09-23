// Synthesized sound design: everything is generated with Web Audio, no sample files.
// Signal chain: voices -> (dry + reverb send) -> master compressor -> speakers
export class SoundManager {
    constructor() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.ctx = ctx;

        this.master = ctx.createGain();
        this.master.gain.value = 0.9;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.knee.value = 12;
        comp.ratio.value = 4;
        comp.attack.value = 0.003;
        comp.release.value = 0.2;
        this.master.connect(comp);
        comp.connect(ctx.destination);

        // Spacey reverb from a generated impulse response
        this.reverb = ctx.createConvolver();
        this.reverb.buffer = this.makeImpulse(2.8, 2.5);
        this.reverbSend = ctx.createGain();
        this.reverbSend.gain.value = 0.35;
        this.reverbSend.connect(this.reverb);
        this.reverb.connect(this.master);

        this.noiseBuffer = this.makeNoise(2);
        this.timers = [];
    }

    // ---------- Building blocks ----------

    makeImpulse(seconds, decay) {
        const rate = this.ctx.sampleRate;
        const len = Math.floor(rate * seconds);
        const buf = this.ctx.createBuffer(2, len, rate);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
        return buf;
    }

    makeNoise(seconds) {
        const len = Math.floor(this.ctx.sampleRate * seconds);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        return buf;
    }

    // Output node for one sound: optional stereo pan and reverb amount
    out(pan = 0, wet = 0.3) {
        const g = this.ctx.createGain();
        let tail = g;
        if (this.ctx.createStereoPanner) {
            const p = this.ctx.createStereoPanner();
            p.pan.value = Math.max(-1, Math.min(1, pan));
            g.connect(p);
            tail = p;
        }
        tail.connect(this.master);
        if (wet > 0) {
            const send = this.ctx.createGain();
            send.gain.value = wet;
            tail.connect(send);
            send.connect(this.reverbSend);
        }
        return g;
    }

    env(param, t, peak, attack, release, floor = 0.0001) {
        param.cancelScheduledValues(t);
        param.setValueAtTime(floor, t);
        param.exponentialRampToValueAtTime(peak, t + attack);
        param.exponentialRampToValueAtTime(floor, t + attack + release);
    }

    osc(type, freq, t, dur, dest) {
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.connect(dest);
        o.start(t);
        o.stop(t + dur + 0.05);
        return o;
    }

    noise(t, dur, dest) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.connect(dest);
        src.start(t, Math.random() * 0.5);
        src.stop(t + dur + 0.05);
        return src;
    }

    filter(type, freq, q = 1) {
        const f = this.ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        return f;
    }

    later(fn, ms) {
        this.timers.push(setTimeout(fn, ms));
    }

    resume() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    // ---------- Game sounds ----------

    // Plasma laser: two detuned voices diving in pitch plus a crisp transient
    playShoot(pan = 0) {
        const t = this.ctx.currentTime;
        const bus = this.out(pan * 0.6, 0.15);
        const amp = this.ctx.createGain();
        const lp = this.filter('lowpass', 6000, 2);
        lp.frequency.setValueAtTime(7000, t);
        lp.frequency.exponentialRampToValueAtTime(900, t + 0.18);
        amp.connect(lp);
        lp.connect(bus);
        this.env(amp.gain, t, 0.13, 0.004, 0.18);
        for (const detune of [-12, 12]) {
            const o = this.osc('sawtooth', 1500, t, 0.2, amp);
            o.detune.value = detune;
            o.frequency.exponentialRampToValueAtTime(220, t + 0.18);
        }
        // click transient
        const click = this.ctx.createGain();
        const hp = this.filter('highpass', 3000);
        click.connect(hp);
        hp.connect(bus);
        this.env(click.gain, t, 0.12, 0.001, 0.03);
        this.noise(t, 0.04, click);
    }

    // Alien destroyed: sub thump + filtered debris crackle + sparkly tail
    playHit(pan = 0) {
        const t = this.ctx.currentTime;
        const bus = this.out(pan * 0.6, 0.35);

        const sub = this.ctx.createGain();
        sub.connect(bus);
        this.env(sub.gain, t, 0.55, 0.005, 0.35);
        const s = this.osc('sine', 150, t, 0.4, sub);
        s.frequency.exponentialRampToValueAtTime(38, t + 0.35);

        const crackle = this.ctx.createGain();
        const lp = this.filter('lowpass', 5000, 0.8);
        lp.frequency.setValueAtTime(5000, t);
        lp.frequency.exponentialRampToValueAtTime(250, t + 0.5);
        crackle.connect(lp);
        lp.connect(bus);
        this.env(crackle.gain, t, 0.35, 0.003, 0.5);
        this.noise(t, 0.6, crackle);

        const sparkle = this.ctx.createGain();
        sparkle.connect(bus);
        this.env(sparkle.gain, t + 0.02, 0.05, 0.01, 0.4);
        this.osc('triangle', 1760 + Math.random() * 600, t + 0.02, 0.45, sparkle);
    }

    // Boss armour hit: metallic FM clang
    playBossHit(pan = 0) {
        const t = this.ctx.currentTime;
        const bus = this.out(pan * 0.5, 0.45);
        const amp = this.ctx.createGain();
        amp.connect(bus);
        this.env(amp.gain, t, 0.22, 0.002, 0.45);
        const carrier = this.osc('sine', 310, t, 0.5, amp);
        const mod = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        mod.frequency.value = 310 * 2.76;
        modGain.gain.setValueAtTime(900, t);
        modGain.gain.exponentialRampToValueAtTime(10, t + 0.4);
        mod.connect(modGain);
        modGain.connect(carrier.frequency);
        mod.start(t);
        mod.stop(t + 0.5);
        this.playExplosion(0.35, pan, 0.4);
    }

    // Deep filtered explosion with a sub-bass drop
    playExplosion(duration = 0.8, pan = 0, level = 1) {
        const t = this.ctx.currentTime;
        const bus = this.out(pan * 0.5, 0.5);

        const body = this.ctx.createGain();
        const lp = this.filter('lowpass', 2500, 0.7);
        lp.frequency.setValueAtTime(2500, t);
        lp.frequency.exponentialRampToValueAtTime(80, t + duration);
        body.connect(lp);
        lp.connect(bus);
        this.env(body.gain, t, 0.6 * level, 0.01, duration);
        this.noise(t, duration + 0.1, body);

        const sub = this.ctx.createGain();
        sub.connect(bus);
        this.env(sub.gain, t, 0.7 * level, 0.01, duration * 0.9);
        const o = this.osc('sine', 90, t, duration, sub);
        o.frequency.exponentialRampToValueAtTime(28, t + duration);
    }

    // Shield hit: distorted impact + two-tone warning
    playLose() {
        const t = this.ctx.currentTime;
        const bus = this.out(0, 0.3);

        const shaper = this.ctx.createWaveShaper();
        const curve = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) {
            const x = (i / 1023) * 2 - 1;
            curve[i] = Math.tanh(x * 4);
        }
        shaper.curve = curve;
        const amp = this.ctx.createGain();
        amp.connect(shaper);
        shaper.connect(bus);
        this.env(amp.gain, t, 0.5, 0.004, 0.4);
        const o = this.osc('sawtooth', 110, t, 0.45, amp);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.4);

        [880, 660].forEach((f, i) => {
            const g = this.ctx.createGain();
            const bp = this.filter('bandpass', f, 4);
            g.connect(bp);
            bp.connect(bus);
            const st = t + 0.12 + i * 0.14;
            this.env(g.gain, st, 0.18, 0.01, 0.12);
            this.osc('square', f, st, 0.14, g);
        });
        this.playExplosion(0.5, 0, 0.6);
    }

    // Mission complete: shimmering major-7 arpeggio over a soft pad
    playWin() {
        const t = this.ctx.currentTime;
        const bus = this.out(0, 0.6);
        const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
        notes.forEach((f, i) => {
            const st = t + i * 0.08;
            const g = this.ctx.createGain();
            g.connect(bus);
            this.env(g.gain, st, 0.12, 0.005, 0.7);
            this.osc('sine', f, st, 0.8, g);
            const shimmer = this.osc('sine', f * 2.005, st, 0.8, g);
            shimmer.detune.value = 4;
        });
        const pad = this.ctx.createGain();
        const lp = this.filter('lowpass', 1200, 0.5);
        pad.connect(lp);
        lp.connect(bus);
        pad.gain.setValueAtTime(0.0001, t);
        pad.gain.exponentialRampToValueAtTime(0.06, t + 0.3);
        pad.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
        [261.63, 329.63, 392].forEach((f) => {
            [-8, 8].forEach((d) => {
                const o = this.osc('sawtooth', f, t, 1.8, pad);
                o.detune.value = d;
            });
        });
    }

    // Revive: rising power-up sweep
    playRevive() {
        const t = this.ctx.currentTime;
        const bus = this.out(0, 0.5);
        const g = this.ctx.createGain();
        const lp = this.filter('lowpass', 400, 6);
        lp.frequency.setValueAtTime(400, t);
        lp.frequency.exponentialRampToValueAtTime(6000, t + 0.6);
        g.connect(lp);
        lp.connect(bus);
        this.env(g.gain, t, 0.12, 0.05, 0.7);
        [-10, 10].forEach((d) => {
            const o = this.osc('sawtooth', 220, t, 0.8, g);
            o.detune.value = d;
            o.frequency.exponentialRampToValueAtTime(880, t + 0.6);
        });
    }

    // Hyperspace: noise riser + climbing detuned saws, then a boom as we jump
    playWarp() {
        const t = this.ctx.currentTime;
        const bus = this.out(0, 0.4);

        const riser = this.ctx.createGain();
        const bp = this.filter('bandpass', 300, 3);
        bp.frequency.setValueAtTime(300, t);
        bp.frequency.exponentialRampToValueAtTime(6000, t + 1.6);
        riser.connect(bp);
        bp.connect(bus);
        riser.gain.setValueAtTime(0.0001, t);
        riser.gain.exponentialRampToValueAtTime(0.35, t + 1.55);
        riser.gain.exponentialRampToValueAtTime(0.0001, t + 1.75);
        this.noise(t, 1.8, riser);

        const tone = this.ctx.createGain();
        const lp = this.filter('lowpass', 400, 4);
        lp.frequency.setValueAtTime(400, t);
        lp.frequency.exponentialRampToValueAtTime(5000, t + 1.6);
        tone.connect(lp);
        lp.connect(bus);
        tone.gain.setValueAtTime(0.0001, t);
        tone.gain.exponentialRampToValueAtTime(0.08, t + 1.5);
        tone.gain.exponentialRampToValueAtTime(0.0001, t + 1.75);
        [-15, 0, 15].forEach((d) => {
            const o = this.osc('sawtooth', 70, t, 1.8, tone);
            o.detune.value = d;
            o.frequency.exponentialRampToValueAtTime(700, t + 1.6);
        });

        this.later(() => {
            this.playExplosion(1.6, 0, 0.9);
            // airy whoosh out of hyperspace
            const t2 = this.ctx.currentTime;
            const w = this.ctx.createGain();
            const f = this.filter('bandpass', 4000, 1);
            f.frequency.setValueAtTime(5000, t2);
            f.frequency.exponentialRampToValueAtTime(200, t2 + 1.5);
            w.connect(f);
            f.connect(this.out(0, 0.6));
            this.env(w.gain, t2, 0.3, 0.02, 1.5);
            this.noise(t2, 1.6, w);
        }, 1650);
    }

    // Low evolving space drone that plays under the action
    startAmbience() {
        if (this.ambience) return;
        const t = this.ctx.currentTime;
        const g = this.ctx.createGain();
        const lp = this.filter('lowpass', 300, 2);
        g.connect(lp);
        lp.connect(this.out(0, 0.8));
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 3);

        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 0.07;
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain);
        lfoGain.connect(lp.frequency);
        lfo.start(t);

        const oscs = [55, 82.41, 110.3].map((f, i) => {
            const o = this.ctx.createOscillator();
            o.type = i === 2 ? 'triangle' : 'sawtooth';
            o.frequency.value = f;
            o.detune.value = (i - 1) * 7;
            o.connect(g);
            o.start(t);
            return o;
        });
        this.ambience = { g, oscs: [...oscs, lfo] };
    }

    stopAmbience() {
        if (!this.ambience) return;
        const t = this.ctx.currentTime;
        const { g, oscs } = this.ambience;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
        oscs.forEach((o) => o.stop(t + 1.6));
        this.ambience = null;
    }

    dispose() {
        this.timers.forEach(clearTimeout);
        this.ctx.close();
    }
}
