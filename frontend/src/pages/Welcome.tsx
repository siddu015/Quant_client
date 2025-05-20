// Welcome.tsx
import React, { useRef, useEffect, useState } from 'react';

function Welcome() {
    const aboutSectionRef = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [activeFaq, setActiveFaq] = useState<number | null>(null);

    // FAQ data
    const faqItems = [
        {
            question: 'What is quantum encryption?',
            answer: 'Quantum encryption uses principles of quantum mechanics to create unbreakable encryption keys. Unlike traditional encryption, it is secured by the laws of physics themselves.'
        },
        {
            question: 'How secure is Quantum Email?',
            answer: 'Quantum Email uses state-of-the-art quantum encryption technology that is theoretically impossible to break, even with future quantum computers.'
        },
        {
            question: 'Can I use Quantum Email with my existing email?',
            answer: 'Yes! Quantum Email integrates seamlessly with your existing email accounts while adding an extra layer of quantum security.'
        },
        {
            question: 'What happens if someone tries to intercept my email?',
            answer: 'Any attempt to intercept or measure the quantum state of your email will immediately alter it, making it impossible for attackers to steal your information without detection.'
        }
    ];

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
            document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
            document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
        };

        const handleScroll = () => {
            const scrolled = window.scrollY;
            document.documentElement.style.setProperty('--scroll-y', `${scrolled}px`);
            
            document.querySelectorAll('.parallax-section').forEach((section) => {
                const rect = section.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                const viewportHeight = window.innerHeight;
                const distanceFromCenter = centerY - viewportHeight / 2;
                const parallaxOffset = distanceFromCenter * 0.1;
                
                section.setAttribute('style', `transform: translateY(${parallaxOffset}px)`);
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('scroll', handleScroll);
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);
    const [showBackToTop, setShowBackToTop] = useState(false);

    useEffect(() => {
        // Intersection Observer for fade-in animations
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-fade-in');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.1 }
        );

        // Observe all sections
        document.querySelectorAll('.animate-on-scroll').forEach((section) => {
            observer.observe(section);
        });

        // Back to Top button visibility
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 500);
        };

        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });    
    };

    const handleGoogleLogin = () => {
        window.location.href = 'http://localhost:8080/auth/google';
    };

    const scrollToAbout = () => {
        aboutSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 relative overflow-hidden font-sans">
            {/* Quantum Particle Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Quantum tunneling effect */}
                <div className="quantum-tunneling absolute inset-0">
                    {[...Array(4)].map((_, i) => (
                        <div key={`tunnel-${i}`} className={`tunnel-container absolute tunnel-${i}`}>
                            <div className="tunnel-particle absolute w-2 h-2 bg-pink-500/40 rounded-full" />
                            <div className="tunnel-barrier absolute rounded-lg bg-gray-800/30" />
                        </div>
                    ))}
                </div>

                {/* Superposition states */}
                <div className="quantum-superposition absolute inset-0">
                    {[...Array(3)].map((_, i) => (
                        <div key={`superposition-${i}`} className={`superposition-state absolute superposition-${i}`}>
                            <div className="state-up absolute w-1.5 h-1.5 bg-yellow-400/40 rounded-full" />
                            <div className="state-down absolute w-1.5 h-1.5 bg-yellow-400/40 rounded-full" />
                            <div className="state-connector absolute w-px bg-gradient-to-b from-yellow-400/30 to-transparent" />
                        </div>
                    ))}
                </div>

                {/* Energy level transitions */}
                <div className="quantum-energy-levels absolute inset-0">
                    {[...Array(4)].map((_, i) => (
                        <div key={`energy-${i}`} className={`energy-level absolute energy-${i}`}>
                            <div className="level-line absolute h-px bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-blue-400/20" />
                            <div className="electron absolute w-1.5 h-1.5 bg-blue-400/40 rounded-full" />
                        </div>
                    ))}
                </div>

                {/* Regular quantum particles */}
                <div className="quantum-particles absolute inset-0">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={`particle-${i}`}
                            className={`particle absolute w-2 h-2 bg-blue-500/30 rounded-full particle-${i} interactive-particle`}
                        />
                    ))}
                </div>
                
                {/* Orbital particles */}
                <div className="quantum-orbitals absolute inset-0">
                    {[...Array(3)].map((_, i) => (
                        <div
                            key={`orbital-${i}`}
                            className={`orbital-ring absolute rounded-full border border-purple-500/20 orbital-${i}`}
                        >
                            <div className="orbital-particle absolute w-1.5 h-1.5 bg-purple-500/40 rounded-full" />
                        </div>
                    ))}
                </div>

                {/* Entangled particle pairs */}
                <div className="quantum-entangled absolute inset-0">
                    {[...Array(5)].map((_, i) => (
                        <div key={`entangled-${i}`} className={`entangled-pair absolute entangled-${i}`}>
                            <div className="entangled-particle-1 absolute w-2 h-2 bg-green-400/30 rounded-full" />
                            <div className="entangled-connector absolute h-px transform origin-left" />
                            <div className="entangled-particle-2 absolute w-2 h-2 bg-green-400/30 rounded-full" />
                        </div>
                    ))}
                </div>

                {/* Wave function collapse effect */}
                <div className="quantum-waves absolute inset-0">
                    {[...Array(3)].map((_, i) => (
                        <div
                            key={`wave-${i}`}
                            className={`wave-ring absolute rounded-full border-2 border-cyan-500/10 wave-${i}`}
                        />
                    ))}
                </div>
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.1),transparent_70%)] pointer-events-none blur-3xl"></div>
            {/* Back to Top Button */}
            <button
                onClick={scrollToTop}
                aria-label="Scroll to top of page"
                title="Back to top"
                className={`fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 z-50 ${showBackToTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
            </button>
            <header className="p-6 flex justify-between items-center z-10 relative">
                <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">Quantum Email</h1>
                </div>
                <button 
                    onClick={handleGoogleLogin}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center group"
                >
                    <svg className="w-5 h-5 mr-2 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        <path d="M1 1h22v22H1z" fill="none"/>
                    </svg>
                    Sign in with Google
                </button>
            </header>
            <main className="flex-grow flex flex-col items-center px-4">
                <div className="h-[90vh] flex items-center justify-center">
                    <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 animate-fade-in-up">
                        Welcome to <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-purple-600 bg-clip-text text-transparent animate-gradient">Quantum Email</span>
                    </h1>
                    <p className="text-gray-400 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
                        Experience the next generation of secure email with quantum encryption technology.
                        Protect your communications with the power of quantum computing.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button 
                            onClick={scrollToAbout}
                            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg text-lg font-medium transition-colors duration-200 flex items-center group"
                        >
                            Learn More
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2 transform group-hover:translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </button>
                    </div>
                    </div>
                </div>

                <div ref={aboutSectionRef} className="w-full max-w-6xl mx-auto px-8 py-24 min-h-[80vh] flex flex-col justify-center bg-gray-900/50 animate-on-scroll opacity-0 transform translate-y-4 transition-all duration-700">
                    <h2 className="text-3xl font-bold text-white text-center mb-8">About Quantum Email</h2>
                    <div className="grid md:grid-cols-2 gap-12 px-4">
                        <div className="space-y-6">
                            <div className="bg-gray-900 p-6 rounded-xl transform hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
                                <h3 className="text-xl font-semibold text-white mb-3 flex items-center group">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-500 transform group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    What is Quantum Email?
                                </h3>
                                <p className="text-gray-400 group-hover:text-gray-300 transition-colors">Quantum Email is a revolutionary communication platform that leverages quantum encryption technology to provide unbreakable security for your emails. Unlike traditional email services, we use quantum key distribution (QKD) to ensure that your messages remain private and secure, even against future quantum computer attacks.</p>
                            </div>
                            <div className="bg-gray-900 p-6 rounded-xl transform hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10">
                                <h3 className="text-xl font-semibold text-white mb-3 flex items-center group">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-purple-500 transform group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    Why Choose Us?
                                </h3>
                                <p className="text-gray-400 group-hover:text-gray-300 transition-colors">We offer military-grade security with the simplicity of regular email. Our platform is designed for individuals and organizations who value privacy and need to protect sensitive communications from current and future threats.</p>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="bg-gray-900 p-6 rounded-xl transform hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/10">
                                <h3 className="text-xl font-semibold text-white mb-3 flex items-center group">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-green-500 transform group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                    How It Works
                                </h3>
                                <p className="text-gray-400 group-hover:text-gray-300 transition-colors">Our system uses quantum properties to generate and distribute encryption keys. When you send an email, the content is encrypted using these quantum-generated keys. Any attempt to intercept or measure these keys would alter their state, making it impossible for attackers to steal your information without detection.</p>
                            </div>
                            <div className="bg-gray-900 p-6 rounded-xl transform hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/10">
                                <h3 className="text-xl font-semibold text-white mb-3 flex items-center group">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-yellow-500 transform group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Real-Time Security
                                </h3>
                                <p className="text-gray-400 group-hover:text-gray-300 transition-colors">Experience instant encryption and decryption of your emails with our quantum-based system. Our platform continuously monitors for security breaches and automatically alerts you of any unauthorized access attempts, providing real-time protection for your communications.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full max-w-6xl mx-auto px-4 py-16 min-h-[80vh] flex flex-col justify-center animate-on-scroll opacity-0 transform translate-y-4 transition-all duration-700">
                    <h2 className="text-3xl font-bold text-white text-center mb-8">Quantum vs Traditional Email Security</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto mt-8">
                        <div className="bg-gray-900/80 backdrop-blur-sm p-8 rounded-xl transform hover:scale-105 transition-all duration-300 cursor-pointer h-full border border-gray-800 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
                            <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Real-time Security
                            </h3>
                            <div className="space-y-6">
                                <div className="p-4 bg-gray-800/80 backdrop-blur-sm rounded-lg hover:bg-gray-800 transition-all duration-200 hover:shadow-md hover:shadow-blue-500/5 border border-gray-700/50">
                                    <h4 className="text-blue-400 font-semibold mb-2">Current Protection</h4>
                                    <p className="text-gray-400">Uses complex math problems that are hard for today's computers to solve. Like having a super complicated password that takes years to guess.</p>
                                </div>
                                <div className="p-4 bg-gray-800/80 backdrop-blur-sm rounded-lg hover:bg-gray-800 transition-all duration-200 hover:shadow-md hover:shadow-blue-500/5 border border-gray-700/50">
                                    <h4 className="text-blue-400 font-semibold mb-2">How It Works</h4>
                                    <p className="text-gray-400">Scrambles your messages using mathematical locks (encryption). The security depends on how difficult these math problems are to solve.</p>
                                </div>
                                <div className="p-4 bg-gray-800/80 backdrop-blur-sm rounded-lg hover:bg-gray-800 transition-all duration-200 hover:shadow-md hover:shadow-blue-500/5 border border-gray-700/50">
                                    <h4 className="text-yellow-500 font-semibold mb-2 flex items-center">
                                        <span className="mr-2">⚠️</span>Future Risk
                                    </h4>
                                    <p className="text-gray-400">Quantum computers could potentially break these mathematical locks, making traditional email security vulnerable in the future.</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/80 backdrop-blur-sm p-8 rounded-xl transform hover:scale-105 transition-all duration-300 cursor-pointer h-full border border-gray-800 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
                            <h3 className="text-2xl font-bold text-white mb-4 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                Quantum Email Security
                            </h3>
                            <div className="space-y-6">
                                <div className="p-4 bg-gray-800/80 backdrop-blur-sm rounded-lg hover:bg-gray-800 transition-all duration-200 hover:shadow-md hover:shadow-blue-500/5 border border-gray-700/50">
                                    <h4 className="text-green-400 font-semibold mb-2">Unbreakable Protection</h4>
                                    <p className="text-gray-400">Uses the laws of physics instead of math. It's like having a lock that physically breaks if someone tries to peek at it.</p>
                                </div>
                                <div className="p-4 bg-gray-800/80 backdrop-blur-sm rounded-lg hover:bg-gray-800 transition-all duration-200 hover:shadow-md hover:shadow-blue-500/5 border border-gray-700/50">
                                    <h4 className="text-green-400 font-semibold mb-2">Self-Protecting</h4>
                                    <p className="text-gray-400">If someone tries to intercept your message, the quantum properties automatically change, making the stolen information useless and alerting you immediately.</p>
                                </div>
                                <div className="p-4 bg-gray-800/80 backdrop-blur-sm rounded-lg hover:bg-gray-800 transition-all duration-200 hover:shadow-md hover:shadow-blue-500/5 border border-gray-700/50">
                                    <h4 className="text-green-500 font-semibold mb-2 flex items-center">
                                        <span className="mr-2">✓</span>Future-Proof
                                    </h4>
                                    <p className="text-gray-400">Safe against both current and future computers - even quantum computers can't break it because it's protected by the laws of physics themselves.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            {/* FAQ Section */}
            <div className="w-full max-w-4xl mx-auto px-4 py-16 parallax-section">
                <h2 className="text-3xl font-bold text-white text-center mb-12">Frequently Asked Questions</h2>
                <div className="space-y-4">
                    {faqItems.map((item, index) => (
                        <div
                            key={index}
                            className="bg-gray-900/80 backdrop-blur-sm rounded-lg overflow-hidden transition-all duration-300"
                        >
                            <button
                                className="w-full px-6 py-4 text-left flex justify-between items-center text-white hover:bg-gray-800/50"
                                onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                            >
                                <span className="font-semibold">{item.question}</span>
                                <svg
                                    className={`w-5 h-5 transform transition-transform ${activeFaq === index ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <div
                                className={`px-6 transition-all duration-300 ease-in-out overflow-hidden ${
                                    activeFaq === index ? 'max-h-48 py-4' : 'max-h-0'
                                }`}
                            >
                                <p className="text-gray-400">{item.answer}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>



            <footer className="py-6 px-4 text-center text-gray-500 text-sm border-t border-gray-800/50 backdrop-blur-sm">
                <p>© {new Date().getFullYear()} Quantum Email. All rights reserved.</p>
                <p>Secured with quantum encryption technology</p>
            </footer>
        </div>
    );
}

