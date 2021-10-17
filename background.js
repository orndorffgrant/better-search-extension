const db = {};
const punctuationRegex = /[.,\\\/#!$%\^&\*;:{}\+=\-_`~()\[\]@\{\}'"<>\?]/g;
const whitespace = /\s+/g;
const unimportantWords = new Set([
  "",
  "a",
  "and",
  "but",
  "if",
  "the",
  "then",
])

function cleanContent(content) {
  const punctuationRemoved = content.replace(punctuationRegex, "") 
  return punctuationRemoved.replace(whitespace, " ").toLowerCase().split(" ").filter(word => word.length > 2 && !unimportantWords.has(word));
}

function lookup({searchString}) {
  console.log("Looking up: " + searchString);
  cleaned = cleanContent(searchString);
  const findings = {};
  for (const word of cleaned) {
    console.log("Looking up word: " + word);
    const records = new Set(db[word] ?? []);
    for (const record of records) {
      const finding = findings[record.url] ?? {
        url: record.url,
        title: record.title,
        count: 0,
      };
      finding.count = finding.count + record.count;
      findings[record.url] = finding;
    }
  }
  const findingsArr = Object.keys(findings).map(url => findings[url]);
  findingsArr.sort((a, b) => b.count - a.count);
  return findingsArr;
}

function index({
  url,
  title,
  content,
}) {
  console.log("\nIndexing: " + url + "\n" + title);
  const cleaned = cleanContent(content);
  const contentDb = {}
  for (const word of cleaned) {
    const record = contentDb[word] ?? {
      count: 0
    };
    record.count = record.count + 1;
    contentDb[word] = record;
  }

  for (word of Object.keys(contentDb)) {
    const records = db[word] ?? [];
    records.push({
      ...contentDb[word],
      url,
      title,
    });
    db[word] = records;
  }
}

const actions = {
  "index": index,
  "lookup": lookup,
}

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "index_main_page") {
    index(message.args)
  } else if (message.type === "lookup") {
    const results = lookup(message.args);
  }
})