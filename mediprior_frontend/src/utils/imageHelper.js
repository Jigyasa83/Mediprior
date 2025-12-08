// src/utils/imageHelper.js

export const getAvatarUrl = (profilePhoto, name = 'User') => {
    // 1. If no photo, return UI Avatar placeholder
    if (!profilePhoto) {
        return `https://ui-avatars.com/api/?name=${name}&background=3a7bff&color=fff&rounded=true`;
    }

    // 2. If it's already a full URL (e.g., from previous fix), return it
    if (profilePhoto.startsWith('http')) {
        return profilePhoto;
    }

    // 3. Ensure clean path (add leading slash if missing)
    const cleanPath = profilePhoto.startsWith('/') ? profilePhoto : `/${profilePhoto}`;

    // 4. Return full backend URL
    return `http://127.0.0.1:8000${cleanPath}`;
};