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
        missionsCompleted: 0,
        msg: '',
        status: 'START' // START, PLAYING, REVIVE, GAMEOVER, WIN
    });

    useEffect(() => {
        if (canvasRef.current && !engineRef.current) {
            engineRef.current = new GameEngine(canvasRef.current, (update) => {
                setGameState(prev => ({ ...prev, ...update }));
            });

            const handleResize = () => {
                if (canvasRef.current && engineRef.current) {
                    const { width, height } = canvasRef.current.parentElement.getBoundingClientRect();
                    engineRef.current.resize(width, height);
                }
            };

            window.addEventListener('resize', handleResize);
            handleResize(); // Initial size
            engineRef.current.init();
        }

        return () => {
            if (engineRef.current) {
                engineRef.current.stop();
            }
            window.removeEventListener('resize', () => { });
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
                    <div className="hud-item missions">Mission: {gameState.missionsCompleted + 1}</div>
                    <div className="hud-item score">Score: {gameState.score}</div>
                    <div className="hud-item lives">Shields: {gameState.lives}</div>
                </div>
            </div>
            <canvas
                ref={canvasRef}
                style={{ display: 'block', width: '100%', height: '100%' }}
            />

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
