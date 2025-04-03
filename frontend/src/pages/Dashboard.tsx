// Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import Inbox from '../components/Inbox';
import ComposeEmail from '../components/ComposeEmail';
import { EmailService } from '../services/EmailService';

// Utility function to ensure Google profile URLs are properly formatted
const formatGoogleProfileUrl = (url: string | null): string | null => {
    if (!url) return null;
    
    // Handle newer Google profile URL format
    if (url.includes('googleusercontent.com')) {
        // Use a larger image size (s256-c instead of s96-c)
        const updatedUrl = url.replace(/=s\d+-c/, "=s256-c");
        // Double-check that the URL is using HTTPS
        return updatedUrl.replace(/^http:\/\//, "https://");
    }
    
    return url;
};

// Profile Image component to handle Google profile images
interface ProfileImageProps {
    src: string | null;
    size?: "small" | "large";
    alt?: string;
}

const ProfileImage: React.FC<ProfileImageProps> = ({ src, size = "small", alt = "Profile" }) => {
    const [imageError, setImageError] = useState(false);
    
    // Prepare fallback for when the image fails to load
    const handleImageError = () => {
        console.log("Image failed to load:", src);
        setImageError(true);
    };
    
    // Define size classes
    const sizeClasses = {
        small: "w-10 h-10 rounded-xl border-2 border-purple-500/30 shadow-lg",
        large: "w-20 h-20 rounded-2xl border-2 border-purple-500/30 shadow-lg mb-4"
    };
    
    // Format the image URL to ensure it works correctly
    const formattedSrc = formatGoogleProfileUrl(src);
    
    // If image failed to load or src is null, show fallback
    if (imageError || !formattedSrc) {
        return (
            <div className={sizeClasses[size === "small" ? "small" : "large"]}>
                <div className="w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className={size === "small" ? "h-5 w-5" : "h-10 w-10"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
            </div>
        );
    }
    
    // For Google profile images, we need to address several issues:
    // 1. Replace specific size parameters with larger ones
    // 2. Add proper referrer policy to prevent referrer blocking
    // 3. Add fallback handling for when images fail to load
    return (
        <img 
            src={formattedSrc} 
            alt={alt}
            className={sizeClasses[size === "small" ? "small" : "large"]}
            referrerPolicy="no-referrer"
            loading="lazy"
            crossOrigin="anonymous"
            onError={handleImageError}
        />
    );
};

function Dashboard() {
    const { isAuthenticated, userEmail, userName, userPicture, isLoading, checkAuthStatus, logout } = useAuth();
    const [activeSection, setActiveSection] = useState<'inbox' | 'sent' | 'drafts' | 'quantum'>('inbox');
    const [isComposing, setIsComposing] = useState(false);
    const [shouldRefresh, setShouldRefresh] = useState(0);

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

    const handleSendEmail = async (email: { recipient: string; subject: string; body: string }) => {
        try {
            await EmailService.sendEmail({
                recipient_email: email.recipient,
                subject: email.subject,
                body: email.body
            });
            setIsComposing(false);
            // Trigger a refresh of the emails list
            setShouldRefresh(prev => prev + 1);
        } catch (err) {
            console.error('Error sending email:', err);
            // You might want to show an error message to the user here
        }
    };

    if (isLoading) {
        return (
            <div className="bg-[#0a0b0e] min-h-screen flex items-center justify-center">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
                    <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null; // Will be redirected by the useEffect above
    }

    return (
        <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            {/* Background gradient effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20 pointer-events-none"></div>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMjEyMTIxIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-5 pointer-events-none"></div>
            
            {/* Header */}
            <header className="relative bg-gray-900/50 backdrop-blur-lg border-b border-gray-800/50 shadow-lg">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-200">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                                Quantum Mail
                            </h1>
                        </div>
                        
                        <div className="flex items-center space-x-6">
                            <div className="hidden md:flex items-center space-x-4">
                                {userPicture && (
                                    <ProfileImage src={userPicture} size="small" />
                                )}
                                <div>
                                    {userName && (
                                        <p className="text-sm font-medium text-gray-200">{userName}</p>
                                    )}
                                    {userEmail && (
                                        <p className="text-xs text-gray-400">{userEmail}</p>
                                    )}
                                </div>
                            </div>
                            
                            <button 
                                onClick={logout}
                                className="bg-gray-800/50 hover:bg-gray-700/50 text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 hover:shadow-lg hover:shadow-purple-500/10"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            
            {/* Main content */}
            <main className="container mx-auto px-4 py-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Sidebar */}
                    <div className="md:col-span-1">
                        <div className="bg-gray-900/30 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-800/50">
                            {/* User info */}
                            <div className="p-6 border-b border-gray-800/50 flex flex-col items-center">
                                {userPicture ? (
                                    <ProfileImage src={userPicture} size="large" />
                                ) : (
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                )}
                                
                                {userName && (
                                    <p className="text-lg font-semibold text-gray-200">{userName}</p>
                                )}
                                
                                {userEmail && (
                                    <p className="text-sm text-gray-400">{userEmail}</p>
                                )}
                            </div>
                            
                            {/* Navigation */}
                            <nav className="p-4">
                                <ul className="space-y-2">
                                    <li>
                                        <button
                                            onClick={() => setActiveSection('inbox')}
                                            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                                                activeSection === 'inbox'
                                                    ? 'bg-gradient-to-r from-blue-500/10 to-purple-600/10 text-blue-400 border border-blue-500/20 shadow-lg transform hover:scale-[1.02]'
                                                    : 'text-gray-400 hover:bg-gray-800/30 hover:text-gray-200'
                                            }`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                            </svg>
                                            Inbox
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            onClick={() => setActiveSection('sent')}
                                            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                                                activeSection === 'sent'
                                                    ? 'bg-gradient-to-r from-blue-500/10 to-purple-600/10 text-blue-400 border border-blue-500/20 shadow-lg transform hover:scale-[1.02]'
                                                    : 'text-gray-400 hover:bg-gray-800/30 hover:text-gray-200'
                                            }`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                            Sent
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            onClick={() => setActiveSection('drafts')}
                                            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                                                activeSection === 'drafts'
                                                    ? 'bg-gradient-to-r from-blue-500/10 to-purple-600/10 text-blue-400 border border-blue-500/20 shadow-lg transform hover:scale-[1.02]'
                                                    : 'text-gray-400 hover:bg-gray-800/30 hover:text-gray-200'
                                            }`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Drafts
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            onClick={() => setActiveSection('quantum')}
                                            className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                                                activeSection === 'quantum'
                                                    ? 'bg-gradient-to-r from-blue-500/10 to-purple-600/10 text-blue-400 border border-blue-500/20 shadow-lg transform hover:scale-[1.02]'
                                                    : 'text-gray-400 hover:bg-gray-800/30 hover:text-gray-200'
                                            }`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            Quantum Secured
                                        </button>
                                    </li>
                                </ul>
                            </nav>
                        </div>
                    </div>
                    
                    {/* Email content */}
                    <div className="md:col-span-3">
                        <Inbox mode={activeSection} key={shouldRefresh} />
                    </div>
                </div>
            </main>

            {/* Compose Email Mini-Window - Position at bottom right */}
            <div className={`fixed right-8 bottom-8 z-50 w-full max-w-md`}>
                <ComposeEmail 
                    isOpen={isComposing}
                    onSend={handleSendEmail} 
                    onCancel={() => setIsComposing(false)} 
                />
            </div>

            {/* Floating compose button - Only show when compose is not open */}
            {!isComposing && (
                <button
                    onClick={() => setIsComposing(true)}
                    className="fixed right-8 bottom-8 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white p-4 rounded-2xl text-sm font-medium transition-all duration-200 flex items-center shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transform hover:scale-[1.02] group z-50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-linear">
                        <span className="pl-2">Compose</span>
                    </span>
                </button>
            )}
        </div>
    );
}

export default Dashboard;