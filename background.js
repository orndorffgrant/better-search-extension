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

async function retrievePage(url) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("urls").objectStore("urls").get(url);
    request.onerror = function(event) {
      console.error("retrievePage error");
      console.error(event);
      reject(event.target)
    };
    request.onsuccess = function(event) {
      resolve(event.target.result);
    };
  });
}
async function storePage(url, title, content) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("urls", "readwrite").objectStore("urls").put({ url, title, content });
    request.onerror = function(event) {
      console.error("storePage error");
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

const whitespaceChars = [" ","\n","\t","\r"];
const punctuationChars = [",",".","<",">","/","?",":",";","'",'"',"[","{","]","}","|","\\","~","`","!","@","#","$","%","^","&","*","(",")","-","_","+","="];
const subWordStopChars = whitespaceChars + punctuationChars;
const fullWordStopChars = whitespaceChars + [",",".","?","'",'"',"[","{","]","}","`","!","(",")"];
function stripPunctuation(word) {
  let beginIndex = 0;
  for (; beginIndex < word.length; beginIndex++) {
    if (!subWordStopChars.includes(word[beginIndex])) {
      break;
    }
  }
  let endIndex = word.length - 1;
  for (; endIndex >= 0; endIndex--) {
    if (!subWordStopChars.includes(word[endIndex])) {
      break;
    }
  }
  return word.substring(beginIndex, endIndex + 1);
}
function parseCorpus(corpus) {
  // TODO don't include single character words
  corpus = corpus.toLowerCase() + " ";
  const fullWords = [];
  let currentFullWord = {
    type: "raw",
    startIndex: 0,
    endIndex: 0,
    word: "",
  };
  const subWords = [];
  let currentSubWord = {
    type: "raw",
    startIndex: 0,
    endIndex: 0,
    word: "",
  };
  // include punctuation in words, but when appending, append with and without punctuation"
  for (let i = 0; i < corpus.length; i++) {
    let currChar = corpus[i];
    if (fullWordStopChars.includes(currChar)) {
      // scenarios
      // 1. beginning word
      // 1.1 whitespace -> skip, don't add it
      // 1.2 nonwhitespace -> go ahead and add it
      // 2. ending word
      // 2.1 whitespace -> don't add it but finish
      // 2.2 nonwhitespace -> add it and finish
      if (currentFullWord.word === "") {
        if (whitespaceChars.includes(currChar)) {
          continue;
        } else {
          currentFullWord.startIndex = i;
          currentFullWord.word = currentFullWord.word + currChar;
        }
      } else {
        if (!whitespaceChars.includes(currChar)) {
          currentFullWord.word = currentFullWord.word + currChar;
        }
        currentFullWord.endIndex = i;

        const strippedWord = stripPunctuation(currentFullWord.word);
        const currentFullWordWithoutPunctuation = {
          type: "stripped",
          startIndex: currentFullWord.startIndex,
          endIndex: currentFullWord.endIndex,
          word: strippedWord,
        }
        const currentFullWordStemmed = {
          type: "stemmed",
          startIndex: currentFullWord.startIndex,
          endIndex: currentFullWord.endIndex,
          word: stemmer(strippedWord),
        }
        fullWords.push({
          raw: currentFullWord,
          stripped: currentFullWordWithoutPunctuation,
          stemmed: currentFullWordStemmed,
        });
        currentFullWord = {
          type: "raw",
          startIndex: i,
          endIndex: i,
          word: "",
        };
      }
    } else if (currentFullWord.word === "") {
      currentFullWord.startIndex = i;
      currentFullWord.word = currentFullWord.word + currChar;
    } else { // not the beginning or the end, so just push the char
      currentFullWord.word = currentFullWord.word + currChar;
    }

    // same as above chunk but for sub word
    if (subWordStopChars.includes(currChar)) {
      if (currentSubWord.word === "") {
        if (whitespaceChars.includes(currChar)) {
          continue;
        } else {
          currentSubWord.startIndex = i;
          currentSubWord.word = currentSubWord.word + currChar;
        }
      } else {
        if (!whitespaceChars.includes(currChar)) {
          currentSubWord.word = currentSubWord.word + currChar;
        }
        currentSubWord.endIndex = i;

        const strippedWord = stripPunctuation(currentSubWord.word);
        const currentSubWordWithoutPunctuation = {
          type: "stripped",
          startIndex: currentSubWord.startIndex,
          endIndex: currentSubWord.endIndex,
          word: strippedWord,
        }
        const currentSubWordStemmed = {
          type: "stemmed",
          startIndex: currentSubWord.startIndex,
          endIndex: currentSubWord.endIndex,
          word: stemmer(strippedWord),
        }
        subWords.push({
          raw: currentSubWord,
          stripped: currentSubWordWithoutPunctuation,
          stemmed: currentSubWordStemmed,
        });
        currentSubWord = {
          type: "raw",
          startIndex: i,
          endIndex: i,
          word: "",
        };
      }
    } else if (currentSubWord.word === "") {
      currentSubWord.startIndex = i;
      currentSubWord.word = currentSubWord.word + currChar;
    } else { // not the beginning or the end, so just push the char
      currentSubWord.word = currentSubWord.word + currChar;
    }
  }
  return {
    subWords, fullWords
  }
}
function normalizeUrl(url_string) {
  // TODO filter out known metrics/tracking serach params
  const url = new URL(url_string)
  url.username = "";
  url.password = "";
  url.hash = "";
  return url.href
}
function deduplicateWords(words) {
  const deduplicated = [];
  for (const word of words) {
    const found = deduplicated.find(w => w.word === word.word);
    if (!found) {
      deduplicated.push(word);
    }
  }
  return deduplicated;
}

async function lookup({searchString}) {
  console.log("Looking up: " + searchString);
  const { subWords, fullWords } = parseCorpus(content);

  // const findings = {};
  // for (const subWord of subWords) {
  //   const uniqueWords = deduplicateWords([subWord.raw, subWord.stripped, subWord.stemmed]);
  //   for (const uniqueWord of uniqueWords) {
  //     const record = contentDb[uniqueWord.word] ?? {
  //       occurences: [],
  //     };
  //     record.occurences.push(uniqueWord);
  //     contentDb[word] = record;
  //   }
  // }


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
  findingsArr.sort((a, b) => b.count - a.count).slice(0, 10);
  console.log("findings" + JSON.stringify(findingsArr));
  return findingsArr;
}

function _indexParsedCorpusWords(words) {
  const contentDb = {}
  for (const word of words) {
    const uniqueWords = deduplicateWords([word.raw, word.stripped, word.stemmed]);
    for (const uniqueWord of uniqueWords) {
      const record = contentDb[uniqueWord.word] ?? {
        occurences: [],
      };
      record.occurences.push(uniqueWord);
      contentDb[word] = record;
    }
  }
  return contentDb;
}
async function index({
  url,
  title,
  content,
}) {
  console.log("\nIndexing: " + url + "\n" + title);
  const normalizedUrl = normalizeUrl(url);
  const { subWords, fullWords } = parseCorpus(content);

  const contentDb = {
    ..._indexParsedCorpusWords(subWords),
    ..._indexParsedCorpusWords(fullSubWords),
  }
  for (word of Object.keys(contentDb)) {
    const records = (await getUrlsForTerm(word)).urls;
    records.push({
      ...contentDb[word],
      url: normalizedUrl,
    });
    await setUrlsForTerm(word, records);
  }
  await storePage(normalizeUrl, title, content);
}

const actions = {
  "index": index,
  "lookup": lookup,
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  sendResponse(actions[message.type](message.args));
});
