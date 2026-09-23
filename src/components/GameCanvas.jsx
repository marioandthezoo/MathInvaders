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

    const goalProgress = gameState.target > 0
        ? Math.min(1, Math.max(0, gameState.current / gameState.target))
        : 0;

    return (
        <div className="game-container">
            <div ref={viewRef} className="game-view" />

            <div className="hud">
                <div className="hud-panel hud-left">
                    <div className="hud-stats">
                        <div className="stat">
                            <span className="stat-label">Goal</span>
                            <span className="stat-value goal">{gameState.target}</span>
                        </div>
                        <div className="stat-divider" />
                        <div className="stat">
                            <span className="stat-label">Total</span>
                            <span className={`stat-value total${gameState.current > gameState.target ? ' over' : ''}`}>
                                {gameState.current}
                            </span>
                        </div>
                    </div>
                    <div className="goal-meter">
                        <div className="goal-meter-fill" style={{ width: `${goalProgress * 100}%` }} />
                    </div>
                </div>
                <div className="hud-panel hud-right">
                    <div className="hud-stats">
                        <div className="stat">
                            <span className="stat-label">Mission</span>
                            <span className="stat-value">{gameState.missionsCompleted + 1}</span>
                        </div>
                        <div className="stat">
                            <span className="stat-label">Score</span>
                            <span className="stat-value score">{gameState.score.toLocaleString()}</span>
                        </div>
                        <div className="stat">
                            <span className="stat-label">Shields</span>
                            <span className="shield-pips" aria-label={`${gameState.lives} shields`}>
                                {[0, 1, 2].map(i => (
                                    <span key={i} className={`pip${i < gameState.lives ? ' on' : ''}`} />
                                ))}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {gameState.bossHP !== null && gameState.status === 'PLAYING' && (
                <div className="boss-bar">
                    <span className="boss-bar-label">Mothership</span>
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
                    <div className="panel">
                        <div className="panel-kicker">Galactic Defense Program</div>
                        <h1 className="title-text">Math<br />Invaders</h1>
                        <p className="panel-sub">Blast aliens to make their numbers add up to the goal</p>
                        <button onClick={() => engineRef.current.start()} className="glow-button">Launch Mission</button>
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
                    <div className="panel">
                        <h1 className="success-text">Mission Accomplished</h1>
                        <p className="panel-sub">Target math reached!</p>
                        <button onClick={() => window.location.reload()} className="glow-button">Replay</button>
                    </div>
                </div>
            )}

            {gameState.status === 'GAMEOVER' && (
                <div className="overlay death-screen">
                    <div className="panel">
                        <h1 className="danger-text">Ship Destroyed</h1>
                        <p className="panel-sub">Final score: {gameState.score.toLocaleString()}</p>
                        <button onClick={() => window.location.reload()} className="glow-button danger">Retry</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameCanvas;
