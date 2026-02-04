// ============================
// The Cork - Configuration
// ============================

const CONFIG = {
    // ============================
    // Firebase Configuration
    // ============================
    FIREBASE: {
        apiKey: "AIzaSyCf49GNUSVnl5Va3waIGFU2WcZsqo8e6Z0",
        authDomain: "the-cork-claude.firebaseapp.com",
        databaseURL: "https://the-cork-claude-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "the-cork-claude",
        storageBucket: "the-cork-claude.firebasestorage.app",
        messagingSenderId: "315353039539",
        appId: "1:315353039539:web:85f20655096ae78062e6c6",
        measurementId: "G-T2WNRF19ZT"
    },

    // ============================
    // Cloud Functions URLs
    // ============================
    FUNCTIONS: {
        analyzeWineLabel: "https://us-central1-the-cork-claude.cloudfunctions.net/analyzeWineLabel",
        searchWineImage: "https://us-central1-the-cork-claude.cloudfunctions.net/searchWineImage",
        health: "https://us-central1-the-cork-claude.cloudfunctions.net/health"
    }
};
