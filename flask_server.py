from flask import Flask, render_template_string
import mysql.connector
from mysql.connector import Error
import matplotlib.pyplot as plt
import io
import base64
from dotenv import load_dotenv
import os
import pandas as pd
import seaborn as sns

##############################
# Connecting to SQL database #
##############################
load_dotenv()

app = Flask(__name__)

def get_db_connection():
    try:
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_DATABASE')
        )
        if connection.is_connected():
            print("Connected to the database")
        return connection
    except Error as e:
        print(f"Error connecting to the database: {e}")
        return None

#######################
# Fetch data function #
#######################

def fetch_combined_data(user_id=1):
    """Fetches all necessary data for plotting, including median valence per mood_id."""
    connection = get_db_connection()
    if not connection:
        return pd.DataFrame()

    query = """
        SELECT
            moods.mood_id,
            moods.user_id,
            moods.mood_score,
            moods.arousal_score,
            moods.recorded_at AS mood_recorded_at,
            listening_history.history_id,
            listening_history.track_id,
            listening_history.track_name,
            listening_history.artist_name AS listened_artist_name,
            listening_history.listened_at,
            tracks.artist AS track_artist,
            tracks.danceability,
            tracks.energy,
            tracks.valence,
            tracks.tempo
        FROM moods
        LEFT JOIN listening_history 
            ON moods.mood_id = listening_history.mood_id 
            AND moods.user_id = listening_history.user_id
        LEFT JOIN tracks
            ON listening_history.track_id = tracks.track_id
        WHERE moods.user_id = %s;
    """

    try:
        with connection.cursor(dictionary=True, buffered=True) as cursor:
            cursor.execute(query, (user_id,))
            rows = cursor.fetchall()

        # Convert the result into a DataFrame
        df = pd.DataFrame(rows)

        # Ensure the DataFrame is not empty
        if not df.empty and 'valence' in df.columns and 'mood_id' in df.columns:
            # Calculate the median valence for each mood_id
            df['median_valence'] = df.groupby('mood_id')['valence'].transform('median')
            df['median_danceability'] = df.groupby('mood_id')['danceability'].transform('median')
            df['median_energy'] = df.groupby('mood_id')['energy'].transform('median')
            df['median_tempo'] = df.groupby('mood_id')['tempo'].transform('median')
            df['mean_valence'] = df.groupby('mood_id')['valence'].transform('mean')
            df['mean_danceability'] = df.groupby('mood_id')['danceability'].transform('mean')
            df['mean_energy'] = df.groupby('mood_id')['energy'].transform('mean')
            df['mean_tempo'] = df.groupby('mood_id')['tempo'].transform('mean')
            
        return df

    except mysql.connector.Error as e:
        print(f"Error executing query: {e}")
        return pd.DataFrame()
    finally:
        connection.close()

###########################
# Plot: Mood over time #
###########################

# Set Seaborn theme for improved visuals
sns.set_theme(style="whitegrid", palette="muted", font_scale=1.2)

def plot_mood_and_arousal(data):
    """Generates a polished line plot for Mood Score and Arousal."""
    if data.empty:
        return None  # Return None if data is empty

    data['mood_recorded_at'] = pd.to_datetime(data['mood_recorded_at'])
    last_date = data['mood_recorded_at'].max()
    seven_days_ago = last_date - pd.Timedelta(days=14)
    data = data[data['mood_recorded_at'] >= seven_days_ago]

    # Plot
    plt.figure(figsize=(12, 7))
    plt.title("Mood Score and Arousal Over time", fontsize=18, fontweight='bold')

    # Plot Mood Score
    sns.lineplot(
        x='mood_recorded_at',
        y='mood_score',
        data=data,
        marker='o',
        linewidth=2.5,
        label='Mood Score',
        color='#4C72B0'
    )

    # Plot Arousal Score
    sns.lineplot(
        x='mood_recorded_at',
        y='arousal_score',
        data=data,
        marker='o',
        linewidth=2.5,
        label='Arousal',
        color='#55A868'
    )

    # Add vertical lines
    unique_days = data['mood_recorded_at'].dt.date.unique()
    for day in unique_days:
        plt.axvline(pd.Timestamp(day), color='gray', linestyle='--', linewidth=0.6, alpha=0.6)

    plt.xlabel("Date", fontsize=14)
    plt.ylabel("Score (0-10)", fontsize=14)
    plt.xticks(rotation=45, fontsize=12)
    plt.yticks(fontsize=12)
    plt.legend(fontsize=12, loc="upper right")
    plt.tight_layout()

    # Save as base64
    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=150, bbox_inches='tight')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    buf.close()
    plt.close()
    return img_base64

