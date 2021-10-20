const search = document.getElementById("search");
const resultsContainer = document.getElementById("results");
const resultTemplate = document.querySelector("#result");

search.onchange = () => {
  browser.runtime.sendMessage({
    type: "lookup",
    args: {
        searchString: search.value
    },
  }).then((results) => {
    resultsContainer.innerHTML = "";
    results.forEach(result => {
      const resultElement = resultTemplate.content.cloneNode(true);
      const a = resultElement.querySelector(".link-title");
      a.href = result.url;
      a.innerText = result.title;
      const urlspan = resultElement.querySelector(".link");
      urlspan.innerText = result.url;
      resultsContainer.appendChild(resultElement);
    })
  })
};

if (document.activeElement !== search) {
  console.log("aha!");
  // or just location.reload()?
  (async function() {browser.tabs.reload((await browser.tabs.getCurrent()).id)})()
}
