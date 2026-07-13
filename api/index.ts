/**
 * Vercel serverless entry — Express app handles /api/*
 */
import app, { adminReady } from '../server/app'

// Kick admin seed on cold start
void adminReady

export default app
