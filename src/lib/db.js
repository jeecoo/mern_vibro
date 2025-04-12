import monggose from 'mongoose';

export const connectDB = async () => {
    try {
        const conn = await monggose.connect(process.env.MONGO_URI);
        console.log(`MongoDB connected successfully ${conn.connection.host}`); 
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}