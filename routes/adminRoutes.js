const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, authorize } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(verifyToken);
router.use(authorize('admin'));

// User management routes
router.get('/users', adminController.getAllUsers);
router.get('/users/:userId', adminController.getUserDetails);
router.put('/users/:userId', adminController.updateUserInfo);
router.post('/users/:userId/reset-password', adminController.adminResetPassword);
router.post('/users/:userId/impersonate', adminController.impersonateUser);
router.get('/users/:userId/export', adminController.exportUserData);
router.post('/users/:userId/suspend', adminController.suspendUser);
router.post('/users/:userId/unsuspend', adminController.unsuspendUser);
router.post('/users/:userId/change-role', adminController.changeUserRole);
router.delete('/users/:userId', adminController.deleteUser);
router.post('/users/:userId/notify', adminController.sendNotification);

// New routes for book management
router.get('/users/:userId/books', adminController.getUserBooks);
router.delete('/users/:userId/books/:bookId', adminController.deleteBook);

// Bulk actions
router.post('/users/bulk-action', adminController.bulkUserAction);

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);

// Dashboard statistics
router.get('/dashboard-stats', adminController.getDashboardStats);

module.exports = router; 