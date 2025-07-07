const checkApproval = (req, res, next) => {
    //ข้อมูลผู้ใช้จาก middleware auth (req.user)
    if (!req.user || !req.user.isApproved) {
        return res.status(403).json({
            status: 403,
            message: 'บัญชีของคุณไม่ได้รับอนุญาตให้เข้าถึงระบบ หรือรอการอนุมัติ'
        });
    }

    next();
};

module.exports = checkApproval;