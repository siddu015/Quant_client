// Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext'
import { Inbox, ComposeEmail } from '../components/email';
import { EmailService } from '../services/EmailService';
import { Header, Sidebar } from '../components/layout';
import { Email, SaveDraftRequest } from '../types/Email';

interface DashboardProps {
    initialMessageId?: string | null;
}

function Dashboard({ initialMessageId }: DashboardProps) {
    const { isAuthenticated, isLoading, checkAuthStatus, logout } = useAuth();
    const [activeSection, setActiveSection] = useState<'inbox' | 'sent' | 'drafts' | 'trash'>('inbox');
    const [isComposing, setIsComposing] = useState(false);
    const [shouldRefresh, setShouldRefresh] = useState(0);
    const [viewingMessageId, setViewingMessageId] = useState<string | null>(initialMessageId || null);
    const [currentDraft, setCurrentDraft] = useState<SaveDraftRequest | null>(null);

    useEffect(() => {
        // Check authentication status when component mounts - with empty dependency array to run once
        checkAuthStatus();
    }, []); // Remove checkAuthStatus from dependencies to prevent re-renders

    useEffect(() => {
        // If not loading and not authenticated, redirect to welcome page
        if (!isLoading && !isAuthenticated) {
            window.location.href = '/';
        }
    }, [isLoading, isAuthenticated]);

    // Effect to handle initialMessageId
    useEffect(() => {
        if (initialMessageId) {
            setViewingMessageId(initialMessageId);
        }
    }, [initialMessageId]);

    const handleSendEmail = async (email: { recipient: string; subject: string; body: string; encrypt: boolean }) => {
        try {
            await EmailService.sendEmail({
                recipient_email: email.recipient,
                subject: email.subject,
                body: email.body,
                encrypt: email.encrypt
            });
            setIsComposing(false);
            // Clear the current draft
            setCurrentDraft(null);
            // Trigger a refresh of the emails list
            setShouldRefresh(prev => prev + 1);
        } catch (err) {
            console.error('Error sending email:', err);
            // You might want to show an error message to the user here
        }
    };

    const handleSaveDraft = async (draft: { recipient: string; subject: string; body: string }) => {
        try {
            // Only save if there's content
            if (draft.recipient || draft.subject || draft.body) {
                const draftRequest: SaveDraftRequest = {
                    recipient_email: draft.recipient,
                    subject: draft.subject,
                    body: draft.body
                };
                
                await EmailService.saveDraft(draftRequest);
                setShouldRefresh(prev => prev + 1);
            }
        } catch (err) {
            console.error('Error saving draft:', err);
        }
    };

    // Handle cancel compose - save as draft if content exists
    const handleCancelCompose = async () => {
        if (currentDraft && (currentDraft.recipient_email || currentDraft.subject || currentDraft.body)) {
            await handleSaveDraft({
                recipient: currentDraft.recipient_email,
                subject: currentDraft.subject,
                body: currentDraft.body
            });
        }
        setCurrentDraft(null);
        setIsComposing(false);
    };

    // Update draft content when user types
    const handleDraftChange = (draft: { recipient: string; subject: string; body: string }) => {
        setCurrentDraft({
            recipient_email: draft.recipient,
            subject: draft.subject,
            body: draft.body
        });
    };

    // Handle email deletion (trigger refresh)
    const handleEmailDeleted = () => {
        console.log('Email deleted/restored, refreshing list');
        setShouldRefresh(prev => prev + 1);
        // Clear the current viewing message if we're in trash and just deleted something
        if (activeSection === 'trash') {
            setViewingMessageId(null);
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
        <div className="relative min-h-screen h-screen overflow-hidden bg-gradient-to-br from-black via-gray-950 to-black font-sans">
            {/* Background gradient effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800/10 to-gray-900/10 pointer-events-none"></div>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjM0UzQzQwIiBzdHJva2Utd2lkdGg9IjAuNSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-3 pointer-events-none"></div>
            
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
                        <div className="bg-black/40 backdrop-blur-md rounded-xl shadow-2xl shadow-black/30 overflow-hidden border border-gray-700/50 h-full relative">
                            {/* Section title */}
                            <div className="p-4 border-b border-gray-700/50">
                                <h1 className="text-xl font-medium text-white capitalize">
                                    {activeSection}
                                </h1>
                            </div>
                            
                            {/* Email content area */}
                            <div className="p-4 h-[calc(100%-60px)] overflow-auto">
                                <Inbox 
                                    mode={activeSection} 
                                    key={`${activeSection}-${shouldRefresh}`} 
                                    initialMessageId={viewingMessageId}
                                    onMessageClosed={() => setViewingMessageId(null)}
                                    onEmailDeleted={handleEmailDeleted}
                                />
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
                        onCancel={handleCancelCompose} 
                        isOpen={isComposing}
                        onSaveDraft={handleSaveDraft}
                        onDraftChange={handleDraftChange}
                    />
                </div>
            )}
            
            {/* Floating compose button - Only show when compose is not open */}
            {!isComposing && (
                <button
                    onClick={() => setIsComposing(true)}
                    className="fixed right-8 bottom-8 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-gray-200 p-4 rounded-xl text-sm font-medium transition-all duration-200 flex items-center shadow-lg shadow-gray-900/30 hover:shadow-gray-900/50 transform hover:scale-[1.02] group z-50"
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