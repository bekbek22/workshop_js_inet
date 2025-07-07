const jwt = require('jsonwebtoken');
const userSchema = require('../models/users.model');

//Middleware สำหรับตรวจสอบ access token
exports.authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ 
                status: 401,
                message: 'Authentication required' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await userSchema.findById(decoded.userId).select('-password');

        if (!req.user) {
            return res.status(401).json({ 
                status: 401,
                message: 'Invalid token - user not found' 
            });
        }

        next();
    } catch (error) {
        res.status(401).json({
            status: 401,
            message: 'Invalid or expired token' 
        });
    }
};

exports.authorize = (roles = []) => {
    return (req, res, next) => {
        if (!Array.isArray(roles)) roles = [roles];

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                status: 403,
                message: `Access denied. Required roles: ${roles.join(', ')}`
            });
        }

        next();
    };
};

//Middleware สำหรับตรวจสอบ ownership
exports.checkOwnership = (paramId = 'id') => {
    return (req, res, next) => {
        // ถ้าเป็น admin หรือ user_id ใน token ตรงกับ params id ให้ผ่าน
        if (req.user.role === 'admin' || req.user._id.toString() === req.params[paramId]) {
            return next();
        }

        res.status(403).json({ 
            status: 403,
            message: 'Access denied. You can only access your own data'
        });
    };
};