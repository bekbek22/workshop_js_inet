const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const userSchema = require('../models/users.model');

//Register
router.post('/register', async (req, res) => {
    try {
        const {username, email, password, role} = req.body;

        //ตรวจสอบข้อมูล
        if (!username || !email || !password) {
            return res.status(400).json({
                status: 400,
                message: 'กรุณากรอกข้อมูลให้ครบทุกช่อง',
            });
        }

        //ตรวจสอบ email ซ้ำ
        const existingEmail = await userSchema.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({
                status: 400,
                message: 'อีเมลนี้ถูกใช้ไปแล้ว'
            });
        }

        //เข้ารหัสรหัสผ่าน
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        //สร้างผู้ใช้ใหม่
        const newUser = new userSchema({
            username,
            email,
            password: hashedPassword,
            role,
        })

        await newUser.save();

        // response
        res.status(201).json({
            status: 201,
            message: 'สร้างสำเร็จ',
            data: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message});
    }
})

//Login
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body; // รับทั้ง username/email

        if (!identifier || !password) {
            return res.status(400).json({
                status: 400,
                message: 'กรุณากรอกชื่อผู้ใช้หรืออีเมลและรหัสผ่าน'
            });
        }

        // ค้นหาผู้ใช้ด้วย username หรือ email
        const user = await userSchema.findOne({
            $or: [
                { username: identifier},
                { email: identifier}
            ]
        });
        console.log(user)
        if (!user) {
            return res.status(401).json({
                status: 401,
                message: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง'
            });
        }

        // ตรวขสอบรหัสผ่าน
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                status: 401,
                message: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง'
            })
        }
        
        if (!user.IsApproved) {
            return res.status(403).json({
                status: 403,
                message: 'บัญชีของคุณรอการอนุมัติจากแอดมิน'
            });
        }

        // สร้าง JWT token
        const token = jwt.sign(
            {
                userId: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h'}
        );

        // response token
        res.status(200).json({
            status: 200,
            message: 'เข้าสู่ระบบสำเร็จ',
            access_token: token,
            expiresIn: 3600,
            user: {
                id: user._id,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: 500,
            message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ'
        });
    }
});

module.exports = router;