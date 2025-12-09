// utils/sendEmail.js (Conceptual, but with debugging text added)
import nodemailer from 'nodemailer';

const sendEmail = async (email, subject, text) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail', // Use your chosen service
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: subject,
        text: text,
    };

    try {
        await transporter.sendMail(mailOptions);
        // ⭐ ADDED DEBUGGING TEXT HERE ⭐
        console.log(`[EMAIL SUCCESS] OTP successfully sent to: ${email}`);
    } catch (error) {
        // This log will catch authentication issues, connection problems, etc.
        console.error(`[EMAIL FAILURE] Failed to send OTP to ${email}. Error details:`, error);
        throw error; // Re-throw the error to be caught by the /register route
    }
};

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export { sendEmail, generateOTP };