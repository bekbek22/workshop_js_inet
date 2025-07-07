const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB Connected");
    } catch (error) {
        console.error('MongoDB Connection Error', error);
        process.exit(1); //ออกจากโปรแกรมเมื่อเชื่อมต่อล้มเหลว
    }
};  

//ตรวจสอบการเชื่อมต่อแบบ real-time
mongoose.connection.on('connected', () => console.log("Mongoose connected to DB"));
mongoose.connection.on('error', (error) => console.error('Mongoose connection error: ', error));
mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));

//จัดการการปิด connection เมื่อแอปปิด
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('Mongoose connection closed via app termination');
    process.exit(0);
});

module.exports = connectDB;