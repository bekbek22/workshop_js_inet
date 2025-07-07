const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

exports.sendApprovalNotification = (email) => {
    const mailOptions = {
        from: 'ระบบจัดการ <noreply@gmail.com>',
        to: email,
        subject: 'บัญชีของคุณได้รับการอนุมัติ',
        text: 'ตอนนี้คุณสามารถเข้าสู่ระบบได้แล้ว'
    };

    transporter.sendMail(mailOptions);
}