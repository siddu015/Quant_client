// App.tsx
import React, { useState, useEffect } from 'react';
import './App.css';
import Welcome from './Welcome';
import Login from './Login';
import Dashboard from './Dashboard';

function App() {
    const [currentPage, setCurrentPage] = useState(window.location.pathname);

    useEffect(() => {
        const handleLocationChange = () => {
            setCurrentPage(window.location.pathname);
        };
        window.addEventListener('popstate', handleLocationChange);
        return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    if (currentPage === '/') {
        return <Welcome />;
    } else if (currentPage === '/login') {
        return <Login />;
    } else if (currentPage === '/dashboard') {
        return <Dashboard />;
    } else {
        return <div>404 Not Found</div>;
    }
}

export default App;
