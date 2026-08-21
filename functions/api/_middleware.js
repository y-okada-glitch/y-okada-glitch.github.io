function json(message, status) {
  return Response.json({ error: message }, { status });
}

export async function onRequest(context) {
  const email = context.request.headers
    .get("Cf-Access-Authenticated-User-Email")
    ?.trim()
    .toLowerCase();
  const accessAssertion = context.request.headers.get("Cf-Access-Jwt-Assertion");

  if (!email || !accessAssertion) {
    return json("Cloudflare Accessによるログインが必要です。", 401);
  }

  if (!["GET", "HEAD"].includes(context.request.method)) {
    const origin = context.request.headers.get("Origin");
    if (!origin || origin !== new URL(context.request.url).origin) {
      return json("不正な送信元です。", 403);
    }
  }

  context.data.user = {
    email,
    isAdmin: (context.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .includes(email),
  };

  return context.next();
}
