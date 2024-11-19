// background.js

// Spotify credientials for developer account and chrome extension id
const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const CLIENT_ID = "7238225ac590445ba93a7deeab420d81";
const REDIRECT_URI = "https://lkloaiamdpdnohnjnjcicocgjkmddcdo.chromiumapp.org/";
const SPOTIFY_RECENTLY_PLAYED_URL = "https://api.spotify.com/v1/me/player/recently-played";
const SCOPE = "user-read-private user-read-email user-modify-playback-state user-read-playback-position user-library-read streaming user-read-playback-state user-read-recently-played playlist-read-private";

// Autherisation
function startAuth() {
    const authUrl = `${SPOTIFY_AUTH_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPE)}`;

    chrome.identity.launchWebAuthFlow(
        {
            url: authUrl,
            interactive: true,
        },
        (redirectedUrl) => {
            if (chrome.runtime.lastError || !redirectedUrl) {
                console.error("Error during authorization:", chrome.runtime.lastError);
                return;
            }

            // Extract the authorisation code from the URL
            const urlParams = new URLSearchParams(new URL(redirectedUrl).search);
            const code = urlParams.get("code");

            if (code) {
                console.log("Authorisation code received:", code);
                fetchAccessToken(code);
            }
        }
    );
}

// Get the refresh token from the autherication code
function fetchAccessToken(code) {
    console.log("Requesting access token from server...");

    fetch("http://localhost:3000/getSpotifyToken", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ code, redirect_uri: REDIRECT_URI, user_id: 1 }), // User id is hard coded to be 1 - if multiple users would need to change this
    })
    .then(response => response.json())
    .then(data => {
        if (data.access_token && data.refresh_token) {
            console.log("Access token received:", data.access_token);
            console.log("Refresh token received:", data.refresh_token);

            // log for background.js to help catch bugs
            console.log("Access token logged and sent to server successfully");

            // Store tokens or handle as needed
        } else {
            console.error("Access token or refresh token missing in response:", data);
        }
    })
    .catch(error => console.error("Error fetching tokens:", error));
}

// Call autherisation function
startAuth();


// Alarm to trigger pop up everyhour 
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("hourlyPopup", { periodInMinutes: 60 });
});

// Listen for the alarm and create the popup
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "hourlyPopup") {
        chrome.windows.create({
            url: "popup.html",
            type: "popup",
            width: 400,
            height: 600
        });
    }
});


