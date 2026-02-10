import React, { useRef, useEffect, useState } from 'react';
import { GameEngine } from '../game/engine';
import ReviveMiniGame from './ReviveMiniGame';

const GameCanvas = () => {
    const canvasRef = useRef(null);
    const engineRef = useRef(null);
    const [gameState, setGameState] = useState({
        target: 0,
        current: 0,
        lives: 3,
        score: 0,
        level: 1,
        status: 'START' // START, PLAYING, REVIVE, GAMEOVER, WIN
    });

    useEffect(() => {
        if (canvasRef.current && !engineRef.current) {
            engineRef.current = new GameEngine(canvasRef.current, (update) => {
                setGameState(prev => ({ ...prev, ...update }));
            });
            engineRef.current.init();
        }

        return () => {
            if (engineRef.current) {
                engineRef.current.stop();
            }
        };
    }, []);

    return (
        <div className="game-container">
            <div className="hud">
                <div className="hud-group">
                    <div className="hud-item target-num">Goal: {gameState.target}</div>
                    <div className="hud-item current-num">Total: {gameState.current}</div>
                </div>
                <div className="hud-group">
                    <div className="hud-item level">Mission: {gameState.level}</div>
                    <div className="hud-item score">Score: {gameState.score}</div>
                    <div className="hud-item lives">Shields: {gameState.lives}</div>
                </div>
            </div>
            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                style={{ display: 'block' }}
            />

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
                <ReviveMiniGame onSolve={(success) => {
                    if (success) {
                        engineRef.current.revive();
                    } else {
                        engineRef.current.gameOver();
                    }
                }} />
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
