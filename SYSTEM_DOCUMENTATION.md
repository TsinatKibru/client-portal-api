# Client Portal SaaS - Comprehensive Technical Documentation

This documentation serves as the master guide for the Client Portal SaaS platform. It is designed for engineers maintaining, extending, or auditing the system, providing both high-level context and deep-dive implementation details.

---

## 1. Project Overview
**Problem Context:** Service businesses often struggle with fragmented communication. Clients lose track of project files, invoices are buried in email threads, and there is no "professional" hub for the working relationship.

**Solution:** A unified SaaS **Client Portal** where businesses can manage clients, projects, shared files, and automated invoicing in a real-time, professional environment.

**Architecture Choice:** A **Stateless API (NestJS)** and a **Dynamic Frontend (Next.js)**. This separation ensures that the business logic is isolated and testable, while the frontend leverages modern React features (Server/Client components) for a premium user experience.

---

## 2. High-Level Architecture
- **Frontend (Next.js 15):** The UI layer. Uses App Router for routing and `Axios` for data fetching.
- **Backend (NestJS):** The logic layer. Provides REST endpoints, security guards, and handles external integrations.
- **Database (PostgreSQL via Neon/Vercel):** Relational storage for all business-critical data.
- **Cloud Storage (Cloudinary):** Handles all shared files and branding assets.
- **Real-time (Pusher):** Manages live event broadcasting for notifications and comments.
- **State & Caching (TanStack Query):** Handles frontend server-state, caching, and background revalidation.

**Data Flow Example (File Upload):**
1. User uploads a file in the UI.
2. Frontend sends `FormData` to the NestJS `/upload` endpoint.
3. NestJS streams the file to **Cloudinary**.
4. Cloudinary returns a URL; NestJS saves this record in **PostgreSQL** (linked to a `businessId`).
5. NestJS triggers a **Pusher** event; the client UI updates instantly without a refresh.

---

## 3. Tech Stack Justification
| Technology | Why This? | What it Breaks If Removed |
| :--- | :--- | :--- |
| **Next.js (App Router)** | SEO capability + localized layouts for Admin vs Portal. | Routing becomes manual; build-time optimizations are lost. |
| **NestJS** | Express-based but with Dependency Injection and strict Modules. | The backend loses structural integrity; becomes a "flat" script. |
| **Prisma ORM** | Schema-driven development with full IDE type-safety. | Any DB change becomes a "find-and-replace" nightmare in the code. |
| **Pusher** | Eliminates the need to manage WebSocket heartbeat/reconnection logic. | Real-time features (chat, icons) require manual WebSocket management. |
| **TanStack Query** | Centralized server-state management and caching. | UX degrades; redundant API calls on every navigation cause delays. |
| **Tailwind CSS** | Built-in design tokens (colors, spacing) for brand consistency. | Global CSS files grow too large; UI becomes inconsistent. |

---

## 4. Folder & File Structure
### `/api-v2` (Backend)
- `src/auth/`: JWT-based identity and access control.
- `src/realtime/`: Implementation of `PusherService`.
- `src/upload/`: Cloudinary stream logic and file record management.
- `src/prisma/`: Central DB client instantiation.
- `prisma/schema.prisma`: The master blueprint of the database.

### `/client-portal-v2` (Frontend)
- `src/app/dashboard/`: Admin interface for the service provider.
- `src/app/portal/`: The client-facing interface.
- `src/lib/api.ts`: Centralized Axios instance with JWT interceptors.
- `src/hooks/useQueries.ts`: Custom React Query hooks for unified data fetching.
- `src/components/providers/QueryProvider.tsx`: Initializer for the React Query client.
- `src/components/providers/BrandProvider.tsx`: Injects dynamic CSS variables for business branding.

---

## 5. SaaS Implementation & Multitenancy
### The "SaaS-ness" (Business ID Isolation)
Every data model in this system (except `Business` itself) belongs to a `Business`. This is implemented via a mandatory `businessId` field.
- **Query Locking:** Every service method (e.g., `findAll`, `findOne`, `update`) MUST accept a `businessId` argument.
- **Example Invariant:** `const invoices = await prisma.invoice.findMany({ where: { businessId } })`.
- **Security:** The `businessId` is encoded within the JWT. A user *cannot* access data from another business because the API extracts the `businessId` from the decrypted token, not from the request body.

