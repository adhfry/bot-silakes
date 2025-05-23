export function apiRes(
  res,
  { status = "success", data = null, message = "", statusCode = 200 }
) {
  return res.status(statusCode).json({
    status,
    data,
    message,
    statusCode,
  });
}
