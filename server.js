// Set up and authenitcation make sure all these are imported 
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors'); 
require('dotenv').config();

const { execFile } = require('child_process');


const app = express();

// Enable CORS for all requests this is required because of security issues in the chrome extension
app.use(cors({
    origin: '*', // Allows requests from any origin; you can restrict this to your specific extension URL if desired
}));

app.use(bodyParser.json());

// Getting the specific information (these are saved in env file which is not uploaded to github because of security)
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

const SPOTIFY_RECENTLY_PLAYED_URL = "https://api.spotify.com/v1/me/player/recently-played";

// Personal database login info saved in .env file
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

// Connecting to mySQL database so information can be sent there
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database');
});

// Sending tokens to the server to be able to get access to the information on spotify
app.post('/getSpotifyToken', async (req, res) => {
    const { code, user_id } = req.body;

    const authOptions = {
        method: 'POST',
        url: SPOTIFY_TOKEN_URL,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        },
        data: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI
        }).toString()
    };

    try {
        const response = await axios(authOptions);
        const { access_token, refresh_token, expires_in } = response.data;

        const expires_at = new Date(Date.now() + expires_in * 1000).toISOString().slice(0, 19).replace('T', ' ');

        const query = `
            INSERT INTO spotify_tokens (user_id, access_token, refresh_token, expires_at)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                access_token = VALUES(access_token), 
                refresh_token = VALUES(refresh_token), 
                expires_at = VALUES(expires_at),
                updated_at = CURRENT_TIMESTAMP
        `;
        db.execute(query, [user_id, access_token, refresh_token, expires_at], (error, results) => {
            if (error) {
                console.error('Error inserting tokens into database:', error);
                return res.status(500).json({ error: 'Database insertion failed' });
            }

            res.json({ access_token, refresh_token });
        });
    } catch (error) {
        console.error('Error getting tokens:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to get tokens' });
    }
});

// I am running my server on port 3000 - make sure nothing else is using this port or it will not work 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Inserting mood information into mySQL
app.post('/submitMood', (req, res) => {
    const { user_id, mood_score, arousal_score } = req.body;

    const query = `
        INSERT INTO moods (user_id, mood_score, arousal_score)
        VALUES (?, ?, ?)
    `;

    db.execute(query, [user_id, mood_score, arousal_score], (error, results) => {
        if (error) {
            console.error('Error inserting mood data into database:', error);
            return res.status(500).json({ error: 'Database insertion failed' });
        }

        // Get the inserted mood_id
        const mood_id = results.insertId;
        res.json({ message: 'Mood data submitted successfully', mood_id });
    });
});


// Fetch recently played tracks to be stored and later inserted into mySQL
app.post('/fetchRecentlyPlayed', async (req, res) => {
    const { user_id, mood_id } = req.body;

    // Query to get the latest access token from `spotify_tokens`
    const tokenQuery = "SELECT access_token FROM spotify_tokens WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1";
    db.execute(tokenQuery, [user_id], async (err, results) => {
        if (err || results.length === 0) {
            console.error("Failed to retrieve access token:", err);
            return res.status(500).json({ error: "Token retrieval failed" });
        }
        const accessToken = results[0].access_token;

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        try {
            const response = await axios.get(SPOTIFY_RECENTLY_PLAYED_URL, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
                params: {
                    after: new Date(oneHourAgo).getTime(), // Timestamp in milliseconds
                    limit: 50, // Fetch a maximum of 50 tracks
                },
            });

            const tracks = response.data.items.map(item => ({
                id: item.track.id,
                name: item.track.name,
                artist: item.track.artists.map(artist => artist.name).join(", "),
                played_at: item.played_at,
            }));

            // Endpoint to store tracks data
            await axios.post('http://localhost:3000/storeTracksData', { moodId: mood_id, userId: user_id, tracks });
            res.json({ message: "Tracks fetched and stored successfully" });

        } catch (error) {
            console.error("Error fetching or storing tracks:", error);
            res.status(500).json({ error: "Failed to fetch or store tracks" });
        }
    });
});

