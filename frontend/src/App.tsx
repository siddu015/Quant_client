// App.tsx
import React, { useState, useEffect } from 'react';
import './App.css';
import Welcome from './Welcome';
import Dashboard from './Dashboard';
import { AuthProvider, useAuth } from './AuthContext';

// Wrapper component to handle routing based on authentication
const AppRouter = () => {
    const [currentPage, setCurrentPage] = useState(window.location.pathname);
    const { isAuthenticated, isLoading } = useAuth();

    useEffect(() => {
        const handleLocationChange = () => {
            setCurrentPage(window.location.pathname);
        };
        window.addEventListener('popstate', handleLocationChange);
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    // Redirect to dashboard if authenticated and on welcome page
    useEffect(() => {
        if (!isLoading && isAuthenticated && currentPage === '/') {
            window.history.pushState({}, 'Dashboard', '/dashboard');
            setCurrentPage('/dashboard');
        }
    }, [isAuthenticated, isLoading, currentPage]);

    if (isLoading) {
        return (
            <div className="bg-black min-h-screen flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    // Show dashboard if authenticated, regardless of URL
    if (isAuthenticated && currentPage !== '/dashboard') {
        window.history.pushState({}, 'Dashboard', '/dashboard');
        return <Dashboard />;
    }

    // Normal routing
    if (currentPage === '/') {
        return <Welcome />;
    } else if (currentPage === '/dashboard') {
        return <Dashboard />;
    } else {
        return <div>404 Not Found</div>;
    }
};

function App() {
    return (
        <AuthProvider>
            <AppRouter />
        </AuthProvider>
    );
}

export default App;