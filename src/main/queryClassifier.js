const READ_QUERY = "READ_QUERY";
const WRITE_OR_STRUCTURE_QUERY = "WRITE_OR_STRUCTURE_QUERY";

function stripLeadingComments(sql) {
  let text = String(sql || "").trim();
  let changed = true;

  while (changed) {
    changed = false;
    const before = text;
    text = text.replace(/^--[^\n\r]*(\r?\n|$)/, "").trimStart();
    text = text.replace(/^#[^\n\r]*(\r?\n|$)/, "").trimStart();
    text = text.replace(/^\/\*[\s\S]*?\*\//, "").trimStart();
    changed = text !== before;
  }

  return text.trim();
}

function hasMultipleStatements(sql) {
  const text = String(sql || "");
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escaped = false;
  let statementCount = 0;
  let hasNonWhitespaceAfterSeparator = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (escaped) {
      escaped = false;
      continue;
    }

    if ((inSingle || inDouble) && char === "\\") {
      escaped = true;
      continue;
    }

    if (!inDouble && !inBacktick && char === "'") {
      inSingle = !inSingle;
      continue;
    }

    if (!inSingle && !inBacktick && char === '"') {
      inDouble = !inDouble;
      continue;
    }

    if (!inSingle && !inDouble && char === "`") {
      inBacktick = !inBacktick;
      continue;
    }

    if (inSingle || inDouble || inBacktick) {
      continue;
    }

    if (char === "-" && next === "-") {
      while (index < text.length && !["\n", "\r"].includes(text[index])) index += 1;
      continue;
    }

    if (char === "#") {
      while (index < text.length && !["\n", "\r"].includes(text[index])) index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }

    if (char === ";") {
      statementCount += 1;
      hasNonWhitespaceAfterSeparator = /\S/.test(text.slice(index + 1));
    }
  }

  return statementCount > 1 || (statementCount === 1 && hasNonWhitespaceAfterSeparator);
}

function classifySql(sql) {
  const text = stripLeadingComments(sql);
  if (!text) {
    return WRITE_OR_STRUCTURE_QUERY;
  }

  const firstWord = (text.match(/^([a-z]+)/i) || ["", ""])[1].toUpperCase();
  if (["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN"].includes(firstWord)) {
    return READ_QUERY;
  }

  if (firstWord === "WITH") {
    const lowered = text.toLowerCase();
    const writeKeywords = [
      " insert ",
      " update ",
      " delete ",
      " replace ",
      " create ",
      " alter ",
      " drop ",
      " truncate ",
      " rename ",
      " grant ",
      " revoke ",
      " set ",
      " call ",
      " lock ",
      " unlock "
    ];
    const padded = ` ${lowered.replace(/\s+/g, " ")} `;
    return writeKeywords.some((keyword) => padded.includes(keyword))
      ? WRITE_OR_STRUCTURE_QUERY
      : READ_QUERY;
  }

  return WRITE_OR_STRUCTURE_QUERY;
}

function hasSelectLimit(sql) {
  const text = String(sql || "").toLowerCase();
  return /\blimit\s+\d+/i.test(text);
}

module.exports = {
  READ_QUERY,
  WRITE_OR_STRUCTURE_QUERY,
  classifySql,
  hasMultipleStatements,
  hasSelectLimit,
  stripLeadingComments
};
