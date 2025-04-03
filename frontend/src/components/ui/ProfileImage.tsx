import React, { useState } from 'react';
import { formatGoogleProfileUrl } from '../../utils';

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

export default ProfileImage; 