def audio_features_overtime(data):
    """Generates a polished line plot for audio features over time."""
    if data.empty:
        return None

    data['mood_recorded_at'] = pd.to_datetime(data['mood_recorded_at'])
    last_date = data['mood_recorded_at'].max()
    seven_days_ago = last_date - pd.Timedelta(days=14)
    data = data[data['mood_recorded_at'] >= seven_days_ago]

    plt.figure(figsize=(12, 7))
    plt.title("Audio Features Over Time", fontsize=18, fontweight='bold')

    # Plot energy
    sns.lineplot(
        x='mood_recorded_at',
        y='median_energy',
        data=data,
        marker='o',
        linewidth=2.5,
        label='Energy',
        color='#55A868'
    )

    # Plot danceability
    sns.lineplot(
        x='mood_recorded_at',
        y='median_danceability',
        data=data,
        marker='o',
        linewidth=2.5,
        label='Danceability',
        color='#C44E52'
    )

    # Plot valence
    sns.lineplot(
        x='mood_recorded_at',
        y='median_valence',
        data=data,
        marker='o',
        linewidth=2.5,
        label='Valence',
        color='#4C72B0'
    )

    # Add vertical lines
    unique_days = data['mood_recorded_at'].dt.date.unique()
    for day in unique_days:
        plt.axvline(pd.Timestamp(day), color='gray', linestyle='--', linewidth=0.6, alpha=0.6)

    plt.xlabel("Date", fontsize=14)
    plt.ylabel("Score (0-1)", fontsize=14)
    plt.xticks(rotation=45, fontsize=12)
    plt.yticks(fontsize=12)
    plt.legend(fontsize=12, loc="upper right")
    plt.tight_layout()

    # Save as base64
    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=150, bbox_inches='tight')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    buf.close()
    plt.close()
    return img_base64

###########################
# Plot: Bubble plot  #
###########################

def create_bubble_plot(data):
    """Generates a bubble plot with mood on the x-axis, arousal on the y-axis, bubble size representing valence, and color representing energy."""
    if data.empty:
        return None  # Return None if data is empty

    # Ensure necessary columns exist
    required_columns = ['mood_score', 'arousal_score', 'median_valence', 'median_energy']
    if not all(col in data.columns for col in required_columns):
        print("Data is missing required columns for the bubble plot.")
        return None

    # Normalize valence for bubble size scaling
    data['bubble_size'] = data['median_valence'] * 1000  # Scale valence to determine bubble size

    # Create the plot
    plt.figure(figsize=(8, 6))
    scatter = plt.scatter(
        x=data['mood_score'],
        y=data['arousal_score'],
        s=data['bubble_size'],  # Bubble size
        c=data['median_energy'],  # Bubble color based on energy
        cmap='viridis',  # Color map
        alpha=0.6,
        edgecolors="w",  # Add white borders around bubbles
        linewidth=0.5
    )

    # Add labels and titles
    plt.title("Bubble Plot: Mood vs Arousal", fontsize=16)
    plt.xlabel("Mood (Sad to Happy)", fontsize=12)
    plt.ylabel("Arousal (Calm to Excited)", fontsize=12)
    plt.grid(alpha=0.3)

    # Add a color bar for energy
    cbar = plt.colorbar(scatter)
    cbar.set_label("Energy", fontsize=12)

    # Save plot to a buffer
    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=150)
    buf.seek(0)
    img_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    buf.close()
    plt.close()
    return img_base64

###################
# Plot: Box plots #
###################

def create_boxplots(data):
    """
    Generates boxplots for mood_score vs audio features: valence, energy, danceability, tempo.
    Returns the plot as a base64-encoded image.
    """
    if data.empty:
        return None  # Return None if no data
    
    # Features to plot
    audio_features = ['valence', 'energy', 'danceability', 'tempo']
    
    # Initialize the plot grid
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    axes = axes.flatten()  # Flatten the axes array for easy iteration
    
    # Create boxplots for each audio feature
    for i, feature in enumerate(audio_features):
        if feature in data.columns and 'mood_score' in data.columns:
            sns.boxplot(
                x='mood_score',
                y=feature,
                data=data,
                ax=axes[i],
                palette='viridis'
            )
            axes[i].set_title(f"Boxplot: Mood Score vs {feature.capitalize()}")
            axes[i].set_xlabel("Mood Score")
            axes[i].set_ylabel(feature.capitalize())
        else:
            axes[i].set_visible(False)  # Hide unused axes if feature is missing
    
    # Adjust layout
    plt.tight_layout()
    
    # Save plot to a buffer
    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=150)
    buf.seek(0)
    img_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    buf.close()
    plt.close()
    
    return img_base64
