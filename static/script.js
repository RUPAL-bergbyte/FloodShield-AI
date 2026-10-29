
document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // ==========================================
    // 1. GET HTML ELEMENTS
    // ==========================================

    const predictionForm = document.getElementById("prediction-form");
    const predictButton = document.getElementById("predict-button");
    const formMessage = document.getElementById("form-message");

    const liveWeatherButton = document.getElementById("live-weather-button");
    const weatherStatus = document.getElementById("weather-status");
    const mapStatus = document.getElementById("map-status");

    const rainfallInput = document.getElementById("rainfall");
    const durationInput = document.getElementById("duration");
    const windInput = document.getElementById("wind");
    const humidityInput = document.getElementById("humidity");
    const eventTypeInput = document.getElementById("event-type");

    const resultPlaceholder = document.getElementById("result-placeholder");
    const resultSection = document.getElementById("result");
    const riskCategory = document.getElementById("risk-category");
    const riskBar = document.getElementById("risk-bar");
    const riskDescription = document.getElementById("risk-description");

    const outputLevel = document.getElementById("output-level");
    const outputRainfall = document.getElementById("output-rainfall");
    const outputDuration = document.getElementById("output-duration");
    const outputEvent = document.getElementById("output-event");

    // ==========================================
    // 2. GENERAL HELPER FUNCTIONS
    // ==========================================

    function showMessage(message, type = "info") {
        if (!formMessage) return;

        formMessage.textContent = message;
        formMessage.className = `form-message ${type}`;
    }

    function setButtonLoading(button, isLoading, loadingText, normalText) {
        if (!button) return;

        button.disabled = isLoading;
        button.textContent = isLoading ? loadingText : normalText;
    }

    function formatNumber(value, decimals = 1) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "—";
        }

        return number.toFixed(decimals);
    }

    function displayValue(element, value) {
        if (!element) return;

        element.textContent =
            value === null || value === undefined || value === ""
                ? "—"
                : String(value);
    }

    function isValidNumber(value) {
        return (
            value !== null &&
            value !== undefined &&
            value !== "" &&
            Number.isFinite(Number(value))
        );
    }

    async function fetchJSON(url, options = {}) {
        const response = await fetch(url, options);
        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
            throw new Error(
                "The server returned an unexpected response. " +
                "Check that Flask is running and the requested API route exists."
            );
        }

        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(
                data.error ||
                data.message ||
                `Request failed (${response.status}).`
            );
        }

        return data;
    }

    // ==========================================
    // 3. LEAFLET MAP
    // ==========================================

    let map = null;
    let streetLayer = null;
    let locationMarker = null;

    // Default monitoring location: Bhopal, Madhya Pradesh.
    const defaultLatitude = 23.2599;
    const defaultLongitude = 77.4126;

    let selectedLatitude = defaultLatitude;
    let selectedLongitude = defaultLongitude;

    function updateMapStatus(message) {
        if (mapStatus) {
            mapStatus.textContent = message;
        }
    }

    function initializeMap() {
        const mapElement = document.getElementById("map");

        if (!mapElement) return;

        if (typeof L === "undefined") {
            updateMapStatus(
                "Map library could not load. Check your internet connection."
            );
            return;
        }

        try {
            map = L.map(mapElement).setView(
                [defaultLatitude, defaultLongitude],
                12
            );

            streetLayer = L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    maxZoom: 19,
                    attribution: "&copy; OpenStreetMap contributors"
                }
            );

            streetLayer.addTo(map);

            L.control.layers({
                "Street map": streetLayer
            }).addTo(map);

            locationMarker = L.marker([
                defaultLatitude,
                defaultLongitude
            ]).addTo(map);

            locationMarker.bindPopup(
                "<strong>FloodShield AI</strong><br>" +
                "Bhopal monitoring location"
            );

            map.on("click", (event) => {
                selectedLatitude = event.latlng.lat;
                selectedLongitude = event.latlng.lng;

                locationMarker.setLatLng([
                    selectedLatitude,
                    selectedLongitude
                ]);

                // Coordinates are generated locally by Leaflet.
                locationMarker.setPopupContent(
                    `<strong>Selected monitoring location</strong><br>` +
                    `Latitude: ${selectedLatitude.toFixed(5)}<br>` +
                    `Longitude: ${selectedLongitude.toFixed(5)}`
                );

                locationMarker.openPopup();

                updateMapStatus(
                    `Selected location: ${selectedLatitude.toFixed(4)}, ` +
                    `${selectedLongitude.toFixed(4)}`
                );

                if (weatherStatus) {
                    weatherStatus.textContent =
                        "Location changed. Fetch the forecast to update weather data.";
                }
            });

            updateMapStatus(
                "Map ready. Click anywhere on the map to select a monitoring location."
            );

            // Correct map rendering after the layout has loaded.
            window.setTimeout(() => {
                if (map) {
                    map.invalidateSize();
                }
            }, 300);

        } catch (error) {
            console.error("Map initialization error:", error);
            updateMapStatus("Unable to initialize the map.");
        }
    }

    // ==========================================
    // 4. FORECAST DATA HELPERS
    // ==========================================

    function getHourlyRainfall(hour) {
        // Supports both current and earlier API field names.
        const value =
            hour?.precipitation_mm ??
            hour?.precipitation;

        return isValidNumber(value) ? Number(value) : null;
    }

    function getRainProbability(hour) {
        const value =
            hour?.precipitation_probability_percent ??
            hour?.precipitation_probability;

        if (!isValidNumber(value)) return null;

        return Math.max(0, Math.min(100, Number(value)));
    }

    function formatForecastTime(timeValue, index) {
        if (!timeValue) {
            return `Hour ${index + 1}`;
        }

        // Open-Meteo may return a local timestamp without a timezone.
        const parsedTime = new Date(timeValue);

        if (Number.isNaN(parsedTime.getTime())) {
            return String(timeValue);
        }

        return parsedTime.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined && text !== null) {
            element.textContent = String(text);
        }

        return element;
    }

    function getOrCreateForecastPanel() {
        let panel = document.getElementById("hourly-forecast");

        if (panel) {
            return panel;
        }

        const weatherSection =
            document.querySelector(".live-weather-section") ||
            (liveWeatherButton ? liveWeatherButton.parentElement : null);

        if (!weatherSection) {
            return null;
        }

        panel = document.createElement("section");
        panel.id = "hourly-forecast";
        panel.className = "fs-forecast-panel";
        panel.setAttribute("aria-live", "polite");

        weatherSection.appendChild(panel);

        return panel;
    }

    // ==========================================
    // 5. PROFESSIONAL SIX-HOUR FORECAST DASHBOARD
    // ==========================================

    function displayHourlyForecast(forecast, fallbackTotal = null) {
        const panel = getOrCreateForecastPanel();

        const validForecast =
            Array.isArray(forecast) ? forecast : [];

        const rainfallValues = validForecast.map(getHourlyRainfall);
        const probabilityValues = validForecast.map(getRainProbability);

        const allRainfallValuesAvailable =
            rainfallValues.length > 0 &&
            rainfallValues.every(value => value !== null);

        const calculatedTotal = allRainfallValuesAvailable
            ? rainfallValues.reduce((sum, value) => sum + value, 0)
            : null;

        const totalRainfall = calculatedTotal !== null
            ? calculatedTotal
            : isValidNumber(fallbackTotal)
                ? Number(fallbackTotal)
                : null;

        const duration = validForecast.length > 0
            ? validForecast.length
            : null;

        const availableProbabilities = probabilityValues.filter(
            value => value !== null
        );

        const averageProbability = availableProbabilities.length > 0
            ? availableProbabilities.reduce((sum, value) => sum + value, 0) /
                availableProbabilities.length
            : null;

        // Return the same rainfall total used in the dashboard.
        // loadWeather() uses this value to populate the prediction form.
        const result = {
            rainfall: totalRainfall,
            duration: duration
        };

        if (!panel) {
            return result;
        }

        panel.replaceChildren();

        // ---------- Dashboard header ----------

        const header = createElement("div", "fs-forecast-header");

        const headingGroup = createElement("div", "fs-heading-group");

        headingGroup.appendChild(
            createElement(
                "p",
                "fs-eyebrow",
                "FLOODSHIELD AI / WEATHER INTELLIGENCE"
            )
        );

        headingGroup.appendChild(
            createElement("h3", "fs-forecast-title", "6-Hour Rainfall Outlook")
        );

        headingGroup.appendChild(
            createElement(
                "p",
                "fs-forecast-subtitle",
                "Hourly precipitation estimates for the selected map location."
            )
        );

        const badge = createElement("span", "fs-forecast-badge", "FORECAST");

        header.appendChild(headingGroup);
        header.appendChild(badge);
        panel.appendChild(header);

        if (validForecast.length === 0) {
            const emptyState = createElement(
                "div",
                "fs-forecast-empty",
                "Hourly forecast data is unavailable. Try fetching the weather again."
            );

            panel.appendChild(emptyState);

            return result;
        }

        // ---------- Summary metrics ----------

        const summary = createElement("div", "fs-forecast-summary");

        const rainfallMetric = createElement("div", "fs-summary-card");
        rainfallMetric.appendChild(
            createElement("span", "fs-metric-label", "TOTAL RAINFALL")
        );
        rainfallMetric.appendChild(
            createElement(
                "strong",
                "fs-metric-value",
                totalRainfall !== null
                    ? `${formatNumber(totalRainfall, 1)} mm`
                    : "Unavailable"
            )
        );
        rainfallMetric.appendChild(
            createElement(
                "span",
                "fs-metric-caption",
                calculatedTotal !== null
                    ? "Sum of displayed hourly estimates"
                    : "Using server-provided total, if available"
            )
        );

        const durationMetric = createElement("div", "fs-summary-card");
        durationMetric.appendChild(
            createElement("span", "fs-metric-label", "FORECAST WINDOW")
        );
        durationMetric.appendChild(
            createElement(
                "strong",
                "fs-metric-value",
                `${validForecast.length} hour${validForecast.length === 1 ? "" : "s"}`
            )
        );
        durationMetric.appendChild(
            createElement(
                "span",
                "fs-metric-caption",
                "Available hourly forecast periods"
            )
        );

        const probabilityMetric = createElement("div", "fs-summary-card");
        probabilityMetric.appendChild(
            createElement("span", "fs-metric-label", "AVERAGE RAIN CHANCE")
        );
        probabilityMetric.appendChild(
            createElement(
                "strong",
                "fs-metric-value",
                averageProbability !== null
                    ? `${Math.round(averageProbability)}%`
                    : "Unavailable"
            )
        );
        probabilityMetric.appendChild(
            createElement(
                "span",
                "fs-metric-caption",
                "Average of available hourly probabilities"
            )
        );

        summary.appendChild(rainfallMetric);
        summary.appendChild(durationMetric);
        summary.appendChild(probabilityMetric);

        panel.appendChild(summary);

        // ---------- Hourly forecast cards ----------

        panel.appendChild(
            createElement("h4", "fs-section-title", "Hourly breakdown")
        );

        const grid = createElement("div", "fs-hourly-grid");

        const maximumRainfall = Math.max(
            1,
            ...rainfallValues.filter(value => value !== null)
        );

        validForecast.forEach((hour, index) => {
            const rainfall = rainfallValues[index];
            const probability = probabilityValues[index];

            const card = createElement("article", "fs-hour-card");

            const cardHeader = createElement("div", "fs-hour-card-header");

            cardHeader.appendChild(
                createElement(
                    "span",
                    "fs-hour-time",
                    formatForecastTime(hour.time, index)
                )
            );

            cardHeader.appendChild(
                createElement(
                    "span",
                    "fs-hour-index",
                    String(index + 1).padStart(2, "0")
                )
            );

            const rainfallValue = createElement(
                "strong",
                "fs-hour-rainfall",
                rainfall !== null
                    ? `${formatNumber(rainfall, 1)} mm`
                    : "Unavailable"
            );

            const rainfallLabel = createElement(
                "span",
                "fs-hour-label",
                "Expected precipitation"
            );

            const track = createElement("div", "fs-rain-track");
            track.setAttribute("role", "img");
            track.setAttribute(
                "aria-label",
                rainfall !== null
                    ? `${formatNumber(rainfall, 1)} millimetres of expected precipitation`
                    : "Rainfall estimate unavailable"
            );

            const fill = createElement("div", "fs-rain-fill");

            const barWidth = rainfall !== null
                ? Math.max(0, Math.min(100, (rainfall / maximumRainfall) * 100))
                : 0;

            fill.style.width = `${barWidth}%`;
            track.appendChild(fill);

            const probabilityRow = createElement(
                "div",
                "fs-probability-row"
            );

            probabilityRow.appendChild(
                createElement("span", "fs-probability-label", "Rain chance")
            );

            probabilityRow.appendChild(
                createElement(
                    "strong",
                    "fs-probability-value",
                    probability !== null
                        ? `${Math.round(probability)}%`
                        : "—"
                )
            );

            card.appendChild(cardHeader);
            card.appendChild(rainfallValue);
            card.appendChild(rainfallLabel);
            card.appendChild(track);
            card.appendChild(probabilityRow);

            grid.appendChild(card);
        });

        panel.appendChild(grid);

        // ---------- Rainfall trend chart ----------

        const trendSection = createElement("section", "fs-trend-section");

        trendSection.appendChild(
            createElement("h4", "fs-section-title", "Rainfall intensity trend")
        );

        trendSection.appendChild(
            createElement(
                "p",
                "fs-trend-caption",
                "Relative rainfall amount across the available forecast hours."
            )
        );

        const chart = createElement("div", "fs-rain-chart");
        chart.setAttribute("role", "img");
        chart.setAttribute(
            "aria-label",
            "Bar chart comparing estimated rainfall for each forecast hour."
        );

        validForecast.forEach((hour, index) => {
            const rainfall = rainfallValues[index];

            const column = createElement("div", "fs-chart-column");

            const amount = createElement(
                "span",
                "fs-chart-amount",
                rainfall !== null ? formatNumber(rainfall, 1) : "—"
            );

            const barContainer = createElement("div", "fs-chart-bar-container");
            const bar = createElement("div", "fs-chart-bar");

            const barHeight = rainfall !== null
                ? Math.max(3, (rainfall / maximumRainfall) * 100)
                : 0;

            bar.style.height = `${barHeight}%`;
            barContainer.appendChild(bar);

            const timeLabel = createElement(
                "span",
                "fs-chart-time",
                formatForecastTime(hour.time, index)
            );

            column.appendChild(amount);
            column.appendChild(barContainer);
            column.appendChild(timeLabel);

            chart.appendChild(column);
        });

        trendSection.appendChild(chart);
        panel.appendChild(trendSection);

        // ---------- Forecast disclaimer ----------

        const note = createElement(
            "p",
            "fs-forecast-note",
            "Weather forecasts are estimates. They are not direct rain-gauge measurements, " +
            "validated local flood predictions, or official emergency warnings."
        );

        panel.appendChild(note);

        return result;
    }

    // ==========================================
    // 6. FETCH LIVE WEATHER
    // ==========================================

    async function loadWeather() {
        if (!liveWeatherButton) return;

        const normalButtonText =
            liveWeatherButton.dataset.normalText ||
            liveWeatherButton.textContent.trim() ||
            "Fetch Live Weather";

        liveWeatherButton.dataset.normalText = normalButtonText;

        setButtonLoading(
            liveWeatherButton,
            true,
            "FETCHING FORECAST...",
            normalButtonText
        );

        if (weatherStatus) {
            weatherStatus.textContent =
                "Connecting to the weather service...";
        }

        try {
            const latitude = selectedLatitude;
            const longitude = selectedLongitude;

            const url =
                `/api/weather?lat=${encodeURIComponent(latitude)}` +
                `&lon=${encodeURIComponent(longitude)}`;

            const data = await fetchJSON(url);

            // Render the dashboard and calculate the same total for the form.
            const forecastResult = displayHourlyForecast(
                data.hourly_forecast,
                data.rainfall
            );

            const rainfall = forecastResult.rainfall;

            const duration = forecastResult.duration !== null
                ? forecastResult.duration
                : isValidNumber(data.duration)
                    ? Number(data.duration)
                    : null;

            if (rainfall === null || duration === null) {
                throw new Error(
                    "The weather response does not contain valid rainfall and duration values."
                );
            }

            // Populate the prediction form.
            if (rainfallInput) {
                rainfallInput.value = rainfall.toFixed(1);
            }

            if (durationInput) {
                durationInput.value = String(duration);
            }

            if (windInput && isValidNumber(data.wind)) {
                windInput.value = Number(data.wind).toFixed(1);
            }

            if (humidityInput && isValidNumber(data.humidity)) {
                humidityInput.value = Number(data.humidity).toFixed(0);
            }

            // Event type remains a manual user selection.
            if (weatherStatus) {
                weatherStatus.textContent =
                    `Forecast loaded for ${latitude.toFixed(4)}, ` +
                    `${longitude.toFixed(4)}. ` +
                    `${formatNumber(rainfall, 1)} mm estimated precipitation ` +
                    `over ${duration} forecast hour(s).`;
            }

            showMessage(
                "Weather forecast loaded. Review the values before running the analysis.",
                "success"
            );

        } catch (error) {
            console.error("Weather fetch error:", error);

            if (weatherStatus) {
                weatherStatus.textContent =
                    `Weather unavailable: ${error.message}`;
            }

            showMessage(
                `Could not load weather: ${error.message}`,
                "error"
            );

        } finally {
            setButtonLoading(
                liveWeatherButton,
                false,
                "FETCHING FORECAST...",
                normalButtonText
            );
        }
    }

    if (liveWeatherButton) {
        liveWeatherButton.addEventListener("click", loadWeather);
    }

    // ==========================================
    // 7. DISPLAY ML PREDICTION
    // ==========================================

    function displayPrediction(data) {
        if (resultPlaceholder) {
            resultPlaceholder.hidden = true;
        }

        if (resultSection) {
            resultSection.hidden = false;
            resultSection.style.display = "";
        }

        const rawLevel =
            data.risk_level ??
            data.prediction ??
            data.level;

        const level = isValidNumber(rawLevel)
            ? Number(rawLevel)
            : NaN;

        const category =
            data.category ||
            data.risk_category ||
            data.label ||
            "Analysis complete";

        const description =
            data.description ||
            data.message ||
            "The model has returned a result.";

        displayValue(riskCategory, category);
        displayValue(riskDescription, description);

        displayValue(
            outputLevel,
            Number.isFinite(level) ? level : category
        );

        displayValue(
            outputRainfall,
            rainfallInput ? `${rainfallInput.value} mm` : "—"
        );

        displayValue(
            outputDuration,
            durationInput ? `${durationInput.value} hours` : "—"
        );

        displayValue(
            outputEvent,
            eventTypeInput ? eventTypeInput.value : "—"
        );

        // This represents the model's five-level class, not probability.
        if (riskBar) {
            const normalizedLevel = Number.isFinite(level)
                ? Math.max(0, Math.min(4, level))
                : 0;

            riskBar.style.width =
                `${((normalizedLevel + 1) / 5) * 100}%`;

            riskBar.setAttribute(
                "aria-valuenow",
                String(normalizedLevel + 1)
            );

            riskBar.setAttribute("aria-valuemin", "1");
            riskBar.setAttribute("aria-valuemax", "5");
        }
    }

    // ==========================================
    // 8. SUBMIT INPUTS TO THE ML MODEL
    // ==========================================

    if (predictionForm) {
        predictionForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const normalButtonText =
                predictButton?.dataset.normalText ||
                predictButton?.textContent.trim() ||
                "ANALYSE SCENARIO";

            if (predictButton) {
                predictButton.dataset.normalText = normalButtonText;
            }

            const rainfall = Number(rainfallInput?.value);
            const duration = Number(durationInput?.value);
            const wind = Number(windInput?.value);
            const humidity = Number(humidityInput?.value);
            const eventType = eventTypeInput?.value;

            if (
                rainfallInput?.value.trim() === "" ||
                durationInput?.value.trim() === "" ||
                windInput?.value.trim() === "" ||
                humidityInput?.value.trim() === "" ||
                !Number.isFinite(rainfall) ||
                !Number.isFinite(duration) ||
                !Number.isFinite(wind) ||
                !Number.isFinite(humidity)
            ) {
                showMessage(
                    "Please enter valid numeric values for all weather fields.",
                    "error"
                );
                return;
            }

            if (
                rainfall < 0 || rainfall > 2000 ||
                duration <= 0 || duration > 720 ||
                wind < 0 || wind > 500 ||
                humidity < 0 || humidity > 100
            ) {
                showMessage(
                    "Check your inputs: rainfall must be 0–2000 mm, " +
                    "duration greater than 0 and up to 720 hours, " +
                    "wind 0–500 km/h, and humidity 0–100%.",
                    "error"
                );
                return;
            }

            if (!eventType) {
                showMessage(
                    "Please select an event type before analysing the scenario.",
                    "error"
                );
                return;
            }

            const payload = {
                rainfall_mm: rainfall,
                rainfall_period_hours: duration,
                wind_speed_kmh: wind,
                humidity_percent: humidity,
                event_type: eventType
            };

            setButtonLoading(
                predictButton,
                true,
                "ANALYSING...",
                normalButtonText
            );

            showMessage(
                "Analysing scenario with the ML model...",
                "info"
            );

            try {
                const data = await fetchJSON("/api/predict", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });

                displayPrediction(data);

                showMessage(
                    "Analysis completed. Treat this result as an experimental " +
                    "model output, not an official flood warning.",
                    "success"
                );

                if (resultSection) {
                    resultSection.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest"
                    });
                }

            } catch (error) {
                console.error("Prediction error:", error);

                showMessage(
                    `Analysis failed: ${error.message}`,
                    "error"
                );

            } finally {
                setButtonLoading(
                    predictButton,
                    false,
                    "ANALYSING...",
                    normalButtonText
                );
            }
        });
    }

    // ==========================================
    // 9. INITIALIZE THE APPLICATION
    // ==========================================

    initializeMap();

    console.log("FloodShield AI interface initialized.");
});
