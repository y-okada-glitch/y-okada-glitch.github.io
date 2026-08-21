const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_REQUEST_BYTES = 27 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "xlsx", "pptx", "zip"]);

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function assignments(env) {
  return (env.ALLOWED_ASSIGNMENTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function cleanText(value, maxLength) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength)
    : "";
}

function extensionOf(filename) {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? "" : filename.slice(dot + 1).toLowerCase();
}

function validateBindings(env) {
  return env.DB && env.SUBMISSIONS;
}

export async function onRequestGet(context) {
  if (!validateBindings(context.env)) {
    return json({ error: "D1またはR2のバインディングが未設定です。" }, 503);
  }

  const allowedAssignments = assignments(context.env);
  const { email, isAdmin } = context.data.user;
  const query = isAdmin
    ? context.env.DB.prepare(
        `SELECT id, assignment, student_number, student_name, email,
                original_filename, content_type, size, submitted_at
           FROM submissions
          ORDER BY submitted_at DESC
          LIMIT 500`,
      )
    : context.env.DB.prepare(
        `SELECT id, assignment, student_number, student_name, email,
                original_filename, content_type, size, submitted_at
           FROM submissions
          WHERE email = ?
          ORDER BY submitted_at DESC
          LIMIT 100`,
      ).bind(email);

  const result = await query.all();
  return json({
    user: { email, isAdmin },
    assignments: allowedAssignments,
    submissions: result.results ?? [],
  });
}

export async function onRequestPost(context) {
  if (!validateBindings(context.env)) {
    return json({ error: "D1またはR2のバインディングが未設定です。" }, 503);
  }

  const requestLength = Number(context.request.headers.get("Content-Length") ?? 0);
  if (requestLength > MAX_REQUEST_BYTES) {
    return json({ error: "送信データが上限を超えています。" }, 413);
  }

  let form;
  try {
    form = await context.request.formData();
  } catch {
    return json({ error: "フォームデータを読み取れませんでした。" }, 400);
  }

  const assignment = cleanText(form.get("assignment"), 100);
  const studentNumber = cleanText(form.get("studentNumber"), 40);
  const studentName = cleanText(form.get("studentName"), 100);
  const file = form.get("file");
  const allowedAssignments = assignments(context.env);

  if (!allowedAssignments.length) {
    return json({ error: "受付中の課題が設定されていません。" }, 503);
  }
  if (!allowedAssignments.includes(assignment)) {
    return json({ error: "選択した課題は現在受け付けていません。" }, 400);
  }
  if (!studentNumber || !studentName) {
    return json({ error: "学籍番号と氏名を入力してください。" }, 400);
  }
  if (!(file instanceof File) || file.size === 0) {
    return json({ error: "提出ファイルを選択してください。" }, 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return json({ error: "ファイルは25MB以下にしてください。" }, 413);
  }

  const originalFilename = cleanText(file.name, 180);
  const extension = extensionOf(originalFilename);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return json({ error: "PDF、DOCX、XLSX、PPTX、ZIPのみ提出できます。" }, 415);
  }

  const id = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const objectKey = `submissions/${encodeURIComponent(assignment)}/${id}.${extension}`;
  const contentType = cleanText(file.type, 100) || "application/octet-stream";

  try {
    await context.env.SUBMISSIONS.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType },
      customMetadata: { submissionId: id },
    });

    try {
      await context.env.DB.prepare(
        `INSERT INTO submissions
          (id, assignment, student_number, student_name, email,
           original_filename, object_key, content_type, size, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          assignment,
          studentNumber,
          studentName,
          context.data.user.email,
          originalFilename,
          objectKey,
          contentType,
          file.size,
          submittedAt,
        )
        .run();
    } catch (error) {
      await context.env.SUBMISSIONS.delete(objectKey);
      throw error;
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "submission_failed", id, error: String(error) }));
    return json({ error: "提出物を保存できませんでした。時間をおいて再試行してください。" }, 500);
  }

  console.log(JSON.stringify({
    event: "submission_created",
    id,
    assignment,
    email: context.data.user.email,
    size: file.size,
  }));

  return json({ id, submittedAt }, 201);
}
