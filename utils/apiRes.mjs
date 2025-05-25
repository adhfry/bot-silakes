export function apiRes(
  res,
  { status = "", data = null, message = "", statusCode = 200 }
) {
  return res.status(statusCode).json({
    status,
    data,
    message,
    statusCode,
  });
}
