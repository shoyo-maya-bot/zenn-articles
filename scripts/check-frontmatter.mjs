// scripts/check-frontmatter.mjs
// Zenn の記事（articles/*.md）の front matter をチェックするスクリプト
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const dir = "articles";
const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
const errors = [];

for (const file of files) {
  const path = join(dir, file);
  const text = readFileSync(path, "utf8");
  const err = (msg) => errors.push(`${path}: ${msg}`);

  // ファイル名（slug）: a-z0-9、ハイフン、アンダースコアで12〜50文字
  const slug = basename(file, ".md");
  if (!/^[a-z0-9_-]{12,50}$/.test(slug)) {
    err("ファイル名は a-z0-9・-・_ の12〜50文字にしてください");
  }

  // 先頭の --- と --- の間を front matter として取り出す
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) {
    err("先頭に front matter（---で囲まれた部分）がありません");
    continue;
  }
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }

  const unquote = (v) => (v ?? "").replace(/^"(.*)"$/, "$1");

  if (!unquote(fm.title)) err("title が空です");

  const emoji = unquote(fm.emoji);
  const graphemes = [...new Intl.Segmenter().segment(emoji)];
  if (graphemes.length !== 1 || !/\p{Extended_Pictographic}/u.test(emoji)) {
    err("emoji は絵文字1つにしてください");
  }

  if (!["tech", "idea"].includes(unquote(fm.type))) {
    err('type は "tech" か "idea" にしてください');
  }

  let topics = [];
  try {
    topics = JSON.parse(fm.topics ?? "");
  } catch {
    err('topics は ["ai", "aws"] の形で書いてください');
  }
  if (!Array.isArray(topics) || topics.length === 0 || topics.length > 5) {
    err("topics は1〜5個にしてください");
  }

  if (!["true", "false"].includes(fm.published)) {
    err("published は true か false にしてください");
  }
}

// 本（books/<slug>/）のチェック
// config.yaml は「キー: 値」と「  - チャプター」だけの簡単な書き方を前提にしている
const booksDir = "books";
const books = existsSync(booksDir)
  ? readdirSync(booksDir).filter((d) => statSync(join(booksDir, d)).isDirectory())
  : [];

for (const book of books) {
  const base = join(booksDir, book);
  const err = (msg) => errors.push(`${base}: ${msg}`);

  if (!/^[a-z0-9_-]{12,50}$/.test(book)) {
    err("本のフォルダ名は a-z0-9・-・_ の12〜50文字にしてください");
  }

  const configPath = join(base, "config.yaml");
  if (!existsSync(configPath)) {
    err("config.yaml がありません");
    continue;
  }
  const conf = {};
  const chapters = [];
  let inChapters = false;
  for (const line of readFileSync(configPath, "utf8").split("\n")) {
    const item = line.match(/^\s+-\s*(.+?)\s*$/);
    if (inChapters && item) {
      chapters.push(item[1].replace(/^"(.*)"$/, "$1"));
      continue;
    }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      conf[kv[1]] = kv[2].trim();
      inChapters = kv[1] === "chapters";
    }
  }

  const unquote = (v) => (v ?? "").replace(/^"(.*)"$/, "$1");
  if (!unquote(conf.title)) err("config.yaml の title が空です");
  if (!unquote(conf.summary)) err("config.yaml の summary が空です");
  if (!["true", "false"].includes(conf.published)) {
    err("config.yaml の published は true か false にしてください");
  }

  const price = Number(conf.price);
  const priceOk = price === 0 || (Number.isInteger(price) && price >= 200 && price <= 5000 && price % 100 === 0);
  if (!priceOk) err("config.yaml の price は 0 か、200〜5000 の100円単位にしてください");

  let topics = [];
  try {
    topics = JSON.parse(conf.topics ?? "");
  } catch {
    err('config.yaml の topics は ["ai", "aws"] の形で書いてください');
  }
  if (!Array.isArray(topics) || topics.length === 0 || topics.length > 5) {
    err("config.yaml の topics は1〜5個にしてください");
  }

  if (chapters.length === 0) err("config.yaml の chapters が空です");
  if (new Set(chapters).size !== chapters.length) err("chapters に同じチャプターが2回あります");

  for (const ch of chapters) {
    const chPath = join(base, `${ch}.md`);
    if (!/^[a-z0-9_-]{1,50}$/.test(ch)) err(`チャプター名 ${ch} は a-z0-9・-・_ の1〜50文字にしてください`);
    if (!existsSync(chPath)) {
      err(`chapters にある ${ch}.md がありません`);
      continue;
    }
    const m = readFileSync(chPath, "utf8").match(/^---\n([\s\S]*?)\n---\n/);
    const fm = {};
    for (const line of (m?.[1] ?? "").split("\n")) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) fm[kv[1]] = kv[2].trim();
    }
    if (!unquote(fm.title)) errors.push(`${chPath}: title が空です`);
    if (fm.free !== undefined && !["true", "false"].includes(fm.free)) {
      errors.push(`${chPath}: free は true か false にしてください`);
    }
  }

  // chapters に書き忘れたチャプターは Zenn に同期されないので、知らせる
  for (const f of readdirSync(base).filter((f) => f.endsWith(".md"))) {
    if (!chapters.includes(basename(f, ".md"))) err(`${f} が config.yaml の chapters にありません`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} 件のエラーがあります`);
  process.exit(1);
}
console.log(`${files.length} 件の記事と ${books.length} 冊の本をチェックしました。問題ありません`);
