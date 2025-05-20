// Dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext'
import { Inbox, ComposeEmail } from '../components/email';
import { EmailService } from '../services/EmailService';
import { Header, Sidebar } from '../components/layout';

interface DashboardProps {
    initialMessageId?: string | null;
}

// Define interface for draft emails
interface DraftEmail {
    id: string;
    recipient: string;
    subject: string;
    body: string;
    timestamp: Date;
}

function Dashboard({ initialMessageId }: DashboardProps) {
    const { isAuthenticated, isLoading, checkAuthStatus, logout, user } = useAuth();
    const [activeSection, setActiveSection] = useState<'inbox' | 'sent' | 'drafts'>('inbox');
    const [isComposing, setIsComposing] = useState(false);
    const [shouldRefresh, setShouldRefresh] = useState(0);
    const [viewingMessageId, setViewingMessageId] = useState<string | null>(initialMessageId || null);
    const [drafts, setDrafts] = useState<DraftEmail[]>([]);
    const [currentDraft, setCurrentDraft] = useState<DraftEmail | null>(null);

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

    // Effect to handle initialMessageId
    useEffect(() => {
        if (initialMessageId) {
            setViewingMessageId(initialMessageId);
        }
    }, [initialMessageId]);

    // Load drafts from localStorage
    useEffect(() => {
        const storedDrafts = localStorage.getItem('email-drafts');
        if (storedDrafts) {
            try {
                setDrafts(JSON.parse(storedDrafts));
            } catch (err) {
                console.error('Error parsing drafts from localStorage', err);
                localStorage.removeItem('email-drafts');
            }
        }
    }, []);

    // Save drafts to localStorage when they change
    useEffect(() => {
        localStorage.setItem('email-drafts', JSON.stringify(drafts));
    }, [drafts]);

    const handleSendEmail = async (email: { recipient: string; subject: string; body: string; encrypt: boolean }) => {
        try {
            await EmailService.sendEmail({
                recipient_email: email.recipient,
                subject: email.subject,
                body: email.body,
                encrypt: email.encrypt
            });
            setIsComposing(false);
            setCurrentDraft(null);
            
            // If we were editing a draft, remove it from drafts
            if (currentDraft) {
                setDrafts(drafts.filter(draft => draft.id !== currentDraft.id));
            }
            
            // Trigger a refresh of the emails list
            setShouldRefresh(prev => prev + 1);
        } catch (err) {
            console.error('Error sending email:', err);
            // You might want to show an error message to the user here
        }
    };

    const handleSaveDraft = (draftData: { recipient: string; subject: string; body: string }) => {
        const now = new Date();
        
        if (currentDraft) {
            // Update existing draft
            const updatedDrafts = drafts.map(draft => 
                draft.id === currentDraft.id 
                    ? { ...draft, ...draftData, timestamp: now } 
                    : draft
            );
            setDrafts(updatedDrafts);
        } else {
            // Create new draft
            const newDraft: DraftEmail = {
                id: Date.now().toString(),
                ...draftData,
                timestamp: now
            };
            setDrafts([...drafts, newDraft]);
        }
        
        setCurrentDraft(null);
    };

    const handleComposeClick = () => {
        setCurrentDraft(null);
        setIsComposing(true);
    };

    const handleEditDraft = (draft: DraftEmail) => {
        setCurrentDraft(draft);
        setIsComposing(true);
    };

    const handleDeleteDraft = (draftId: string) => {
        setDrafts(drafts.filter(draft => draft.id !== draftId));
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
                            draftsCount={drafts.length}
                        />
                    </div>
                    
                    {/* Email content */}
                    <div className="md:col-span-3">
                        <div className="bg-black/40 backdrop-blur-md rounded-xl shadow-2xl shadow-black/30 overflow-hidden border border-gray-700/50 h-full relative">
                            {/* Email content area */}
                            <div className="p-4 h-full">
                                {activeSection === 'drafts' ? (
                                    // Drafts View
                                    <div className="h-full flex flex-col">
                                        <h2 className="text-xl font-bold text-white mb-4">Drafts</h2>
                                        {drafts.length === 0 ? (
                                            <div className="flex-grow flex items-center justify-center">
                                                <p className="text-gray-400">No drafts yet</p>
                                            </div>
                                        ) : (
                                            <div className="flex-grow overflow-auto">
                                                <div className="space-y-2">
                                                    {drafts.map(draft => (
                                                        <div 
                                                            key={draft.id} 
                                                            className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800/80 transition-colors cursor-pointer group border border-gray-700/30"
                                                            onClick={() => handleEditDraft(draft)}
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="font-medium text-gray-200 truncate">{draft.subject || "(No subject)"}</p>
                                                                    <p className="text-sm text-gray-400 truncate">{draft.recipient || "No recipient"}</p>
                                                                </div>
                                                                <div className="flex items-center">
                                                                    <span className="text-xs text-gray-500">{new Date(draft.timestamp).toLocaleDateString()}</span>
                                                                    <button 
                                                                        className="ml-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteDraft(draft.id);
                                                                        }}
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <p className="text-sm text-gray-400 mt-1 truncate">{draft.body}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <Inbox 
                                        mode={activeSection} 
                                        key={shouldRefresh} 
                                        initialMessageId={viewingMessageId}
                                        onMessageClosed={() => setViewingMessageId(null)}
                                    />
                                )}
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
                        onSaveDraft={handleSaveDraft}
                        isOpen={isComposing} 
                        initialDraft={currentDraft ? {
                            recipient: currentDraft.recipient,
                            subject: currentDraft.subject,
                            body: currentDraft.body
                        } : undefined}
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