import React, { useState, useEffect } from 'react';

const ReviveMiniGame = ({ onSolve }) => {
    const [problem, setProblem] = useState({ a: 0, b: 0, op: '+', answer: 0 });
    const [input, setInput] = useState('');

    useEffect(() => {
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        const ops = ['+', '-'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        const answer = op === '+' ? a + b : a - b;
        setProblem({ a, b, op, answer });
    }, []);

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
            <h2>SYSTEM FAILURE!</h2>
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
                <button type="submit">REBOOT</button>
            </form>
        </div>
    );
};

export default ReviveMiniGame;
