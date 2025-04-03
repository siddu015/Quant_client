// Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Inbox, ComposeEmail } from '../components/email';
import { EmailService } from '../services/EmailService';
import { Header, Sidebar } from '../components/layout';

function Dashboard() {
    const { isAuthenticated, isLoading, checkAuthStatus, logout } = useAuth();
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

    const handleSendEmail = async (email: { recipient: string; subject: string; body: string; encrypt: boolean }) => {
        try {
            await EmailService.sendEmail({
                recipient_email: email.recipient,
                subject: email.subject,
                body: email.body,
                encrypt: email.encrypt
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
        <div className="relative min-h-screen h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            {/* Background gradient effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20 pointer-events-none"></div>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMjEyMTIxIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-5 pointer-events-none"></div>
            
            {/* Header */}
            <Header onLogout={logout} />
            
            {/* Main content with fixed height to prevent scrolling issues */}
            <main className="container mx-auto px-4 py-6 overflow-auto" style={{ height: "calc(100vh - 76px)" }}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-full">
                    {/* Sidebar */}
                    <div className="md:col-span-1">
                        <Sidebar 
                            activeSection={activeSection} 
                            onSectionChange={setActiveSection} 
                        />
                    </div>
                    
                    {/* Email content */}
                    <div className="md:col-span-3">
                        <div className="bg-gray-900/30 backdrop-blur-lg rounded-2xl shadow-xl overflow-hidden border border-gray-800/50 h-full relative">
                            {/* Email content area */}
                            <div className="p-4 h-full">
                                <Inbox mode={activeSection} key={shouldRefresh} />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            
            {/* Compose email */}
            {isComposing && (
                <div className="fixed bottom-4 right-4 z-20 w-full max-w-lg">
                    <ComposeEmail 
                        onSend={handleSendEmail} 
                        onCancel={() => setIsComposing(false)} 
                        isOpen={isComposing} 
                    />
                </div>
            )}
            
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