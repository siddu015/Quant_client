// Login.tsx
import React from 'react';

function Login() {
    const handleGoogleLogin = () => {
        window.location.href = 'http://localhost:8080/auth/google';
    };

    return (
        <div className="bg-black min-h-screen flex items-center justify-center">
            <div className="bg-gray-800 p-8 rounded-lg shadow-md">
                <h2 className="text-white text-2xl font-bold mb-4">Login</h2>
                <button
                    onClick={handleGoogleLogin}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    Login with Google
                </button>
            </div>
        </div>
    );
}

export default Login;
