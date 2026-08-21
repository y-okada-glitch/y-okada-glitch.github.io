function json(message, status) {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function contentDisposition(filename) {
  const safeAscii = filename
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_")
    .slice(0, 150) || "submission";
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function onRequestGet(context) {
  if (!context.env.DB || !context.env.SUBMISSIONS) {
    return json("D1またはR2のバインディングが未設定です。", 503);
  }

  const id = typeof context.params.id === "string" ? context.params.id : "";
  const submission = await context.env.DB.prepare(
    `SELECT id, email, original_filename, object_key, content_type
       FROM submissions
      WHERE id = ?`,
  ).bind(id).first();

  if (!submission) {
    return json("提出物が見つかりません。", 404);
  }
  if (!context.data.user.isAdmin && submission.email !== context.data.user.email) {
    return json("この提出物を取得する権限がありません。", 403);
  }

  const object = await context.env.SUBMISSIONS.get(submission.object_key);
  if (!object?.body) {
    return json("保存ファイルが見つかりません。", 404);
  }

  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Disposition": contentDisposition(submission.original_filename),
    "Content-Type": submission.content_type || "application/octet-stream",
    ETag: object.httpEtag,
  });
  object.writeHttpMetadata(headers);

  console.log(JSON.stringify({
    event: "submission_downloaded",
    id,
    email: context.data.user.email,
  }));
  return new Response(object.body, { headers });
}
