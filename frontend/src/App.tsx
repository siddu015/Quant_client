// App.tsx
import React, { useEffect } from 'react';
import './App.css';
import Welcome from './pages/Welcome';
import Dashboard from './pages/Dashboard';
import { AuthProvider, useAuth } from './context';

// Wrapper component to handle routing based on authentication
const AppRouter = () => {
    const { isAuthenticated, isLoading, userEmail } = useAuth();

    useEffect(() => {
        console.log('Auth state changed:', { isAuthenticated, isLoading, userEmail, currentPath: window.location.pathname });
    }, [isAuthenticated, isLoading, userEmail]);

    // Show loading state
    if (isLoading) {
        console.log('App is loading...');
        return (
            <div className="bg-black min-h-screen flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    // If authenticated, always show dashboard
    if (isAuthenticated && userEmail) {
        console.log('User is authenticated as:', userEmail);
        if (window.location.pathname !== '/dashboard') {
            console.log('Updating URL to /dashboard');
            window.history.replaceState(null, '', '/dashboard');
        }
        return <Dashboard />;
    }

    // If not authenticated, always show welcome page
    console.log('User is not authenticated, showing Welcome page');
    if (window.location.pathname !== '/') {
        console.log('Updating URL to /');
        window.history.replaceState(null, '', '/');
    }
    return <Welcome />;
};

// Wrap the entire app with error boundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error('App error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="bg-black min-h-screen flex items-center justify-center text-white">
                    <div className="text-center">
                        <h1 className="text-2xl mb-4">Something went wrong</h1>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false });
                                window.location.reload();
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <AppRouter />
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;