// Helper function to get access token from the database
const getSpotifyAccessToken = (userId) => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT access_token, expires_at, refresh_token
            FROM spotify_tokens
            WHERE user_id = ?
            ORDER BY updated_at DESC
            LIMIT 1
        `;

        db.execute(query, [userId], (error, results) => {
            if (error) {
                console.error("Error retrieving access token from database:", error);
                return reject("Failed to retrieve access token");
            }

            if (results.length === 0) {
                return reject("No access token found for user");
            }

            const { access_token, expires_at, refresh_token } = results[0];
            const now = new Date();

            // Check if the token is expired
            if (new Date(expires_at) > now) {
                // Token is still valid
                resolve(access_token);
            } else {
                // Token is expired, refresh it
                refreshSpotifyToken(userId, refresh_token).then(resolve).catch(reject);
            }
        });
    });
};

const refreshSpotifyToken = (userId, refreshToken) => {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await axios.post(SPOTIFY_TOKEN_URL, new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET
            }).toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const { access_token, expires_in } = response.data;
            const expires_at = new Date(Date.now() + expires_in * 1000).toISOString().slice(0, 19).replace('T', ' ');

            // Update the database with the new token and expiry
            const updateQuery = `
                UPDATE spotify_tokens
                SET access_token = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            `;
            db.execute(updateQuery, [access_token, expires_at, userId], (error) => {
                if (error) {
                    console.error("Error updating refreshed token in database:", error);
                    return reject("Failed to update refreshed token");
                }
                resolve(access_token);
            });

        } catch (error) {
            console.error("Error refreshing Spotify token:", error);
            reject("Failed to refresh token");
        }
    });
};

// Instead track data and audio features into mySQL
app.post('/storeTracksData', async (req, res) => {
    console.log("Received request at /storeTracksData");
    const { moodId, userId, tracks } = req.body;

    if (!moodId || !userId || !tracks || !Array.isArray(tracks)) {
        console.error("Invalid input data:", req.body);
        return res.status(400).json({ error: "Invalid data received" });
    }
    console.log("Data to insert:", { moodId, userId, tracksCount: tracks.length });

    const insertHistoryQuery = `
        INSERT INTO listening_history (mood_id, user_id, track_id, track_name, artist_name, listened_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE listened_at = VALUES(listened_at)
    `;

    tracks.forEach(track => {
        const { id, name, artist, played_at } = track;
        const playedAtFormatted = new Date(played_at).toISOString().slice(0, 19).replace('T', ' ');

        db.execute(insertHistoryQuery, [moodId, userId, id, name, artist, playedAtFormatted], (error) => {
            if (error) {
                console.error("Error inserting track data into listening_history:", error);
            }
        });
    });

    // Fetch audio features from Spotify
    try {
        const accessToken = await getSpotifyAccessToken(userId);
        const trackIds = tracks.map(track => track.id).join(',');

        const audioFeaturesResponse = await axios.get(`https://api.spotify.com/v1/audio-features`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            params: { ids: trackIds }
        });

        const audioFeatures = audioFeaturesResponse.data.audio_features;

        const insertFeaturesQuery = `
            INSERT INTO tracks (track_id, name, artist, danceability, energy, valence, tempo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                danceability = VALUES(danceability),
                energy = VALUES(energy),
                valence = VALUES(valence),
                tempo = VALUES(tempo)
        `;

        audioFeatures.forEach(feature => {
            const track = tracks.find(t => t.id === feature.id);
            if (track && feature) {
                db.execute(insertFeaturesQuery, [
                    feature.id, track.name, track.artist, feature.danceability, feature.energy, feature.valence, feature.tempo
                ], (error) => {
                    if (error) {
                        console.error("Error inserting audio features into tracks:", error);
                    }
                });
            }
        });

        res.json({ message: "Tracks and audio features processed and stored successfully" });
    } catch (error) {
        console.error("Error fetching or storing audio features:", error);
        res.status(500).json({ error: "Failed to fetch or store audio features" });
    }
});



