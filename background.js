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

async function _lookupParsedCorpusWords(words) {
  const wordsAlreadyFound = [];
  const findings = {};
  for (const word of words) {
    const uniqueWords = deduplicateWords([word.raw, word.stripped, word.stemmed]);
    for (const uniqueWord of uniqueWords) {
      if (wordsAlreadyFound.includes(uniqueWord.word)) {
        continue;
      }
      console.log({
        uniqueWord
      })
      wordsAlreadyFound.push(uniqueWord.word);
      const recordsWhole = await getUrlsForTerm(uniqueWord.word);
      const records = recordsWhole.urls;
      console.log({
        records
      })
      for (const record of records) {
        const { url, occurrences } = record;
        const finding = findings[url] ?? {
          url,
          occurrences: [],
        };
        finding.occurrences = finding.occurrences.concat(occurrences);
        findings[url] = finding;
      }
    }
  }
  return findings;
}

// bigrams will get bigger multipliers
const RAW_MULTIPLIER = 100;
const STRIPPED_MULTIPLIER = 90;
const STEMMED_MULTIPLIER = 80;
const MULTIPLIERS = {
  "raw": RAW_MULTIPLIER,
  "stripped": STRIPPED_MULTIPLIER,
  "stemmed": STEMMED_MULTIPLIER,
}
async function lookup({searchString}) {
  console.log("Looking up: " + searchString);
  const { subWords, fullWords } = parseCorpus(searchString);

  // TODO when we do bigrams the sub vs full will matter, but right now we shuold just combine
  const allRawWords = new Set();
  const wordsToLookup = [];
  for (const w of fullWords) {
    if (allRawWords.has(w.raw.word)) {
      continue;
    }
    allRawWords.add(w.raw.word);
    wordsToLookup.push(w);
  }
  for (const w of subWords) {
    if (allRawWords.has(w.raw.word)) {
      continue;
    }
    allRawWords.add(w.raw.word);
    wordsToLookup.push(w);
  }

  console.info({
    wordsToLookup
  })

  const findings = await _lookupParsedCorpusWords(wordsToLookup);
  console.info({
    findings
  })
  const findingsArr = Object.keys(findings).map(url => findings[url]);

  const findingsRanked = findingsArr.map(f => {
    let score = 0;
    for (const occurrence of f.occurrences) {
      score += MULTIPLIERS[occurrence.type]
    }
    return {
      ...f,
      score
    }
  }).sort((a, b) => b.score - a.score).slice(0, 10);
  console.info({
    findingsRanked
  })

  for (const finding of findingsRanked) {
    const page = await retrievePage(finding.url);
    const earliestOccurrence = finding.occurrences.reduce((earliestIndex, currFinding) => {
      if (currFinding.startIndex < earliestIndex) {
        return currFinding.startIndex;
      }
      return earliestIndex;
    }, page.content.length);
    finding.snippet = page.content.substring(earliestOccurrence, Math.min(earliestOccurrence + 300, page.content.length)).replaceAll("\n", " ");
    finding.snippetOffset = earliestOccurrence;
    finding.title = page.title;
  }
  console.info({
    findingsRanked
  })
  return findingsRanked;
}

function _indexParsedCorpusWords(words) {
  const contentDb = {}
  for (const word of words) {
    const uniqueWords = deduplicateWords([word.raw, word.stripped, word.stemmed]);
    for (const uniqueWord of uniqueWords) {
      const record = contentDb[uniqueWord.word] ?? {
        occurrences: [],
      };
      record.occurrences.push(uniqueWord);
      contentDb[uniqueWord.word] = record;
    }
  }
  console.info({
    inside: true,
    contentDb
  })
  return contentDb;
}
async function index({
  url,
  title,
  content,
}) {
  console.log("\nIndexing: " + url + "\n" + title);
  const normalizedUrl = normalizeUrl(url);
  // TODO if we've already indexed this page...
  // if its the same, skip
  // if its different, purge and then index
  const { subWords, fullWords } = parseCorpus(content);
  console.info({
    subWords,
    fullWords,
  })

  // TODO handle duplicates between subWords and fullWords better?
  const contentDb = {
    ..._indexParsedCorpusWords(subWords),
    ..._indexParsedCorpusWords(fullWords),
  }
  console.info({
    contentDb
  })
  for (word of Object.keys(contentDb)) {
    const records = (await getUrlsForTerm(word)).urls;
    records.push({
      ...contentDb[word],
      url: normalizedUrl,
    });
    await setUrlsForTerm(word, records);
  }
  await storePage(normalizedUrl, title, content);
}

const actions = {
  "index": index,
  "lookup": lookup,
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  sendResponse(actions[message.type](message.args));
});