###########################
# Display plots on 1 page #
###########################

@app.route('/plot')
def combined_plots():
    """Route to render multiple plots on a single page."""
    
    # Fetch data
    data = fetch_combined_data(1)

    if data.empty:
        return "<h1>No data available for the specified user.</h1>"

    # Mood plot img
    mood_img = plot_mood_and_arousal(data)
    if not mood_img:
        return "<h1>Error generating the plot.</h1>"
    
    # Audio features img
    audio_img = audio_features_overtime(data)
    if not audio_img:
        return "<h1>Error generating the plot.</h1>"
    
    # Bubble plot img
    bubble_img = create_bubble_plot(data)
    if not bubble_img:
        return "<h1>Error generating the plot.</h1>"
    
    # Creat box plots img
    boxplot_img = create_boxplots(data)
    if not boxplot_img:
        return "<h1>Error generating the plot.</h1>"
    
    # Render HTML with embedded plot
# Render HTML with embedded plot

    html_content = f"""
    <!doctype html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>Combined Plots</title>
        <style>
        /* General Page Styling */
        body {{
            background-color: #121212;  /* Spotify dark grey */
            font-family: 'Arial Rounded MT Bold', Arial, sans-serif;
            color: #FFFFFF;  /* White text */
            margin: 0;
            padding: 0;
        }}

        /* Page Title Styling */
        h1 {{
            font-size: 3em;  /* Larger title */
            margin-top: 20px;
            margin-left: 5%;
            font-weight: bold;
            color: #1DB954;  /* Spotify green */
        }}

        /* Section Title Styling */
        h2 {{
            font-size: 2.2em;  /* Bigger plot titles */
            margin-left: 5%;
            margin-bottom: 10px;
            color: #FFFFFF;  /* White text */
            text-align: left;  /* Align title to the left */
        }}

        /* Container for all plots */
        .plot-container {{
            display: flex;
            flex-direction: column;  /* Stack plots vertically */
            align-items: flex-start; /* Align left */
            justify-content: center;
            width: 70%; /* Limit total width of plots */
            margin: 0 auto;  /* Center container horizontally */
        }}

        /* Individual plot box styling */
        .plot-box {{
            background-color: #282828; /* Slightly lighter grey */
            border-radius: 10px;
            box-shadow: 0px 8px 16px rgba(0, 0, 0, 0.5);
            margin: 20px 0; /* Spacing between plots */
            padding: 20px;
            width: 100%; /* Make plots smaller */
        }}

        img {{
            width: 100%;  /* Shrink image to fit container */
            border-radius: 8px;
            background-color: transparent;
        }}
        </style>
    </head>
    <body>
        <!-- Page Title -->
        <h1>Mood Analysis</h1>

        <!-- Container for plots -->
        <div class="plot-container">
        
        <!-- Plot 1 -->
        <div class="plot-box">
            <h2>Mood Score Over Time</h2>
            <img src="data:image/png;base64,{mood_img}" alt="Mood Score Over Time Plot">
        </div>

        <!-- Plot 2 -->
        <div class="plot-box">
            <h2>Audio Features Over Time</h2>
            <img src="data:image/png;base64,{audio_img}" alt="Audio Features Over Time Plot">
        </div>

        <!-- Plot 3 -->
        <div class="plot-box">
            <h2>Valence Bubble Plot</h2>
            <img src="data:image/png;base64,{bubble_img}" alt="Valence Bubble Plot">
        </div>

        <!-- Plot 4 -->
        <div class="plot-box">
            <h2>Audio Feature Box Plot</h2>
            <img src="data:image/png;base64,{boxplot_img}" alt="Audio Feature Box Plot">
        </div>

        </div>
    </body>
    </html>
    """

    return render_template_string(html_content)

if __name__ == '__main__':
    app.run(port=5000, debug=True)
