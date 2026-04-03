const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  // Check if the request has an authorization header that starts with "Bearer"
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // 1. Extract the token from the header (Format is "Bearer eyJhbGciOiJIUzI1...")
      token = req.headers.authorization.split(" ")[1];

      // 2. Verify the token using your secret key from the .env file
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Find the user in the database using the ID inside the token
      // The `.select("-password")` part ensures we DON'T send the hashed password back
      req.user = await User.findById(decoded.id).select("-password");

      // 4. Move on to the actual route controller
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  // If there is no token at all, block the request
  if (!token) {
    res.status(401).json({ message: "Not authorized, no token provided" });
  }
};

module.exports = { protect };
