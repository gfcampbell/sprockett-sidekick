// Trust system for Oblivn
// Handles trust verification and peer fingerprinting

const Trust = {
    // Generate a fresh session trust token
    generateToken(prevToken = null) {
        const sessionId = prevToken?.sessionId || Trust._randomId();
        const key = Trust._randomKey();
        const issuedAt = Date.now();
        const expiresAt = issuedAt + 2 * 60 * 1000; // 2-minute validity

        const prevHash = prevToken
            ? Trust._hash(prevToken.key)
            : null;

        return {
            sessionId,
            issuedAt,
            expiresAt,
            key,
            prevHash,
        };
    },

    // Validate a token's integrity and expiration
    validateToken(newToken, currentToken) {
        if (!newToken || !currentToken) return false;

        const now = Date.now();
        if (newToken.sessionId !== currentToken.sessionId) return false;
        if (newToken.issuedAt <= currentToken.issuedAt) return false;
        if (newToken.expiresAt < now) return false;

        const expectedPrevHash = Trust._hash(currentToken.key);
        if (newToken.prevHash !== expectedPrevHash) return false;

        return true;
    },

    // Token rotation trigger
    rotate(currentToken) {
        return Trust.generateToken(currentToken);
    },

    // --- Internal utilities ---
    _randomKey() {
        return btoa(crypto.getRandomValues(new Uint8Array(16)).join(""));
    },

    _randomId() {
        return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    },

    _hash(input) {
        // Simple SHA-256 hash → base64
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        return crypto.subtle.digest("SHA-256", data).then(buf =>
            btoa(String.fromCharCode(...new Uint8Array(buf)))
        );
    },
};

// 🆕 PHASE 2: ES6 Module Export (removed window.Trust assignment)
export default Trust; 