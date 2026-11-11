// Страна и город посетителя для аналитики. PostHog в режиме без cookie сразу хэширует IP и сам
// страну не определяет, а Vercel сообщает её в заголовках каждого запроса. Сам IP здесь не читается
// и никуда не передаётся. Локально и вне Vercel заголовков нет — ответ пустой.
export async function GET(request: Request) {
  const country = request.headers.get("x-vercel-ip-country");
  const city = request.headers.get("x-vercel-ip-city");
  return Response.json(
    { country: country && /^[A-Z]{2}$/.test(country) ? country : null, city: city ? decodeURIComponent(city).slice(0, 60) : null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
