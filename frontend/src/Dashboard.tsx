// Dashboard.tsx
import React, { useEffect } from 'react';
import { useAuth } from './AuthContext';
import Inbox from './components/Inbox';

function Dashboard() {
    const { isAuthenticated, userEmail, userName, userPicture, isLoading, checkAuthStatus, logout } = useAuth();

    useEffect(() => {
        // Check authentication status when component mounts
        checkAuthStatus();
    }, [checkAuthStatus]);

    useEffect(() => {
        // If not loading and not authenticated, redirect to welcome page
        if (!isLoading && !isAuthenticated) {
            window.location.href = '/';
        }
    }, [isLoading, isAuthenticated]);

    if (isLoading) {
        return (
            <div className="bg-black min-h-screen flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null; // Will be redirected by the useEffect above
    }

    return (
        <div className="bg-black min-h-screen flex flex-col items-center p-4">
            <h1 className="text-white text-4xl font-bold mb-4">Quantum Email</h1>
            
            <div className="w-full max-w-4xl flex flex-col md:flex-row gap-4">
                {/* User Profile Card */}
                <div className="bg-gray-900 rounded-lg p-6 mb-4 w-full md:w-1/3 md:mb-0">
                    {userPicture && (
                        <div className="flex justify-center mb-4">
                            <img 
                                src={userPicture} 
                                alt="Profile" 
                                className="rounded-full w-24 h-24 border-2 border-blue-500"
                            />
                        </div>
                    )}
                    
                    {userName && (
                        <p className="text-white text-2xl font-semibold text-center mb-2">{userName}</p>
                    )}
                    
                    {userEmail && (
                        <p className="text-gray-400 text-center mb-4">{userEmail}</p>
                    )}
                    
                    <div className="mt-6">
                        <button 
                            onClick={logout}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-300"
                        >
                            Logout
                        </button>
                    </div>
                </div>
                
                {/* Email Section */}
                <div className="w-full md:w-2/3">
                    <Inbox />
                </div>
            </div>
        </div>
    );
}

export default Dashboard;