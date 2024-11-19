USE spotify_mood_tracker;

CREATE TABLE tracks (
    track_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    artist VARCHAR(255),
    danceability FLOAT,
    energy FLOAT,
    valence FLOAT,
    tempo FLOAT
);
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    user_identifier VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE spotify_tokens (
    token_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    access_token VARCHAR(512) NOT NULL,
    refresh_token VARCHAR(512) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
-- Recreate the moods table
CREATE TABLE moods (
    mood_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    mood_score INT NOT NULL,
    arousal_score INT NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate the listening_history table
CREATE TABLE listening_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    mood_id INT,  -- Foreign key reference to moods
    user_id INT,
    track_id VARCHAR(255) NOT NULL,
    track_name VARCHAR(255),
    artist_name VARCHAR(255),
    listened_at TIMESTAMP,
    FOREIGN KEY (mood_id) REFERENCES moods(mood_id) ON DELETE CASCADE
);

