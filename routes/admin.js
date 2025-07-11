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

router.get(
    '/users',
    authenticate,
    authorize('admin'),
    async (req, res) => {
        try {
            // ดึงค่าฟีลเตอร์จาก query parameters
            const { IsApproved, email } = req.query;

            // สร้าง query object สำหรับการกรอง
            const filter = {};

            // เพิ่มเงื่อนไขการกรองตามค่าที่ส่งมา
            if (IsApproved === 'true' || IsApproved === 'false') {
                filter.isActive = isActive === 'true';
            }

            if (email) {
                filter.email = { $regex: email, $options: 'i'}; 
            }
            
            const users = await userSchema.find(filter)
                .select('-password -__v')
                .sort({ createdAt: -1 });

            const result = {
                approvedUsers: [],
                pendingUsers: [],
            };

            users.forEach(user => {
                if (user.IsApproved) {
                    result.approvedUsers.push(user);
                } else {
                    result.pendingUsers.push(user);
                }
            });

            res.status(200).json({
                status: 200,
                message: 'ดึงข้อมูลผู้ใช้สำเร็จ',
                data: result,
                approvedCount: result.approvedUsers.length,
                pendingCount: result.pendingUsers.length,
                totalCount: users.length
            });
        } catch (error) {
            console.error('เกิดข้อผิดพลาดในการดึงผู้ใช้:', error);
            res.status(500),json({
                status: 500,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้'
            })
        }
    }
)

module.exports = router;