import React, { useRef, useEffect, useState } from 'react';
import { GameEngine } from '../game/engine';
import ReviveMiniGame from './ReviveMiniGame';

const GameCanvas = () => {
    const viewRef = useRef(null);
    const engineRef = useRef(null);
    const [gameState, setGameState] = useState({
        target: 0,
        current: 0,
        lives: 3,
        score: 0,
        level: 1,
        missionsCompleted: 0,
        msg: '',
        bossHP: null,
        bossMaxHP: 100,
        hitAt: 0,
        sector: '',
        sectorAt: 0,
        warpFlashAt: 0,
        status: 'START' // START, PLAYING, REVIVE, GAMEOVER, WIN
    });

    useEffect(() => {
        const engine = new GameEngine(viewRef.current, (update) => {
            setGameState(prev => ({ ...prev, ...update }));
        });
        engineRef.current = engine;
        if (import.meta.env.DEV) window.__engine = engine;
        engine.init();

        return () => {
            engine.dispose();
            engineRef.current = null;
        };
    }, []);

    return (
        <div className="game-container">
            <div ref={viewRef} className="game-view" />

            <div className="hud">
                <div className="hud-group">
                    <div className="hud-item target-num">Goal: {gameState.target}</div>
                    <div className="hud-item current-num">Total: {gameState.current}</div>
                </div>
                <div className="hud-group">
                    <div className="hud-item missions">Mission: {gameState.missionsCompleted + 1}</div>
                    <div className="hud-item score">Score: {gameState.score}</div>
                    <div className="hud-item lives">Shields: {gameState.lives}</div>
                </div>
            </div>

            {gameState.bossHP !== null && gameState.status === 'PLAYING' && (
                <div className="boss-bar">
                    <span>MOTHERSHIP</span>
                    <div className="boss-bar-track">
                        <div
                            className="boss-bar-fill"
                            style={{ width: `${Math.max(0, gameState.bossHP / gameState.bossMaxHP) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {gameState.hitAt > 0 && <div key={`hit-${gameState.hitAt}`} className="damage-flash" />}

            {gameState.warpFlashAt > 0 && <div key={`flash-${gameState.warpFlashAt}`} className="warp-flash" />}

            {gameState.sectorAt > 0 && (
                <div key={`sector-${gameState.sectorAt}`} className="sector-banner">
                    <span className="sector-label">ENTERING SECTOR</span>
                    <span className="sector-name">{gameState.sector}</span>
                </div>
            )}

            {gameState.msg && (
                <div className="mission-msg-overlay">
                    <h2 className="mission-msg">{gameState.msg}</h2>
                </div>
            )}

            {gameState.status === 'START' && (
                <div className="overlay">
                    <div className="overlay-content">
                        <h1 className="neon-text">MATH INVADERS</h1>
                        <p>Shoot aliens to reach the goal!</p>
                        <button onClick={() => engineRef.current.start()} className="glow-button">LAUNCH MISSION</button>
                    </div>
                </div>
            )}

            {gameState.status === 'REVIVE' && (
                <ReviveMiniGame
                    level={gameState.level}
                    onSolve={(success) => {
                        if (success) {
                            engineRef.current.revive();
                        } else {
                            engineRef.current.gameOver();
                        }
                    }}
                />
            )}

            {gameState.status === 'WIN' && (
                <div className="overlay win-screen">
                    <div className="overlay-content">
                        <h1 className="success-text">MISSION ACCOMPLISHED</h1>
                        <p>Target Math Reached!</p>
                        <button onClick={() => window.location.reload()} className="glow-button">REPLAY</button>
                    </div>
                </div>
            )}

            {gameState.status === 'GAMEOVER' && (
                <div className="overlay death-screen">
                    <div className="overlay-content">
                        <h1 className="danger-text">SHIP DESTROYED</h1>
                        <p>Mission Failed.</p>
                        <button onClick={() => window.location.reload()} className="glow-button">RETRY</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameCanvas;
