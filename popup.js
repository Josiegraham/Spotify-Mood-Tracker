// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const moodSlider = document.getElementById('mood-slider');
  const moodValue = document.getElementById('mood-value');
  const arousalSlider = document.getElementById('arousal-slider');
  const arousalValue = document.getElementById('arousal-value');
  const submitButton = document.getElementById('submit-mood');
  const showAnalysisButton = document.getElementById('showAnalysis');

  // Display initial values
  moodValue.textContent = `Mood: ${moodSlider.value}`;
  arousalValue.textContent = `Arousal: ${arousalSlider.value}`;

  // Update mood value display
  moodSlider.addEventListener('input', () => {
    moodValue.textContent = `Mood: ${moodSlider.value}`;
  });

  // Update arousal value display
  arousalSlider.addEventListener('input', () => {
    arousalValue.textContent = `Arousal: ${arousalSlider.value}`;
  });

  // Handle submit
  submitButton.addEventListener('click', () => {
    const mood = parseInt(moodSlider.value);
    const arousal = parseInt(arousalSlider.value);
    const user_id = 1;

    fetch("http://localhost:3000/submitMood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, mood_score: mood, arousal_score: arousal }),
    })
    .then(response => response.json())
    .then(data => {
      console.log("Mood and arousal submitted successfully:", data);

      // Fetch and store recently played tracks
      return fetch("http://localhost:3000/fetchRecentlyPlayed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, mood_id: data.mood_id })
      });
    })
    .then(trackResponse => trackResponse.json())
    .then(trackData => {
      console.log("Tracks fetched and stored:", trackData);
      // Close the popup automatically after successful submission
      window.close();
    })
    .catch(error => console.error("Error in mood submission or fetching tracks:", error));
  });

  // Show Analysis page
  showAnalysisButton.addEventListener('click', () => {
    // Open the Flask analysis page
    window.open('http://127.0.0.1:5000/plot', '_blank');
  });
}); // <-- Ensure this closing bracket is here