---

## 6. Database Schema Relationships
The schema is built on a hierarchical model:
- **Business (Root):** The core tenant. Everything cascades from here.
- **User:** Belongs to a Business. Can be `OWNER`, `ADMIN`, or `CLIENT`.
- **Client:** A business entity managed by the Business. Optionally linked to a `User` record for portal access.
- **Project:** Created by a Business, assigned to a Client.
- **Invoice:** Created by a Business for a Client. Uses a `Json` field for flexible line-items.
- **File:** Linked to a `Project` and a `Business`. Stored in Cloudinary.

---

## 7. Core Features (Deep Dive)
### Real-Time Notification Engine
- **Trigger:** Any status change or comment creation.
- **Implementation:** `NotificationService` creates a DB entry + calls `PusherService.trigger()`.
- **State:** Notifications are stored forever but have a `read` boolean.

### Automated Invoicing
- **Implementation:** PDF generation happens via `pdfkit` in `InvoiceService`.
- **Rules:** Invoices can only be edited while in `DRAFT` status. Once `SENT` or `PAID`, editing is locked via Backend Guard logic.

---

## 8. State Management & Data Handling
- **Server-Side State (DB):** Prisma acts as the source of truth for persistent records.
- **Frontend Server-State (Cache):** **TanStack Query** manages the API response cache.
    - **Caching Logic:** Data is cached globally and shared across components (e.g., `useBusinessProfile` is called in layout and pages but only fetches once).
    - **Invalidation:** Mutations (Create/Update/Delete) trigger explicit `queryClient.invalidateQueries` to ensure the UI stays in sync without a manual refresh.
- **Client-Side UI State:** React `useState` for ephemeral UI toggles (modals, search terms).
- **Persistence:** JWT and basic user roles are stored in `localStorage`.

---

## 9. Authentication & Authorization
- **Security Logic:** Passport-JWT strategy.
- **Session Flow:** 
    1. Login -> Token returned.
    2. Token stored in `localStorage` as "token".
    3. Token attached to all `api.get/post` calls via Axios Request Interceptors.
- **Assumptions:** We assume HTTPS is used in production. Without HTTPS, JWTs in headers are vulnerable to sniffing.

---

## 10. External Modules (Cloudinary & Pusher)
- **Cloudinary (`UploadService`):** Files are NOT stored on the server. They are passed as a stream to Cloudinary. The `publicId` is stored in the DB so files can be deleted remotely when they are deleted from our app.
- **Pusher (`PusherService`):** A lightweight wrapper around the `pusher` NPM package. Channels are named `project-{id}` or `user-{id}` to ensure privacy.

---

## 11. Common Pitfalls & "Gotchas"
- **Z-Index Issues:** Modals use fixed positioning; ensure the `Toaster` component is at the root to avoid being covered.
- **Prisma Client Generation:** If you add a field to the schema, you MUST run `npx prisma generate` to update the Typescript types, or the code will crash during compilation.
- **Email Delivery:** Nodemailer depends on correct SMTP credentials. If emails fail, check the `EMAIL_USER` password (use an App Password for Gmail).

---

## 12. Interview-Ready Summary
- **Multitenant SaaS:** Built a secure multi-tenant architecture using JWT-encoded `businessId` for row-level security.
- **Hybrid Real-time:** Combined persistent database notifications with instant Pusher-driven UI updates.
- **Automated Billing:** Built a custom PDF generation engine that automates the lifecycle from `DRAFT` to `PAID`.
- **Type-Safe Fullstack:** Used Typescript across the entire stack (Next.js/NestJS/Prisma) to catch errors at compile time.
- **Performance Optimized:** Implemented a robust caching layer using TanStack Query, eliminating redundant network requests and enabling instant navigation.
- **Brand Identity:** Implemented a dynamic branding system where clients see the business's colors and logos fetched at runtime.
