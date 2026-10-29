import math
import requests
from pathlib import Path
import joblib
import pandas as pd
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# ============================================================
# 1. PROJECT CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "data" / "floodshield_model.joblib"

# ============================================================
# 2. LOAD TRAINED MACHINE-LEARNING MODEL
# ============================================================

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model file not found: {MODEL_PATH}\n"
        "Please ensure floodshield_model.joblib exists inside data/."
    )

model = joblib.load(MODEL_PATH)

app.logger.info("FloodShield AI model loaded successfully.")


# ============================================================
# 3. RISK CLASSIFICATION INFORMATION
# ============================================================

RISK_INFO = {
    0: {
        "category": "Very Low",
        "description": (
            "The model predicts the lowest dataset risk category. "
            "Continue monitoring local weather conditions."
        ),
    },
    1: {
        "category": "Low",
        "description": (
            "The model predicts a low dataset risk category. "
            "Remain aware of changing weather conditions."
        ),
    },
    2: {
        "category": "Moderate",
        "description": (
            "The model predicts a moderate dataset risk category. "
            "Monitor official weather updates and local drainage conditions."
        ),
    },
    3: {
        "category": "High",
        "description": (
            "The model predicts a high dataset risk category. "
            "Review local safety plans and follow official advisories."
        ),
    },
    4: {
        "category": "Very High",
        "description": (
            "The model predicts the highest dataset risk category. "
            "Follow official emergency guidance and avoid flooded roads."
        ),
    },
}

ALLOWED_EVENTS = {
    "Heavy Rain",
    "Flood",
    "Storm",
    "Storm Surge",
    "Typhoon",
}


# ============================================================
# 4. HOME PAGE
# ============================================================
@app.route("/")
def home():
    return render_template("index.html")


@app.route("/workspace")
def workspace():
    return render_template("workspace.html")
# ============================================================
# 5. FLOOD RISK PREDICTION API
# ============================================================

