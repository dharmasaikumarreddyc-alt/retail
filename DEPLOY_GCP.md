# Cloud Run deployment with Vertex AI

Both services deploy to **asia-south1**. Gemini runs through Vertex AI using
Application Default Credentials from attached service accounts. No Gemini API
key or service-account key file is required. Vertex's location defaults to
`global`, independently of the Cloud Run region; select a supported regional
endpoint using `VERTEX_LOCATION` if data residency requires it. Confirm model
availability and quota for `GOOGLE_MODEL` in your project before deploying.

## Required existing GCP resources

- A billing-enabled project with Cloud Run, Cloud Build, Artifact Registry,
  Secret Manager and Vertex AI APIs enabled.
- A Docker Artifact Registry repository named `retail` in `asia-south1`.
- Separate backend and frontend runtime service accounts with Vertex AI User
  (`roles/aiplatform.user`). Give only the backend account Secret Accessor on
  the two specific secrets below.
- An existing reachable PostgreSQL database, with its URL in Secret Manager,
  and a separate random JWT signing secret of at least 32 characters.
  For Cloud SQL private connectivity, configure the necessary connector/VPC
  settings before using this script; it assumes a reachable PostgreSQL URL.
- Deployer permissions for builds, Cloud Run services/jobs and acting as the
  runtime accounts; the build identity needs registry write permissions.

The script does not grant IAM privileges or create credentials. Services are
public at the transport layer because browsers call the API; existing app-level
user authentication remains in place. Review that exposure before running.

## Run in Cloud Shell

Set the following to your actual resource identifiers (not secret values):

```bash
export PROJECT_ID='your-project-id'
export BACKEND_SERVICE_ACCOUNT='aisle-api@your-project-id.iam.gserviceaccount.com'
export FRONTEND_SERVICE_ACCOUNT='aisle-web@your-project-id.iam.gserviceaccount.com'
export DATABASE_SECRET='your-database-url-secret'
export JWT_SECRET='your-jwt-secret'
bash scripts/deploy-cloud-run.sh
```

The script checks secret metadata, builds the backend, runs Alembic in a Cloud
Run job, deploys the backend, builds the frontend with its real backend URL,
deploys the frontend and updates backend CORS to its exact HTTPS origin. It
replaces backend secret bindings with only the database and JWT secrets, so
obsolete Gemini secret references cannot block startup. Frontend secret bindings
are cleared. Back up the database before running migrations.

Health checks verify HTTP availability; also sign in and exercise merchant AI
and the frontend assistant to verify model access and real database operations.
This change has not been deployed or tested against a live GCP project.

## Local Vertex development

Use `gcloud auth application-default login` locally, then set
`GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_CLOUD_PROJECT`,
`GOOGLE_CLOUD_LOCATION=global`, and `GOOGLE_MODEL` in backend and frontend server
environments. Tokens refresh automatically. Existing API-key providers remain
available for local compatibility only when Vertex mode is disabled.
