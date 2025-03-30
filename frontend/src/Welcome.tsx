// Welcome.tsx
import React from 'react';

function Welcome() {
    const handleGoogleLogin = () => {
        window.location.href = 'http://localhost:8080/auth/google';
    };

    return (
        <div className="bg-black min-h-screen flex flex-col">
            <header className="p-4 flex justify-end">
                <button
                    onClick={handleGoogleLogin}
                    className="bg-white text-black px-4 py-2 rounded-lg font-semibold hover:bg-gray-200"
                >
                    Login with Google
                </button>
            </header>
            <main className="flex-grow flex items-center justify-center">
                <h1 className="text-white text-4xl font-bold">Welcome to Q-Client</h1>
            </main>
        </div>
    );
}

export default Welcome;
