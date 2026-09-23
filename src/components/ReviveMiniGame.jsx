import React, { useState } from 'react';

// Difficulty scales with level
function makeProblem(level) {
    const range = 10 + (level * 5);
    let a = Math.floor(Math.random() * range) + 1;
    let b = Math.floor(Math.random() * range) + 1;
    const ops = ['+', '-'];
    const op = ops[Math.floor(Math.random() * ops.length)];

    // Ensure result is not negative for subtractions
    if (op === '-' && a < b) {
        [a, b] = [b, a];
    }

    const answer = op === '+' ? a + b : a - b;
    return { a, b, op, answer };
}

const ReviveMiniGame = ({ onSolve, level = 1 }) => {
    // A fresh problem each time the popup mounts
    const [problem] = useState(() => makeProblem(level));
    const [input, setInput] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (parseInt(input) === problem.answer) {
            onSolve(true);
        } else {
            onSolve(false);
        }
    };

    return (
        <div className="overlay revive-screen">
            <div className="panel alert-panel">
                <div className="hazard-stripe" />
                <div className="alert-head">
                    <svg className="alert-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 2 1 21h22L12 2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                        <path d="M12 9v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="12" cy="17.3" r="1.2" fill="currentColor" />
                    </svg>
                    <div>
                        <div className="alert-code">ERR · SHIELDS OFFLINE</div>
                        <h2 className="alert-title">System Failure</h2>
                    </div>
                </div>
                <p className="panel-sub">Solve the equation to reboot ship systems</p>

                <div className="equation">
                    <span>{problem.a}</span>
                    <span className="eq-op">{problem.op === '-' ? '−' : '+'}</span>
                    <span>{problem.b}</span>
                    <span className="eq-op">=</span>
                    <span className="eq-q">?</span>
                </div>

                <form onSubmit={handleSubmit} className="reboot-form">
                    <input
                        type="number"
                        inputMode="numeric"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        autoFocus
                        className="math-input"
                        aria-label="Answer"
                    />
                    <button type="submit" className="glow-button danger">Reboot</button>
                </form>

                <div className="reboot-meter"><div className="reboot-meter-scan" /></div>
            </div>
        </div>
    );
};

export default ReviveMiniGame;