@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Validate the submitted weather scenario and return the
    Random Forest model's predicted dataset risk classification.
    """

    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "success": False,
                "error": (
                    "Invalid request. Please submit the analysis form again."
                ),
            }), 400

        # ----------------------------------------------------
        # Read numerical inputs
        # ----------------------------------------------------

        required_fields = {
            "rainfall_mm": "Rainfall",
            "rainfall_period_hours": "Rainfall duration",
            "wind_speed_kmh": "Wind speed",
            "humidity_percent": "Humidity",
        }

        values = {}

        for field, label in required_fields.items():
            try:
                value = float(data[field])
            except (KeyError, TypeError, ValueError):
                return jsonify({
                    "success": False,
                    "error": f"Please enter a valid number for {label}.",
                }), 400

            if not math.isfinite(value):
                return jsonify({
                    "success": False,
                    "error": f"{label} must be a finite number.",
                }), 400

            values[field] = value

        rainfall = values["rainfall_mm"]
        duration = values["rainfall_period_hours"]
        wind = values["wind_speed_kmh"]
        humidity = values["humidity_percent"]

        # ----------------------------------------------------
        # Validate numerical ranges
        # ----------------------------------------------------

        if not 0 <= rainfall <= 2000:
            return jsonify({
                "success": False,
                "error": "Rainfall must be between 0 and 2000 mm.",
            }), 400

        if not 0.1 <= duration <= 720:
            return jsonify({
                "success": False,
                "error": (
                    "Rainfall duration must be between 0.1 and 720 hours."
                ),
            }), 400

        if not 0 <= wind <= 500:
            return jsonify({
                "success": False,
                "error": "Wind speed must be between 0 and 500 km/h.",
            }), 400

        if not 0 <= humidity <= 100:
            return jsonify({
                "success": False,
                "error": "Humidity must be between 0 and 100 percent.",
            }), 400

        # ----------------------------------------------------
        # Validate weather event
        # ----------------------------------------------------

        event_type = str(data.get("event_type", "")).strip()

        if event_type not in ALLOWED_EVENTS:
            return jsonify({
                "success": False,
                "error": "Please select a valid weather event.",
            }), 400

        # ----------------------------------------------------
        # Prepare model input
        # IMPORTANT: Feature names must match training data.
        # ----------------------------------------------------

        features = pd.DataFrame([{
            "rainfall_mm": rainfall,
            "rainfall_period_hours": duration,
            "wind_speed_kmh": wind,
            "humidity_percent": humidity,
            "event_type": event_type,
        }])

        # ----------------------------------------------------
        # Run model prediction
        # ----------------------------------------------------

        prediction = model.predict(features)
        predicted_level = int(prediction[0])

        risk = RISK_INFO.get(predicted_level)

        if risk is None:
            app.logger.error(
                "Unexpected risk class returned by model: %s",
                predicted_level,
            )

            return jsonify({
                "success": False,
                "error": "The model returned an unknown risk category.",
            }), 500

        # ----------------------------------------------------
        # Return JSON response for the frontend
        # ----------------------------------------------------

        return jsonify({
            "success": True,

            # Fields used by the updated script.js
            "risk_level": predicted_level,
            "category": risk["category"],
            "description": risk["description"],

            # Submitted scenario details
            "input": {
                "rainfall_mm": rainfall,
                "duration_hours": duration,
                "wind_speed_kmh": wind,
                "humidity_percent": humidity,
                "event_type": event_type,
            },

            # Important research limitation
            "notice": (
                "Research prototype: this classification represents "
                "a dataset risk label. It is not a validated local flood "
                "forecast, a probability of flooding, or an official "
                "emergency warning."
            ),
        })

    except Exception:
        app.logger.exception("Flood risk prediction failed.")

        return jsonify({
            "success": False,
            "error": (
                "Analysis could not be completed. "
                "Check the VS Code terminal for technical details."
            ),
        }), 500


# ============================================================
# 6. HOURLY WEATHER FORECAST — SELECTED MAP LOCATION
# ============================================================

@app.route("/api/weather", methods=["GET"])
def get_live_weather():
    """
    Fetch current conditions and the next six hourly precipitation
    forecast periods for the selected coordinates.

    The six-hour rainfall total is a forecast sum, not measured
    rainfall and not a validated flood prediction.
    """
    try:
        latitude = float(request.args.get("lat", 23.2599))
        longitude = float(request.args.get("lon", 77.4126))
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "error": "Invalid latitude or longitude.",
        }), 400

    if not (
        math.isfinite(latitude)
        and math.isfinite(longitude)
        and -90 <= latitude <= 90
        and -180 <= longitude <= 180
    ):
        return jsonify({
            "success": False,
            "error": "Coordinates are outside the valid range.",
        }), 400

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": (
            "precipitation,"
            "relative_humidity_2m,"
            "wind_speed_10m"
        ),
        "hourly": (
            "precipitation,"
            "precipitation_probability,"
            "relative_humidity_2m,"
            "wind_speed_10m"
        ),
        "forecast_days": 2,
        "timezone": "auto",
    }

    try:
        response = requests.get(url, params=params, timeout=20)
        response.raise_for_status()
        weather_data = response.json()

        current = weather_data.get("current", {})
        hourly = weather_data.get("hourly", {})

        current_required = (
            "precipitation",
            "relative_humidity_2m",
            "wind_speed_10m",
            "time",
        )
        hourly_required = (
            "time",
            "precipitation",
            "precipitation_probability",
            "relative_humidity_2m",
            "wind_speed_10m",
        )

        if any(current.get(key) is None for key in current_required):
            return jsonify({
                "success": False,
                "error": "Current weather data is incomplete. Please try again.",
            }), 502

        if any(hourly.get(key) is None for key in hourly_required):
            return jsonify({
                "success": False,
                "error": "Hourly forecast data is incomplete. Please try again.",
            }), 502

        # Select the first hourly forecast timestamp at or after the
        # current API time, then take six consecutive hourly periods.
        from datetime import datetime

        current_time_text = str(current["time"])
        try:
            current_time = datetime.fromisoformat(current_time_text)
        except ValueError:
            current_time = None

        hourly_times = hourly["time"]
        start_index = 0

        if current_time is not None:
            for index, time_text in enumerate(hourly_times):
                try:
                    forecast_time = datetime.fromisoformat(str(time_text))
                except ValueError:
                    continue

                if forecast_time >= current_time:
                    start_index = index
                    break

        end_index = min(start_index + 6, len(hourly_times))
        if end_index - start_index < 6:
            start_index = max(0, len(hourly_times) - 6)
            end_index = len(hourly_times)

        forecast = []
        for index in range(start_index, end_index):
            values = {
                "time": hourly["time"][index],
                "precipitation_mm": hourly["precipitation"][index],
                "precipitation_probability_percent":
                    hourly["precipitation_probability"][index],
                "humidity_percent": hourly["relative_humidity_2m"][index],
                "wind_speed_kmh": hourly["wind_speed_10m"][index],
            }

            # Missing forecast values should not silently become zero.
            if any(value is None for key, value in values.items() if key != "time"):
                return jsonify({
                    "success": False,
                    "error": "One or more hourly forecast values are unavailable.",
                }), 502

            numeric_values = [
                float(values["precipitation_mm"]),
                float(values["precipitation_probability_percent"]),
                float(values["humidity_percent"]),
                float(values["wind_speed_kmh"]),
            ]
            if not all(math.isfinite(value) for value in numeric_values):
                return jsonify({
                    "success": False,
                    "error": "The weather service returned invalid forecast values.",
                }), 502

            forecast.append({
                "time": str(values["time"]),
                "precipitation_mm": round(numeric_values[0], 2),
                "precipitation_probability_percent": round(numeric_values[1], 1),
                "humidity_percent": round(numeric_values[2], 1),
                "wind_speed_kmh": round(numeric_values[3], 1),
            })

        if not forecast:
            return jsonify({
                "success": False,
                "error": "No hourly forecast periods were available.",
            }), 502

        current_rainfall = float(current["precipitation"])
        current_humidity = float(current["relative_humidity_2m"])
        current_wind = float(current["wind_speed_10m"])

        six_hour_total = sum(
            item["precipitation_mm"] for item in forecast
        )

        if not all(math.isfinite(value) for value in (
            current_rainfall, current_humidity, current_wind, six_hour_total
        )):
            raise ValueError("Weather data contains invalid numeric values.")

        return jsonify({
            "success": True,
            "location": f"{latitude:.5f}, {longitude:.5f}",
            "latitude": latitude,
            "longitude": longitude,
            "timezone": weather_data.get("timezone", "local time"),
            "current_time": str(current["time"]),
            "current_precipitation_mm": round(current_rainfall, 2),
            "current_humidity_percent": round(current_humidity, 1),
            "current_wind_speed_kmh": round(current_wind, 1),

            # Compatibility fields used by the existing form.
            # Rainfall is now the sum of the returned hourly forecast periods.
            "rainfall": round(six_hour_total, 2),
            "duration": len(forecast),
            "humidity": round(current_humidity, 1),
            "wind": round(current_wind, 1),

            "forecast_hours": len(forecast),
            "forecast_rainfall_total_mm": round(six_hour_total, 2),
            "hourly_forecast": forecast,
            "note": (
                f"Rainfall input is the forecast total across {len(forecast)} "
                "hourly periods. It is not observed rainfall. Humidity and wind "
                "form inputs use current API values. Weather-model data can "
                "differ from conditions at the exact selected point."
            ),
        })

    except requests.RequestException:
        app.logger.exception("Open-Meteo weather request failed.")
        return jsonify({
            "success": False,
            "error": (
                "Could not fetch weather data. Check your internet connection "
                "and try again."
            ),
        }), 502

    except (TypeError, ValueError, IndexError):
        app.logger.exception("Invalid Open-Meteo weather response.")
        return jsonify({
            "success": False,
            "error": "The weather service returned invalid or incomplete data.",
        }), 502


# ============================================================
# 7. RUN FLASK APPLICATION
# ============================================================

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True,
    )
