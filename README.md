# Mood Tracker Auth - Chrome Extension

## Description

**Mood Tracker Auth** is a Chrome extension integrated with Spotify to track your mood and listening habits. It uses Spotify's OAuth for authentication and offers an engaging user interface to monitor your mood over time. The data collected is processed using a Flask server and stored in a MySQL database for further analysis. This is coded to work on port 3000 (sending data to mySQL) and port 5000 (retrieveing data from SQL for plots), make sure these ports are clear or change the port used in the code. 

## Features

- **Spotify OAuth Integration**: Securely authenticate with your Spotify account to track listening history.
- **Mood Tracking**: Rate your current mood and arousal on a scale of 1 to 10.
- **Recently Played Tracks**: Sync and store your recently played Spotify tracks.
- **Analysis Visualisation**: View detailed visualisations of your mood trends and listening history through a Flask server.
- **Hourly Reminders**: Automatically prompt you to update your mood every hour.

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Flask, Node.js (Express)
- **Database**: MySQL
- **Spotify API**: For fetching listening data and user playback information.

## Installation

### Prerequisites

- Chrome browser
- Node.js installed on your system
- MySQL server running
- Python environment set up with Flask

### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/mood-tracker-auth.git
   cd mood-tracker-auth

2. Install dependencies for the Node.js server:
   ```bash
   cd server
   npm install

3. Set up the .env file for the server:
   ```plaintext
   SPOTIFY_CLIENT_ID=<Your Spotify Client ID>
   SPOTIFY_CLIENT_SECRET=<Your Spotify Client Secret>
   SPOTIFY_REDIRECT_URI=<Your Redirect URI>
   DB_HOST=<Database Host>
   DB_USER=<Database User>
   DB_PASSWORD=<Database Password>
   DB_DATABASE=<Database Name>

4. Import the provided SQL schema into your MySQL database:
   ```bash
   mysql -u <username> -p <database_name> < spotify_mood_tracker.sql
     
5. Run the Node.js server:
   ```bash
   node server.js
      
6. Set up the Flask server:
- Navigate to the Flask directory.
- Install Python dependencies:
  ```bash
  pip install -r requirements.txt  
- Start the Flask server:
    ```bash
    python flask_server.py

7. Load the Chrome extension:
- Open Chrome and go to chrome://extensions.
- Enable **Developer mode**.
- Click **Load unpacked** and select the directory containing the extension files.


### Usage
1. Open the extension by clicking on its icon in the Chrome toolbar.
2. Authenticate with your Spotify account.
3. Use the sliders to rate your mood and arousal, then click **Submit Mood**.
4. Check your mood and listening trends by clicking **Show Analysis**.

### File Structure
- **background.js:** Handles background tasks like Spotify authentication and hourly reminders.
- **popup.html:** Provides the user interface for mood tracking.
- **popup.js:** Contains the logic for mood submission and interaction with the backend.
- **server.js:** Node.js backend for managing Spotify API interactions and database operations.
- **flask_server.py:** Flask server for visualising mood and listening data.
- **flask_styles.css:** Styles the Flask server for the plots of the user's data.
- **styles.css:** Styling for the extension's popup interface.
- **spotify_mood_tracker.sql:** SQL schema for setting up the MySQL database.
