# Backend – PublishJockey

This is the **backend API** for PublishJockey. It provides authentication, project management, user management, and core data storage for the platform. The backend is built with Node.js, Express, and MongoDB.

---

## Features

- **User Authentication:**
  - JWT-based login, registration, and session management.
- **Project Management:**
  - Create, update, delete, and fetch book projects.
  - Store book structure, content, and metadata (title, author, subtitle, ISBN, etc.).
- **Collaboration:**
  - Support for project collaborators and ownership.
- **Subscription & Limits:**
  - Enforce user book/project limits and subscription checks.
- **RESTful API:**
  - Clean, versioned endpoints for all core operations.
- **Validation & Security:**
  - Input validation, error handling, and secure password storage.

---

## API Endpoints

- `POST /api/auth/register` – Register a new user
- `POST /api/auth/login` – User login
- `GET /api/projects` – List all projects for the authenticated user
- `POST /api/projects` – Create a new project
- `GET /api/projects/:id` – Get a single project
- `PUT /api/projects/:id` – Update a project (content, structure, metadata)
- `DELETE /api/projects/:id` – Delete a project
- `PUT /api/users/me/books/decrement` – Decrement user book count (for export-backend)
- ...and more (see code for full list)

---

## Setup & Usage

### 1. **Install Dependencies**

```bash
cd apps/backend
npm install
```

### 2. **Start the Backend**

```bash
npm start
```
- The server runs on [http://localhost:3001](http://localhost:3001) by default.

### 3. **Requirements**
- **Node.js** (v16+ recommended)
- **MongoDB** (local or remote)

---

## Environment Variables

- `MONGO_URI` – MongoDB connection string (default: `mongodb://localhost:27017/publishjockey`)
- `JWT_SECRET` – JWT secret for authentication
- `NODE_ENV` – Set to `production` for production mode

Create a `.env` file in `apps/backend` to override defaults.

---

## Troubleshooting

- **Auth/Session Issues:**
  - Ensure JWT secret is set and consistent across services.
  - Check token expiration and login flow.
- **Database Issues:**
  - Ensure MongoDB is running and accessible at the configured URI.
- **CORS Issues:**
  - Update CORS settings if accessing from a different frontend host.
- **Project Not Found:**
  - Check that the authenticated user owns or collaborates on the project.

---

## Development Notes

- Main logic is in `server.js` and `controllers/`.
- Project schema is in `models/Project.js`.
- User and auth logic is in `models/User.js` and `controllers/userController.js`.
- Designed for easy integration with the export-backend and frontend.

---

## Contact

For support or questions, open an issue or contact the maintainer.

---

## FAQ

### Images & Media

**Q: How can I insert an image without displaying a caption?**  
**A:** To add an image without a visible caption, simply enter a single space in the caption field when uploading or inserting your image. This will ensure that no caption text appears below the image in your exported book.

---

## License

MIT 
