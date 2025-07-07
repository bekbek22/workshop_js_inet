const express = require('express');
const router = express.Router();
const userSchema = require('../models/users.model');
const {
  authenticate,
  authorize
} = require('../middleware/authMiddleware');
const {
    sendApprovalNotification
} = require('../service/emailservice')

router.put(
    '/users/:id/approve',
    authenticate,
    authorize('admin'),
    async (req, res) => {
        try {
            const user = await userSchema.findByIdAndUpdate(
                req.params.id,
                { IsApproved: true},
                { new: true}
            );

            if (!user) {
                return res.status(404).json({
                    status: 404,
                    message: 'ไม่พบผู้ใช้'
                });
            }

            // ส่งการแจ้งเตือน
            sendApprovalNotification(user.email);

            res.status(201).json({
                status: 201,
                message: `อนุมัติผู้ใช้ ${user.email} เรียบร้อยแล้ว`,
            });

        } catch (error) {
            res.status(500).json({
                status: 500,
                message: 'เกิดข้อผิดพลาดในการอนุมัติ'
            });
        }
    }
);

module.exports = router;