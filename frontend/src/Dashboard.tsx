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
            <div className="bg-gray-950 min-h-screen flex items-center justify-center">
                <div className="w-16 h-16 border-t-4 border-b-4 border-blue-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null; // Will be redirected by the useEffect above
    }

    return (
        <div className="bg-gray-950 min-h-screen text-gray-100">
            {/* Header */}
            <header className="bg-gray-900 border-b border-gray-800 shadow-lg">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">Quantum Email</h1>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                        {userPicture && (
                            <img 
                                src={userPicture} 
                                alt="Profile" 
                                className="w-8 h-8 rounded-full border border-gray-700"
                            />
                        )}
                        
                        <div className="hidden md:block">
                            {userName && (
                                <p className="text-sm font-medium">{userName}</p>
                            )}
                            {userEmail && (
                                <p className="text-xs text-gray-400">{userEmail}</p>
                            )}
                        </div>
                        
                        <button 
                            onClick={logout}
                            className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1 text-sm rounded-md transition-colors duration-200 flex items-center"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Logout
                        </button>
                    </div>
                </div>
            </header>
            
            {/* Main content */}
            <main className="container mx-auto px-4 py-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Sidebar */}
                    <div className="md:col-span-1">
                        <div className="bg-gray-900 rounded-lg shadow-xl overflow-hidden">
                            {/* User info */}
                            <div className="p-5 border-b border-gray-800 flex flex-col items-center">
                                {userPicture ? (
                                    <img 
                                        src={userPicture} 
                                        alt="Profile" 
                                        className="w-20 h-20 rounded-full border-2 border-blue-500 mb-3"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mb-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                )}
                                
                                {userName && (
                                    <p className="text-white text-lg font-semibold">{userName}</p>
                                )}
                                
                                {userEmail && (
                                    <p className="text-gray-400 text-sm">{userEmail}</p>
                                )}
                            </div>
                            
                            {/* Navigation */}
                            <nav className="p-3">
                                <ul className="space-y-1">
                                    <li>
                                        <a href="#inbox" className="flex items-center px-3 py-2 rounded-md bg-blue-600 bg-opacity-20 text-blue-400 border-l-2 border-blue-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                            </svg>
                                            Inbox
                                        </a>
                                    </li>
                                    <li>
                                        <a href="#sent" className="flex items-center px-3 py-2 rounded-md text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors duration-200">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                            Sent
                                        </a>
                                    </li>
                                    <li>
                                        <a href="#drafts" className="flex items-center px-3 py-2 rounded-md text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors duration-200">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Drafts
                                        </a>
                                    </li>
                                    <li>
                                        <a href="#quantum" className="flex items-center px-3 py-2 rounded-md text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors duration-200">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            Quantum Secured
                                        </a>
                                    </li>
                                </ul>
                            </nav>
                        </div>
                    </div>
                    
                    {/* Email content */}
                    <div className="md:col-span-3">
                        <Inbox />
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Dashboard;