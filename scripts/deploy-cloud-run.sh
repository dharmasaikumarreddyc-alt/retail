#!/usr/bin/env bash
# Run from an authenticated Cloud Shell. Secret values are never read by this script.
set -euo pipefail
set +x
cd "$(dirname "$0")/.."
: "${PROJECT_ID:?Set PROJECT_ID}"
: "${BACKEND_SERVICE_ACCOUNT:?Set BACKEND_SERVICE_ACCOUNT}"
: "${FRONTEND_SERVICE_ACCOUNT:?Set FRONTEND_SERVICE_ACCOUNT}"
: "${DATABASE_SECRET:?Set DATABASE_SECRET to an existing PostgreSQL URL secret name}"
: "${JWT_SECRET:?Set JWT_SECRET to an existing JWT signing secret name}"
REGION=asia-south1
VERTEX_LOCATION="${VERTEX_LOCATION:-global}"
GOOGLE_MODEL="${GOOGLE_MODEL:-gemini-3.8-flash}"
REPOSITORY="${REPOSITORY:-retail}"
TAG="$(git rev-parse --short HEAD)-$(date +%s)"
API_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/aisle-api:$TAG"
WEB_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/aisle-web:$TAG"
GCLOUD=(gcloud --project="$PROJECT_ID" --quiet)
# Verify references without accessing secret payloads.
for secret in "$DATABASE_SECRET" "$JWT_SECRET"; do
  "${GCLOUD[@]}" secrets versions describe latest --secret="$secret" --format='value(state)' | rg -q '^ENABLED$'
done
"${GCLOUD[@]}" artifacts repositories describe "$REPOSITORY" --location="$REGION" >/dev/null
"${GCLOUD[@]}" builds submit backend --tag="$API_IMAGE"
ENV_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE"' EXIT
export PROJECT_ID VERTEX_LOCATION GOOGLE_MODEL
write_env() {
  FRONTEND_ORIGIN="$1" python3 - <<'PY' > "$ENV_FILE"
import json, os
print(json.dumps({"ENVIRONMENT":"production", "DEBUG":"false",
 "GOOGLE_GENAI_USE_VERTEXAI":"true", "GOOGLE_CLOUD_PROJECT":os.environ["PROJECT_ID"],
 "GOOGLE_CLOUD_LOCATION":os.environ["VERTEX_LOCATION"], "GOOGLE_MODEL":os.environ["GOOGLE_MODEL"],
 "CORS_ORIGINS":json.dumps([os.environ["FRONTEND_ORIGIN"]])}))
PY
}
# Preserve an existing frontend origin during backend rollout.
FRONTEND_URL="$("${GCLOUD[@]}" run services describe aisle-web --region="$REGION" --format='value(status.url)' 2>/dev/null || true)"
write_env "${FRONTEND_URL:-https://deployment.invalid}"
COMMON=(--region="$REGION" --image="$API_IMAGE" --service-account="$BACKEND_SERVICE_ACCOUNT"
 --env-vars-file="$ENV_FILE" --set-secrets="DATABASE_URL=$DATABASE_SECRET:latest,SECRET_KEY=$JWT_SECRET:latest")
# A separate job runs migrations before the application receives traffic.
"${GCLOUD[@]}" run jobs deploy aisle-migrate "${COMMON[@]}" --command=python --args=-m,alembic,upgrade,head --max-retries=0 --tasks=1
"${GCLOUD[@]}" run jobs execute aisle-migrate --region="$REGION" --wait
"${GCLOUD[@]}" run deploy aisle-api "${COMMON[@]}" --port=8080 --memory=1Gi --max-instances=3 --allow-unauthenticated
BACKEND_URL="$("${GCLOUD[@]}" run services describe aisle-api --region="$REGION" --format='value(status.url)')"
"${GCLOUD[@]}" builds submit . --config=cloudbuild.frontend.yaml --substitutions="_BACKEND_URL=$BACKEND_URL,_IMAGE=$WEB_IMAGE"
"${GCLOUD[@]}" run deploy aisle-web --region="$REGION" --image="$WEB_IMAGE" \
 --service-account="$FRONTEND_SERVICE_ACCOUNT" --port=8080 --memory=512Mi --max-instances=3 \
 --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$VERTEX_LOCATION,GOOGLE_MODEL=$GOOGLE_MODEL" \
 --clear-secrets --allow-unauthenticated
FRONTEND_URL="$("${GCLOUD[@]}" run services describe aisle-web --region="$REGION" --format='value(status.url)')"
write_env "$FRONTEND_URL"
"${GCLOUD[@]}" run services update aisle-api --region="$REGION" --env-vars-file="$ENV_FILE"
curl --fail --silent --show-error "$BACKEND_URL/health" >/dev/null
curl --fail --silent --show-error "$FRONTEND_URL" >/dev/null
printf 'Frontend: %s\nBackend: %s\n' "$FRONTEND_URL" "$BACKEND_URL"
