const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    username: {
        type: String, 
        unique: true, 
        required: [true, 'กรุณากรอกชื่อผู้ใช้']
    },
    email: {
        type: String, 
        unique: true, 
        required: [true, 'กรุณากรอกอีเมล'], 
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'กรุณากรอกอีเมลให้ถูกต้อง']
    },
    password: {
        type: String, 
        required: [true, 'กรุณากรอกรหัสผ่าน']
    },
    role: {
        type: String, 
        enum: ['user', 'store', 'admin'], 
        default: 'user'
    }, //default เป็น user
    IsApproved: {
        type: Boolean, 
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);