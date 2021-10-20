let db = null;
async function getDb() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
    }
    const request = indexedDB.open("index", 1);
    request.onerror = function(event) {
      console.error("oof");
      reject(event);
    };
    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      const invertedIndex = db.createObjectStore("inverted_index", { keyPath: "term" });
      const urls = db.createObjectStore("urls", { keyPath: "url" });
    };
    request.onsuccess = function(event) {
      db = event.target.result;
      resolve(db);
    };
  })
}

async function getUrlsForTerm(term) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("inverted_index").objectStore("inverted_index").get(term);
    request.onerror = function(event) {
      console.error("getUrlsForTerm error");
      console.error(event);
      reject(event.target)
    };
    request.onsuccess = function(event) {
      resolve(event.target.result ?? { term, urls: [] });
    };
  });
}

async function setUrlsForTerm(term, urls) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("inverted_index", "readwrite").objectStore("inverted_index").put({ term, urls });
    request.onerror = function(event) {
      console.error("setUrlsForTerm error");
      console.error(event);
      reject(event.target);
    };
    request.onsuccess = function(event) {
      resolve(event.target);
    };
  });
}

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

async function lookup({searchString}) {
  console.log("Looking up: " + searchString);
  cleaned = cleanContent(searchString);
  const findings = {};
  for (const word of cleaned) {
    const records = (await getUrlsForTerm(word)).urls;
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
  console.log("findings" + findingsArr)
  return findingsArr;
}

async function index({
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
    const records = (await getUrlsForTerm(word)).urls;
    records.push({
      ...contentDb[word],
      url,
      title,
    });
    await setUrlsForTerm(word, records);
  }
}

const actions = {
  "index": index,
  "lookup": lookup,
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  sendResponse(actions[message.type](message.args));
});
