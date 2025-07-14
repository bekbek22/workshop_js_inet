const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure destination directory exists
const uploadDir = path.resolve(__dirname, '../public/images/products');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ตั้งค่า Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// ตัวกรองประเภทไฟล์
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('ประเภทไฟล์ไม่ถูกต้อง (อนุญาตเฉพาะ JPEG, JPG, PNG, WebP)'), false);
    }
};

// Middleware สำหรับ upload 
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

module.exports = upload;