// Add these styles to the top of your CSS file or in your global styles
const styles = `
    /* Parallax and interactive effects */
    :root {
        --mouse-x: 0px;
        --mouse-y: 0px;
        --scroll-y: 0px;
    }

    .interactive-particle {
        transition: transform 0.1s ease-out;
    }

    .interactive-particle:hover {
        transform: scale(1.5);
    }

    @media (hover: hover) {
        .interactive-particle {
            transform: translate(
                calc((var(--mouse-x) - 50vw) / -50),
                calc((var(--mouse-y) - 50vh) / -50)
            );
        }
    }

    .parallax-section {
        transform: translateY(calc(var(--scroll-y) * -0.1));
        transition: transform 0.1s ease-out;
        will-change: transform;
    }
    /* Quantum tunneling effect */
    .tunnel-0 { top: 20%; left: 5%; width: 200px; height: 40px; animation: tunnelContainer 12s linear infinite; }
    .tunnel-1 { top: 40%; left: 15%; width: 180px; height: 40px; animation: tunnelContainer 15s linear infinite; animation-delay: -3s; }
    .tunnel-2 { top: 60%; left: 8%; width: 220px; height: 40px; animation: tunnelContainer 14s linear infinite; animation-delay: -6s; }
    .tunnel-3 { top: 80%; left: 12%; width: 190px; height: 40px; animation: tunnelContainer 13s linear infinite; animation-delay: -9s; }

    .tunnel-container {
        transform: rotate(-15deg);
    }

    .tunnel-container .tunnel-particle {
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        animation: tunneling 4s ease-in-out infinite;
    }

    .tunnel-container .tunnel-barrier {
        left: 40%;
        top: 0;
        width: 20%;
        height: 100%;
        animation: barrierPulse 4s ease-in-out infinite;
    }

    /* Superposition states */
    .superposition-0 { top: 30%; right: 15%; height: 100px; animation: superpositionFloat 10s ease-in-out infinite; }
    .superposition-1 { top: 50%; right: 25%; height: 80px; animation: superpositionFloat 12s ease-in-out infinite; animation-delay: -4s; }
    .superposition-2 { top: 70%; right: 20%; height: 90px; animation: superpositionFloat 11s ease-in-out infinite; animation-delay: -7s; }

    .superposition-state .state-up { top: 0; left: 50%; transform: translateX(-50%); }
    .superposition-state .state-down { bottom: 0; left: 50%; transform: translateX(-50%); }
    .superposition-state .state-connector { left: 50%; transform: translateX(-50%); height: 100%; }

    /* Energy level transitions */
    .energy-0 { top: 25%; right: 40%; width: 120px; }
    .energy-1 { top: 35%; right: 45%; width: 140px; }
    .energy-2 { top: 45%; right: 42%; width: 130px; }
    .energy-3 { top: 55%; right: 38%; width: 150px; }

    .energy-level .level-line { width: 100%; top: 50%; }
    .energy-level .electron { top: 50%; transform: translateY(-50%); animation: electronJump 6s ease-in-out infinite; }

    @keyframes tunneling {
        0%, 100% { transform: translateY(-50%) translateX(0); opacity: 0.8; }
        50% { transform: translateY(-50%) translateX(100%); opacity: 0.3; }
    }

    @keyframes barrierPulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.1; }
    }

    @keyframes tunnelContainer {
        0% { transform: rotate(-15deg) translateX(-100%); }
        100% { transform: rotate(-15deg) translateX(100vw); }
    }

    @keyframes superpositionFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-20px); }
    }

    @keyframes electronJump {
        0%, 100% { left: 0; }
        25% { left: 33%; transform: translateY(-50%) translateY(-20px); }
        50% { left: 66%; }
        75% { left: 100%; transform: translateY(-50%) translateY(20px); }
    }

    /* Regular quantum particles */
    .particle-0 { top: 10%; left: 20%; animation: float 8s linear infinite; animation-delay: -2s; }
    .particle-1 { top: 30%; left: 40%; animation: float 12s linear infinite; animation-delay: -4s; }
    .particle-2 { top: 50%; left: 60%; animation: float 7s linear infinite; animation-delay: -1s; }
    .particle-3 { top: 70%; left: 80%; animation: float 10s linear infinite; animation-delay: -3s; }
    .particle-4 { top: 90%; left: 10%; animation: float 9s linear infinite; animation-delay: -5s; }
    .particle-5 { top: 15%; left: 85%; animation: float 11s linear infinite; animation-delay: -2.5s; }
    .particle-6 { top: 35%; left: 25%; animation: float 8.5s linear infinite; animation-delay: -1.5s; }
    .particle-7 { top: 55%; left: 45%; animation: float 13s linear infinite; animation-delay: -4.5s; }
    .particle-8 { top: 75%; left: 65%; animation: float 7.5s linear infinite; animation-delay: -3.5s; }
    .particle-9 { top: 95%; left: 5%; animation: float 10.5s linear infinite; animation-delay: -2.8s; }
    .particle-10 { top: 5%; left: 95%; animation: float 9.5s linear infinite; animation-delay: -1.8s; }
    .particle-11 { top: 25%; left: 75%; animation: float 11.5s linear infinite; animation-delay: -4.2s; }
    .particle-12 { top: 45%; left: 35%; animation: float 8.2s linear infinite; animation-delay: -3.2s; }
    .particle-13 { top: 65%; left: 55%; animation: float 12.5s linear infinite; animation-delay: -2.2s; }
    .particle-14 { top: 85%; left: 15%; animation: float 7.8s linear infinite; animation-delay: -1.2s; }
    .particle-15 { top: 18%; left: 88%; animation: float 10.8s linear infinite; animation-delay: -4.8s; }
    .particle-16 { top: 38%; left: 28%; animation: float 9.2s linear infinite; animation-delay: -3.8s; }
    .particle-17 { top: 58%; left: 48%; animation: float 11.2s linear infinite; animation-delay: -2.5s; }
    .particle-18 { top: 78%; left: 68%; animation: float 8.8s linear infinite; animation-delay: -1.8s; }
    .particle-19 { top: 98%; left: 8%; animation: float 10.2s linear infinite; animation-delay: -4.5s; }

    @keyframes float {
        0% { transform: translate(0, 0) scale(1); opacity: 0; }
        25% { opacity: 0.5; }
        50% { transform: translate(100px, -100px) scale(1.5); opacity: 0.3; }
        75% { opacity: 0.5; }
        100% { transform: translate(0, 0) scale(1); opacity: 0; }
    }

    @keyframes fade-in {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .animate-fade-in {
        animation: fade-in 0.8s ease-out forwards;
    }

    .quantum-particles .particle {
        box-shadow: 0 0 15px 3px rgba(59, 130, 246, 0.3);
    }

    /* Orbital rings */
    .orbital-0 { width: 150px; height: 150px; top: 20%; left: 10%; animation: rotate 20s linear infinite; }
    .orbital-1 { width: 200px; height: 200px; top: 60%; left: 70%; animation: rotate 25s linear infinite reverse; }
    .orbital-2 { width: 300px; height: 300px; top: 40%; left: 40%; animation: rotate 30s linear infinite; }

    .orbital-ring .orbital-particle {
        top: -2px;
        left: 50%;
        animation: glow 2s ease-in-out infinite;
    }

    /* Entangled particle pairs */
    .entangled-0 { top: 25%; left: 15%; width: 100px; animation: entangle 15s ease-in-out infinite; }
    .entangled-1 { top: 45%; left: 75%; width: 150px; animation: entangle 18s ease-in-out infinite; animation-delay: -5s; }
    .entangled-2 { top: 65%; left: 25%; width: 120px; animation: entangle 20s ease-in-out infinite; animation-delay: -8s; }
    .entangled-3 { top: 15%; left: 65%; width: 180px; animation: entangle 22s ease-in-out infinite; animation-delay: -12s; }
    .entangled-4 { top: 75%; left: 45%; width: 140px; animation: entangle 17s ease-in-out infinite; animation-delay: -3s; }

    .entangled-pair .entangled-particle-1 { left: 0; }
    .entangled-pair .entangled-particle-2 { right: 0; }
    .entangled-pair .entangled-connector {
        left: 8px;
        top: 4px;
        right: 8px;
        background: linear-gradient(90deg, rgba(74, 222, 128, 0.2), rgba(74, 222, 128, 0));
    }

    /* Wave function collapse rings */
    .wave-0 { width: 100px; height: 100px; top: 30%; left: 20%; animation: waveCollapse 10s ease-in-out infinite; }
    .wave-1 { width: 150px; height: 150px; top: 50%; left: 60%; animation: waveCollapse 12s ease-in-out infinite; animation-delay: -4s; }
    .wave-2 { width: 200px; height: 200px; top: 70%; left: 40%; animation: waveCollapse 14s ease-in-out infinite; animation-delay: -8s; }

    @keyframes rotate {
        from { transform: translate(-50%, -50%) rotate(0deg); }
        to { transform: translate(-50%, -50%) rotate(360deg); }
    }

    @keyframes glow {
        0%, 100% { transform: scale(1); opacity: 0.4; }
        50% { transform: scale(1.5); opacity: 0.8; }
    }

    @keyframes entangle {
        0%, 100% { transform: rotate(0deg) scale(1); }
        50% { transform: rotate(180deg) scale(0.8); }
    }

    @keyframes waveCollapse {
        0% { transform: translate(-50%, -50%) scale(0.1); opacity: 0.8; }
        50% { transform: translate(-50%, -50%) scale(1); opacity: 0.2; }
        100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
    }
`;

// Add styles to head
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

export default Welcome;
