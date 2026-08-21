// routes/health.mjs
export const descriptors = [
  {
    method: "get",
    path: "/",
    auth: false,
    description: "Health check",
    handler: (req, res) => {
      res.json({ status: "OK", timestamp: Date.now() });
    },
  },
];
