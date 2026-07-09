# GrowEasy CRM AI-Powered CSV Importer

A production-grade, AI-powered CSV lead importer for GrowEasy CRM. This application automatically understands arbitrary spreadsheet formats and uses a Large Language Model (LLM) to intelligently map columns to GrowEasy CRM target fields. Supports large files via database-backed chunk queues and Server-Sent Events (SSE) streaming progress.

---

## Technical Stack

* **Frontend**: Next.js 15 (App Router), TypeScript, TailwindCSS, TanStack Table, React Hook Form, Zustand, React Query, Framer Motion, React Dropzone, Heroicons.
* **Backend**: Node.js, Express, TypeScript, REST APIs, JWT Authentication, Multer, fast-csv, OpenAI, Winston logger, Helmet, CORS, Rate limiting.
* **Database**: Turso (LibSQL / SQLite) via Prisma Client with LibSQL driver adapter.

---

## Project Structure

This project is set up as an npm workspace monorepo:

```
groweasy/
├── apps/
│   ├── frontend/             # Next.js 15 client
│   └── backend/              # Express API server
├── packages/
│   └── shared/               # Validation schemas, Type definitions
├── database/
│   └── prisma/               # Database schema, migrations & seed scripts
├── docker/                   # Dockerfiles & compose configuration
├── package.json              # Monorepo root configuration
└── README.md                 # Documentation
```

---

## Installation & Setup

### Prerequisites

* Node.js v20.x or later
* npm 10.x or later

### 1. Clone the repository and install dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file at the root folder:

```env
PORT=5000
DATABASE_URL=file:./dev.db
DATABASE_AUTH_TOKEN=your_turso_token_here
JWT_SECRET=your_jwt_access_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
UPLOAD_DIR=uploads
NODE_ENV=development
```

> [!NOTE]
> * For local development, setting `DATABASE_URL=file:./dev.db` initializes a local SQLite file automatically.
> * To connect to the production Turso database, set `DATABASE_URL` to your `libsql://...` connection string and supply the `DATABASE_AUTH_TOKEN`.

### 3. Database Migration & Seeding
Compile packages, create tables, and populate default seed roles and user accounts:

```bash
# Build shared and database packages
npm run build -w packages/shared
npm run build -w database/prisma

# Run migrations and seed
npm run migrate -w database/prisma
npm run seed -w database/prisma
```

This creates the following credentials:
* **Admin Account**: `admin@groweasy.com` / Password: `admin123`
* **User Account**: `user@groweasy.com` / Password: `user123`

### 4. Running the Application Locally
In two separate terminals, run the backend API server and the Next.js development server:

* **Backend Dev Server**:
  ```bash
  npm run dev:backend
  ```
* **Frontend Dev Server**:
  ```bash
  npm run dev:frontend
  ```

Access the frontend dashboard at [http://localhost:3000](http://localhost:3000).

---

## AI Mapping & Skip Rules

The importer makes no assumptions about input column headers. Instead, a batch of 100 rows is sent to the LLM. The AI normalizes inputs to match the following target CRM fields:

1. **`crm_status`**: Enforces strict statuses: `GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT`, `BAD_LEAD`, or `SALE_DONE`.
2. **`data_source`**: Must be one of `leads_on_demand`, `meridian_tower`, `eden_park`, `varah_swamy`, `sarjapur_plots` or left blank.
3. **`created_at`**: Normalizes timestamps to a format parsable by `new Date()`.
4. **Multiple Contact Deduplication**:
   * Extracts the first email/mobile.
   * Merges extra emails, phones, and unmapped fields into `crm_note`.
5. **Skip Rules**: Automatically skips any record missing BOTH an email and mobile number, logging the reason in the `FailedImport` table.

---

## Running in Production with Docker

### Docker Compose
Build and run the entire stack using Docker Compose:

```bash
docker-compose -f docker/docker-compose.yml up --build
```

The backend server is exposed on port `5000` and the frontend Next.js server on port `3000`.

---

## Testing

Run unit and validation tests:

```bash
npm test
```
