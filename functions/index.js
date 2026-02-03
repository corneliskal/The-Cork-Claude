const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { OpenAI } = require('openai');

admin.initializeApp();

// Get API keys from Firebase environment config
// Set these with: firebase functions:config:set openai.key="sk-..." google.apikey="AIza..." google.cx="..."
const getOpenAIKey = () => functions.config().openai?.key;
const getGoogleApiKey = () => functions.config().google?.apikey;
const getGoogleCx = () => functions.config().google?.cx;

// Middleware to verify Firebase Auth
const verifyAuth = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized - No token provided' });
        return null;
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ error: 'Unauthorized - Invalid token' });
        return null;
    }
};

// ================================
// OpenAI Vision API - Analyze Wine Label
// ================================
exports.analyzeWineLabel = functions.https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // Verify user is authenticated
    const user = await verifyAuth(req, res);
    if (!user) return;

    const openaiKey = getOpenAIKey();
    if (!openaiKey) {
        res.status(500).json({ error: 'OpenAI API not configured' });
        return;
    }

    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) {
            res.status(400).json({ error: 'No image provided' });
            return;
        }

        const openai = new OpenAI({ apiKey: openaiKey });

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze this wine label image and extract the following information in JSON format:
{
    "name": "wine name",
    "producer": "producer/house name",
    "year": year as number or null,
    "region": "region, country",
    "grape": "grape variety/varieties",
    "type": "red/white/rosé/sparkling/dessert",
    "characteristics": {
        "boldness": 1-5,
        "tannins": 1-5,
        "acidity": 1-5
    },
    "notes": "brief tasting notes or description",
    "estimatedPrice": "estimated price range in euros"
}

If you cannot determine a value, use null. For type, make your best guess based on the wine name/region.
Only respond with the JSON, no other text.`
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1000
        });

        const content = response.choices[0].message.content;

        // Parse JSON from response
        let wineData;
        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                wineData = JSON.parse(jsonMatch[0]);
            } else {
                wineData = JSON.parse(content);
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            res.status(500).json({ error: 'Failed to parse wine data', raw: content });
            return;
        }

        res.json({ success: true, data: wineData });

    } catch (error) {
        console.error('OpenAI error:', error);
        res.status(500).json({ error: 'Failed to analyze image', message: error.message });
    }
});

// ================================
// Google Image Search - Find Wine Image
// ================================
exports.searchWineImage = functions.https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // Verify user is authenticated
    const user = await verifyAuth(req, res);
    if (!user) return;

    const googleApiKey = getGoogleApiKey();
    const googleCx = getGoogleCx();

    if (!googleApiKey || !googleCx) {
        // Return null image - the app will use the user's photo instead
        res.json({ success: true, imageUrl: null, message: 'Google Image Search not configured' });
        return;
    }

    try {
        const { query, type } = req.body;
        if (!query) {
            res.status(400).json({ error: 'No search query provided' });
            return;
        }

        // Include wine type in search for better accuracy (red/white/rosé/sparkling)
        const wineType = type || '';
        const typeKeyword = wineType === 'rosé' ? 'rosé wine' :
                           wineType === 'sparkling' ? 'sparkling wine champagne' :
                           wineType === 'dessert' ? 'dessert wine' :
                           wineType ? `${wineType} wine` : 'wine';
        const searchQuery = `${query} ${typeKeyword} bottle`;
        const url = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCx}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=1&imgType=photo`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            res.json({ success: true, imageUrl: data.items[0].link });
        } else {
            res.json({ success: true, imageUrl: null, message: 'No images found' });
        }

    } catch (error) {
        console.error('Google search error:', error);
        res.status(500).json({ error: 'Failed to search images', message: error.message });
    }
});

// ================================
// Health check endpoint
// ================================
exports.health = functions.https.onRequest((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json({
        status: 'ok',
        openaiConfigured: !!getOpenAIKey(),
        googleConfigured: !!(getGoogleApiKey() && getGoogleCx())
    });
});
