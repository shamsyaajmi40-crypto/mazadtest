const requireRole = (role) => {
  return (req, res, next) => {
    if (
      req.user.role !== role &&
      req.user.role !== "superAdmin"
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};

export default requireRole;
