// Welcome.tsx
import React from 'react';

function Welcome() {
    const handleLoginClick = () => {
        window.history.pushState({}, 'Login', '/login');
        window.dispatchEvent(new Event('popstate'));
    };

    return (
        <div className="bg-black min-h-screen flex flex-col">
            <header className="p-4 flex justify-end">
                <button
                    onClick={handleLoginClick}
                    className="bg-white text-black px-4 py-2 rounded-lg font-semibold hover:bg-gray-200"
                >
                    Login
                </button>
            </header>
            <main className="flex-grow flex items-center justify-center">
                <h1 className="text-white text-4xl font-bold">Welcome to Q-Client</h1>
            </main>
        </div>
    );
}

export default Welcome;
