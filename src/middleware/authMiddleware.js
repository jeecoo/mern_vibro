import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1]; // Extract the token part

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);  // Use your secret key
        req.user = decoded; // Attach the decoded payload (typically the user ID) to the request object
        next(); // Call the next middleware or route handler
    } catch (error) {
        // Handle token verification errors (e.g., expired, invalid signature)
        return res.status(401).json({ message: 'Invalid token', error: error.message });
    }
};
