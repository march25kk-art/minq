const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { containsUrl, URL_ERROR_MESSAGE } = require("./urlPolicy");

test("URL variants are rejected while ordinary Japanese text is allowed", () => {
  for (const value of ["https://example.com", "HTTP://EXAMPLE.COM", "www.example.com", "example.com/path", "こちらはexample.co.jpです", "//example.com", "https://例え.テスト", "ｈｔｔｐｓ：／／example．com", "https://exa\u200Bmple.com", "192.168.1.1/path", "[リンク](https://example.com)"]) {
    assert.equal(containsUrl(value), true, value);
  }
  for (const value of ["好きな食べ物は？", "はい", "いいえ", "3.14です", "10/2に開催", "バージョン1.2.3", "とても良いと思います。", "", undefined]) {
    assert.equal(containsUrl(value), false, String(value));
  }
});

// Exercise the actual handlers without connecting to Firestore or starting a server.
const source = fs.readFileSync(require.resolve("./server"), "utf8");
function handlerFor(kind) {
  const context = {
    containsUrl, URL_ERROR_MESSAGE, NG_WORDS: [],
    normalizeQuestionImage: () => "",
    sendError: (res, message, status = 400) => Object.assign(res, { message, status }),
    getIp: () => { throw new Error("Validation reached side effects"); },
    console: { error() {} },
    app: { post: (_path, handler) => { context.handler = handler; } }
  };
  const code = kind === "question"
    ? source.slice(source.indexOf('app.post("/questions",'), source.indexOf('\n//', source.indexOf('app.post("/questions",')))
    : source.slice(source.indexOf('const saveComment ='), source.indexOf('app.post(["/comment",')) + '\nhandler = saveComment;';
  vm.runInNewContext(code, context);
  return context.handler;
}

test("question URLs in every published text field are rejected before side effects", async () => {
  const handler = handlerFor("question");
  for (const field of ["title", "description", "options", "tags"]) {
    const body = { title: "質問", description: "説明", options: ["はい", "いいえ"], tags: [] };
    body[field] = ["options", "tags"].includes(field) ? ["はい", "example.com"] : "example.com";
    const res = {};
    await handler({ body }, res);
    assert.equal(res.status, 400, field);
    assert.equal(res.message, URL_ERROR_MESSAGE, field);
  }
});

test("comments and replies reject URLs in body, name and metadata before side effects", async () => {
  const handler = handlerFor("comment");
  for (const parentCommentId of ["", "parent-id"]) {
    for (const field of ["text", "name", "age", "gender"]) {
      const res = {};
      await handler({ params: {}, body: { id: "question-id", text: "コメント", parentCommentId, [field]: "example.com" } }, res);
      assert.equal(res.status, 400, field);
      assert.equal(res.message, URL_ERROR_MESSAGE, field);
    }
  }
});
