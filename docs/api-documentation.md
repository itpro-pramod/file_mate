# FileMate — API Documentation

Interactive Swagger documentation is available at `/docs` (and ReDoc at `/redoc`).

## 1. Authentication Endpoints

### POST `/api/auth/login`
- **Request Body:**
  ```json
  {
    "email": "priya.nair@brightpath.com",
    "password": "Admin@321"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "user": {
      "id": "uuid",
      "email": "priya.nair@brightpath.com",
      "full_name": "Priya Nair",
      "employee_id": "E1042",
      "role": "Consultant",
      "created_at": "2026-10-30T00:00:00Z"
    }
  }
  ```

### GET `/api/auth/me`
- Requires `Authorization: Bearer <token>`.
- Returns details of the currently authenticated employee.

---

## 2. Agent Chat Endpoint

### POST `/api/chat`
- Requires `Authorization: Bearer <token>`.
- **Request Body:**
  ```json
  {
    "message": "Uber trip from Airport T2 to Brightpath client office. Fare 1,250 INR. Date: 28 Oct 2026. Project ATLAS."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "trace_id": "a821fc93-...",
    "agent_message": "I've extracted the following expense. Please review the details and approve to file.",
    "extracted_expense": {
      "merchant": "Uber",
      "category": "Local Travel",
      "amount": 1250.0,
      "currency": "INR",
      "date": "28 Oct 2026",
      "project_code": "ATLAS",
      "notes": "Airport T2 to client office"
    },
    "pending_action": {
      "id": "action-uuid",
      "status": "PENDING",
      "payload_hash": "sha256...",
      "exception_flag": false,
      "exact_payload": { ... }
    },
    "policy_status": "compliant",
    "status": "Pending",
    "thought_time_seconds": 1.4
  }
  ```

---

## 3. Human Approval Endpoints

### POST `/api/actions/{id}/approve`
- Approves and executes the exact stored payload against the Mock Expense API.
- **Request Body:**
  ```json
  {
    "justification": "Required if exception_flag is true"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": "EXECUTED",
    "action_id": "action-uuid",
    "message": "Action approved and successfully filed.",
    "execution_result": {
      "report_number": "RPT-10023",
      "status": "submitted",
      "amount": 1250.0
    }
  }
  ```

### POST `/api/actions/{id}/edit`
- Invalidates the previous action (`status = INVALIDATED`) and creates a new pending action.
- **Request Body:**
  ```json
  {
    "amount": 6000.0,
    "notes": "Adjusted room fare"
  }
  ```

### POST `/api/actions/{id}/reject`
- Rejects the proposed action. No writes occur.
- **Request Body:**
  ```json
  {
    "rejection_reason": "Wrong project code"
  }
  ```

---

## 4. Runs and Observability Endpoints

### GET `/api/runs`
- Query parameters: `search`, `status`, `limit`, `offset`.
- Returns paginated list of agent runs with latency and token telemetry.

### GET `/api/runs/{trace_id}`
- Returns full execution detail: timeline steps, tool calls with latency, token usage, and pending actions.

### GET `/api/runs/{trace_id}/logs`
- Exports complete structured JSON log events for trace reconstruction and evaluation auditing (Deliverable D4).

---

## 5. Policy and Provider Settings

### GET `/api/policy`
- Returns active Brightpath Consulting reimbursement limits and category rules.

### GET `/api/settings/llm`
- Returns provider configuration status (OpenAI vs Azure OpenAI) without leaking API keys.

### PUT `/api/settings/llm`
- Switches active provider (`openai` or `azure_openai`).

### POST `/api/settings/llm/health`
- Runs live connectivity and latency probe on active provider.
