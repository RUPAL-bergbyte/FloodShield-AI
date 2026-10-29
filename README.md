# 🌊 FloodShield AI
### AI-Powered Flood Risk Intelligence & Urban Rescue Support

**Predict risk. Visualize threats. Support faster decisions.**

FloodShield AI is an AI-driven flood-risk analysis platform designed to explore how machine learning, live weather data, and interactive mapping can support urban flood preparedness and disaster-response planning.

Built for the **Civilathon — Civil Engineering Innovation Challenge**, FloodShield AI combines a machine-learning prediction engine with weather insights and a map-based interface to demonstrate a smarter approach to flood-risk awareness.

---

## 🚀 Project Highlights

- 🤖 **Machine Learning Engine** — Uses a Random Forest classification model to estimate flood-risk categories from selected environmental inputs.
- 🌦️ **Live Weather Integration** — Retrieves available weather information through the Open-Meteo API.
- 🗺️ **Interactive Risk Map** — Uses Leaflet maps to provide geographic context for flood-risk exploration.
- 📊 **Six-Hour Weather Outlook** — Presents forecast information to support scenario analysis.
- ⚡ **Instant Scenario Analysis** — Submit weather parameters and receive a model-generated risk category and explanation.
- 🖥️ **Interactive Web Dashboard** — A modern interface built to make flood-risk information easier to explore.
- 🌱 **Sustainability Focus** — Encourages proactive urban planning, preparedness, and climate-resilience discussions.

---

## 💡 The Problem

Urban areas can experience flooding when intense rainfall, inadequate drainage, and local environmental conditions combine. Delayed access to useful weather and risk information can make preparedness and response planning more difficult.

## 🛡️ Our Solution

FloodShield AI demonstrates a unified platform that brings together:

1. **Weather intelligence** to access current conditions and forecast data.
2. **ML-based risk classification** to analyze selected scenario inputs.
3. **Interactive mapping** to provide geographic context.
4. **A decision-support dashboard** to present predictions and relevant information in one place.

The goal is to demonstrate how accessible AI and geospatial tools can contribute to flood-awareness workflows.

---

## ⚙️ How It Works

```text
Weather Data / User Inputs
           │
           ▼
   Data Processing
           │
           ▼
 Random Forest ML Model
           │
           ▼
   Flood-Risk Category
           │
           ▼
 Dashboard + Interactive Map
           │
           ▼
 Risk Awareness & Planning
```

---

## 🧰 Technology Stack

| Technology | Purpose |
|---|---|
| Python | Core application and ML workflow |
| Flask | Web application and API backend |
| Scikit-learn | Random Forest classification |
| Pandas | Dataset processing |
| Joblib | Saving and loading the trained model |
| Requests | Fetching weather data |
| Open-Meteo API | Weather and forecast information |
| Leaflet.js | Interactive map visualization |
| HTML5 & CSS3 | Interface structure and styling |
| JavaScript | Dashboard interactions and API communication |

---

## 🧠 Machine Learning Approach

FloodShield AI uses a **Random Forest classifier** to assign an input scenario to one of five risk classes, represented by labels from `0` to `4`.

The project dataset includes environmental features such as:

- Rainfall amount (`rainfall_mm`)
- Rainfall period (`rainfall_period_hours`)
- Wind speed (`wind_speed_kmh`)
- Humidity (`humidity_percent`)
- Event type

The model was previously evaluated at **70% validation accuracy on a 20-record validation split**. This is an early experimental result, not evidence of reliable real-world flood prediction. Further testing with larger, geographically representative, real-world datasets is necessary.

---

## 🏗️ Project Structure

```text
FloodShield-AI/
├── app.py
├── train_model.py
├── data/
│   ├── all_events.csv
│   └── floodshield_model.joblib
├── templates/
│   ├── index.html
│   └── workspace.html
├── static/
│   ├── script.js
│   ├── style.css
│   └── landing.css
├── .gitignore
└── README.md
```

*The structure above reflects the current project layout; filenames may vary if you reorganize the project.*

---

## 💻 Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/RUPAL-bergbyte/FloodShield-AI.git
cd FloodShield-AI
```

### 2. Create a virtual environment

```bash
python -m venv .venv
```

Activate it in **Git Bash on Windows**:

```bash
source .venv/Scripts/activate
```

### 3. Install dependencies

```bash
python -m pip install flask pandas scikit-learn requests joblib
```

### 4. Start the application

```bash
python app.py
```

### 5. Open the dashboard

Open your browser and visit:

**http://127.0.0.1:5000**

Keep the terminal running while using the application.

---

## 🔮 Future Scope

- 🌧️ Incorporate historical rainfall and flood-event datasets.
- 🛰️ Add GIS layers for elevation, drainage networks, and flood-prone zones.
- 📡 Integrate IoT water-level sensors where reliable data is available.
- 📈 Improve model evaluation with larger datasets and independent test locations.
- 📍 Add verified local flood reports and geographic risk layers.
- 🚨 Explore configurable alerts after validating the prediction system.
- 🏙️ Develop city-specific decision-support tools for urban resilience planning.

---

## 🌍 Expected Impact

**Environmental:** Supports exploration of climate-resilient and sustainable urban planning.

**Social:** Demonstrates how accessible weather and risk information could improve public awareness and preparedness.

**Technical:** Combines machine learning, weather APIs, web development, and interactive geospatial visualization in one project.

**Economic:** Could help planners explore preventive strategies and prioritize further investigation of vulnerable areas, subject to real-world validation.

---

## ⚠️ Important Disclaimer

FloodShield AI is an **educational research prototype and demonstration project**. Its predictions have not been validated as operational flood forecasts. The model's output must not be used as an official warning, for emergency decisions, or as a substitute for verified meteorological information and guidance from local authorities.

Live weather availability and accuracy depend on the external data provider.

---

## 👨‍💻 Project Information

**Project:** FloodShield AI  
**Challenge:** Civilathon — Civil Engineering Innovation Challenge  
**Domain:** Artificial Intelligence & Machine Learning for Disaster Management  
**Repository:** [RUPAL-bergbyte/FloodShield-AI](https://github.com/RUPAL-bergbyte/FloodShield-AI)

---

### 🌊 Building smarter, more resilient cities with AI.

*Predict risk. Visualize threats. Support faster decisions.*
