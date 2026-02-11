import React, { useState, useEffect } from 'react';

const ReviveMiniGame = ({ onSolve, level = 1 }) => {
    const [problem, setProblem] = useState({ a: 0, b: 0, op: '+', answer: 0 });
    const [input, setInput] = useState('');

    useEffect(() => {
        // Difficulty scales with level
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
        setProblem({ a, b, op, answer });
    }, [level]);

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
            <div className="revive-content">
                <h2 className="revive-header">SYSTEM FAILURE!</h2>
                <p>Solve to reboot systems:</p>
                <div className="math-problem">
                    {problem.a} {problem.op} {problem.b} = ?
                </div>
                <form onSubmit={handleSubmit}>
                    <input
                        type="number"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        autoFocus
                        className="math-input"
                    />
                    <div className="button-container">
                        <button type="submit" className="glow-button">REBOOT</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReviveMiniGame;
