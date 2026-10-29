
from pathlib import Path

import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


# 1. Define project paths
BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "all_events.csv"
MODEL_PATH = BASE_DIR / "data" / "floodshield_model.joblib"

# 2. Load the dataset
df = pd.read_csv(DATA_PATH)

# 3. Select real input features and target
numeric_features = [
    "rainfall_mm",
    "rainfall_period_hours",
    "wind_speed_kmh",
    "humidity_percent",
]

categorical_features = ["event_type"]
target = "risk_level"

required_columns = numeric_features + categorical_features + [
    target,
    "split",
]

missing_columns = set(required_columns) - set(df.columns)
if missing_columns:
    raise ValueError(f"Missing columns: {sorted(missing_columns)}")

df = df.dropna(subset=[target, "split"]).copy()

# These features intentionally exclude warning text and
# risk descriptions to reduce direct target leakage.
X = df[numeric_features + categorical_features]
y = df[target].astype(int)

# 4. Use the dataset's existing splits
train_mask = df["split"].eq("train")
valid_mask = df["split"].eq("valid")
test_mask = df["split"].eq("test")

if not train_mask.any() or not valid_mask.any() or not test_mask.any():
    raise ValueError("The dataset must contain train, valid, and test rows.")

X_train, y_train = X.loc[train_mask], y.loc[train_mask]
X_valid, y_valid = X.loc[valid_mask], y.loc[valid_mask]
X_test, y_test = X.loc[test_mask], y.loc[test_mask]

# 5. Prepare missing values and categorical data
numeric_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
])

categorical_pipeline = Pipeline([
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("encoder", OneHotEncoder(handle_unknown="ignore")),
])

preprocessor = ColumnTransformer([
    ("numeric", numeric_pipeline, numeric_features),
    ("categorical", categorical_pipeline, categorical_features),
])

# 6. Build the machine-learning pipeline
model = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", RandomForestClassifier(
        n_estimators=200,
        max_depth=5,
        class_weight="balanced",
        random_state=42,
    )),
])

# 7. Train using training records only
model.fit(X_train, y_train)

# 8. Evaluate without training on validation/test records
for name, features, labels in [
    ("Validation", X_valid, y_valid),
    ("Test", X_test, y_test),
]:
    predictions = model.predict(features)

    print(f"\n{'=' * 15} {name} Results {'=' * 15}")
    print(f"Accuracy: {accuracy_score(labels, predictions):.2%}")
    print("\nClassification report:")
    print(classification_report(
        labels,
        predictions,
        labels=[0, 1, 2, 3, 4],
        zero_division=0,
    ))
    print("Confusion matrix (labels 0-4):")
    print(confusion_matrix(labels, predictions, labels=[0, 1, 2, 3, 4]))

# 9. Save the trained model
joblib.dump(model, MODEL_PATH)
print(f"\nModel saved to: {MODEL_PATH}")
print("Important: This model classifies dataset risk labels.")
print("It is not a validated real-world flood forecasting system.")
