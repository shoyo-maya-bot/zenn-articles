// scripts/check-frontmatter.mjs
// Zenn の記事（articles/*.md）の front matter をチェックするスクリプト
import { readdirSync, readFileSync } from "node:fs";
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

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} 件のエラーがあります`);
  process.exit(1);
}
console.log(`${files.length} 件の記事をチェックしました。問題ありません`);
